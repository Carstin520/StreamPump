import {
  Prisma,
  PrismaClient,
  PublicationVerificationStatus,
} from "@prisma/client";

import { HttpError } from "../controllers/http";
import { serializeAsset, serializePublication } from "../controllers/contentManifestShared";
import { syncManifestPublicationEligibility } from "./contentPublicationEligibility";
import { recordPilotOperatorEvent } from "./pilotOperatorAudit";
import { prisma } from "./prisma";

type PublicationRecoveryPrisma = Pick<
  PrismaClient,
  "contentPublication" | "pilotOperatorEvent" | "$transaction"
>;

export type ContentPublicationRecoveryDependencies = {
  prisma: PublicationRecoveryPrisma;
  syncEligibility: typeof syncManifestPublicationEligibility;
};

const defaultDependencies: ContentPublicationRecoveryDependencies = {
  prisma,
  syncEligibility: syncManifestPublicationEligibility,
};

const publicationInclude = {
  manifest: {
    include: {
      assets: {
        orderBy: { orderIndex: "asc" as const },
      },
    },
  },
} satisfies Prisma.ContentPublicationInclude;

type OperatorPublication = Prisma.ContentPublicationGetPayload<{
  include: typeof publicationInclude;
}>;

export const normalizePublicationQueueStatus = (
  value: unknown
): PublicationVerificationStatus => {
  const normalized = String(value ?? PublicationVerificationStatus.PENDING)
    .trim()
    .toUpperCase();
  if (!Object.values(PublicationVerificationStatus).includes(normalized as PublicationVerificationStatus)) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "status must be PENDING, VERIFIED, or REJECTED"
    );
  }
  return normalized as PublicationVerificationStatus;
};

const normalizeReason = (value: string): string => {
  const reason = value.trim();
  if (!reason) {
    throw new HttpError(400, "INVALID_INPUT", "reason is required");
  }
  if (reason.length > 1000) {
    throw new HttpError(400, "INVALID_INPUT", "reason must not exceed 1000 characters");
  }
  return reason;
};

const normalizeOperator = (value: string): string => {
  const operatorIdentity = value.trim();
  if (!operatorIdentity) {
    throw new HttpError(500, "OPERATOR_IDENTITY_MISSING", "operator identity is required");
  }
  return operatorIdentity;
};

const normalizeEvidenceDigest = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() || null;
  if (normalized && !/^[0-9a-f]{64}$/.test(normalized)) {
    throw new HttpError(400, "INVALID_INPUT", "evidenceDigestHex must be a SHA-256 hex digest");
  }
  return normalized;
};

export const serializeOperatorPublication = (publication: OperatorPublication) => ({
  ...serializePublication(publication),
  manifest: {
    manifestId: publication.manifest.id,
    creatorWallet: publication.manifest.creatorWallet,
    title: publication.manifest.title,
    status: publication.manifest.status,
    version: publication.manifest.version,
    manifestHashHex: publication.manifest.manifestHashHex,
    currentAnchorPda: publication.manifest.currentAnchorPda,
    currentAnchorTx: publication.manifest.currentAnchorTx,
    isPublicFeedEligible: publication.manifest.isPublicFeedEligible,
    assets: publication.manifest.assets.map(serializeAsset),
  },
});

export const listOperatorPublications = async (
  params: { status: PublicationVerificationStatus; limit: number },
  dependencies: ContentPublicationRecoveryDependencies = defaultDependencies
) => {
  const publications = await dependencies.prisma.contentPublication.findMany({
    where: { verificationStatus: params.status },
    include: publicationInclude,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: params.limit,
  });
  return publications.map(serializeOperatorPublication);
};

export const getOperatorPublication = async (
  publicationId: string,
  dependencies: ContentPublicationRecoveryDependencies = defaultDependencies
) => {
  const publication = await dependencies.prisma.contentPublication.findUnique({
    where: { id: publicationId },
    include: publicationInclude,
  });
  if (!publication) {
    throw new HttpError(404, "PUBLICATION_NOT_FOUND", "publication not found");
  }
  const auditEvents = await dependencies.prisma.pilotOperatorEvent.findMany({
    where: {
      resourceType: "CONTENT_PUBLICATION",
      resourceId: publication.id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return {
    ...serializeOperatorPublication(publication),
    auditEvents: auditEvents.map((event) => ({
      eventId: event.id,
      action: event.action,
      operatorIdentity: event.operatorIdentity,
      reason: event.reason,
      evidenceDigestHex: event.evidenceDigestHex,
      payload: event.payloadJson,
      createdAt: event.createdAt.toISOString(),
    })),
  };
};

const loadPublication = async (
  publicationId: string,
  dependencies: ContentPublicationRecoveryDependencies
) => {
  const publication = await dependencies.prisma.contentPublication.findUnique({
    where: { id: publicationId },
  });
  if (!publication) {
    throw new HttpError(404, "PUBLICATION_NOT_FOUND", "publication not found");
  }
  return publication;
};

export const reopenContentPublication = async (
  params: {
    publicationId: string;
    operatorIdentity: string;
    reason: string;
  },
  dependencies: ContentPublicationRecoveryDependencies = defaultDependencies
) => {
  const operatorIdentity = normalizeOperator(params.operatorIdentity);
  const reason = normalizeReason(params.reason);
  const publication = await loadPublication(params.publicationId, dependencies);
  if (publication.verificationStatus === PublicationVerificationStatus.PENDING) {
    const eligibility = await dependencies.syncEligibility(publication.manifestId);
    return {
      publicationId: publication.id,
      manifestId: publication.manifestId,
      verificationStatus: publication.verificationStatus,
      publicFeedEligible: eligibility.publicFeedEligible,
      changed: false,
    };
  }

  await dependencies.prisma.$transaction(async (tx) => {
    const write = await tx.contentPublication.updateMany({
      where: {
        id: publication.id,
        verificationStatus: publication.verificationStatus,
      },
      data: {
        verificationStatus: PublicationVerificationStatus.PENDING,
        verificationSource: null,
        verificationReviewer: null,
        verificationNote: null,
        verificationEvidenceDigestHex: null,
        verifiedAt: null,
        rejectedAt: null,
      },
    });
    if (write.count !== 1) {
      throw new HttpError(409, "PUBLICATION_RECOVERY_CONFLICT", "publication changed while reopening");
    }
    await recordPilotOperatorEvent(tx, {
      action: "PUBLICATION_REOPENED",
      operatorIdentity,
      resourceType: "CONTENT_PUBLICATION",
      resourceId: publication.id,
      reason,
      payload: {
        beforeStatus: publication.verificationStatus,
        afterStatus: PublicationVerificationStatus.PENDING,
        priorReviewer: publication.verificationReviewer,
        priorEvidenceDigestHex: publication.verificationEvidenceDigestHex,
      },
    });
  });

  const eligibility = await dependencies.syncEligibility(publication.manifestId);
  return {
    publicationId: publication.id,
    manifestId: publication.manifestId,
    verificationStatus: PublicationVerificationStatus.PENDING,
    publicFeedEligible: eligibility.publicFeedEligible,
    changed: true,
  };
};

export const revokeContentPublication = async (
  params: {
    publicationId: string;
    operatorIdentity: string;
    reason: string;
    evidenceDigestHex?: string | null;
  },
  dependencies: ContentPublicationRecoveryDependencies = defaultDependencies
) => {
  const operatorIdentity = normalizeOperator(params.operatorIdentity);
  const reason = normalizeReason(params.reason);
  const evidenceDigestHex = normalizeEvidenceDigest(params.evidenceDigestHex);
  const publication = await loadPublication(params.publicationId, dependencies);
  if (publication.verificationStatus !== PublicationVerificationStatus.VERIFIED) {
    throw new HttpError(
      409,
      "PUBLICATION_NOT_VERIFIED",
      "only a verified publication can be revoked"
    );
  }
  const revokedAt = new Date();

  await dependencies.prisma.$transaction(async (tx) => {
    const write = await tx.contentPublication.updateMany({
      where: {
        id: publication.id,
        verificationStatus: PublicationVerificationStatus.VERIFIED,
      },
      data: {
        verificationStatus: PublicationVerificationStatus.REJECTED,
        verificationSource: "OPERATOR_REVOKED",
        verificationReviewer: operatorIdentity,
        verificationNote: reason,
        verificationEvidenceDigestHex: evidenceDigestHex,
        verifiedAt: null,
        rejectedAt: revokedAt,
      },
    });
    if (write.count !== 1) {
      throw new HttpError(409, "PUBLICATION_RECOVERY_CONFLICT", "publication changed while revoking");
    }
    await recordPilotOperatorEvent(tx, {
      action: "PUBLICATION_REVOKED",
      operatorIdentity,
      resourceType: "CONTENT_PUBLICATION",
      resourceId: publication.id,
      reason,
      evidenceDigestHex,
      payload: {
        beforeStatus: publication.verificationStatus,
        afterStatus: PublicationVerificationStatus.REJECTED,
        priorReviewer: publication.verificationReviewer,
        priorEvidenceDigestHex: publication.verificationEvidenceDigestHex,
      },
    });
  });

  const eligibility = await dependencies.syncEligibility(publication.manifestId);
  return {
    publicationId: publication.id,
    manifestId: publication.manifestId,
    verificationStatus: PublicationVerificationStatus.REJECTED,
    verificationSource: "OPERATOR_REVOKED",
    verificationReviewer: operatorIdentity,
    verificationNote: reason,
    verificationEvidenceDigestHex: evidenceDigestHex,
    rejectedAt: revokedAt.toISOString(),
    publicFeedEligible: eligibility.publicFeedEligible,
    changed: true,
  };
};

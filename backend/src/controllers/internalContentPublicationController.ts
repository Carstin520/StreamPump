import { PublicationVerificationStatus } from "@prisma/client";

import {
  assertManifestFinalized,
} from "./contentManifestController";
import {
  HttpError,
  ok,
  parseNonEmptyString,
  parseOptionalString,
  parsePositiveInt,
  withController,
} from "./http";
import { syncManifestPublicationEligibility } from "../services/contentPublicationEligibility";
import {
  buildPublicationReviewData,
  normalizePublicationTarget,
} from "../services/contentPublicationReview";
import { isAssetStorageVerified } from "../services/contentStorageVerification";
import { prisma } from "../services/prisma";
import {
  getOperatorPublication,
  listOperatorPublications,
  normalizePublicationQueueStatus,
  reopenContentPublication,
  revokeContentPublication,
} from "../services/contentPublicationRecoveryService";

export const listContentPublicationsForReview = withController(
  "LIST_CONTENT_PUBLICATIONS_FAILED",
  async (req, res) => {
    const status = normalizePublicationQueueStatus(req.query.status);
    const limit = req.query.limit === undefined ? 50 : parsePositiveInt(req.query.limit, "limit");
    if (limit > 100) {
      throw new HttpError(400, "INVALID_INPUT", "limit must not exceed 100");
    }
    const publications = await listOperatorPublications({ status, limit });
    ok(res, {
      status,
      count: publications.length,
      publications,
    });
  }
);

export const getContentPublicationForReview = withController(
  "GET_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");
    ok(res, await getOperatorPublication(publicationId));
  }
);

export const reopenReviewedContentPublication = withController(
  "REOPEN_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");
    const result = await reopenContentPublication({
      publicationId,
      operatorIdentity: req.operatorIdentity ?? "",
      reason: parseNonEmptyString(req.body.reason, "reason"),
    });
    ok(res, result);
  }
);

export const revokeReviewedContentPublication = withController(
  "REVOKE_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");
    const result = await revokeContentPublication({
      publicationId,
      operatorIdentity: req.operatorIdentity ?? "",
      reason: parseNonEmptyString(req.body.reason, "reason"),
      evidenceDigestHex: parseOptionalString(req.body.evidenceDigestHex),
    });
    ok(res, result);
  }
);

export const reviewContentPublication = withController(
  "REVIEW_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");
    const decision = parseNonEmptyString(req.body.decision, "decision");
    const publication = await prisma.contentPublication.findUnique({
      where: { id: publicationId },
      include: {
        manifest: {
          include: { assets: true },
        },
      },
    });

    if (!publication) {
      throw new HttpError(404, "PUBLICATION_NOT_FOUND", "publication not found");
    }
    const reviewData = buildPublicationReviewData({
      decision,
      reviewer: req.operatorIdentity ?? "",
      note: parseOptionalString(req.body.note),
      evidenceDigestHex: parseOptionalString(req.body.evidenceDigestHex),
    });
    const approving =
      reviewData.verificationStatus === PublicationVerificationStatus.VERIFIED;
    if (approving) {
      assertManifestFinalized(publication.manifest);
      const unverifiedAsset = publication.manifest.assets.find(
        (asset) => !isAssetStorageVerified(asset)
      );
      if (unverifiedAsset) {
        throw new HttpError(
          409,
          "ASSET_STORAGE_UNVERIFIED",
          "all publication assets must pass backend storage verification"
        );
      }
      normalizePublicationTarget({
        platform: publication.platform,
        externalUrl: publication.externalUrl,
        internalCanonicalUrl: publication.manifest.internalCanonicalUrl as string,
        allowInsecureInternalUrl: process.env.NODE_ENV !== "production",
      });
    }

    const respond = async (reviewed: typeof publication) => {
      const eligibility = await syncManifestPublicationEligibility(publication.manifestId);
      ok(res, {
        publicationId: reviewed.id,
        manifestId: reviewed.manifestId,
        verificationStatus: reviewed.verificationStatus,
        verificationSource: reviewed.verificationSource,
        verificationReviewer: reviewed.verificationReviewer,
        verificationNote: reviewed.verificationNote,
        verificationEvidenceDigestHex: reviewed.verificationEvidenceDigestHex,
        verifiedAt: reviewed.verifiedAt?.toISOString() ?? null,
        rejectedAt: reviewed.rejectedAt?.toISOString() ?? null,
        publicFeedEligible: eligibility.publicFeedEligible,
        assetsReady: eligibility.assetsReady,
      });
    };

    if (publication.verificationStatus !== PublicationVerificationStatus.PENDING) {
      if (publication.verificationStatus !== reviewData.verificationStatus) {
        throw new HttpError(409, "PUBLICATION_ALREADY_REVIEWED", "publication was already reviewed");
      }
      await respond(publication);
      return;
    }

    const reviewWrite = await prisma.contentPublication.updateMany({
      where: {
        id: publication.id,
        verificationStatus: PublicationVerificationStatus.PENDING,
      },
      data: reviewData,
    });
    if (reviewWrite.count !== 1) {
      const raced = await prisma.contentPublication.findUnique({ where: { id: publication.id } });
      if (!raced || raced.verificationStatus !== reviewData.verificationStatus) {
        throw new HttpError(409, "PUBLICATION_ALREADY_REVIEWED", "publication was already reviewed");
      }
      await respond({ ...publication, ...raced });
      return;
    }
    const reviewed = await prisma.contentPublication.findUniqueOrThrow({
      where: { id: publication.id },
    });
    await respond({ ...publication, ...reviewed });
  }
);

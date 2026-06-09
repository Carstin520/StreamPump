/**
 * CN: 内容清单控制器，负责 manifest 创建、素材预签名上传、完成回调和 publication 映射。
 * EN: Content manifest controller that handles manifest creation, asset presign/upload completion, and publication mapping.
 */
import {
  AssetType,
  AssetProcessingStatus,
  AssetProcessingSource,
  AssetUploadStatus,
  ContentManifestStatus,
  PublicationVerificationStatus,
  Prisma,
} from "@prisma/client";

import {
  HttpError,
  ensureIdempotencyKey,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parsePositiveInt,
  parseOptionalJsonObject,
  parseOptionalString,
  parseSha256Hex,
  parseStringArray,
  requireSessionWallet,
  withController,
} from "./http";
import {
  assertAssetAndMimeTypeMatch,
  normalizeAssetType,
  requireOwnedManifest,
  serializeAsset,
  serializeManifest,
  serializeManifestDetail,
  serializeManifestListItem,
} from "./contentManifestShared";
import {
  computeManifestFinalizeState,
  keccakHex,
  normalizeContentType,
  sha256Hex,
} from "../services/contentManifestService";
import { config } from "../../config/default";
import { prisma } from "../services/prisma";
import {
  assertAllowedMimeType,
  CompletedMultipartPart,
  extensionForMimeType,
  isVideoMimeType,
  r2Service,
} from "../services/R2Service";
import { backfillDisplayVariantFromStorage } from "../services/imageVariants";
import { issueCreatorAuthSignature as issueCreatorAuthSignatureService } from "../services/creatorAuth";
import { syncManifestPublicationEligibility } from "../services/contentPublicationEligibility";

interface PresignAssetPlan {
  assetType: AssetType;
  orderIndex: number;
  sha256HexDigest: string;
  mimeType: string;
  fileSizeBytes: bigint;
}

export const issueCreatorAuthSignature = withController(
  "ISSUE_CREATOR_AUTH_SIGNATURE_FAILED",
  async (req, res) => {
    const creatorWallet = requireSessionWallet(req);
    const twitterHandle = parseNonEmptyString(req.body.twitterHandle, "twitterHandle");
    const twitterAccessToken = parseOptionalString(req.body.twitterAccessToken);
    const authorization = await issueCreatorAuthSignatureService({
      creatorWallet,
      twitterHandle,
      twitterAccessToken,
    });

    ok(res, authorization, 201);
  }
);

const readMaxAssetSizeBytes = (): bigint =>
  BigInt(Math.max(0, Math.floor(config.storage.origin.maxAssetSizeBytes)));

const readMonthlyUploadLimitBytes = (): bigint =>
  BigInt(Math.max(0, Math.floor(config.storage.origin.monthlyUploadLimitBytes)));

const currentUtcMonthStart = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const parsePresignAssetPlan = (rawAsset: unknown): PresignAssetPlan => {
  const payload =
    rawAsset && typeof rawAsset === "object" ? (rawAsset as Record<string, unknown>) : null;

  if (!payload) {
    throw new HttpError(400, "INVALID_INPUT", "each asset must be an object");
  }

  const assetType = normalizeAssetType(payload.assetType);
  const orderIndex = parseNonNegativeInt(payload.orderIndex, "orderIndex");
  const sha256HexDigest = parseSha256Hex(payload.sha256Hex, "sha256Hex");
  const mimeType = parseNonEmptyString(payload.mimeType, "mimeType").toLowerCase();
  const fileSizeBytes = parseNonNegativeBigInt(payload.fileSizeBytes, "fileSizeBytes");
  const maxAssetSizeBytes = readMaxAssetSizeBytes();

  if (maxAssetSizeBytes > 0n && fileSizeBytes > maxAssetSizeBytes) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `fileSizeBytes exceeds current limit (${maxAssetSizeBytes.toString()} bytes)`
    );
  }

  assertAllowedMimeType(mimeType);
  assertAssetAndMimeTypeMatch(assetType, mimeType);

  return {
    assetType,
    orderIndex,
    sha256HexDigest,
    mimeType,
    fileSizeBytes,
  };
};

const assertR2MonthlyUploadBudget = async (
  manifestId: string,
  requestedBytes: bigint
): Promise<void> => {
  const monthlyUploadLimitBytes = readMonthlyUploadLimitBytes();

  if (monthlyUploadLimitBytes <= 0n) {
    return;
  }

  const aggregate = await prisma.contentAsset.aggregate({
    _sum: {
      fileSizeBytes: true,
    },
    where: {
      createdAt: {
        gte: currentUtcMonthStart(),
      },
      manifestId: {
        not: manifestId,
      },
      uploadStatus: {
        in: [AssetUploadStatus.PENDING, AssetUploadStatus.UPLOADED],
      },
    },
  });
  const usedBytes = aggregate._sum.fileSizeBytes ?? 0n;
  const projectedBytes = usedBytes + requestedBytes;

  if (projectedBytes > monthlyUploadLimitBytes) {
    throw new HttpError(
      429,
      "R2_MONTHLY_UPLOAD_LIMIT_EXCEEDED",
      `R2 monthly upload budget exceeded: projected ${projectedBytes.toString()} bytes, limit ${monthlyUploadLimitBytes.toString()} bytes`
    );
  }
};

const parseCompletedMultipartParts = (value: unknown): CompletedMultipartPart[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "INVALID_INPUT", "parts must be a non-empty array");
  }

  const seenPartNumbers = new Set<number>();

  return value.map((rawPart, index) => {
    const payload =
      rawPart && typeof rawPart === "object" ? (rawPart as Record<string, unknown>) : null;

    if (!payload) {
      throw new HttpError(400, "INVALID_INPUT", `parts[${index}] must be an object`);
    }

    const partNumber = parsePositiveInt(payload.partNumber, `parts[${index}].partNumber`);
    const etag = parseNonEmptyString(payload.etag, `parts[${index}].etag`);

    if (seenPartNumbers.has(partNumber)) {
      throw new HttpError(
        400,
        "INVALID_INPUT",
        `parts[${index}].partNumber must be unique`
      );
    }

    seenPartNumbers.add(partNumber);

    return {
      partNumber,
      etag,
    };
  });
};

export const createContentManifest = withController("CREATE_CONTENT_MANIFEST_FAILED", async (req, res) => {
  ensureIdempotencyKey(req);

  try {
    const creatorWallet = requireSessionWallet(req);
    const contentType = normalizeContentType(req.body.contentType);
    const title = parseOptionalString(req.body.title);
    const captionText = parseOptionalString(req.body.captionText);
    const tags = parseStringArray(req.body.tags, "tags");
    const metadataJson = parseOptionalJsonObject(req.body.metadata);

    const manifest = await prisma.contentManifest.create({
      data: {
        creatorWallet,
        contentType,
        status: ContentManifestStatus.DRAFT,
        title,
        captionText,
        tagsJson: tags,
        metadataJson,
      },
    });

    ok(res, serializeManifest(manifest), 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("contentType")) {
      throw new HttpError(400, "INVALID_INPUT", error.message);
    }

    throw error;
  }
});

export const presignManifestAssets = withController(
  "PRESIGN_MANIFEST_ASSETS_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const creatorWallet = requireSessionWallet(req);
    const manifestId = parseNonEmptyString(req.params.manifestId, "manifestId");
    const manifest = await requireOwnedManifest(manifestId, creatorWallet);
    const inputs = Array.isArray(req.body.assets) ? req.body.assets : null;

    if (!inputs || inputs.length === 0) {
      throw new HttpError(400, "INVALID_INPUT", "assets must be a non-empty array");
    }

    const assetPlans: PresignAssetPlan[] = inputs.map((input: unknown) =>
      parsePresignAssetPlan(input)
    );
    const requestedBytes = assetPlans.reduce(
      (totalBytes: bigint, assetPlan: PresignAssetPlan) => totalBytes + assetPlan.fileSizeBytes,
      0n
    );
    await assertR2MonthlyUploadBudget(manifest.id, requestedBytes);

    const uploads = [];

    for (const assetPlan of assetPlans) {
      const { assetType, orderIndex, sha256HexDigest, mimeType, fileSizeBytes } = assetPlan;
      const extension = extensionForMimeType(mimeType);
      const storageKey = `content/${manifest.id}/v/${manifest.version}/${orderIndex}-${sha256HexDigest.slice(
        0,
        12
      )}.${extension}`;

      const asset = await prisma.contentAsset.upsert({
        where: {
          manifestId_orderIndex: {
            manifestId: manifest.id,
            orderIndex,
          },
        },
        update: {
          assetType,
          sha256Hex: sha256HexDigest,
          mimeType,
          fileSizeBytes,
          storageKey,
          cdnUrl: null,
          uploadStatus: AssetUploadStatus.PENDING,
          processingStatus: AssetProcessingStatus.NONE,
          processingSource: null,
          muxAssetId: null,
          muxPlaybackId: null,
          muxLastKnownStatus: null,
          muxWebhookReceivedAt: null,
          muxLastCheckedAt: null,
          muxReadyAt: null,
          muxReconcileAttempts: 0,
          processingError: null,
        },
        create: {
          manifestId: manifest.id,
          assetType,
          orderIndex,
          sha256Hex: sha256HexDigest,
          mimeType,
          fileSizeBytes,
          storageKey,
          cdnUrl: null,
          uploadStatus: AssetUploadStatus.PENDING,
          processingStatus: AssetProcessingStatus.NONE,
          muxReconcileAttempts: 0,
        },
      });

      if (isVideoMimeType(mimeType)) {
        const multipartUpload = await r2Service.createMultipartUpload(
          storageKey,
          mimeType,
          fileSizeBytes
        );

        uploads.push({
          assetId: asset.id,
          assetType,
          orderIndex,
          storageKey,
          uploadStrategy: "MULTIPART",
          multipartUploadId: multipartUpload.uploadId,
          partCount: multipartUpload.partCount,
          partSizeBytes: multipartUpload.partSizeBytes,
          parts: multipartUpload.parts,
        });
      } else {
        const upload = await r2Service.generateUploadUrl(storageKey, mimeType);

        uploads.push({
          assetId: asset.id,
          assetType,
          orderIndex,
          storageKey,
          uploadStrategy: "SINGLE_PART",
          presignedUrl: upload.presignedUrl,
          expiresInSeconds: upload.expiresInSeconds,
        });
      }
    }

    await prisma.contentManifest.update({
      where: { id: manifest.id },
      data: {
        status: ContentManifestStatus.UPLOADING,
      },
    });

    ok(res, {
      manifestId: manifest.id,
      uploads,
    });
  }
);

export const completeManifestAssetUpload = withController(
  "COMPLETE_MANIFEST_ASSET_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const creatorWallet = requireSessionWallet(req);
    const manifestId = parseNonEmptyString(req.params.manifestId, "manifestId");
    const assetId = parseNonEmptyString(req.params.assetId, "assetId");

    const asset = await prisma.contentAsset.findFirst({
      where: {
        id: assetId,
        manifestId,
        manifest: {
          creatorWallet,
        },
      },
      include: {
        manifest: true,
      },
    });

    if (!asset) {
      throw new HttpError(404, "ASSET_NOT_FOUND", "content asset not found");
    }

    if (asset.uploadStatus === AssetUploadStatus.UPLOADED) {
      ok(res, {
        manifestId,
        asset: serializeAsset(asset),
      });
      return;
    }

    if (isVideoMimeType(asset.mimeType)) {
      const multipartUploadId = parseNonEmptyString(
        req.body?.multipartUploadId,
        "multipartUploadId"
      );
      const parts = parseCompletedMultipartParts(req.body?.parts);

      await r2Service.completeMultipartUpload(asset.storageKey, multipartUploadId, parts);
    }

    let updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: AssetUploadStatus.UPLOADED,
        cdnUrl: r2Service.buildCanonicalUrl(asset.storageKey),
      },
    });

    if (isVideoMimeType(asset.mimeType)) {
      updated = await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.NONE,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          muxAssetId: null,
          muxPlaybackId: null,
          muxLastKnownStatus: "queued",
          muxWebhookReceivedAt: null,
          muxLastCheckedAt: null,
          muxReadyAt: null,
          muxReconcileAttempts: 0,
          processingError: null,
        },
      });
    } else {
      await backfillDisplayVariantFromStorage(asset.storageKey).catch(() => null);
      updated = await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.READY,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          processingError: null,
        },
      });

      await syncManifestPublicationEligibility(manifestId);
    }

    ok(res, {
      manifestId,
      asset: serializeAsset(updated),
    });
  }
);

export const finalizeContentManifest = withController("FINALIZE_MANIFEST_FAILED", async (req, res) => {
  ensureIdempotencyKey(req);

  const creatorWallet = requireSessionWallet(req);
  const manifestId = parseNonEmptyString(req.params.manifestId, "manifestId");
  const manifest = await prisma.contentManifest.findFirst({
    where: {
      id: manifestId,
      creatorWallet,
    },
    include: {
      assets: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  if (!manifest) {
    throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
  }

  if (manifest.assets.length === 0) {
    throw new HttpError(409, "MANIFEST_EMPTY", "manifest must contain at least one asset");
  }

  const incomplete = manifest.assets.find((asset) => asset.uploadStatus !== AssetUploadStatus.UPLOADED);
  if (incomplete) {
    throw new HttpError(
      409,
      "ASSET_UPLOAD_INCOMPLETE",
      `asset ${incomplete.id} must reach UPLOADED before finalize`
    );
  }

  const finalized = computeManifestFinalizeState({
    manifest,
    assets: manifest.assets,
  });

  const updated = await prisma.contentManifest.update({
    where: { id: manifest.id },
    data: {
      status: manifest.currentAnchorPda ? ContentManifestStatus.ANCHORED : ContentManifestStatus.READY,
      captionTextHash: finalized.captionTextHash,
      canonicalManifestJson: finalized.canonicalManifestJson as Prisma.InputJsonValue,
      manifestHashHex: finalized.manifestHashHex,
      internalCanonicalUrl: finalized.internalCanonicalUrl,
      internalUrlDigestHex: finalized.internalUrlDigestHex,
    },
  });

  ok(res, {
    ...serializeManifest(updated),
    internalCanonicalUrl: updated.internalCanonicalUrl,
    internalUrlDigestHex: updated.internalUrlDigestHex,
    plannedContentAnchorPda: finalized.plannedContentAnchorPda,
  });
});

export const createContentPublication = withController(
  "CREATE_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const creatorWallet = requireSessionWallet(req);
    const manifestId = parseNonEmptyString(req.body.manifestId, "manifestId");
    const manifest = await prisma.contentManifest.findFirst({
      where: {
        id: manifestId,
        creatorWallet,
      },
      include: {
        assets: true,
      },
    });

    if (!manifest) {
      throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
    }

    const platform = parseNonEmptyString(req.body.platform, "platform").toUpperCase();
    const externalUrl = parseNonEmptyString(req.body.externalUrl, "externalUrl");
    const externalPostId = parseOptionalString(req.body.externalPostId);

    const publication = await prisma.contentPublication.create({
      data: {
        manifestId,
        platform,
        externalUrl,
        externalUrlDigestHex: keccakHex(externalUrl),
        externalPostIdHash: externalPostId ? sha256Hex(externalPostId) : null,
        verificationStatus: PublicationVerificationStatus.PENDING,
      },
    });

    ok(
      res,
      {
        publicationId: publication.id,
        manifestId: publication.manifestId,
        platform: publication.platform,
        externalUrl: publication.externalUrl,
        verificationStatus: publication.verificationStatus,
        createdAt: publication.createdAt.toISOString(),
      },
      201
    );
  }
);

export const verifyContentPublication = withController(
  "VERIFY_PUBLICATION_FAILED",
  async (req, res) => {
    const creatorWallet = requireSessionWallet(req);
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");
    const publication = await prisma.contentPublication.findUnique({
      where: { id: publicationId },
      include: {
        manifest: {
          include: {
            assets: true,
          },
        },
      },
    });

    if (!publication) {
      throw new HttpError(404, "PUBLICATION_NOT_FOUND", "publication not found");
    }

    if (publication.manifest.creatorWallet !== creatorWallet) {
      throw new HttpError(403, "FORBIDDEN", "publication does not belong to this creator");
    }

    const verifiedAt = publication.verifiedAt ?? new Date();
    const updated = await prisma.contentPublication.update({
      where: { id: publicationId },
      data: {
        verificationStatus: PublicationVerificationStatus.VERIFIED,
        verificationSource: publication.verificationSource ?? "SELF_VERIFY",
        verifiedAt,
      },
    });

    const manifest = publication.manifest;
    const eligibility = await syncManifestPublicationEligibility(manifest.id);

    ok(res, {
      publicationId,
      manifestId: manifest.id,
      verificationStatus: updated.verificationStatus,
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      publicFeedEligible: eligibility.publicFeedEligible,
      assetsReady: eligibility.assetsReady,
    });
  }
);

export const listContentManifests = withController("LIST_CONTENT_MANIFESTS_FAILED", async (req, res) => {
  const creatorWallet = requireSessionWallet(req);
  const manifests = await prisma.contentManifest.findMany({
    where: {
      creatorWallet,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      assets: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  ok(res, manifests.map((manifest) => serializeManifestListItem(manifest)));
});

export const getContentManifestById = withController("GET_CONTENT_MANIFEST_FAILED", async (req, res) => {
  const creatorWallet = requireSessionWallet(req);
  const manifestId = parseNonEmptyString(req.params.manifestId, "manifestId");
  const manifest = await prisma.contentManifest.findFirst({
    where: {
      id: manifestId,
      creatorWallet,
    },
    include: {
      assets: {
        orderBy: {
          orderIndex: "asc",
        },
      },
      publications: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!manifest) {
    throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
  }

  ok(res, serializeManifestDetail(manifest));
});

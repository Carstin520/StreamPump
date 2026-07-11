/**
 * CN: 内容清单控制器，负责 manifest 创建、素材预签名上传、完成回调和 publication 映射。
 * EN: Content manifest controller that handles manifest creation, asset presign/upload completion, and publication mapping.
 */
import {
  AssetType,
  AssetProcessingStatus,
  AssetProcessingSource,
  AssetUploadStatus,
  ContentAsset,
  ContentManifestStatus,
  PublicationVerificationStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

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
import {
  assertPromotedObjectMatches,
  buildVerifiedStorageKey,
  isAssetStorageVerified,
  StorageObjectVerificationError,
  shouldCompleteMultipartUpload,
  verifiedAssetMatchesUploadDeclaration,
  verifyStoredContentAsset,
} from "../services/contentStorageVerification";
import {
  assertCreatorPublicationVerificationAllowed,
  normalizePublicationTarget,
} from "../services/contentPublicationReview";
import {
  bindApiIdempotencyResource,
  getRecoveredIdempotencyResourceId,
} from "../services/apiIdempotency";

interface PresignAssetPlan {
  assetType: AssetType;
  orderIndex: number;
  sha256HexDigest: string;
  mimeType: string;
  fileSizeBytes: bigint;
}

export const assertUniqueAssetOrderIndexes = (
  plans: Array<{ orderIndex: number }>
): void => {
  const indexes = new Set(plans.map((plan) => plan.orderIndex));
  if (indexes.size !== plans.length) {
    throw new HttpError(400, "INVALID_INPUT", "asset orderIndex values must be unique");
  }
};

export const assertManifestAssetMutationAllowed = (status: ContentManifestStatus): void => {
  if (
    status !== ContentManifestStatus.DRAFT &&
    status !== ContentManifestStatus.UPLOADING
  ) {
    throw new HttpError(
      409,
      "MANIFEST_IMMUTABLE",
      `manifest assets cannot change after status ${status}`
    );
  }
};

export const assertManifestFinalized = (manifest: {
  status: ContentManifestStatus;
  manifestHashHex: string | null;
  internalCanonicalUrl: string | null;
  internalUrlDigestHex: string | null;
}): void => {
  const finalizedStatuses: ContentManifestStatus[] = [
    ContentManifestStatus.READY,
    ContentManifestStatus.LOCKED,
    ContentManifestStatus.ANCHORED,
    ContentManifestStatus.PUBLISHED,
  ];
  if (
    !manifest.manifestHashHex ||
    !manifest.internalCanonicalUrl ||
    !manifest.internalUrlDigestHex ||
    !finalizedStatuses.includes(manifest.status)
  ) {
    throw new HttpError(
      409,
      "MANIFEST_NOT_FINALIZED",
      "manifest must be finalized before publication"
    );
  }
};

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

export const R2_UPLOAD_BUDGET_ADVISORY_LOCK = "streampump:r2-monthly-upload-budget:v1";

export const acquirePresignLocks = async (params: {
  budgetEnabled: boolean;
  lockBudget: () => Promise<unknown>;
  lockManifest: () => Promise<unknown>;
}): Promise<void> => {
  if (params.budgetEnabled) await params.lockBudget();
  await params.lockManifest();
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

  if (fileSizeBytes <= 0n) {
    throw new HttpError(400, "INVALID_INPUT", "fileSizeBytes must be greater than 0");
  }

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

export const assertR2MonthlyUploadBudget = (params: {
  totalBytes: bigint;
  limitBytes: bigint;
}): void => {
  if (params.limitBytes <= 0n) return;
  if (params.totalBytes > params.limitBytes) {
    throw new HttpError(
      429,
      "R2_MONTHLY_UPLOAD_LIMIT_EXCEEDED",
      `R2 monthly upload budget exceeded: current ${params.totalBytes.toString()} bytes, limit ${params.limitBytes.toString()} bytes`
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
    const recoveredManifestId = getRecoveredIdempotencyResourceId(
      req,
      "CONTENT_MANIFEST"
    );
    if (recoveredManifestId) {
      const recovered = await prisma.contentManifest.findFirst({
        where: { id: recoveredManifestId, creatorWallet },
      });
      if (!recovered) {
        throw new HttpError(409, "IDEMPOTENCY_RESOURCE_MISSING", "idempotent manifest is missing");
      }
      ok(res, serializeManifest(recovered), 201);
      return;
    }
    const contentType = normalizeContentType(req.body.contentType);
    const title = parseOptionalString(req.body.title);
    const captionText = parseOptionalString(req.body.captionText);
    const tags = parseStringArray(req.body.tags, "tags");
    const metadataJson = parseOptionalJsonObject(req.body.metadata);

    const manifest = await prisma.$transaction(async (tx) => {
      const created = await tx.contentManifest.create({
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
      await bindApiIdempotencyResource(tx, req, "CONTENT_MANIFEST", created.id);
      return created;
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
    assertUniqueAssetOrderIndexes(assetPlans);
    const monthlyUploadLimitBytes = readMonthlyUploadLimitBytes();

    const presignResult = await prisma.$transaction(async (tx) => {
      // Global advisory lock serializes budget accounting across manifests and is
      // always acquired before the manifest row lock to prevent lock-order inversions.
      await acquirePresignLocks({
        budgetEnabled: monthlyUploadLimitBytes > 0n,
        lockBudget: () => tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${R2_UPLOAD_BUDGET_ADVISORY_LOCK}))`
        ),
        lockManifest: () => tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "ContentManifest" WHERE "id" = ${manifest.id} FOR UPDATE`
        ),
      });
      const lockedManifest = await tx.contentManifest.findFirst({
        where: { id: manifest.id, creatorWallet },
      });
      if (!lockedManifest) {
        throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
      }
      for (const assetPlan of assetPlans) {
        const existing = await tx.contentAsset.findUnique({
          where: {
            manifestId_orderIndex: {
              manifestId: lockedManifest.id,
              orderIndex: assetPlan.orderIndex,
            },
          },
        });
        if (existing?.uploadStatus !== AssetUploadStatus.FAILED) continue;
        try {
          await r2Service.deleteOriginObject(existing.storageKey);
        } catch (_error) {
          const cleanupError = "failed to remove previous private staging object";
          await tx.contentAsset.update({
            where: { id: existing.id },
            data: { storageVerificationError: cleanupError },
          });
          return { assets: [], cleanupError };
        }
      }
      const records: Array<{ asset: ContentAsset; alreadyUploaded: boolean }> = [];
      for (const assetPlan of assetPlans) {
        const { assetType, orderIndex, sha256HexDigest, mimeType, fileSizeBytes } = assetPlan;
        const existing = await tx.contentAsset.findUnique({
          where: {
            manifestId_orderIndex: {
              manifestId: lockedManifest.id,
              orderIndex,
            },
          },
        });
        if (existing?.uploadStatus === AssetUploadStatus.UPLOADED) {
          if (!isAssetStorageVerified(existing)) {
            throw new HttpError(
              409,
              "ASSET_STORAGE_REVERIFICATION_REQUIRED",
              `asset ${existing.id} is uploaded but must be storage-reverified before presign can change it`
            );
          }
          if (
            !verifiedAssetMatchesUploadDeclaration({
              asset: existing,
              declaration: assetPlan,
            })
          ) {
            throw new HttpError(
              409,
              "VERIFIED_ASSET_DECLARATION_CONFLICT",
              `asset order ${orderIndex} is already verified with different metadata`
            );
          }
          records.push({ asset: existing, alreadyUploaded: true });
          continue;
        }
        assertManifestAssetMutationAllowed(lockedManifest.status);
        if (
          existing &&
          existing.uploadStatus !== AssetUploadStatus.PENDING &&
          existing.uploadStatus !== AssetUploadStatus.FAILED
        ) {
          throw new HttpError(
            409,
            "ASSET_NOT_RESIGNABLE",
            `asset ${existing.id} cannot receive a new upload plan in its current state`
          );
        }
        const extension = extensionForMimeType(mimeType);
        const storageKey = `content/${lockedManifest.id}/v/${lockedManifest.version}/${orderIndex}-${sha256HexDigest.slice(
          0,
          12
        )}-${randomUUID()}.${extension}`;

        const asset = existing
          ? await tx.contentAsset.update({
              where: { id: existing.id },
              data: {
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
              verifiedSha256Hex: null,
              verifiedSizeBytes: null,
              objectEtag: null,
              storageVerifiedAt: null,
              storageVerificationError: null,
              },
            })
          : await tx.contentAsset.create({
              data: {
              manifestId: lockedManifest.id,
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
        records.push({ asset, alreadyUploaded: false });
      }

      if (monthlyUploadLimitBytes > 0n) {
        const aggregate = await tx.contentAsset.aggregate({
          _sum: { fileSizeBytes: true },
          where: {
            createdAt: { gte: currentUtcMonthStart() },
            uploadStatus: {
              in: [AssetUploadStatus.PENDING, AssetUploadStatus.UPLOADED],
            },
          },
        });
        assertR2MonthlyUploadBudget({
          totalBytes: aggregate._sum.fileSizeBytes ?? 0n,
          limitBytes: monthlyUploadLimitBytes,
        });
      }

      if (records.some((record) => !record.alreadyUploaded)) {
        await tx.contentManifest.update({
          where: { id: lockedManifest.id },
          data: { status: ContentManifestStatus.UPLOADING },
        });
      }
      return { assets: records, cleanupError: null };
    });

    if (presignResult.cleanupError) {
      throw new HttpError(503, "STAGING_CLEANUP_FAILED", presignResult.cleanupError);
    }
    const assets = presignResult.assets;

    const uploads = [];
    const completedAssets = assets
      .filter((record) => record.alreadyUploaded)
      .map((record) => serializeAsset(record.asset));
    for (const record of assets) {
      if (record.alreadyUploaded) {
        continue;
      }
      const asset = record.asset;
      const assetType = asset.assetType;
      const orderIndex = asset.orderIndex;
      const mimeType = asset.mimeType;
      const fileSizeBytes = asset.fileSizeBytes;
      const storageKey = asset.storageKey;

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

    ok(res, {
      manifestId: manifest.id,
      uploads,
      completedAssets,
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

    if (
      asset.uploadStatus === AssetUploadStatus.UPLOADED &&
      isAssetStorageVerified(asset)
    ) {
      ok(res, {
        manifestId,
        asset: serializeAsset(asset),
      });
      return;
    }

    const storageReverificationOnly =
      asset.uploadStatus === AssetUploadStatus.UPLOADED && !isAssetStorageVerified(asset);
    if (!storageReverificationOnly) {
      assertManifestAssetMutationAllowed(asset.manifest.status);
    }

    if (shouldCompleteMultipartUpload({
      isVideo: isVideoMimeType(asset.mimeType),
      uploadStatus: asset.uploadStatus,
    })) {
      const multipartUploadId = parseNonEmptyString(
        req.body?.multipartUploadId,
        "multipartUploadId"
      );
      const parts = parseCompletedMultipartParts(req.body?.parts);

      await r2Service.completeMultipartUpload(asset.storageKey, multipartUploadId, parts);
    }

    let storageVerification;
    let verifiedStorageKey: string;
    let verifiedObjectEtag: string | null;
    try {
      storageVerification = await verifyStoredContentAsset({
        storageKey: asset.storageKey,
        expectedSha256Hex: asset.sha256Hex,
        expectedSizeBytes: asset.fileSizeBytes,
        expectedMimeType: asset.mimeType,
      });
      verifiedStorageKey = buildVerifiedStorageKey(
        asset.storageKey,
        storageVerification.sha256Hex
      );
      const promoted = await r2Service.promoteVerifiedObject(
        asset.storageKey,
        verifiedStorageKey,
        storageVerification.etag
      );
      assertPromotedObjectMatches(promoted, storageVerification);
      verifiedObjectEtag = promoted.etag;
    } catch (error) {
      const inspectionError =
        error instanceof StorageObjectVerificationError
          ? error.message
          : "stored object inspection failed";
      let verificationError = inspectionError;
      try {
        await r2Service.deleteOriginObject(asset.storageKey);
      } catch (_cleanupError) {
        verificationError = `${inspectionError}; failed to remove private staging object`;
      }
      await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          uploadStatus: AssetUploadStatus.FAILED,
          processingStatus: AssetProcessingStatus.ERRORED,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          processingError: verificationError,
          verifiedSha256Hex: null,
          verifiedSizeBytes: null,
          objectEtag: null,
          storageVerifiedAt: null,
          storageVerificationError: verificationError,
        },
      });
      throw new HttpError(
        409,
        "STORAGE_OBJECT_VERIFICATION_FAILED",
        "uploaded object could not be verified"
      );
    }

    let updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: AssetUploadStatus.UPLOADED,
        storageKey: verifiedStorageKey,
        cdnUrl: r2Service.buildCanonicalUrl(verifiedStorageKey),
        verifiedSha256Hex: storageVerification.sha256Hex,
        verifiedSizeBytes: storageVerification.sizeBytes,
        objectEtag: verifiedObjectEtag,
        storageVerifiedAt: new Date(),
        storageVerificationError: null,
      },
    });

    if (isVideoMimeType(asset.mimeType) && !storageReverificationOnly) {
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
    } else if (isVideoMimeType(asset.mimeType)) {
      await syncManifestPublicationEligibility(manifestId);
    } else {
      await backfillDisplayVariantFromStorage(verifiedStorageKey).catch(() => null);
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
  const response = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ContentManifest" WHERE "id" = ${manifestId} FOR UPDATE`
    );
    const manifest = await tx.contentManifest.findFirst({
      where: { id: manifestId, creatorWallet },
      include: {
        assets: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!manifest) {
      throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
    }

    if (
      manifest.status === ContentManifestStatus.READY ||
      manifest.status === ContentManifestStatus.LOCKED ||
      manifest.status === ContentManifestStatus.ANCHORED ||
      manifest.status === ContentManifestStatus.PUBLISHED
    ) {
      const unverifiedAsset = manifest.assets.find((asset) => !isAssetStorageVerified(asset));
      if (unverifiedAsset) {
        throw new HttpError(
          409,
          "ASSET_STORAGE_UNVERIFIED",
          `asset ${unverifiedAsset.id} must pass backend storage verification before finalize`
        );
      }
      if (
        !manifest.manifestHashHex ||
        !manifest.internalCanonicalUrl ||
        !manifest.internalUrlDigestHex
      ) {
        throw new HttpError(
          409,
          "MANIFEST_INTEGRITY_MISMATCH",
          "finalized manifest is missing immutable proof fields"
        );
      }

      const finalized = computeManifestFinalizeState({ manifest, assets: manifest.assets });
      if (
        finalized.manifestHashHex !== manifest.manifestHashHex ||
        finalized.internalCanonicalUrl !== manifest.internalCanonicalUrl ||
        finalized.internalUrlDigestHex !== manifest.internalUrlDigestHex
      ) {
        throw new HttpError(
          409,
          "MANIFEST_INTEGRITY_MISMATCH",
          "stored manifest proof no longer matches its immutable content"
        );
      }

      return {
        ...serializeManifest(manifest),
        internalCanonicalUrl: manifest.internalCanonicalUrl,
        internalUrlDigestHex: manifest.internalUrlDigestHex,
        plannedContentAnchorPda: finalized.plannedContentAnchorPda,
      };
    }

    assertManifestAssetMutationAllowed(manifest.status);
    if (manifest.assets.length === 0) {
      throw new HttpError(409, "MANIFEST_EMPTY", "manifest must contain at least one asset");
    }

    const incomplete = manifest.assets.find(
      (asset) => asset.uploadStatus !== AssetUploadStatus.UPLOADED
    );
    if (incomplete) {
      throw new HttpError(
        409,
        "ASSET_UPLOAD_INCOMPLETE",
        `asset ${incomplete.id} must reach UPLOADED before finalize`
      );
    }

    const unverified = manifest.assets.find((asset) => !isAssetStorageVerified(asset));
    if (unverified) {
      throw new HttpError(
        409,
        "ASSET_STORAGE_UNVERIFIED",
        `asset ${unverified.id} must pass backend storage verification before finalize`
      );
    }

    const finalized = computeManifestFinalizeState({ manifest, assets: manifest.assets });
    const updated = await tx.contentManifest.update({
      where: { id: manifest.id },
      data: {
        status: manifest.currentAnchorPda
          ? ContentManifestStatus.ANCHORED
          : ContentManifestStatus.READY,
        captionTextHash: finalized.captionTextHash,
        canonicalManifestJson: finalized.canonicalManifestJson as Prisma.InputJsonValue,
        manifestHashHex: finalized.manifestHashHex,
        internalCanonicalUrl: finalized.internalCanonicalUrl,
        internalUrlDigestHex: finalized.internalUrlDigestHex,
      },
    });

    return {
      ...serializeManifest(updated),
      internalCanonicalUrl: updated.internalCanonicalUrl,
      internalUrlDigestHex: updated.internalUrlDigestHex,
      plannedContentAnchorPda: finalized.plannedContentAnchorPda,
    };
  });

  ok(res, response);
});

export const createContentPublication = withController(
  "CREATE_CONTENT_PUBLICATION_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const creatorWallet = requireSessionWallet(req);
    const recoveredPublicationId = getRecoveredIdempotencyResourceId(
      req,
      "CONTENT_PUBLICATION"
    );
    if (recoveredPublicationId) {
      const recovered = await prisma.contentPublication.findFirst({
        where: {
          id: recoveredPublicationId,
          manifest: { creatorWallet },
        },
      });
      if (!recovered) {
        throw new HttpError(409, "IDEMPOTENCY_RESOURCE_MISSING", "idempotent publication is missing");
      }
      ok(
        res,
        {
          publicationId: recovered.id,
          manifestId: recovered.manifestId,
          platform: recovered.platform,
          externalUrl: recovered.externalUrl,
          verificationStatus: recovered.verificationStatus,
          createdAt: recovered.createdAt.toISOString(),
        },
        201
      );
      return;
    }
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
    assertManifestFinalized(manifest);

    const target = normalizePublicationTarget({
      platform: parseNonEmptyString(req.body.platform, "platform"),
      externalUrl: parseNonEmptyString(req.body.externalUrl, "externalUrl"),
      internalCanonicalUrl: manifest.internalCanonicalUrl as string,
      allowInsecureInternalUrl: process.env.NODE_ENV !== "production",
    });
    const externalPostId = parseOptionalString(req.body.externalPostId);

    const publication = await prisma.$transaction(async (tx) => {
      const created = await tx.contentPublication.create({
        data: {
          manifestId,
          platform: target.platform,
          externalUrl: target.externalUrl,
          externalUrlDigestHex: keccakHex(target.externalUrl),
          externalPostIdHash: externalPostId ? sha256Hex(externalPostId) : null,
          verificationStatus: PublicationVerificationStatus.PENDING,
        },
      });
      await bindApiIdempotencyResource(tx, req, "CONTENT_PUBLICATION", created.id);
      return created;
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
    assertCreatorPublicationVerificationAllowed(config.pilot.inviteOnly);
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

    assertManifestFinalized(publication.manifest);

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

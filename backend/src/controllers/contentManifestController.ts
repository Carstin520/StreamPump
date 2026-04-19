/**
 * CN: 内容清单控制器，负责 manifest 创建、素材预签名上传、完成回调和 publication 映射。
 * EN: Content manifest controller that handles manifest creation, asset presign/upload completion, and publication mapping.
 */
import {
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
  parseOptionalJsonObject,
  parseOptionalString,
  parseSha256Hex,
  parseStringArray,
  requireSessionWallet,
  withController,
} from "./http";
import {
  assertAssetAndMimeTypeMatch,
  nextManifestStatusAfterPublication,
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
import { muxService } from "../services/MuxService";
import { prisma } from "../services/prisma";
import {
  assertAllowedMimeType,
  extensionForMimeType,
  isVideoMimeType,
  s3Service,
} from "../services/S3Service";

const MAX_ASSET_SIZE_BYTES = 100 * 1024 * 1024;

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

    const uploads = [];

    for (const rawAsset of inputs) {
      const assetType = normalizeAssetType((rawAsset as Record<string, unknown>).assetType);
      const orderIndex = parseNonNegativeInt(
        (rawAsset as Record<string, unknown>).orderIndex,
        "orderIndex"
      );
      const sha256HexDigest = parseSha256Hex(
        (rawAsset as Record<string, unknown>).sha256Hex,
        "sha256Hex"
      );
      const mimeType = parseNonEmptyString(
        (rawAsset as Record<string, unknown>).mimeType,
        "mimeType"
      ).toLowerCase();
      const fileSizeBytes = parseNonNegativeBigInt(
        (rawAsset as Record<string, unknown>).fileSizeBytes,
        "fileSizeBytes"
      );

      if (fileSizeBytes > BigInt(MAX_ASSET_SIZE_BYTES)) {
        throw new HttpError(
          400,
          "INVALID_INPUT",
          `fileSizeBytes exceeds current limit (${MAX_ASSET_SIZE_BYTES} bytes)`
        );
      }

      assertAllowedMimeType(mimeType);
      assertAssetAndMimeTypeMatch(assetType, mimeType);

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
          uploadStatus: AssetUploadStatus.PENDING,
          processingStatus: AssetProcessingStatus.NONE,
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
          uploadStatus: AssetUploadStatus.PENDING,
          processingStatus: AssetProcessingStatus.NONE,
        },
      });

      const upload = await s3Service.generateUploadUrl(storageKey, mimeType);

      uploads.push({
        assetId: asset.id,
        assetType,
        orderIndex,
        storageKey,
        presignedUrl: upload.presignedUrl,
        expiresInSeconds: upload.expiresInSeconds,
      });
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

    let updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: AssetUploadStatus.UPLOADED,
        cdnUrl: s3Service.buildCanonicalUrl(asset.storageKey),
      },
    });

    if (isVideoMimeType(asset.mimeType)) {
      try {
        const downloadUrl = await s3Service.generateDownloadUrl(asset.storageKey, 3600);
        const muxAssetId = await muxService.createAsset(downloadUrl);

        updated = await prisma.contentAsset.update({
          where: { id: asset.id },
          data: {
            processingStatus: AssetProcessingStatus.PREPARING,
            processingSource: AssetProcessingSource.CLIENT_COMPLETE,
            muxAssetId,
            muxLastKnownStatus: "created",
            muxLastCheckedAt: null,
            muxReadyAt: null,
            muxReconcileAttempts: 0,
            processingError: null,
          },
        });
      } catch (error) {
        updated = await prisma.contentAsset.update({
          where: { id: asset.id },
          data: {
            processingStatus: AssetProcessingStatus.ERRORED,
            processingSource: AssetProcessingSource.CLIENT_COMPLETE,
            muxLastKnownStatus: "errored",
            processingError: error instanceof Error ? error.message : "failed to create mux asset",
          },
        });
      }
    } else {
      updated = await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.READY,
          processingSource: AssetProcessingSource.CLIENT_COMPLETE,
          processingError: null,
        },
      });
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
    await requireOwnedManifest(manifestId, creatorWallet);

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

    const manifestStatus = await prisma.contentManifest.findUnique({
      where: { id: manifestId },
      select: { status: true },
    });

    const nextStatus = manifestStatus?.status
      ? nextManifestStatusAfterPublication(manifestStatus.status)
      : null;

    if (nextStatus && manifestStatus?.status !== nextStatus) {
      await prisma.contentManifest.update({
        where: { id: manifestId },
        data: {
          status: nextStatus,
        },
      });
    }

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

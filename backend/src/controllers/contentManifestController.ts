/**
 * CN: 内容清单控制器，负责 manifest 创建、素材预签名上传、完成回调和 publication 映射。
 * EN: Content manifest controller that handles manifest creation, asset presign/upload completion, and publication mapping.
 */
import {
  AssetProcessingStatus,
  AssetProcessingSource,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  PublicationVerificationStatus,
  Prisma,
} from "@prisma/client";
import { Request, Response } from "express";

import {
  HttpError,
  ensureIdempotencyKey,
  handleControllerError,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parseOptionalJsonObject,
  parseOptionalString,
  parseSha256Hex,
  parseStringArray,
  parseWalletFromRequest,
} from "./http";
import {
  buildInternalCanonicalUrl,
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

const normalizeAssetType = (value: unknown): AssetType => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "IMAGE") {
    return AssetType.IMAGE;
  }

  if (normalized === "VIDEO") {
    return AssetType.VIDEO;
  }

  if (normalized === "COVER") {
    return AssetType.COVER;
  }

  throw new HttpError(400, "INVALID_INPUT", "assetType must be one of: IMAGE, VIDEO, COVER");
};

const assertAssetAndMimeTypeMatch = (assetType: AssetType, mimeType: string): void => {
  const video = isVideoMimeType(mimeType);

  if (assetType === AssetType.VIDEO && !video) {
    throw new HttpError(400, "INVALID_INPUT", "VIDEO assets must use a video mimeType");
  }

  if ((assetType === AssetType.IMAGE || assetType === AssetType.COVER) && video) {
    throw new HttpError(400, "INVALID_INPUT", `${assetType} assets must use an image mimeType`);
  }
};

const serializeManifest = (manifest: {
  id: string;
  creatorWallet: string;
  contentType: string;
  status: string;
  version: number;
  manifestHashHex: string | null;
  currentAnchorPda: string | null;
  currentAnchorTx: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  manifestId: manifest.id,
  creatorWallet: manifest.creatorWallet,
  contentType: manifest.contentType,
  status: manifest.status,
  version: manifest.version,
  manifestHashHex: manifest.manifestHashHex,
  currentAnchorPda: manifest.currentAnchorPda,
  currentAnchorTx: manifest.currentAnchorTx,
  createdAt: manifest.createdAt.toISOString(),
  updatedAt: manifest.updatedAt.toISOString(),
});

const serializeAsset = (asset: {
  id: string;
  assetType: string;
  orderIndex: number;
  storageKey: string;
  uploadStatus: string;
  processingStatus: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxLastKnownStatus: string | null;
  updatedAt: Date;
}) => ({
  assetId: asset.id,
  assetType: asset.assetType,
  orderIndex: asset.orderIndex,
  storageKey: asset.storageKey,
  uploadStatus: asset.uploadStatus,
  processingStatus: asset.processingStatus,
  muxAssetId: asset.muxAssetId,
  muxPlaybackId: asset.muxPlaybackId,
  muxLastKnownStatus: asset.muxLastKnownStatus,
  updatedAt: asset.updatedAt.toISOString(),
});

const requireOwnedManifest = async (manifestId: string, creatorWallet: string) => {
  // Ownership is enforced at the DB layer so a creator cannot mutate another creator's content state.
  const manifest = await prisma.contentManifest.findFirst({
    where: {
      id: manifestId,
      creatorWallet,
    },
  });

  if (!manifest) {
    throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
  }

  return manifest;
};

export const createContentManifest = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const creatorWallet = parseWalletFromRequest(req, "x-wallet-address", "creatorWallet");
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
      handleControllerError(
        res,
        new HttpError(400, "INVALID_INPUT", error.message),
        "CREATE_CONTENT_MANIFEST_FAILED"
      );
      return;
    }

    handleControllerError(res, error, "CREATE_CONTENT_MANIFEST_FAILED");
  }
};

export const presignManifestAssets = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const creatorWallet = parseWalletFromRequest(req, "x-wallet-address", "creatorWallet");
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
      // Storage keys remain deterministic inside one manifest version so asset hashing and audit traces stay stable.
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
  } catch (error) {
    handleControllerError(res, error, "PRESIGN_MANIFEST_ASSETS_FAILED");
  }
};

export const completeManifestAssetUpload = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const creatorWallet = parseWalletFromRequest(req, "x-wallet-address", "creatorWallet");
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

    // Current MVP trusts the upload completion signal from the client; object existence verification can be added later.
    let updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        uploadStatus: AssetUploadStatus.UPLOADED,
        cdnUrl: s3Service.buildCanonicalUrl(asset.storageKey),
      },
    });

    if (isVideoMimeType(asset.mimeType)) {
      try {
        // Video assets move into PREPARING while Mux asynchronously transcodes them and later calls back via webhook.
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
  } catch (error) {
    handleControllerError(res, error, "COMPLETE_MANIFEST_ASSET_FAILED");
  }
};

export const finalizeContentManifest = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const creatorWallet = parseWalletFromRequest(req, "x-wallet-address", "creatorWallet");
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

    // Finalization freezes the current asset ordering and generates the canonical digest used by chain-facing flows.
    const finalized = computeManifestFinalizeState({
      manifest,
      assets: manifest.assets,
    });

    const updated = await prisma.contentManifest.update({
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

    ok(res, {
      ...serializeManifest(updated),
      internalCanonicalUrl: updated.internalCanonicalUrl,
      internalUrlDigestHex: updated.internalUrlDigestHex,
      plannedContentAnchorPda: finalized.plannedContentAnchorPda,
    });
  } catch (error) {
    handleControllerError(res, error, "FINALIZE_MANIFEST_FAILED");
  }
};

export const createContentPublication = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const creatorWallet = parseWalletFromRequest(req, "x-wallet-address", "creatorWallet");
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

    if (manifestStatus?.status === ContentManifestStatus.READY) {
      await prisma.contentManifest.update({
        where: { id: manifestId },
        data: {
          status: ContentManifestStatus.PUBLISHED,
        },
      });
    }

    ok(res, {
      publicationId: publication.id,
      manifestId: publication.manifestId,
      platform: publication.platform,
      externalUrl: publication.externalUrl,
      verificationStatus: publication.verificationStatus,
      createdAt: publication.createdAt.toISOString(),
    }, 201);
  } catch (error) {
    handleControllerError(res, error, "CREATE_CONTENT_PUBLICATION_FAILED");
  }
};

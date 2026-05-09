import {
  AssetType,
  ContentManifestStatus,
  Prisma,
} from "@prisma/client";

import { HttpError } from "./http";
import { prisma } from "../services/prisma";
import { isVideoMimeType } from "../services/R2Service";
import { buildMuxPlaybackUrl } from "../services/MuxService";

export const normalizeAssetType = (value: unknown): AssetType => {
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

export const assertAssetAndMimeTypeMatch = (assetType: AssetType, mimeType: string): void => {
  const video = isVideoMimeType(mimeType);

  if (assetType === AssetType.VIDEO && !video) {
    throw new HttpError(400, "INVALID_INPUT", "VIDEO assets must use a video mimeType");
  }

  if ((assetType === AssetType.IMAGE || assetType === AssetType.COVER) && video) {
    throw new HttpError(400, "INVALID_INPUT", `${assetType} assets must use an image mimeType`);
  }
};

export const serializeManifest = (manifest: {
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

export const serializeAsset = (asset: {
  id: string;
  assetType: string;
  orderIndex: number;
  storageKey: string;
  cdnUrl?: string | null;
  uploadStatus: string;
  processingStatus: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxLastKnownStatus: string | null;
  processingError?: string | null;
  updatedAt: Date;
}) => {
  const muxPlaybackUrl = asset.muxPlaybackId
    ? buildMuxPlaybackUrl(asset.muxPlaybackId)
    : null;
  const preferredPlaybackSource =
    asset.assetType === AssetType.VIDEO
      ? muxPlaybackUrl
        ? "MUX"
        : asset.cdnUrl
          ? "ORIGIN"
          : null
      : asset.cdnUrl
        ? "ORIGIN"
        : null;
  const preferredPlaybackUrl =
    preferredPlaybackSource === "MUX" ? muxPlaybackUrl : asset.cdnUrl ?? null;
  const ingestStatus =
    asset.assetType !== AssetType.VIDEO
      ? "NOT_APPLICABLE"
      : asset.uploadStatus !== "UPLOADED"
        ? "PENDING_UPLOAD"
        : asset.processingStatus === "ERRORED"
          ? "ERRORED"
          : asset.muxPlaybackId
            ? "READY"
            : asset.muxAssetId
              ? "PREPARING"
              : "QUEUED";
  const deliveryStatus =
    asset.uploadStatus !== "UPLOADED"
      ? "PENDING_UPLOAD"
      : asset.processingStatus === "ERRORED"
        ? "ERRORED"
        : asset.assetType === AssetType.VIDEO && !asset.muxPlaybackId
          ? "PROCESSING"
          : "READY";

  return {
    assetId: asset.id,
    assetType: asset.assetType,
    orderIndex: asset.orderIndex,
    storageKey: asset.storageKey,
    originUrl: asset.cdnUrl ?? null,
    uploadStrategy: asset.assetType === AssetType.VIDEO ? "MULTIPART" : "SINGLE_PART",
    uploadStatus: asset.uploadStatus,
    processingStatus: asset.processingStatus,
    ingestStatus,
    deliveryStatus,
    preferredPlaybackSource,
    preferredPlaybackUrl,
    muxAssetId: asset.muxAssetId,
    muxPlaybackId: asset.muxPlaybackId,
    muxPlaybackUrl,
    muxLastKnownStatus: asset.muxLastKnownStatus,
    processingError: asset.processingError ?? null,
    updatedAt: asset.updatedAt.toISOString(),
  };
};

export const serializePublication = (publication: {
  id: string;
  platform: string;
  externalUrl: string;
  verificationStatus: string;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  publicationId: publication.id,
  platform: publication.platform,
  externalUrl: publication.externalUrl,
  verificationStatus: publication.verificationStatus,
  verifiedAt: publication.verifiedAt?.toISOString() ?? null,
  createdAt: publication.createdAt.toISOString(),
  updatedAt: publication.updatedAt.toISOString(),
});

export const serializeManifestDetail = (manifest: {
  id: string;
  creatorWallet: string;
  contentType: string;
  status: string;
  version: number;
  title: string | null;
  captionText: string | null;
  tagsJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
  manifestHashHex: string | null;
  currentAnchorPda: string | null;
  currentAnchorTx: string | null;
  internalCanonicalUrl: string | null;
  internalUrlDigestHex: string | null;
  coverAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assets: Array<{
    id: string;
    assetType: string;
    orderIndex: number;
    storageKey: string;
    cdnUrl?: string | null;
    uploadStatus: string;
    processingStatus: string;
    muxAssetId: string | null;
    muxPlaybackId: string | null;
    muxLastKnownStatus: string | null;
    processingError?: string | null;
    updatedAt: Date;
  }>;
  publications: Array<{
    id: string;
    platform: string;
    externalUrl: string;
    verificationStatus: string;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) => ({
  ...serializeManifest(manifest),
  title: manifest.title,
  captionText: manifest.captionText,
  tags: Array.isArray(manifest.tagsJson) ? manifest.tagsJson : [],
  metadata: manifest.metadataJson ?? null,
  internalCanonicalUrl: manifest.internalCanonicalUrl,
  internalUrlDigestHex: manifest.internalUrlDigestHex,
  coverAssetId: manifest.coverAssetId,
  assets: manifest.assets.map(serializeAsset),
  publications: manifest.publications.map(serializePublication),
});

export const serializeManifestListItem = (manifest: {
  id: string;
  creatorWallet: string;
  contentType: string;
  status: string;
  version: number;
  manifestHashHex: string | null;
  currentAnchorPda: string | null;
  currentAnchorTx: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  assets: Array<{
    id: string;
    assetType: string;
    orderIndex: number;
    storageKey: string;
    cdnUrl?: string | null;
    uploadStatus: string;
    processingStatus: string;
    muxAssetId: string | null;
    muxPlaybackId: string | null;
    muxLastKnownStatus: string | null;
    processingError?: string | null;
    updatedAt: Date;
  }>;
}) => ({
  ...serializeManifest(manifest),
  title: manifest.title,
  assetCount: manifest.assets.length,
  assets: manifest.assets.map(serializeAsset),
});

export const requireOwnedManifest = async (manifestId: string, creatorWallet: string) => {
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

export const nextManifestStatusAfterPublication = (
  currentStatus: ContentManifestStatus
): ContentManifestStatus =>
  currentStatus === ContentManifestStatus.READY ? ContentManifestStatus.PUBLISHED : currentStatus;

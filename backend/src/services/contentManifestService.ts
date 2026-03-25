import { createHash } from "crypto";

import { ContentAsset, ContentManifest, ContentType } from "@prisma/client";
import { keccak_256 } from "@noble/hashes/sha3";
import { PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { getAnchorService } from "./AnchorService";

const sortTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => String(tag ?? "").trim())
    .filter((tag) => tag.length > 0)
    .sort((left, right) => left.localeCompare(right));
};

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const keccakHex = (value: string): string =>
  Buffer.from(keccak_256(new TextEncoder().encode(value))).toString("hex");

export const buildInternalCanonicalUrl = (manifestId: string, version: number): string => {
  const base = config.app.apiBaseUrl.replace(/\/$/, "");
  return `${base}/content/manifests/${manifestId}/v/${version}`;
};

export const buildCanonicalManifestJson = (params: {
  manifest: Pick<ContentManifest, "id" | "contentType" | "version" | "title" | "captionText" | "tagsJson">;
  assets: Array<
    Pick<
      ContentAsset,
      "assetType" | "orderIndex" | "sha256Hex" | "mimeType" | "fileSizeBytes" | "durationMs"
    >
  >;
}): Record<string, unknown> => {
  const orderedAssets = [...params.assets]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((asset) => ({
      type: asset.assetType,
      index: asset.orderIndex,
      sha256: asset.sha256Hex,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes.toString(),
      durationMs: asset.durationMs ?? null,
    }));

  return {
    version: params.manifest.version,
    contentType: params.manifest.contentType,
    title: params.manifest.title ?? null,
    captionTextHash: sha256Hex(params.manifest.captionText ?? ""),
    tags: sortTags(params.manifest.tagsJson),
    coverAssetIndex:
      orderedAssets.find((asset) => asset.type === "COVER")?.index ??
      orderedAssets[0]?.index ??
      0,
    assets: orderedAssets,
    sourcePlatform: "INTERNAL_DRAFT",
  };
};

export const computeManifestFinalizeState = (params: {
  manifest: Pick<
    ContentManifest,
    "id" | "creatorWallet" | "contentType" | "version" | "title" | "captionText" | "tagsJson"
  >;
  assets: Array<
    Pick<
      ContentAsset,
      "assetType" | "orderIndex" | "sha256Hex" | "mimeType" | "fileSizeBytes" | "durationMs"
    >
  >;
}): {
  captionTextHash: string;
  canonicalManifestJson: Record<string, unknown>;
  manifestHashHex: string;
  internalCanonicalUrl: string;
  internalUrlDigestHex: string;
  plannedContentAnchorPda: string;
} => {
  const canonicalManifestJson = buildCanonicalManifestJson(params);
  const canonicalManifestString = JSON.stringify(canonicalManifestJson);
  const internalCanonicalUrl = buildInternalCanonicalUrl(params.manifest.id, params.manifest.version);
  const internalUrlDigestHex = keccakHex(internalCanonicalUrl);
  const creator = new PublicKey(params.manifest.creatorWallet);
  const anchorService = getAnchorService();
  const creatorProfilePda = anchorService.deriveCreatorProfilePda(creator);
  const plannedContentAnchorPda = anchorService
    .deriveContentAnchorPda(
      creatorProfilePda,
      Uint8Array.from(Buffer.from(internalUrlDigestHex, "hex"))
    )
    .toBase58();

  return {
    captionTextHash: sha256Hex(params.manifest.captionText ?? ""),
    canonicalManifestJson,
    manifestHashHex: sha256Hex(canonicalManifestString),
    internalCanonicalUrl,
    internalUrlDigestHex,
    plannedContentAnchorPda,
  };
};

export const normalizeContentType = (value: unknown): ContentType => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "SHORT_VIDEO") {
    return ContentType.SHORT_VIDEO;
  }

  if (normalized === "IMAGE_CAROUSEL") {
    return ContentType.IMAGE_CAROUSEL;
  }

  if (normalized === "MIXED_MEDIA_NOTE") {
    return ContentType.MIXED_MEDIA_NOTE;
  }

  throw new Error("contentType must be one of: SHORT_VIDEO, IMAGE_CAROUSEL, MIXED_MEDIA_NOTE");
};

import {
  ContentManifestStatus,
  Prisma,
} from "@prisma/client";

import { ok, parsePositiveInt, withController } from "./http";
import { prisma } from "../services/prisma";
import { serializeAsset } from "./contentManifestShared";
import { s3Service } from "../services/S3Service";

type JsonObject = Record<string, Prisma.JsonValue>;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

const isJsonObject = (value: Prisma.JsonValue | null | undefined): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isBrowserRenderableUrl = (value: string | null | undefined): boolean =>
  typeof value === "string" &&
  (value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("/") ||
    value.startsWith("data:"));

const readString = (value: Prisma.JsonValue | undefined): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: Prisma.JsonValue | null | undefined): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

const readLocalImportMetadata = (metadataJson: Prisma.JsonValue | null | undefined) => {
  if (!isJsonObject(metadataJson)) {
    return null;
  }

  const importSource = isJsonObject(metadataJson.importSource)
    ? metadataJson.importSource
    : null;

  if (!importSource || readString(importSource.kind) !== "local-post-assets") {
    return null;
  }

  return {
    creatorName: readString(metadataJson.creatorName),
    creatorStage: readString(metadataJson.creatorStage),
    excerpt: readString(metadataJson.excerpt),
    location: readString(metadataJson.location),
    mood: readString(metadataJson.mood),
    postDirectoryName: readString(importSource.postDirectoryName),
    publishTimeLabel: readString(metadataJson.publishTimeLabel),
    slug: readString(importSource.slug),
    theme: readString(metadataJson.theme),
    visualDirection: readString(metadataJson.visualDirection),
  };
};

const serializePublicFeedPost = (manifest: {
  id: string;
  creatorWallet: string;
  contentType: string;
  status: string;
  title: string | null;
  captionText: string | null;
  tagsJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
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
}) => {
  const metadata = readLocalImportMetadata(manifest.metadataJson);

  return {
    postId: manifest.id,
    manifestId: manifest.id,
    slug: metadata?.slug ?? manifest.id,
    creatorWallet: manifest.creatorWallet,
    creatorName: metadata?.creatorName,
    creatorStage: metadata?.creatorStage,
    title: manifest.title,
    excerpt: metadata?.excerpt ?? null,
    body: manifest.captionText,
    location: metadata?.location,
    publishTimeLabel: metadata?.publishTimeLabel,
    theme: metadata?.theme,
    mood: metadata?.mood,
    visualDirection: metadata?.visualDirection,
    postDirectoryName: metadata?.postDirectoryName,
    contentType: manifest.contentType,
    status: manifest.status,
    coverAssetId: manifest.coverAssetId,
    tags: readStringArray(manifest.tagsJson),
    assets: manifest.assets.map(serializeAsset),
    createdAt: manifest.createdAt.toISOString(),
    updatedAt: manifest.updatedAt.toISOString(),
  };
};

const serializePublicAsset = async (asset: Parameters<typeof serializeAsset>[0]) => {
  const serialized = serializeAsset(asset);

  if (isBrowserRenderableUrl(serialized.originUrl) || !asset.storageKey.trim()) {
    return serialized;
  }

  const downloadUrl = await s3Service.generateDownloadUrl(asset.storageKey, 60 * 60);
  const preferredPlaybackUrl =
    serialized.preferredPlaybackSource === "ORIGIN" || !serialized.preferredPlaybackUrl
      ? downloadUrl
      : serialized.preferredPlaybackUrl;

  return {
    ...serialized,
    originUrl: downloadUrl,
    preferredPlaybackUrl,
  };
};

const serializePublicFeedPostAsync = async (manifest: {
  id: string;
  creatorWallet: string;
  contentType: string;
  status: string;
  title: string | null;
  captionText: string | null;
  tagsJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
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
}) => {
  const serialized = serializePublicFeedPost(manifest);
  const assets = await Promise.all(manifest.assets.map(serializePublicAsset));

  return {
    ...serialized,
    assets,
  };
};

export const listPublicFeedPosts = withController(
  "LIST_PUBLIC_FEED_FAILED",
  async (req, res) => {
    const requestedLimit =
      req.query.limit === undefined
        ? DEFAULT_LIMIT
        : parsePositiveInt(req.query.limit, "limit");
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    const manifests = await prisma.contentManifest.findMany({
      where: {
        status: {
          in: [
            ContentManifestStatus.READY,
            ContentManifestStatus.ANCHORED,
            ContentManifestStatus.PUBLISHED,
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        assets: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
      take: Math.min(limit * 4, 200),
    });

    const posts = await Promise.all(
      manifests
        .filter((manifest) => readLocalImportMetadata(manifest.metadataJson))
        .slice(0, limit)
        .map(serializePublicFeedPostAsync)
    );

    ok(res, {
      posts,
    });
  }
);

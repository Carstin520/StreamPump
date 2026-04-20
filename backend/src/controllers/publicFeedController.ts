import {
  ContentManifestStatus,
  Prisma,
} from "@prisma/client";

import { ok, parsePositiveInt, withController } from "./http";
import { prisma } from "../services/prisma";
import { serializeAsset } from "./contentManifestShared";

type JsonObject = Record<string, Prisma.JsonValue>;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

const isJsonObject = (value: Prisma.JsonValue | null | undefined): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

    const posts = manifests
      .filter((manifest) => readLocalImportMetadata(manifest.metadataJson))
      .slice(0, limit)
      .map(serializePublicFeedPost);

    ok(res, {
      posts,
    });
  }
);

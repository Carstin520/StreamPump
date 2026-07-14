import {
  ContentManifestStatus,
  Prisma,
} from "@prisma/client";

import {
  HttpError,
  ok,
  parsePositiveInt,
  withController,
} from "./http";
import { prisma } from "../services/prisma";
import { serializeAsset } from "./contentManifestShared";
import { buildDisplayVariantKey } from "../services/imageVariants";
import { config } from "../../config/default";
import { r2Service } from "../services/R2Service";

type JsonObject = Record<string, Prisma.JsonValue>;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const PUBLIC_CACHE_CONTROL = "public, max-age=60";
const PUBLIC_FEED_STATUSES = [
  ContentManifestStatus.READY,
  ContentManifestStatus.ANCHORED,
  ContentManifestStatus.PUBLISHED,
] as const;

const publicAssetSelect = Prisma.validator<Prisma.ContentAssetSelect>()({
  assetType: true,
  cdnUrl: true,
  id: true,
  muxAssetId: true,
  muxLastKnownStatus: true,
  muxPlaybackId: true,
  orderIndex: true,
  processingError: true,
  processingStatus: true,
  storageKey: true,
  updatedAt: true,
  uploadStatus: true,
});

const publicManifestSelect = Prisma.validator<Prisma.ContentManifestSelect>()({
  captionText: true,
  contentType: true,
  coverAssetId: true,
  createdAt: true,
  creatorDisplayName: true,
  creatorWallet: true,
  id: true,
  metadataJson: true,
  publicExcerpt: true,
  publicSlug: true,
  publishedAt: true,
  status: true,
  tagsJson: true,
  title: true,
  updatedAt: true,
});

type PublicAssetRecord = Prisma.ContentAssetGetPayload<{
  select: typeof publicAssetSelect;
}>;

type PublicManifestRecord = Prisma.ContentManifestGetPayload<{
  select: typeof publicManifestSelect;
}> & {
  assets: PublicAssetRecord[];
};

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

const resolveCanonicalUrl = (objectKey: string | null | undefined) => {
  const trimmedKey = objectKey?.trim();
  if (!trimmedKey) {
    return null;
  }

  const canonicalUrl = r2Service.buildCanonicalUrl(trimmedKey);
  return isBrowserRenderableUrl(canonicalUrl) ? canonicalUrl : null;
};

const resolvePublicOriginUrl = async (storageKey: string) => {
  if (config.storage.delivery.publicFeedUseSignedUrls) {
    try {
      return await r2Service.generateVerifiedDownloadUrl(storageKey, 60 * 60);
    } catch (_error) {
      return null;
    }
  }

  const canonicalUrl = resolveCanonicalUrl(storageKey);
  if (canonicalUrl) {
    return canonicalUrl;
  }

  try {
    return await r2Service.generateVerifiedDownloadUrl(storageKey, 60 * 60);
  } catch (_error) {
    return null;
  }
};

const resolvePublicImageVariantUrl = async (storageKey: string) => {
  const variantKey = buildDisplayVariantKey(storageKey);

  if (config.storage.delivery.publicFeedUseSignedUrls) {
    try {
      return await r2Service.generateVerifiedDownloadUrl(variantKey, 60 * 60);
    } catch (_error) {
      return null;
    }
  }

  const canonicalUrl = resolveCanonicalUrl(variantKey);
  if (canonicalUrl) {
    return canonicalUrl;
  }

  try {
    return await r2Service.generateVerifiedDownloadUrl(variantKey, 60 * 60);
  } catch (_error) {
    return null;
  }
};

const serializePublicAsset = async (asset: PublicAssetRecord) => {
  const serialized = serializeAsset(asset);

  if (!asset.storageKey.trim()) {
    return serialized;
  }

  if (serialized.preferredPlaybackSource === "MUX") {
    const originUrl = await resolvePublicOriginUrl(asset.storageKey);

    return {
      ...serialized,
      originUrl,
    };
  }

  const originUrl = await resolvePublicOriginUrl(asset.storageKey);
  const preferredVariantUrl =
    asset.assetType === "IMAGE" || asset.assetType === "COVER"
      ? await resolvePublicImageVariantUrl(asset.storageKey)
      : null;
  const preferredPlaybackUrl =
    serialized.preferredPlaybackSource === "ORIGIN" || !serialized.preferredPlaybackUrl
      ? preferredVariantUrl ?? originUrl
      : serialized.preferredPlaybackUrl;

  return {
    ...serialized,
    originUrl,
    preferredPlaybackUrl,
  };
};

const serializePublicFeedPost = async (manifest: PublicManifestRecord) => {
  const metadata = readLocalImportMetadata(manifest.metadataJson);
  const assets = await Promise.all(manifest.assets.map(serializePublicAsset));

  return {
    postId: manifest.id,
    manifestId: manifest.id,
    slug: manifest.publicSlug?.trim() || metadata?.slug || manifest.id,
    creatorWallet: manifest.creatorWallet,
    creatorName:
      manifest.creatorDisplayName?.trim() || metadata?.creatorName || null,
    creatorStage: metadata?.creatorStage ?? null,
    title: manifest.title,
    excerpt: manifest.publicExcerpt?.trim() || metadata?.excerpt || null,
    body: manifest.captionText,
    location: metadata?.location ?? null,
    publishTimeLabel: metadata?.publishTimeLabel ?? null,
    publishedAt: manifest.publishedAt?.toISOString() ?? null,
    theme: metadata?.theme,
    mood: metadata?.mood,
    visualDirection: metadata?.visualDirection,
    postDirectoryName: metadata?.postDirectoryName,
    contentType: manifest.contentType,
    status: manifest.status,
    coverAssetId: manifest.coverAssetId,
    tags: readStringArray(manifest.tagsJson),
    assets,
    createdAt: manifest.createdAt.toISOString(),
    updatedAt: manifest.updatedAt.toISOString(),
  };
};

const findPublicManifestById = async (postId: string) => {
  return prisma.contentManifest.findFirst({
    where: {
      id: postId,
      isPublicFeedEligible: true,
      status: {
        in: [...PUBLIC_FEED_STATUSES],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      ...publicManifestSelect,
      assets: {
        orderBy: {
          orderIndex: "asc",
        },
        select: publicAssetSelect,
      },
    },
  });
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
        isPublicFeedEligible: true,
        status: {
          in: [...PUBLIC_FEED_STATUSES],
        },
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        ...publicManifestSelect,
        assets: {
          orderBy: {
            orderIndex: "asc",
          },
          select: publicAssetSelect,
        },
      },
      take: limit,
    });

    const posts = await Promise.all(
      manifests.map((manifest) => serializePublicFeedPost(manifest))
    );

    res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
    ok(res, {
      posts,
    });
  }
);

export const getPublicFeedPostById = withController(
  "GET_PUBLIC_FEED_POST_FAILED",
  async (req, res) => {
    const postId = String(req.params.postId ?? "").trim();
    if (!postId) {
      throw new HttpError(400, "INVALID_INPUT", "postId is required");
    }

    const manifest = await findPublicManifestById(postId);
    if (!manifest) {
      throw new HttpError(404, "POST_NOT_FOUND", "public post not found");
    }

    const post = await serializePublicFeedPost(manifest);

    res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
    ok(res, {
      post,
    });
  }
);

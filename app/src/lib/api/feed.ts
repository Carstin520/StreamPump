import { CommentRecord, PostRecord } from "@/lib/api/types";
import { apiClient } from "./client";

type PublicFeedAssetRecord = {
  assetId: string;
  assetType: "IMAGE" | "VIDEO" | "COVER";
  orderIndex: number;
  originUrl: string | null;
  preferredPlaybackSource: "MUX" | "ORIGIN" | null;
  preferredPlaybackUrl: string | null;
  muxPlaybackUrl: string | null;
  uploadStatus: string;
  processingStatus: string;
  ingestStatus: string;
  deliveryStatus: string;
};

type PublicFeedPostApiRecord = {
  postId: string;
  manifestId: string;
  slug: string;
  creatorWallet: string;
  creatorName: string | null;
  creatorStage: string | null;
  title: string | null;
  excerpt: string | null;
  body: string | null;
  location: string | null;
  publishTimeLabel: string | null;
  contentType: "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
  status: string;
  coverAssetId: string | null;
  tags: string[];
  assets: PublicFeedAssetRecord[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PublicFeedResponse = {
  posts: PublicFeedPostApiRecord[];
};

type PublicFeedPostResponse = {
  post: PublicFeedPostApiRecord;
};

const FALLBACK_POSTER = "/mock/user-surface/posts/cat-portrait.svg";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "creator";

const hashString = (value: string) =>
  Array.from(value).reduce((result, char) => (result * 33 + char.charCodeAt(0)) % 2147483647, 7);

const isRenderableUrl = (value: string | null | undefined): value is string => {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
};

const pickBestAssetUrl = (asset: PublicFeedAssetRecord | null | undefined) => {
  if (!asset) {
    return null;
  }

  const candidates = [
    asset.assetType !== "VIDEO" ? asset.preferredPlaybackUrl : null,
    asset.assetType !== "VIDEO" ? asset.muxPlaybackUrl : null,
    asset.preferredPlaybackSource === "ORIGIN" ? asset.preferredPlaybackUrl : null,
    asset.originUrl,
  ];

  return candidates.find(isRenderableUrl) ?? null;
};

const pickBestVideoUrl = (asset: PublicFeedAssetRecord | null | undefined) => {
  if (!asset) {
    return null;
  }

  const candidates = [
    asset.preferredPlaybackUrl,
    asset.muxPlaybackUrl,
    asset.originUrl,
    asset.preferredPlaybackSource === "ORIGIN" ? asset.preferredPlaybackUrl : null,
  ];

  return candidates.find(isRenderableUrl) ?? null;
};

const stageFromMetadata = (value: string | null): PostRecord["stage"] => {
  switch (value) {
    case "S1_DISCOVERY":
    case "S1_BUYOUT":
    case "S2_ACTIVE":
      return value;
    default:
      return "NONE";
  }
};

const createAvatarDataUrl = (seed: string, label: string) => {
  const colors = [
    ["#de402a", "#ff9b75"],
    ["#2444ff", "#7aa3ff"],
    ["#1b8f62", "#8df0c8"],
    ["#7546ff", "#c2b6ff"],
    ["#a33b78", "#ff9dd4"],
  ];
  const hash = Array.from(seed).reduce((value, char) => value + char.charCodeAt(0), 0);
  const palette = colors[hash % colors.length];
  const initials = (label || "SP")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${palette[0]}"/><stop offset="100%" stop-color="${palette[1]}"/></linearGradient></defs><rect width="88" height="88" rx="22" fill="url(#g)"/><text x="44" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="white">${initials}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const inferMediaHeightClass = (post: PublicFeedPostApiRecord): string => {
  if (post.contentType === "SHORT_VIDEO") {
    return "h-[420px]";
  }

  if (post.contentType === "MIXED_MEDIA_NOTE") {
    return "h-[400px]";
  }

  return "h-[360px]";
};

const mapFeedPostToPostRecord = (post: PublicFeedPostApiRecord): PostRecord => {
  const sortedAssets = [...post.assets].sort((left, right) => left.orderIndex - right.orderIndex);
  const coverAsset =
    sortedAssets.find((asset) => asset.assetId === post.coverAssetId) ??
    sortedAssets.find((asset) => asset.assetType === "COVER") ??
    sortedAssets[0] ??
    null;
  const videoAsset = sortedAssets.find((asset) => asset.assetType === "VIDEO") ?? null;
  const imageAssets = sortedAssets.filter(
    (asset) => asset.assetType === "IMAGE" || asset.assetType === "COVER"
  );
  const coverSrc = pickBestAssetUrl(coverAsset) ?? FALLBACK_POSTER;
  const videoSrc = pickBestVideoUrl(videoAsset);
  const gallerySrcs = imageAssets
    .map((asset) => pickBestAssetUrl(asset))
    .filter((value): value is string => Boolean(value));
  const creatorName = post.creatorName?.trim() || "Imported Creator";
  const creatorKey = slugify(creatorName);
  const avatarSeed = `${creatorKey}:${post.slug}`;
  const likes = 320 + (hashString(`${post.slug}:likes`) % 7600);
  const saves = 48 + (hashString(`${post.slug}:saves`) % 1800);
  const commentsCount = 4 + (hashString(`${post.slug}:comments`) % 18);

  return {
    id: post.postId,
    type: videoAsset ? "VIDEO" : "IMAGE",
    creatorId: creatorKey,
    creatorName,
    creatorHandle: `@${creatorKey}`,
    creatorAvatarSrc: createAvatarDataUrl(avatarSeed, creatorName),
    title: post.title?.trim() || post.slug,
    excerpt: post.excerpt?.trim() || post.body?.trim() || "",
    body: post.body?.trim() || post.excerpt?.trim() || "",
    tags: post.tags,
    stage: stageFromMetadata(post.creatorStage),
    likes,
    saves,
    commentsCount,
    timeLabel: post.publishTimeLabel?.trim() || "Imported",
    location: post.location?.trim() || "Unknown",
    mediaHeightClass: inferMediaHeightClass(post),
    mediaStyle: "",
    coverSrc,
    ...(videoSrc ? { videoSrc } : {}),
    ...(gallerySrcs.length > 0 ? { gallerySrcs } : {}),
    hasMultipleImages: gallerySrcs.length > 1,
    comments: [] as CommentRecord[],
  };
};

const extractOrigin = (value: string) => {
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
};

export const extractPublicMediaOrigins = (posts: PostRecord[]): string[] => {
  const origins = new Set<string>();

  posts.forEach((post) => {
    [post.coverSrc, post.videoSrc, ...(post.gallerySrcs ?? [])].forEach((candidate) => {
      if (!candidate) {
        return;
      }

      const origin = extractOrigin(candidate);
      if (origin) {
        origins.add(origin);
      }
    });
  });

  return [...origins];
};

export const listPublicFeedPosts = async (
  options?: {
    limit?: number;
  }
): Promise<PostRecord[]> => {
  const response = await apiClient.get<PublicFeedResponse>("/feed/posts", {
    query: {
      limit: options?.limit ?? 24,
    },
  });

  return response.posts.map(mapFeedPostToPostRecord);
};

export const getPublicFeedPostById = async (postId: string): Promise<PostRecord> => {
  const response = await apiClient.get<PublicFeedPostResponse>(`/feed/posts/${postId}`);

  return mapFeedPostToPostRecord(response.post);
};

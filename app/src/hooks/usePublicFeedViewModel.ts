import { useMemo } from "react";

import {
  ActivityAuthorRecord,
  ActivityFeedItemRecord,
  ActivityFeedTabRecord,
  ActivitySidebarHighlightRecord,
  ActivityVideoItemRecord,
  CreatorMarketRecord,
  CurrentUserRecord,
  PostRecord,
  UserNoteRecord,
} from "@/lib/api/types";
import { publicDemoEnabled } from "@/lib/feature-flags";
import { resolveCreatorMarketSeed } from "@/lib/mocks/marketSeed";
import { currentUser as mockUserIdentity } from "@/lib/mocks/profile";
import { usePublicFeedPosts } from "./usePublicFeedPosts";

const activityFeedTabs: ActivityFeedTabRecord[] = [
  { id: "overview", label: "综合" },
  { id: "video", label: "视频" },
];

const compactPreview = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;

const stageLevelLabel = (state: CreatorMarketRecord["state"]) => {
  switch (state) {
    case "S2_ACTIVE":
      return "Graduated to S2";
    case "S1_BUYOUT":
      return "S1 Buyout Watch";
    default:
      return "S1 Discovery";
  }
};

const stageStatusLabel = (state: CreatorMarketRecord["state"]) => {
  switch (state) {
    case "S2_ACTIVE":
      return "Sponsor-ready content active";
    case "S1_BUYOUT":
      return "Buyout attention rising";
    default:
      return "Discovery momentum building";
  }
};

const pickState = (posts: PostRecord[]): CreatorMarketRecord["state"] => {
  if (posts.some((post) => post.stage === "S2_ACTIVE")) {
    return "S2_ACTIVE";
  }

  if (posts.some((post) => post.stage === "S1_BUYOUT")) {
    return "S1_BUYOUT";
  }

  return "S1_DISCOVERY";
};

const unique = <T,>(items: T[]) => [...new Set(items)];

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};

const normalizeRatingMomentum = (ratingBps: number | null): number => {
  if (ratingBps === null) return 0;
  // Protocol ratings span 5,000–20,000 bps. Map that chain range to the
  // product's 0–100 momentum scale instead of presenting the neutral 10,000 bps
  // baseline as a misleading 100/100 score.
  return Math.max(0, Math.min(100, Math.round(((ratingBps - 5_000) / 15_000) * 100)));
};

const parseAtomicSpump = (value: string): number => {
  const atomic = Number(value);
  return Number.isFinite(atomic) ? atomic / 1_000_000 : 0;
};

// Fabricated sponsor names — only in explicit public demo mode. Production leaves
// the list empty (UI shows a "sponsor TBD" placeholder) rather than inventing
// brands that are not real prospects.
const buildPotentialSponsors = (posts: PostRecord[], demo: boolean) => {
  if (!demo) {
    return [];
  }

  const tagPool = unique(posts.flatMap((post) => post.tags)).slice(0, 3);
  if (tagPool.length === 0) {
    return ["Signal House", "Afterglow Lab", "Orbit Studio"];
  }

  return tagPool.map((tag) => `${tag} Studio`);
};

const fallbackIntro = (
  creatorName: string,
  topTags: string[],
  niche: string,
) => {
  if (topTags.length > 0) {
    return `${creatorName} · ${topTags.map((tag) => `#${tag}`).join(" ")}`;
  }
  return `${creatorName} · ${niche}`;
};

const fallbackTeaser = (
  postsCount: number,
  topTags: string[],
  state: CreatorMarketRecord["state"],
) => {
  const tagPart = topTags.slice(0, 2).join(" / ") || "creator signal";
  if (state === "S2_ACTIVE") return `${tagPart} · Sponsor-ready content active`;
  if (state === "S1_BUYOUT") return `${tagPart} · Buyout attention rising`;
  return `${tagPart} · ${postsCount} active posts`;
};

const createCreatorRecord = (posts: PostRecord[], demo: boolean): CreatorMarketRecord => {
  const primaryPost = posts[0];
  const projection = primaryPost.creatorMarket;
  const state = projection?.stage ?? pickState(posts);
  const totalLikesAndSavesCount = posts.reduce((total, post) => total + post.likes + post.saves, 0);
  const derivedTags = unique(posts.flatMap((post) => post.tags)).slice(0, 3);
  const niche = derivedTags.join(" x ") || "Creator";
  const city = primaryPost.location;
  const intro = fallbackIntro(primaryPost.creatorName, derivedTags, niche);
  const teaser = fallbackTeaser(posts.length, derivedTags, state);
  // Content grouping stays available without a market projection. Quantitative
  // production values below come only from the chain-backed projection; the
  // content heuristic and seeded market remain explicit demo-only fallbacks.
  const contentMomentumScore = demo
    ? Math.min(72, 24 + posts.length * 12 + derivedTags.length * 4)
    : 0;
  // SEEDED_DEMO market projection join (by creator id or stable display name —
  // the feed slugifies CJK names so id alone won't match).
  const seed = demo
    ? resolveCreatorMarketSeed(primaryPost.creatorId, primaryPost.creatorName)
    : undefined;
  const ratingBps = readFiniteNumber(projection?.metadata?.s1RatingBps);

  return {
    id: primaryPost.creatorId,
    name: primaryPost.creatorName,
    handle: projection?.handle ? `@${projection.handle}` : primaryPost.creatorHandle,
    avatarSrc: primaryPost.creatorAvatarSrc,
    heroSrc: primaryPost.coverSrc,
    followingCount: 0,
    followersCount: 0,
    totalLikesAndSavesCount,
    niche,
    city,
    intro,
    level: stageLevelLabel(state),
    momentumScore:
      seed?.momentumScore ??
      (projection ? normalizeRatingMomentum(ratingBps) : contentMomentumScore),
    tokenPrice: seed?.tokenPriceSpump ?? 0,
    supply: projection ? Number(projection.s1Supply) : 0,
    graduationProgress:
      seed?.graduationProgress ??
      (projection ? Math.max(0, Math.min(100, projection.graduationProgressBps / 100)) : 0),
    holderCount: seed?.holderCount ?? projection?.holderCount ?? 0,
    buyoutStatus: seed || projection
      ? stageStatusLabel(state)
      : `${stageStatusLabel(state)} · market projection unavailable`,
    state,
    teaser,
    tags: derivedTags,
    topHolders: [],
    targetGraduationPrice: 0,
    potentialSponsors: buildPotentialSponsors(posts, demo),
    supporterDistributableUsd: undefined,
    buyoutOfferUsd: undefined,
    buyoutTimeline: undefined,
    activeCampaignCount: undefined,
    activityScore: undefined,
    valuationUsd: undefined,
    contentPool:
      posts.slice(0, 3).map((post) => compactPreview(post.title, 28)),
    currentPriceSpump: projection
      ? parseAtomicSpump(projection.currentPriceSpump)
      : undefined,
    marketProjectionUpdatedAt: projection?.updatedAt,
    momentumDelta7d: seed?.momentumDelta7d,
  };
};

const createUserNote = (
  post: PostRecord,
  prefix: string,
  authorName: string,
  authorAvatarSrc: string
): UserNoteRecord => ({
  id: `${prefix}-${post.id}`,
  sourcePostId: post.id,
  title: post.title,
  coverSrc: post.coverSrc,
  likes: post.likes,
  stage: post.stage,
  authorName,
  authorAvatarSrc,
  mediaHeightClass: post.mediaHeightClass,
});

// Fabricated "current user" identity + history. Only ever built in explicit
// public demo mode; production returns null so /me cannot show invented behavior.
const createCurrentUserRecord = (posts: PostRecord[]): CurrentUserRecord => {
  const bannerPost =
    posts.find((post) => post.type === "IMAGE" && !post.hasMultipleImages) ??
    posts.find((post) => post.type === "IMAGE") ??
    posts.find((post) => post.type === "VIDEO") ??
    null;
  const bannerSrc = bannerPost?.coverSrc ?? "/mock/user-surface/posts/luna-shadow.svg";
  const totalLikesAndSavesCount = posts.reduce((total, post) => total + post.likes + post.saves, 0);

  return {
    id: "james-li",
    name: "Alex Chen",
    handle: "@alexchen",
    location: mockUserIdentity.location,
    bio: "Curating imported creator signals and checking how real content reads inside the product surface.",
    followingCount: 120 + posts.length * 8,
    followersCount: 2400 + posts.length * 120,
    totalLikesAndSavesCount,
    sessionMode: "Social login + embedded wallet ready",
    primaryWallet: "4NwF...q8Yz",
    avatarSrc: mockUserIdentity.avatarSrc,
    bannerSrc,
  };
};

const createActivityAuthor = (
  creator: CreatorMarketRecord,
  posts: PostRecord[],
  demo: boolean
): ActivityAuthorRecord => ({
  creatorId: creator.id,
  note: compactPreview(posts[0]?.excerpt || posts[0]?.title || creator.teaser, 34),
  // `hasUnread` is per-user read state the backend projection does not track.
  // Inferring it from video presence is a demo-only heuristic; production leaves
  // it false so we never show a fabricated unread badge.
  hasUnread: demo ? posts.some((post) => post.type === "VIDEO") : false,
});

const createActivityFeedItem = (post: PostRecord, demo: boolean): ActivityFeedItemRecord => ({
  id: `activity-${post.id}`,
  kind: "post",
  creatorId: post.creatorId,
  postId: post.id,
  postedAtLabel: post.timeLabel,
  title: post.title,
  body: compactPreview(post.excerpt || post.body, 150),
  // When tags are absent, "Imported from local-post-assets" is a false
  // provenance claim in production. Keep that copy only in explicit demo mode;
  // otherwise fall back to an honest neutral label.
  actionSummary:
    post.tags.length > 0
      ? post.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")
      : demo
        ? "Imported from local-post-assets"
        : "No tags",
  commentsCount: post.commentsCount,
  likesCount: post.likes,
  // Shares are not tracked by the backend projection — fabricate a count only in
  // public demo mode; production shows the real (zero) value.
  sharesCount: demo ? Math.max(12, Math.round(post.saves / 6)) : 0,
  coverSrc: post.coverSrc,
  gallerySrcs: post.gallerySrcs,
  mediaType: post.type,
  durationLabel: post.durationLabel,
  stage: post.stage,
});

const createActivityVideoItem = (post: PostRecord, demo: boolean): ActivityVideoItemRecord => ({
  id: `video-${post.id}`,
  creatorId: post.creatorId,
  postId: post.id,
  title: post.title,
  coverSrc: post.coverSrc,
  durationLabel: post.durationLabel,
  // View counts are not tracked by the backend projection — inferred only in
  // public demo mode; production shows the real (zero) value.
  viewsCount: demo ? post.likes + post.saves * 2 : 0,
  commentsCount: post.commentsCount,
  timeLabel: post.timeLabel,
});

const createSidebarHighlight = (creator: CreatorMarketRecord, posts: PostRecord[]): ActivitySidebarHighlightRecord => ({
  creatorId: creator.id,
  headline: compactPreview(posts[0]?.excerpt || creator.teaser, 52),
  statusLabel: creator.buyoutStatus,
});

export const usePublicFeedViewModel = (options?: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const { error, loading, posts } = usePublicFeedPosts(options);

  const derived = useMemo(() => {
    const demo = publicDemoEnabled();
    const postsByCreator = new Map<string, PostRecord[]>();
    posts.forEach((post) => {
      const group = postsByCreator.get(post.creatorId) ?? [];
      group.push(post);
      postsByCreator.set(post.creatorId, group);
    });

    const creators = Array.from(postsByCreator.entries())
      .filter(([, creatorPosts]) => creatorPosts.length > 0)
      .map(([, creatorPosts]) => createCreatorRecord(creatorPosts, demo))
      .sort((left, right) => right.momentumScore - left.momentumScore);

    const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));

    const activityAuthors = creators.map((creator) =>
      createActivityAuthor(creator, postsByCreator.get(creator.id) ?? [], demo)
    );
    const activityFeedItems = posts.map((post) => createActivityFeedItem(post, demo));
    const activityVideoItems = posts
      .filter((post) => post.type === "VIDEO")
      .map((post) => createActivityVideoItem(post, demo));
    const activitySidebarHighlights = creators.slice(0, 4).map((creator) =>
      createSidebarHighlight(creator, postsByCreator.get(creator.id) ?? [])
    );
    // Current-user identity and saved/liked/note history are fabricated demo
    // artifacts. In production they are null/empty so /me shows only real,
    // session-backed data.
    const currentUser = demo ? createCurrentUserRecord(posts) : null;
    const currentUserNotes =
      demo && currentUser
        ? posts.map((post) =>
            createUserNote(post, "me-note", currentUser.name, currentUser.avatarSrc)
          )
        : [];
    const currentUserSavedPosts = demo
      ? posts.slice(0, 6).map((post) =>
          createUserNote(post, "saved", post.creatorName, post.creatorAvatarSrc)
        )
      : [];
    const currentUserLikedPosts = demo
      ? posts.slice(1, 7).map((post) =>
          createUserNote(post, "liked", post.creatorName, post.creatorAvatarSrc)
        )
      : [];

    return {
      activityAuthors,
      activityFeedItems,
      activityFeedTabs,
      activitySidebarHighlights,
      activityVideoItems,
      creatorMap,
      creators,
      currentUser,
      currentUserLikedPosts,
      currentUserNotes,
      currentUserSavedPosts,
      postsByCreator,
    };
  }, [posts]);

  return {
    error,
    loading,
    posts,
    ...derived,
  };
};

export const useExploreFeedViewModel = (options?: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => usePublicFeedPosts(options);

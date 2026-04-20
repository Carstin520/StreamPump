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

const buildTopHolders = (creatorId: string) =>
  [1, 2, 3].map((rank) => ({
    rank,
    label: `0x${(creatorId + rank).replace(/[^a-z0-9]/gi, "").slice(0, 4)}...${String(rank * 17).padStart(2, "0")}`,
    share: `${(8.9 - rank * 1.3).toFixed(1)}%`,
  }));

const buildPotentialSponsors = (posts: PostRecord[]) => {
  const tagPool = unique(posts.flatMap((post) => post.tags)).slice(0, 3);
  if (tagPool.length === 0) {
    return ["Signal House", "Afterglow Lab", "Orbit Studio"];
  }

  return tagPool.map((tag) => `${tag} Studio`);
};

const createCreatorRecord = (posts: PostRecord[]): CreatorMarketRecord => {
  const primaryPost = posts[0];
  const state = pickState(posts);
  const totalLikesAndSavesCount = posts.reduce((total, post) => total + post.likes + post.saves, 0);
  const topTags = unique(posts.flatMap((post) => post.tags)).slice(0, 3);
  const followerBase = 18000 + totalLikesAndSavesCount * 3;
  const tokenPrice = Number((1.4 + (totalLikesAndSavesCount % 3200) / 1000).toFixed(2));
  const targetGraduationPrice = Number((tokenPrice * 1.42).toFixed(2));

  return {
    id: primaryPost.creatorId,
    name: primaryPost.creatorName,
    handle: primaryPost.creatorHandle,
    avatarSrc: primaryPost.creatorAvatarSrc,
    heroSrc: primaryPost.coverSrc,
    followingCount: 80 + posts.length * 14,
    followersCount: followerBase,
    totalLikesAndSavesCount,
    niche: topTags.join(" x ") || "Imported creator signal",
    city: primaryPost.location,
    intro: compactPreview(primaryPost.body || primaryPost.excerpt, 120),
    level: stageLevelLabel(state),
    momentumScore: Math.min(96, 54 + posts.length * 8 + Math.round(totalLikesAndSavesCount / 2800)),
    tokenPrice,
    supply: 9600 + posts.length * 1400,
    graduationProgress: state === "S2_ACTIVE" ? 100 : Math.min(92, 38 + posts.length * 18),
    buyoutStatus: stageStatusLabel(state),
    state,
    teaser: compactPreview(primaryPost.excerpt || primaryPost.body, 72),
    tags: topTags,
    holderCount: 820 + posts.length * 380,
    topHolders: buildTopHolders(primaryPost.creatorId),
    targetGraduationPrice,
    potentialSponsors: buildPotentialSponsors(posts),
    supporterDistributableUsd: 38000 + posts.length * 21000,
    buyoutOfferUsd: 160000 + posts.length * 98000,
    buyoutTimeline:
      state === "S1_BUYOUT"
        ? ["Signal building", "Sponsor attention", "Window approaching"]
        : undefined,
    activeCampaignCount: state === "S2_ACTIVE" ? Math.max(1, posts.length - 1) : undefined,
    activityScore: state === "S2_ACTIVE" ? 72 + posts.length * 4 : undefined,
    valuationUsd: state === "S2_ACTIVE" ? 480000 + posts.length * 180000 : undefined,
    contentPool: posts.slice(0, 3).map((post) => compactPreview(post.title, 28)),
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
    location: posts[0]?.location ?? "Shanghai",
    bio: "Curating imported creator signals and checking how real content reads inside the product surface.",
    followingCount: 120 + posts.length * 8,
    followersCount: 2400 + posts.length * 120,
    totalLikesAndSavesCount,
    sessionMode: "Social login + embedded wallet ready",
    primaryWallet: "4NwF...q8Yz",
    avatarSrc: posts[0]?.creatorAvatarSrc ?? "/mock/user-surface/posts/cat-portrait.svg",
    bannerSrc,
  };
};

const createActivityAuthor = (creator: CreatorMarketRecord, posts: PostRecord[]): ActivityAuthorRecord => ({
  creatorId: creator.id,
  note: compactPreview(posts[0]?.excerpt || posts[0]?.title || creator.teaser, 34),
  hasUnread: posts.some((post) => post.type === "VIDEO"),
});

const createActivityFeedItem = (post: PostRecord): ActivityFeedItemRecord => ({
  id: `activity-${post.id}`,
  kind: "post",
  creatorId: post.creatorId,
  postId: post.id,
  postedAtLabel: post.timeLabel,
  title: post.title,
  body: compactPreview(post.excerpt || post.body, 150),
  actionSummary:
    post.tags.length > 0
      ? post.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")
      : "Imported from local-post-assets",
  commentsCount: post.commentsCount,
  likesCount: post.likes,
  sharesCount: Math.max(12, Math.round(post.saves / 6)),
  coverSrc: post.coverSrc,
  mediaType: post.type,
  durationLabel: post.durationLabel,
  stage: post.stage,
});

const createActivityVideoItem = (post: PostRecord): ActivityVideoItemRecord => ({
  id: `video-${post.id}`,
  creatorId: post.creatorId,
  postId: post.id,
  title: post.title,
  coverSrc: post.coverSrc,
  durationLabel: post.durationLabel,
  viewsCount: post.likes + post.saves * 2,
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
    const postsByCreator = new Map<string, PostRecord[]>();
    posts.forEach((post) => {
      const group = postsByCreator.get(post.creatorId) ?? [];
      group.push(post);
      postsByCreator.set(post.creatorId, group);
    });

    const creators = Array.from(postsByCreator.entries())
      .map(([, creatorPosts]) => createCreatorRecord(creatorPosts))
      .sort((left, right) => right.momentumScore - left.momentumScore);
    const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
    const activityAuthors = creators.map((creator) =>
      createActivityAuthor(creator, postsByCreator.get(creator.id) ?? [])
    );
    const activityFeedItems = posts.map(createActivityFeedItem);
    const activityVideoItems = posts
      .filter((post) => post.type === "VIDEO")
      .map(createActivityVideoItem);
    const activitySidebarHighlights = creators.slice(0, 4).map((creator) =>
      createSidebarHighlight(creator, postsByCreator.get(creator.id) ?? [])
    );
    const currentUser = createCurrentUserRecord(posts);
    const currentUserNotes = posts.map((post) =>
      createUserNote(post, "me-note", currentUser.name, currentUser.avatarSrc)
    );
    const currentUserSavedPosts = posts.slice(0, 6).map((post) =>
      createUserNote(post, "saved", post.creatorName, post.creatorAvatarSrc)
    );
    const currentUserLikedPosts = posts.slice(1, 7).map((post) =>
      createUserNote(post, "liked", post.creatorName, post.creatorAvatarSrc)
    );

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

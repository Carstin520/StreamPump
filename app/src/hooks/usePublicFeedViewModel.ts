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
import {
  creators as creatorProfileSeeds,
  posts as fallbackPublicFeedPosts,
} from "@/lib/mocks/discover";
import { usePublicFeedPosts } from "./usePublicFeedPosts";

const creatorProfileById = new Map(
  creatorProfileSeeds.map((seed) => [seed.id, seed]),
);

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

const createCreatorRecord = (posts: PostRecord[]): CreatorMarketRecord => {
  const primaryPost = posts[0];
  const profileSeed = creatorProfileById.get(primaryPost.creatorId);
  const state = profileSeed?.state ?? pickState(posts);
  const totalLikesAndSavesCount = posts.reduce((total, post) => total + post.likes + post.saves, 0);
  const derivedTags = unique(posts.flatMap((post) => post.tags)).slice(0, 3);
  const tags = profileSeed?.tags?.length ? profileSeed.tags : derivedTags;
  const niche =
    profileSeed?.niche ?? (derivedTags.join(" x ") || "Imported creator signal");
  const city = profileSeed?.city ?? primaryPost.location;
  const intro =
    profileSeed?.intro ??
    fallbackIntro(primaryPost.creatorName, derivedTags, niche);
  const teaser =
    profileSeed?.teaser ?? fallbackTeaser(posts.length, derivedTags, state);
  const followerBase = 18000 + totalLikesAndSavesCount * 3;
  const tokenPrice =
    profileSeed?.tokenPrice ??
    Number((1.4 + (totalLikesAndSavesCount % 3200) / 1000).toFixed(2));
  const targetGraduationPrice =
    profileSeed?.targetGraduationPrice ?? Number((tokenPrice * 1.42).toFixed(2));

  return {
    id: primaryPost.creatorId,
    name: primaryPost.creatorName,
    handle: primaryPost.creatorHandle,
    avatarSrc: primaryPost.creatorAvatarSrc,
    heroSrc: primaryPost.coverSrc,
    followingCount: profileSeed?.followingCount ?? 80 + posts.length * 14,
    followersCount: profileSeed?.followersCount ?? followerBase,
    totalLikesAndSavesCount,
    niche,
    city,
    intro,
    level: profileSeed?.level ?? stageLevelLabel(state),
    momentumScore:
      profileSeed?.momentumScore ??
      Math.min(96, 54 + posts.length * 8 + Math.round(totalLikesAndSavesCount / 2800)),
    tokenPrice,
    supply: profileSeed?.supply ?? 9600 + posts.length * 1400,
    graduationProgress:
      profileSeed?.graduationProgress ??
      (state === "S2_ACTIVE" ? 100 : Math.min(92, 38 + posts.length * 18)),
    buyoutStatus: profileSeed?.buyoutStatus ?? stageStatusLabel(state),
    state,
    teaser,
    tags,
    holderCount: profileSeed?.holderCount ?? 820 + posts.length * 380,
    topHolders: profileSeed?.topHolders ?? buildTopHolders(primaryPost.creatorId),
    targetGraduationPrice,
    potentialSponsors:
      profileSeed?.potentialSponsors ?? buildPotentialSponsors(posts),
    supporterDistributableUsd:
      profileSeed?.supporterDistributableUsd ?? 38000 + posts.length * 21000,
    buyoutOfferUsd: profileSeed?.buyoutOfferUsd ?? 160000 + posts.length * 98000,
    buyoutTimeline:
      profileSeed?.buyoutTimeline ??
      (state === "S1_BUYOUT"
        ? ["Signal building", "Sponsor attention", "Window approaching"]
        : undefined),
    activeCampaignCount:
      profileSeed?.activeCampaignCount ??
      (state === "S2_ACTIVE" ? Math.max(1, posts.length - 1) : undefined),
    activityScore:
      profileSeed?.activityScore ??
      (state === "S2_ACTIVE" ? 72 + posts.length * 4 : undefined),
    valuationUsd:
      profileSeed?.valuationUsd ??
      (state === "S2_ACTIVE" ? 480000 + posts.length * 180000 : undefined),
    contentPool:
      profileSeed?.contentPool ??
      posts.slice(0, 3).map((post) => compactPreview(post.title, 28)),
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

    creatorProfileSeeds.forEach((creator) => {
      const currentPosts = postsByCreator.get(creator.id);
      if (currentPosts?.length) {
        return;
      }

      const fallbackPosts = fallbackPublicFeedPosts.filter((post) => post.creatorId === creator.id);
      if (fallbackPosts.length > 0) {
        postsByCreator.set(creator.id, fallbackPosts);
      }
    });

    const derivedCreators = Array.from(postsByCreator.entries())
      .filter(([, creatorPosts]) => creatorPosts.length > 0)
      .map(([, creatorPosts]) => createCreatorRecord(creatorPosts));
    const creatorMap = new Map(creatorProfileSeeds.map((creator) => [creator.id, creator]));
    derivedCreators.forEach((creator) => {
      creatorMap.set(creator.id, creator);
    });
    const creators = Array.from(creatorMap.values()).sort(
      (left, right) => right.momentumScore - left.momentumScore
    );
    const visiblePosts = posts.length > 0 ? posts : fallbackPublicFeedPosts;
    const activityAuthors = creators.map((creator) =>
      createActivityAuthor(creator, postsByCreator.get(creator.id) ?? [])
    );
    const activityFeedItems = visiblePosts.map(createActivityFeedItem);
    const activityVideoItems = visiblePosts
      .filter((post) => post.type === "VIDEO")
      .map(createActivityVideoItem);
    const activitySidebarHighlights = creators.slice(0, 4).map((creator) =>
      createSidebarHighlight(creator, postsByCreator.get(creator.id) ?? [])
    );
    const currentUser = createCurrentUserRecord(visiblePosts);
    const currentUserNotes = visiblePosts.map((post) =>
      createUserNote(post, "me-note", currentUser.name, currentUser.avatarSrc)
    );
    const currentUserSavedPosts = visiblePosts.slice(0, 6).map((post) =>
      createUserNote(post, "saved", post.creatorName, post.creatorAvatarSrc)
    );
    const currentUserLikedPosts = visiblePosts.slice(1, 7).map((post) =>
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

export const useExploreFeedViewModel = (options?: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => usePublicFeedPosts(options);

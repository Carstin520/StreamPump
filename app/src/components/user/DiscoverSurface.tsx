import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import {
  useExploreFeedViewModel,
  usePublicFeedViewModel,
} from "@/hooks/usePublicFeedViewModel";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

import { PageShell } from "@/components/layout/PageShell";
import { DiscoverBoard } from "./DiscoverBoard";
import { PostCard } from "./PostCard";
import { ShortImmersiveOverlay } from "./ShortImmersiveOverlay";
import { ShortsShelf } from "./ShortsShelf";

let postDetailExperiencePromise:
  | Promise<typeof import("@/components/post/PostDetailExperience").PostDetailExperience>
  | null = null;

const loadPostDetailExperience = () => {
  if (!postDetailExperiencePromise) {
    postDetailExperiencePromise = import("@/components/post/PostDetailExperience").then(
      (mod) => mod.PostDetailExperience,
    );
  }

  return postDetailExperiencePromise;
};

const DynamicPostDetailExperience = dynamic(loadPostDetailExperience, {
  ssr: false,
});

const preloadPostDetailExperience = () => {
  void loadPostDetailExperience();
};

const discoverCategoryKeys = [
  "feed.categories.recommended",
  "feed.categories.racing",
  "feed.categories.game",
  "feed.categories.film",
  "feed.categories.tech",
  "feed.categories.city",
  "feed.categories.mood",
  "feed.categories.creatorWatch",
] as const;

type DiscoverCategoryKey = (typeof discoverCategoryKeys)[number];

// Real client-side filtering over the loaded feed's actual tags / stage.
// Keyword sets match the seeded tag vocabulary (tags, title, location, excerpt).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "feed.categories.racing": ["赛车", "f1", "赛道", "方程式", "机械美学", "速度感"],
  "feed.categories.game": ["游戏", "3a", "gta", "黑神话", "deathstranding", "预告片"],
  "feed.categories.film": ["电影", "科幻电影", "沙丘", "沙漠科幻", "银翼杀手", "观影", "观后感", "电影感"],
  "feed.categories.tech": ["航天", "火箭", "科技", "太空", "工程", "理工"],
  "feed.categories.city": ["城市", "赛博朋克", "夜景", "霓虹", "山城", "重庆夜"],
  "feed.categories.mood": ["情绪", "氛围", "治愈", "反差萌", "居家", "猫咪", "音乐现场", "演出", "舞台", "演唱会"],
};

const matchesCategory = (post: PostRecord, categoryKey: DiscoverCategoryKey): boolean => {
  if (categoryKey === "feed.categories.recommended") {
    return true;
  }
  if (categoryKey === "feed.categories.creatorWatch") {
    return post.stage !== "NONE";
  }
  const keywords = CATEGORY_KEYWORDS[categoryKey];
  if (!keywords) {
    return true;
  }
  const haystack = [post.title, post.excerpt, post.location, ...post.tags].join(" ").toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
};

export const DiscoverSurface = ({
  initialError = null,
  initialPosts = [],
}: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const { t } = useI18n();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<"recommended" | "following">("recommended");
  const viewModel = useExploreFeedViewModel({
    initialError,
    initialPosts,
  });
  const { posts } = viewModel;

  const shorts = useMemo(
    () => viewModel.posts.filter((p) => p.type === "VIDEO"),
    [viewModel.posts],
  );

  return (
    <PageShell topbarLeading={<FeedTabs feedTab={feedTab} onChange={setFeedTab} />} topbarMode="scroll-reveal">
      <ExploreView
        feedTab={feedTab}
        onOpenPost={setSelectedPostId}
        onOpenShort={setSelectedShortId}
        shorts={shorts}
        viewModel={viewModel}
      />
      {selectedPostId && posts.length > 0 ? (
        <DynamicPostDetailExperience
          currentPostId={selectedPostId}
          items={posts}
          mode="modal"
          onChangePostId={setSelectedPostId}
          onClose={() => setSelectedPostId(null)}
          closeLabel={t("feed.backToExplore")}
          syncRoute={false}
        />
      ) : null}
      {selectedShortId ? (
        <ShortImmersiveOverlay
          currentPostId={selectedShortId}
          onChangePostId={setSelectedShortId}
          onClose={() => setSelectedShortId(null)}
          shorts={shorts}
        />
      ) : null}
    </PageShell>
  );
};

// 推荐 / 关注 feed tabs — rendered in the topbar row (next to search) per the
// content prototype. Following has no real follow graph yet (see preview note).
const FeedTabs = ({
  feedTab,
  onChange,
}: {
  feedTab: "recommended" | "following";
  onChange: (tab: "recommended" | "following") => void;
}) => {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      {(["recommended", "following"] as const).map((tab) => (
        <button
          className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition duration-200 ${
            feedTab === tab ? "bg-white/10 text-white" : "text-[#8192ac] hover:text-white"
          }`}
          key={tab}
          onClick={() => onChange(tab)}
          type="button"
        >
          {tab === "recommended" ? t("feed.tabRecommended") : t("feed.tabFollowing")}
        </button>
      ))}
    </div>
  );
};

const ExploreView = ({
  feedTab,
  onOpenPost,
  onOpenShort,
  shorts,
  viewModel,
}: {
  feedTab: "recommended" | "following";
  onOpenPost: (postId: string) => void;
  onOpenShort: (postId: string) => void;
  shorts: PostRecord[];
  viewModel: ReturnType<typeof useExploreFeedViewModel>;
}) => {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<DiscoverCategoryKey>(discoverCategoryKeys[0]);

  const visiblePosts = useMemo(() => {
    if (activeCategory === "feed.categories.creatorWatch") {
      // Prefer real market-season metadata when present (seeded/demo feeds)...
      const staged = viewModel.posts.filter((post) => post.stage !== "NONE");
      if (staged.length > 0) {
        return staged;
      }
      // ...otherwise (imported feed has no season metadata, and likes/saves are
      // not populated) rank creators by profile richness (tag count) and take the
      // top half — a stable, non-empty ~50% "worth watching" subset that holds for
      // any tag distribution. Deterministic tie-break by id; original order kept.
      const ranked = [...viewModel.posts].sort(
        (a, b) => b.tags.length - a.tags.length || a.id.localeCompare(b.id),
      );
      const half = Math.max(1, Math.ceil(ranked.length / 2));
      const watchIds = new Set(ranked.slice(0, half).map((post) => post.id));
      return viewModel.posts.filter((post) => watchIds.has(post.id));
    }
    return viewModel.posts.filter((post) => matchesCategory(post, activeCategory));
  }, [viewModel.posts, activeCategory]);

  return (
    <div className="-mt-3 space-y-4">
      <PublicFeedSourceNotice error={viewModel.error} postCount={viewModel.posts.length} surface="explore" />

      {/* 推荐/关注 tabs live in the topbar (next to search). Following has no real
          follow graph yet, so it shows the recommended feed with an honest note. */}
      {feedTab === "following" ? (
        <p className="tone-state-info rounded-[12px] border px-3.5 py-2 text-[length:var(--fs-caption)]">
          {t("feed.followingPreviewNote")}
        </p>
      ) : null}

      <section
        className="sticky z-30 pt-1"
        style={{
          top: "var(--scroll-reveal-category-top, calc(var(--scroll-reveal-bar-h, 92px) + 12px))",
        }}
      >
        <div className="glass-toolbar flex items-center gap-2 overflow-x-auto px-2 py-2 text-sm">
          {discoverCategoryKeys.map((categoryKey) => {
            const active = categoryKey === activeCategory;
            return (
              <button
                className={`whitespace-nowrap rounded-full px-4 py-2 transition duration-200 ${
                  active
                    ? "liquid-pill liquid-pill-active text-white"
                    : "liquid-pill text-[#edf2fb]/70 hover:text-white"
                }`}
                key={categoryKey}
                onClick={() => setActiveCategory(categoryKey)}
                type="button"
              >
                {t(categoryKey)}
              </button>
            );
          })}
          {visiblePosts.length > 0 ? (
            <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
              <FeedStatChip label={t("feed.stat.posts")} value={String(visiblePosts.length)} tone="info" />
            </div>
          ) : null}
        </div>
      </section>

      <ShortsShelf onOpenShort={onOpenShort} shorts={shorts} />
      <PostsSection onOpenPost={onOpenPost} posts={visiblePosts} viewModel={viewModel} />
    </div>
  );
};

const PublicFeedSourceNotice = ({
  error,
  postCount,
  surface,
}: {
  error: string | null;
  postCount: number;
  surface: "explore" | "trending";
}) => {
  if (error) {
    return (
      <section className="tone-state-warning rounded-[14px] border px-4 py-3">
        <p className="text-sm font-semibold text-white">
          {surface === "explore" ? "Feed unavailable" : "Trending unavailable"}
        </p>
        <p className="mt-1 text-[length:var(--fs-caption)] leading-5 text-[#9aabc4]">{error}</p>
      </section>
    );
  }

  if (postCount === 0) {
    return null;
  }

  return null;
};

const FeedStatChip = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "info" | "success";
}) => {
  const toneClass = tone === "success" ? "tone-state-success" : "tone-state-info";

  return (
    <div className={`${toneClass} flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm`}>
      <span className="text-[length:var(--fs-micro)] font-semibold tracking-wide text-white">{value}</span>
      <span className="text-[length:var(--fs-micro)]">{label}</span>
    </div>
  );
};

const PostsSection = ({
  onOpenPost,
  posts,
  viewModel,
}: {
  onOpenPost: (postId: string) => void;
  posts: PostRecord[];
  viewModel: ReturnType<typeof useExploreFeedViewModel>;
}) => {
  const { t } = useI18n();
  const { error, loading } = viewModel;
  const hasAnyPosts = viewModel.posts.length > 0;

  return (
    <section className="section-enter pb-8">
      {loading ? (
        <div className="masonry-grid masonry-grid-home">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="liquid-card mb-4 h-[320px] break-inside-avoid rounded-[28px]"
              key={`feed-skeleton-${index}`}
            />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.importedUnavailable")}</p>
          <p className="mt-2 text-[#8ea0ba]">{error}</p>
        </div>
      ) : null}

      {!loading && !error && !hasAnyPosts ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.emptyTitle")}</p>
          <p className="mt-2 text-[#8ea0ba]">{t("feed.emptyBody")}</p>
        </div>
      ) : null}

      {!loading && !error && hasAnyPosts && posts.length === 0 ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.categoryEmptyTitle")}</p>
          <p className="mt-2 text-[#8ea0ba]">{t("feed.categoryEmptyBody")}</p>
        </div>
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <div className="masonry-grid masonry-grid-home">
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              priority={index < 4}
              onClick={() => onOpenPost(post.id)}
              onPreview={preloadPostDetailExperience}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export const TrendingSurface = ({
  initialError = null,
  initialPosts = [],
}: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => (
  <PageShell>
    <TrendingView initialError={initialError} initialPosts={initialPosts} />
  </PageShell>
);

const TrendingView = ({
  initialError,
  initialPosts,
}: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const { t } = useI18n();
  const { creators, error, loading, postsByCreator } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });

  return (
    <section className="mx-auto max-w-[1280px] space-y-5 py-4">
      <PublicFeedSourceNotice error={error} postCount={creators.length} surface="trending" />

      {loading ? <div className="text-sm text-[#8ea0ba]">{t("feed.loadingCreators")}</div> : null}
      {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

      {!loading && !error && creators.length === 0 ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.emptyTitle")}</p>
          <p className="mt-2 text-[#8ea0ba]">{t("feed.emptyBody")}</p>
        </div>
      ) : null}

      {!loading && !error && creators.length > 0 ? (
        <DiscoverBoard creators={creators} postsByCreator={postsByCreator} />
      ) : null}
    </section>
  );
};

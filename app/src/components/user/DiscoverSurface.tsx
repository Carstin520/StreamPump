import dynamic from "next/dynamic";
import { useState } from "react";

import {
  useExploreFeedViewModel,
  usePublicFeedViewModel,
} from "@/hooks/usePublicFeedViewModel";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

import { PageShell } from "@/components/layout/PageShell";
import { PostCard } from "./PostCard";
import { TrendingTabsView } from "./TrendingTabs";

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

export const DiscoverSurface = ({
  initialError = null,
  initialPosts = [],
}: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const { t } = useI18n();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const viewModel = useExploreFeedViewModel({
    initialError,
    initialPosts,
  });
  const { posts } = viewModel;

  return (
    <PageShell topbarMode="scroll-reveal">
      <ExploreView onOpenPost={setSelectedPostId} viewModel={viewModel} />
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
    </PageShell>
  );
};

const ExploreView = ({
  onOpenPost,
  viewModel,
}: {
  onOpenPost: (postId: string) => void;
  viewModel: ReturnType<typeof useExploreFeedViewModel>;
}) => {
  const { t } = useI18n();
  const postCount = viewModel.posts.length;

  return (
    <div className="-mt-3 space-y-4">
      <PublicFeedSourceNotice error={viewModel.error} postCount={postCount} surface="explore" />
      <section
        className="sticky z-30 pt-1"
        style={{
          top: "var(--scroll-reveal-category-top, calc(var(--scroll-reveal-bar-h, 92px) + 12px))",
        }}
      >
        <div className="glass-toolbar flex items-center gap-2 overflow-x-auto px-2 py-2 text-sm">
          {discoverCategoryKeys.map((categoryKey, index) => (
            <button
              className={`whitespace-nowrap rounded-full px-4 py-2 transition duration-200 ${
                index === 0
                  ? "liquid-pill liquid-pill-active text-white"
                  : "liquid-pill text-[#edf2fb]/50 cursor-default"
              }`}
              key={categoryKey}
              type="button"
              disabled={index !== 0}
            >
              {t(categoryKey)}
            </button>
          ))}
          {postCount > 0 ? (
            <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
              <FeedStatChip label={t("feed.stat.posts")} value={String(postCount)} tone="info" />
            </div>
          ) : null}
        </div>
      </section>

      <PostsSection onOpenPost={onOpenPost} viewModel={viewModel} />
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
      <section className="rounded-[14px] border border-[#f3b33e]/25 bg-[#1f1708]/55 px-4 py-3 text-[#f8d48a]">
        <p className="text-sm font-semibold text-white">
          {surface === "explore" ? "Feed unavailable" : "Trending unavailable"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{error}</p>
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
  const toneMap = {
    info: { ring: "border-[#67b8ff]/25", text: "text-[#8ad0ff]", bg: "bg-[#67b8ff]/[0.06]" },
    success: { ring: "border-[#65ecaf]/25", text: "text-[#8df0c4]", bg: "bg-[#65ecaf]/[0.06]" },
  };
  const t = toneMap[tone];

  return (
    <div className={`flex items-center gap-2 rounded-full border ${t.ring} ${t.bg} px-3 py-1.5 backdrop-blur-sm`}>
      <span className="text-[length:var(--fs-micro)] font-semibold tracking-wide text-white">{value}</span>
      <span className={`text-[length:var(--fs-micro)] ${t.text}`}>{label}</span>
    </div>
  );
};

const PostsSection = ({
  onOpenPost,
  viewModel,
}: {
  onOpenPost: (postId: string) => void;
  viewModel: ReturnType<typeof useExploreFeedViewModel>;
}) => {
  const { t } = useI18n();
  const { error, loading, posts } = viewModel;

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

      {!loading && !error && posts.length === 0 ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.emptyTitle")}</p>
          <p className="mt-2 text-[#8ea0ba]">{t("feed.emptyBody")}</p>
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
  const { creators, error, loading, posts, postsByCreator } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });

  return (
    <section className="mx-auto max-w-[1280px] space-y-5 py-4">
      <PublicFeedSourceNotice error={error} postCount={creators.length} surface="trending" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">{t("feed.trendingCreators")}</h1>
          <p className="mt-1 text-xs text-[#97a7be]">{t("feed.trendingDesc")}</p>
        </div>
        {creators.length > 0 ? (
          <div className="rounded-full border border-[#67b8ff]/20 bg-[#0d1b2a] px-3 py-1.5 text-xs font-medium text-[#a8d8ff]">
            {creators.length} {creators.length === 1 ? "creator" : "creators"}
          </div>
        ) : null}
      </div>

      {loading ? <div className="text-sm text-[#8ea0ba]">{t("feed.loadingCreators")}</div> : null}
      {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

      {!loading && !error && creators.length === 0 ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">{t("feed.emptyTitle")}</p>
          <p className="mt-2 text-[#8ea0ba]">{t("feed.emptyBody")}</p>
        </div>
      ) : null}

      {!loading && !error && creators.length > 0 ? (
        <TrendingTabsView creators={creators} posts={posts} postsByCreator={postsByCreator} />
      ) : null}
    </section>
  );
};

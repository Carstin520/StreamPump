import dynamic from "next/dynamic";
import { useState } from "react";

import {
  useExploreFeedViewModel,
  usePublicFeedViewModel,
} from "@/hooks/usePublicFeedViewModel";
import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

import { PageShell } from "@/components/layout/PageShell";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { PostCard } from "./PostCard";
import { TrendingCreatorCard } from "./TrendingCreatorCard";

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

  return (
    <div className="-mt-3 space-y-4">
      <ProductReadinessBanner
        description="Explore can render public feed media from the backend, including R2/Mux-origin assets when configured. Category filters, signal chips, and creator market signals are still seeded or derived UI projections until feed eligibility, media smoke checks, and creator market read models are productionized."
        status="SEEDED_DEMO"
        title="Explore mixes public feed media with seeded market signals"
      />
      <PublicFeedSourceNotice error={viewModel.error} surface="explore" />
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
                  : "liquid-pill text-[#edf2fb] hover:text-white"
              }`}
              key={categoryKey}
              type="button"
            >
              {t(categoryKey)}
            </button>
          ))}
          <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
            <LiveStatChip icon="pulse" label="Buyout signals" value="12" tone="heat" />
            <LiveStatChip icon="dot" label="S2 profiles" value="84" tone="success" />
            <LiveStatChip icon="arrow" label={`${t("feed.stat.signal")} projection`} value="+4.2%" tone="info" />
          </div>
        </div>
      </section>

      <PostsSection onOpenPost={onOpenPost} viewModel={viewModel} />
    </div>
  );
};

const PublicFeedSourceNotice = ({
  error,
  surface,
}: {
  error: string | null;
  surface: "explore" | "trending";
}) => {
  const config = error
    ? {
        label: "SEEDED_DEMO",
        title: "Public feed fallback active",
        body: "The public feed API is unavailable for this render, so the surface is showing seeded media or derived creator records. Do not treat engagement, ranking, or market signals as production truth.",
        tone: "border-[#f3b33e]/25 bg-[#1f1708]/55 text-[#f8d48a]",
      }
    : surface === "explore"
      ? {
          label: "LIVE + SEEDED_DEMO",
          title: "Public feed with projected signals",
          body: "Post cards can come from the backend feed and configured media origins. Category filters, buyout counts, S2 counts, likes, saves, and market signals are derived display data until production feed eligibility and analytics are connected.",
          tone: "border-[#67b8ff]/20 bg-[#0d1b2a]/55 text-[#a8d8ff]",
        }
      : {
          label: "LIVE + SEEDED_DEMO",
          title: "Trending uses feed-derived creators",
          body: "Trending creators are derived from public feed posts and seeded creator profiles. Market price, holders, pools, offers, and momentum are projections until creator market read models and analytics are wired.",
          tone: "border-[#67b8ff]/20 bg-[#0d1b2a]/55 text-[#a8d8ff]",
        };

  return (
    <section className={`rounded-[14px] border px-4 py-3 ${config.tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Feed data source</p>
          <p className="mt-1 text-sm font-semibold text-white">{config.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{config.body}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[10px] font-semibold">
          {config.label}
        </span>
      </div>
    </section>
  );
};

const LiveStatChip = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: "pulse" | "dot" | "arrow";
  label: string;
  value: string;
  tone: "heat" | "success" | "info";
}) => {
  const toneMap = {
    heat: { ring: "border-[#de402a]/30", glow: "bg-[#de402a]", text: "text-[#ff8a78]", bg: "bg-[#de402a]/[0.06]" },
    success: { ring: "border-[#65ecaf]/25", glow: "bg-[#65ecaf]", text: "text-[#8df0c4]", bg: "bg-[#65ecaf]/[0.06]" },
    info: { ring: "border-[#67b8ff]/25", glow: "bg-[#67b8ff]", text: "text-[#8ad0ff]", bg: "bg-[#67b8ff]/[0.06]" },
  };
  const t = toneMap[tone];

  return (
    <div className={`flex items-center gap-2 rounded-full border ${t.ring} ${t.bg} px-3 py-1.5 backdrop-blur-sm`}>
      {icon === "pulse" && (
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${t.glow} opacity-50`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${t.glow}`} />
        </span>
      )}
      {icon === "dot" && <span className={`h-1.5 w-1.5 rounded-full ${t.glow}`} />}
      {icon === "arrow" && (
        <svg className={`h-3 w-3 ${t.text}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 12 12">
          <path d="M2 8.5 6 3.5 10 8.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span className="text-[11px] font-semibold tracking-wide text-white">{value}</span>
      <span className={`text-[10px] ${t.text}`}>{label}</span>
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
  const { creators, error, loading } = usePublicFeedViewModel({
    initialError,
    initialPosts,
  });

  return (
    <section className="mx-auto max-w-[1280px] space-y-5 py-4">
      <ProductReadinessBanner
        description="Trending can use public feed media, but creator ranking, price, holder, pool, offer, and momentum signals still include seeded or derived projections. Production promotion needs analytics, media smoke checks, and creator market read models."
        status="SEEDED_DEMO"
        title="Trending is feed-derived with projected market signals"
      />
      <PublicFeedSourceNotice error={error} surface="trending" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">{t("feed.trendingCreators")}</h1>
          <p className="mt-1 text-xs text-[#97a7be]">{t("feed.trendingDesc")}</p>
        </div>
        <div className="rounded-full border border-[#65ecaf]/20 bg-[#0e1f17] px-3 py-1.5 text-xs font-medium text-[#8df0c4]">
          Signal projection +4.2%
        </div>
      </div>

      {loading ? <div className="text-sm text-[#8ea0ba]">{t("feed.loadingCreators")}</div> : null}
      {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {creators.map((creator, index) => (
            <TrendingCreatorCard creator={creator} key={creator.id} priority={index < 2} />
          ))}
        </div>
      ) : null}
    </section>
  );
};

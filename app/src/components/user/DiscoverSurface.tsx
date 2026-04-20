import { usePublicFeedViewModel } from "@/hooks/usePublicFeedViewModel";

import { PageShell } from "@/components/layout/PageShell";
import { discoverCategories } from "@/lib/public-data";
import { PostCard } from "./PostCard";
import { TrendingCreatorCard } from "./TrendingCreatorCard";

export const DiscoverSurface = () => (
  <PageShell>
    <ExploreView />
  </PageShell>
);

const ExploreView = () => (
  <div className="space-y-5 py-4">
    <section className="liquid-glass-shell hero-glow section-enter relative px-5 py-6 md:px-7">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#de402a]/10 blur-3xl" />
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#92a4bd]">Discover</p>
          <h1 className="mt-3 max-w-3xl text-[38px] font-semibold leading-[1.02] tracking-[-0.06em] text-white md:text-[52px]">
            Scroll less noise. Land on posts that already feel like signal.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#c6d2e3]">
            Real imported media stays upfront, while creator stage and market context sit behind a calmer layer of glass instead of louder dashboard chrome.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <TrendStat label="Live buyouts" value="12" />
          <TrendStat label="S2 campaigns" value="84" />
          <TrendStat label="Signal score" value="+4.2%" />
        </div>
      </div>
    </section>

    <section className="sticky top-24 z-20 pb-2 pt-2">
      <div className="glass-toolbar flex gap-3 overflow-x-auto px-2 py-2 text-sm">
        {discoverCategories.map((category) => (
          <button
            className={`whitespace-nowrap rounded-full px-4 py-2.5 transition duration-200 ${
              category === "推荐"
                ? "liquid-pill liquid-pill-active text-white"
                : "liquid-pill text-[#edf2fb] hover:text-white"
            }`}
            key={category}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
    </section>

    <section className="liquid-panel section-enter flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2 rounded-full bg-[#24151a] px-3 py-1.5">
        <div className="h-2 w-2 rounded-full bg-[#de402a]" />
        <span className="text-xs font-bold tracking-[0.18em] text-[#ff8a78]">HOT RIGHT NOW</span>
      </div>
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-2 text-sm text-[#c8d4e6]">
        <span className="font-semibold text-white">12 LIVE BUYOUTS</span>
        <span className="text-[#73859f]">·</span>
        <span className="text-[#a2b0c6]">84 S2 ACTIVE</span>
      </div>
    </section>

    <PostsSection />
  </div>
);

const PostsSection = () => {
  const { error, loading, posts } = usePublicFeedViewModel();

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
          <p className="font-semibold text-white">Imported feed unavailable</p>
          <p className="mt-2 text-[#8ea0ba]">{error}</p>
        </div>
      ) : null}

      {!loading && !error && posts.length === 0 ? (
        <div className="liquid-panel rounded-[28px] px-5 py-5 text-sm text-[#c8d4e6]">
          <p className="font-semibold text-white">No imported posts yet</p>
          <p className="mt-2 text-[#8ea0ba]">The public feed is live, but there are no published local post assets to show.</p>
        </div>
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <div className="masonry-grid masonry-grid-home">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} priority={index < 4} />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export const TrendingSurface = () => (
  <PageShell>
    <TrendingView />
  </PageShell>
);

const TrendingView = () => {
  const { creators, error, loading } = usePublicFeedViewModel();

  return (
    <section className="mx-auto max-w-[1280px] space-y-8 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">Trending Creators</h1>
          <p className="mt-2 text-sm text-[#97a7be]">Discover investable creators with real imported media already attached.</p>
        </div>
        <div className="rounded-full border border-[#de402a]/20 bg-[#2c1715] px-4 py-2 text-sm font-medium text-[#ff8f7f]">
          Market Up +4.2%
        </div>
      </div>

      {loading ? <div className="text-sm text-[#8ea0ba]">Loading imported creators…</div> : null}
      {!loading && error ? <div className="text-sm text-[#8ea0ba]">{error}</div> : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {creators.map((creator, index) => (
            <TrendingCreatorCard creator={creator} key={creator.id} priority={index < 2} />
          ))}
        </div>
      ) : null}
    </section>
  );
};

const TrendStat = ({ label, value }: { label: string; value: string }) => (
  <div className="surface-muted rounded-[24px] px-4 py-4">
    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d9eb7]">{label}</p>
    <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-white">{value}</p>
  </div>
);

import Link from "next/link";

import { discoverCategories, posts, creators } from "@/lib/mock-data";
import { PostCard } from "./PostCard";
import { TrendingCreatorCard } from "./TrendingCreatorCard";
import { UserShell } from "./UserShell";
import { UserTopbar } from "./UserTopbar";

export const DiscoverSurface = () => (
  <UserShell
    header={<UserTopbar />}
  >
    <ExploreView />
  </UserShell>
);

const ExploreView = () => (
  <div className="space-y-5 py-4">
    <section className="sticky top-16 z-20 bg-[#090d14]/88 pb-2 pt-2 backdrop-blur-md">
      <div className="flex gap-3 overflow-x-auto pb-1 text-sm">
        {discoverCategories.map((category) => (
          <button
            className={`whitespace-nowrap rounded-full px-4 py-2.5 transition ${
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

    <section className="liquid-panel flex items-center gap-3 rounded-2xl px-4 py-3.5">
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

    <section className="pb-8">
      <div className="masonry-grid">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  </div>
);

export const TrendingSurface = () => (
  <UserShell
    header={<UserTopbar />}
  >
    <section className="mx-auto max-w-[1280px] space-y-8 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">Trending Creators</h1>
          <p className="mt-2 text-sm text-[#97a7be]">Discover investable creators with high momentum.</p>
        </div>
        <div className="rounded-full border border-[#de402a]/20 bg-[#2c1715] px-4 py-2 text-sm font-medium text-[#ff8f7f]">
          Market Up +4.2%
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {creators.map((creator) => (
          <TrendingCreatorCard creator={creator} key={creator.id} />
        ))}
      </div>
    </section>
  </UserShell>
);

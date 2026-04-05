import Link from "next/link";

import { discoverCategories, posts, creators } from "@/lib/mock-data";
import { PostCard } from "./PostCard";
import { TrendingCreatorCard } from "./TrendingCreatorCard";
import { UserShell } from "./UserShell";
import { UserTopbar } from "./UserTopbar";

export const DiscoverSurface = () => (
  <UserShell
    header={
      <UserTopbar
        title="Explore"
      />
    }
  >
    <ExploreView />
  </UserShell>
);

const ExploreView = () => (
  <div className="space-y-6">
    <section className="liquid-panel rounded-[30px] p-4">
      <div className="flex gap-3 overflow-x-auto pb-1 text-sm">
        {discoverCategories.map((category) => (
          <button
            className={`whitespace-nowrap rounded-full border px-4 py-2.5 transition ${
              category === "推荐"
                ? "border-white/14 bg-white text-black"
                : "liquid-pill border-white/0 text-[#edf2fb] hover:text-white"
            }`}
            key={category}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
    </section>

    <section className="liquid-panel flex items-center gap-3 rounded-[24px] p-4">
      <div className="flex items-center gap-2 rounded-full bg-[#1d3355]/32 px-3 py-1.5 backdrop-blur-md">
        <div className="h-2 w-2 rounded-full bg-[#5ea1ff]" />
        <span className="text-xs font-bold tracking-[0.18em] text-[#7bb6ff]">HOT RIGHT NOW</span>
      </div>
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-2 text-sm text-[#c8d4e6]">
        <span className="font-semibold text-white">12 LIVE BUYOUTS</span>
        <span className="text-[#73859f]">·</span>
        <span className="text-[#a2b0c6]">84 S2 ACTIVE</span>
      </div>
    </section>

    <section className="rounded-[34px] px-2 py-1">
      <div className="columns-1 gap-6 md:columns-2 xl:columns-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  </div>
);

export const TrendingSurface = () => (
  <UserShell
    header={
      <UserTopbar
        title="Trending Creators"
        subtitle="Discover investable creators with high momentum."
      />
    }
  >
    <section className="space-y-6">
      <div className="flex items-end justify-between rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b1019_100%)] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#6e7e98]">Market pulse</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Browse creators by stage and momentum</h2>
        </div>
        <div className="rounded-full bg-[#1d3355]/45 px-4 py-2 text-sm font-medium text-[#7bb6ff]">
          Market Up +4.2%
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {creators.map((creator) => (
          <TrendingCreatorCard creator={creator} key={creator.id} />
        ))}
        {creators.map((creator) => (
          <TrendingCreatorCard creator={{ ...creator, id: `${creator.id}-dup` }} key={`${creator.id}-dup`} />
        ))}
      </div>
    </section>
  </UserShell>
);

const TrendingView = () => (
  <section className="space-y-5">
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b1019_100%)] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6e7e98]">Hot right now</p>
        <p className="mt-2 text-3xl font-semibold text-white">126</p>
        <p className="mt-2 text-sm text-[#9eaac0]">Creators currently drawing high discovery attention.</p>
      </div>
      <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b1019_100%)] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6e7e98]">Live buyouts</p>
        <p className="mt-2 text-3xl font-semibold text-white">8</p>
        <p className="mt-2 text-sm text-[#9eaac0]">Profiles in the S1 buyout transition with supporter payout visibility.</p>
      </div>
      <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b1019_100%)] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6e7e98]">S2 active</p>
        <p className="mt-2 text-3xl font-semibold text-white">19</p>
        <p className="mt-2 text-sm text-[#9eaac0]">Creators already running sponsor-backed launches and content pools.</p>
      </div>
    </div>

    <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
      {creators.map((creator) => (
        <TrendingCreatorCard creator={creator} key={creator.id} />
      ))}
    </div>

    <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#0d1727_0%,#0b1019_100%)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6e7e98]">What happens after a creator gets hot?</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Browse by stage, not by raw protocol primitive</h2>
        </div>
        <Link className="rounded-full border border-white/10 px-4 py-2 text-sm text-white" href="/workspace">
          Open workspace
        </Link>
      </div>
    </div>
  </section>
);

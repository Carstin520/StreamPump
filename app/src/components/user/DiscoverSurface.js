"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendingSurface = exports.DiscoverSurface = void 0;
const discover_1 = require("@/lib/mocks/discover");
const PostCard_1 = require("./PostCard");
const TrendingCreatorCard_1 = require("./TrendingCreatorCard");
const UserShell_1 = require("./UserShell");
const UserTopbar_1 = require("./UserTopbar");
const DiscoverSurface = () => (<UserShell_1.UserShell header={<UserTopbar_1.UserTopbar />}>
    <ExploreView />
  </UserShell_1.UserShell>);
exports.DiscoverSurface = DiscoverSurface;
const ExploreView = () => (<div className="space-y-5 py-4">
    <section className="liquid-panel section-enter relative overflow-hidden rounded-[34px] px-5 py-6 md:px-7">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#de402a]/10 blur-3xl"/>
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#92a4bd]">Discover</p>
          <h1 className="mt-3 max-w-3xl text-[38px] font-semibold leading-[1.02] tracking-[-0.06em] text-white md:text-[52px]">
            Scroll less noise. Land on posts that already feel like signal.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#c6d2e3]">
            StreamPump now reads more like an immersive content surface than a debug-heavy prototype. The feed stays visual, while creator stage and market context stay legible.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <TrendStat label="Live buyouts" value="12"/>
          <TrendStat label="S2 campaigns" value="84"/>
          <TrendStat label="Signal score" value="+4.2%"/>
        </div>
      </div>
    </section>

    <section className="sticky top-20 z-20 bg-[#090d14]/76 pb-2 pt-2 backdrop-blur-xl">
      <div className="flex gap-3 overflow-x-auto pb-1 text-sm">
        {discover_1.discoverCategories.map((category) => (<button className={`whitespace-nowrap rounded-full px-4 py-2.5 transition duration-200 ${category === "推荐"
            ? "liquid-pill liquid-pill-active text-white"
            : "liquid-pill text-[#edf2fb] hover:text-white"}`} key={category} type="button">
            {category}
          </button>))}
      </div>
    </section>

    <section className="liquid-panel section-enter flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2 rounded-full bg-[#24151a] px-3 py-1.5">
        <div className="h-2 w-2 rounded-full bg-[#de402a]"/>
        <span className="text-xs font-bold tracking-[0.18em] text-[#ff8a78]">HOT RIGHT NOW</span>
      </div>
      <div className="h-4 w-px bg-white/10"/>
      <div className="flex items-center gap-2 text-sm text-[#c8d4e6]">
        <span className="font-semibold text-white">12 LIVE BUYOUTS</span>
        <span className="text-[#73859f]">·</span>
        <span className="text-[#a2b0c6]">84 S2 ACTIVE</span>
      </div>
    </section>

    <section className="section-enter pb-8">
      <div className="masonry-grid masonry-grid-home">
        {discover_1.posts.map((post) => (<PostCard_1.PostCard key={post.id} post={post}/>))}
      </div>
    </section>
  </div>);
const TrendStat = ({ label, value }) => (<div className="surface-muted rounded-[24px] px-4 py-4">
    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d9eb7]">{label}</p>
    <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-white">{value}</p>
  </div>);
const TrendingSurface = () => (<UserShell_1.UserShell header={<UserTopbar_1.UserTopbar />}>
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
        {discover_1.creators.map((creator) => (<TrendingCreatorCard_1.TrendingCreatorCard creator={creator} key={creator.id}/>))}
      </div>
    </section>
  </UserShell_1.UserShell>);
exports.TrendingSurface = TrendingSurface;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorStageView = void 0;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const mock_data_1 = require("@/lib/mock-data");
const shellCard = "rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,#0e1521_0%,#0a1119_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]";
const CreatorStageView = ({ creator }) => {
    const [activeTab, setActiveTab] = (0, react_1.useState)("作品");
    const creatorPosts = (0, react_1.useMemo)(() => mock_data_1.posts.filter((post) => post.creatorId === creator.id), [creator.id]);
    const metrics = getInvestmentMetrics(creator);
    return (<div className="space-y-6">
      <section className={`${shellCard} px-6 py-10 md:px-10`}>
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-5 h-28 w-28 overflow-hidden rounded-full border-2 border-white/12 shadow-[0_22px_48px_rgba(0,0,0,0.35)]">
            <img alt={creator.name} className="h-full w-full object-cover" src={creator.avatarSrc}/>
          </div>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">{creator.name}</h1>
          <p className="mt-2 text-sm text-[#93a3bc]">
            {creator.handle} · IP属地: {creator.city}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <StageBadge creator={creator}/>
            <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8ca0ba]">
              {creator.level}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-7 text-center">
            <ProfileStat label="关注" value={(0, mock_data_1.compactNumber)(creator.followingCount)}/>
            <div className="h-8 w-px bg-white/8"/>
            <ProfileStat label="粉丝" value={(0, mock_data_1.compactNumber)(creator.followersCount)}/>
            <div className="h-8 w-px bg-white/8"/>
            <ProfileStat label="获赞与收藏" value={(0, mock_data_1.compactNumber)(creator.totalLikesAndSavesCount)}/>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#d2d9e6]">{creator.intro}</p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-full border border-white/12 bg-white/4 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/7" type="button">
              私信
            </button>
            <button className="rounded-full bg-white px-7 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90" type="button">
              + 关注
            </button>
          </div>
        </div>
      </section>

      <section className={`${shellCard} px-6 py-6 md:px-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Investment Profile</h2>
              <StageBadge creator={creator} compact/>
            </div>
            <p className="mt-2 text-sm text-[#93a3bc]">{getInvestmentSubtitle(creator)}</p>
          </div>
          <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90" type="button">
            {getPrimaryActionLabel(creator)}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (<div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4" key={metric.label}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#70809a]">{metric.label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${metric.tone}`}>{metric.value}</p>
              {metric.help ? <p className="mt-1 text-xs text-[#8897ad]">{metric.help}</p> : null}
            </div>))}
        </div>
      </section>

      <section className={`${shellCard} overflow-hidden`}>
        <div className="border-b border-white/8 px-6 pt-5 md:px-8">
          <div className="flex items-center gap-7">
            {["作品", "Investment", "Signals"].map((tab) => (<button className={`relative pb-4 text-sm transition ${activeTab === tab ? "font-semibold text-white" : "text-[#7f90aa] hover:text-white"}`} key={tab} onClick={() => setActiveTab(tab)} type="button">
                {tab}
                {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-white"/> : null}
              </button>))}
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          {activeTab === "作品" ? (<div className="columns-1 gap-4 md:columns-2 xl:columns-4">
              {creatorPosts.map((post) => (<link_1.default className="mb-4 block break-inside-avoid" href={`/posts/${post.id}`} key={post.id}>
                  <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#111a27] transition hover:-translate-y-0.5 hover:border-white/14 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
                    <div className="relative">
                      <img alt={post.title} className={`w-full object-cover ${post.mediaHeightClass}`} src={post.coverSrc}/>
                      {post.type === "VIDEO" ? (<div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
                          ▶ Video
                        </div>) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-medium leading-6 text-white">{post.title}</h3>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img alt={creator.name} className="h-5 w-5 rounded-full object-cover" src={creator.avatarSrc}/>
                          <span className="text-xs text-[#8ea0ba]">{creator.name}</span>
                        </div>
                        <span className="text-xs text-[#8ea0ba]">♡ {(0, mock_data_1.compactNumber)(post.likes)}</span>
                      </div>
                    </div>
                  </div>
                </link_1.default>))}
            </div>) : null}

          {activeTab === "Investment" ? <InvestmentPanels creator={creator}/> : null}

          {activeTab === "Signals" ? <SignalPanels creator={creator}/> : null}
        </div>
      </section>
    </div>);
};
exports.CreatorStageView = CreatorStageView;
const StageBadge = ({ creator, compact = false }) => {
    const label = creator.state === "S1_DISCOVERY" ? "S1" : creator.state === "S1_BUYOUT" ? "S1 Buyout" : "S2";
    const tone = creator.state === "S1_DISCOVERY"
        ? "bg-white/7 text-[#dce6f8] border-white/10"
        : creator.state === "S1_BUYOUT"
            ? "bg-[#271723] text-[#ff9dc3] border-[#ff73b5]/16"
            : "bg-[#132238] text-[#92c7ff] border-[#4b92f4]/18";
    return (<span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone} ${compact ? "" : ""}`}>
      {label}
    </span>);
};
const ProfileStat = ({ label, value }) => (<div className="min-w-[88px]">
    <p className="text-xl font-semibold tracking-[-0.03em] text-white">{value}</p>
    <p className="mt-1 text-xs text-[#8797ae]">{label}</p>
  </div>);
const InvestmentPanels = ({ creator }) => {
    if (creator.state === "S1_DISCOVERY") {
        return (<div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Creator growth curve</h3>
            <span className="text-sm text-[#ffb987]">{creator.graduationProgress}% to graduation</span>
          </div>
          <div className="mt-5 h-60 rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,#0d1520_0%,#0b1016_100%)] p-5">
            <div className="relative h-full overflow-hidden rounded-[18px]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_24%,rgba(255,255,255,0.04)_25%,transparent_26%,transparent_49%,rgba(255,255,255,0.04)_50%,transparent_51%,transparent_74%,rgba(255,255,255,0.04)_75%,transparent_76%)]"/>
              <div className="absolute inset-x-5 bottom-6 h-[2px] bg-white/8"/>
              <div className="absolute left-6 top-6 text-[11px] uppercase tracking-[0.18em] text-[#7687a1]">Bonding curve</div>
              <div className="absolute bottom-6 left-6 h-[2px] w-[74%] origin-left rotate-[-17deg] rounded-full bg-gradient-to-r from-[#ff6d90] via-[#8e7fff] to-[#79b9ff]"/>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard eyebrow="Graduation watch" title={`${creator.graduationProgress}% of graduation target`} body={`Current price is ${(0, mock_data_1.formatUsd)(creator.tokenPrice)} with a graduation target at ${(0, mock_data_1.formatUsd)(creator.targetGraduationPrice)}.`}/>
          <InfoCard eyebrow="Potential buyout sponsors" title="Sponsors currently watching" body={creator.potentialSponsors.join(" · ")}/>
        </div>
      </div>);
    }
    if (creator.state === "S1_BUYOUT") {
        return (<div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <InfoCard eyebrow="Supporter outcome" title={`${(0, mock_data_1.formatUsd)(creator.supporterDistributableUsd ?? 0)} distributable to supporters`} body="The UI should explain supporter payout timing, current window state, and what happens after the rage-quit window closes."/>
        <InfoCard eyebrow="Settlement timeline" title="Buyout is accepted and moving through the final window" body={(creator.buyoutTimeline ?? []).join(" → ")}/>
      </div>);
    }
    return (<div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <InfoCard eyebrow="Content selection pool" title="Open sponsor-ready content directions" body={creator.contentPool.join(" · ")}/>
      <InfoCard eyebrow="Execution state" title={`${creator.activeCampaignCount ?? 0} active campaigns · activity score ${creator.activityScore ?? 0}`} body="This creator is already operating inside S2, so the page should feel like an investment profile plus an operating profile."/>
    </div>);
};
const SignalPanels = ({ creator }) => (<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7385a2]">Top holders</p>
      <div className="mt-4 space-y-3">
        {creator.topHolders.map((holder) => (<div className="flex items-center justify-between rounded-[18px] bg-white/[0.03] px-4 py-3" key={holder.rank}>
            <span className="text-sm text-[#d5ddea]">
              #{holder.rank} · {holder.label}
            </span>
            <span className="text-sm font-medium text-white">{holder.share}</span>
          </div>))}
      </div>
    </div>

    <div className="space-y-4">
      <InfoCard eyebrow="Sponsor fit" title="Likely strategic matches" body={creator.potentialSponsors.join(" · ")}/>
      <InfoCard eyebrow="Stage continuity" title={creator.state === "S2_ACTIVE" ? "Supporters can still understand the move into S2" : "This profile should keep market state legible"} body={creator.teaser}/>
    </div>
  </div>);
const InfoCard = ({ eyebrow, title, body }) => (<div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
    <p className="text-[11px] uppercase tracking-[0.2em] text-[#7385a2]">{eyebrow}</p>
    <h3 className="mt-3 text-xl font-semibold leading-8 tracking-[-0.03em] text-white">{title}</h3>
    <p className="mt-3 text-sm leading-7 text-[#cdd7e7]">{body}</p>
  </div>);
const getPrimaryActionLabel = (creator) => {
    if (creator.state === "S1_DISCOVERY")
        return "Trade S1 Tokens";
    if (creator.state === "S1_BUYOUT")
        return "View Buyout Detail";
    return "Open S2 Content Pool";
};
const getInvestmentSubtitle = (creator) => {
    if (creator.state === "S1_DISCOVERY") {
        return `Invest in ${creator.name}'s discovery momentum and monitor graduation pressure.`;
    }
    if (creator.state === "S1_BUYOUT") {
        return `This creator has entered buyout resolution. Focus the profile on supporter outcome and next-step clarity.`;
    }
    return `This creator has moved into sponsor-backed execution and should read like an operating profile, not just a token page.`;
};
const getInvestmentMetrics = (creator) => {
    if (creator.state === "S1_DISCOVERY") {
        return [
            { label: "Current price", value: (0, mock_data_1.formatUsd)(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
            { label: "Holders", value: (0, mock_data_1.compactNumber)(creator.holderCount), tone: "text-white", help: undefined },
            { label: "Graduation", value: `${creator.graduationProgress}%`, tone: "text-white", help: "distance to graduation" },
            { label: "Target price", value: (0, mock_data_1.formatUsd)(creator.targetGraduationPrice), tone: "text-white", help: undefined },
        ];
    }
    if (creator.state === "S1_BUYOUT") {
        return [
            { label: "Current price", value: (0, mock_data_1.formatUsd)(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
            { label: "Supporter pool", value: (0, mock_data_1.formatUsd)(creator.supporterDistributableUsd ?? 0), tone: "text-white", help: "distributable after close" },
            { label: "Offer value", value: (0, mock_data_1.formatUsd)(creator.buyoutOfferUsd ?? 0), tone: "text-white", help: undefined },
            { label: "Holders", value: (0, mock_data_1.compactNumber)(creator.holderCount), tone: "text-white", help: undefined },
        ];
    }
    return [
        { label: "Current price", value: (0, mock_data_1.formatUsd)(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
        { label: "Active campaigns", value: String(creator.activeCampaignCount ?? 0), tone: "text-white", help: undefined },
        { label: "Activity score", value: String(creator.activityScore ?? 0), tone: "text-white", help: undefined },
        { label: "Valuation", value: (0, mock_data_1.formatUsd)(creator.valuationUsd ?? 0), tone: "text-white", help: undefined },
    ];
};

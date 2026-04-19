import Link from "next/link";
import { useMemo, useState } from "react";

import { FollowCheckIcon, FollowPlusIcon } from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord } from "@/lib/api/types";
import { compactNumber, formatUsd, posts } from "@/lib/public-data";

type ProfileTab = "作品" | "投资档案" | "Signals";

const shellCard =
  "app-shell-frame overflow-hidden border border-white/8 bg-[linear-gradient(180deg,rgba(16,23,34,0.94)_0%,rgba(12,18,28,0.92)_100%)]";

export const CreatorStageView = ({ creator }: { creator: CreatorMarketRecord }) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>("作品");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPulse, setFollowPulse] = useState(false);
  const creatorPosts = useMemo(() => posts.filter((post) => post.creatorId === creator.id), [creator.id]);
  const metrics = getInvestmentMetrics(creator);

  const toggleFollow = () => {
    setIsFollowing((value) => !value);
    setFollowPulse(true);
    window.setTimeout(() => setFollowPulse(false), 340);
  };

  return (
    <div className="space-y-6">
      <section className={shellCard}>
        <div className="relative h-52 overflow-hidden md:h-60">
          <ProgressiveImage
            alt={`${creator.name} banner`}
            className="h-full w-full object-cover"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
            src={creator.heroSrc}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,18,0.18)_0%,rgba(7,11,18,0.52)_48%,rgba(7,11,18,0.96)_100%)]" />
        </div>

        <div className="relative px-6 pb-9 md:px-10">
          <div className="-mt-16 flex flex-col items-center text-center md:-mt-20">
            <div className="h-28 w-28 overflow-hidden rounded-full border-[4px] border-[#09111b] shadow-[0_24px_56px_rgba(0,0,0,0.38)] md:h-32 md:w-32">
              <img alt={creator.name} className="h-full w-full object-cover" src={creator.avatarSrc} />
            </div>

            <h1 className="mt-5 text-[38px] font-semibold tracking-[-0.05em] text-white">{creator.name}</h1>
            <p className="mt-2 text-sm text-[#92a3bc]">
              {creator.handle} · IP属地: {creator.city}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <StagePill stage={creator.state} />
              <span className="liquid-pill rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#dce6f8]">
                {creator.level}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-8 text-center">
              <ProfileStat label="关注" value={compactNumber(creator.followingCount)} />
              <div className="h-8 w-px bg-white/8" />
              <ProfileStat label="粉丝" value={compactNumber(creator.followersCount)} />
              <div className="h-8 w-px bg-white/8" />
              <ProfileStat label="获赞与收藏" value={compactNumber(creator.totalLikesAndSavesCount)} />
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d2d9e6]">{creator.intro}</p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button className="liquid-glass-btn rounded-full px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/10" type="button">
                私信
              </button>
              <button
                className={`rounded-full px-7 py-2.5 text-sm font-semibold transition hover:bg-[#ea523e] ${
                  isFollowing ? "bg-[#13291f] text-[#90efac]" : "bg-[#de402a] text-white"
                } ${followPulse ? "tap-bounce-active" : ""}`}
                onClick={toggleFollow}
                type="button"
              >
                <span className="inline-flex items-center gap-1.5">
                  {isFollowing ? <FollowCheckIcon className="h-4 w-4" /> : <FollowPlusIcon className="h-4 w-4" />}
                  {isFollowing ? "已关注" : "关注"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={`${shellCard} px-6 py-6 md:px-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Investment Profile</h2>
              <StagePill compact stage={creator.state} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#93a3bc]">{getInvestmentSubtitle(creator)}</p>
          </div>
          <button
            className="rounded-full bg-[#de402a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ea523e]"
            type="button"
          >
            {getPrimaryActionLabel(creator)}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div className="glass-card p-4" key={metric.label}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#71819b]">{metric.label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${metric.tone}`}>{metric.value}</p>
              {metric.help ? <p className="mt-1 text-xs text-[#8a99ae]">{metric.help}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className={shellCard}>
        <div className="border-b border-white/8 px-6 pt-5 md:px-8">
          <div className="flex items-center gap-7">
            {(["作品", "投资档案", "Signals"] as ProfileTab[]).map((tab) => (
              <button
                className={`relative pb-4 text-sm transition ${
                  activeTab === tab ? "font-semibold text-white" : "text-[#7f90aa] hover:text-white"
                }`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
                {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-white" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          {activeTab === "作品" ? (
            <div className="masonry-grid">
              {creatorPosts.map((post) => (
                <Link className="block" href={`/posts/${post.id}`} key={post.id}>
                  <div className="glass-card">
                    <div className={`relative overflow-hidden rounded-t-[24px] ${post.mediaHeightClass}`}>
                      <ProgressiveImage
                        alt={post.title}
                        className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        src={post.coverSrc}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/36 to-transparent" />
                      {post.type === "VIDEO" ? (
                        <div className="liquid-pill absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
                          Video
                        </div>
                      ) : null}
                    </div>

                    <div className="glass-card-footer px-4 pb-4 pt-4">
                      <h3 className="line-clamp-2 text-sm font-medium leading-6 text-white">{post.title}</h3>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            alt={creator.name}
                            className="h-5 w-5 rounded-full object-cover"
                            src={creator.avatarSrc}
                          />
                          <span className="text-xs text-[#8ea0ba]">{creator.name}</span>
                        </div>
                        <span className="text-xs text-[#8ea0ba]">♡ {compactNumber(post.likes)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {activeTab === "投资档案" ? <InvestmentPanels creator={creator} /> : null}

          {activeTab === "Signals" ? <SignalPanels creator={creator} /> : null}
        </div>
      </section>
    </div>
  );
};

const ProfileStat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-[92px]">
    <p className="text-xl font-semibold tracking-[-0.03em] text-white">{value}</p>
    <p className="mt-1 text-xs text-[#8797ae]">{label}</p>
  </div>
);

const InvestmentPanels = ({ creator }: { creator: CreatorMarketRecord }) => {
  if (creator.state === "S1_DISCOVERY") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Creator growth curve</h3>
            <span className="text-sm text-[#ffb987]">{creator.graduationProgress}% to graduation</span>
          </div>
          <div className="mt-5 h-60 rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,#0d1520_0%,#0b1016_100%)] p-5">
            <div className="relative h-full overflow-hidden rounded-[18px]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_24%,rgba(255,255,255,0.04)_25%,transparent_26%,transparent_49%,rgba(255,255,255,0.04)_50%,transparent_51%,transparent_74%,rgba(255,255,255,0.04)_75%,transparent_76%)]" />
              <div className="absolute inset-x-5 bottom-6 h-[2px] bg-white/8" />
              <div className="absolute left-6 top-6 text-[11px] uppercase tracking-[0.18em] text-[#7687a1]">Bonding curve</div>
              <div className="absolute bottom-6 left-6 h-[2px] w-[74%] origin-left rotate-[-17deg] rounded-full bg-gradient-to-r from-[#ff6d90] via-[#8e7fff] to-[#79b9ff]" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard
            eyebrow="Graduation watch"
            title={`${creator.graduationProgress}% of graduation target`}
            body={`Current price is ${formatUsd(creator.tokenPrice)} with a graduation target at ${formatUsd(creator.targetGraduationPrice)}.`}
          />
          <InfoCard
            eyebrow="Potential buyout sponsors"
            title="Sponsors currently watching"
            body={creator.potentialSponsors.join(" · ")}
          />
        </div>
      </div>
    );
  }

  if (creator.state === "S1_BUYOUT") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <InfoCard
          eyebrow="Supporter outcome"
          title={`${formatUsd(creator.supporterDistributableUsd ?? 0)} distributable to supporters`}
          body="The profile should explain payout timing, window state, and what supporters receive when settlement closes."
        />
        <InfoCard
          eyebrow="Settlement timeline"
          title="Buyout is accepted and moving through the final window"
          body={(creator.buyoutTimeline ?? []).join(" → ")}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <InfoCard
        eyebrow="Content selection pool"
        title="Open sponsor-ready content directions"
        body={creator.contentPool.join(" · ")}
      />
      <InfoCard
        eyebrow="Execution state"
        title={`${creator.activeCampaignCount ?? 0} active campaigns · activity score ${creator.activityScore ?? 0}`}
        body="This creator has moved into S2 and should read like an operating profile layered on top of a creator profile."
      />
    </div>
  );
};

const SignalPanels = ({ creator }: { creator: CreatorMarketRecord }) => (
  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div className="glass-card p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7385a2]">Top holders</p>
      <div className="mt-4 space-y-3">
        {creator.topHolders.map((holder) => (
          <div className="flex items-center justify-between rounded-[18px] bg-white/[0.03] px-4 py-3" key={holder.rank}>
            <span className="text-sm text-[#d5ddea]">
              #{holder.rank} · {holder.label}
            </span>
            <span className="text-sm font-medium text-white">{holder.share}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <InfoCard
        eyebrow="Sponsor fit"
        title="Likely strategic matches"
        body={creator.potentialSponsors.join(" · ")}
      />
      <InfoCard
        eyebrow="Stage continuity"
        title={creator.state === "S2_ACTIVE" ? "Supporters can still understand the move into S2" : "This profile should keep market state legible"}
        body={creator.teaser}
      />
    </div>
  </div>
);

const InfoCard = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <div className="glass-card p-5">
    <p className="text-[11px] uppercase tracking-[0.2em] text-[#7385a2]">{eyebrow}</p>
    <h3 className="mt-3 text-xl font-semibold leading-8 tracking-[-0.03em] text-white">{title}</h3>
    <p className="mt-3 text-sm leading-7 text-[#cdd7e7]">{body}</p>
  </div>
);

const getPrimaryActionLabel = (creator: CreatorMarketRecord) => {
  if (creator.state === "S1_DISCOVERY") return "Trade S1 Tokens";
  if (creator.state === "S1_BUYOUT") return "View Buyout Detail";
  return "Open S2 Content Pool";
};

const getInvestmentSubtitle = (creator: CreatorMarketRecord) => {
  if (creator.state === "S1_DISCOVERY") {
    return `Invest in ${creator.name}'s discovery momentum and monitor graduation pressure.`;
  }

  if (creator.state === "S1_BUYOUT") {
    return `This creator is inside buyout resolution. Emphasize supporter outcome and what happens next.`;
  }

  return `This creator has moved into sponsor-backed execution and should read like an operating profile, not just a token page.`;
};

const getInvestmentMetrics = (creator: CreatorMarketRecord) => {
  if (creator.state === "S1_DISCOVERY") {
    return [
      { label: "Current price", value: formatUsd(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
      { label: "Holders", value: compactNumber(creator.holderCount), tone: "text-white", help: undefined },
      { label: "Graduation", value: `${creator.graduationProgress}%`, tone: "text-white", help: "distance to graduation" },
      { label: "Target price", value: formatUsd(creator.targetGraduationPrice), tone: "text-white", help: undefined },
    ];
  }

  if (creator.state === "S1_BUYOUT") {
    return [
      { label: "Current price", value: formatUsd(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
      { label: "Supporter pool", value: formatUsd(creator.supporterDistributableUsd ?? 0), tone: "text-white", help: "distributable after close" },
      { label: "Offer value", value: formatUsd(creator.buyoutOfferUsd ?? 0), tone: "text-white", help: undefined },
      { label: "Holders", value: compactNumber(creator.holderCount), tone: "text-white", help: undefined },
    ];
  }

  return [
    { label: "Current price", value: formatUsd(creator.tokenPrice), tone: "text-[#8ed0ff]", help: undefined },
    { label: "Active campaigns", value: String(creator.activeCampaignCount ?? 0), tone: "text-white", help: undefined },
    { label: "Activity score", value: String(creator.activityScore ?? 0), tone: "text-white", help: undefined },
    { label: "Valuation", value: formatUsd(creator.valuationUsd ?? 0), tone: "text-white", help: undefined },
  ];
};

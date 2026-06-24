import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { StagePill } from "@/components/shared/StagePill";
import { CampaignRecord, CreatorMarketRecord, PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { campaigns as mockCampaigns } from "@/lib/mocks/workspace";
import { compactNumber, formatUsd } from "@/lib/public-data";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";

type TrendingTab = "hot" | "s1" | "s2";

const GRADUATION_THRESHOLD = 80;

const DerivedBadge = ({ label }: { label: string }) => (
  <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em] text-[#7486a1]">
    {label}
  </span>
);

export const TrendingTabsView = ({
  creators,
  posts,
  postsByCreator,
}: {
  creators: CreatorMarketRecord[];
  posts: PostRecord[];
  postsByCreator: Map<string, PostRecord[]>;
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TrendingTab>("hot");

  const tabs: { id: TrendingTab; label: string }[] = [
    { id: "hot", label: t("feed.trending.hot") },
    { id: "s1", label: t("feed.trending.s1") },
    { id: "s2", label: t("feed.trending.s2") },
  ];

  const graduationWatchCreators = useMemo(
    () => creators.filter((c) => c.graduationProgress >= GRADUATION_THRESHOLD && c.state !== "S2_ACTIVE"),
    [creators],
  );

  const s2Creators = useMemo(
    () => creators.filter((c) => c.state === "S2_ACTIVE"),
    [creators],
  );

  const s1Creators = useMemo(
    () => creators.filter((c) => c.state === "S1_DISCOVERY" || c.state === "S1_BUYOUT"),
    [creators],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-[#0d1420]/80 p-1 backdrop-blur-lg">
        {tabs.map((tab) => (
          <button
            className={`rounded-full px-4 py-2 text-xs font-medium transition ${
              activeTab === tab.id
                ? "bg-white/[0.1] text-white shadow-[0_0_12px_rgba(255,255,255,0.04)]"
                : "text-[#7f90ab] hover:text-white"
            }`}
            key={tab.id}
            onClick={() => startTransition(() => setActiveTab(tab.id))}
            type="button"
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto pr-2">
          <DerivedBadge label={t("feed.trending.derived")} />
        </div>
      </div>

      {activeTab === "hot" ? (
        <HotTab
          creators={creators}
          graduationWatchCreators={graduationWatchCreators}
          posts={posts}
          postsByCreator={postsByCreator}
        />
      ) : null}

      {activeTab === "s1" ? <S1Tab creators={[...s1Creators, ...graduationWatchCreators.filter((c) => c.state !== "S1_DISCOVERY" && c.state !== "S1_BUYOUT" ? false : true)].filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)} /> : null}

      {activeTab === "s2" ? <S2Tab campaigns={mockCampaigns} s2Creators={s2Creators} /> : null}
    </div>
  );
};

/* ──────────────────────────────  Hot tab  ────────────────────────────── */

const HotTab = ({
  creators,
  graduationWatchCreators,
  posts,
  postsByCreator,
}: {
  creators: CreatorMarketRecord[];
  graduationWatchCreators: CreatorMarketRecord[];
  posts: PostRecord[];
  postsByCreator: Map<string, PostRecord[]>;
}) => {
  const { t } = useI18n();
  const topPosts = posts.slice(0, 6);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">{t("feed.trending.hotCampaigns")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topPosts.map((post, index) => {
            const creator = creators.find((c) => c.id === post.creatorId);
            return (
              <HotPostCard
                creator={creator}
                key={post.id}
                post={post}
                priority={index < 2}
              />
            );
          })}
        </div>
      </section>

      {graduationWatchCreators.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">{t("feed.trending.graduationWatch")}</h2>
            <span className="rounded-full border border-[#de402a]/20 bg-[#de402a]/[0.06] px-2 py-0.5 text-[length:var(--fs-micro)] font-semibold text-[#ff8a78]">
              {graduationWatchCreators.length}
            </span>
          </div>
          <div className="space-y-2">
            {graduationWatchCreators.map((creator) => (
              <GraduationWatchRow creator={creator} key={creator.id} postsByCreator={postsByCreator} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

const HotPostCard = ({
  creator,
  post,
  priority = false,
}: {
  creator?: CreatorMarketRecord;
  post: PostRecord;
  priority?: boolean;
}) => (
  <Link
    className="group block overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#101621] transition hover:border-white/[0.12]"
    href={`/posts/${post.id}`}
  >
    <div className="relative aspect-[16/10] overflow-hidden">
      <ProgressiveImage
        alt={post.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        fill
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        src={post.coverSrc}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_40%,rgba(7,13,21,0.4)_65%,rgba(7,13,21,0.88)_100%)]" />
      <div className="absolute left-2.5 top-2.5 z-[2]">
        <StagePill compact stage={post.stage} />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-3">
        <p className="line-clamp-2 text-[length:var(--fs-caption)] font-semibold leading-5 text-white">{post.title}</p>
        {creator ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[length:var(--fs-micro)] text-[#cbd6e8]">
              <img alt={creator.name} className="h-4 w-4 rounded-full object-cover" src={creator.avatarSrc} />
              <span className="truncate">{creator.name}</span>
            </div>
            {creator.state === "S2_ACTIVE" && creator.activeCampaignCount ? (
              <span className="rounded-full border border-[#65ecaf]/20 bg-[#65ecaf]/[0.06] px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold text-[#8df0c4]">
                {creator.activeCampaignCount} campaign{creator.activeCampaignCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  </Link>
);

const GraduationWatchRow = ({
  creator,
  postsByCreator,
}: {
  creator: CreatorMarketRecord;
  postsByCreator: Map<string, PostRecord[]>;
}) => {
  const liveWallet = resolveCreatorWalletForRoute(creator.id);
  const creatorPosts = postsByCreator.get(creator.id) ?? [];
  const trend = creatorPosts.map((p) => p.likes + p.saves);
  const hasMarketProjection = creator.tokenPrice > 0 && creator.supply > 0;

  return (
    <Link
      className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] px-4 py-3 transition hover:border-white/[0.1]"
      href={liveWallet ? `/market/${liveWallet}` : `/creators/${creator.id}`}
    >
      <img alt={creator.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" src={creator.avatarSrc} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
          <StagePill compact stage={creator.state} />
        </div>
        <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">{creator.handle} · {creator.niche}</p>
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        <div className="text-right">
          <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.12em] text-[#5a6d87]">应援价</p>
          <p className="text-xs font-semibold text-white">{hasMarketProjection ? formatUsd(creator.tokenPrice) : "Pending"}</p>
        </div>
        <div className="w-20">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#de402a] to-[#ff8a78]"
                style={{ width: `${Math.min(100, creator.graduationProgress)}%` }}
              />
            </div>
            <span className="text-[length:var(--fs-micro)] font-semibold text-[#ff8a78]">{hasMarketProjection ? `${creator.graduationProgress}%` : "—"}</span>
          </div>
        </div>
        {trend.length > 1 ? (
          <SparklineChart
            className="shrink-0"
            color="#de402a"
            fillColor="rgba(222,64,42,0.12)"
            height={28}
            points={trend}
            width={60}
          />
        ) : null}
      </div>
    </Link>
  );
};

/* ──────────────────────────────  S1 tab  ────────────────────────────── */

const S1Tab = ({ creators }: { creators: CreatorMarketRecord[] }) => {
  const { t } = useI18n();
  const sorted = useMemo(
    () => [...creators].sort((a, b) => b.tokenPrice - a.tokenPrice),
    [creators],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-6 text-center text-xs text-[#8ea0ba]">
        No S1 creators found from current feed data.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,20,30,0.88)_0%,rgba(10,14,22,0.88)_100%)]">
      <div className="hidden border-b border-white/[0.05] px-4 py-2.5 text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87] lg:grid lg:grid-cols-[2.4fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] lg:items-center lg:gap-3">
        <span>Creator</span>
        <span className="text-right">{t("feed.trending.price")}</span>
        <span className="text-right">{t("feed.trending.volume24h")}</span>
        <span className="text-right">{t("feed.trending.holders")}</span>
        <span>{t("feed.trending.graduation")}</span>
        <span className="text-right">Trend</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {sorted.map((creator) => (
          <S1CreatorRow creator={creator} key={creator.id} />
        ))}
      </div>
    </div>
  );
};

const S1CreatorRow = ({ creator }: { creator: CreatorMarketRecord }) => {
  const liveWallet = resolveCreatorWalletForRoute(creator.id);
  const hasMarketProjection = creator.tokenPrice > 0 && creator.supply > 0;
  const change24h = hasMarketProjection ? Number(((creator.momentumScore - 70) * 0.18).toFixed(2)) : 0;
  const isUp = change24h >= 0;
  const volume24h = hasMarketProjection ? Math.round(creator.supply * creator.tokenPrice * 0.04) : 0;
  const trend = hasMarketProjection
    ? creator.contentPool.map((_, i) => creator.tokenPrice * (0.88 + i * 0.06 + Math.random() * 0.04))
    : [];

  return (
    <Link
      className="grid items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] lg:grid-cols-[2.4fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr]"
      href={liveWallet ? `/market/${liveWallet}` : `/creators/${creator.id}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img alt={creator.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" src={creator.avatarSrc} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{creator.name}</p>
            <StagePill compact stage={creator.state} />
          </div>
          <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">{creator.handle} · {creator.niche}</p>
        </div>
      </div>

      <div className="lg:text-right">
        <p className="text-xs font-semibold text-white">{hasMarketProjection ? formatUsd(creator.tokenPrice) : "Pending"}</p>
        <p className={`text-[length:var(--fs-micro)] ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
          {hasMarketProjection ? `${isUp ? "+" : ""}${change24h.toFixed(2)}%` : "content only"}
        </p>
      </div>

      <div className="hidden lg:block lg:text-right">
        <p className="text-xs text-[#cbd6e7]">{hasMarketProjection ? formatUsd(volume24h) : "—"}</p>
      </div>

      <div className="hidden lg:block lg:text-right">
        <p className="text-xs text-[#cbd6e7]">{hasMarketProjection ? compactNumber(creator.holderCount) : "—"}</p>
      </div>

      <div className="hidden lg:block">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] via-[#ffb38a] to-[#de402a]"
              style={{ width: `${Math.min(100, creator.graduationProgress)}%` }}
            />
          </div>
          <span className="shrink-0 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7]">{hasMarketProjection ? `${creator.graduationProgress}%` : "—"}</span>
        </div>
      </div>

      <div className="hidden justify-end lg:flex">
        {trend.length > 1 ? (
          <SparklineChart
            color={isUp ? "#65ecaf" : "#f67263"}
            fillColor={isUp ? "rgba(101,236,175,0.1)" : "rgba(246,114,99,0.1)"}
            height={28}
            points={trend}
            width={64}
          />
        ) : null}
      </div>
    </Link>
  );
};

/* ──────────────────────────────  S2 tab  ────────────────────────────── */

const S2Tab = ({
  campaigns,
  s2Creators,
}: {
  campaigns: CampaignRecord[];
  s2Creators: CreatorMarketRecord[];
}) => {
  const { t } = useI18n();

  if (campaigns.length === 0 && s2Creators.length === 0) {
    return (
      <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-6 text-center text-xs text-[#8ea0ba]">
        No S2 campaigns found.
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    OPEN: "border-[#67b8ff]/25 bg-[#0e1726]/80 text-[#8ad0ff]",
    FUNDED: "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]",
    RESOLVED_SUCCESS: "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]",
    RESOLVED_FAIL: "border-[#f67263]/25 bg-[#1a1115]/80 text-[#f67263]",
    CANCELLED: "border-white/[0.08] bg-white/[0.03] text-[#7486a1]",
    VOIDED: "border-white/[0.08] bg-white/[0.03] text-[#7486a1]",
  };

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => {
        const totalBudget = campaign.track1BaseUsd + campaign.track2PoolUsd + campaign.track3PoolUsd;
        const matchCreator = s2Creators.find((c) => c.name === campaign.creatorName);

        return (
          <Link
            className="block rounded-[16px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] px-4 py-3.5 transition hover:border-white/[0.12]"
            href={`/campaigns/${campaign.id}`}
            key={campaign.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {matchCreator ? (
                  <img alt={matchCreator.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" src={matchCreator.avatarSrc} />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-bold text-[#65ecaf]">
                    S2
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{campaign.creatorName}</p>
                  <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7e90aa]">
                    {t("feed.trending.sponsor")}: {campaign.sponsorName}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.12em] ${statusColor[campaign.status] ?? statusColor.OPEN}`}>
                {campaign.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CampaignMetric label="Track 1" value={formatUsd(campaign.track1BaseUsd)} />
              <CampaignMetric label="Track 2" value={formatUsd(campaign.track2PoolUsd)} />
              <CampaignMetric label="Track 3" value={formatUsd(campaign.track3PoolUsd)} />
              <CampaignMetric accent label={t("feed.trending.budget")} value={formatUsd(totalBudget)} />
            </div>

            <div className="mt-2.5 flex items-center gap-3 text-[length:var(--fs-micro)] text-[#7e90aa]">
              <span>{t("feed.trending.metric")}: {campaign.metric}</span>
              <span>·</span>
              <span>{campaign.actualValue}</span>
              {campaign.chainTxShort ? (
                <>
                  <span>·</span>
                  <span className="font-mono text-[#67b8ff]">tx: {campaign.chainTxShort}</span>
                </>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const CampaignMetric = ({ accent, label, value }: { accent?: boolean; label: string; value: string }) => (
  <div className="rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
    <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#5a6d87]">{label}</p>
    <p className={`mt-0.5 text-xs font-semibold ${accent ? "text-[#8df0c4]" : "text-white"}`}>{value}</p>
  </div>
);

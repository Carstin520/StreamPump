import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  TrendUpIcon,
} from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { StagePill } from "@/components/shared/StagePill";
import {
  CreatorMarketRecord,
  CurrentUserRecord,
  PortfolioHoldingRecord,
  PostRecord,
  UserNoteRecord,
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import {
  compactNumber,
  creators as mockCreators,
  findCreator,
  formatUsd,
  portfolioClaimWindows,
  portfolioExposureTrend,
  portfolioHoldings,
  portfolioUpcomingClaims,
} from "@/lib/public-data";
import {
  EXPLORE_PATH,
  REWARDS_PATH,
  TRENDING_PATH,
  WORKSPACE_PATH,
} from "@/lib/routes";

const ME_TABS = ["Holdings", "Watchlist", "Rewards", "Activity", "Saved"] as const;
type MeTab = (typeof ME_TABS)[number];

const getMeTabLabelKey = (tab: MeTab) => {
  if (tab === "Holdings") return "profile.tabs.holdings";
  if (tab === "Watchlist") return "profile.tabs.watchlist";
  if (tab === "Rewards") return "profile.tabs.rewards";
  if (tab === "Activity") return "profile.tabs.activity";
  return "profile.tabs.saved";
};

const SPUMP_BALANCE = 18420;
const DAILY_SPUMP_REWARD = 320;
const PENDING_CAMPAIGN_REWARD_USD = 184;

export const MeSurface = ({
  currentUser,
  savedPosts,
  posts,
}: {
  currentUser: CurrentUserRecord;
  savedPosts: UserNoteRecord[];
  posts: PostRecord[];
}) => {
  const [activeTab, setActiveTab] = useState<MeTab>("Holdings");

  const portfolio = useMemo(() => buildPortfolioModel(), []);
  const watchlist = useMemo(() => buildWatchlist(), []);
  const ledger = useMemo(() => buildActivityLedger(), []);

  return (
    <div className="mx-auto max-w-[1280px] space-y-3.5 px-1 py-3">
      <IdentityHero currentUser={currentUser} portfolio={portfolio} />

      <SnapshotStrip portfolio={portfolio} watchlistCount={watchlist.length} />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-3">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "Holdings" ? <HoldingsTable rows={portfolio.holdings} /> : null}
          {activeTab === "Watchlist" ? <WatchlistPanel rows={watchlist} /> : null}
          {activeTab === "Rewards" ? <RewardsPanel portfolio={portfolio} /> : null}
          {activeTab === "Activity" ? <ActivityLedger rows={ledger} /> : null}
          {activeTab === "Saved" ? (
            <SavedContent posts={savedPosts} fallbackPosts={posts} />
          ) : null}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <RewardsSummaryCard portfolio={portfolio} />
          <QuickActionsCard />
        </aside>
      </div>
    </div>
  );
};

/* ──────────────────────────────  Data layer  ────────────────────────────── */

type HoldingViewModel = {
  holding: PortfolioHoldingRecord;
  creator: CreatorMarketRecord;
  marketValueUsd: number;
  costBasisUsd: number;
  pnlUsd: number;
  pnlPct: number;
};

type PortfolioModel = {
  holdings: HoldingViewModel[];
  totalValueUsd: number;
  totalCostUsd: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  change24hPct: number;
  realizedRewardsUsd: number;
  activePositions: number;
  s1HoldingsCount: number;
  s2ExposureUsd: number;
  claimableRewardsUsd: number;
  claimableBuyoutUsd: number;
  pendingCampaignUsd: number;
  spumpBalance: number;
  dailySpumpReward: number;
};

const buildPortfolioModel = (): PortfolioModel => {
  const holdings: HoldingViewModel[] = portfolioHoldings.map((holding) => {
    const creator = findCreator(holding.creatorId);
    const price = holding.currentPriceUsd ?? creator.tokenPrice;
    const marketValueUsd = price * holding.tokenCount;
    const costBasisUsd = holding.avgEntryUsd * holding.tokenCount;
    const pnlUsd = marketValueUsd - costBasisUsd;
    const pnlPct = costBasisUsd > 0 ? (pnlUsd / costBasisUsd) * 100 : 0;
    return { holding, creator, marketValueUsd, costBasisUsd, pnlUsd, pnlPct };
  });

  const totalValueUsd = holdings.reduce((sum, row) => sum + row.marketValueUsd, 0);
  const totalCostUsd = holdings.reduce((sum, row) => sum + row.costBasisUsd, 0);
  const totalPnlUsd = totalValueUsd - totalCostUsd;
  const totalPnlPct = totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0;

  const trend = portfolioExposureTrend.map((point) => point.value);
  const last = trend.at(-1) ?? totalValueUsd;
  const prev = trend.at(-2) ?? last;
  const change24hPct = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  const claimableBuyoutUsd = portfolioClaimWindows.reduce(
    (sum, window) => sum + window.payoutUsd,
    0,
  );
  const realizedRewardsUsd = 412.6;

  const s1HoldingsCount = holdings.filter(
    (row) => row.creator.state === "S1_DISCOVERY" || row.creator.state === "S1_BUYOUT",
  ).length;
  const s2ExposureUsd = holdings
    .filter((row) => row.creator.state === "S2_ACTIVE")
    .reduce((sum, row) => sum + row.marketValueUsd, 0);

  const claimableRewardsUsd = claimableBuyoutUsd + DAILY_SPUMP_REWARD * 0.05;

  return {
    holdings,
    totalValueUsd,
    totalCostUsd,
    totalPnlUsd,
    totalPnlPct,
    change24hPct,
    realizedRewardsUsd,
    activePositions: holdings.length,
    s1HoldingsCount,
    s2ExposureUsd,
    claimableRewardsUsd,
    claimableBuyoutUsd,
    pendingCampaignUsd: PENDING_CAMPAIGN_REWARD_USD,
    spumpBalance: SPUMP_BALANCE,
    dailySpumpReward: DAILY_SPUMP_REWARD,
  };
};

const buildWatchlist = (): CreatorMarketRecord[] => {
  const heldIds = new Set(portfolioHoldings.map((holding) => holding.creatorId));
  return mockCreators
    .filter((creator) => !heldIds.has(creator.id))
    .slice(0, 6);
};

type LedgerEntry = {
  id: string;
  kind: "buy" | "sell" | "claim" | "follow" | "watchlist" | "reward" | "buyout";
  title: string;
  detail: string;
  creatorId?: string;
  amountLabel?: string;
  amountTone?: "positive" | "negative" | "neutral";
  status: string;
  timeLabel: string;
};

const buildActivityLedger = (): LedgerEntry[] => [
  {
    id: "act-1",
    kind: "buy",
    title: "Bought S1 · 弯心入坑",
    detail: "12 S1 @ $3.18 avg",
    creatorId: "luna-cai",
    amountLabel: "−$38.16",
    amountTone: "negative",
    status: "Confirmed",
    timeLabel: "Today · 14:22",
  },
  {
    id: "act-2",
    kind: "claim",
    title: "Claimed Daily SPUMP",
    detail: "Streak day 12",
    amountLabel: "+320 SPUMP",
    amountTone: "positive",
    status: "Confirmed",
    timeLabel: "Today · 09:01",
  },
  {
    id: "act-3",
    kind: "buyout",
    title: "Joined Buyout Watch · 弯心入坑",
    detail: "Sponsor offer $850k · 36h window",
    creatorId: "luna-cai",
    status: "Watching",
    timeLabel: "Yesterday",
  },
  {
    id: "act-4",
    kind: "watchlist",
    title: "Added to Watchlist · 深夜不下线",
    detail: "Cyberpunk · Visual signal",
    creatorId: "neo-park",
    status: "Tracking",
    timeLabel: "Yesterday",
  },
  {
    id: "act-5",
    kind: "reward",
    title: "Claim window opens",
    detail: "弯心入坑 pool",
    creatorId: "luna-cai",
    amountLabel: "$498.96",
    amountTone: "positive",
    status: "Pending",
    timeLabel: "2d ago",
  },
  {
    id: "act-6",
    kind: "buy",
    title: "Bought S1 · 深夜不下线",
    detail: "8 S1 @ $5.74 avg",
    creatorId: "neo-park",
    amountLabel: "−$45.92",
    amountTone: "negative",
    status: "Confirmed",
    timeLabel: "3d ago",
  },
  {
    id: "act-7",
    kind: "follow",
    title: "Followed creator · 胶片落进沙里",
    detail: "Discovery momentum signal",
    creatorId: "mika-zhou",
    status: "Confirmed",
    timeLabel: "5d ago",
  },
  {
    id: "act-8",
    kind: "sell",
    title: "Sold S1 · 胶片落进沙里",
    detail: "20 S1 @ $1.92 avg",
    creatorId: "mika-zhou",
    amountLabel: "+$38.40",
    amountTone: "positive",
    status: "Confirmed",
    timeLabel: "1w ago",
  },
];

/* ──────────────────────────────  Hero  ────────────────────────────── */

const truncateWallet = (wallet: string) => {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
};

const IdentityHero = ({
  currentUser,
  portfolio,
}: {
  currentUser: CurrentUserRecord;
  portfolio: PortfolioModel;
}) => {
  const { t } = useI18n();
  const trend = portfolioExposureTrend.map((point) => point.value);
  const isUp = portfolio.change24hPct >= 0;

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,20,30,0.94)_0%,rgba(9,13,20,0.94)_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-40">
        <ProgressiveImage
          alt=""
          aria-hidden
          className="h-full w-full object-cover blur-2xl"
          fill
          priority
          sizes="1280px"
          src={currentUser.bannerSrc}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,18,0.55)_0%,rgba(7,11,18,1)_100%)]" />
      </div>

      <div className="relative grid gap-4 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
        <div className="flex min-w-0 gap-3 md:gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#0b1119] bg-[#0b1119] shadow-[0_14px_36px_rgba(0,0,0,0.5)] md:h-20 md:w-20">
            <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatarSrc} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-[#7486a1]">
              <RoleBadge tone="investor">{t("profile.badgeInvestor")}</RoleBadge>
              <RoleBadge tone="backer">{t("profile.badgeBacker")}</RoleBadge>
              <RoleBadge tone="sponsor">{t("profile.badgeSponsor")}</RoleBadge>
            </div>
            <h1 className="mt-1.5 truncate text-[22px] font-semibold tracking-[-0.04em] text-white md:text-[26px]">
              {currentUser.name}
            </h1>
            <p className="mt-0.5 truncate text-xs text-[#92a3bc]">
              {currentUser.handle} · {currentUser.location}
            </p>

            <button
              aria-label={t("shell.copyWallet")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-[#bcc8de] transition hover:border-white/[0.12] hover:text-white"
              type="button"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#65ecaf]" />
              {truncateWallet(currentUser.primaryWallet)}
              <CopyIcon className="h-3 w-3 text-[#7486a1]" />
            </button>

            <p className="mt-2 line-clamp-2 max-w-[420px] text-xs leading-5 text-[#bcc8de]">
              {currentUser.bio}
            </p>
          </div>
        </div>

        <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-3.5 md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
                {t("portfolio.totalPortfolioValue")}
              </p>
              <p className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-white md:text-[32px]">
                {formatUsd(portfolio.totalValueUsd)}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isUp ? "bg-[#65ecaf]/[0.12] text-[#8df0c4]" : "bg-[#f67263]/[0.12] text-[#f67263]"
                  }`}
                >
                  {isUp ? (
                    <ArrowUpIcon className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownIcon className="h-2.5 w-2.5" />
                  )}
                  {portfolio.change24hPct.toFixed(2)}%
                </span>
                <span className="text-[#7486a1]">24h</span>
                <span className="text-[#3e4a5e]">·</span>
                <span
                  className={`font-medium ${
                    portfolio.totalPnlUsd >= 0 ? "text-[#8df0c4]" : "text-[#f67263]"
                  }`}
                >
                  {portfolio.totalPnlUsd >= 0 ? "+" : ""}
                  {formatUsd(portfolio.totalPnlUsd)}
                </span>
                <span className="text-[#7486a1]">all-time</span>
              </div>
            </div>

            <SparklineChart
              className="shrink-0"
              color={isUp ? "#65ecaf" : "#f67263"}
              fillColor={isUp ? "rgba(101,236,175,0.14)" : "rgba(246,114,99,0.14)"}
              height={44}
              points={trend}
              width={110}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <HeroStat label="24h PnL" tone={isUp ? "positive" : "negative"} value={`${isUp ? "+" : ""}${portfolio.change24hPct.toFixed(2)}%`} />
            <HeroStat label={t("portfolio.realizedRewards")} value={formatUsd(portfolio.realizedRewardsUsd)} tone="positive" />
            <HeroStat label={t("portfolio.positions")} value={String(portfolio.activePositions)} />
            <HeroStat label={t("portfolio.watchlist")} value="6" />
          </div>
        </div>
      </div>
    </section>
  );
};

const RoleBadge = ({
  children,
  tone,
}: {
  children: string;
  tone: "investor" | "backer" | "sponsor";
}) => {
  const palette = {
    investor: "border-[#67b8ff]/25 bg-[#0e1726]/80 text-[#8ad0ff]",
    backer: "border-[#de402a]/25 bg-[#1f120e]/80 text-[#ff8a78]",
    sponsor: "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${palette[tone]}`}
    >
      {children}
    </span>
  );
};

const HeroStat = ({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) => (
  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#6f8099]">{label}</p>
    <p
      className={`mt-0.5 text-sm font-semibold tracking-[-0.02em] ${
        tone === "positive"
          ? "text-[#8df0c4]"
          : tone === "negative"
            ? "text-[#f67263]"
            : "text-white"
      }`}
    >
      {value}
    </p>
  </div>
);

/* ──────────────────────────────  Snapshot strip  ────────────────────────────── */

const SnapshotStrip = ({
  portfolio,
  watchlistCount,
}: {
  portfolio: PortfolioModel;
  watchlistCount: number;
}) => {
  const { t } = useI18n();

  return (
  <section className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
    <SnapshotTile
      accent="#67b8ff"
      hint={`${portfolio.holdings.filter((h) => h.creator.state === "S1_DISCOVERY").length} discovery · ${portfolio.holdings.filter((h) => h.creator.state === "S1_BUYOUT").length} buyout`}
      label={t("portfolio.s1Holdings")}
      value={String(portfolio.s1HoldingsCount)}
    />
    <SnapshotTile
      accent="#65ecaf"
      hint={t("workspace.activeCampaigns")}
      label={t("portfolio.s2Exposure")}
      value={portfolio.s2ExposureUsd > 0 ? formatUsd(portfolio.s2ExposureUsd) : "—"}
    />
    <SnapshotTile
      accent="#ffb38a"
      hint={`${portfolioClaimWindows.length} ready · ${portfolioUpcomingClaims.length} pending`}
      label={t("portfolio.claimableRewards")}
      tone="positive"
      value={formatUsd(portfolio.claimableRewardsUsd)}
    />
    <SnapshotTile
      accent="#de402a"
      hint={portfolio.claimableBuyoutUsd > 0 ? "Window approaching" : "No active windows"}
      label={t("portfolio.buyoutClaims")}
      tone={portfolio.claimableBuyoutUsd > 0 ? "positive" : "neutral"}
      value={portfolio.claimableBuyoutUsd > 0 ? formatUsd(portfolio.claimableBuyoutUsd) : "—"}
    />
    <SnapshotTile
      accent="#8ad0ff"
      hint={`+${portfolio.dailySpumpReward}/day streak`}
      label="SPUMP"
      value={compactNumber(portfolio.spumpBalance)}
    />
  </section>
  );
};

const SnapshotTile = ({
  accent,
  hint,
  label,
  tone = "neutral",
  value,
}: {
  accent: string;
  hint: string;
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) => (
  <div className="rounded-xl border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-3 py-2.5">
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    </div>
    <p
      className={`mt-1 text-base font-semibold tracking-[-0.03em] ${
        tone === "positive"
          ? "text-[#8df0c4]"
          : tone === "negative"
            ? "text-[#f67263]"
            : "text-white"
      }`}
    >
      {value}
    </p>
    <p className="mt-0.5 truncate text-[10px] text-[#6f8099]">{hint}</p>
  </div>
);

/* ──────────────────────────────  Tab bar  ────────────────────────────── */

const TabBar = ({
  activeTab,
  onChange,
}: {
  activeTab: MeTab;
  onChange: (tab: MeTab) => void;
}) => {
  const { t } = useI18n();

  return (
  <div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/[0.06]">
    {ME_TABS.map((tab) => (
      <button
        className={`relative whitespace-nowrap px-3 py-2.5 text-xs transition ${
          activeTab === tab ? "font-semibold text-white" : "text-[#7f90aa] hover:text-white"
        }`}
        key={tab}
        onClick={() => onChange(tab)}
        type="button"
      >
        {t(getMeTabLabelKey(tab))}
        {activeTab === tab ? (
          <span className="absolute inset-x-2.5 bottom-[-1px] h-[2px] rounded-full bg-[#de402a]" />
        ) : null}
      </button>
    ))}
  </div>
  );
};

/* ──────────────────────────────  Holdings  ────────────────────────────── */

const HoldingsTable = ({ rows }: { rows: HoldingViewModel[] }) => {
  const { t } = useI18n();

  if (rows.length === 0) {
    return <EmptyState title={t("portfolio.noHoldings")} cta={t("portfolio.browseTrending")} href={TRENDING_PATH} />;
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
      <div className="hidden border-b border-white/[0.04] px-3.5 py-2 text-[9px] font-medium uppercase tracking-[0.18em] text-[#6f8099] lg:grid lg:grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr_auto] lg:items-center lg:gap-3">
        <span>{t("common.creator")}</span>
        <span className="text-right">{t("portfolio.price")}</span>
        <span className="text-right">{t("portfolio.holding")}</span>
        <span className="text-right">{t("portfolio.avgCost")}</span>
        <span className="text-right">{t("portfolio.pnL")}</span>
        <span>{t("portfolio.graduation")}</span>
        <span className="w-[160px]">{t("portfolio.actions")}</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {rows.map((row) => (
          <HoldingRow key={row.holding.creatorId} row={row} />
        ))}
      </div>
    </div>
  );
};

const HoldingRow = ({ row }: { row: HoldingViewModel }) => {
  const { t } = useI18n();
  const { creator, holding, marketValueUsd, pnlUsd, pnlPct } = row;
  const isUp = pnlUsd >= 0;

  return (
    <div className="grid items-center gap-2.5 px-3.5 py-2.5 lg:grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr_auto] lg:gap-3">
      <Link className="flex min-w-0 items-center gap-2.5" href={`/creators/${creator.id}`}>
        <img alt={creator.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" src={creator.avatarSrc} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-white">{creator.name}</p>
            <StagePill compact stage={creator.state} />
          </div>
          <p className="mt-0.5 truncate text-[10px] text-[#7e90aa]">
            {creator.handle} · {compactNumber(creator.holderCount)} hol…
          </p>
        </div>
      </Link>

      <div className="lg:text-right">
        <MobileMetricLabel>{t("portfolio.price")}</MobileMetricLabel>
        <p className="text-xs font-semibold text-white">{formatUsd(holding.currentPriceUsd ?? creator.tokenPrice)}</p>
        <p className="text-[9px] text-[#7e90aa]">SPUMP {Math.round((holding.currentPriceUsd ?? creator.tokenPrice) * 40)}</p>
      </div>

      <div className="lg:text-right">
        <MobileMetricLabel>{t("portfolio.holding")}</MobileMetricLabel>
        <p className="text-xs font-semibold text-white">{holding.tokenCount} S1</p>
        <p className="text-[9px] text-[#7e90aa]">{formatUsd(marketValueUsd)}</p>
      </div>

      <div className="lg:text-right">
        <MobileMetricLabel>{t("portfolio.avgCost")}</MobileMetricLabel>
        <p className="text-xs text-[#cbd6e7]">{formatUsd(holding.avgEntryUsd)}</p>
      </div>

      <div className="lg:text-right">
        <MobileMetricLabel>{t("portfolio.pnL")}</MobileMetricLabel>
        <p className={`text-xs font-semibold ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
          {isUp ? "+" : ""}
          {formatUsd(pnlUsd)}
        </p>
        <p className={`text-[9px] ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
          {isUp ? "+" : ""}
          {pnlPct.toFixed(2)}%
        </p>
      </div>

      <div>
        <MobileMetricLabel>{t("portfolio.graduation")}</MobileMetricLabel>
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#de402a] to-[#ff8a78]"
              style={{ width: `${Math.min(100, creator.graduationProgress)}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] font-medium text-[#cbd6e7]">{creator.graduationProgress}%</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <RowAction disabled={creator.state !== "S1_DISCOVERY"} kind="primary">
          {creator.state === "S1_BUYOUT" ? t("portfolio.locked") : t("portfolio.buy")}
        </RowAction>
        <RowAction disabled={creator.state !== "S1_DISCOVERY"} kind="ghost">
          {t("portfolio.sell")}
        </RowAction>
        <Link
          className="flex h-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] px-2 text-[10px] text-[#9aabc4] transition hover:border-white/[0.12] hover:text-white"
          href={`/creators/${creator.id}`}
        >
          {t("portfolio.view")}
        </Link>
      </div>
    </div>
  );
};

const MobileMetricLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-[10px] uppercase tracking-[0.16em] text-[#6f8099] lg:hidden">
    {children}
  </span>
);

const RowAction = ({
  children,
  disabled = false,
  kind,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  kind: "primary" | "ghost";
}) => {
  const base =
    "flex h-7 items-center justify-center rounded-md px-2 text-[10px] font-semibold transition";
  if (disabled) {
    return (
      <span className={`${base} cursor-not-allowed border border-white/[0.05] bg-white/[0.02] text-[#5a6b82]`}>
        {children}
      </span>
    );
  }
  if (kind === "primary") {
    return (
      <button
        className={`${base} bg-[#de402a] text-white hover:bg-[#ea523e]`}
        type="button"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      className={`${base} border border-white/[0.06] bg-white/[0.02] text-[#cbd6e7] hover:border-white/[0.12] hover:text-white`}
      type="button"
    >
      {children}
    </button>
  );
};

/* ──────────────────────────────  Watchlist  ────────────────────────────── */

const WatchlistPanel = ({ rows }: { rows: CreatorMarketRecord[] }) => {
  const { t } = useI18n();

  if (rows.length === 0) {
    return <EmptyState title={t("portfolio.noWatchlist")} cta={t("portfolio.discoverCreators")} href={EXPLORE_PATH} />;
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
      <div className="hidden border-b border-white/[0.04] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099] lg:grid lg:grid-cols-[2.2fr_0.8fr_0.8fr_1.4fr_auto] lg:items-center lg:gap-4">
        <span>{t("common.creator")}</span>
        <span className="text-right">{t("portfolio.price")}</span>
        <span className="text-right">{t("portfolio.momentum")}</span>
        <span>{t("portfolio.latestSignal")}</span>
        <span className="w-[180px]">{t("portfolio.action")}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((creator) => {
          const change24hPct = Number(((creator.momentumScore - 70) * 0.18).toFixed(2));
          const isUp = change24hPct >= 0;
          return (
            <div
              className="grid items-center gap-3 px-4 py-3.5 lg:grid-cols-[2.2fr_0.8fr_0.8fr_1.4fr_auto] lg:gap-4"
              key={creator.id}
            >
              <Link className="flex min-w-0 items-center gap-3" href={`/creators/${creator.id}`}>
                <img alt={creator.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" src={creator.avatarSrc} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                    <StagePill compact stage={creator.state} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#7e90aa]">
                    {creator.handle} · {creator.niche}
                  </p>
                </div>
              </Link>

              <div className="lg:text-right">
                <MobileMetricLabel>{t("portfolio.price")}</MobileMetricLabel>
                <p className="text-sm font-semibold text-white">{formatUsd(creator.tokenPrice)}</p>
                <p
                  className={`text-[10px] ${
                    isUp ? "text-[#8df0c4]" : "text-[#f67263]"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {change24hPct.toFixed(2)}% 24h
                </p>
              </div>

              <div className="lg:text-right">
                <MobileMetricLabel>{t("portfolio.momentum")}</MobileMetricLabel>
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] via-[#ffb38a] to-[#de402a]"
                      style={{ width: `${Math.min(100, creator.momentumScore)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-[#cbd6e7]">{creator.momentumScore}</span>
                </div>
              </div>

              <div className="min-w-0">
                <MobileMetricLabel>{t("portfolio.latestSignal")}</MobileMetricLabel>
                <p className="line-clamp-1 text-[12px] text-[#cbd6e7]">{creator.teaser}</p>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <RowAction disabled={creator.state !== "S1_DISCOVERY"} kind="primary">
                  {t("portfolio.addPosition")}
                </RowAction>
                <Link
                  className="flex h-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 text-[11px] text-[#9aabc4] transition hover:border-white/[0.12] hover:text-white"
                  href={`/market/${creator.id}`}
                >
                  {t("portfolio.market")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ──────────────────────────────  Rewards  ────────────────────────────── */

const RewardsPanel = ({ portfolio }: { portfolio: PortfolioModel }) => (
  <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-2">
      <RewardItem
        accent="#65ecaf"
        amount={`${compactNumber(portfolio.dailySpumpReward)} SPUMP`}
        cta="Preview Claim"
        ctaTone="primary"
        label="Daily Engagement"
        status="Ready"
      />
      <RewardItem
        accent="#ffb38a"
        amount={formatUsd(portfolio.claimableBuyoutUsd)}
        cta="Preview Claim"
        ctaTone="primary"
        label="Buyout Pool"
        status="2d 0h window"
      />
      <RewardItem
        accent="#67b8ff"
        amount={formatUsd(portfolio.pendingCampaignUsd)}
        cta="View campaign"
        ctaTone="ghost"
        label="Pending Campaign"
        status="Pending settlement"
      />
      <RewardItem
        accent="#de402a"
        amount={formatUsd(portfolio.realizedRewardsUsd)}
        cta="Receipt"
        ctaTone="ghost"
        label="Realized Rewards"
        status="Lifetime"
      />
    </div>

    <div className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)] p-3.5 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
            Total claimable
          </p>
          <p className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-white">
            {formatUsd(portfolio.claimableRewardsUsd + portfolio.pendingCampaignUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-[#7486a1]">
            3 rewards ready · 1 pending settlement
          </p>
        </div>
        <button
          className="rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_rgba(222,64,42,0.32)] hover:brightness-[1.05]"
          type="button"
        >
          Preview Claim All
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-[#5a6b82]">
        Demo flow · on-chain claim lands in next release
      </p>
    </div>
  </div>
);

const RewardItem = ({
  accent,
  amount,
  cta,
  ctaTone,
  label,
  status,
}: {
  accent: string;
  amount: string;
  cta: string;
  ctaTone: "primary" | "ghost";
  label: string;
  status: string;
}) => (
  <div className="flex items-center justify-between gap-2.5 rounded-[14px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)] px-3 py-2.5">
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#6f8099]">{label}</p>
      </div>
      <p className="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-white">{amount}</p>
      <p className="mt-0.5 text-[10px] text-[#7486a1]">{status}</p>
    </div>
    <button
      className={
        ctaTone === "primary"
          ? "shrink-0 rounded-full bg-[#de402a] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#ea523e]"
          : "shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[11px] font-medium text-[#cbd6e7] hover:border-white/[0.12] hover:text-white"
      }
      type="button"
    >
      {cta}
    </button>
  </div>
);

/* ──────────────────────────────  Activity ledger  ────────────────────────────── */

const KIND_META: Record<
  LedgerEntry["kind"],
  { label: string; tone: "buy" | "sell" | "claim" | "neutral" | "watch" }
> = {
  buy: { label: "BUY", tone: "buy" },
  sell: { label: "SELL", tone: "sell" },
  claim: { label: "CLAIM", tone: "claim" },
  follow: { label: "FOLLOW", tone: "neutral" },
  watchlist: { label: "WATCH", tone: "watch" },
  reward: { label: "REWARD", tone: "claim" },
  buyout: { label: "BUYOUT", tone: "watch" },
};

const KIND_TONE_CLASS: Record<"buy" | "sell" | "claim" | "neutral" | "watch", string> = {
  buy: "border-[#67b8ff]/25 bg-[#0e1726]/80 text-[#8ad0ff]",
  sell: "border-[#f67263]/25 bg-[#1a1115]/80 text-[#f67263]",
  claim: "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]",
  watch: "border-[#de402a]/25 bg-[#1f120e]/80 text-[#ff8a78]",
  neutral: "border-white/[0.08] bg-white/[0.03] text-[#cbd6e7]",
};

const ActivityLedger = ({ rows }: { rows: LedgerEntry[] }) => (
  <div className="overflow-hidden rounded-[20px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
    <div className="divide-y divide-white/[0.04]">
      {rows.map((entry) => {
        const meta = KIND_META[entry.kind];
        const creator = entry.creatorId ? findCreator(entry.creatorId) : null;

        return (
          <div
            className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
            key={entry.id}
          >
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] ${KIND_TONE_CLASS[meta.tone]}`}
            >
              {meta.label}
            </span>

            {creator ? (
              <img
                alt={creator.name}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
                src={creator.avatarSrc}
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-[#7486a1]">
                <TrendUpIcon className="h-3.5 w-3.5" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{entry.title}</p>
              <p className="truncate text-[11px] text-[#7486a1]">{entry.detail}</p>
            </div>

            <div className="hidden text-right md:block">
              {entry.amountLabel ? (
                <p
                  className={`text-sm font-semibold ${
                    entry.amountTone === "positive"
                      ? "text-[#8df0c4]"
                      : entry.amountTone === "negative"
                        ? "text-[#f67263]"
                        : "text-white"
                  }`}
                >
                  {entry.amountLabel}
                </p>
              ) : null}
              <p className="text-[11px] text-[#7486a1]">{entry.status}</p>
            </div>

            <span className="shrink-0 font-mono text-[11px] text-[#5a6b82]">
              {entry.timeLabel}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

/* ──────────────────────────────  Saved (secondary)  ────────────────────────────── */

const SavedContent = ({
  posts: postRecords,
  fallbackPosts,
}: {
  posts: UserNoteRecord[];
  fallbackPosts: PostRecord[];
}) => {
  const items = postRecords.length > 0 ? postRecords : [];
  if (items.length === 0 && fallbackPosts.length === 0) {
    return (
      <EmptyState
        cta="Browse explore"
        href={EXPLORE_PATH}
        title="No saved content yet"
      />
    );
  }

  const records = items.length > 0 ? items : fallbackPosts.slice(0, 6).map((post) => ({
    id: `saved-fallback-${post.id}`,
    sourcePostId: post.id,
    title: post.title,
    coverSrc: post.coverSrc,
    likes: post.likes,
    stage: post.stage,
    authorName: post.creatorName,
    authorAvatarSrc: post.creatorAvatarSrc,
    mediaHeightClass: "h-[260px]",
  } satisfies UserNoteRecord));

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {records.map((record) => (
        <Link
          className="group block overflow-hidden rounded-[16px] border border-white/[0.05] bg-[#0d131e] transition hover:border-white/[0.1]"
          href={`/posts/${record.sourcePostId ?? record.id.replace(/^saved-/, "")}`}
          key={record.id}
        >
          <div className="relative aspect-[4/5] overflow-hidden">
            <ProgressiveImage
              alt={record.title}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              src={record.coverSrc}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(7,11,18,0.75)_100%)]" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-[11px] text-white">
              <span className="truncate font-medium">{record.title}</span>
              <span className="ml-2 shrink-0 text-[#cbd6e8]">♡ {compactNumber(record.likes)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-[#8ea0ba]">
            <div className="flex min-w-0 items-center gap-1.5">
              <img alt={record.authorName} className="h-4 w-4 rounded-full object-cover" src={record.authorAvatarSrc} />
              <span className="truncate">{record.authorName}</span>
            </div>
            <StagePill compact stage={record.stage} />
          </div>
        </Link>
      ))}
    </div>
  );
};

/* ──────────────────────────────  Right rail  ────────────────────────────── */

const RewardsSummaryCard = ({ portfolio }: { portfolio: PortfolioModel }) => {
  const { t } = useI18n();

  return (
  <section className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
    <header className="border-b border-white/[0.05] px-3.5 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
        {t("portfolio.claimCenter")}
      </p>
      <p className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-white">
        {formatUsd(portfolio.claimableRewardsUsd + portfolio.pendingCampaignUsd)}
      </p>
      <p className="mt-0.5 text-[10px] text-[#7486a1]">3 rewards ready · 1 pending</p>
    </header>

    <div className="space-y-0.5 px-1.5 py-1.5">
      <RailRow accent="#65ecaf" label={t("portfolio.dailySpump")} sub="Streak 12d" value={`+${portfolio.dailySpumpReward}`} />
      <RailRow accent="#ffb38a" label={t("portfolio.buyoutPool")} sub="弯心入坑" value={formatUsd(portfolio.claimableBuyoutUsd)} />
      <RailRow accent="#67b8ff" label={t("portfolio.campaign")} sub="Pending" value={formatUsd(portfolio.pendingCampaignUsd)} />
    </div>

    <div className="border-t border-white/[0.05] p-2.5">
      <button
        className="w-full rounded-lg bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] py-2 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(222,64,42,0.28)] hover:brightness-[1.05]"
        type="button"
      >
        {t("portfolio.claimAll")}
      </button>
      <p className="mt-1.5 text-center text-[9px] text-[#5a6b82]">{t("portfolio.demoComingSoon")}</p>
    </div>
  </section>
  );
};

const RailRow = ({
  accent,
  label,
  sub,
  value,
}: {
  accent: string;
  label: string;
  sub: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]">
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-white">{label}</p>
        <p className="truncate text-[9px] text-[#7486a1]">{sub}</p>
      </div>
    </div>
    <p className="shrink-0 text-[11px] font-semibold text-white">{value}</p>
  </div>
);

const QuickActionsCard = () => {
  const { t } = useI18n();

  return (
  <section className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
    <header className="border-b border-white/[0.05] px-3.5 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
        {t("portfolio.quickActions")}
      </p>
    </header>
    <div className="grid grid-cols-2 gap-1.5 p-2.5">
      <QuickAction href={EXPLORE_PATH} label={t("nav.explore")} />
      <QuickAction href={TRENDING_PATH} label={t("nav.trending")} />
      <QuickAction href={REWARDS_PATH} label={t("nav.rewards")} />
      <QuickAction href={WORKSPACE_PATH} label={t("nav.creatorStudio")} />
    </div>
  </section>
  );
};

const QuickAction = ({ href, label }: { href: string; label: string }) => (
  <Link
    className="flex items-center justify-center rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-[11px] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white"
    href={href}
  >
    {label}
  </Link>
);

/* ──────────────────────────────  Empty  ────────────────────────────── */

const EmptyState = ({
  cta,
  href,
  title,
}: {
  cta: string;
  href: string;
  title: string;
}) => {
  const { t } = useI18n();

  return (
  <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-6 py-10 text-center">
    <p className="text-sm font-medium text-white">{title}</p>
    <p className="mt-1 text-xs text-[#7486a1]">{t("portfolio.demoStartHere")}</p>
    <Link
      className="mt-4 inline-flex rounded-full bg-[#de402a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ea523e]"
      href={href}
    >
      {cta}
    </Link>
  </div>
  );
};

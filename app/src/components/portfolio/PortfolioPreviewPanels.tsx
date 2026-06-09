import Link from "next/link";
import { useMemo } from "react";

import { SparklineChart } from "@/components/shared/SparklineChart";
import { StagePill } from "@/components/shared/StagePill";
import { CreatorMarketRecord, PortfolioHoldingRecord } from "@/lib/api/types";
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
import { EXPLORE_PATH, TRENDING_PATH } from "@/lib/routes";
import { resolveCreatorWalletForRoute } from "@/lib/s1-market-view";

const SPUMP_BALANCE = 18420;
const DAILY_SPUMP_REWARD = 320;
const PENDING_CAMPAIGN_REWARD_USD = 184;

type HoldingViewModel = {
  holding: PortfolioHoldingRecord;
  creator: CreatorMarketRecord;
  marketValueUsd: number;
  costBasisUsd: number;
  pnlUsd: number;
  pnlPct: number;
};

export type PreviewPortfolioModel = {
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

export const usePreviewPortfolio = (): PreviewPortfolioModel => useMemo(() => {
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

  const claimableBuyoutUsd = portfolioClaimWindows.reduce((sum, w) => sum + w.payoutUsd, 0);

  const s1HoldingsCount = holdings.filter(
    (row) => row.creator.state === "S1_DISCOVERY" || row.creator.state === "S1_BUYOUT",
  ).length;
  const s2ExposureUsd = holdings
    .filter((row) => row.creator.state === "S2_ACTIVE")
    .reduce((sum, row) => sum + row.marketValueUsd, 0);

  return {
    holdings,
    totalValueUsd,
    totalCostUsd,
    totalPnlUsd,
    totalPnlPct,
    change24hPct,
    realizedRewardsUsd: 412.6,
    activePositions: holdings.length,
    s1HoldingsCount,
    s2ExposureUsd,
    claimableRewardsUsd: claimableBuyoutUsd + DAILY_SPUMP_REWARD * 0.05,
    claimableBuyoutUsd,
    pendingCampaignUsd: PENDING_CAMPAIGN_REWARD_USD,
    spumpBalance: SPUMP_BALANCE,
    dailySpumpReward: DAILY_SPUMP_REWARD,
  };
}, []);

/* ──────────────────────────────  Snapshot strip  ────────────────────────────── */

export const PreviewSnapshotStrip = ({ portfolio }: { portfolio: PreviewPortfolioModel }) => (
  <section className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
    <SnapshotTile accent="#67b8ff" hint={`${portfolio.holdings.filter((h) => h.creator.state === "S1_DISCOVERY").length} discovery · ${portfolio.holdings.filter((h) => h.creator.state === "S1_BUYOUT").length} buyout`} label="Preview S1 Holdings" value={String(portfolio.s1HoldingsCount)} />
    <SnapshotTile accent="#65ecaf" hint="Active campaigns" label="Preview S2 Exposure" value={portfolio.s2ExposureUsd > 0 ? formatUsd(portfolio.s2ExposureUsd) : "—"} />
    <SnapshotTile accent="#ffb38a" hint={`${portfolioClaimWindows.length} ready · ${portfolioUpcomingClaims.length} pending`} label="Preview Claimable" tone="positive" value={formatUsd(portfolio.claimableRewardsUsd)} />
    <SnapshotTile accent="#de402a" hint={portfolio.claimableBuyoutUsd > 0 ? "Window approaching" : "No active windows"} label="Preview Buyout Claims" tone={portfolio.claimableBuyoutUsd > 0 ? "positive" : "neutral"} value={portfolio.claimableBuyoutUsd > 0 ? formatUsd(portfolio.claimableBuyoutUsd) : "—"} />
    <SnapshotTile accent="#8ad0ff" hint={`+${portfolio.dailySpumpReward}/day streak`} label="Preview SPUMP" value={compactNumber(portfolio.spumpBalance)} />
  </section>
);

const SnapshotTile = ({ accent, hint, label, tone = "neutral", value }: { accent: string; hint: string; label: string; tone?: "neutral" | "positive" | "negative"; value: string }) => (
  <div className="rounded-xl border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-3 py-2.5">
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    </div>
    <p className={`mt-1 text-base font-semibold tracking-[-0.03em] ${tone === "positive" ? "text-[#8df0c4]" : tone === "negative" ? "text-[#f67263]" : "text-white"}`}>{value}</p>
    <p className="mt-0.5 truncate text-[10px] text-[#6f8099]">{hint}</p>
  </div>
);

/* ──────────────────────────────  Portfolio value hero  ────────────────────────────── */

export const PreviewPortfolioHero = ({ portfolio }: { portfolio: PreviewPortfolioModel }) => {
  const trend = portfolioExposureTrend.map((point) => point.value);
  const isUp = portfolio.change24hPct >= 0;

  return (
    <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.02] p-3.5 md:p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f3c66e]">Preview</span>
        <span className="text-[10px] text-[#6f8099]">Mock portfolio from fixture data</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Preview Portfolio Value</p>
          <p className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-white md:text-[32px]">{formatUsd(portfolio.totalValueUsd)}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isUp ? "bg-[#65ecaf]/[0.12] text-[#8df0c4]" : "bg-[#f67263]/[0.12] text-[#f67263]"}`}>
              {isUp ? "↑" : "↓"} {portfolio.change24hPct.toFixed(2)}%
            </span>
            <span className="text-[#7486a1]">24h</span>
            <span className="text-[#3e4a5e]">·</span>
            <span className={`font-medium ${portfolio.totalPnlUsd >= 0 ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
              {portfolio.totalPnlUsd >= 0 ? "+" : ""}{formatUsd(portfolio.totalPnlUsd)}
            </span>
            <span className="text-[#7486a1]">all-time</span>
          </div>
        </div>
        <SparklineChart className="shrink-0" color={isUp ? "#65ecaf" : "#f67263"} fillColor={isUp ? "rgba(101,236,175,0.14)" : "rgba(246,114,99,0.14)"} height={44} points={trend} width={110} />
      </div>
    </div>
  );
};

/* ──────────────────────────────  Preview Holdings  ────────────────────────────── */

export const PreviewHoldingsTable = ({ rows }: { rows: HoldingViewModel[] }) => {
  if (rows.length === 0) {
    return <EmptyState title="No preview holdings" cta="Browse Trending" href={TRENDING_PATH} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f3c66e]">Preview</span>
        <span className="text-[10px] text-[#6f8099]">Mock fixture data — not from chain</span>
      </div>
      <div className="overflow-hidden rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
        <div className="hidden border-b border-white/[0.04] px-3.5 py-2 text-[9px] font-medium uppercase tracking-[0.18em] text-[#6f8099] lg:grid lg:grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] lg:items-center lg:gap-3">
          <span>Creator</span>
          <span className="text-right">Price</span>
          <span className="text-right">Holding</span>
          <span className="text-right">Avg cost</span>
          <span className="text-right">PnL</span>
          <span>Graduation</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {rows.map((row) => {
            const { creator, holding, marketValueUsd, pnlUsd, pnlPct } = row;
            const isUp = pnlUsd >= 0;
            const liveWallet = resolveCreatorWalletForRoute(creator.id);

            return (
              <Link
                className="grid items-center gap-2.5 px-3.5 py-2.5 transition hover:bg-white/[0.02] lg:grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] lg:gap-3"
                href={liveWallet ? `/market/${liveWallet}` : `/creators/${creator.id}`}
                key={holding.creatorId}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <img alt={creator.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" src={creator.avatarSrc} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-white">{creator.name}</p>
                      <StagePill compact stage={creator.state} />
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[#7e90aa]">{creator.handle} · {compactNumber(creator.holderCount)} holders</p>
                  </div>
                </div>
                <div className="lg:text-right">
                  <p className="text-xs font-semibold text-white">{formatUsd(holding.currentPriceUsd ?? creator.tokenPrice)}</p>
                </div>
                <div className="lg:text-right">
                  <p className="text-xs font-semibold text-white">{holding.tokenCount} S1</p>
                  <p className="text-[9px] text-[#7e90aa]">{formatUsd(marketValueUsd)}</p>
                </div>
                <div className="hidden lg:block lg:text-right">
                  <p className="text-xs text-[#cbd6e7]">{formatUsd(holding.avgEntryUsd)}</p>
                </div>
                <div className="hidden lg:block lg:text-right">
                  <p className={`text-xs font-semibold ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
                    {isUp ? "+" : ""}{formatUsd(pnlUsd)}
                  </p>
                  <p className={`text-[9px] ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>
                    {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
                  </p>
                </div>
                <div className="hidden lg:block">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#de402a] to-[#ff8a78]" style={{ width: `${Math.min(100, creator.graduationProgress)}%` }} />
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-[#cbd6e7]">{creator.graduationProgress}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────  Watchlist  ────────────────────────────── */

export const usePreviewWatchlist = (): CreatorMarketRecord[] => useMemo(() => {
  const heldIds = new Set(portfolioHoldings.map((h) => h.creatorId));
  return mockCreators.filter((c) => !heldIds.has(c.id)).slice(0, 6);
}, []);

export const PreviewWatchlistPanel = ({ rows }: { rows: CreatorMarketRecord[] }) => {
  if (rows.length === 0) {
    return <EmptyState title="Watchlist is empty" cta="Discover creators" href={EXPLORE_PATH} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f3c66e]">Preview</span>
        <span className="text-[10px] text-[#6f8099]">Mock watchlist from fixture creators</span>
      </div>
      <div className="overflow-hidden rounded-[20px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)]">
        <div className="hidden border-b border-white/[0.04] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099] lg:grid lg:grid-cols-[2.2fr_0.8fr_0.8fr_1.4fr] lg:items-center lg:gap-4">
          <span>Creator</span>
          <span className="text-right">Price</span>
          <span className="text-right">Momentum</span>
          <span>Latest signal</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {rows.map((creator) => {
            const change24hPct = Number(((creator.momentumScore - 70) * 0.18).toFixed(2));
            const isUp = change24hPct >= 0;
            const liveWallet = resolveCreatorWalletForRoute(creator.id);

            return (
              <Link
                className="grid items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] lg:grid-cols-[2.2fr_0.8fr_0.8fr_1.4fr] lg:gap-4"
                href={liveWallet ? `/market/${liveWallet}` : `/creators/${creator.id}`}
                key={creator.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img alt={creator.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" src={creator.avatarSrc} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                      <StagePill compact stage={creator.state} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#7e90aa]">{creator.handle} · {creator.niche}</p>
                  </div>
                </div>
                <div className="lg:text-right">
                  <p className="text-sm font-semibold text-white">{formatUsd(creator.tokenPrice)}</p>
                  <p className={`text-[10px] ${isUp ? "text-[#8df0c4]" : "text-[#f67263]"}`}>{isUp ? "+" : ""}{change24hPct.toFixed(2)}% 24h</p>
                </div>
                <div className="hidden lg:block lg:text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#67b8ff] via-[#ffb38a] to-[#de402a]" style={{ width: `${Math.min(100, creator.momentumScore)}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-[#cbd6e7]">{creator.momentumScore}</span>
                  </div>
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="line-clamp-1 text-[12px] text-[#cbd6e7]">{creator.teaser}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────  Rewards  ────────────────────────────── */

export const PreviewRewardsPanel = ({ portfolio }: { portfolio: PreviewPortfolioModel }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="rounded border border-[#f3b33e]/20 bg-[#1a1408]/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f3c66e]">Preview</span>
      <span className="text-[10px] text-[#6f8099]">Local preview only — real claims require the rewards ledger</span>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <RewardItem accent="#65ecaf" amount={`${compactNumber(portfolio.dailySpumpReward)} SPUMP`} label="Daily Engagement" status="Preview ready" />
      <RewardItem accent="#ffb38a" amount={formatUsd(portfolio.claimableBuyoutUsd)} label="Buyout Pool" status="2d 0h preview" />
      <RewardItem accent="#67b8ff" amount={formatUsd(portfolio.pendingCampaignUsd)} label="Campaign" status="Preview pending" />
      <RewardItem accent="#de402a" amount={formatUsd(portfolio.realizedRewardsUsd)} label="Realized Rewards" status="Preview lifetime" />
    </div>
    <div className="rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)] p-3.5 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">Preview claimable</p>
          <p className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-white">{formatUsd(portfolio.claimableRewardsUsd + portfolio.pendingCampaignUsd)}</p>
          <p className="mt-0.5 text-[10px] text-[#7486a1]">3 rewards ready · 1 pending settlement</p>
        </div>
        <button className="rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_rgba(222,64,42,0.32)] opacity-50 cursor-not-allowed" disabled type="button">
          Preview Claim All
        </button>
      </div>
    </div>
  </div>
);

const RewardItem = ({ accent, amount, label, status }: { accent: string; amount: string; label: string; status: string }) => (
  <div className="flex items-center justify-between gap-2.5 rounded-[14px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.84)_0%,rgba(10,15,23,0.84)_100%)] px-3 py-2.5">
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#6f8099]">{label}</p>
      </div>
      <p className="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-white">{amount}</p>
      <p className="mt-0.5 text-[10px] text-[#7486a1]">{status}</p>
    </div>
  </div>
);

/* ──────────────────────────────  Shared  ────────────────────────────── */

const EmptyState = ({ cta, href, title }: { cta: string; href: string; title: string }) => (
  <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-6 py-10 text-center">
    <p className="text-sm font-medium text-white">{title}</p>
    <Link className="mt-4 inline-flex rounded-full bg-[#de402a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ea523e]" href={href}>{cta}</Link>
  </div>
);

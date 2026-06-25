import {
  PortfolioActionRecord,
  PortfolioClaimWindowRecord,
  PortfolioExposurePointRecord,
  PortfolioHoldingRecord,
  PortfolioReentryRecord,
  PortfolioUpcomingClaimRecord,
  ScoutScoreboardRecord,
} from "@/lib/api/types";

// 伯乐档案 scoreboard — MOCK_PREVIEW. Creator ids map to seeded discover.ts
// creators so avatars/names/stages stay consistent; ranks/eligibility are
// preview labels, never presented as on-chain reward truth.
export const scoutScoreboard: ScoutScoreboardRecord = {
  backingCount: 8,
  graduatedHits: 3,
  reputationFrom: "Observer",
  reputationTo: "Scout",
  claimableCount: 2,
  claimWindowLabel: "18h",
  rediscoverCreatorId: "corner-heartbeat",
  rows: [
    { creatorId: "luna-cai", backedAtLabel: "3mo", entryRank: 42, identity: "early", action: "claim" },
    { creatorId: "mika-zhou", backedAtLabel: "6wk", entryRank: 210, identity: null, action: "add" },
    { creatorId: "neo-park", backedAtLabel: "5mo", entryRank: 12, identity: "founding", action: "view" },
    { creatorId: "night-arrival", backedAtLabel: "3mo", entryRank: 624, identity: null, action: "add" },
  ],
};

export const portfolioHoldings: PortfolioHoldingRecord[] = [
  {
    creatorId: "luna-cai",
    tokenCount: 154,
    avgEntryUsd: 2.64,
    unrealizedChangePct: 18.4,
    note: "Buyout already accepted. This holding is about claim visibility and capped discovery reward timing.",
    currentPriceUsd: 3.24,
    trend: [2.72, 2.84, 2.76, 2.91, 3.03, 3.14, 3.2, 3.24],
  },
  {
    creatorId: "neo-park",
    tokenCount: 198,
    avgEntryUsd: 4.38,
    unrealizedChangePct: 32.8,
    note: "This creator already crossed into S2. The next step is campaign continuity, not discovery risk.",
    currentPriceUsd: 5.82,
    trend: [4.92, 5.18, 5.46, 5.08, 5.24, 5.49, 5.68, 5.82],
  },
  {
    creatorId: "mika-zhou",
    tokenCount: 94,
    avgEntryUsd: 1.87,
    unrealizedChangePct: 0,
    note: "Still in S1 discovery. Watch graduation pressure and category momentum before adding more.",
    currentPriceUsd: 1.87,
    trend: [2.26, 2.18, 2.08, 1.99, 1.92, 1.88, 1.87, 1.87],
  },
];

export const portfolioExposureTrend: PortfolioExposurePointRecord[] = [
  { label: "Apr 7", value: 1528.4 },
  { label: "Apr 8", value: 1606.1 },
  { label: "Apr 9", value: 1642.8 },
  { label: "Apr 10", value: 1708.2 },
  { label: "Apr 11", value: 1765.9 },
  { label: "Apr 12", value: 1788.6 },
  { label: "Apr 13", value: 1812.4 },
  { label: "Apr 14", value: 1827.1 },
];

export const portfolioClaimWindows: PortfolioClaimWindowRecord[] = [
  {
    id: "claim-luna",
    creatorId: "luna-cai",
    eligibleTokens: 154,
    claimPriceUsd: 3.24,
    payoutUsd: 498.96,
    closesInLabel: "2d 0h left",
    statusLabel: "Claim window approaching",
  },
];

export const portfolioUpcomingClaims: PortfolioUpcomingClaimRecord[] = [
  {
    id: "upcoming-mika",
    creatorId: "mika-zhou",
    eligibleTokens: 94,
    expectedPriceUsd: 2.1,
    opensInLabel: "in 14 days",
    estimatedPayoutUsd: 197.4,
  },
];

export const portfolioReentryPositions: PortfolioReentryRecord[] = [
  {
    id: "reentry-neo",
    creatorId: "neo-park",
    exitPriceUsd: 3.9,
    currentPriceUsd: 5.82,
    exitedAtLabel: "Exited Feb 15, 2026",
    sinceExitPerformancePct: 49.2,
    thesis: "S1 → S2 transition",
  },
  {
    id: "reentry-luna",
    creatorId: "luna-cai",
    exitPriceUsd: 2.2,
    currentPriceUsd: 3.24,
    exitedAtLabel: "Exited Dec 8, 2025",
    sinceExitPerformancePct: 47.3,
    thesis: "Pre-S1 early exit",
  },
];

export const portfolioActions: PortfolioActionRecord[] = [
  {
    id: "action-luna-buyout",
    title: "Claim window is approaching",
    body: "弯心入坑的 buyout 支持者分配即将进入可见阶段。这里应该持续提醒，而不是让用户自己记。",
    tone: "buyout",
    creatorId: "luna-cai",
    actionLabel: "View buyout detail",
  },
  {
    id: "action-neo-s2",
    title: "Re-entry through S2 content pool",
    body: "深夜不下线已经在跑 sponsor-backed launches。这个入口应该帮助用户从 S1 暴露顺滑跳到正在执行的 S2 语境。",
    tone: "opportunity",
    creatorId: "neo-park",
    actionLabel: "Open creator page",
  },
  {
    id: "action-market-rhythm",
    title: "Portfolio should feel like a content habit",
    body: "This page should still look like the same user product as Explore. It is not a separate admin dashboard.",
    tone: "neutral",
  },
];

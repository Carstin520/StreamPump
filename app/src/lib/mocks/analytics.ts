// Illustrative creator-insight fixtures for the workspace 数据/analytics surface.
// Every number here is deterministic mock data for the SaaS-insight preview — it is
// NOT a real metric read. Momentum is a discovery signal, never a price.

export type AnalyticsTier = "free" | "starter" | "growth" | "studio";
export type PaidTier = Exclude<AnalyticsTier, "free">;

export const TIER_ORDER: AnalyticsTier[] = ["free", "starter", "growth", "studio"];

export const tierRank = (tier: AnalyticsTier) => TIER_ORDER.indexOf(tier);

// Deterministic pseudo-series (mirrors the prototype gen()), safe for SSR/hydration.
export const genSeries = (seed: number, n: number, lo: number, hi: number): number[] => {
  let v = (lo + hi) / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v += (((i * 9 + seed) % 7) - 2.4) * ((hi - lo) / 22);
    v = Math.max(lo, Math.min(hi, v));
    out.push(Math.round(v));
  }
  return out;
};

export const seedFromId = (id: string) => ((id.charCodeAt(id.length - 1) || 5) % 9) + 2;

/* ───────────────  Pricing (SaaS tooling fee, independent of SPUMP) ─────────────── */

export type TierPricing = {
  tier: AnalyticsTier;
  monthly: number; // standard monthly
  annualPerMo: number; // standard, billed annually
  annualTotal: number;
  promoMonthly: number; // early-bird promo monthly
  promoAnnualPerMo: number;
  promoAnnualTotal: number;
  popular?: boolean;
  featureKeys: string[]; // i18n keys
};

export const TIER_PRICING: Record<AnalyticsTier, TierPricing> = {
  free: {
    tier: "free",
    monthly: 0,
    annualPerMo: 0,
    annualTotal: 0,
    promoMonthly: 0,
    promoAnnualPerMo: 0,
    promoAnnualTotal: 0,
    featureKeys: ["ws.pricing.feat.free1", "ws.pricing.feat.free2"],
  },
  starter: {
    tier: "starter",
    monthly: 9,
    annualPerMo: 7.5,
    annualTotal: 90,
    promoMonthly: 5.4,
    promoAnnualPerMo: 4.5,
    promoAnnualTotal: 54,
    featureKeys: ["ws.pricing.feat.starter1", "ws.pricing.feat.starter2", "ws.pricing.feat.starter3"],
  },
  growth: {
    tier: "growth",
    monthly: 25,
    annualPerMo: 20.83,
    annualTotal: 250,
    promoMonthly: 15,
    promoAnnualPerMo: 12.5,
    promoAnnualTotal: 150,
    popular: true,
    featureKeys: [
      "ws.pricing.feat.growth1",
      "ws.pricing.feat.growth2",
      "ws.pricing.feat.growth3",
      "ws.pricing.feat.growth4",
      "ws.pricing.feat.growth5",
    ],
  },
  studio: {
    tier: "studio",
    monthly: 49,
    annualPerMo: 40.83,
    annualTotal: 490,
    promoMonthly: 29.4,
    promoAnnualPerMo: 24.5,
    promoAnnualTotal: 294,
    featureKeys: [
      "ws.pricing.feat.studio1",
      "ws.pricing.feat.studio2",
      "ws.pricing.feat.studio3",
      "ws.pricing.feat.studio4",
    ],
  },
};

// "from $X/mo" anchor used on lock overlays and upsell banners.
export const TIER_FROM_PER_MONTH: Record<PaidTier, number> = {
  starter: 4.5,
  growth: 12.5,
  studio: 24.5,
};

export const formatTierPrice = (value: number) =>
  value % 1 === 0 ? `$${value}` : `$${value.toFixed(2)}`;

/* ───────────────  Account-level (数据) fixtures ─────────────── */

export type KpiCell = { labelKey: string; value: string };

export const ACCOUNT_KPIS: KpiCell[] = [
  { labelKey: "ws.data.kpi.fans", value: "4.8万" },
  { labelKey: "ws.data.kpi.weekViews", value: "2.3万" },
  { labelKey: "ws.data.kpi.weekBackers", value: "+48 ⚡" },
  { labelKey: "ws.data.kpi.totalBackers", value: "312" },
  { labelKey: "ws.data.kpi.momentum", value: "71 ↗+9" },
];

export type TrafficRow = { labelKey: string; pct: number };

export const ACCOUNT_TRAFFIC: TrafficRow[] = [
  { labelKey: "ws.metric.src.recommend", pct: 58 },
  { labelKey: "ws.metric.src.follow", pct: 26 },
  { labelKey: "ws.metric.src.search", pct: 9 },
  { labelKey: "ws.metric.src.external", pct: 7 },
];

export type PercentileRow = { labelKey: string; pct: number };

export const ACCOUNT_PERCENTILES: PercentileRow[] = [
  { labelKey: "ws.data.pct.fanGrowth", pct: 81 },
  { labelKey: "ws.metric.engageRate", pct: 88 },
  { labelKey: "ws.data.pct.backerConv", pct: 93 },
];

// Mon..Sun activity, highlight Friday (index 4) to match the copy.
export const WEEK_ACTIVITY = [30, 42, 55, 38, 60, 88, 74];
export const WEEK_ACTIVITY_HOT = 4;

// Top-content row decorations (parallel to a creator's published items).
export const TOP_CONTENT_PLAYS = ["4.2万", "1.1万", "8.6千"];
export const TOP_CONTENT_BACKERS = ["+37 ⚡", "+12 ⚡", "+6 ⚡"];
export const TOP_CONTENT_ENGAGE = ["9.2%", "6.1%", "7.4%"];

export const ACCOUNT_FOLLOWER_SERIES = (() => {
  const out: number[] = [];
  let v = 52;
  for (let i = 0; i < 24; i += 1) {
    v += 2 + ((i * 5 + 6) % 4);
    out.push(v);
  }
  return out;
})();

/* ───────────────  Per-post (analytics) fixtures ─────────────── */

export const POST_KPIS: KpiCell[] = [
  { labelKey: "ws.analytics.kpi.totalPlays", value: "4.2万" },
  { labelKey: "ws.analytics.kpi.plays24h", value: "+3.1k" },
  { labelKey: "ws.analytics.kpi.likes", value: "2.4k" },
  { labelKey: "ws.analytics.kpi.comments", value: "128" },
  { labelKey: "ws.analytics.kpi.broughtBackers", value: "+37 ⚡" },
];

export const POST_RETENTION = [100, 86, 79, 73, 69, 65, 62, 60, 58, 57, 56, 55];

export const POST_TRAFFIC: TrafficRow[] = [
  { labelKey: "ws.metric.src.recommend", pct: 62 },
  { labelKey: "ws.metric.src.follow", pct: 21 },
  { labelKey: "ws.metric.src.search", pct: 9 },
  { labelKey: "ws.metric.src.external", pct: 8 },
];

export const POST_PERCENTILES: PercentileRow[] = [
  { labelKey: "ws.metric.plays", pct: 87 },
  { labelKey: "ws.metric.engageRate", pct: 92 },
  { labelKey: "ws.analytics.pct.completion", pct: 78 },
];

export type FunnelRow = { labelKey: string; value: string; pct: number; color: string };

export const POST_FUNNEL: FunnelRow[] = [
  { labelKey: "ws.analytics.funnel.impressions", value: "120k", pct: 100, color: "#67b8ff" },
  { labelKey: "ws.metric.plays", value: "42k", pct: 35, color: "#4a9be0" },
  { labelKey: "ws.analytics.funnel.likes", value: "2.4k", pct: 16, color: "#f0a070" },
  { labelKey: "ws.analytics.funnel.comments", value: "128", pct: 7, color: "#f0795f" },
  { labelKey: "ws.analytics.funnel.backers", value: "37", pct: 3, color: "#de402a" },
];

export type PlayRange = "24h" | "7d" | "all";

export const playSeries = (id: string, range: PlayRange): number[] => {
  const seed = seedFromId(id);
  if (range === "24h") return genSeries(seed, 24, 38, 96);
  if (range === "7d") return genSeries(seed, 8, 30, 92);
  return genSeries(seed, 30, 22, 97);
};

export const followerSeries = (id: string): number[] => {
  const seed = seedFromId(id);
  const n = 30;
  let v = 70;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v += Math.max(0, ((i * 7 + seed) % 5) + (i % 8 === 0 ? 13 : 1));
    out.push(v);
  }
  return out;
};

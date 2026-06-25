// SEEDED_DEMO market projection seed for the 发现榜 / 伯乐档案 surfaces.
// Momentum/graduation/holders here are seeded preview values (not on-chain
// truth) joined onto post-derived creator records by creator id. Keep values
// internally consistent with each creator's season stage.
export type CreatorCategory =
  | "racing"
  | "music"
  | "gaming"
  | "film"
  | "tech"
  | "life"
  | "art";

export const CREATOR_CATEGORIES: CreatorCategory[] = [
  "racing", "music", "gaming", "film", "tech", "life", "art",
];

export type CreatorMarketSeed = {
  momentumScore: number;       // 0-100 discovery signal
  momentumDelta7d: number;     // weekly change, can be 0..+, small
  graduationProgress: number;  // 0-100 (%)
  holderCount: number;         // number of backers
  tokenPriceSpump: number;     // internal S1 price in SPUMP, small decimal
  category: CreatorCategory;
};

export const creatorMarketSeed: Record<string, CreatorMarketSeed> = {
  // S1_BUYOUT — Racing x Visual Culture
  "luna-cai": {
    momentumScore: 84,
    momentumDelta7d: 7,
    graduationProgress: 76,
    holderCount: 2864,
    tokenPriceSpump: 3.24,
    category: "racing",
  },

  // S1_DISCOVERY — Cinema x Atmosphere
  "mika-zhou": {
    momentumScore: 67,
    momentumDelta7d: 18,
    graduationProgress: 44,
    holderCount: 537,
    tokenPriceSpump: 2.16,
    category: "film",
  },

  // S2_ACTIVE — Games x Trailer Moodboards (graduated, sponsoring)
  "neo-park": {
    momentumScore: 94,
    momentumDelta7d: 0,
    graduationProgress: 100,
    holderCount: 4120,
    tokenPriceSpump: 5.82,
    category: "gaming",
  },

  // S1_DISCOVERY — Aerospace x Engineering Romance
  "low-orbit": {
    momentumScore: 61,
    momentumDelta7d: 11,
    graduationProgress: 36,
    holderCount: 312,
    tokenPriceSpump: 1.42,
    category: "tech",
  },

  // S1_BUYOUT — City x Cyberpunk Mood
  "night-arrival": {
    momentumScore: 79,
    momentumDelta7d: 9,
    graduationProgress: 83,
    holderCount: 2190,
    tokenPriceSpump: 2.74,
    category: "art",
  },

  // S1_DISCOVERY — Pet Daily x Cozy Home Fragments
  "guantou-bugoufen": {
    momentumScore: 73,
    momentumDelta7d: 23,
    graduationProgress: 51,
    holderCount: 684,
    tokenPriceSpump: 2.08,
    category: "life",
  },

  // S1_BUYOUT — Live Music x Afterglow
  "night-distortion": {
    momentumScore: 82,
    momentumDelta7d: 13,
    graduationProgress: 88,
    holderCount: 2148,
    tokenPriceSpump: 2.96,
    category: "music",
  },

  // S1_BUYOUT — F1 x Trackside Velocity
  "corner-heartbeat": {
    momentumScore: 91,
    momentumDelta7d: 6,
    graduationProgress: 93,
    holderCount: 3074,
    tokenPriceSpump: 3.38,
    category: "racing",
  },

  // S1_DISCOVERY — Chinese Rap x City Mood
  "wudu-lowfreq": {
    momentumScore: 78,
    momentumDelta7d: 27,
    graduationProgress: 58,
    holderCount: 847,
    tokenPriceSpump: 2.44,
    category: "music",
  },
};

// Robust join key: the live/backend feed slugifies the creator's display name
// into creatorId, so the discover-slug id above won't match. The display NAME is
// stable across both the backend feed and the mock fallback, so we also key the
// seed by name and join on that first (same approach as the title-join in feed.ts).
export const creatorMarketSeedByName: Record<string, CreatorMarketSeed> = {
  "弯心入坑": creatorMarketSeed["luna-cai"],
  "胶片落进沙里": creatorMarketSeed["mika-zhou"],
  "深夜不下线": creatorMarketSeed["neo-park"],
  "低空仰望者": creatorMarketSeed["low-orbit"],
  "夜航未降落": creatorMarketSeed["night-arrival"],
  "罐头不够分": creatorMarketSeed["guantou-bugoufen"],
  "夜场失真": creatorMarketSeed["night-distortion"],
  "弯角心跳器": creatorMarketSeed["corner-heartbeat"],
  "雾都低频": creatorMarketSeed["wudu-lowfreq"],
};

// Seeded S2 campaign id per creator display name — lets the 发现榜 S2 card link
// straight to the on-chain proof page. Only creators with a seeded campaign map;
// others honestly fall back to the creator page.
export const creatorCampaignByName: Record<string, string> = {
  "深夜不下线": "prop-neo-park-2026q2",
};

// Resolve a seed for a creator by id (discover slug) OR display name.
export const resolveCreatorMarketSeed = (
  creatorId: string | null | undefined,
  creatorName: string | null | undefined,
): CreatorMarketSeed | undefined =>
  (creatorId ? creatorMarketSeed[creatorId] : undefined) ??
  (creatorName ? creatorMarketSeedByName[creatorName] : undefined);

/**
 * Influence service stub — pure-function placeholder for the Level + Scout
 * dual-track model.  Returns mock-preview data; will be replaced by a real
 * reputation model once curation signals and anti-fraud review are in place.
 */

export type ScoutTier = "PASSERBY" | "OBSERVER" | "SCOUT" | "GOLD_SCOUT";

export type InfluenceSnapshot = {
  level: number;
  scoutTier: ScoutTier;
  scoutTierLabel: { en: string; zh: string };
  influenceWeightPreview: number;
  readiness: "MOCK_PREVIEW";
  source: string;
};

const SCOUT_TIER_LABELS: Record<ScoutTier, { en: string; zh: string }> = {
  PASSERBY: { en: "Passerby", zh: "路人" },
  OBSERVER: { en: "Observer", zh: "观察者" },
  SCOUT: { en: "Scout", zh: "星探" },
  GOLD_SCOUT: { en: "Gold Scout", zh: "金牌伯乐" },
};

/** Placeholder mapping from level to scout tier (real model is outcome-based). */
export const scoutTierForLevel = (level: number): ScoutTier => {
  if (level >= 5) return "GOLD_SCOUT";
  if (level >= 3) return "SCOUT";
  if (level >= 1) return "OBSERVER";
  return "PASSERBY";
};

/** Sublinear, capped influence weight preview (1.0–3.0). */
export const influenceWeightPreview = (level: number, scoutTier: ScoutTier): number => {
  const levelBonus = Math.min(level * 0.15, 0.9);

  const scoutBonus: Record<ScoutTier, number> = {
    PASSERBY: 0,
    OBSERVER: 0.3,
    SCOUT: 0.6,
    GOLD_SCOUT: 1.1,
  };

  return Math.min(1.0 + levelBonus + scoutBonus[scoutTier], 3.0);
};

export const buildInfluenceSnapshot = (level: number): InfluenceSnapshot => {
  const tier = scoutTierForLevel(level);
  return {
    level,
    scoutTier: tier,
    scoutTierLabel: SCOUT_TIER_LABELS[tier],
    influenceWeightPreview: influenceWeightPreview(level, tier),
    readiness: "MOCK_PREVIEW",
    source: "placeholder mapping from level; real scout score requires outcome data",
  };
};

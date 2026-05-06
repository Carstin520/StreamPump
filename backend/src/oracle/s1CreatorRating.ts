import { createHash } from "crypto";

export type S1CreatorRatingInput = {
  followerGrowthVelocityBps: number;
  contentConsistencyBps: number;
  engagementQualityBps: number;
  sponsorFitBps: number;
  retentionBps: number;
  fraudRiskBps: number;
  qualifiedAudience: number;
};

export type S1CreatorRatingReport = {
  scoreBps: number;
  ratingBps: number;
  graduationTargetSupply: number;
  reportDigestHex: string;
};

const MIN_RATING_BPS = 5_000;
const MAX_RATING_BPS = 20_000;
const MIN_GRADUATION_TARGET_SUPPLY = 2_500;
const MAX_GRADUATION_TARGET_SUPPLY = 25_000;

const clamp = (min: number, max: number, value: number): number =>
  Math.min(max, Math.max(min, value));

const assertBps = (value: number, fieldName: string): void => {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${fieldName} must be an integer between 0 and 10000 bps`);
  }
};

const normalizeRatingInput = (input: S1CreatorRatingInput): S1CreatorRatingInput => {
  assertBps(input.followerGrowthVelocityBps, "followerGrowthVelocityBps");
  assertBps(input.contentConsistencyBps, "contentConsistencyBps");
  assertBps(input.engagementQualityBps, "engagementQualityBps");
  assertBps(input.sponsorFitBps, "sponsorFitBps");
  assertBps(input.retentionBps, "retentionBps");
  assertBps(input.fraudRiskBps, "fraudRiskBps");

  if (!Number.isInteger(input.qualifiedAudience) || input.qualifiedAudience < 1) {
    throw new Error("qualifiedAudience must be a positive integer");
  }

  return {
    followerGrowthVelocityBps: input.followerGrowthVelocityBps,
    contentConsistencyBps: input.contentConsistencyBps,
    engagementQualityBps: input.engagementQualityBps,
    sponsorFitBps: input.sponsorFitBps,
    retentionBps: input.retentionBps,
    fraudRiskBps: input.fraudRiskBps,
    qualifiedAudience: input.qualifiedAudience,
  };
};

const digestReport = (
  input: S1CreatorRatingInput,
  scoreBps: number,
  ratingBps: number,
  graduationTargetSupply: number
): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        input,
        scoreBps,
        ratingBps,
        graduationTargetSupply,
        version: "s1-rating-v1",
      })
    )
    .digest("hex");

export const calculateS1CreatorRatingReport = (
  rawInput: S1CreatorRatingInput
): S1CreatorRatingReport => {
  const input = normalizeRatingInput(rawInput);
  const scoreBps = Math.floor(
    (input.followerGrowthVelocityBps * 30 +
      input.contentConsistencyBps * 20 +
      input.engagementQualityBps * 20 +
      input.sponsorFitBps * 15 +
      input.retentionBps * 10 +
      (10_000 - input.fraudRiskBps) * 5) /
      100
  );

  const ratingBps = clamp(
    MIN_RATING_BPS,
    MAX_RATING_BPS,
    MIN_RATING_BPS + Math.floor((scoreBps * 15_000) / 10_000)
  );
  const rawGraduationTarget =
    MIN_GRADUATION_TARGET_SUPPLY *
    Math.sqrt(input.qualifiedAudience / 10_000) *
    (10_000 / ratingBps);
  const graduationTargetSupply = clamp(
    MIN_GRADUATION_TARGET_SUPPLY,
    MAX_GRADUATION_TARGET_SUPPLY,
    Math.round(rawGraduationTarget)
  );

  return {
    scoreBps,
    ratingBps,
    graduationTargetSupply,
    reportDigestHex: digestReport(input, scoreBps, ratingBps, graduationTargetSupply),
  };
};

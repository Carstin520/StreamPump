import { expect } from "chai";

import { calculateS1CreatorRatingReport } from "../src/oracle/s1CreatorRating";
import { calculatePlatformEmissionPolicy } from "../src/oracle/s1EmissionPolicy";

describe("S1 creator rating calculator", () => {
  it("calculates a deterministic mid-market creator report", () => {
    const report = calculateS1CreatorRatingReport({
      followerGrowthVelocityBps: 5_000,
      contentConsistencyBps: 5_000,
      engagementQualityBps: 5_000,
      sponsorFitBps: 5_000,
      retentionBps: 5_000,
      fraudRiskBps: 5_000,
      qualifiedAudience: 10_000,
    });

    expect(report.scoreBps).to.equal(5_000);
    expect(report.ratingBps).to.equal(12_500);
    expect(report.graduationTargetSupply).to.equal(2_500);
    expect(report.reportDigestHex).to.match(/^[0-9a-f]{64}$/);
  });

  it("rewards high quality but still keeps audience target bounded", () => {
    const report = calculateS1CreatorRatingReport({
      followerGrowthVelocityBps: 10_000,
      contentConsistencyBps: 10_000,
      engagementQualityBps: 10_000,
      sponsorFitBps: 10_000,
      retentionBps: 10_000,
      fraudRiskBps: 0,
      qualifiedAudience: 100_000,
    });

    expect(report.scoreBps).to.equal(10_000);
    expect(report.ratingBps).to.equal(20_000);
    expect(report.graduationTargetSupply).to.equal(3_953);
  });

  it("penalizes fraud risk and clamps tiny audiences to the early target", () => {
    const lowFraud = calculateS1CreatorRatingReport({
      followerGrowthVelocityBps: 4_000,
      contentConsistencyBps: 4_000,
      engagementQualityBps: 4_000,
      sponsorFitBps: 4_000,
      retentionBps: 4_000,
      fraudRiskBps: 0,
      qualifiedAudience: 100,
    });
    const highFraud = calculateS1CreatorRatingReport({
      followerGrowthVelocityBps: 4_000,
      contentConsistencyBps: 4_000,
      engagementQualityBps: 4_000,
      sponsorFitBps: 4_000,
      retentionBps: 4_000,
      fraudRiskBps: 10_000,
      qualifiedAudience: 100,
    });

    expect(highFraud.ratingBps).to.be.lessThan(lowFraud.ratingBps);
    expect(highFraud.graduationTargetSupply).to.equal(2_500);
  });
});

describe("S1 platform emission policy", () => {
  it("uses the early-platform multiplier below 1000 active users", () => {
    expect(calculatePlatformEmissionPolicy({ activeUsers: 999 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 100_000,
    });
  });

  it("linearly decays from 5x to 2x between 1000 and 10000 users", () => {
    expect(calculatePlatformEmissionPolicy({ activeUsers: 1_000 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 50_000,
    });
    expect(calculatePlatformEmissionPolicy({ activeUsers: 5_500 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 35_000,
    });
    expect(calculatePlatformEmissionPolicy({ activeUsers: 10_000 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 20_000,
    });
  });

  it("floors toward 1x after 10000 active users", () => {
    expect(calculatePlatformEmissionPolicy({ activeUsers: 55_000 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 15_000,
    });
    expect(calculatePlatformEmissionPolicy({ activeUsers: 100_000 })).to.deep.equal({
      dailySpumpEmissionMultiplierBps: 10_000,
    });
  });
});

import { createHash, randomBytes } from "crypto";

export type CreatorUpgradeMetricType = "followers" | "valid_views";

export interface CreatorUpgradePayload {
  creatorWallet: string;
  newLevel: number;
  metricType: CreatorUpgradeMetricType;
  metricValue: number;
  observedAt: number;
  reportIdHex: string;
  reportDigestHex: string;
}

export const buildCreatorUpgradePayload = (params: {
  creatorWallet: string;
  newLevel: number;
  metricType: CreatorUpgradeMetricType;
  metricValue: number;
  observedAt?: number;
}): CreatorUpgradePayload => {
  const observedAt = params.observedAt ?? Math.floor(Date.now() / 1000);
  const reportIdHex = randomBytes(32).toString("hex");

  const digestInput = JSON.stringify({
    creatorWallet: params.creatorWallet,
    newLevel: params.newLevel,
    metricType: params.metricType,
    metricValue: params.metricValue,
    observedAt,
    reportIdHex,
  });

  return {
    creatorWallet: params.creatorWallet,
    newLevel: params.newLevel,
    metricType: params.metricType,
    metricValue: params.metricValue,
    observedAt,
    reportIdHex,
    reportDigestHex: createHash("sha256").update(digestInput).digest("hex"),
  };
};

import { randomBytes } from "crypto";

import { buildOracleSettlementReport } from "../services/viewOracleAggregator";

export interface OracleSettlementPayload {
  campaignId: string;
  videoId: string;
  finalViews: number;
  requestIdHex: string;
  reportDigestHex: string;
}

export const buildOracleSettlementPayload = (
  campaignId: string,
  videoId: string
): OracleSettlementPayload => {
  const report = buildOracleSettlementReport(campaignId, videoId);

  return {
    campaignId,
    videoId,
    finalViews: report.finalViews,
    requestIdHex: randomBytes(32).toString("hex"),
    reportDigestHex: report.reportDigestHex,
  };
};

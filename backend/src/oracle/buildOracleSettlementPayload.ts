import { randomBytes } from "crypto";

import { buildOracleSettlementReport } from "../services/viewOracleAggregator";

export interface OracleSettlementPayload {
  proposalKey: string;
  videoId: string;
  actualViews: number;
  requestIdHex: string;
  reportDigestHex: string;
}

export const buildOracleSettlementPayload = (
  proposalKey: string,
  videoId: string
): OracleSettlementPayload => {
  const report = buildOracleSettlementReport(proposalKey, videoId);

  return {
    proposalKey,
    videoId,
    actualViews: report.actualViews,
    requestIdHex: randomBytes(32).toString("hex"),
    reportDigestHex: report.reportDigestHex,
  };
};

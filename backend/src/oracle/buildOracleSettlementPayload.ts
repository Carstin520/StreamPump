/**
 * CN: 构造 Track2 结算 payload，将反作弊后的统计结果封装成可提交结构。
 * EN: Builds the Track2 settlement payload by packaging anti-cheat-filtered metrics for submission.
 */
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

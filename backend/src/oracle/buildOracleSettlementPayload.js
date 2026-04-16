"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOracleSettlementPayload = void 0;
/**
 * CN: 构造 Track2 结算 payload，将反作弊后的统计结果封装成可提交结构。
 * EN: Builds the Track2 settlement payload by packaging anti-cheat-filtered metrics for submission.
 */
const crypto_1 = require("crypto");
const viewOracleAggregator_1 = require("../services/viewOracleAggregator");
const buildOracleSettlementPayload = (proposalKey, videoId) => {
    const report = (0, viewOracleAggregator_1.buildOracleSettlementReport)(proposalKey, videoId);
    return {
        proposalKey,
        videoId,
        actualViews: report.actualViews,
        requestIdHex: (0, crypto_1.randomBytes)(32).toString("hex"),
        reportDigestHex: report.reportDigestHex,
    };
};
exports.buildOracleSettlementPayload = buildOracleSettlementPayload;

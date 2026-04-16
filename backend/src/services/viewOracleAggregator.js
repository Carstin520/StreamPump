"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOracleSettlementReport = exports.getViewStats = exports.recordViewSignal = void 0;
/**
 * CN: 原型观看量聚合器，将反作弊结果汇总为结算报告。
 * EN: Prototype view aggregator that turns anti-cheat verdicts into settlement-ready reports.
 */
const crypto_1 = require("crypto");
const viewLedger = new Map();
const accumulatorFor = (videoId) => {
    const existing = viewLedger.get(videoId);
    if (existing) {
        return existing;
    }
    const created = {
        acceptedViews: 0,
        reviewViews: 0,
        rejectedViews: 0,
        uniqueViewers: new Set(),
        lastUpdatedMs: Date.now(),
    };
    viewLedger.set(videoId, created);
    return created;
};
const recordViewSignal = (event, antiCheat) => {
    const bucket = accumulatorFor(event.videoId);
    bucket.uniqueViewers.add(event.viewerId);
    bucket.lastUpdatedMs = event.timestampMs;
    switch (antiCheat.decision) {
        case "ACCEPT":
            bucket.acceptedViews += 1;
            break;
        case "REVIEW":
            bucket.reviewViews += 1;
            break;
        case "REJECT":
            bucket.rejectedViews += 1;
            break;
        default:
            break;
    }
};
exports.recordViewSignal = recordViewSignal;
const getViewStats = (videoId) => {
    const bucket = accumulatorFor(videoId);
    return {
        acceptedViews: bucket.acceptedViews,
        reviewViews: bucket.reviewViews,
        rejectedViews: bucket.rejectedViews,
        uniqueViewerCount: bucket.uniqueViewers.size,
        lastUpdatedMs: bucket.lastUpdatedMs,
    };
};
exports.getViewStats = getViewStats;
const buildOracleSettlementReport = (proposalKey, videoId) => {
    const snapshot = (0, exports.getViewStats)(videoId);
    // Conservative final count: only anti-cheat accepted views are submitted on-chain.
    const actualViews = snapshot.acceptedViews;
    const generatedAtIso = new Date().toISOString();
    const digestInput = JSON.stringify({
        proposalKey,
        videoId,
        actualViews,
        generatedAtIso,
    });
    const reportDigestHex = (0, crypto_1.createHash)("sha256").update(digestInput).digest("hex");
    return {
        proposalKey,
        videoId,
        actualViews,
        reportDigestHex,
        generatedAtIso,
    };
};
exports.buildOracleSettlementReport = buildOracleSettlementReport;

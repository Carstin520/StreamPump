"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSettlementReport = exports.viewStats = exports.ingestViewEvent = void 0;
const antiCheat_1 = require("../services/antiCheat");
const viewOracleAggregator_1 = require("../services/viewOracleAggregator");
const parseEvent = (body) => ({
    creatorId: String(body.creatorId ?? ""),
    videoId: String(body.videoId ?? ""),
    viewerId: String(body.viewerId ?? ""),
    sessionId: String(body.sessionId ?? ""),
    ipAddress: String(body.ipAddress ?? ""),
    userAgent: String(body.userAgent ?? ""),
    hardwareFingerprint: String(body.hardwareFingerprint ?? ""),
    interactions: Array.isArray(body.interactions)
        ? body.interactions.map((item) => String(item))
        : [],
    timestampMs: Number(body.timestampMs ?? Date.now()),
});
const ingestViewEvent = (req, res) => {
    const event = parseEvent(req.body);
    if (!event.videoId || !event.viewerId || !event.sessionId) {
        res.status(400).json({ error: "videoId, viewerId, and sessionId are required" });
        return;
    }
    const verdict = (0, antiCheat_1.evaluateViewEvent)(event);
    (0, viewOracleAggregator_1.recordViewSignal)(event, verdict);
    res.status(202).json({
        accepted: verdict.decision === "ACCEPT",
        decision: verdict.decision,
        riskScore: verdict.riskScore,
        reasons: verdict.reasons,
    });
};
exports.ingestViewEvent = ingestViewEvent;
const viewStats = (req, res) => {
    const videoId = String(req.params.videoId ?? "");
    if (!videoId) {
        res.status(400).json({ error: "videoId is required" });
        return;
    }
    res.json((0, viewOracleAggregator_1.getViewStats)(videoId));
};
exports.viewStats = viewStats;
const buildSettlementReport = (req, res) => {
    const proposalKey = String(req.params.proposalKey ?? "");
    const videoId = String(req.params.videoId ?? "");
    if (!proposalKey || !videoId) {
        res.status(400).json({ error: "proposalKey and videoId are required" });
        return;
    }
    res.json((0, viewOracleAggregator_1.buildOracleSettlementReport)(proposalKey, videoId));
};
exports.buildSettlementReport = buildSettlementReport;

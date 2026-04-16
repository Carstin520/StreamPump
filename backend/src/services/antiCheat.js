"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateViewEvent = void 0;
/**
 * CN: 轻量级反作弊服务，用于原型阶段对观看事件做快速风险评分。
 * EN: Lightweight anti-cheat service for assigning quick risk scores to prototype view events.
 */
const default_1 = require("../../config/default");
const recentIpEvents = new Map();
const recentSessionEvents = new Map();
const gcStaleEntries = (now) => {
    const threshold = now - default_1.config.antiCheat.ipWindowMs;
    for (const [key, seenAt] of recentIpEvents.entries()) {
        if (seenAt < threshold) {
            recentIpEvents.delete(key);
        }
    }
    for (const [key, seenAt] of recentSessionEvents.entries()) {
        if (seenAt < threshold) {
            recentSessionEvents.delete(key);
        }
    }
};
const repeatedActionScore = (interactions) => {
    if (interactions.length < 2) {
        return 15;
    }
    let suspicious = 0;
    let streak = 1;
    for (let index = 1; index < interactions.length; index += 1) {
        if (interactions[index] === interactions[index - 1]) {
            streak += 1;
            if (streak >= 6) {
                suspicious += 10;
            }
        }
        else {
            streak = 1;
        }
    }
    return suspicious;
};
const evaluateViewEvent = (event) => {
    const now = event.timestampMs;
    gcStaleEntries(now);
    // The prototype intentionally stays conservative: suspicious patterns accumulate score quickly.
    let riskScore = 0;
    const reasons = [];
    const ipKey = `${event.videoId}:${event.ipAddress}`;
    const lastIpSeen = recentIpEvents.get(ipKey);
    if (lastIpSeen && now - lastIpSeen < default_1.config.antiCheat.ipWindowMs) {
        riskScore += 35;
        reasons.push("duplicate-ip-window");
    }
    const sessionKey = `${event.videoId}:${event.sessionId}`;
    const lastSessionSeen = recentSessionEvents.get(sessionKey);
    if (lastSessionSeen && now - lastSessionSeen < 10_000) {
        riskScore += 25;
        reasons.push("session-burst-pattern");
    }
    if (event.hardwareFingerprint.length < 24) {
        riskScore += 20;
        reasons.push("weak-hardware-fingerprint");
    }
    if (event.interactions.length < default_1.config.antiCheat.minInteractionEvents) {
        riskScore += 20;
        reasons.push("low-interaction-depth");
    }
    const repeatedScore = repeatedActionScore(event.interactions);
    if (repeatedScore > 0) {
        riskScore += repeatedScore;
        reasons.push("repeated-interaction-sequence");
    }
    recentIpEvents.set(ipKey, now);
    recentSessionEvents.set(sessionKey, now);
    if (riskScore > default_1.config.antiCheat.maxRiskScore + 25) {
        return { decision: "REJECT", riskScore, reasons };
    }
    if (riskScore > default_1.config.antiCheat.maxRiskScore) {
        return { decision: "REVIEW", riskScore, reasons };
    }
    return { decision: "ACCEPT", riskScore, reasons };
};
exports.evaluateViewEvent = evaluateViewEvent;

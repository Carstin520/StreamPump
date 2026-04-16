"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestClickWebhook = void 0;
/**
 * CN: Track2 点击回调控制器，负责去重、简单反作弊和事件落库。
 * EN: Track2 click webhook controller responsible for dedupe, simple fraud checks, and event persistence.
 */
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const prisma_1 = require("../services/prisma");
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_IP_WINDOW = 45;
const DEDUPE_WINDOW_MS = 10 * 60_000;
// Prototype-only in-memory ledgers. These need Redis or durable storage before multi-instance deployment.
const ipBurstLedger = new Map();
const dedupeLedger = new Map();
const normalizeMetricType = (value) => {
    const normalized = String(value ?? "CLICKS")
        .trim()
        .toUpperCase();
    if (normalized === "SAVES" || normalized === "SAVE") {
        return client_1.Track2MetricType.SAVES;
    }
    return client_1.Track2MetricType.CLICKS;
};
const hashString = (input) => (0, crypto_1.createHash)("sha256").update(input).digest("hex");
const extractIp = (req) => {
    const forwarded = String(req.header("x-forwarded-for") ?? "").split(",")[0].trim();
    if (forwarded) {
        return forwarded;
    }
    return req.ip || "0.0.0.0";
};
const gcLedgers = (nowMs) => {
    for (const [ip, timestamps] of ipBurstLedger.entries()) {
        const recent = timestamps.filter((ts) => nowMs - ts <= RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) {
            ipBurstLedger.delete(ip);
            continue;
        }
        ipBurstLedger.set(ip, recent);
    }
    for (const [key, seenAt] of dedupeLedger.entries()) {
        if (nowMs - seenAt > DEDUPE_WINDOW_MS) {
            dedupeLedger.delete(key);
        }
    }
};
const evaluateFraud = (params) => {
    const nowMs = Date.now();
    gcLedgers(nowMs);
    const reasons = [];
    let fraudScore = 0;
    let fraudStatus = client_1.FraudStatus.ACCEPTED;
    const ipHits = ipBurstLedger.get(params.ip) ?? [];
    const recentHits = ipHits.filter((ts) => nowMs - ts <= RATE_LIMIT_WINDOW_MS);
    recentHits.push(nowMs);
    ipBurstLedger.set(params.ip, recentHits);
    if (recentHits.length > MAX_EVENTS_PER_IP_WINDOW) {
        fraudScore += 80;
        fraudStatus = client_1.FraudStatus.REJECTED;
        reasons.push("ip-rate-limit-exceeded");
    }
    if (dedupeLedger.has(params.dedupeKey)) {
        fraudScore += 75;
        fraudStatus = client_1.FraudStatus.REJECTED;
        reasons.push("duplicate-event");
    }
    else {
        dedupeLedger.set(params.dedupeKey, nowMs);
    }
    if (!params.userAgent) {
        fraudScore += 20;
        if (fraudStatus !== client_1.FraudStatus.REJECTED) {
            fraudStatus = client_1.FraudStatus.REVIEW;
        }
        reasons.push("missing-user-agent");
    }
    if (!params.hasSession) {
        fraudScore += 15;
        if (fraudStatus !== client_1.FraudStatus.REJECTED) {
            fraudStatus = client_1.FraudStatus.REVIEW;
        }
        reasons.push("missing-session-id");
    }
    return {
        fraudStatus,
        fraudScore,
        reasons,
    };
};
const resolveProposal = async (proposalRef) => {
    return prisma_1.prisma.proposal.findFirst({
        where: {
            OR: [{ id: proposalRef }, { proposalPda: proposalRef }],
        },
        select: {
            id: true,
            proposalPda: true,
        },
    });
};
const isUniqueConstraintError = (error) => {
    if (!error || typeof error !== "object") {
        return false;
    }
    return ("code" in error &&
        error.code === "P2002");
};
const ingestClickWebhook = async (req, res) => {
    try {
        const proposalRef = String(req.body.proposalId ?? req.body.proposalPda ?? "").trim();
        if (!proposalRef) {
            res.status(400).json({ error: "proposalId or proposalPda is required" });
            return;
        }
        const proposal = await resolveProposal(proposalRef);
        if (!proposal) {
            res.status(404).json({ error: "proposal not found" });
            return;
        }
        const eventType = normalizeMetricType(req.body.eventType);
        const userId = req.body.userId ? String(req.body.userId) : null;
        const sessionId = req.body.sessionId ? String(req.body.sessionId) : null;
        const externalEventId = req.body.eventId ? String(req.body.eventId) : null;
        const userAgent = String(req.header("user-agent") ?? "");
        const ip = extractIp(req);
        const ipHash = hashString(ip);
        const eventTimestampMs = Number(req.body.timestampMs ?? Date.now());
        const eventBucket = Number.isFinite(eventTimestampMs)
            ? Math.floor(eventTimestampMs / 1000)
            : Math.floor(Date.now() / 1000);
        const dedupeKey = externalEventId
            ? `${proposal.id}:${externalEventId}`
            : hashString(`${proposal.id}:${eventType}:${userId ?? "anon"}:${sessionId ?? "na"}:${ipHash}:${eventBucket}`);
        const fraud = evaluateFraud({
            ip,
            dedupeKey,
            userAgent,
            hasSession: Boolean(sessionId),
        });
        await prisma_1.prisma.track2Event.create({
            data: {
                proposalId: proposal.id,
                eventType,
                externalEventId,
                userId,
                sessionId,
                ipHash,
                userAgent: userAgent || null,
                fraudStatus: fraud.fraudStatus,
                fraudScore: fraud.fraudScore,
                dedupeKey,
                rawPayload: req.body,
            },
        });
        res.status(202).json({
            accepted: fraud.fraudStatus === client_1.FraudStatus.ACCEPTED,
            fraudStatus: fraud.fraudStatus,
            fraudScore: fraud.fraudScore,
            reasons: fraud.reasons,
            proposalId: proposal.id,
            proposalPda: proposal.proposalPda,
        });
    }
    catch (error) {
        if (isUniqueConstraintError(error)) {
            res.status(202).json({
                accepted: false,
                fraudStatus: client_1.FraudStatus.REJECTED,
                fraudScore: 90,
                reasons: ["duplicate-event"],
            });
            return;
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : "failed to process webhook",
        });
    }
};
exports.ingestClickWebhook = ingestClickWebhook;

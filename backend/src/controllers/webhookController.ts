import { createHash } from "crypto";

import { FraudStatus, Prisma, Track2MetricType } from "@prisma/client";
import { Request, Response } from "express";

import { prisma } from "../services/prisma";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_EVENTS_PER_IP_WINDOW = 45;
const DEDUPE_WINDOW_MS = 10 * 60_000;

const ipBurstLedger = new Map<string, number[]>();
const dedupeLedger = new Map<string, number>();

const normalizeMetricType = (value: unknown): Track2MetricType => {
  const normalized = String(value ?? "CLICKS")
    .trim()
    .toUpperCase();

  if (normalized === "SAVES" || normalized === "SAVE") {
    return Track2MetricType.SAVES;
  }

  return Track2MetricType.CLICKS;
};

const hashString = (input: string): string => createHash("sha256").update(input).digest("hex");

const extractIp = (req: Request): string => {
  const forwarded = String(req.header("x-forwarded-for") ?? "").split(",")[0].trim();
  if (forwarded) {
    return forwarded;
  }

  return req.ip || "0.0.0.0";
};

const gcLedgers = (nowMs: number): void => {
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

const evaluateFraud = (params: {
  ip: string;
  dedupeKey: string;
  userAgent: string;
  hasSession: boolean;
}): {
  fraudStatus: FraudStatus;
  fraudScore: number;
  reasons: string[];
} => {
  const nowMs = Date.now();
  gcLedgers(nowMs);

  const reasons: string[] = [];
  let fraudScore = 0;
  let fraudStatus: FraudStatus = FraudStatus.ACCEPTED;

  const ipHits = ipBurstLedger.get(params.ip) ?? [];
  const recentHits = ipHits.filter((ts) => nowMs - ts <= RATE_LIMIT_WINDOW_MS);
  recentHits.push(nowMs);
  ipBurstLedger.set(params.ip, recentHits);

  if (recentHits.length > MAX_EVENTS_PER_IP_WINDOW) {
    fraudScore += 80;
    fraudStatus = FraudStatus.REJECTED;
    reasons.push("ip-rate-limit-exceeded");
  }

  if (dedupeLedger.has(params.dedupeKey)) {
    fraudScore += 75;
    fraudStatus = FraudStatus.REJECTED;
    reasons.push("duplicate-event");
  } else {
    dedupeLedger.set(params.dedupeKey, nowMs);
  }

  if (!params.userAgent) {
    fraudScore += 20;
    if (fraudStatus !== FraudStatus.REJECTED) {
      fraudStatus = FraudStatus.REVIEW;
    }

    reasons.push("missing-user-agent");
  }

  if (!params.hasSession) {
    fraudScore += 15;
    if (fraudStatus !== FraudStatus.REJECTED) {
      fraudStatus = FraudStatus.REVIEW;
    }

    reasons.push("missing-session-id");
  }

  return {
    fraudStatus,
    fraudScore,
    reasons,
  };
};

const resolveProposal = async (proposalRef: string) => {
  return prisma.proposal.findFirst({
    where: {
      OR: [{ id: proposalRef }, { proposalPda: proposalRef }],
    },
    select: {
      id: true,
      proposalPda: true,
    },
  });
};

const isUniqueConstraintError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
};

export const ingestClickWebhook = async (req: Request, res: Response) => {
  try {
    const proposalRef = String(
      req.body.proposalId ?? req.body.proposalPda ?? ""
    ).trim();

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
      : hashString(
          `${proposal.id}:${eventType}:${userId ?? "anon"}:${sessionId ?? "na"}:${ipHash}:${eventBucket}`
        );

    const fraud = evaluateFraud({
      ip,
      dedupeKey,
      userAgent,
      hasSession: Boolean(sessionId),
    });

    await prisma.track2Event.create({
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
        rawPayload: req.body as Prisma.InputJsonValue,
      },
    });

    res.status(202).json({
      accepted: fraud.fraudStatus === FraudStatus.ACCEPTED,
      fraudStatus: fraud.fraudStatus,
      fraudScore: fraud.fraudScore,
      reasons: fraud.reasons,
      proposalId: proposal.id,
      proposalPda: proposal.proposalPda,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(202).json({
        accepted: false,
        fraudStatus: FraudStatus.REJECTED,
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

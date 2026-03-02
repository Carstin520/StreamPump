import { Request, Response } from "express";

import {
  evaluateViewEvent,
  ViewEventInput,
} from "../services/antiCheat";
import {
  buildOracleSettlementReport,
  getViewStats,
  recordViewSignal,
} from "../services/viewOracleAggregator";

const parseEvent = (body: Request["body"]): ViewEventInput => ({
  creatorId: String(body.creatorId ?? ""),
  videoId: String(body.videoId ?? ""),
  viewerId: String(body.viewerId ?? ""),
  sessionId: String(body.sessionId ?? ""),
  ipAddress: String(body.ipAddress ?? ""),
  userAgent: String(body.userAgent ?? ""),
  hardwareFingerprint: String(body.hardwareFingerprint ?? ""),
  interactions: Array.isArray(body.interactions)
    ? body.interactions.map((item: unknown) => String(item))
    : [],
  timestampMs: Number(body.timestampMs ?? Date.now()),
});

export const ingestViewEvent = (req: Request, res: Response) => {
  const event = parseEvent(req.body);

  if (!event.videoId || !event.viewerId || !event.sessionId) {
    res.status(400).json({ error: "videoId, viewerId, and sessionId are required" });
    return;
  }

  const verdict = evaluateViewEvent(event);
  recordViewSignal(event, verdict);

  res.status(202).json({
    accepted: verdict.decision === "ACCEPT",
    decision: verdict.decision,
    riskScore: verdict.riskScore,
    reasons: verdict.reasons,
  });
};

export const viewStats = (req: Request, res: Response) => {
  const videoId = String(req.params.videoId ?? "");

  if (!videoId) {
    res.status(400).json({ error: "videoId is required" });
    return;
  }

  res.json(getViewStats(videoId));
};

export const buildSettlementReport = (req: Request, res: Response) => {
  const campaignId = String(req.params.campaignId ?? "");
  const videoId = String(req.params.videoId ?? "");

  if (!campaignId || !videoId) {
    res.status(400).json({ error: "campaignId and videoId are required" });
    return;
  }

  res.json(buildOracleSettlementReport(campaignId, videoId));
};

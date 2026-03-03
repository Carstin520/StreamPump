import { createHash } from "crypto";

import {
  AntiCheatResult,
  ViewEventInput,
} from "./antiCheat";

interface ViewAccumulator {
  acceptedViews: number;
  reviewViews: number;
  rejectedViews: number;
  uniqueViewers: Set<string>;
  lastUpdatedMs: number;
}

export interface OracleSettlementReport {
  proposalKey: string;
  videoId: string;
  actualViews: number;
  reportDigestHex: string;
  generatedAtIso: string;
}

const viewLedger = new Map<string, ViewAccumulator>();

const accumulatorFor = (videoId: string) => {
  const existing = viewLedger.get(videoId);
  if (existing) {
    return existing;
  }

  const created: ViewAccumulator = {
    acceptedViews: 0,
    reviewViews: 0,
    rejectedViews: 0,
    uniqueViewers: new Set<string>(),
    lastUpdatedMs: Date.now(),
  };

  viewLedger.set(videoId, created);
  return created;
};

export const recordViewSignal = (
  event: ViewEventInput,
  antiCheat: AntiCheatResult
): void => {
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

export const getViewStats = (videoId: string) => {
  const bucket = accumulatorFor(videoId);

  return {
    acceptedViews: bucket.acceptedViews,
    reviewViews: bucket.reviewViews,
    rejectedViews: bucket.rejectedViews,
    uniqueViewerCount: bucket.uniqueViewers.size,
    lastUpdatedMs: bucket.lastUpdatedMs,
  };
};

export const buildOracleSettlementReport = (
  proposalKey: string,
  videoId: string
): OracleSettlementReport => {
  const snapshot = getViewStats(videoId);

  // Conservative final count: only anti-cheat accepted views are submitted on-chain.
  const actualViews = snapshot.acceptedViews;
  const generatedAtIso = new Date().toISOString();

  const digestInput = JSON.stringify({
    proposalKey,
    videoId,
    actualViews,
    generatedAtIso,
  });

  const reportDigestHex = createHash("sha256").update(digestInput).digest("hex");

  return {
    proposalKey,
    videoId,
    actualViews,
    reportDigestHex,
    generatedAtIso,
  };
};

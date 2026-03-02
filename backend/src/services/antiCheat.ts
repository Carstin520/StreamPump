import { config } from "../../config/default";

export interface ViewEventInput {
  creatorId: string;
  videoId: string;
  viewerId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  hardwareFingerprint: string;
  interactions: string[];
  timestampMs: number;
}

export type AntiCheatDecision = "ACCEPT" | "REVIEW" | "REJECT";

export interface AntiCheatResult {
  decision: AntiCheatDecision;
  riskScore: number;
  reasons: string[];
}

const recentIpEvents = new Map<string, number>();
const recentSessionEvents = new Map<string, number>();

const gcStaleEntries = (now: number) => {
  const threshold = now - config.antiCheat.ipWindowMs;

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

const repeatedActionScore = (interactions: string[]) => {
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
    } else {
      streak = 1;
    }
  }

  return suspicious;
};

export const evaluateViewEvent = (event: ViewEventInput): AntiCheatResult => {
  const now = event.timestampMs;
  gcStaleEntries(now);

  let riskScore = 0;
  const reasons: string[] = [];

  const ipKey = `${event.videoId}:${event.ipAddress}`;
  const lastIpSeen = recentIpEvents.get(ipKey);
  if (lastIpSeen && now - lastIpSeen < config.antiCheat.ipWindowMs) {
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

  if (event.interactions.length < config.antiCheat.minInteractionEvents) {
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

  if (riskScore > config.antiCheat.maxRiskScore + 25) {
    return { decision: "REJECT", riskScore, reasons };
  }

  if (riskScore > config.antiCheat.maxRiskScore) {
    return { decision: "REVIEW", riskScore, reasons };
  }

  return { decision: "ACCEPT", riskScore, reasons };
};

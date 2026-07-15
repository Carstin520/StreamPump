import { PublicationVerificationStatus } from "@prisma/client";
import { isIP } from "net";

import { HttpError } from "../controllers/http";

const PLATFORM_HOSTS: Record<string, string[]> = {
  X: ["x.com", "twitter.com"],
  TWITTER: ["x.com", "twitter.com"],
  INSTAGRAM: ["instagram.com"],
  TIKTOK: ["tiktok.com"],
  YOUTUBE: ["youtube.com", "youtu.be"],
  XIAOHONGSHU: ["xiaohongshu.com", "xhslink.com"],
};

const hostMatches = (host: string, allowed: string): boolean =>
  host === allowed || host.endsWith(`.${allowed}`);

export const normalizePublicationTarget = (params: {
  platform: string;
  externalUrl: string;
  internalCanonicalUrl: string;
  allowInsecureInternalUrl?: boolean;
}): { platform: string; externalUrl: string } => {
  const platform = params.platform.trim().toUpperCase();
  const rawUrl = params.externalUrl.trim();
  if (rawUrl.length > 2048) {
    throw new HttpError(400, "INVALID_PUBLICATION_URL", "publication URL is too long");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (_error) {
    throw new HttpError(400, "INVALID_PUBLICATION_URL", "publication URL must be valid HTTPS");
  }
  const hostname = url.hostname.toLowerCase();
  if (platform === "STREAMPUMP") {
    let canonicalUrl: URL;
    try {
      canonicalUrl = new URL(params.internalCanonicalUrl);
    } catch (_error) {
      throw new HttpError(409, "INVALID_INTERNAL_CANONICAL_URL", "internal canonical URL is invalid");
    }
    const exactCanonicalMatch = url.toString() === canonicalUrl.toString();
    const localHttpAllowed =
      params.allowInsecureInternalUrl === true &&
      url.protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]");
    if (!exactCanonicalMatch || (url.protocol !== "https:" && !localHttpAllowed)) {
      throw new HttpError(
        400,
        "INVALID_PUBLICATION_URL",
        "StreamPump publication URL must exactly match the finalized internal canonical URL"
      );
    }
    url.hash = "";
    return { platform, externalUrl: url.toString() };
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    isIP(hostname) !== 0
  ) {
    throw new HttpError(400, "INVALID_PUBLICATION_URL", "publication URL must use a public HTTPS host");
  }

  const allowedHosts = PLATFORM_HOSTS[platform];
  if (!allowedHosts) {
    throw new HttpError(400, "INVALID_PUBLICATION_PLATFORM", "publication platform is not supported");
  }
  if (!allowedHosts.some((allowedHost) => hostMatches(hostname, allowedHost))) {
    throw new HttpError(400, "INVALID_PUBLICATION_URL", "publication URL host does not match its platform");
  }

  url.hash = "";
  return {
    platform,
    externalUrl: url.toString(),
  };
};

export const assertCreatorPublicationVerificationAllowed = (
  operatorReviewRequired: boolean
): void => {
  if (operatorReviewRequired) {
    throw new HttpError(
      403,
      "OPERATOR_PUBLICATION_REVIEW_REQUIRED",
      "publication verification requires an operator review in the controlled Pilot"
    );
  }
};

export const buildPublicationReviewData = (params: {
  decision: string;
  reviewer: string;
  note: string | null;
  evidenceDigestHex: string | null;
  reviewedAt?: Date;
}) => {
  const decision = params.decision.trim().toUpperCase();
  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw new HttpError(400, "INVALID_INPUT", "decision must be APPROVE or REJECT");
  }
  const reviewer = params.reviewer.trim();
  if (!reviewer) {
    throw new HttpError(500, "OPERATOR_IDENTITY_MISSING", "operator identity is required");
  }
  const note = params.note?.trim() || null;
  if (note && note.length > 1000) {
    throw new HttpError(400, "INVALID_INPUT", "review note must not exceed 1000 characters");
  }
  const evidenceDigestHex = params.evidenceDigestHex?.trim().toLowerCase() || null;
  if (evidenceDigestHex && !/^[0-9a-f]{64}$/.test(evidenceDigestHex)) {
    throw new HttpError(400, "INVALID_INPUT", "evidenceDigestHex must be a SHA-256 hex digest");
  }
  if (decision === "APPROVE" && !evidenceDigestHex) {
    throw new HttpError(400, "INVALID_INPUT", "evidenceDigestHex is required for approval");
  }
  if (decision === "REJECT" && !note) {
    throw new HttpError(400, "INVALID_INPUT", "review note is required for rejection");
  }

  const reviewedAt = params.reviewedAt ?? new Date();
  return decision === "APPROVE"
    ? {
        verificationStatus: PublicationVerificationStatus.VERIFIED,
        verificationSource: "OPERATOR_APPROVED",
        verificationReviewer: reviewer,
        verificationNote: note,
        verificationEvidenceDigestHex: evidenceDigestHex,
        verifiedAt: reviewedAt,
        rejectedAt: null,
      }
    : {
        verificationStatus: PublicationVerificationStatus.REJECTED,
        verificationSource: "OPERATOR_APPROVED",
        verificationReviewer: reviewer,
        verificationNote: note,
        verificationEvidenceDigestHex: evidenceDigestHex,
        verifiedAt: null,
        rejectedAt: reviewedAt,
      };
};

/**
 * CN: Proposal intent 控制器，管理从业务草稿到真实 v0 launch bundle 的后端状态机。
 * EN: Proposal intent controller that manages the backend state machine from business draft to a real v0 launch bundle.
 */
import {
  BundleStatus,
  BundleSubmitMode,
  ContentManifestStatus,
  ProposalIntentStatus,
  SponsorVerificationStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { Request } from "express";
import { PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import {
  HttpError,
  ensureIdempotencyKey,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parseOptionalString,
  parseWallet,
  requireSessionWallet,
  withController,
} from "./http";
import {
  assertProposalIntentParticipant,
  extractTransactionSignature,
  finalizeConfirmedLaunchBundle,
  isBundleExpired,
  isBundleReusable,
  parseBooleanFlag,
  parseBundleSubmitMode,
  parseTrack2MetricType,
  serializeBundle,
  serializeIntent,
  serializeProposal,
  serializeProposalIntentDetail,
  serializeProposalIntentListItem,
  serializePublicProposalView,
} from "./proposalIntentShared";
import {
  assertRequiredSignerPresent,
  assertTransactionMessageMatches,
  buildBundleRecord,
  buildLaunchBundleTransaction,
  derivePlannedContentAnchorPda,
  deriveIntentAddresses,
} from "../services/proposalLaunchService";
import { prisma } from "../services/prisma";
import { getAnchorService } from "../services/AnchorService";
import {
  getSponsorProfileByWallet,
  parsePilotTestSponsorReviewNote,
} from "../services/sponsorProfile";
import {
  isOperatorApprovedPublication,
  isSettlementAssetReady,
} from "../services/campaignIntegrity";
import { isAssetPublicDeliveryReady } from "../services/contentPublicationEligibility";
import {
  bindApiIdempotencyResource,
  getRecoveredIdempotencyResourceId,
} from "../services/apiIdempotency";

const getRequesterWallet = (req: Request): string => requireSessionWallet(req);
const MAX_SIGNED_BIGINT_NONCE = (1n << 63n) - 1n;

type ProposalIntentReadinessDeps = {
  fetchCreatorProfile: (wallet: PublicKey) => Promise<{
    level: number;
    status: string;
  } | null>;
  fetchSponsorProfile: (wallet: string) => Promise<{
    status: SponsorVerificationStatus;
    wallet?: string;
    companyName?: string;
    registrationNumber?: string;
    reviewEvents?: Array<{ note: string | null; newStatus: SponsorVerificationStatus }>;
  } | null>;
};

type SponsorApprovalProfile = {
  status: SponsorVerificationStatus;
  wallet?: string;
  companyName?: string;
  registrationNumber?: string;
  reviewEvents?: Array<{ note: string | null; newStatus: SponsorVerificationStatus }>;
} | null;

const parsePilotRunId = (req: Request): string | null => {
  const value = String(req.header("x-pilot-run-id") ?? "").trim();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]{5,47}$/.test(value)) {
    throw new HttpError(400, "INVALID_PILOT_RUN_ID", "x-pilot-run-id has an invalid format");
  }
  return value;
};

export const assessSponsorApprovalForUse = (
  profile: SponsorApprovalProfile,
  pilotRunId: string | null
) => {
  if (!profile || profile.status !== SponsorVerificationStatus.APPROVED) {
    return { approved: false, classification: "UNAPPROVED" as const };
  }
  const pilotFields = [profile.companyName, profile.registrationNumber]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.startsWith("PILOT TEST ONLY") || value.startsWith("PILOT-TEST-ONLY"));
  if (!pilotFields) return { approved: true, classification: "KYB_APPROVED" as const };

  const latestReview = profile.reviewEvents?.[0];
  const marker = parsePilotTestSponsorReviewNote(latestReview?.note);
  const wallet = typeof profile.wallet === "string" ? profile.wallet : null;
  const inviteAllowed = Boolean(wallet && config.pilot.inviteWallets.includes(wallet));
  const approved = Boolean(
    marker &&
    latestReview?.newStatus === SponsorVerificationStatus.APPROVED &&
    wallet === marker.wallet &&
    pilotRunId === marker.runId &&
    inviteAllowed
  );
  return {
    approved,
    classification: "PILOT_TEST_ONLY" as const,
    runIdMatched: Boolean(marker && pilotRunId === marker.runId),
    inviteAllowed,
  };
};

export const resolveProposalIntentReadiness = async (params: {
  creatorWallet: string;
  sponsorWallet: string;
  pilotRunId?: string | null;
  deps?: ProposalIntentReadinessDeps;
}) => {
  if (params.creatorWallet === params.sponsorWallet) {
    throw new HttpError(400, "DISTINCT_PARTICIPANTS_REQUIRED", "creator and sponsor must be distinct wallets");
  }
  const deps = params.deps ?? {
    fetchCreatorProfile: (wallet: PublicKey) =>
      getAnchorService().fetchCreatorProfileByWallet(wallet),
    fetchSponsorProfile: getSponsorProfileByWallet,
  };
  const [creatorProfile, sponsorProfile] = await Promise.all([
    deps.fetchCreatorProfile(new PublicKey(params.creatorWallet)),
    deps.fetchSponsorProfile(params.sponsorWallet),
  ]);
  const creatorReady = Boolean(
    creatorProfile && creatorProfile.level >= 2 && creatorProfile.status === "S2_ACTIVE"
  );
  const sponsorApproval = assessSponsorApprovalForUse(sponsorProfile, params.pilotRunId ?? null);
  const sponsorReady = sponsorApproval.approved;
  const blockers = [
    ...(creatorReady
      ? []
      : [{
          code: "CREATOR_NOT_S2_READY",
          message: "creator chain profile must be S2_ACTIVE with level >= 2",
        }]),
    ...(sponsorReady
      ? []
      : [{
          code: "SPONSOR_KYB_NOT_APPROVED",
          message: "sponsor database profile must be APPROVED",
        }]),
  ];

  return {
    ready: creatorReady && sponsorReady,
    creator: {
      wallet: params.creatorWallet,
      source: "SOLANA_CHAIN" as const,
      profileFound: creatorProfile !== null,
      level: creatorProfile?.level ?? null,
      status: creatorProfile?.status ?? null,
      ready: creatorReady,
    },
    sponsor: {
      wallet: params.sponsorWallet,
      source: "DATABASE" as const,
      status: sponsorProfile?.status ?? null,
      ready: sponsorReady,
      classification: sponsorApproval.classification,
    },
    blockers,
  };
};

export const getProposalIntentReadiness = withController(
  "GET_PROPOSAL_INTENT_READINESS_FAILED",
  async (req, res) => {
    const requesterWallet = getRequesterWallet(req);
    const creatorWallet = parseWallet(req.query.creatorWallet, "creatorWallet");
    const sponsorWallet = parseWallet(req.query.sponsorWallet, "sponsorWallet");
    if (requesterWallet !== sponsorWallet) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "the sponsor wallet must authorize readiness lookup"
      );
    }

    ok(res, await resolveProposalIntentReadiness({
      creatorWallet,
      sponsorWallet,
      pilotRunId: parsePilotRunId(req),
    }));
  }
);

const parseOptionalNonNegativeBigInt = (
  value: unknown,
  fieldName: string,
  fallback: bigint
): bigint => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return parseNonNegativeBigInt(value, fieldName);
};

const generateProposalNonce = (): bigint => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomBytes(8).readBigUInt64LE() & MAX_SIGNED_BIGINT_NONCE;
    if (candidate > 0n) {
      return candidate;
    }
  }

  throw new Error("unable to generate proposal nonce");
};

const allocateProposalNonce = async (
  creatorWallet: string,
  deadlineUnix: bigint
): Promise<bigint> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nonce = generateProposalNonce();
    const existing = await prisma.proposalIntent.findFirst({
      where: {
        creatorWallet,
        deadlineUnix,
        nonce,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return nonce;
    }
  }

  throw new HttpError(409, "PROPOSAL_NONCE_COLLISION", "unable to allocate a unique proposal nonce");
};

export const assertPilotTrackBudgetsAllowed = (params: {
  track2Enabled: boolean;
  track3Enabled: boolean;
  track2TargetValue: bigint;
  track2MinAchievementBps: number;
  track2UsdcDeposited: bigint;
  maxEndorsementSpump: bigint;
  track3UsdcDeposited: bigint;
  track3DelayDays: number;
}): void => {
  if (
    !params.track2Enabled &&
    (params.track2TargetValue > 0n ||
      params.track2MinAchievementBps > 0 ||
      params.track2UsdcDeposited > 0n ||
      params.maxEndorsementSpump > 0n)
  ) {
    throw new HttpError(
      409,
      "TRACK2_CLOSED_FOR_PILOT",
      "Track 2 budgets, metrics, and endorsements are closed for the invite-only Pilot"
    );
  }

  if (
    !params.track3Enabled &&
    (params.track3UsdcDeposited > 0n || params.track3DelayDays > 0)
  ) {
    throw new HttpError(
      409,
      "TRACK3_CLOSED_FOR_PILOT",
      "Track 3 CPS settlement is closed for the invite-only Pilot"
    );
  }
};

type StoredPilotTrackTerms = {
  track2TargetValue: bigint;
  track2MinAchievementBps: number;
  track2UsdcDeposited: bigint;
  maxEndorsementSpump: bigint;
  track3UsdcDeposited: bigint;
  track3DelayDays: number;
};

export const assertStoredIntentPilotTracksAllowed = (intent: StoredPilotTrackTerms): void => {
  assertPilotTrackBudgetsAllowed({
    track2Enabled: config.pilot.track2Enabled,
    track3Enabled: config.pilot.track3Enabled,
    ...intent,
  });
};

export const assertSponsorApprovedForFinalSubmit = (
  profile: SponsorApprovalProfile,
  pilotRunId: string | null = null
): void => {
  if (!assessSponsorApprovalForUse(profile, pilotRunId).approved) {
    throw new HttpError(
      403,
      "SPONSOR_KYB_NOT_APPROVED",
      "sponsor KYB approval must still be active immediately before final submission"
    );
  }
};

const recheckSponsorApprovalForFinalSubmit = async (
  sponsorWallet: string,
  pilotRunId: string | null
): Promise<void> => {
  assertSponsorApprovedForFinalSubmit(await getSponsorProfileByWallet(sponsorWallet), pilotRunId);
};

export const assertManifestReadyForProposalIntent = (params: {
  manifest: any;
  track1BaseUsdc: bigint;
  track2UsdcDeposited: bigint;
  track3UsdcDeposited: bigint;
}): void => {
  const { manifest } = params;
  if (!manifest.isPublicFeedEligible) {
    throw new HttpError(
      409,
      "MANIFEST_NOT_PUBLIC_FEED_ELIGIBLE",
      "content must be eligible for the public feed before creating a proposal intent"
    );
  }
  if (
    !Array.isArray(manifest.assets) ||
    manifest.assets.length === 0 ||
    !manifest.assets.every(
      (asset: any) => isSettlementAssetReady(asset) && isAssetPublicDeliveryReady(asset)
    )
  ) {
    throw new HttpError(
      409,
      "MANIFEST_ASSETS_NOT_VERIFIED",
      "all manifest assets must be storage-verified and delivery-ready before creating a proposal intent"
    );
  }
  if (
    !Array.isArray(manifest.publications) ||
    !manifest.publications.some(isOperatorApprovedPublication)
  ) {
    throw new HttpError(
      409,
      "OPERATOR_PUBLICATION_APPROVAL_REQUIRED",
      "an operator-approved publication is required before creating a proposal intent"
    );
  }
  if (
    params.track2UsdcDeposited === 0n &&
    params.track3UsdcDeposited === 0n &&
    params.track1BaseUsdc <= 0n
  ) {
    throw new HttpError(
      409,
      "TRACK1_BASE_USDC_REQUIRED",
      "Track 1-only proposals require a positive Track 1 base budget"
    );
  }
};

export const createProposalIntent = withController(
  "CREATE_PROPOSAL_INTENT_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const requesterWallet = getRequesterWallet(req);
    const recoveredIntentId = getRecoveredIdempotencyResourceId(req, "PROPOSAL_INTENT");
    if (recoveredIntentId) {
      const recovered = await prisma.proposalIntent.findFirst({
        where: {
          id: recoveredIntentId,
          OR: [{ creatorWallet: requesterWallet }, { sponsorWallet: requesterWallet }],
        },
      });
      if (!recovered) {
        throw new HttpError(409, "IDEMPOTENCY_RESOURCE_MISSING", "idempotent intent is missing");
      }
      ok(res, serializeIntent(recovered), 201);
      return;
    }
    const manifestId = parseNonEmptyString(req.body.manifestId, "manifestId");
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const sponsorWallet = parseWallet(req.body.sponsorWallet, "sponsorWallet");
    if (creatorWallet === sponsorWallet) {
      throw new HttpError(400, "DISTINCT_PARTICIPANTS_REQUIRED", "creator and sponsor must be distinct wallets");
    }

    if (requesterWallet !== creatorWallet && requesterWallet !== sponsorWallet) {
      throw new HttpError(403, "FORBIDDEN", "requester must be either creatorWallet or sponsorWallet");
    }

    const sponsorProfile = await getSponsorProfileByWallet(sponsorWallet);
    assertSponsorApprovedForFinalSubmit(sponsorProfile, parsePilotRunId(req));

    const track2MinAchievementBps = parseNonNegativeInt(
      req.body.track2MinAchievementBps,
      "track2MinAchievementBps"
    );

    if (track2MinAchievementBps > 10_000) {
      throw new HttpError(400, "INVALID_INPUT", "track2MinAchievementBps must be <= 10000");
    }

    const manifest = await prisma.contentManifest.findUnique({
      where: { id: manifestId },
      include: {
        assets: true,
        publications: true,
      },
    });

    if (!manifest) {
      throw new HttpError(404, "MANIFEST_NOT_FOUND", "content manifest not found");
    }

    if (manifest.creatorWallet !== creatorWallet) {
      throw new HttpError(409, "CREATOR_MANIFEST_MISMATCH", "manifest does not belong to creatorWallet");
    }

    if (
      manifest.status !== ContentManifestStatus.READY &&
      manifest.status !== ContentManifestStatus.ANCHORED &&
      manifest.status !== ContentManifestStatus.PUBLISHED &&
      manifest.status !== ContentManifestStatus.LOCKED
    ) {
      throw new HttpError(
        409,
        "MANIFEST_NOT_FINALIZED",
        "manifest must be READY, ANCHORED, PUBLISHED or LOCKED before creating an intent"
      );
    }

    const creatorProfile = await getAnchorService().fetchCreatorProfileByWallet(
      new PublicKey(creatorWallet)
    );

    if (!creatorProfile || creatorProfile.level < 2 || creatorProfile.status !== "S2_ACTIVE") {
      throw new HttpError(
        409,
        "CREATOR_NOT_S2_READY",
        "creator must have an on-chain S2_ACTIVE profile with level >= 2 before launching a sponsored proposal"
      );
    }

    const deadlineUnix = parseNonNegativeBigInt(req.body.deadlineUnix, "deadlineUnix");
    const nonce = await allocateProposalNonce(creatorWallet, deadlineUnix);
    const maxEndorsementSpump = parseOptionalNonNegativeBigInt(
      req.body.maxEndorsementSpump,
      "maxEndorsementSpump",
      0n
    );
    const track2TargetValue = parseNonNegativeBigInt(
      req.body.track2TargetValue,
      "track2TargetValue"
    );
    const track2UsdcDeposited = parseNonNegativeBigInt(
      req.body.track2UsdcDeposited,
      "track2UsdcDeposited"
    );
    const track3UsdcDeposited = parseNonNegativeBigInt(
      req.body.track3UsdcDeposited,
      "track3UsdcDeposited"
    );
    const track3DelayDays = parseNonNegativeInt(req.body.track3DelayDays, "track3DelayDays");
    const track1BaseUsdc = parseNonNegativeBigInt(
      req.body.track1BaseUsdc,
      "track1BaseUsdc"
    );

    assertPilotTrackBudgetsAllowed({
      track2Enabled: config.pilot.track2Enabled,
      track3Enabled: config.pilot.track3Enabled,
      track2TargetValue,
      track2MinAchievementBps,
      track2UsdcDeposited,
      maxEndorsementSpump,
      track3UsdcDeposited,
      track3DelayDays,
    });
    assertManifestReadyForProposalIntent({
      manifest,
      track1BaseUsdc,
      track2UsdcDeposited,
      track3UsdcDeposited,
    });

    const intent = await prisma.$transaction(async (tx) => {
      const created = await tx.proposalIntent.create({
        data: {
          creatorWallet,
          sponsorWallet,
          sponsorOrgId: parseOptionalString(req.body.sponsorOrgId),
          creatorOrgId: parseOptionalString(req.body.creatorOrgId),
          manifestId,
          deadlineUnix,
          nonce,
          track1BaseUsdc,
          track2MetricType: parseTrack2MetricType(req.body.track2MetricType),
          track2TargetValue,
          track2MinAchievementBps,
          track2UsdcDeposited,
          track3UsdcDeposited,
          track3DelayDays,
          maxEndorsementSpump,
        },
      });
      await bindApiIdempotencyResource(tx, req, "PROPOSAL_INTENT", created.id);
      return created;
    });

    ok(res, serializeIntent(intent), 201);
  }
);

export const lockProposalIntent = withController("LOCK_PROPOSAL_INTENT_FAILED", async (req, res) => {
  ensureIdempotencyKey(req);

  const requesterWallet = getRequesterWallet(req);
  const intentId = parseNonEmptyString(req.params.intentId, "intentId");
  const intent = await prisma.proposalIntent.findUnique({
    where: { id: intentId },
    include: {
      manifest: true,
    },
  });

  if (!intent) {
    throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
  }

  assertProposalIntentParticipant(requesterWallet, intent);
  assertStoredIntentPilotTracksAllowed(intent);

  const recoveredLockedIntentId = getRecoveredIdempotencyResourceId(
    req,
    "LOCKED_PROPOSAL_INTENT"
  );
  if (recoveredLockedIntentId) {
    if (recoveredLockedIntentId !== intent.id) {
      throw new HttpError(409, "IDEMPOTENCY_RESOURCE_MISMATCH", "idempotent lock resource mismatch");
    }
    ok(res, serializeIntent(intent));
    return;
  }

  if (intent.status !== ProposalIntentStatus.DRAFT) {
    throw new HttpError(409, "INTENT_ALREADY_LOCKED", "proposal intent is already locked");
  }

  if (!intent.manifest.manifestHashHex) {
    throw new HttpError(409, "MANIFEST_HASH_MISSING", "manifest must be finalized before locking");
  }

  const derived = deriveIntentAddresses({
    creatorWallet: intent.creatorWallet,
    deadlineUnix: intent.deadlineUnix,
    nonce: intent.nonce,
  });

  const locked = await prisma.$transaction(async (tx) => {
    const updatedIntent = await tx.proposalIntent.update({
      where: { id: intent.id },
      data: {
        status: ProposalIntentStatus.TERMS_LOCKED,
        version: {
          increment: 1,
        },
        lockedManifestHashHex: intent.manifest.manifestHashHex,
        lockedAnchorPda: intent.manifest.currentAnchorPda,
        plannedProposalPda: derived.proposalPda,
        plannedUsdcVaultPda: derived.proposalUsdcVaultPda,
      },
    });

    if (intent.manifest.status === ContentManifestStatus.READY) {
      await tx.contentManifest.update({
        where: { id: intent.manifest.id },
        data: {
          status: ContentManifestStatus.LOCKED,
        },
      });
    }

    await bindApiIdempotencyResource(tx, req, "LOCKED_PROPOSAL_INTENT", updatedIntent.id);

    return updatedIntent;
  });

  ok(res, serializeIntent(locked));
});

export const buildProposalLaunchBundle = withController(
  "BUILD_PROPOSAL_BUNDLE_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const requesterWallet = getRequesterWallet(req);
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    const submitMode = parseBundleSubmitMode(req.body.submitMode);
    const forceRebuild = parseBooleanFlag(req.body.forceRebuild);
    const intent = await prisma.proposalIntent.findUnique({
      where: { id: intentId },
      include: {
        manifest: true,
        txBundles: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!intent) {
      throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
    }

    assertProposalIntentParticipant(requesterWallet, intent);
    assertStoredIntentPilotTracksAllowed(intent);

    const recoveredBundleId = getRecoveredIdempotencyResourceId(req, "TX_BUNDLE");
    if (recoveredBundleId) {
      const recoveredBundle = await prisma.txBundle.findFirst({
        where: { id: recoveredBundleId, intentId: intent.id },
      });
      if (!recoveredBundle) {
        throw new HttpError(409, "IDEMPOTENCY_RESOURCE_MISSING", "idempotent bundle is missing");
      }
      ok(res, {
        intentId: intent.id,
        plannedProposalPda: intent.plannedProposalPda,
        plannedContentAnchorPda: derivePlannedContentAnchorPda({
          creatorWallet: intent.creatorWallet,
          manifest: intent.manifest,
          lockedAnchorPda: intent.lockedAnchorPda,
        }),
        bundle: serializeBundle(recoveredBundle),
        reused: true,
      });
      return;
    }

    if (intent.txBundles[0] && !forceRebuild && isBundleReusable(intent.txBundles[0])) {
      ok(res, {
        intentId: intent.id,
        plannedProposalPda: intent.plannedProposalPda,
        plannedContentAnchorPda: derivePlannedContentAnchorPda({
          creatorWallet: intent.creatorWallet,
          manifest: intent.manifest,
          lockedAnchorPda: intent.lockedAnchorPda,
        }),
        bundle: serializeBundle(intent.txBundles[0]),
        reused: true,
      });
      return;
    }

    if (
      intent.status !== ProposalIntentStatus.TERMS_LOCKED &&
      intent.status !== ProposalIntentStatus.BUNDLE_BUILT &&
      intent.status !== ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED &&
      intent.status !== ProposalIntentStatus.SPONSOR_SIGNED &&
      intent.status !== ProposalIntentStatus.SUBMITTED &&
      intent.status !== ProposalIntentStatus.FAILED &&
      intent.status !== ProposalIntentStatus.EXPIRED
    ) {
      throw new HttpError(
        409,
        "INTENT_NOT_REBUILDABLE",
        "proposal intent must be terms-locked or in a rebuildable launch state before build"
      );
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const assembled = await buildLaunchBundleTransaction({
      intent,
      manifest: intent.manifest,
    });

    const bundle = await prisma.$transaction(async (tx) => {
      const latestBundle = intent.txBundles[0];

      if (latestBundle && latestBundle.status !== BundleStatus.CONFIRMED && isBundleExpired(latestBundle)) {
        await tx.txBundle.update({
          where: { id: latestBundle.id },
          data: {
            status: BundleStatus.EXPIRED,
            errorMessage: "bundle expired before submission completed",
          },
        });
      }

      const createdBundle = await tx.txBundle.create({
        data: buildBundleRecord({
          intent,
          instructionPlan: assembled.instructionPlan,
          submitMode,
          expiresAt,
          versionedTxBase64: assembled.versionedTxBase64,
          recentBlockhash: assembled.recentBlockhash,
          lastValidBlockHeight: assembled.lastValidBlockHeight,
        }),
      });

      await bindApiIdempotencyResource(tx, req, "TX_BUNDLE", createdBundle.id);

      await tx.proposalIntent.update({
        where: { id: intent.id },
        data: {
          status: ProposalIntentStatus.BUNDLE_BUILT,
          version: {
            increment: 1,
          },
          creatorApprovedAt: null,
          sponsorApprovedAt: null,
          chainTxSignature: null,
          chainSubmittedAt: null,
          chainConfirmedAt: null,
          failureReason: null,
        },
      });

      return createdBundle;
    });

    ok(res, {
      intentId: intent.id,
      plannedProposalPda: intent.plannedProposalPda,
      plannedContentAnchorPda: assembled.plannedContentAnchorPda,
      bundle: serializeBundle(bundle),
      reused: false,
    });
  }
);

export const creatorPartialSignBundle = withController(
  "CREATOR_PARTIAL_SIGN_FAILED",
  async (req, res) => {
    ensureIdempotencyKey(req);

    const requesterWallet = getRequesterWallet(req);
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    const bundleId = parseNonEmptyString(req.body.bundleId, "bundleId");
    const partiallySignedTxBase64 = parseNonEmptyString(
      req.body.partiallySignedTxBase64,
      "partiallySignedTxBase64"
    );

    const intent = await prisma.proposalIntent.findUnique({
      where: { id: intentId },
    });

    if (!intent) {
      throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
    }

    if (requesterWallet !== intent.creatorWallet) {
      throw new HttpError(403, "FORBIDDEN", "only the creator can submit the partial signature");
    }
    assertStoredIntentPilotTracksAllowed(intent);

    const bundle = await prisma.txBundle.findFirst({
      where: {
        id: bundleId,
        intentId,
      },
    });

    if (!bundle) {
      throw new HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
    }

    if (
      bundle.status === BundleStatus.PARTIAL &&
      bundle.partiallySignedBase64 === partiallySignedTxBase64
    ) {
      ok(res, {
        intentId,
        bundle: serializeBundle(bundle),
        replayed: true,
      });
      return;
    }

    if (bundle.status !== BundleStatus.BUILT) {
      throw new HttpError(409, "BUNDLE_NOT_BUILDABLE", "bundle must be in BUILT status");
    }

    if (!bundle.messageBase64) {
      throw new HttpError(409, "BUNDLE_MESSAGE_MISSING", "bundle is missing serialized transaction data");
    }

    if (bundle.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(409, "BUNDLE_EXPIRED", "bundle has expired and must be rebuilt");
    }

    assertTransactionMessageMatches(bundle.messageBase64, partiallySignedTxBase64);
    assertRequiredSignerPresent(partiallySignedTxBase64, intent.creatorWallet);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBundle = await tx.txBundle.update({
        where: { id: bundle.id },
        data: {
          partiallySignedBase64: partiallySignedTxBase64,
          status: BundleStatus.PARTIAL,
          errorMessage: null,
        },
      });

      await tx.proposalIntent.update({
        where: { id: intent.id },
        data: {
          status: ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED,
          version: {
            increment: 1,
          },
          creatorApprovedAt: new Date(),
        },
      });

      return updatedBundle;
    });

    ok(res, {
      intentId,
      bundle: serializeBundle(updated),
      replayed: false,
    });
  }
);

export const submitProposalBundle = withController("SUBMIT_PROPOSAL_BUNDLE_FAILED", async (req, res) => {
  ensureIdempotencyKey(req);

  const requesterWallet = getRequesterWallet(req);
  const intentId = parseNonEmptyString(req.params.intentId, "intentId");
  const bundleId = parseNonEmptyString(req.body.bundleId, "bundleId");
  const fullySignedTxBase64 = parseNonEmptyString(req.body.fullySignedTxBase64, "fullySignedTxBase64");

  const intent = await prisma.proposalIntent.findUnique({
    where: { id: intentId },
  });

  if (!intent) {
    throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
  }

  if (requesterWallet !== intent.sponsorWallet) {
    throw new HttpError(403, "FORBIDDEN", "only the sponsor can submit the final signature");
  }
  assertStoredIntentPilotTracksAllowed(intent);

  const bundle = await prisma.txBundle.findFirst({
    where: {
      id: bundleId,
      intentId,
    },
  });

  if (!bundle) {
    throw new HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
  }

  if (
    bundle.status !== BundleStatus.PARTIAL &&
    bundle.status !== BundleStatus.FAILED &&
    bundle.status !== BundleStatus.FULLY_SIGNED &&
    bundle.status !== BundleStatus.SUBMITTED &&
    bundle.status !== BundleStatus.CONFIRMED
  ) {
    throw new HttpError(
      409,
      "BUNDLE_NOT_READY",
      "bundle must be partial, failed, or already submitted before final sponsor submission"
    );
  }

  if (!bundle.messageBase64 || !bundle.recentBlockhash || bundle.lastValidBlockHeight === null) {
    throw new HttpError(409, "BUNDLE_MESSAGE_MISSING", "bundle is missing relay metadata");
  }

  if (bundle.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(409, "BUNDLE_EXPIRED", "bundle has expired and must be rebuilt");
  }

  const chainTxSignature = extractTransactionSignature(fullySignedTxBase64);

  if (bundle.chainTxSignature && bundle.chainTxSignature !== chainTxSignature) {
    throw new HttpError(
      409,
      "BUNDLE_SIGNATURE_MISMATCH",
      "submitted transaction signature does not match the stored bundle signature"
    );
  }

  if (bundle.chainTxSignature && bundle.status === BundleStatus.CONFIRMED) {
    ok(res, {
      intentId,
      bundle: serializeBundle(bundle),
      relayStatus: "ALREADY_CONFIRMED",
      chainTxSignature: bundle.chainTxSignature,
    });
    return;
  }

  assertTransactionMessageMatches(bundle.messageBase64, fullySignedTxBase64);
  assertRequiredSignerPresent(fullySignedTxBase64, intent.creatorWallet);
  assertRequiredSignerPresent(fullySignedTxBase64, intent.sponsorWallet);

  if (bundle.submitMode === BundleSubmitMode.CLIENT_RELAY) {
    await recheckSponsorApprovalForFinalSubmit(intent.sponsorWallet, parsePilotRunId(req));
    if (bundle.status === BundleStatus.FULLY_SIGNED && bundle.fullySignedBase64 === fullySignedTxBase64) {
      ok(res, {
        intentId,
        bundle: serializeBundle(bundle),
        relayStatus: "CLIENT_RELAY_PENDING",
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBundle = await tx.txBundle.update({
        where: { id: bundle.id },
        data: {
          fullySignedBase64: fullySignedTxBase64,
          status: BundleStatus.FULLY_SIGNED,
          chainTxSignature,
          errorMessage: null,
        },
      });

      await tx.proposalIntent.update({
        where: { id: intent.id },
        data: {
          status: ProposalIntentStatus.SPONSOR_SIGNED,
          version: {
            increment: 1,
          },
          sponsorApprovedAt: new Date(),
          chainTxSignature,
        },
      });

      return updatedBundle;
    });

    ok(res, {
      intentId,
      bundle: serializeBundle(updated),
      relayStatus: "CLIENT_RELAY_PENDING",
    });
    return;
  }

  const anchorService = getAnchorService();

  if (bundle.status === BundleStatus.SUBMITTED && bundle.chainTxSignature === chainTxSignature) {
    const signatureState = await anchorService.getSignatureState(chainTxSignature);

    if (signatureState === "SUCCESS") {
      const confirmedProposal = await finalizeConfirmedLaunchBundle({
        intentId,
        bundleId: bundle.id,
        fullySignedTxBase64,
        chainTxSignature,
      });

      ok(res, {
        intentId,
        bundle: serializeBundle(confirmedProposal),
        relayStatus: "CONFIRMED",
        chainTxSignature,
      });
      return;
    }

    if (signatureState === "PENDING") {
      ok(res, {
        intentId,
        bundle: serializeBundle(bundle),
        relayStatus: "SUBMITTED_PENDING",
        chainTxSignature,
      });
      return;
    }
  }

  await recheckSponsorApprovalForFinalSubmit(intent.sponsorWallet, parsePilotRunId(req));

  const submittedBundle = await prisma.$transaction(async (tx) => {
    const updatedBundle = await tx.txBundle.update({
      where: { id: bundle.id },
      data: {
        fullySignedBase64: fullySignedTxBase64,
        status: BundleStatus.SUBMITTED,
        chainTxSignature,
        errorMessage: null,
      },
    });

    await tx.proposalIntent.update({
      where: { id: intent.id },
      data: {
        status: ProposalIntentStatus.SUBMITTED,
        version: {
          increment: 1,
        },
        sponsorApprovedAt: new Date(),
        chainTxSignature,
        chainSubmittedAt: new Date(),
        failureReason: null,
      },
    });

    return updatedBundle;
  });

  try {
    const submittedSignature = await anchorService.sendVersionedTransaction(fullySignedTxBase64);

    if (submittedSignature !== chainTxSignature) {
      throw new Error(
        `submitted signature mismatch: expected ${chainTxSignature}, got ${submittedSignature}`
      );
    }

    await anchorService.confirmSubmittedVersionedTransaction({
      signature: chainTxSignature,
      recentBlockhash: bundle.recentBlockhash,
      lastValidBlockHeight: bundle.lastValidBlockHeight,
    });

    const confirmedProposal = await finalizeConfirmedLaunchBundle({
      intentId,
      bundleId: bundle.id,
      fullySignedTxBase64,
      chainTxSignature,
    });

    ok(res, {
      intentId,
      bundle: serializeBundle(confirmedProposal),
      relayStatus: "CONFIRMED",
      chainTxSignature,
    });
    return;
  } catch (error) {
    const signatureState = await anchorService.getSignatureState(chainTxSignature);

    if (signatureState === "SUCCESS") {
      const confirmedProposal = await finalizeConfirmedLaunchBundle({
        intentId,
        bundleId: bundle.id,
        fullySignedTxBase64,
        chainTxSignature,
      });

      ok(res, {
        intentId,
        bundle: serializeBundle(confirmedProposal),
        relayStatus: "CONFIRMED",
        chainTxSignature,
      });
      return;
    }

    if (signatureState === "PENDING") {
      ok(res, {
        intentId,
        bundle: serializeBundle(submittedBundle),
        relayStatus: "SUBMITTED_PENDING",
        chainTxSignature,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.txBundle.update({
        where: { id: bundle.id },
        data: {
          status: BundleStatus.FAILED,
          chainTxSignature,
          fullySignedBase64: fullySignedTxBase64,
          errorMessage: error instanceof Error ? error.message : "bundle relay failed",
        },
      });

      await tx.proposalIntent.update({
        where: { id: intent.id },
        data: {
          status: ProposalIntentStatus.FAILED,
          version: {
            increment: 1,
          },
          failureReason: error instanceof Error ? error.message : "bundle relay failed",
        },
      });
    });

    throw new HttpError(
      502,
      "BUNDLE_RELAY_FAILED",
      error instanceof Error ? error.message : "bundle relay failed"
    );
  }
});

export const getProposalIntentStatus = withController(
  "GET_PROPOSAL_INTENT_STATUS_FAILED",
  async (req, res) => {
    const requesterWallet = requireSessionWallet(req);
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    const intent = await prisma.proposalIntent.findUnique({
      where: { id: intentId },
      include: {
        txBundles: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!intent) {
      throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
    }

    assertProposalIntentParticipant(requesterWallet, intent);

    ok(res, {
      intent: serializeIntent(intent),
      latestBundle: intent.txBundles[0] ? serializeBundle(intent.txBundles[0]) : null,
    });
  }
);

export const listProposalIntents = withController("LIST_PROPOSAL_INTENTS_FAILED", async (req, res) => {
  const requesterWallet = requireSessionWallet(req);
  const intents = await prisma.proposalIntent.findMany({
    where: {
      OR: [{ creatorWallet: requesterWallet }, { sponsorWallet: requesterWallet }],
    },
    include: {
      manifest: {
        select: {
          id: true,
          title: true,
          status: true,
          contentType: true,
          manifestHashHex: true,
          currentAnchorPda: true,
        },
      },
      txBundles: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  ok(
    res,
    intents.map((intent) => serializeProposalIntentListItem(intent, requesterWallet))
  );
});

export const getProposalIntentById = withController("GET_PROPOSAL_INTENT_FAILED", async (req, res) => {
  const requesterWallet = requireSessionWallet(req);
  const intentId = parseNonEmptyString(req.params.intentId, "intentId");
  const intent = await prisma.proposalIntent.findUnique({
    where: { id: intentId },
    include: {
      manifest: {
        include: {
          assets: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      },
      txBundles: {
        orderBy: {
          createdAt: "desc",
        },
      },
      proposal: true,
    },
  });

  if (!intent) {
    throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
  }

  assertProposalIntentParticipant(requesterWallet, intent);

  ok(res, serializeProposalIntentDetail(intent, requesterWallet));
});

export const getProposalById = withController("GET_PROPOSAL_FAILED", async (req, res) => {
  const id = parseNonEmptyString(req.params.id, "id");
  const proposal = await prisma.proposal.findFirst({
    where: {
      OR: [{ id }, { proposalPda: id }],
    },
  });

  if (!proposal) {
    throw new HttpError(404, "PROPOSAL_NOT_FOUND", "proposal not found");
  }

  const requesterWallet = req.auth?.source === "session" ? req.auth.wallet : null;
  const isCreatorOrSponsor =
    requesterWallet !== null &&
    (requesterWallet === proposal.creatorWallet || requesterWallet === proposal.sponsorWallet);

  if (isCreatorOrSponsor) {
    ok(res, {
      viewerRole: "CREATOR_OR_SPONSOR",
      proposal: serializeProposal(proposal),
    });
    return;
  }

  ok(res, {
    viewerRole: "PUBLIC_FAN",
    proposal: serializePublicProposalView(proposal),
  });
});

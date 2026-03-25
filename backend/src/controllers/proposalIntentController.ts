import {
  BundleStatus,
  BundleSubmitMode,
  ContentManifestStatus,
  Proposal,
  ProposalIntent,
  ProposalIntentStatus,
  Track2MetricType,
} from "@prisma/client";
import { Request, Response } from "express";

import {
  HttpError,
  ensureIdempotencyKey,
  handleControllerError,
  ok,
  parseNonEmptyString,
  parseNonNegativeBigInt,
  parseNonNegativeInt,
  parseOptionalString,
  parseOptionalWallet,
  parseWallet,
} from "./http";
import {
  buildBundleSkeletonRecord,
  buildInstructionPlan,
  deriveIntentAddresses,
} from "../services/proposalLaunchService";
import { prisma } from "../services/prisma";

const parseTrack2MetricType = (value: unknown): Track2MetricType => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "VIEWS" || normalized === "VIEW") {
    return Track2MetricType.VIEWS;
  }

  if (normalized === "CLICKS" || normalized === "CLICK") {
    return Track2MetricType.CLICKS;
  }

  if (normalized === "SAVES" || normalized === "SAVE") {
    return Track2MetricType.SAVES;
  }

  throw new HttpError(400, "INVALID_INPUT", "track2MetricType must be one of: VIEWS, CLICKS, SAVES");
};

const parseBundleSubmitMode = (value: unknown): BundleSubmitMode => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "SERVER_RELAY") {
    return BundleSubmitMode.SERVER_RELAY;
  }

  if (normalized === "CLIENT_RELAY") {
    return BundleSubmitMode.CLIENT_RELAY;
  }

  throw new HttpError(400, "INVALID_INPUT", "submitMode must be SERVER_RELAY or CLIENT_RELAY");
};

const getRequesterWallet = (req: Request): string => parseWallet(req.header("x-wallet-address"), "x-wallet-address");

const serializeIntent = (intent: ProposalIntent) => ({
  intentId: intent.id,
  status: intent.status,
  version: intent.version,
  creatorWallet: intent.creatorWallet,
  sponsorWallet: intent.sponsorWallet,
  sponsorOrgId: intent.sponsorOrgId,
  creatorOrgId: intent.creatorOrgId,
  manifestId: intent.manifestId,
  lockedManifestHashHex: intent.lockedManifestHashHex,
  lockedAnchorPda: intent.lockedAnchorPda,
  deadlineUnix: intent.deadlineUnix.toString(),
  track1BaseUsdc: intent.track1BaseUsdc.toString(),
  track2MetricType: intent.track2MetricType,
  track2TargetValue: intent.track2TargetValue.toString(),
  track2MinAchievementBps: intent.track2MinAchievementBps,
  track3UsdcDeposited: intent.track3UsdcDeposited.toString(),
  track3DelayDays: intent.track3DelayDays,
  plannedProposalPda: intent.plannedProposalPda,
  plannedUsdcVaultPda: intent.plannedUsdcVaultPda,
  creatorApprovedAt: intent.creatorApprovedAt?.toISOString() ?? null,
  sponsorApprovedAt: intent.sponsorApprovedAt?.toISOString() ?? null,
  chainTxSignature: intent.chainTxSignature,
  chainSubmittedAt: intent.chainSubmittedAt?.toISOString() ?? null,
  chainConfirmedAt: intent.chainConfirmedAt?.toISOString() ?? null,
  failureReason: intent.failureReason,
  createdAt: intent.createdAt.toISOString(),
  updatedAt: intent.updatedAt.toISOString(),
});

const serializeBundle = (bundle: {
  id: string;
  status: string;
  submitMode: string;
  instructionPlanJson: unknown;
  requiredSignersJson: unknown;
  messageBase64: string | null;
  recentBlockhash: string | null;
  lastValidBlockHeight: bigint | null;
  expiresAt: Date;
  chainTxSignature: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  bundleId: bundle.id,
  status: bundle.status,
  submitMode: bundle.submitMode,
  instructionPlan: bundle.instructionPlanJson,
  requiredSigners: bundle.requiredSignersJson,
  versionedTxBase64: bundle.messageBase64,
  recentBlockhash: bundle.recentBlockhash,
  lastValidBlockHeight: bundle.lastValidBlockHeight?.toString() ?? null,
  expiresAt: bundle.expiresAt.toISOString(),
  chainTxSignature: bundle.chainTxSignature,
  errorMessage: bundle.errorMessage,
  createdAt: bundle.createdAt.toISOString(),
  updatedAt: bundle.updatedAt.toISOString(),
});

const serializeProposal = (proposal: Proposal) => ({
  id: proposal.id,
  proposalPda: proposal.proposalPda,
  creatorWallet: proposal.creatorWallet,
  sponsorWallet: proposal.sponsorWallet,
  deadlineAt: proposal.deadlineAt.toISOString(),
  status: proposal.status,
  track1BaseUsdc: proposal.track1BaseUsdc.toString(),
  track1Claimed: proposal.track1Claimed,
  track2MetricType: proposal.track2MetricType,
  track2TargetValue: proposal.track2TargetValue.toString(),
  track2MinAchievementBps: proposal.track2MinAchievementBps,
  track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
  track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
  track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
  track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
  track3CpsPayout: proposal.track3CpsPayout?.toString() ?? null,
  track3DelayDays: proposal.track3DelayDays,
  track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
  onChainTxSignature: proposal.onChainTxSignature,
  oracleSyncStatus: proposal.oracleSyncStatus,
  contentHashHex: proposal.contentHashHex,
  contentAnchorPda: proposal.contentAnchorPda,
  createdAt: proposal.createdAt.toISOString(),
  updatedAt: proposal.updatedAt.toISOString(),
});

const assertParticipant = (requesterWallet: string, intent: ProposalIntent): void => {
  if (requesterWallet !== intent.creatorWallet && requesterWallet !== intent.sponsorWallet) {
    throw new HttpError(403, "FORBIDDEN", "requester must be the creator or sponsor of the intent");
  }
};

export const createProposalIntent = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const requesterWallet = getRequesterWallet(req);
    const manifestId = parseNonEmptyString(req.body.manifestId, "manifestId");
    const creatorWallet = parseWallet(req.body.creatorWallet, "creatorWallet");
    const sponsorWallet = parseWallet(req.body.sponsorWallet, "sponsorWallet");

    if (requesterWallet !== creatorWallet && requesterWallet !== sponsorWallet) {
      throw new HttpError(403, "FORBIDDEN", "requester must be either creatorWallet or sponsorWallet");
    }

    const track2MinAchievementBps = parseNonNegativeInt(
      req.body.track2MinAchievementBps,
      "track2MinAchievementBps"
    );

    if (track2MinAchievementBps > 10_000) {
      throw new HttpError(400, "INVALID_INPUT", "track2MinAchievementBps must be <= 10000");
    }

    const manifest = await prisma.contentManifest.findUnique({
      where: { id: manifestId },
      select: {
        id: true,
        creatorWallet: true,
        status: true,
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

    const intent = await prisma.proposalIntent.create({
      data: {
        creatorWallet,
        sponsorWallet,
        sponsorOrgId: parseOptionalString(req.body.sponsorOrgId),
        creatorOrgId: parseOptionalString(req.body.creatorOrgId),
        manifestId,
        deadlineUnix: parseNonNegativeBigInt(req.body.deadlineUnix, "deadlineUnix"),
        track1BaseUsdc: parseNonNegativeBigInt(req.body.track1BaseUsdc, "track1BaseUsdc"),
        track2MetricType: parseTrack2MetricType(req.body.track2MetricType),
        track2TargetValue: parseNonNegativeBigInt(req.body.track2TargetValue, "track2TargetValue"),
        track2MinAchievementBps,
        track3UsdcDeposited: parseNonNegativeBigInt(
          req.body.track3UsdcDeposited,
          "track3UsdcDeposited"
        ),
        track3DelayDays: parseNonNegativeInt(req.body.track3DelayDays, "track3DelayDays"),
      },
    });

    ok(res, serializeIntent(intent), 201);
  } catch (error) {
    handleControllerError(res, error, "CREATE_PROPOSAL_INTENT_FAILED");
  }
};

export const lockProposalIntent = async (req: Request, res: Response) => {
  try {
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

    assertParticipant(requesterWallet, intent);

    if (intent.status !== ProposalIntentStatus.DRAFT) {
      throw new HttpError(409, "INTENT_ALREADY_LOCKED", "proposal intent is already locked");
    }

    if (!intent.manifest.manifestHashHex) {
      throw new HttpError(409, "MANIFEST_HASH_MISSING", "manifest must be finalized before locking");
    }

    const derived = deriveIntentAddresses({
      creatorWallet: intent.creatorWallet,
      deadlineUnix: intent.deadlineUnix,
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

      return updatedIntent;
    });

    ok(res, serializeIntent(locked));
  } catch (error) {
    handleControllerError(res, error, "LOCK_PROPOSAL_INTENT_FAILED");
  }
};

export const buildProposalLaunchBundle = async (req: Request, res: Response) => {
  try {
    ensureIdempotencyKey(req);

    const requesterWallet = getRequesterWallet(req);
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    const submitMode = parseBundleSubmitMode(req.body.submitMode);
    const intent = await prisma.proposalIntent.findUnique({
      where: { id: intentId },
      include: {
        manifest: true,
      },
    });

    if (!intent) {
      throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
    }

    assertParticipant(requesterWallet, intent);

    if (intent.status !== ProposalIntentStatus.TERMS_LOCKED) {
      throw new HttpError(409, "INTENT_NOT_LOCKED", "proposal intent must be TERMS_LOCKED before build");
    }

    const instructionPlan = buildInstructionPlan(intent.manifest, intent);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const bundle = await prisma.$transaction(async (tx) => {
      const createdBundle = await tx.txBundle.create({
        data: buildBundleSkeletonRecord({
          intent,
          instructionPlan,
          submitMode,
          expiresAt,
        }),
      });

      await tx.proposalIntent.update({
        where: { id: intent.id },
        data: {
          status: ProposalIntentStatus.BUNDLE_BUILT,
          version: {
            increment: 1,
          },
        },
      });

      return createdBundle;
    });

    ok(res, {
      intentId: intent.id,
      plannedProposalPda: intent.plannedProposalPda,
      plannedContentAnchorPda: intent.manifest.currentAnchorPda,
      bundle: serializeBundle(bundle),
      note: "This route is intentionally a skeleton. Atomic VersionedTransaction assembly is the next implementation step.",
    });
  } catch (error) {
    handleControllerError(res, error, "BUILD_PROPOSAL_BUNDLE_FAILED");
  }
};

export const creatorPartialSignBundle = async (req: Request, res: Response) => {
  try {
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

    const bundle = await prisma.txBundle.findFirst({
      where: {
        id: bundleId,
        intentId,
      },
    });

    if (!bundle) {
      throw new HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
    }

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
    });
  } catch (error) {
    handleControllerError(res, error, "CREATOR_PARTIAL_SIGN_FAILED");
  }
};

export const submitProposalBundle = async (req: Request, res: Response) => {
  try {
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

    const bundle = await prisma.txBundle.findFirst({
      where: {
        id: bundleId,
        intentId,
      },
    });

    if (!bundle) {
      throw new HttpError(404, "BUNDLE_NOT_FOUND", "tx bundle not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBundle = await tx.txBundle.update({
        where: { id: bundle.id },
        data: {
          fullySignedBase64: fullySignedTxBase64,
          status: BundleStatus.FULLY_SIGNED,
          errorMessage: "Relay submission is not implemented in this skeleton yet.",
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
        },
      });

      return updatedBundle;
    });

    ok(res, {
      intentId,
      bundle: serializeBundle(updated),
      relayStatus: "PENDING_IMPLEMENTATION",
    });
  } catch (error) {
    handleControllerError(res, error, "SUBMIT_PROPOSAL_BUNDLE_FAILED");
  }
};

export const getProposalIntentStatus = async (req: Request, res: Response) => {
  try {
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

    ok(res, {
      intent: serializeIntent(intent),
      latestBundle: intent.txBundles[0] ? serializeBundle(intent.txBundles[0]) : null,
    });
  } catch (error) {
    handleControllerError(res, error, "GET_PROPOSAL_INTENT_STATUS_FAILED");
  }
};

export const getProposalById = async (req: Request, res: Response) => {
  try {
    const id = parseNonEmptyString(req.params.id, "id");
    const proposal = await prisma.proposal.findFirst({
      where: {
        OR: [{ id }, { proposalPda: id }],
      },
    });

    if (!proposal) {
      throw new HttpError(404, "PROPOSAL_NOT_FOUND", "proposal not found");
    }

    const requesterWallet = parseOptionalWallet(req.header("x-wallet-address"), "x-wallet-address");
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
      proposal: {
        id: proposal.id,
        proposalPda: proposal.proposalPda,
        creatorWallet: proposal.creatorWallet,
        deadlineAt: proposal.deadlineAt.toISOString(),
        status: proposal.status,
        track2MetricType: proposal.track2MetricType,
        track2TargetValue: proposal.track2TargetValue.toString(),
        track2MinAchievementBps: proposal.track2MinAchievementBps,
        track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
        track2ActualValue: proposal.track2ActualValue?.toString() ?? null,
        track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    handleControllerError(res, error, "GET_PROPOSAL_FAILED");
  }
};

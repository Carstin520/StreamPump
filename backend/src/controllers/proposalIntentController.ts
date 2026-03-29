/**
 * CN: Proposal intent 控制器，管理从业务草稿到真实 v0 launch bundle 的后端状态机。
 * EN: Proposal intent controller that manages the backend state machine from business draft to a real v0 launch bundle.
 */
import {
  BundleStatus,
  BundleSubmitMode,
  ContentManifestStatus,
  OracleSyncStatus,
  Proposal,
  ProposalStatus,
  ProposalIntent,
  ProposalIntentStatus,
  Track2MetricType,
} from "@prisma/client";
import bs58 from "bs58";
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
  assertRequiredSignerPresent,
  assertTransactionMessageMatches,
  buildBundleRecord,
  decodeVersionedTransaction,
  buildLaunchBundleTransaction,
  buildInstructionPlan,
  derivePlannedContentAnchorPda,
  deriveIntentAddresses,
} from "../services/proposalLaunchService";
import { prisma } from "../services/prisma";
import { getAnchorService } from "../services/AnchorService";

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

const parseOptionalBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const getRequesterWallet = (req: Request): string =>
  req.auth?.wallet ?? parseWallet(req.header("x-wallet-address"), "x-wallet-address");

export const isBundleExpired = (bundle: { expiresAt: Date }): boolean =>
  bundle.expiresAt.getTime() <= Date.now();

export const isBundleReusable = (bundle: { status: BundleStatus; expiresAt: Date }): boolean => {
  if (bundle.status === BundleStatus.CONFIRMED) {
    return true;
  }

  if (isBundleExpired(bundle)) {
    return false;
  }

  return (
    bundle.status === BundleStatus.BUILT ||
    bundle.status === BundleStatus.PARTIAL ||
    bundle.status === BundleStatus.FULLY_SIGNED ||
    bundle.status === BundleStatus.SUBMITTED
  );
};

export const extractTransactionSignature = (serializedTxBase64: string): string => {
  const transaction = decodeVersionedTransaction(serializedTxBase64);
  const firstSignature = transaction.signatures[0];

  if (!firstSignature || firstSignature.every((byte) => byte === 0)) {
    throw new Error("fully signed transaction is missing the sponsor signature");
  }

  return bs58.encode(firstSignature);
};

const serializeIntent = (intent: ProposalIntent) => ({
  intentId: intent.id,
  status: intent.status,
  // version / 版本: optimistic state version used for multi-step intent transitions.
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
  track2UsdcDeposited: intent.track2UsdcDeposited.toString(),
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

const finalizeConfirmedLaunchBundle = async (params: {
  intentId: string;
  bundleId: string;
  fullySignedTxBase64: string;
  chainTxSignature: string;
}) => {
  const latestIntent = await prisma.proposalIntent.findUnique({
    where: { id: params.intentId },
    include: {
      manifest: true,
    },
  });

  if (!latestIntent) {
    throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found after submission");
  }

  const contentAnchorPda = derivePlannedContentAnchorPda({
    creatorWallet: latestIntent.creatorWallet,
    manifest: latestIntent.manifest,
    lockedAnchorPda: latestIntent.lockedAnchorPda,
  });

  return prisma.$transaction(async (tx) => {
    const updatedBundle = await tx.txBundle.update({
      where: { id: params.bundleId },
      data: {
        fullySignedBase64: params.fullySignedTxBase64,
        status: BundleStatus.CONFIRMED,
        chainTxSignature: params.chainTxSignature,
        errorMessage: null,
      },
    });

    await tx.proposalIntent.update({
      where: { id: latestIntent.id },
      data: {
        status: ProposalIntentStatus.CONFIRMED,
        version: {
          increment: 1,
        },
        sponsorApprovedAt: latestIntent.sponsorApprovedAt ?? new Date(),
        chainTxSignature: params.chainTxSignature,
        chainSubmittedAt: latestIntent.chainSubmittedAt ?? new Date(),
        chainConfirmedAt: new Date(),
        failureReason: null,
      },
    });

    await tx.contentManifest.update({
      where: { id: latestIntent.manifest.id },
      data: {
        currentAnchorPda: contentAnchorPda,
        currentAnchorTx: params.chainTxSignature,
        status: latestIntent.manifest.currentAnchorPda
          ? latestIntent.manifest.status
          : ContentManifestStatus.ANCHORED,
      },
    });

    await tx.proposal.upsert({
      where: {
        proposalPda: latestIntent.plannedProposalPda!,
      },
      update: {
        sponsorWallet: latestIntent.sponsorWallet,
        sponsorOrgId: latestIntent.sponsorOrgId,
        creatorOrgId: latestIntent.creatorOrgId,
        manifestId: latestIntent.manifestId,
        intentId: latestIntent.id,
        contentHashHex: latestIntent.lockedManifestHashHex,
        contentAnchorPda,
        onChainTxSignature: params.chainTxSignature,
        deadlineAt: new Date(Number(latestIntent.deadlineUnix) * 1000),
        status: ProposalStatus.FUNDED,
        track1BaseUsdc: latestIntent.track1BaseUsdc,
        track1Claimed: false,
        track2MetricType: latestIntent.track2MetricType,
        track2TargetValue: latestIntent.track2TargetValue,
        track2MinAchievementBps: latestIntent.track2MinAchievementBps,
        track2UsdcDeposited: latestIntent.track2UsdcDeposited,
        track3UsdcDeposited: latestIntent.track3UsdcDeposited,
        track3DelayDays: latestIntent.track3DelayDays,
        oracleSyncStatus: OracleSyncStatus.PENDING,
      },
      create: {
        proposalPda: latestIntent.plannedProposalPda!,
        creatorWallet: latestIntent.creatorWallet,
        sponsorWallet: latestIntent.sponsorWallet,
        sponsorOrgId: latestIntent.sponsorOrgId,
        creatorOrgId: latestIntent.creatorOrgId,
        manifestId: latestIntent.manifestId,
        intentId: latestIntent.id,
        contentHashHex: latestIntent.lockedManifestHashHex,
        contentAnchorPda,
        deadlineAt: new Date(Number(latestIntent.deadlineUnix) * 1000),
        status: ProposalStatus.FUNDED,
        track1BaseUsdc: latestIntent.track1BaseUsdc,
        track1Claimed: false,
        track2MetricType: latestIntent.track2MetricType,
        track2TargetValue: latestIntent.track2TargetValue,
        track2MinAchievementBps: latestIntent.track2MinAchievementBps,
        track2UsdcDeposited: latestIntent.track2UsdcDeposited,
        track3UsdcDeposited: latestIntent.track3UsdcDeposited,
        track3DelayDays: latestIntent.track3DelayDays,
        onChainTxSignature: params.chainTxSignature,
        oracleSyncStatus: OracleSyncStatus.PENDING,
      },
    });

    return updatedBundle;
  });
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

    // Intents are DB-first drafts and do not become settlement truth until the chain transaction confirms.
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
        track2UsdcDeposited: parseNonNegativeBigInt(
          req.body.track2UsdcDeposited,
          "track2UsdcDeposited"
        ),
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
      // Locking freezes the exact content hash and derived PDAs so both parties sign against stable terms.
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
    const forceRebuild = parseOptionalBoolean(req.body.forceRebuild);
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

    assertParticipant(requesterWallet, intent);

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
      // Creator approves the exact launch transaction message; payer responsibility is separated from author approval.
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

    const requesterWallet =
      req.auth?.wallet ??
      parseOptionalWallet(req.header("x-wallet-address"), "x-wallet-address");
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

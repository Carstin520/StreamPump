import {
  BundleStatus,
  BundleSubmitMode,
  CampaignProofStatus,
  ContentManifestStatus,
  OracleSyncStatus,
  Proposal,
  ProposalStatus,
  ProposalIntent,
  ProposalIntentStatus,
  Track2MetricType,
} from "@prisma/client";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

import { HttpError } from "./http";
import { serializeAsset } from "./contentManifestShared";
import { decodeVersionedTransaction, derivePlannedContentAnchorPda } from "../services/proposalLaunchService";
import { prisma } from "../services/prisma";
import { OnChainProposalState, getAnchorService } from "../services/AnchorService";
import { trustedPublicationVerificationWhere } from "../services/contentPublicationEligibility";
import { config } from "../../config/default";

type SerializedBundleInput = {
  id: string;
  status: string;
  submitMode: string;
  instructionPlanJson: unknown;
  requiredSignersJson: unknown;
  messageBase64: string | null;
  partiallySignedBase64: string | null;
  recentBlockhash: string | null;
  lastValidBlockHeight: bigint | null;
  expiresAt: Date;
  chainTxSignature: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProposalIntentWithManifest = ProposalIntent & {
  manifest: {
    id: string;
    currentAnchorPda: string | null;
    manifestHashHex: string | null;
    status: ContentManifestStatus;
  };
};

type ProposalIntentViewerRole = "CREATOR" | "SPONSOR" | "OBSERVER";

const getIntentViewerRole = (
  intent: Pick<ProposalIntent, "creatorWallet" | "sponsorWallet">,
  requesterWallet: string
): ProposalIntentViewerRole => {
  if (requesterWallet === intent.creatorWallet) return "CREATOR";
  if (requesterWallet === intent.sponsorWallet) return "SPONSOR";
  return "OBSERVER";
};

const disabledForParticipantRole = (
  viewerRole: ProposalIntentViewerRole,
  requiredSigner: string
): string | null => {
  if (requiredSigner === "NONE") return null;
  if (requiredSigner === "CREATOR_OR_SPONSOR") {
    return viewerRole === "OBSERVER" ? "NOT_A_PARTICIPANT" : null;
  }

  return viewerRole === requiredSigner ? null : `${requiredSigner}_REQUIRED`;
};

export const buildProposalIntentSemantics = (
  intent: ProposalIntent,
  requesterWallet: string,
  latestBundle?: SerializedBundleInput | null
) => {
  const viewerRole = getIntentViewerRole(intent, requesterWallet);
  const bundleExpired =
    latestBundle && latestBundle.status !== BundleStatus.CONFIRMED
      ? isBundleExpired(latestBundle)
      : false;

  const build = (
    currentStep: string,
    nextAction: string | null,
    requiredSigner: string,
    disabledReason: string | null = disabledForParticipantRole(viewerRole, requiredSigner)
  ) => ({
    currentStep,
    viewerRole,
    nextAction,
    requiredSigner,
    disabledReason,
  });

  if (bundleExpired) {
    return build("BUNDLE_EXPIRED", "REBUILD_BUNDLE", "CREATOR_OR_SPONSOR");
  }

  switch (intent.status) {
    case ProposalIntentStatus.DRAFT:
      return build("DRAFT", "LOCK_TERMS", "CREATOR_OR_SPONSOR");
    case ProposalIntentStatus.TERMS_LOCKED:
      return build("TERMS_LOCKED", "BUILD_BUNDLE", "CREATOR_OR_SPONSOR");
    case ProposalIntentStatus.BUNDLE_BUILT:
      return build(
        latestBundle ? "AWAITING_CREATOR_SIGNATURE" : "BUNDLE_MISSING",
        latestBundle ? "CREATOR_SIGN_BUNDLE" : "BUILD_BUNDLE",
        latestBundle ? "CREATOR" : "CREATOR_OR_SPONSOR"
      );
    case ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED:
      return build("AWAITING_SPONSOR_SIGNATURE", "SPONSOR_SIGN_AND_SUBMIT", "SPONSOR");
    case ProposalIntentStatus.SPONSOR_SIGNED:
      return build("READY_FOR_CLIENT_RELAY", "SUBMIT_SIGNED_TRANSACTION", "SPONSOR");
    case ProposalIntentStatus.SUBMITTED:
      return build("AWAITING_CHAIN_CONFIRMATION", "WAIT_FOR_CONFIRMATION", "NONE", null);
    case ProposalIntentStatus.CONFIRMED:
      return build("CONFIRMED", "VIEW_CAMPAIGN", "NONE", null);
    case ProposalIntentStatus.FAILED:
      return build("FAILED", "REBUILD_BUNDLE", "CREATOR_OR_SPONSOR");
    case ProposalIntentStatus.EXPIRED:
      return build("EXPIRED", "REBUILD_BUNDLE", "CREATOR_OR_SPONSOR");
    default:
      return build("UNKNOWN", null, "NONE", "UNKNOWN_INTENT_STATUS");
  }
};

export const parseTrack2MetricType = (value: unknown): Track2MetricType => {
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

export const parseBundleSubmitMode = (value: unknown): BundleSubmitMode => {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "SERVER_RELAY") {
    return BundleSubmitMode.SERVER_RELAY;
  }

  if (normalized === "CLIENT_RELAY") {
    return BundleSubmitMode.CLIENT_RELAY;
  }

  throw new HttpError(400, "INVALID_INPUT", "submitMode must be SERVER_RELAY or CLIENT_RELAY");
};

export const parseBooleanFlag = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

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

export const serializeIntent = (intent: ProposalIntent) => ({
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
  nonce: intent.nonce.toString(),
  track1BaseUsdc: intent.track1BaseUsdc.toString(),
  track2MetricType: intent.track2MetricType,
  track2TargetValue: intent.track2TargetValue.toString(),
  track2MinAchievementBps: intent.track2MinAchievementBps,
  track2UsdcDeposited: intent.track2UsdcDeposited.toString(),
  track3UsdcDeposited: intent.track3UsdcDeposited.toString(),
  track3DelayDays: intent.track3DelayDays,
  maxEndorsementSpump: intent.maxEndorsementSpump.toString(),
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

export const serializeBundle = (bundle: SerializedBundleInput) => ({
  bundleId: bundle.id,
  status: bundle.status,
  submitMode: bundle.submitMode,
  instructionPlan: bundle.instructionPlanJson,
  requiredSigners: bundle.requiredSignersJson,
  versionedTxBase64: bundle.messageBase64,
  partiallySignedTxBase64: bundle.partiallySignedBase64,
  recentBlockhash: bundle.recentBlockhash,
  lastValidBlockHeight: bundle.lastValidBlockHeight?.toString() ?? null,
  expiresAt: bundle.expiresAt.toISOString(),
  chainTxSignature: bundle.chainTxSignature,
  errorMessage: bundle.errorMessage,
  createdAt: bundle.createdAt.toISOString(),
  updatedAt: bundle.updatedAt.toISOString(),
});

export const serializeProposal = (proposal: Proposal) => ({
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
  track2InitialFanPool: (proposal.track2InitialFanPool ?? 0n).toString(),
  track2InitialSpumpStaked: (proposal.track2InitialSpumpStaked ?? 0n).toString(),
  track2RewardCapUsdc: (proposal.track2RewardCapUsdc ?? 0n).toString(),
  track2ResidualTo: proposal.track2ResidualTo ?? 1,
  track2RewardModelSnapshot: proposal.track2RewardModelSnapshot ?? 0,
  track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
  track3CpsPayout: proposal.track3CpsPayout?.toString() ?? null,
  track3DelayDays: proposal.track3DelayDays,
  track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
  onChainTxSignature: proposal.onChainTxSignature,
  nonce: proposal.nonce?.toString() ?? null,
  oracleSyncStatus: proposal.oracleSyncStatus,
  contentHashHex: proposal.contentHashHex,
  contentAnchorPda: proposal.contentAnchorPda,
  createdAt: proposal.createdAt.toISOString(),
  updatedAt: proposal.updatedAt.toISOString(),
});

export const assertProposalIntentParticipant = (
  requesterWallet: string,
  intent: ProposalIntent
): void => {
  if (requesterWallet !== intent.creatorWallet && requesterWallet !== intent.sponsorWallet) {
    throw new HttpError(403, "FORBIDDEN", "requester must be the creator or sponsor of the intent");
  }
};

export const confirmedLaunchMismatchFields = (params: {
  intent: Pick<
    ProposalIntent,
    | "creatorWallet"
    | "sponsorWallet"
    | "lockedManifestHashHex"
    | "deadlineUnix"
    | "track1BaseUsdc"
    | "track2UsdcDeposited"
    | "track3UsdcDeposited"
  >;
  expectedContentAnchorPda: string | null;
  onChain: OnChainProposalState;
}): string[] => {
  const mismatches: string[] = [];
  if (params.onChain.creator.toBase58() !== params.intent.creatorWallet) {
    mismatches.push("creatorWallet");
  }
  if (params.onChain.sponsor?.toBase58() !== params.intent.sponsorWallet) {
    mismatches.push("sponsorWallet");
  }
  if (
    params.onChain.contentHashHex.toLowerCase() !==
    String(params.intent.lockedManifestHashHex ?? "").toLowerCase()
  ) {
    mismatches.push("contentHashHex");
  }
  if (params.onChain.contentAnchorPda !== params.expectedContentAnchorPda) {
    mismatches.push("contentAnchorPda");
  }
  if (params.onChain.deadlineUnix !== params.intent.deadlineUnix) {
    mismatches.push("deadlineUnix");
  }
  if (params.onChain.track1BaseUsdc !== params.intent.track1BaseUsdc) {
    mismatches.push("track1BaseUsdc");
  }
  if (params.onChain.track2UsdcDeposited !== params.intent.track2UsdcDeposited) {
    mismatches.push("track2UsdcDeposited");
  }
  if (params.onChain.track3UsdcDeposited !== params.intent.track3UsdcDeposited) {
    mismatches.push("track3UsdcDeposited");
  }
  if (params.onChain.status !== "FUNDED") mismatches.push("status");
  return mismatches;
};

export const assertConfirmedLaunchMatchesIntent = (params: {
  intent: Parameters<typeof confirmedLaunchMismatchFields>[0]["intent"];
  expectedContentAnchorPda: string | null;
  onChain: OnChainProposalState;
}): void => {
  const mismatchFields = confirmedLaunchMismatchFields(params);
  if (mismatchFields.length > 0) {
    throw new HttpError(
      502,
      "CONFIRMED_PROPOSAL_CHAIN_MISMATCH",
      `confirmed proposal does not match the locked intent: ${mismatchFields.join(", ")}`
    );
  }
};

export const resolveLaunchContentAnchorTx = (params: {
  existingContentAnchorPda: string | null;
  existingContentAnchorTx: string | null;
  launchTxSignature: string;
}): string | null =>
  params.existingContentAnchorPda
    ? params.existingContentAnchorTx
    : params.launchTxSignature;

export const finalizeConfirmedLaunchBundle = async (params: {
  intentId: string;
  bundleId: string;
  fullySignedTxBase64: string;
  chainTxSignature: string;
}) => {
  const latestIntent = await prisma.proposalIntent.findUnique({
    where: { id: params.intentId },
    include: {
      manifest: {
        include: {
          publications: {
            where: trustedPublicationVerificationWhere(config.pilot.inviteOnly),
            orderBy: {
              verifiedAt: "desc",
            },
            take: 1,
          },
        },
      },
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
  if (!latestIntent.plannedProposalPda) {
    throw new HttpError(409, "PROPOSAL_PDA_MISSING", "intent is missing its planned proposal PDA");
  }
  const onChain = await getAnchorService().fetchProposalState(
    new PublicKey(latestIntent.plannedProposalPda)
  );
  if (!onChain) {
    throw new HttpError(
      502,
      "CONFIRMED_PROPOSAL_NOT_FOUND_ON_CHAIN",
      "confirmed transaction did not produce the expected proposal account"
    );
  }
  assertConfirmedLaunchMatchesIntent({
    intent: latestIntent,
    expectedContentAnchorPda: contentAnchorPda,
    onChain,
  });
  const contentAnchorTx = resolveLaunchContentAnchorTx({
    existingContentAnchorPda: latestIntent.manifest.currentAnchorPda,
    existingContentAnchorTx: latestIntent.manifest.currentAnchorTx,
    launchTxSignature: params.chainTxSignature,
  });

  const updatedBundle = await prisma.$transaction(async (tx) => {
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
        currentAnchorTx: contentAnchorTx,
        status: latestIntent.manifest.currentAnchorPda
          ? latestIntent.manifest.status
          : ContentManifestStatus.ANCHORED,
      },
    });

    const proofStatus = contentAnchorPda
      ? CampaignProofStatus.ANCHORED
      : CampaignProofStatus.FUNDED;
    const contentPublishedVerifiedAt =
      latestIntent.manifest.publications[0]?.verifiedAt ?? null;

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
        contentAnchorTx,
        onChainTxSignature: params.chainTxSignature,
        nonce: latestIntent.nonce,
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
        contentPublishedVerifiedAt,
        proofStatus,
        fundingTxSignature: params.chainTxSignature,
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
        contentAnchorTx,
        nonce: latestIntent.nonce,
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
        contentPublishedVerifiedAt,
        proofStatus,
        fundingTxSignature: params.chainTxSignature,
      },
    });

    return updatedBundle;
  });

  return updatedBundle;
};

export const serializeProposalIntentListItem = (
  intent: ProposalIntent & {
    manifest: {
      id: string;
      title: string | null;
      status: string;
      contentType: string;
      manifestHashHex: string | null;
      currentAnchorPda: string | null;
    } | null;
    txBundles: SerializedBundleInput[];
  },
  requesterWallet: string
) => {
  const latestBundle = intent.txBundles[0] ?? null;
  const semantics = buildProposalIntentSemantics(intent, requesterWallet, latestBundle);

  return {
    ...serializeIntent(intent),
    manifest: intent.manifest
      ? {
          manifestId: intent.manifest.id,
          title: intent.manifest.title,
          status: intent.manifest.status,
          contentType: intent.manifest.contentType,
          manifestHashHex: intent.manifest.manifestHashHex,
          currentAnchorPda: intent.manifest.currentAnchorPda,
        }
      : null,
    latestBundle: latestBundle ? serializeBundle(latestBundle) : null,
    currentStep: semantics.currentStep,
    viewerRole: semantics.viewerRole,
    nextAction: semantics.nextAction,
    requiredSigner: semantics.requiredSigner,
    disabledReason: semantics.disabledReason,
  };
};

export const serializeProposalIntentDetail = (
  intent: ProposalIntent & {
    manifest: {
      id: string;
      title: string | null;
      contentType: string;
      status: string;
      version: number;
      manifestHashHex: string | null;
      currentAnchorPda: string | null;
      assets: Array<{
        id: string;
        assetType: string;
        orderIndex: number;
        storageKey: string;
        cdnUrl: string | null;
        uploadStatus: string;
        processingStatus: string;
        muxAssetId: string | null;
        muxPlaybackId: string | null;
        muxLastKnownStatus: string | null;
        processingError: string | null;
        updatedAt: Date;
      }>;
    } | null;
    txBundles: SerializedBundleInput[];
    proposal: Proposal | null;
  },
  requesterWallet: string
) => {
  const latestBundle = intent.txBundles[0] ?? null;
  const semantics = buildProposalIntentSemantics(intent, requesterWallet, latestBundle);

  return {
    intent: serializeIntent(intent),
    currentStep: semantics.currentStep,
    viewerRole: semantics.viewerRole,
    nextAction: semantics.nextAction,
    requiredSigner: semantics.requiredSigner,
    disabledReason: semantics.disabledReason,
    manifest: intent.manifest
      ? {
          manifestId: intent.manifest.id,
          title: intent.manifest.title,
          contentType: intent.manifest.contentType,
          status: intent.manifest.status,
          version: intent.manifest.version,
          manifestHashHex: intent.manifest.manifestHashHex,
          currentAnchorPda: intent.manifest.currentAnchorPda,
          assets: intent.manifest.assets.map(serializeAsset),
        }
      : null,
    proposal: intent.proposal ? serializeProposal(intent.proposal) : null,
    bundles: intent.txBundles.map(serializeBundle),
  };
};

export const serializePublicProposalView = (proposal: Proposal) => ({
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
  track2InitialFanPool: (proposal.track2InitialFanPool ?? 0n).toString(),
  track2InitialSpumpStaked: (proposal.track2InitialSpumpStaked ?? 0n).toString(),
  track2RewardCapUsdc: (proposal.track2RewardCapUsdc ?? 0n).toString(),
  track2ResidualTo: proposal.track2ResidualTo ?? 1,
  track2RewardModelSnapshot: proposal.track2RewardModelSnapshot ?? 0,
});

/**
 * CN: Proposal launch 服务，负责 launch instruction 规划、真实 v0 交易组装和签名校验。
 * EN: Proposal launch service that plans launch instructions, assembles real v0 transactions, and validates signatures.
 */
import {
  BundleStatus,
  BundleSubmitMode,
  ContentManifest,
  ContentType,
  Prisma,
  ProposalIntent,
  ProposalIntentStatus,
  Track2MetricType,
} from "@prisma/client";
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getAnchorService } from "./AnchorService";

const ZERO_SIGNATURE = new Uint8Array(64);

const parseDigestHex = (digestHex: string, label: string): Uint8Array => {
  const normalized = digestHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a 64-character hex string`);
  }

  return Uint8Array.from(Buffer.from(normalized, "hex"));
};

const mapContentTypeToProposalKind = (contentType: ContentType) => {
  switch (contentType) {
    case "SHORT_VIDEO":
      return { shortVideo: {} };
    case "IMAGE_CAROUSEL":
      return { imageCarousel: {} };
    case "MIXED_MEDIA_NOTE":
      return { mixedMediaNote: {} };
    default:
      throw new Error(`Unsupported contentType: ${contentType}`);
  }
};

const mapTrack2MetricTypeToProposalMetric = (metricType: Track2MetricType) => {
  switch (metricType) {
    case "VIEWS":
      return { views: {} };
    case "CLICKS":
      return { clicks: {} };
    case "SAVES":
      return { saves: {} };
    default:
      throw new Error(`Unsupported track2MetricType: ${metricType}`);
  }
};

const getSignerWalletsFromTransaction = (transaction: VersionedTransaction): string[] =>
  transaction.message.staticAccountKeys
    .slice(0, transaction.message.header.numRequiredSignatures)
    .map((key) => key.toBase58());

const isZeroSignature = (signature: Uint8Array): boolean =>
  signature.length === ZERO_SIGNATURE.length &&
  signature.every((value, index) => value === ZERO_SIGNATURE[index]);

export const buildInstructionPlan = (
  manifest: Pick<ContentManifest, "currentAnchorPda">,
  _intent: Pick<ProposalIntent, "id">
): string[] => {
  if (manifest.currentAnchorPda) {
    return ["create_proposal", "sponsor_fund"];
  }

  return ["anchor_content_hash", "create_proposal", "sponsor_fund"];
};

export const deriveIntentAddresses = (params: {
  creatorWallet: string;
  deadlineUnix: bigint;
  nonce?: bigint;
}): {
  proposalPda: string;
  proposalUsdcVaultPda: string;
} => {
  const anchorService = getAnchorService();
  const creator = new PublicKey(params.creatorWallet);
  const proposalPda = anchorService.deriveProposalPda(creator, params.deadlineUnix, params.nonce ?? 0n);
  const proposalUsdcVaultPda = anchorService.deriveProposalUsdcVaultPda(proposalPda);

  return {
    proposalPda: proposalPda.toBase58(),
    proposalUsdcVaultPda: proposalUsdcVaultPda.toBase58(),
  };
};

export const derivePlannedContentAnchorPda = (params: {
  creatorWallet: string;
  manifest: Pick<ContentManifest, "currentAnchorPda" | "internalUrlDigestHex">;
  lockedAnchorPda?: string | null;
}): string => {
  if (params.lockedAnchorPda) {
    return params.lockedAnchorPda;
  }

  if (params.manifest.currentAnchorPda) {
    return params.manifest.currentAnchorPda;
  }

  if (!params.manifest.internalUrlDigestHex) {
    throw new Error("manifest.internalUrlDigestHex is required to derive plannedContentAnchorPda");
  }

  const anchorService = getAnchorService();
  const creatorProfilePda = anchorService.deriveCreatorProfilePda(
    new PublicKey(params.creatorWallet)
  );
  const contentAnchorPda = anchorService.deriveContentAnchorPda(
    creatorProfilePda,
    parseDigestHex(params.manifest.internalUrlDigestHex, "manifest.internalUrlDigestHex")
  );

  return contentAnchorPda.toBase58();
};

export const encodeVersionedTransaction = (transaction: VersionedTransaction): string =>
  Buffer.from(transaction.serialize()).toString("base64");

export const decodeVersionedTransaction = (base64Value: string): VersionedTransaction =>
  VersionedTransaction.deserialize(Buffer.from(base64Value, "base64"));

export const assertTransactionMessageMatches = (
  expectedBase64: string,
  candidateBase64: string
): void => {
  const expected = decodeVersionedTransaction(expectedBase64);
  const candidate = decodeVersionedTransaction(candidateBase64);

  const expectedMessage = Buffer.from(expected.message.serialize()).toString("base64");
  const candidateMessage = Buffer.from(candidate.message.serialize()).toString("base64");

  if (expectedMessage !== candidateMessage) {
    throw new Error("signed transaction does not match the bundle message");
  }
};

export const assertRequiredSignerPresent = (
  serializedTxBase64: string,
  signerWallet: string
): void => {
  const transaction = decodeVersionedTransaction(serializedTxBase64);
  const signerWallets = getSignerWalletsFromTransaction(transaction);
  const signerIndex = signerWallets.findIndex((wallet) => wallet === signerWallet);

  if (signerIndex === -1) {
    throw new Error(`bundle does not require signer ${signerWallet}`);
  }

  if (isZeroSignature(transaction.signatures[signerIndex])) {
    throw new Error(`missing signature for ${signerWallet}`);
  }
};

export const buildBundleRecord = (params: {
  intent: Pick<ProposalIntent, "id" | "creatorWallet" | "sponsorWallet">;
  instructionPlan: string[];
  submitMode: BundleSubmitMode;
  expiresAt: Date;
  versionedTxBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: bigint;
}): Prisma.TxBundleUncheckedCreateInput => ({
  intentId: params.intent.id,
  bundleType: "PROPOSAL_LAUNCH",
  instructionPlanJson: params.instructionPlan as Prisma.InputJsonValue,
  messageBase64: params.versionedTxBase64,
  recentBlockhash: params.recentBlockhash,
  lastValidBlockHeight: params.lastValidBlockHeight,
  requiredSignersJson: [
    params.intent.creatorWallet,
    params.intent.sponsorWallet,
  ] as Prisma.InputJsonValue,
  expiresAt: params.expiresAt,
  submitMode: params.submitMode,
  status: BundleStatus.BUILT,
  errorMessage: null,
});

export const buildLaunchBundleTransaction = async (params: {
  intent: Pick<
    ProposalIntent,
    | "creatorWallet"
    | "sponsorWallet"
    | "deadlineUnix"
    | "nonce"
    | "maxEndorsementSpump"
    | "track1BaseUsdc"
    | "track2MetricType"
    | "track2TargetValue"
    | "track2MinAchievementBps"
    | "track2UsdcDeposited"
    | "track3UsdcDeposited"
    | "track3DelayDays"
    | "lockedManifestHashHex"
    | "lockedAnchorPda"
    | "plannedProposalPda"
    | "plannedUsdcVaultPda"
  >;
  manifest: Pick<
    ContentManifest,
    "contentType" | "currentAnchorPda" | "internalCanonicalUrl" | "internalUrlDigestHex"
  >;
}): Promise<{
  instructionPlan: string[];
  plannedContentAnchorPda: string;
  versionedTxBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: bigint;
}> => {
  if (!params.intent.lockedManifestHashHex) {
    throw new Error("intent.lockedManifestHashHex is required before building the launch bundle");
  }

  if (!params.intent.plannedProposalPda || !params.intent.plannedUsdcVaultPda) {
    throw new Error("intent plannedProposalPda and plannedUsdcVaultPda must be pre-derived");
  }

  const anchorService = getAnchorService();
  const instructionPlan = buildInstructionPlan(params.manifest, { id: "launch" });
  const plannedContentAnchorPda = derivePlannedContentAnchorPda({
    creatorWallet: params.intent.creatorWallet,
    manifest: params.manifest,
    lockedAnchorPda: params.intent.lockedAnchorPda,
  });
  const instructions: TransactionInstruction[] = [];

  if (!params.manifest.currentAnchorPda) {
    if (!params.manifest.internalCanonicalUrl) {
      throw new Error(
        "manifest.internalCanonicalUrl is required when anchor_content_hash must be included"
      );
    }

    const anchorInstruction = await anchorService.buildAnchorContentHashInstruction({
      creatorWallet: params.intent.creatorWallet,
      payerWallet: params.intent.sponsorWallet,
      canonicalUrl: params.manifest.internalCanonicalUrl,
      contentHashHex: params.intent.lockedManifestHashHex,
    });

    instructions.push(anchorInstruction);
  }

  const createProposalInstruction = await anchorService.buildCreateProposalInstruction({
    creatorWallet: params.intent.creatorWallet,
    payerWallet: params.intent.sponsorWallet,
    proposalPda: params.intent.plannedProposalPda,
    proposalUsdcVaultPda: params.intent.plannedUsdcVaultPda,
    contentKind: mapContentTypeToProposalKind(params.manifest.contentType),
    contentHashHex: params.intent.lockedManifestHashHex,
    contentAnchorPda: plannedContentAnchorPda,
    track1BaseUsdc: params.intent.track1BaseUsdc,
    track2MetricType: mapTrack2MetricTypeToProposalMetric(params.intent.track2MetricType),
    track2TargetValue: params.intent.track2TargetValue,
    track2MinAchievementBps: params.intent.track2MinAchievementBps,
    track3DelayDays: params.intent.track3DelayDays,
    deadlineUnix: params.intent.deadlineUnix,
    nonce: params.intent.nonce ?? 0n,
    maxEndorsementSpump: params.intent.maxEndorsementSpump ?? 0n,
  });
  instructions.push(createProposalInstruction);

  const sponsorFundInstruction = await anchorService.buildSponsorFundInstruction({
    sponsorWallet: params.intent.sponsorWallet,
    proposalPda: params.intent.plannedProposalPda,
    proposalUsdcVaultPda: params.intent.plannedUsdcVaultPda,
    track1Amount: params.intent.track1BaseUsdc,
    track2Amount: params.intent.track2UsdcDeposited,
    track3Amount: params.intent.track3UsdcDeposited,
  });
  instructions.push(sponsorFundInstruction);

  const { blockhash, lastValidBlockHeight } = await anchorService.connection.getLatestBlockhash(
    "confirmed"
  );
  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(params.intent.sponsorWallet),
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  return {
    instructionPlan,
    plannedContentAnchorPda,
    versionedTxBase64: encodeVersionedTransaction(transaction),
    recentBlockhash: blockhash,
    lastValidBlockHeight: BigInt(lastValidBlockHeight),
  };
};

export const nextIntentStatusAfterBundle = (): ProposalIntentStatus =>
  ProposalIntentStatus.BUNDLE_BUILT;

/**
 * CN: Proposal launch 服务骨架，负责指令规划、PDA 预推导和 bundle 元数据生成。
 * EN: Proposal launch skeleton service responsible for instruction planning, PDA pre-derivation, and bundle metadata.
 */
import {
  BundleSubmitMode,
  BundleStatus,
  ContentManifest,
  Prisma,
  ProposalIntent,
  ProposalIntentStatus,
} from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import { getAnchorService } from "./AnchorService";

export const buildInstructionPlan = (
  manifest: Pick<ContentManifest, "currentAnchorPda">,
  _intent: Pick<ProposalIntent, "id">
): string[] => {
  // If content is already anchored, the launch bundle can skip the anchor step entirely.
  if (manifest.currentAnchorPda) {
    return ["create_proposal", "sponsor_fund"];
  }

  return ["anchor_content_hash", "create_proposal", "sponsor_fund"];
};

export const deriveIntentAddresses = (params: {
  creatorWallet: string;
  deadlineUnix: bigint;
}): {
  proposalPda: string;
  proposalUsdcVaultPda: string;
} => {
  const anchorService = getAnchorService();
  const creator = new PublicKey(params.creatorWallet);
  const proposalPda = anchorService.deriveProposalPda(creator, params.deadlineUnix);
  const proposalUsdcVaultPda = anchorService.deriveProposalUsdcVaultPda(proposalPda);

  return {
    proposalPda: proposalPda.toBase58(),
    proposalUsdcVaultPda: proposalUsdcVaultPda.toBase58(),
  };
};

export const buildBundleSkeletonRecord = (params: {
  intent: Pick<ProposalIntent, "id" | "creatorWallet" | "sponsorWallet">;
  instructionPlan: string[];
  submitMode: BundleSubmitMode;
  expiresAt: Date;
}): Prisma.TxBundleUncheckedCreateInput => {
  // This intentionally stores only bundle metadata for now; real VersionedTransaction assembly is a later step.
  return {
    intentId: params.intent.id,
    bundleType: "PROPOSAL_LAUNCH",
    instructionPlanJson: params.instructionPlan as Prisma.InputJsonValue,
    messageBase64: null,
    recentBlockhash: null,
    lastValidBlockHeight: null,
    requiredSignersJson: [
      params.intent.creatorWallet,
      params.intent.sponsorWallet,
    ] as Prisma.InputJsonValue,
    expiresAt: params.expiresAt,
    submitMode: params.submitMode,
    status: BundleStatus.BUILT,
    errorMessage: "Transaction assembly is intentionally left as a skeleton in this phase.",
  };
};

export const nextIntentStatusAfterBundle = (): ProposalIntentStatus =>
  ProposalIntentStatus.BUNDLE_BUILT;

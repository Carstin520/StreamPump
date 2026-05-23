/**
 * CN: 链上投影服务，根据链上 Proposal 账户状态回写数据库投影。
 * EN: Chain projection service that writes DB projections from on-chain Proposal account state.
 */
import { CampaignProofStatus, OracleSyncStatus, ProposalStatus } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import { OnChainProposalState, getAnchorService } from "./AnchorService";
import { prisma } from "./prisma";

const toDateFromUnixSeconds = (unixSeconds: bigint): Date | null => {
  if (unixSeconds <= 0n) {
    return null;
  }

  const timestamp = Number(unixSeconds);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000);
};

const shouldMarkOracleSynced = (instructionName: string): boolean =>
  instructionName === "settle_track1_base" ||
  instructionName === "settle_track2" ||
  instructionName === "settle_track3_cps";

const normalizeProposalStatus = (status: OnChainProposalState["status"]): ProposalStatus => {
  switch (status) {
    case "OPEN":
      return ProposalStatus.OPEN;
    case "FUNDED":
      return ProposalStatus.FUNDED;
    case "RESOLVED_SUCCESS":
      return ProposalStatus.RESOLVED_SUCCESS;
    case "RESOLVED_FAIL":
      return ProposalStatus.RESOLVED_FAIL;
    case "CANCELLED":
      return ProposalStatus.CANCELLED;
    case "VOIDED":
      return ProposalStatus.VOIDED;
    default:
      return ProposalStatus.OPEN;
  }
};

type ProofStatusInput = {
  status: ProposalStatus;
  track1Claimed: boolean;
  track2SettledAt: Date | null;
  track3SettledAt: Date | null;
  contentAnchorPda: string | null;
};

const deriveProofStatus = (input: ProofStatusInput): CampaignProofStatus => {
  if (input.status === ProposalStatus.CANCELLED) return CampaignProofStatus.CANCELLED;
  if (input.status === ProposalStatus.VOIDED) return CampaignProofStatus.VOIDED;
  if (input.track2SettledAt && input.track3SettledAt) return CampaignProofStatus.SETTLED;
  if (input.track2SettledAt || input.track3SettledAt || input.track1Claimed) {
    return CampaignProofStatus.SETTLING;
  }
  if (input.contentAnchorPda) return CampaignProofStatus.ANCHORED;
  if (input.status === ProposalStatus.FUNDED) return CampaignProofStatus.FUNDED;
  return CampaignProofStatus.DRAFT;
};

export const syncProposalProjectionFromChain = async (params: {
  proposalPda: string;
  signature: string;
  instructionName: string;
}) => {
  const proposalPda = new PublicKey(params.proposalPda);
  const onChain = await getAnchorService().fetchProposalState(proposalPda);
  if (!onChain) {
    return null;
  }

  const existing = await prisma.proposal.findUnique({
    where: {
      proposalPda: params.proposalPda,
    },
  });
  const linkedIntent = await prisma.proposalIntent.findFirst({
    where: {
      plannedProposalPda: params.proposalPda,
    },
  });

  const normalizedStatus = normalizeProposalStatus(onChain.status);
  const track2SettledAt = toDateFromUnixSeconds(onChain.track2SettledAtUnix);
  const track3SettledAt = toDateFromUnixSeconds(onChain.track3SettledAtUnix);

  const proofStatus = deriveProofStatus({
    status: normalizedStatus,
    track1Claimed: onChain.track1Claimed,
    track2SettledAt,
    track3SettledAt,
    contentAnchorPda: onChain.contentAnchorPda,
  });

  const isSettlingOrSettled =
    proofStatus === CampaignProofStatus.SETTLING || proofStatus === CampaignProofStatus.SETTLED;

  const payload = {
    creatorWallet: onChain.creator.toBase58(),
    sponsorWallet: onChain.sponsor?.toBase58() ?? null,
    sponsorOrgId: linkedIntent?.sponsorOrgId ?? existing?.sponsorOrgId ?? null,
    creatorOrgId: linkedIntent?.creatorOrgId ?? existing?.creatorOrgId ?? null,
    manifestId: linkedIntent?.manifestId ?? existing?.manifestId ?? null,
    intentId: linkedIntent?.id ?? existing?.intentId ?? null,
    contentHashHex: onChain.contentHashHex,
    contentAnchorPda: onChain.contentAnchorPda,
    deadlineAt: toDateFromUnixSeconds(onChain.deadlineUnix) ?? new Date(0),
    status: normalizedStatus,
    track1BaseUsdc: onChain.track1BaseUsdc,
    track1Claimed: onChain.track1Claimed,
    track2MetricType: onChain.track2MetricType,
    track2TargetValue: onChain.track2TargetValue,
    track2MinAchievementBps: onChain.track2MinAchievementBps,
    track2UsdcDeposited: onChain.track2UsdcDeposited,
    track2ActualValue: onChain.track2ActualValue,
    track2SettledAt,
    track2InitialFanPool: onChain.track2InitialFanPool,
    track2InitialSpumpStaked: onChain.track2InitialSpumpStaked,
    track3UsdcDeposited: onChain.track3UsdcDeposited,
    track3CpsPayout: onChain.track3CpsPayout,
    track3DelayDays: onChain.track3DelayDays,
    track3SettledAt,
    onChainTxSignature: params.signature,
    oracleSyncStatus: shouldMarkOracleSynced(params.instructionName)
      ? OracleSyncStatus.SYNCED
      : existing?.oracleSyncStatus ?? OracleSyncStatus.PENDING,
    oracleLastError: shouldMarkOracleSynced(params.instructionName)
      ? null
      : existing?.oracleLastError ?? null,
    proofStatus,
    fundingTxSignature:
      normalizedStatus === ProposalStatus.FUNDED
        ? params.signature
        : existing?.fundingTxSignature ?? null,
    latestSettlementTxSignature: isSettlingOrSettled ? params.signature : null,
  };

  return prisma.proposal.upsert({
    where: {
      proposalPda: params.proposalPda,
    },
    update: payload,
    create: {
      proposalPda: params.proposalPda,
      ...payload,
    },
  });
};

import { createHash, randomUUID } from "crypto";

import { ProposalStatus } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import { HttpError } from "../controllers/http";
import { getAnchorService } from "./AnchorService";
import { buildCampaignIntegrity } from "./campaignIntegrity";
import { syncProposalProjectionFromChain } from "./chainProjectionService";
import { prisma } from "./prisma";

const TRACK = "TRACK1" as const;
const CONFIRMATION = "SETTLE_TRACK1_MANUALLY";
const LEASE_MS = 2 * 60_000;
const LEASE_HEARTBEAT_MS = 30_000;

type OperationStatus = "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";

type SettlementOperation = {
  id: string;
  proposalId: string;
  proposalPda: string;
  track: typeof TRACK;
  idempotencyKey: string;
  payloadHash: string;
  operatorIdentity: string;
  evidenceDigest: string;
  status: OperationStatus;
  txSignature: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastAttemptAt: Date | null;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SettlementProposal = {
  id: string;
  proposalPda: string;
  creatorWallet: string;
  sponsorWallet: string | null;
  status: ProposalStatus;
  deadlineAt: Date;
  track1BaseUsdc: bigint;
  track1Claimed: boolean;
  track2UsdcDeposited: bigint;
  track3UsdcDeposited: bigint;
  contentHashHex: string | null;
  contentAnchorPda: string | null;
  contentAnchorTx: string | null;
  latestSettlementTxSignature: string | null;
  onChainTxSignature: string | null;
  manifest: any | null;
};

type SettlementDependencies = {
  prisma: any;
  anchor: {
    fetchProposalState(proposalPda: PublicKey): Promise<any | null>;
    executeSettleTrack1Base(proposalPda: PublicKey): Promise<string>;
    getSignatureState(signature: string): Promise<"NOT_FOUND" | "FAILED" | "PENDING" | "SUCCESS">;
  };
  syncProjection(params: {
    proposalPda: string;
    signature: string;
    instructionName: string;
  }): Promise<unknown>;
  now(): Date;
  randomId(): string;
};

const resolveDependencies = (
  overrides?: Partial<SettlementDependencies>
): SettlementDependencies => ({
  prisma: overrides?.prisma ?? prisma,
  anchor: overrides?.anchor ?? getAnchorService(),
  syncProjection: overrides?.syncProjection ?? syncProposalProjectionFromChain,
  now: overrides?.now ?? (() => new Date()),
  randomId: overrides?.randomId ?? randomUUID,
});

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested) =>
    typeof nested === "bigint" ? nested.toString() : nested
  );

const errorCode = (error: unknown): string =>
  error instanceof HttpError ? error.code : "TRACK1_SETTLEMENT_FAILED";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 1_000) : "Track 1 settlement failed";

const operationResponse = (
  operation: SettlementOperation,
  recoveredFromChain = false
) => ({
  operationId: operation.id,
  proposalPda: operation.proposalPda,
  track: operation.track,
  status: operation.status,
  txSignature: operation.txSignature,
  evidenceDigest: operation.evidenceDigest,
  attemptCount: operation.attemptCount,
  recoveredFromChain,
  submittedAt: operation.submittedAt?.toISOString() ?? null,
  confirmedAt: operation.confirmedAt?.toISOString() ?? null,
});

const buildEvidenceDigest = (proposal: SettlementProposal): string => {
  const manifest = proposal.manifest;
  const assets = [...(manifest?.assets ?? [])]
    .sort((left: any, right: any) => left.orderIndex - right.orderIndex)
    .map((asset: any) => ({
      id: asset.id,
      orderIndex: asset.orderIndex,
      sha256Hex: asset.sha256Hex,
      fileSizeBytes: asset.fileSizeBytes,
      verifiedSha256Hex: asset.verifiedSha256Hex,
      verifiedSizeBytes: asset.verifiedSizeBytes,
      storageVerifiedAt: asset.storageVerifiedAt?.toISOString() ?? null,
      uploadStatus: asset.uploadStatus,
      processingStatus: asset.processingStatus,
      muxPlaybackId: asset.muxPlaybackId,
    }));
  const publications = [...(manifest?.publications ?? [])]
    .sort((left: any, right: any) => left.id.localeCompare(right.id))
    .map((publication: any) => ({
      id: publication.id,
      verificationStatus: publication.verificationStatus,
      verificationSource: publication.verificationSource,
      verificationReviewer: publication.verificationReviewer,
      verificationEvidenceDigestHex: publication.verificationEvidenceDigestHex,
      verifiedAt: publication.verifiedAt?.toISOString() ?? null,
      externalUrlDigestHex: publication.externalUrlDigestHex,
    }));

  return sha256(stableJson({
    proposalId: proposal.id,
    proposalPda: proposal.proposalPda,
    deadlineAt: proposal.deadlineAt.toISOString(),
    budgets: {
      track1: proposal.track1BaseUsdc,
      track2: proposal.track2UsdcDeposited,
      track3: proposal.track3UsdcDeposited,
    },
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    contentAnchorTx: proposal.contentAnchorTx,
    manifest: manifest
      ? {
          id: manifest.id,
          status: manifest.status,
          manifestHashHex: manifest.manifestHashHex,
          currentAnchorPda: manifest.currentAnchorPda,
          currentAnchorTx: manifest.currentAnchorTx,
          assets,
          publications,
        }
      : null,
  }));
};

const loadProposal = async (
  deps: SettlementDependencies,
  proposalPda: string
): Promise<SettlementProposal> => {
  const proposal = await deps.prisma.proposal.findUnique({
    where: { proposalPda },
    include: {
      manifest: {
        include: {
          assets: true,
          publications: true,
        },
      },
    },
  });

  if (!proposal) {
    throw new HttpError(404, "PROPOSAL_NOT_FOUND", "proposal was not found");
  }

  return proposal as SettlementProposal;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && (error as any).code === "P2002");

const ensureOperation = async (params: {
  deps: SettlementDependencies;
  proposal: SettlementProposal;
  idempotencyKey: string;
  payloadHash: string;
  operatorIdentity: string;
  evidenceDigest: string;
}): Promise<SettlementOperation> => {
  const where = {
    proposalPda_track: {
      proposalPda: params.proposal.proposalPda,
      track: TRACK,
    },
  };
  let operation = await params.deps.prisma.track1SettlementOperation.findUnique({ where });

  if (!operation) {
    try {
      operation = await params.deps.prisma.track1SettlementOperation.create({
        data: {
          proposalId: params.proposal.id,
          proposalPda: params.proposal.proposalPda,
          track: TRACK,
          idempotencyKey: params.idempotencyKey,
          payloadHash: params.payloadHash,
          operatorIdentity: params.operatorIdentity,
          evidenceDigest: params.evidenceDigest,
          status: "PENDING",
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      operation = await params.deps.prisma.track1SettlementOperation.findUnique({ where });
    }
  }

  if (!operation) {
    throw new Error("failed to create or reload Track 1 settlement operation");
  }
  if (
    operation.idempotencyKey !== params.idempotencyKey ||
    operation.payloadHash !== params.payloadHash
  ) {
    throw new HttpError(
      409,
      "TRACK1_SETTLEMENT_IDEMPOTENCY_CONFLICT",
      "a different Track 1 settlement request already exists for this proposal"
    );
  }
  if (operation.operatorIdentity !== params.operatorIdentity) {
    throw new HttpError(
      409,
      "TRACK1_SETTLEMENT_OPERATOR_CONFLICT",
      "the existing settlement operation belongs to a different operator"
    );
  }

  return operation as SettlementOperation;
};

const markFailed = async (
  deps: SettlementDependencies,
  operationId: string,
  error: unknown,
  leaseToken?: string
): Promise<void> => {
  await deps.prisma.track1SettlementOperation.updateMany({
    where: {
      id: operationId,
      ...(leaseToken ? { leaseToken } : {}),
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "FAILED",
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
      failedAt: deps.now(),
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
};

const recordPreflightError = async (
  deps: SettlementDependencies,
  operation: SettlementOperation,
  error: unknown
): Promise<void> => {
  if (operation.status !== "SUBMITTED") {
    await markFailed(deps, operation.id, error);
    return;
  }
  await deps.prisma.track1SettlementOperation.updateMany({
    where: { id: operation.id, status: "SUBMITTED" },
    data: {
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
    },
  });
};

const markSubmittedTransactionFailed = async (
  deps: SettlementDependencies,
  operation: SettlementOperation
): Promise<void> => {
  await deps.prisma.track1SettlementOperation.updateMany({
    where: {
      id: operation.id,
      status: "SUBMITTED",
      txSignature: operation.txSignature,
    },
    data: {
      status: "FAILED",
      errorCode: "TRACK1_SETTLEMENT_TRANSACTION_FAILED",
      errorMessage: "submitted settlement transaction failed",
      failedAt: deps.now(),
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
};

const leaseLostError = (): HttpError =>
  new HttpError(
    409,
    "TRACK1_SETTLEMENT_LEASE_LOST",
    "Track 1 settlement lease was lost; this worker cannot write settlement state"
  );

const renewTrack1Lease = async (params: {
  deps: SettlementDependencies;
  operationId: string;
  leaseToken: string;
}): Promise<boolean> => {
  const now = params.deps.now();
  const renewed = await params.deps.prisma.track1SettlementOperation.updateMany({
    where: {
      id: params.operationId,
      leaseToken: params.leaseToken,
      status: { in: ["PENDING", "SUBMITTED"] },
    },
    data: {
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
    },
  });
  return renewed.count === 1;
};

const startTrack1LeaseHeartbeat = (params: {
  deps: SettlementDependencies;
  operationId: string;
  leaseToken: string;
}) => {
  let leaseLost = false;
  let renewalRunning = false;
  const timer = setInterval(() => {
    if (renewalRunning || leaseLost) return;
    renewalRunning = true;
    void renewTrack1Lease(params)
      .then((renewed) => {
        if (!renewed) leaseLost = true;
      })
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        renewalRunning = false;
      });
  }, LEASE_HEARTBEAT_MS);
  timer.unref();

  return {
    stop: () => clearInterval(timer),
    assertOwned: () => {
      if (leaseLost) throw leaseLostError();
    },
  };
};

const requireSuccessfulSettlementSignature = async (
  deps: SettlementDependencies,
  candidates: Array<string | null | undefined>
): Promise<string> => {
  const signatures = [...new Set(candidates.map((value) => value?.trim()).filter(Boolean))] as string[];
  if (signatures.length === 0) {
    throw new HttpError(
      503,
      "CHAIN_SETTLED_SIGNATURE_MISSING",
      "Track 1 is settled on-chain but the settlement transaction signature is unavailable"
    );
  }

  for (const signature of signatures) {
    let state: "NOT_FOUND" | "FAILED" | "PENDING" | "SUCCESS";
    try {
      state = await deps.anchor.getSignatureState(signature);
    } catch {
      continue;
    }
    if (state === "SUCCESS") return signature;
  }

  throw new HttpError(
    503,
    "CHAIN_SETTLED_SIGNATURE_UNVERIFIED",
    "Track 1 is settled on-chain but no candidate settlement transaction is confirmed successful"
  );
};

const recordChainSettledSignatureError = async (params: {
  deps: SettlementDependencies;
  operation: SettlementOperation;
  error: unknown;
  leaseToken?: string;
}): Promise<void> => {
  await params.deps.prisma.track1SettlementOperation.updateMany({
    where: {
      id: params.operation.id,
      status: { not: "CONFIRMED" },
      ...(params.leaseToken
        ? { leaseToken: params.leaseToken }
        : { leaseToken: null }),
    },
    data: {
      status: "SUBMITTED",
      errorCode: errorCode(params.error),
      errorMessage: errorMessage(params.error),
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
};

const publicKeyString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as any).toBase58 === "function") return (value as any).toBase58();
  return String(value);
};

export const track1ProjectionMismatchFields = (params: {
  proposal: Pick<
    SettlementProposal,
    | "creatorWallet"
    | "sponsorWallet"
    | "contentHashHex"
    | "contentAnchorPda"
    | "deadlineAt"
    | "track1BaseUsdc"
    | "track2UsdcDeposited"
    | "track3UsdcDeposited"
    | "status"
  >;
  onChain: any;
}): string[] => {
  const { proposal, onChain } = params;
  const mismatches: string[] = [];
  if (publicKeyString(onChain.creator) !== proposal.creatorWallet) mismatches.push("creatorWallet");
  if (publicKeyString(onChain.sponsor) !== proposal.sponsorWallet) mismatches.push("sponsorWallet");
  if (
    String(onChain.contentHashHex ?? "").toLowerCase() !==
    String(proposal.contentHashHex ?? "").toLowerCase()
  ) mismatches.push("contentHashHex");
  if ((onChain.contentAnchorPda ?? null) !== proposal.contentAnchorPda) {
    mismatches.push("contentAnchorPda");
  }
  if (BigInt(onChain.deadlineUnix) !== BigInt(Math.floor(proposal.deadlineAt.getTime() / 1_000))) {
    mismatches.push("deadlineAt");
  }
  if (BigInt(onChain.track1BaseUsdc) !== proposal.track1BaseUsdc) {
    mismatches.push("track1BaseUsdc");
  }
  if (BigInt(onChain.track2UsdcDeposited) !== proposal.track2UsdcDeposited) {
    mismatches.push("track2UsdcDeposited");
  }
  if (BigInt(onChain.track3UsdcDeposited) !== proposal.track3UsdcDeposited) {
    mismatches.push("track3UsdcDeposited");
  }
  if (String(onChain.status) !== String(proposal.status)) mismatches.push("status");
  return mismatches;
};

const assertChainMatchesProjection = (
  proposal: SettlementProposal,
  onChain: any
): void => {
  const mismatchFields = track1ProjectionMismatchFields({ proposal, onChain });
  if (mismatchFields.length > 0) {
    throw new HttpError(
      409,
      "TRACK1_CHAIN_DB_MISMATCH",
      `on-chain proposal does not match the database projection: ${mismatchFields.join(", ")}`
    );
  }
};

const assertEligible = (params: {
  proposal: SettlementProposal;
  onChain: any;
  now: Date;
}): void => {
  const { proposal, onChain, now } = params;
  assertChainMatchesProjection(proposal, onChain);
  const integrity = buildCampaignIntegrity({
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    contentAnchorTx: proposal.contentAnchorTx,
    track1Claimed: proposal.track1Claimed,
    track2UsdcDeposited: proposal.track2UsdcDeposited,
    track3UsdcDeposited: proposal.track3UsdcDeposited,
    latestSettlementTxSignature: proposal.latestSettlementTxSignature,
    manifest: proposal.manifest,
  });

  if (proposal.status !== ProposalStatus.FUNDED || onChain.status !== "FUNDED") {
    throw new HttpError(409, "TRACK1_SETTLEMENT_NOT_FUNDED", "proposal must be funded before Track 1 settlement");
  }
  if (proposal.deadlineAt.getTime() > now.getTime() || Number(onChain.deadlineUnix) * 1000 > now.getTime()) {
    throw new HttpError(409, "TRACK1_SETTLEMENT_NOT_DUE", "proposal deadline has not been reached");
  }
  if (proposal.track1Claimed || onChain.track1Claimed) {
    throw new HttpError(409, "TRACK1_ALREADY_SETTLED", "Track 1 is already settled");
  }
  if (
    !integrity.track1OnlyBudget ||
    BigInt(onChain.track2UsdcDeposited) !== 0n ||
    BigInt(onChain.track3UsdcDeposited) !== 0n
  ) {
    throw new HttpError(409, "TRACK1_ONLY_BUDGET_REQUIRED", "Track 2 and Track 3 budgets must be zero");
  }
  if (!integrity.manifestFinalized || !integrity.assetsReady) {
    throw new HttpError(409, "TRACK1_CONTENT_NOT_READY", "manifest and verified assets must be ready");
  }
  if (!integrity.operatorApprovedPublication) {
    throw new HttpError(409, "TRACK1_PUBLICATION_NOT_APPROVED", "an operator-approved publication is required");
  }
  if (
    !integrity.contentHashMatchesManifest ||
    !integrity.contentAnchorMatchesManifest ||
    !integrity.contentAnchorTransactionPresent
  ) {
    throw new HttpError(409, "TRACK1_CONTENT_INTEGRITY_MISMATCH", "proposal content evidence does not match the manifest");
  }
};

const confirmFromChain = async (params: {
  deps: SettlementDependencies;
  proposal: SettlementProposal;
  operation: SettlementOperation;
  signature: string;
  recoveredFromChain: boolean;
  leaseToken?: string;
}) => {
  const signature = await requireSuccessfulSettlementSignature(params.deps, [params.signature]);
  const now = params.deps.now();
  const confirmedWrite = await params.deps.prisma.track1SettlementOperation.updateMany({
    where: params.leaseToken
      ? {
          id: params.operation.id,
          status: "SUBMITTED",
          txSignature: signature,
          leaseToken: params.leaseToken,
        }
      : {
          id: params.operation.id,
          OR: [
            { status: "CONFIRMED", txSignature: signature },
            {
              status: { in: ["PENDING", "SUBMITTED", "FAILED"] },
              leaseToken: null,
            },
          ],
        },
    data: {
      status: "CONFIRMED",
      txSignature: signature,
      confirmedAt: now,
      errorCode: null,
      errorMessage: null,
      failedAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  if (confirmedWrite.count !== 1) {
    throw params.leaseToken
      ? leaseLostError()
      : new HttpError(
          409,
          "TRACK1_SETTLEMENT_AUDIT_CONFLICT",
          "settlement proof could not be attached to the current audit operation"
        );
  }

  const synced = await params.deps.syncProjection({
    proposalPda: params.proposal.proposalPda,
    signature,
    instructionName: "settle_track1_base",
  });
  if (synced === null) {
    throw new HttpError(
      502,
      "TRACK1_PROJECTION_SYNC_INCOMPLETE",
      "Track 1 is settled on-chain but the database projection could not be synchronized"
    );
  }

  const confirmed = await params.deps.prisma.track1SettlementOperation.findUnique({
    where: { id: params.operation.id },
  });
  if (!confirmed) {
    throw new HttpError(503, "TRACK1_SETTLEMENT_AUDIT_MISSING", "settlement audit record is missing");
  }
  return operationResponse(confirmed, params.recoveredFromChain);
};

export const settleTrack1Manually = async (
  params: {
    proposalPda: string;
    idempotencyKey: string;
    confirmation: string;
    operatorIdentity: string;
  },
  dependencies?: Partial<SettlementDependencies>
) => {
  const deps = resolveDependencies(dependencies);
  let proposalPda: string;
  try {
    proposalPda = new PublicKey(params.proposalPda).toBase58();
  } catch {
    throw new HttpError(400, "INVALID_PROPOSAL_PDA", "proposalPda must be a valid Solana public key");
  }
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "x-idempotency-key is required and must be at most 160 characters");
  }
  if (params.confirmation !== CONFIRMATION) {
    throw new HttpError(400, "TRACK1_SETTLEMENT_CONFIRMATION_REQUIRED", `confirmation must equal ${CONFIRMATION}`);
  }
  if (!params.operatorIdentity.trim()) {
    throw new HttpError(400, "OPERATOR_ID_REQUIRED", "operator identity is required");
  }

  const proposal = await loadProposal(deps, proposalPda);
  const evidenceDigest = buildEvidenceDigest(proposal);
  const payloadHash = sha256(stableJson({ proposalPda, confirmation: params.confirmation }));
  let operation = await ensureOperation({
    deps,
    proposal,
    idempotencyKey,
    payloadHash,
    operatorIdentity: params.operatorIdentity.trim(),
    evidenceDigest,
  });

  let onChain = await deps.anchor.fetchProposalState(new PublicKey(proposalPda));
  if (!onChain) {
    const error = new HttpError(409, "TRACK1_CHAIN_PROPOSAL_NOT_FOUND", "proposal account was not found on-chain");
    await recordPreflightError(deps, operation, error);
    throw error;
  }

  try {
    assertChainMatchesProjection(proposal, onChain);
  } catch (error) {
    await recordPreflightError(deps, operation, error);
    throw error;
  }

  if (onChain.track1Claimed) {
    let settlementSignature: string;
    try {
      settlementSignature = await requireSuccessfulSettlementSignature(deps, [
        operation.txSignature,
        proposal.latestSettlementTxSignature,
      ]);
    } catch (error) {
      await recordChainSettledSignatureError({ deps, operation, error });
      throw error;
    }
    return confirmFromChain({
      deps,
      proposal,
      operation,
      signature: settlementSignature,
      recoveredFromChain: operation.status !== "CONFIRMED",
    });
  }
  if (operation.status === "CONFIRMED") {
    throw new HttpError(409, "TRACK1_SETTLEMENT_AUDIT_CHAIN_MISMATCH", "audit is confirmed but Track 1 is not settled on-chain");
  }

  if (operation.status === "SUBMITTED" && operation.txSignature) {
    const signatureState = await deps.anchor.getSignatureState(operation.txSignature);
    if (signatureState === "PENDING" || signatureState === "NOT_FOUND") {
      return operationResponse(operation);
    }
    if (signatureState === "SUCCESS") {
      onChain = await deps.anchor.fetchProposalState(new PublicKey(proposalPda));
      if (onChain?.track1Claimed) {
        assertChainMatchesProjection(proposal, onChain);
        return confirmFromChain({
          deps,
          proposal,
          operation,
          signature: operation.txSignature,
          recoveredFromChain: true,
        });
      }
      await deps.prisma.track1SettlementOperation.updateMany({
        where: { id: operation.id, status: "SUBMITTED", txSignature: operation.txSignature },
        data: {
          errorCode: "TRACK1_CHAIN_CONFIRMATION_PENDING",
          errorMessage:
            "the transaction succeeded but the proposal account has not reflected Track 1 settlement yet",
        },
      });
      return operationResponse(operation);
    }
    await markSubmittedTransactionFailed(deps, operation);
    operation = {
      ...operation,
      status: "FAILED",
      leaseToken: null,
      leaseExpiresAt: null,
    };
  }

  try {
    assertEligible({ proposal, onChain, now: deps.now() });
  } catch (error) {
    await recordPreflightError(deps, operation, error);
    throw error;
  }

  const leaseToken = deps.randomId();
  const leasedAt = deps.now();
  const lease = await deps.prisma.track1SettlementOperation.updateMany({
    where: {
      id: operation.id,
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: leasedAt } }],
    },
    data: {
      status: "PENDING",
      evidenceDigest,
      attemptCount: { increment: 1 },
      lastAttemptAt: leasedAt,
      leaseToken,
      leaseExpiresAt: new Date(leasedAt.getTime() + LEASE_MS),
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    },
  });
  if (lease.count !== 1) {
    throw new HttpError(409, "TRACK1_SETTLEMENT_IN_PROGRESS", "another Track 1 settlement attempt is in progress");
  }
  const leaseHeartbeat = startTrack1LeaseHeartbeat({
    deps,
    operationId: operation.id,
    leaseToken,
  });

  let signature: string | null = null;
  try {
    onChain = await deps.anchor.fetchProposalState(new PublicKey(proposalPda));
    if (!onChain) {
      throw new HttpError(409, "TRACK1_CHAIN_PROPOSAL_NOT_FOUND", "proposal account was not found on-chain");
    }
    assertChainMatchesProjection(proposal, onChain);
    if (onChain.track1Claimed) {
      const refreshed = await deps.prisma.track1SettlementOperation.findUnique({
        where: { id: operation.id },
      });
      const currentOperation = (refreshed ?? operation) as SettlementOperation;
      let settlementSignature: string;
      try {
        settlementSignature = await requireSuccessfulSettlementSignature(deps, [
          currentOperation.txSignature,
          proposal.latestSettlementTxSignature,
        ]);
      } catch (error) {
        await recordChainSettledSignatureError({
          deps,
          operation: currentOperation,
          error,
          leaseToken,
        });
        throw error;
      }
      return confirmFromChain({
        deps,
        proposal,
        operation: currentOperation,
        signature: settlementSignature,
        recoveredFromChain: true,
        leaseToken,
      });
    }
    assertEligible({ proposal, onChain, now: deps.now() });

    signature = await deps.anchor.executeSettleTrack1Base(new PublicKey(proposalPda));
    leaseHeartbeat.assertOwned();
    const submittedWrite = await deps.prisma.track1SettlementOperation.updateMany({
      where: {
        id: operation.id,
        status: "PENDING",
        leaseToken,
      },
      data: {
        status: "SUBMITTED",
        txSignature: signature,
        submittedAt: deps.now(),
      },
    });
    if (submittedWrite.count !== 1) {
      throw leaseLostError();
    }
    operation = await deps.prisma.track1SettlementOperation.findUnique({
      where: { id: operation.id },
    });
    if (!operation || operation.leaseToken !== leaseToken || operation.txSignature !== signature) {
      throw leaseLostError();
    }

    const confirmedChain = await deps.anchor.fetchProposalState(new PublicKey(proposalPda));
    if (!confirmedChain?.track1Claimed) {
      const pendingWrite = await deps.prisma.track1SettlementOperation.updateMany({
        where: {
          id: operation.id,
          status: "SUBMITTED",
          txSignature: signature,
          leaseToken,
        },
        data: {
          errorCode: "TRACK1_CHAIN_CONFIRMATION_PENDING",
          errorMessage:
            "settlement transaction was submitted but the proposal account has not reflected Track 1 settlement yet",
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (pendingWrite.count !== 1) throw leaseLostError();
      const pending = await deps.prisma.track1SettlementOperation.findUnique({
        where: { id: operation.id },
      });
      return operationResponse(pending ?? operation);
    }
    assertChainMatchesProjection(proposal, confirmedChain);

    return confirmFromChain({
      deps,
      proposal,
      operation,
      signature,
      recoveredFromChain: false,
      leaseToken,
    });
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.code === "CHAIN_SETTLED_SIGNATURE_MISSING" ||
        error.code === "CHAIN_SETTLED_SIGNATURE_UNVERIFIED" ||
        error.code === "TRACK1_SETTLEMENT_LEASE_LOST")
    ) {
      throw error;
    }
    if (!signature) {
      await markFailed(deps, operation.id, error, leaseToken);
    } else {
      await deps.prisma.track1SettlementOperation.updateMany({
        where: {
          id: operation.id,
          status: "SUBMITTED",
          txSignature: signature,
          leaseToken,
        },
        data: {
          errorCode: errorCode(error),
          errorMessage: errorMessage(error),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
    }
    throw error;
  } finally {
    leaseHeartbeat.stop();
  }
};

export const TRACK1_MANUAL_SETTLEMENT_CONFIRMATION = CONFIRMATION;

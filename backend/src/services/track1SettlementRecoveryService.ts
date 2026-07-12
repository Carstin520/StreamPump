import { createHash } from "crypto";
import { PublicKey } from "@solana/web3.js";

import { HttpError } from "../controllers/http";
import { getAnchorService } from "./AnchorService";
import { buildCampaignIntegrity } from "./campaignIntegrity";
import { syncProposalProjectionFromChain } from "./chainProjectionService";
import { prisma } from "./prisma";
import {
  recordPilotRecoveryAudit,
  type RecoveryAuditInput,
} from "./pilotRecoveryOperations";
import { track1ProjectionMismatchFields } from "./track1SettlementService";

const TRACK = "TRACK1" as const;
export const TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS = 10 * 60_000;
export const TRACK1_SIGNATURE_RECHECK_AFTER_MS = 15_000;

type SignatureState = "NOT_FOUND" | "FAILED" | "PENDING" | "SUCCESS" | "RPC_ERROR";

type RecoveryDependencies = {
  prisma: any;
  anchor: {
    fetchProposalState(proposalPda: PublicKey): Promise<any | null>;
    getSignatureState(signature: string): Promise<"NOT_FOUND" | "FAILED" | "PENDING" | "SUCCESS">;
  };
  syncProjection(params: {
    proposalPda: string;
    signature: string;
    instructionName: string;
  }): Promise<unknown>;
  audit(input: RecoveryAuditInput): Promise<void>;
  now(): Date;
};

const resolveDependencies = (
  overrides?: Partial<RecoveryDependencies>
): RecoveryDependencies => ({
  prisma: overrides?.prisma ?? prisma,
  anchor: overrides?.anchor ?? getAnchorService(),
  syncProjection: overrides?.syncProjection ?? syncProposalProjectionFromChain,
  audit: overrides?.audit ?? recordPilotRecoveryAudit,
  now: overrides?.now ?? (() => new Date()),
});

const parseProposalPda = (value: string): string => {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new HttpError(
      400,
      "INVALID_PROPOSAL_PDA",
      "proposalPda must be a valid Solana public key"
    );
  }
};

const iso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const publicKeyString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as any).toBase58 === "function") {
    return (value as any).toBase58();
  }
  return String(value);
};

const safeOperationErrorMessage = (code: string | null): string | null => {
  if (!code) return null;
  const known: Record<string, string> = {
    TRACK1_CHAIN_CONFIRMATION_PENDING:
      "The stored transaction succeeded, but Track 1 is not yet visible in the proposal account.",
    TRACK1_CHAIN_CONFIRMATION_TIMED_OUT:
      "The proposal account did not reflect Track 1 before the observation deadline.",
    TRACK1_SETTLEMENT_TRANSACTION_FAILED:
      "The stored settlement transaction failed on-chain.",
    TRACK1_SIGNATURE_PENDING:
      "The stored settlement transaction is still awaiting confirmation.",
    TRACK1_SIGNATURE_NOT_FOUND:
      "The stored settlement transaction is not currently visible in RPC history.",
    TRACK1_SIGNATURE_OBSERVATION_TIMED_OUT:
      "The stored transaction remained pending or unavailable past the observation deadline.",
    CHAIN_SETTLED_SIGNATURE_MISSING:
      "Track 1 is settled on-chain, but no stored settlement signature is available.",
    CHAIN_SETTLED_SIGNATURE_UNVERIFIED:
      "Track 1 is settled on-chain, but no stored settlement signature is confirmed successful.",
  };
  return known[code] ?? "The Track 1 operation requires operator review.";
};

const safeReadError = (code: string, message: string) => ({ code, message });

const loadRecoveryState = async (
  deps: RecoveryDependencies,
  proposalPda: string
) => {
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

  const operation = await deps.prisma.track1SettlementOperation.findUnique({
    where: {
      proposalPda_track: {
        proposalPda,
        track: TRACK,
      },
    },
  });

  let onChain: any | null = null;
  let chainReadError: { code: string; message: string } | null = null;
  try {
    onChain = await deps.anchor.fetchProposalState(new PublicKey(proposalPda));
  } catch {
    chainReadError = safeReadError(
      "TRACK1_CHAIN_READ_FAILED",
      "The proposal account could not be read from the configured RPC."
    );
  }

  return { proposal, operation, onChain, chainReadError };
};

type SignatureObservation = {
  source: "OPERATION" | "PROJECTION";
  signature: string;
  state: SignatureState;
  resolution: "CONFIRMED" | "FAILED" | "WAITING" | "TIMED_OUT" | "UNAVAILABLE";
  observedAt: string;
  observationStartedAt: string;
  observationDeadlineAt: string;
  nextCheckAt: string | null;
  timedOut: boolean;
  autoResubmit: false;
};

const observeSignatures = async (params: {
  deps: RecoveryDependencies;
  proposal: any;
  operation: any | null;
}): Promise<SignatureObservation[]> => {
  const now = params.deps.now();
  const startedAt =
    params.operation?.submittedAt ??
    params.operation?.lastAttemptAt ??
    params.operation?.updatedAt ??
    params.proposal.updatedAt ??
    now;
  const deadlineAt = new Date(
    startedAt.getTime() + TRACK1_SIGNATURE_OBSERVATION_WINDOW_MS
  );
  const candidates = [
    { source: "OPERATION" as const, signature: params.operation?.txSignature },
    {
      source: "PROJECTION" as const,
      signature: params.proposal.latestSettlementTxSignature,
    },
  ].filter(
    (candidate, index, all) =>
      Boolean(candidate.signature) &&
      all.findIndex((other) => other.signature === candidate.signature) === index
  ) as Array<{ source: "OPERATION" | "PROJECTION"; signature: string }>;

  return Promise.all(
    candidates.map(async (candidate): Promise<SignatureObservation> => {
      let state: SignatureState;
      try {
        state = await params.deps.anchor.getSignatureState(candidate.signature);
      } catch {
        state = "RPC_ERROR";
      }

      const waiting = state === "PENDING" || state === "NOT_FOUND";
      const timedOut = waiting && now.getTime() >= deadlineAt.getTime();
      const nextCheckAt =
        waiting && !timedOut
          ? new Date(
              Math.min(
                now.getTime() + TRACK1_SIGNATURE_RECHECK_AFTER_MS,
                deadlineAt.getTime()
              )
            ).toISOString()
          : null;
      const resolution =
        state === "SUCCESS"
          ? "CONFIRMED"
          : state === "FAILED"
            ? "FAILED"
            : state === "RPC_ERROR"
              ? "UNAVAILABLE"
              : timedOut
                ? "TIMED_OUT"
                : "WAITING";

      return {
        source: candidate.source,
        signature: candidate.signature,
        state,
        resolution,
        observedAt: now.toISOString(),
        observationStartedAt: startedAt.toISOString(),
        observationDeadlineAt: deadlineAt.toISOString(),
        nextCheckAt,
        timedOut,
        autoResubmit: false,
      };
    })
  );
};

const integrityFor = (proposal: any) =>
  buildCampaignIntegrity({
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    contentAnchorTx: proposal.contentAnchorTx,
    track1Claimed: proposal.track1Claimed,
    track2UsdcDeposited: proposal.track2UsdcDeposited,
    track3UsdcDeposited: proposal.track3UsdcDeposited,
    latestSettlementTxSignature: proposal.latestSettlementTxSignature,
    manifest: proposal.manifest,
  });

type Blocker = {
  code: string;
  message: string;
  retryable: boolean;
  availableAt?: string;
};

const buildBlockers = (params: {
  proposal: any;
  operation: any | null;
  onChain: any | null;
  chainReadError: { code: string; message: string } | null;
  integrity: ReturnType<typeof buildCampaignIntegrity>;
  mismatchFields: string[];
  signatures: SignatureObservation[];
  now: Date;
}): Blocker[] => {
  const blockers: Blocker[] = [];
  const add = (blocker: Blocker) => {
    if (!blockers.some((existing) => existing.code === blocker.code)) {
      blockers.push(blocker);
    }
  };

  if (params.chainReadError) {
    add({ ...params.chainReadError, retryable: true });
  } else if (!params.onChain) {
    add({
      code: "TRACK1_CHAIN_PROPOSAL_NOT_FOUND",
      message: "The proposal account was not found on-chain.",
      retryable: false,
    });
  }
  if (params.mismatchFields.length > 0) {
    add({
      code: "TRACK1_CHAIN_DB_MISMATCH",
      message: `Chain and projection differ for: ${params.mismatchFields.join(", ")}.`,
      retryable: false,
    });
  }
  if (params.proposal.status !== "FUNDED" || params.onChain?.status !== "FUNDED") {
    add({
      code: "TRACK1_SETTLEMENT_NOT_FUNDED",
      message: "Both the projection and chain proposal must be FUNDED.",
      retryable: false,
    });
  }
  const chainDeadlineMs = params.onChain
    ? Number(params.onChain.deadlineUnix) * 1_000
    : 0;
  const dueAtMs = Math.max(params.proposal.deadlineAt.getTime(), chainDeadlineMs);
  if (dueAtMs > params.now.getTime()) {
    add({
      code: "TRACK1_SETTLEMENT_NOT_DUE",
      message: "The Track 1 deadline has not been reached.",
      retryable: true,
      availableAt: new Date(dueAtMs).toISOString(),
    });
  }
  if (params.proposal.track1Claimed || params.onChain?.track1Claimed) {
    add({
      code: "TRACK1_ALREADY_SETTLED",
      message: "Track 1 is already settled and must not be submitted again.",
      retryable: false,
    });
  }
  if (params.onChain?.track1Claimed && !params.operation) {
    add({
      code: "TRACK1_SETTLEMENT_AUDIT_MISSING",
      message:
        "Track 1 is settled on-chain, but the manual settlement audit operation is missing.",
      retryable: false,
    });
  }
  if (!params.integrity.track1OnlyBudget) {
    add({
      code: "TRACK1_ONLY_BUDGET_REQUIRED",
      message: "Track 2 and Track 3 budgets must be zero.",
      retryable: false,
    });
  }
  if (!params.integrity.manifestFinalized || !params.integrity.assetsReady) {
    add({
      code: "TRACK1_CONTENT_NOT_READY",
      message: "The manifest and every verified asset must be ready.",
      retryable: true,
    });
  }
  if (!params.integrity.operatorApprovedPublication) {
    add({
      code: "TRACK1_PUBLICATION_NOT_APPROVED",
      message: "An operator-approved publication is required.",
      retryable: true,
    });
  }
  if (
    !params.integrity.contentHashMatchesManifest ||
    !params.integrity.contentAnchorMatchesManifest ||
    !params.integrity.contentAnchorTransactionPresent
  ) {
    add({
      code: "TRACK1_CONTENT_INTEGRITY_MISMATCH",
      message: "Content hash or anchor evidence does not match the manifest.",
      retryable: false,
    });
  }

  const leaseActive = Boolean(
    params.operation?.leaseToken &&
      params.operation?.leaseExpiresAt &&
      params.operation.leaseExpiresAt.getTime() > params.now.getTime()
  );
  if (leaseActive) {
    add({
      code: "TRACK1_SETTLEMENT_IN_PROGRESS",
      message: "A fenced Track 1 settlement lease is active.",
      retryable: true,
      availableAt: params.operation.leaseExpiresAt.toISOString(),
    });
  }
  if (params.operation?.status === "CONFIRMED" && !params.onChain?.track1Claimed) {
    add({
      code: "TRACK1_SETTLEMENT_AUDIT_CHAIN_MISMATCH",
      message: "The audit operation is confirmed while chain settlement is absent.",
      retryable: false,
    });
  }
  if (
    params.operation?.status === "SUBMITTED" &&
    !params.operation.txSignature &&
    !params.onChain?.track1Claimed
  ) {
    add({
      code: "TRACK1_SUBMITTED_SIGNATURE_MISSING",
      message:
        "The audit operation is SUBMITTED but has no stored settlement signature.",
      retryable: false,
    });
  }

  for (const signature of params.signatures) {
    if (signature.resolution === "WAITING") {
      add({
        code: `TRACK1_SIGNATURE_${signature.state}`,
        message: "A stored settlement signature is still inside its observation window.",
        retryable: true,
        availableAt: signature.nextCheckAt ?? signature.observationDeadlineAt,
      });
    } else if (signature.resolution === "TIMED_OUT") {
      add({
        code: "TRACK1_SIGNATURE_OBSERVATION_TIMED_OUT",
        message:
          "A stored settlement signature passed its observation deadline; operator review is required and no automatic resubmission will occur.",
        retryable: false,
      });
    } else if (signature.state === "SUCCESS" && !params.onChain?.track1Claimed) {
      add({
        code: "TRACK1_CHAIN_CONFIRMATION_PENDING",
        message:
          "The stored transaction succeeded, but the proposal account does not yet show Track 1 settlement.",
        retryable: true,
      });
    }
  }
  return blockers;
};

const buildDiagnostic = async (
  deps: RecoveryDependencies,
  proposalPda: string
) => {
  const observedAt = deps.now();
  const state = await loadRecoveryState(deps, proposalPda);
  const signatures = await observeSignatures({
    deps,
    proposal: state.proposal,
    operation: state.operation,
  });
  const integrity = integrityFor(state.proposal);
  const mismatchFields = state.onChain
    ? track1ProjectionMismatchFields({
        proposal: state.proposal,
        onChain: state.onChain,
      })
    : [];
  const blockers = buildBlockers({
    ...state,
    integrity,
    mismatchFields,
    signatures,
    now: observedAt,
  });
  const leaseActive = Boolean(
    state.operation?.leaseToken &&
      state.operation?.leaseExpiresAt &&
      state.operation.leaseExpiresAt.getTime() > observedAt.getTime()
  );

  return {
    proposalPda,
    observedAt: observedAt.toISOString(),
    projection: {
      proposalId: state.proposal.id,
      status: state.proposal.status,
      track1BaseUsdc: state.proposal.track1BaseUsdc.toString(),
      track1Claimed: state.proposal.track1Claimed,
      track2UsdcDeposited: state.proposal.track2UsdcDeposited.toString(),
      track3UsdcDeposited: state.proposal.track3UsdcDeposited.toString(),
      proofStatus: state.proposal.proofStatus,
      oracleSyncStatus: state.proposal.oracleSyncStatus,
      oracleError: state.proposal.oracleLastError
        ? {
            code: "TRACK1_ORACLE_SYNC_ERROR",
            message: "The projection reports an oracle synchronization error.",
            detailsRedacted: true,
          }
        : null,
      latestSettlementTxSignature:
        state.proposal.latestSettlementTxSignature ?? null,
      updatedAt: iso(state.proposal.updatedAt),
    },
    chain: {
      reachable: !state.chainReadError,
      exists: state.chainReadError ? null : Boolean(state.onChain),
      status: state.onChain?.status ?? null,
      track1Claimed: state.onChain?.track1Claimed ?? null,
      creatorWallet: publicKeyString(state.onChain?.creator),
      sponsorWallet: publicKeyString(state.onChain?.sponsor),
      mismatchFields,
      error: state.chainReadError,
      observedAt: observedAt.toISOString(),
    },
    integrity,
    operation: state.operation
      ? {
          exists: true,
          operationId: state.operation.id,
          status: state.operation.status,
          evidenceDigest: state.operation.evidenceDigest,
          txSignature: state.operation.txSignature,
          attemptCount: state.operation.attemptCount,
          error: state.operation.errorCode || state.operation.errorMessage
            ? {
                code: state.operation.errorCode ?? "TRACK1_OPERATION_ERROR",
                message: safeOperationErrorMessage(
                  state.operation.errorCode ?? "TRACK1_OPERATION_ERROR"
                ),
                detailsRedacted: Boolean(state.operation.errorMessage),
              }
            : null,
          timestamps: {
            createdAt: iso(state.operation.createdAt),
            updatedAt: iso(state.operation.updatedAt),
            lastAttemptAt: iso(state.operation.lastAttemptAt),
            submittedAt: iso(state.operation.submittedAt),
            confirmedAt: iso(state.operation.confirmedAt),
            failedAt: iso(state.operation.failedAt),
          },
        }
      : { exists: false },
    lease: {
      active: leaseActive,
      expiresAt: iso(state.operation?.leaseExpiresAt),
      expired: Boolean(
        state.operation?.leaseExpiresAt &&
          state.operation.leaseExpiresAt.getTime() <= observedAt.getTime()
      ),
      tokenRedacted: Boolean(state.operation?.leaseToken),
    },
    signatures,
    actions: {
      canExecute: blockers.length === 0,
      canReconcile: Boolean(
        !state.chainReadError && state.onChain && !leaseActive
      ),
      autoResubmit: false,
      blockers,
    },
  };
};

export const getTrack1SettlementDiagnostic = async (
  rawProposalPda: string,
  dependencies?: Partial<RecoveryDependencies>
) => {
  const deps = resolveDependencies(dependencies);
  return buildDiagnostic(deps, parseProposalPda(rawProposalPda));
};

const unlockedOperationWhere = (operation: any, now: Date) => ({
  id: operation.id,
  OR: [
    { leaseToken: null },
    { leaseExpiresAt: null },
    { leaseExpiresAt: { lte: now } },
  ],
});

export const reconcileTrack1Settlement = async (
  params: { proposalPda: string; operatorIdentity: string },
  dependencies?: Partial<RecoveryDependencies>
) => {
  const deps = resolveDependencies(dependencies);
  const proposalPda = parseProposalPda(params.proposalPda);
  if (!params.operatorIdentity.trim()) {
    throw new HttpError(
      400,
      "OPERATOR_ID_REQUIRED",
      "authenticated operator identity is required"
    );
  }

  const now = deps.now();
  const state = await loadRecoveryState(deps, proposalPda);
  if (state.chainReadError) {
    throw new HttpError(
      503,
      state.chainReadError.code,
      state.chainReadError.message
    );
  }
  if (!state.onChain) {
    throw new HttpError(
      409,
      "TRACK1_CHAIN_PROPOSAL_NOT_FOUND",
      "proposal account was not found on-chain"
    );
  }

  const mismatchFields = track1ProjectionMismatchFields({
    proposal: state.proposal,
    onChain: state.onChain,
  });
  if (mismatchFields.length > 0) {
    throw new HttpError(
      409,
      "TRACK1_CHAIN_DB_MISMATCH",
      "on-chain proposal does not match the database projection",
      { mismatchFields }
    );
  }

  if (
    state.operation?.leaseToken &&
    state.operation?.leaseExpiresAt &&
    state.operation.leaseExpiresAt.getTime() > now.getTime()
  ) {
    throw new HttpError(
      409,
      "TRACK1_RECONCILE_LEASE_ACTIVE",
      "an active Track 1 settlement lease cannot be reconciled"
    );
  }

  const signatures = await observeSignatures({
    deps,
    proposal: state.proposal,
    operation: state.operation,
  });
  const successful = signatures.find((signature) => signature.state === "SUCCESS");
  let repairedOperation = false;
  let repairedProjection = false;

  if (state.onChain.track1Claimed && successful) {
    const projectionNeededRepair =
      !state.proposal.track1Claimed ||
      state.proposal.latestSettlementTxSignature !== successful.signature;
    if (state.operation) {
      const write = await deps.prisma.track1SettlementOperation.updateMany({
        where: unlockedOperationWhere(state.operation, now),
        data: {
          status: "CONFIRMED",
          txSignature: successful.signature,
          confirmedAt: state.operation.confirmedAt ?? now,
          errorCode: null,
          errorMessage: null,
          failedAt: null,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (write.count !== 1) {
        throw new HttpError(
          409,
          "TRACK1_SETTLEMENT_AUDIT_CONFLICT",
          "settlement proof could not be attached to the audit operation"
        );
      }
      repairedOperation =
        state.operation.status !== "CONFIRMED" ||
        state.operation.txSignature !== successful.signature;
    }

    const synced = await deps.syncProjection({
      proposalPda,
      signature: successful.signature,
      instructionName: "settle_track1_base",
    });
    if (synced === null) {
      throw new HttpError(
        502,
        "TRACK1_PROJECTION_SYNC_INCOMPLETE",
        "Track 1 is settled on-chain but the projection could not be synchronized"
      );
    }
    repairedProjection = projectionNeededRepair;
  } else if (state.operation && state.operation.status !== "CONFIRMED") {
    const operationSignature = signatures.find(
      (signature) => signature.source === "OPERATION"
    );
    let status = state.operation.status;
    let code: string | null = state.operation.errorCode;

    if (operationSignature?.state === "FAILED") {
      status = "FAILED";
      code = "TRACK1_SETTLEMENT_TRANSACTION_FAILED";
    } else if (
      operationSignature?.state === "PENDING" ||
      operationSignature?.state === "NOT_FOUND"
    ) {
      code = operationSignature.timedOut
        ? "TRACK1_SIGNATURE_OBSERVATION_TIMED_OUT"
        : `TRACK1_SIGNATURE_${operationSignature.state}`;
    } else if (operationSignature?.state === "SUCCESS") {
      code = operationSignature.timedOut
        ? "TRACK1_CHAIN_CONFIRMATION_TIMED_OUT"
        : "TRACK1_CHAIN_CONFIRMATION_PENDING";
    } else if (state.onChain.track1Claimed) {
      code = signatures.length === 0
        ? "CHAIN_SETTLED_SIGNATURE_MISSING"
        : "CHAIN_SETTLED_SIGNATURE_UNVERIFIED";
      status = "SUBMITTED";
    }

    const write = await deps.prisma.track1SettlementOperation.updateMany({
      where: unlockedOperationWhere(state.operation, now),
      data: {
        status,
        errorCode: code,
        errorMessage: safeOperationErrorMessage(code),
        ...(status === "FAILED" ? { failedAt: now } : {}),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    repairedOperation =
      write.count === 1 &&
      (status !== state.operation.status || code !== state.operation.errorCode);
  }

  const diagnostic = await buildDiagnostic(deps, proposalPda);
  await deps.audit({
    action: "TRACK1_SETTLEMENT_RECONCILED",
    operatorIdentity: params.operatorIdentity.trim(),
    resourceType: "TRACK1_SETTLEMENT",
    resourceId: proposalPda,
    evidenceDigestHex: successful
      ? createHash("sha256").update(successful.signature, "utf8").digest("hex")
      : null,
    payload: {
      repairedOperation,
      repairedProjection,
      chainTrack1Claimed: Boolean(state.onChain.track1Claimed),
      signatureStates: signatures.map((signature) => signature.state),
      submittedTransaction: false,
      autoResubmit: false,
    },
  });
  return {
    ...diagnostic,
    reconciliation: {
      checkedAt: now.toISOString(),
      operatorIdentityRedacted: true,
      repairedOperation,
      repairedProjection,
      submittedTransaction: false,
      autoResubmit: false,
    },
  };
};

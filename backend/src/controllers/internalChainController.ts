import { HttpError, ok, parseNonEmptyString, withController } from "./http";
import { getAnchorService } from "../services/AnchorService";
import { prisma } from "../services/prisma";
import {
  reconcileProposalIntentWithAudit,
  replayChainTransactionWithAudit,
} from "../services/pilotRecoveryOperations";

const serializeAttempt = (attempt: any) =>
  attempt
    ? {
        signature: attempt.signature,
        slot: attempt.slot?.toString() ?? null,
        status: attempt.status,
        attemptCount: attempt.attemptCount,
        instructionCount: attempt.instructionCount,
        hasLastError: Boolean(attempt.lastError),
        lastErrorCode: attempt.lastError
          ? attempt.status === "PRUNED"
            ? "CHAIN_TRANSACTION_PRUNED"
            : attempt.status === "NOT_FOUND"
            ? "CHAIN_TRANSACTION_NOT_FOUND"
            : "CHAIN_INGESTION_FAILED"
          : null,
        firstObservedAt: attempt.firstObservedAt.toISOString(),
        lastAttemptAt: attempt.lastAttemptAt?.toISOString() ?? null,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        updatedAt: attempt.updatedAt.toISOString(),
      }
    : null;

const loadTransactionDiagnosis = async (signature: string) => {
  const [signatureState, attempt, events, intents, proposals] = await Promise.all([
    getAnchorService().getSignatureState(signature),
    prisma.chainIngestionAttempt.findUnique({ where: { signature } }),
    prisma.chainEvent.findMany({
      where: { signature },
      orderBy: { instructionIndex: "asc" },
      select: {
        instructionIndex: true,
        slot: true,
        instructionName: true,
        proposalPda: true,
        entityPda: true,
        observedAt: true,
      },
    }),
    prisma.proposalIntent.findMany({
      where: {
        OR: [
          { chainTxSignature: signature },
          { txBundles: { some: { chainTxSignature: signature } } },
        ],
      },
      select: {
        id: true,
        status: true,
        plannedProposalPda: true,
        chainTxSignature: true,
        chainSubmittedAt: true,
        chainConfirmedAt: true,
        failureReason: true,
        updatedAt: true,
      },
    }),
    prisma.proposal.findMany({
      where: {
        OR: [
          { onChainTxSignature: signature },
          { fundingTxSignature: signature },
          { latestSettlementTxSignature: signature },
          { contentAnchorTx: signature },
        ],
      },
      select: {
        id: true,
        proposalPda: true,
        status: true,
        proofStatus: true,
        intentId: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    signature,
    signatureState,
    ingestion: serializeAttempt(attempt),
    events: events.map((event) => ({
      ...event,
      slot: event.slot.toString(),
      observedAt: event.observedAt.toISOString(),
    })),
    intents: intents.map((intent) => ({
      ...intent,
      chainSubmittedAt: intent.chainSubmittedAt?.toISOString() ?? null,
      chainConfirmedAt: intent.chainConfirmedAt?.toISOString() ?? null,
      updatedAt: intent.updatedAt.toISOString(),
    })),
    proposals: proposals.map((proposal) => ({
      ...proposal,
      updatedAt: proposal.updatedAt.toISOString(),
    })),
  };
};

export const diagnoseChainTransaction = withController(
  "DIAGNOSE_CHAIN_TRANSACTION_FAILED",
  async (req, res) => {
    const signature = parseNonEmptyString(req.params.signature, "signature");
    ok(res, await loadTransactionDiagnosis(signature));
  }
);

export const replayChainTransaction = withController(
  "REPLAY_CHAIN_TRANSACTION_FAILED",
  async (req, res) => {
    const signature = parseNonEmptyString(req.params.signature, "signature");
    const result = await replayChainTransactionWithAudit({
      signature,
      operatorIdentity: req.operatorIdentity ?? "",
    });
    ok(res, {
      result,
      diagnosis: await loadTransactionDiagnosis(signature),
    });
  }
);

export const diagnoseProposalIntentRecovery = withController(
  "DIAGNOSE_PROPOSAL_INTENT_RECOVERY_FAILED",
  async (req, res) => {
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    const intent = await prisma.proposalIntent.findUnique({
      where: { id: intentId },
      include: {
        txBundles: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            chainTxSignature: true,
            errorMessage: true,
            fullySignedBase64: true,
            updatedAt: true,
          },
        },
        proposal: {
          select: {
            id: true,
            proposalPda: true,
            status: true,
            proofStatus: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!intent) {
      throw new HttpError(404, "INTENT_NOT_FOUND", "proposal intent not found");
    }
    const signatureState = intent.chainTxSignature
      ? await getAnchorService().getSignatureState(intent.chainTxSignature)
      : null;
    ok(res, {
      intentId: intent.id,
      status: intent.status,
      plannedProposalPda: intent.plannedProposalPda,
      chainTxSignature: intent.chainTxSignature,
      signatureState,
      chainSubmittedAt: intent.chainSubmittedAt?.toISOString() ?? null,
      chainConfirmedAt: intent.chainConfirmedAt?.toISOString() ?? null,
      failureReason: intent.failureReason,
      proposal: intent.proposal
        ? { ...intent.proposal, updatedAt: intent.proposal.updatedAt.toISOString() }
        : null,
      bundles: intent.txBundles.map(({ fullySignedBase64, ...bundle }) => ({
        ...bundle,
        hasFullySignedTransaction: Boolean(fullySignedBase64),
        expiresAt: bundle.expiresAt.toISOString(),
        updatedAt: bundle.updatedAt.toISOString(),
      })),
    });
  }
);

export const reconcileProposalIntentRecovery = withController(
  "RECONCILE_PROPOSAL_INTENT_RECOVERY_FAILED",
  async (req, res) => {
    const intentId = parseNonEmptyString(req.params.intentId, "intentId");
    ok(
      res,
      await reconcileProposalIntentWithAudit({
        intentId,
        operatorIdentity: req.operatorIdentity ?? "",
      })
    );
  }
);

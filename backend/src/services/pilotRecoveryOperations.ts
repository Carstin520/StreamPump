import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

import { HttpError } from "../controllers/http";
import { ingestConfirmedProgramTransaction } from "./indexer";
import { recordPilotOperatorEvent } from "./pilotOperatorAudit";
import { prisma } from "./prisma";
import { reconcileStoredProposalIntent } from "./proposalIntentRecoveryService";

export type RecoveryAuditInput = {
  action: string;
  operatorIdentity: string;
  resourceType: string;
  resourceId: string;
  evidenceDigestHex: string | null;
  payload: Prisma.InputJsonValue;
};

export const recordPilotRecoveryAudit = async (
  input: RecoveryAuditInput
): Promise<void> => {
  await prisma.$transaction((tx) => recordPilotOperatorEvent(tx, input));
};

const requireOperator = (value: string): string => {
  const operatorIdentity = value.trim();
  if (!operatorIdentity) {
    throw new HttpError(500, "OPERATOR_IDENTITY_MISSING", "operator identity is required");
  }
  return operatorIdentity;
};

const evidenceDigest = (value: string | null): string | null =>
  value ? createHash("sha256").update(value, "utf8").digest("hex") : null;

export const replayChainTransactionWithAudit = async (
  params: { signature: string; operatorIdentity: string },
  dependencies: {
    ingest?: typeof ingestConfirmedProgramTransaction;
    audit?: typeof recordPilotRecoveryAudit;
  } = {}
) => {
  const operatorIdentity = requireOperator(params.operatorIdentity);
  const ingest = dependencies.ingest ?? ingestConfirmedProgramTransaction;
  const audit = dependencies.audit ?? recordPilotRecoveryAudit;
  const result = await ingest(params.signature, { updateCursor: false });
  if (result.status === "SYNCED") {
    await audit({
      action: "CHAIN_TRANSACTION_REPLAYED",
      operatorIdentity,
      resourceType: "CHAIN_TRANSACTION",
      resourceId: params.signature,
      evidenceDigestHex: evidenceDigest(params.signature),
      payload: {
        status: result.status,
        instructionCount: result.instructionCount,
      },
    });
  }
  return result;
};

export const reconcileProposalIntentWithAudit = async (
  params: { intentId: string; operatorIdentity: string },
  dependencies: {
    reconcile?: typeof reconcileStoredProposalIntent;
    audit?: typeof recordPilotRecoveryAudit;
  } = {}
) => {
  const operatorIdentity = requireOperator(params.operatorIdentity);
  const reconcile = dependencies.reconcile ?? reconcileStoredProposalIntent;
  const audit = dependencies.audit ?? recordPilotRecoveryAudit;
  const result = await reconcile(params.intentId);
  await audit({
    action: "PROPOSAL_INTENT_RECONCILED",
    operatorIdentity,
    resourceType: "PROPOSAL_INTENT",
    resourceId: params.intentId,
    evidenceDigestHex: evidenceDigest(result.chainTxSignature),
    payload: {
      recovered: result.recovered,
      reason: result.reason,
      bundleId: result.bundleId,
      hasChainTransaction: Boolean(result.chainTxSignature),
    },
  });
  return result;
};

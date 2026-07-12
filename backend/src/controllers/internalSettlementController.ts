import {
  HttpError,
  ok,
  parseNonEmptyString,
  withController,
} from "./http";
import { settleTrack1Manually } from "../services/track1SettlementService";
import {
  getTrack1SettlementDiagnostic,
  reconcileTrack1Settlement,
} from "../services/track1SettlementRecoveryService";

const requireOperatorIdentity = (req: any): string => {
  const operatorIdentity = String(req.operatorIdentity ?? "").trim();
  if (!operatorIdentity) {
    throw new HttpError(
      400,
      "OPERATOR_ID_REQUIRED",
      "authenticated operator identity is required"
    );
  }
  return operatorIdentity;
};

type RecoveryControllerDependencies = {
  getDiagnostic(proposalPda: string): Promise<unknown>;
  reconcile(params: {
    proposalPda: string;
    operatorIdentity: string;
  }): Promise<unknown>;
};

const recoveryDependencies: RecoveryControllerDependencies = {
  getDiagnostic: getTrack1SettlementDiagnostic,
  reconcile: reconcileTrack1Settlement,
};

export const createGetTrack1StatusController = (
  dependencies: RecoveryControllerDependencies = recoveryDependencies
) =>
  withController("TRACK1_STATUS_FAILED", async (req, res) => {
    requireOperatorIdentity(req);
    const result = await dependencies.getDiagnostic(
      parseNonEmptyString(req.params.proposalPda, "proposalPda")
    );
    ok(res, result);
  });

export const createReconcileTrack1Controller = (
  dependencies: RecoveryControllerDependencies = recoveryDependencies
) =>
  withController("TRACK1_RECONCILIATION_FAILED", async (req, res) => {
    const result = await dependencies.reconcile({
      proposalPda: parseNonEmptyString(req.params.proposalPda, "proposalPda"),
      operatorIdentity: requireOperatorIdentity(req),
    });
    ok(res, result);
  });

export const getTrack1Status = createGetTrack1StatusController();
export const reconcileTrack1 = createReconcileTrack1Controller();

export const settleTrack1 = withController(
  "TRACK1_SETTLEMENT_FAILED",
  async (req, res) => {
    const idempotencyKey = String(req.header("x-idempotency-key") ?? "").trim();
    const operatorIdentity = requireOperatorIdentity(req);

    const result = await settleTrack1Manually({
      proposalPda: parseNonEmptyString(req.params.proposalPda, "proposalPda"),
      idempotencyKey,
      confirmation: parseNonEmptyString(req.body.confirmation, "confirmation"),
      operatorIdentity,
    });

    ok(res, result, result.status === "SUBMITTED" ? 202 : 200);
  }
);

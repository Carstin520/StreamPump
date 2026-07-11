import {
  HttpError,
  ok,
  parseNonEmptyString,
  withController,
} from "./http";
import { settleTrack1Manually } from "../services/track1SettlementService";

export const settleTrack1 = withController(
  "TRACK1_SETTLEMENT_FAILED",
  async (req, res) => {
    const idempotencyKey = String(req.header("x-idempotency-key") ?? "").trim();
    const operatorIdentity = String(req.operatorIdentity ?? "").trim();
    if (!operatorIdentity) {
      throw new HttpError(
        400,
        "OPERATOR_ID_REQUIRED",
        "authenticated operator identity is required"
      );
    }

    const result = await settleTrack1Manually({
      proposalPda: parseNonEmptyString(req.params.proposalPda, "proposalPda"),
      idempotencyKey,
      confirmation: parseNonEmptyString(req.body.confirmation, "confirmation"),
      operatorIdentity,
    });

    ok(res, result, result.status === "SUBMITTED" ? 202 : 200);
  }
);

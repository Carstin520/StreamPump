/**
 * CN: 内部 Oracle 结算路由骨架，为后续批量结算与 fan settlement worker 预留接口。
 * EN: Internal oracle settlement route skeleton reserved for future batch settlement workers.
 */
import { Request, Response } from "express";

import { handleControllerError, ok, parseNonEmptyString } from "./http";

const notImplementedPayload = (proposalPda: string, operation: string) => ({
  proposalPda,
  operation,
  status: "SKELETON_ONLY",
  note: "This internal oracle route is reserved for the next backend implementation phase.",
});

export const settleTrack2Proposal = async (req: Request, res: Response) => {
  try {
    const proposalPda = parseNonEmptyString(req.params.proposalPda, "proposalPda");
    ok(res, notImplementedPayload(proposalPda, "settle-track2"), 202);
  } catch (error) {
    handleControllerError(res, error, "SETTLE_TRACK2_SKELETON_FAILED");
  }
};

export const enqueueEndorsementSettlement = async (req: Request, res: Response) => {
  try {
    const proposalPda = parseNonEmptyString(req.params.proposalPda, "proposalPda");
    ok(res, notImplementedPayload(proposalPda, "enqueue-endorsement-settlement"), 202);
  } catch (error) {
    handleControllerError(res, error, "ENQUEUE_ENDORSEMENT_SETTLEMENT_FAILED");
  }
};

export const flushEndorsementSettlementBatch = async (req: Request, res: Response) => {
  try {
    const proposalPda = parseNonEmptyString(req.params.proposalPda, "proposalPda");
    ok(res, notImplementedPayload(proposalPda, "flush-endorsement-batch"), 202);
  } catch (error) {
    handleControllerError(res, error, "FLUSH_ENDORSEMENT_BATCH_FAILED");
  }
};

export const getSettlementProgress = async (req: Request, res: Response) => {
  try {
    const proposalPda = parseNonEmptyString(req.params.proposalPda, "proposalPda");
    ok(res, {
      proposalPda,
      status: "SKELETON_ONLY",
      unsettledEndorserCount: null,
    });
  } catch (error) {
    handleControllerError(res, error, "GET_SETTLEMENT_PROGRESS_FAILED");
  }
};

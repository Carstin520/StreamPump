import { Router } from "express";

import {
  enqueueEndorsementSettlement,
  flushEndorsementSettlementBatch,
  getSettlementProgress,
  settleTrack2Proposal,
} from "../../controllers/internalOracleController";

const router = Router();

router.post("/proposals/:proposalPda/settle-track2", settleTrack2Proposal);
router.post(
  "/proposals/:proposalPda/enqueue-endorsement-settlement",
  enqueueEndorsementSettlement
);
router.post(
  "/proposals/:proposalPda/flush-endorsement-batch",
  flushEndorsementSettlementBatch
);
router.get("/proposals/:proposalPda/settlement-progress", getSettlementProgress);

export default router;

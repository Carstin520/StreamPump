import { Router } from "express";

import {
  getTrack1Status,
  reconcileTrack1,
  settleTrack1,
} from "../../controllers/internalSettlementController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);
router.get("/:proposalPda/track1", getTrack1Status);
router.post("/:proposalPda/track1/reconcile", reconcileTrack1);
router.post("/:proposalPda/track1", settleTrack1);

export default router;

import { Router } from "express";

import { settleTrack1 } from "../../controllers/internalSettlementController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);
router.post("/:proposalPda/track1", settleTrack1);

export default router;

import { Router } from "express";

import {
  diagnoseChainTransaction,
  diagnoseProposalIntentRecovery,
  reconcileProposalIntentRecovery,
  replayChainTransaction,
} from "../../controllers/internalChainController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);
router.get("/transactions/:signature", diagnoseChainTransaction);
router.post("/transactions/:signature/replay", replayChainTransaction);
router.get("/proposal-intents/:intentId", diagnoseProposalIntentRecovery);
router.post("/proposal-intents/:intentId/reconcile", reconcileProposalIntentRecovery);

export default router;

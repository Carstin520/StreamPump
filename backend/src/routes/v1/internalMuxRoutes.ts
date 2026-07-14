/**
 * CN: v1 内部 Mux 路由，用于媒体补偿任务的手动触发。
 * EN: v1 internal Mux routes used for manual media reconciliation triggers.
 */
import { Router } from "express";

import {
  reconcileMuxAsset,
  requeueMuxAsset,
  runMuxReconciliation,
} from "../../controllers/internalMuxController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);

router.post("/reconcile/run-once", runMuxReconciliation);
router.post("/assets/:assetId/reconcile", reconcileMuxAsset);
router.post("/assets/:assetId/requeue", requeueMuxAsset);

export default router;

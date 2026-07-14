/**
 * CN: 内部 Mux 补偿控制器，允许手动触发单资产或批量 reconciliation。
 * EN: Internal Mux reconciliation controller that allows manual single-asset or batch reconciliation.
 */
import { Request, Response } from "express";

import { handleControllerError, ok, parseNonEmptyString } from "./http";
import { runMuxReconciliationOnce } from "../schedulers/MuxReconciliationScheduler";
import { reconcileMuxAssetById } from "../services/muxReconciliationService";
import { requeueMuxDerivative } from "../services/muxRecoveryService";

export const requeueMuxAsset = async (req: Request, res: Response) => {
  try {
    const assetId = parseNonEmptyString(req.params.assetId, "assetId");
    const result = await requeueMuxDerivative({
      assetId,
      operatorIdentity: req.operatorIdentity ?? "",
      reason: parseNonEmptyString(req.body.reason, "reason"),
    });
    ok(res, result, 202);
  } catch (error) {
    handleControllerError(res, error, "REQUEUE_MUX_ASSET_FAILED");
  }
};

export const reconcileMuxAsset = async (req: Request, res: Response) => {
  try {
    const assetId = parseNonEmptyString(req.params.assetId, "assetId");
    const result = await reconcileMuxAssetById(assetId);
    ok(res, {
      assetId,
      result,
    });
  } catch (error) {
    handleControllerError(res, error, "RECONCILE_MUX_ASSET_FAILED");
  }
};

export const runMuxReconciliation = async (_req: Request, res: Response) => {
  try {
    const summary = await runMuxReconciliationOnce();
    ok(
      res,
      {
        status: "OK",
        summary,
      },
      202
    );
  } catch (error) {
    handleControllerError(res, error, "RUN_MUX_RECONCILIATION_FAILED");
  }
};

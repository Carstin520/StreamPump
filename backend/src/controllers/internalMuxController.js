"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMuxReconciliation = exports.reconcileMuxAsset = void 0;
const http_1 = require("./http");
const MuxReconciliationScheduler_1 = require("../schedulers/MuxReconciliationScheduler");
const muxReconciliationService_1 = require("../services/muxReconciliationService");
const reconcileMuxAsset = async (req, res) => {
    try {
        const assetId = (0, http_1.parseNonEmptyString)(req.params.assetId, "assetId");
        const result = await (0, muxReconciliationService_1.reconcileMuxAssetById)(assetId);
        (0, http_1.ok)(res, {
            assetId,
            result,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "RECONCILE_MUX_ASSET_FAILED");
    }
};
exports.reconcileMuxAsset = reconcileMuxAsset;
const runMuxReconciliation = async (_req, res) => {
    try {
        const summary = await (0, MuxReconciliationScheduler_1.runMuxReconciliationOnce)();
        (0, http_1.ok)(res, {
            status: "OK",
            summary,
        }, 202);
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "RUN_MUX_RECONCILIATION_FAILED");
    }
};
exports.runMuxReconciliation = runMuxReconciliation;

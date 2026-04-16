"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 内部 Mux 路由，用于媒体补偿任务的手动触发。
 * EN: v1 internal Mux routes used for manual media reconciliation triggers.
 */
const express_1 = require("express");
const internalMuxController_1 = require("../../controllers/internalMuxController");
const router = (0, express_1.Router)();
router.post("/reconcile/run-once", internalMuxController_1.runMuxReconciliation);
router.post("/assets/:assetId/reconcile", internalMuxController_1.reconcileMuxAsset);
exports.default = router;

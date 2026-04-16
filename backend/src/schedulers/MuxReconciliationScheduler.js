"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMuxReconciliationOnce = exports.stopMuxReconciliationScheduler = exports.startMuxReconciliationScheduler = void 0;
/**
 * CN: Mux 补偿调度器，周期性扫描卡在 PREPARING 的视频资产并主动对账。
 * EN: Mux reconciliation scheduler that periodically scans PREPARING video assets and actively reconciles them.
 */
const node_cron_1 = __importDefault(require("node-cron"));
const default_1 = require("../../config/default");
const muxReconciliationService_1 = require("../services/muxReconciliationService");
class MuxReconciliationScheduler {
    task = null;
    running = false;
    start() {
        if (!default_1.config.mux.reconciliation.enabled || this.task) {
            return;
        }
        this.task = node_cron_1.default.schedule(default_1.config.mux.reconciliation.cron, () => {
            void this.runOnce();
        });
        console.log(`[mux-reconcile] scheduled with cron "${default_1.config.mux.reconciliation.cron}"`);
        if (default_1.config.mux.reconciliation.runOnBoot) {
            void this.runOnce();
        }
    }
    stop() {
        this.task?.stop();
        this.task = null;
    }
    async runOnce() {
        if (this.running) {
            console.log("[mux-reconcile] skipped because a previous run is still active");
            return;
        }
        this.running = true;
        try {
            const summary = await (0, muxReconciliationService_1.reconcileStaleMuxAssets)();
            console.log("[mux-reconcile] completed", summary);
            return summary;
        }
        catch (error) {
            console.error("[mux-reconcile] worker failed", error);
            throw error;
        }
        finally {
            this.running = false;
        }
    }
}
const scheduler = new MuxReconciliationScheduler();
const startMuxReconciliationScheduler = () => scheduler.start();
exports.startMuxReconciliationScheduler = startMuxReconciliationScheduler;
const stopMuxReconciliationScheduler = () => scheduler.stop();
exports.stopMuxReconciliationScheduler = stopMuxReconciliationScheduler;
const runMuxReconciliationOnce = () => scheduler.runOnce();
exports.runMuxReconciliationOnce = runMuxReconciliationOnce;

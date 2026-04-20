/**
 * CN: Mux 补偿调度器，周期性扫描卡在 PREPARING 的视频资产并主动对账。
 * EN: Mux reconciliation scheduler that periodically scans PREPARING video assets and actively reconciles them.
 */
import cron, { ScheduledTask } from "node-cron";

import { config } from "../../config/default";
import {
  ingestQueuedMuxAssets,
  reconcileStaleMuxAssets,
} from "../services/muxReconciliationService";

class MuxReconciliationScheduler {
  private task: ScheduledTask | null = null;
  private running = false;

  start(): void {
    if (!config.mux.reconciliation.enabled || this.task) {
      return;
    }

    this.task = cron.schedule(config.mux.reconciliation.cron, () => {
      void this.runOnce();
    });

    console.log(
      `[mux-reconcile] scheduled with cron "${config.mux.reconciliation.cron}"`
    );

    if (config.mux.reconciliation.runOnBoot) {
      void this.runOnce();
    }
  }

  stop(): void {
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
      const ingestSummary = await ingestQueuedMuxAssets();
      const reconcileSummary = await reconcileStaleMuxAssets();
      const summary = {
        ingest: ingestSummary,
        reconcile: reconcileSummary,
      };
      console.log("[mux-reconcile] completed", summary);
      return summary;
    } catch (error) {
      console.error("[mux-reconcile] worker failed", error);
      throw error;
    } finally {
      this.running = false;
    }
  }
}

const scheduler = new MuxReconciliationScheduler();

export const startMuxReconciliationScheduler = () => scheduler.start();
export const stopMuxReconciliationScheduler = () => scheduler.stop();
export const runMuxReconciliationOnce = () => scheduler.runOnce();

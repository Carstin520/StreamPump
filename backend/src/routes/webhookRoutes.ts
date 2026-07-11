/**
 * CN: Webhook 路由入口，挂载点击事件与 Mux 转码回调。
 * EN: Webhook route entry that mounts click events and Mux processing callbacks.
 */
import express, { Router } from "express";

import { config } from "../../config/default";
import { ingestMuxWebhook } from "../controllers/muxWebhookController";
import { ingestClickWebhook } from "../controllers/webhookController";

const router = Router();

if (config.pilot.track2MetricIngestionEnabled) {
  router.post("/clicks", ingestClickWebhook);
}
router.post("/mux", express.raw({ type: "application/json" }), ingestMuxWebhook);

export default router;

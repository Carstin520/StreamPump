import express, { Router } from "express";

import { ingestMuxWebhook } from "../controllers/muxWebhookController";
import { ingestClickWebhook } from "../controllers/webhookController";

const router = Router();

router.post("/clicks", ingestClickWebhook);
router.post("/mux", express.raw({ type: "application/json" }), ingestMuxWebhook);

export default router;

import { Router } from "express";

import eventRoutes from "./eventRoutes";
import mediaRoutes from "./mediaRoutes";
import proposalRoutes from "./proposalRoutes";
import userRoutes from "./userRoutes";
import videoRoutes from "./videoRoutes";
import webhookRoutes from "./webhookRoutes";

const router = Router();

router.use("/events", eventRoutes);
router.use("/media", mediaRoutes);
router.use("/proposals", proposalRoutes);
router.use("/videos", videoRoutes);
router.use("/users", userRoutes);
router.use("/webhooks", webhookRoutes);

export default router;

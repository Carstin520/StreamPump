import { Router } from "express";

import eventRoutes from "./eventRoutes";
import userRoutes from "./userRoutes";
import v1Routes from "./v1";
import videoRoutes from "./videoRoutes";
import webhookRoutes from "./webhookRoutes";

const router = Router();

router.use("/events", eventRoutes);
router.use("/v1", v1Routes);
router.use("/videos", videoRoutes);
router.use("/users", userRoutes);
router.use("/webhooks", webhookRoutes);

export default router;

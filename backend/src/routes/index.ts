/**
 * CN: Backend 根路由，将原型接口和 v1 接口统一挂载到 /api 下。
 * EN: Root backend router that mounts both prototype and v1 APIs under /api.
 */
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

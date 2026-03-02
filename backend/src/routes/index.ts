import { Router } from "express";

import eventRoutes from "./eventRoutes";
import userRoutes from "./userRoutes";
import videoRoutes from "./videoRoutes";

const router = Router();

router.use("/events", eventRoutes);
router.use("/videos", videoRoutes);
router.use("/users", userRoutes);

export default router;

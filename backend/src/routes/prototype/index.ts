/**
 * CN: 原型期接口聚合路由，集中承载不属于 v1 主线的数据面。
 * EN: Prototype API aggregator that centralizes non-v1 data surfaces.
 */
import { Router } from "express";

import eventRoutes from "../eventRoutes";
import userRoutes from "../userRoutes";
import videoRoutes from "../videoRoutes";

const router = Router();

router.use("/events", eventRoutes);
router.use("/users", userRoutes);
router.use("/videos", videoRoutes);

export default router;

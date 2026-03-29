/**
 * CN: v1 API 聚合路由，挂载内容、proposal-intent 与内部 oracle 子路由。
 * EN: v1 API aggregator that mounts content, proposal-intent, and internal oracle sub-routes.
 */
import { Router } from "express";

import authRoutes from "./authRoutes";
import contentManifestRoutes from "./contentManifestRoutes";
import internalMuxRoutes from "./internalMuxRoutes";
import internalOracleRoutes from "./internalOracleRoutes";
import proposalIntentRoutes from "./proposalIntentRoutes";
import proposalRoutes from "./proposalRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/content", contentManifestRoutes);
router.use("/proposal-intents", proposalIntentRoutes);
router.use("/proposals", proposalRoutes);
router.use("/internal/mux", internalMuxRoutes);
router.use("/internal/oracle", internalOracleRoutes);

export default router;

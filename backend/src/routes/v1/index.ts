/**
 * CN: v1 API 聚合路由，挂载内容、proposal-intent 与内部 oracle 子路由。
 * EN: v1 API aggregator that mounts content, proposal-intent, and internal oracle sub-routes.
 */
import { Router } from "express";

import accountRoutes from "./accountRoutes";
import authRoutes from "./authRoutes";
import campaignRoutes from "./campaignRoutes";
import contentManifestRoutes from "./contentManifestRoutes";
import internalMuxRoutes from "./internalMuxRoutes";
import marketRoutes from "./marketRoutes";
import publicFeedRoutes from "./publicFeedRoutes";
import proposalIntentRoutes from "./proposalIntentRoutes";
import proposalRoutes from "./proposalRoutes";
import s1Routes from "./s1Routes";
import workspaceRoutes from "./workspaceRoutes";

const router = Router();

router.use("/account", accountRoutes);
router.use("/auth", authRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/feed", publicFeedRoutes);
router.use("/market", marketRoutes);
router.use("/content", contentManifestRoutes);
router.use("/proposal-intents", proposalIntentRoutes);
router.use("/proposals", proposalRoutes);
router.use("/s1", s1Routes);
router.use("/workspace", workspaceRoutes);
router.use("/internal/mux", internalMuxRoutes);

export default router;

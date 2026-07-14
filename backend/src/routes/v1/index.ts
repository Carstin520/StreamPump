/**
 * CN: v1 API 聚合路由，挂载内容、proposal-intent 与内部 oracle 子路由。
 * EN: v1 API aggregator that mounts content, proposal-intent, and internal oracle sub-routes.
 */
import { Router } from "express";

import { config } from "../../../config/default";
import accountRoutes from "./accountRoutes";
import authRoutes from "./authRoutes";
import campaignRoutes from "./campaignRoutes";
import contentManifestRoutes from "./contentManifestRoutes";
import internalChainRoutes from "./internalChainRoutes";
import internalMuxRoutes from "./internalMuxRoutes";
import internalContentRoutes from "./internalContentRoutes";
import internalSponsorRoutes from "./internalSponsorRoutes";
import internalSettlementRoutes from "./internalSettlementRoutes";
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
if (config.pilot.s1PublicApiEnabled) {
  router.use("/market", marketRoutes);
}
router.use("/content", contentManifestRoutes);
router.use("/proposal-intents", proposalIntentRoutes);
router.use("/proposals", proposalRoutes);
if (config.pilot.s1PublicApiEnabled) {
  router.use("/s1", s1Routes);
}
router.use("/workspace", workspaceRoutes);
router.use("/internal/chain", internalChainRoutes);
router.use("/internal/mux", internalMuxRoutes);
router.use("/internal/content", internalContentRoutes);
router.use("/internal/sponsors", internalSponsorRoutes);
router.use("/internal/settlements", internalSettlementRoutes);

export default router;

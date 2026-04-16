"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 API 聚合路由，挂载内容、proposal-intent 与内部 oracle 子路由。
 * EN: v1 API aggregator that mounts content, proposal-intent, and internal oracle sub-routes.
 */
const express_1 = require("express");
const authRoutes_1 = __importDefault(require("./authRoutes"));
const contentManifestRoutes_1 = __importDefault(require("./contentManifestRoutes"));
const internalMuxRoutes_1 = __importDefault(require("./internalMuxRoutes"));
const proposalIntentRoutes_1 = __importDefault(require("./proposalIntentRoutes"));
const proposalRoutes_1 = __importDefault(require("./proposalRoutes"));
const workspaceRoutes_1 = __importDefault(require("./workspaceRoutes"));
const router = (0, express_1.Router)();
router.use("/auth", authRoutes_1.default);
router.use("/content", contentManifestRoutes_1.default);
router.use("/proposal-intents", proposalIntentRoutes_1.default);
router.use("/proposals", proposalRoutes_1.default);
router.use("/workspace", workspaceRoutes_1.default);
router.use("/internal/mux", internalMuxRoutes_1.default);
exports.default = router;

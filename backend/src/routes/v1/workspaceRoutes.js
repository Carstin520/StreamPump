"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 工作台聚合路由，给前端统一工作台提供只读视图。
 * EN: v1 workspace aggregate routes that provide a read-only view for the frontend workspace.
 */
const express_1 = require("express");
const workspaceController_1 = require("../../controllers/workspaceController");
const walletAuth_1 = require("../../middleware/walletAuth");
const router = (0, express_1.Router)();
router.use(walletAuth_1.requireSessionAuth);
router.get("/", workspaceController_1.getWorkspaceOverview);
exports.default = router;

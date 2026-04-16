/**
 * CN: v1 工作台聚合路由，给前端统一工作台提供只读视图。
 * EN: v1 workspace aggregate routes that provide a read-only view for the frontend workspace.
 */
import { Router } from "express";

import { getWorkspaceOverview } from "../../controllers/workspaceController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(requireSessionAuth);
router.get("/", getWorkspaceOverview);

export default router;

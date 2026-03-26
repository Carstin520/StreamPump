/**
 * CN: 原型用户路由，保留基础 profile 与升级 payload 接口。
 * EN: Prototype user routes that keep basic profile and upgrade-payload endpoints.
 */
import { Router } from "express";

import { buildUpgradePayload, getUserProfile } from "../controllers/userController";

const router = Router();

router.get("/:userId", getUserProfile);
router.post("/:userId/upgrade-payload", buildUpgradePayload);

export default router;

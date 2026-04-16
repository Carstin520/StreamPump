"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 原型用户路由，保留基础 profile 与升级 payload 接口。
 * EN: Prototype user routes that keep basic profile and upgrade-payload endpoints.
 */
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.get("/:userId", userController_1.getUserProfile);
router.post("/:userId/upgrade-payload", userController_1.buildUpgradePayload);
exports.default = router;

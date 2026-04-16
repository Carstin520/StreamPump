"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 钱包认证路由，提供 challenge/signature 登录和会话查询。
 * EN: v1 wallet-auth routes for challenge/signature login and session introspection.
 */
const express_1 = require("express");
const authController_1 = require("../../controllers/authController");
const walletAuth_1 = require("../../middleware/walletAuth");
const router = (0, express_1.Router)();
router.post("/challenge", authController_1.createAuthChallenge);
router.post("/verify", authController_1.verifyAuthChallenge);
router.post("/provider-exchange", authController_1.exchangeProviderSession);
router.get("/session", walletAuth_1.requireSessionAuth, authController_1.getCurrentSession);
router.post("/logout", walletAuth_1.requireSessionAuth, walletAuth_1.logoutWalletSession);
exports.default = router;

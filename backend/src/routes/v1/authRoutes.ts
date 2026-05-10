/**
 * CN: v1 钱包认证路由，提供 challenge/signature 登录和会话查询。
 * EN: v1 wallet-auth routes for challenge/signature login and session introspection.
 */
import { Router } from "express";

import {
  createAuthChallenge,
  exchangeProviderSession,
  getCurrentSession,
  verifyAuthChallenge,
} from "../../controllers/authController";
import {
  logoutWalletSession,
  requireSessionAuth,
} from "../../middleware/walletAuth";

const router = Router();

router.post("/challenge", createAuthChallenge);
router.post("/verify", verifyAuthChallenge);
router.post("/provider-exchange", exchangeProviderSession);
router.get("/session", requireSessionAuth, getCurrentSession);
router.post("/logout", requireSessionAuth, logoutWalletSession);

export default router;

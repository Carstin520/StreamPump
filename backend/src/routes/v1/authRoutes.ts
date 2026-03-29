/**
 * CN: v1 钱包认证路由，提供 challenge/signature 登录和会话查询。
 * EN: v1 wallet-auth routes for challenge/signature login and session introspection.
 */
import { Router } from "express";

import {
  createAuthChallenge,
  getCurrentSession,
  verifyAuthChallenge,
} from "../../controllers/authController";
import {
  logoutWalletSession,
  requireWalletAuth,
} from "../../middleware/walletAuth";

const router = Router();

router.post("/challenge", createAuthChallenge);
router.post("/verify", verifyAuthChallenge);
router.get("/session", requireWalletAuth, getCurrentSession);
router.post("/logout", requireWalletAuth, logoutWalletSession);

export default router;

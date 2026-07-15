/**
 * CN: v1 钱包认证路由，提供 challenge/signature 登录和会话查询。
 * EN: v1 wallet-auth routes for challenge/signature login and session introspection.
 */
import express, { Router } from "express";

import { config } from "../../../config/default";
import {
  createAuthChallenge,
  createEphemeralSession,
  completeAppleSocialLogin,
  completeGoogleSocialLogin,
  exchangeProviderSession,
  getCurrentSession,
  presignSponsorDocumentUpload,
  registerSponsorProfile,
  requestEmailLoginCode,
  startSocialLogin,
  verifyEmailLoginCode,
  verifyAuthChallenge,
} from "../../controllers/authController";
import {
  logoutWalletSession,
  requireSessionAuth,
} from "../../middleware/walletAuth";

const router = Router();

router.post("/challenge", createAuthChallenge);
router.post("/verify", verifyAuthChallenge);
if (config.managedWallet.ephemeralSessionsEnabled) {
  router.post("/ephemeral-session", createEphemeralSession);
}
if (config.pilot.emailAuthEnabled) {
  router.post("/email/request-code", requestEmailLoginCode);
  router.post("/email/verify-code", verifyEmailLoginCode);
}
router.post("/provider-exchange", exchangeProviderSession);
router.post("/social/start", startSocialLogin);
router.get("/social/google/callback", completeGoogleSocialLogin);
router.post(
  "/social/apple/callback",
  express.urlencoded({ extended: false, limit: "32kb" }),
  completeAppleSocialLogin
);
router.post("/sponsor/documents/presign", requireSessionAuth, presignSponsorDocumentUpload);
router.post("/sponsor/register", requireSessionAuth, registerSponsorProfile);
router.get("/session", requireSessionAuth, getCurrentSession);
router.post("/logout", requireSessionAuth, logoutWalletSession);

export default router;

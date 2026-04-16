/**
 * CN: v1 proposal intent 路由，承载单次签名发起 proposal 的后端状态机。
 * EN: v1 proposal intent routes that drive the backend state machine for one-sign proposal launch.
 */
import { Router } from "express";

import {
  buildProposalLaunchBundle,
  createProposalIntent,
  creatorPartialSignBundle,
  getProposalIntentById,
  getProposalIntentStatus,
  listProposalIntents,
  submitProposalBundle,
  lockProposalIntent,
} from "../../controllers/proposalIntentController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(requireSessionAuth);

router.get("/", listProposalIntents);
router.post("/", createProposalIntent);
router.get("/:intentId", getProposalIntentById);
router.post("/:intentId/lock", lockProposalIntent);
router.post("/:intentId/build-bundle", buildProposalLaunchBundle);
router.post("/:intentId/creator-partial-sign", creatorPartialSignBundle);
router.post("/:intentId/submit", submitProposalBundle);
router.get("/:intentId/status", getProposalIntentStatus);

export default router;

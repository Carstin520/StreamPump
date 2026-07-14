/**
 * CN: v1 proposal intent 路由，承载单次签名发起 proposal 的后端状态机。
 * EN: v1 proposal intent routes that drive the backend state machine for one-sign proposal launch.
 */
import { Router } from "express";

import {
  buildProposalLaunchBundle,
  createProposalIntent,
  creatorPartialSignBundle,
  getProposalIntentReadiness,
  getProposalIntentById,
  getProposalIntentStatus,
  listProposalIntents,
  submitProposalBundle,
  lockProposalIntent,
} from "../../controllers/proposalIntentController";
import { requireSessionAuth } from "../../middleware/walletAuth";
import { durableApiIdempotency } from "../../middleware/apiIdempotency";

const router = Router();

router.use(requireSessionAuth);

router.get("/", listProposalIntents);
router.get("/readiness", getProposalIntentReadiness);
router.post("/", durableApiIdempotency({ scope: "proposal-intent.create" }), createProposalIntent);
router.get("/:intentId", getProposalIntentById);
router.post(
  "/:intentId/lock",
  durableApiIdempotency({ scope: "proposal-intent.lock", resourceParams: ["intentId"] }),
  lockProposalIntent
);
router.post(
  "/:intentId/build-bundle",
  durableApiIdempotency({
    scope: "proposal-intent.build-bundle",
    resourceParams: ["intentId"],
    responseTtlMs: 8 * 60 * 1000,
  }),
  buildProposalLaunchBundle
);
router.post(
  "/:intentId/creator-partial-sign",
  durableApiIdempotency({
    scope: "proposal-intent.creator-partial-sign",
    resourceParams: ["intentId"],
    responseTtlMs: 8 * 60 * 1000,
  }),
  creatorPartialSignBundle
);
router.post(
  "/:intentId/submit",
  durableApiIdempotency({ scope: "proposal-intent.submit", resourceParams: ["intentId"] }),
  submitProposalBundle
);
router.get("/:intentId/status", getProposalIntentStatus);

export default router;

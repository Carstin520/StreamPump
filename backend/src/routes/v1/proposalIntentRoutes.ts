import { Router } from "express";

import {
  buildProposalLaunchBundle,
  createProposalIntent,
  creatorPartialSignBundle,
  getProposalIntentStatus,
  submitProposalBundle,
  lockProposalIntent,
} from "../../controllers/proposalIntentController";

const router = Router();

router.post("/", createProposalIntent);
router.post("/:intentId/lock", lockProposalIntent);
router.post("/:intentId/build-bundle", buildProposalLaunchBundle);
router.post("/:intentId/creator-partial-sign", creatorPartialSignBundle);
router.post("/:intentId/submit", submitProposalBundle);
router.get("/:intentId/status", getProposalIntentStatus);

export default router;

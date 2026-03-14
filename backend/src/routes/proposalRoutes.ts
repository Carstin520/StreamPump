import { Router } from "express";

import { createProposalDraft, getProposalById } from "../controllers/proposalController";

const router = Router();

router.post("/", createProposalDraft);
router.get("/:id", getProposalById);

export default router;

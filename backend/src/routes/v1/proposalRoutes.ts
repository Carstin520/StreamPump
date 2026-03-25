import { Router } from "express";

import { getProposalById } from "../../controllers/proposalIntentController";

const router = Router();

router.get("/:id", getProposalById);

export default router;

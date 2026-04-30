import { Router } from "express";

import { getPublicCampaign } from "../../controllers/campaignController";

const router = Router();

router.get("/:id/public", getPublicCampaign);

export default router;

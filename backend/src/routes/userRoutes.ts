import { Router } from "express";

import { buildUpgradePayload, getUserProfile } from "../controllers/userController";

const router = Router();

router.get("/:userId", getUserProfile);
router.post("/:userId/upgrade-payload", buildUpgradePayload);

export default router;

import { Router } from "express";

import { getUserProfile } from "../controllers/userController";

const router = Router();

router.get("/:userId", getUserProfile);

export default router;

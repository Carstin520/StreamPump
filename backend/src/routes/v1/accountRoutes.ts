import { Router } from "express";

import { getAccountMe, getAccountInfluence, updateAccountMe } from "../../controllers/accountController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(requireSessionAuth);
router.get("/me", getAccountMe);
router.get("/me/influence", getAccountInfluence);
router.put("/me", updateAccountMe);

export default router;

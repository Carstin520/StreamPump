import { Router } from "express";

import { getAccountMe, updateAccountMe } from "../../controllers/accountController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(requireSessionAuth);
router.get("/me", getAccountMe);
router.put("/me", updateAccountMe);

export default router;

/**
 * CN: v1 proposal 查询路由，仅暴露链上确认后 proposal 的只读查询。
 * EN: v1 proposal query routes that expose read-only access to chain-confirmed proposals.
 */
import { Router } from "express";

import { getProposalById } from "../../controllers/proposalIntentController";
import { optionalWalletAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(optionalWalletAuth);

router.get("/:id", getProposalById);

export default router;

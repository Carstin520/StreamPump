/**
 * CN: v1 proposal 查询路由，仅暴露链上确认后 proposal 的只读查询。
 * EN: v1 proposal query routes that expose read-only access to chain-confirmed proposals.
 */
import { Router } from "express";

import { config } from "../../../config/default";
import {
  buildClaimEndorsementTransaction,
  buildEndorseProposalTransaction,
  submitProposalActionTransaction,
} from "../../controllers/proposalActionController";
import { getProposalById } from "../../controllers/proposalIntentController";
import { optionalSessionAuth, requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(optionalSessionAuth);

if (config.pilot.track2Enabled) {
  router.post("/transactions/submit", requireSessionAuth, submitProposalActionTransaction);
  router.post("/:id/endorse/build", requireSessionAuth, buildEndorseProposalTransaction);
  router.post("/:id/endorsement/claim/build", requireSessionAuth, buildClaimEndorsementTransaction);
}
router.get("/:id", getProposalById);

export default router;

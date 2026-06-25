import { Router } from "express";

import {
  buildAbortS1BuyoutTransaction,
  buildAcceptBuyoutOfferTransaction,
  buildBuyS1Transaction,
  buildCancelBuyoutOfferTransaction,
  buildClaimDailySpumpTransaction,
  buildClaimEngagementRewardTransaction,
  buildClaimS1BuyoutUsdcTransaction,
  buildExecuteS1GraduationTransaction,
  buildInitS1BuyoutTransaction,
  buildRageQuitS1Transaction,
  buildReclaimBuyoutOfferTransaction,
  buildRegisterUserTransaction,
  buildSellS1Transaction,
  buildSweepS1BuyoutResidualTransaction,
  buildSubmitBuyoutOfferTransaction,
  getManagedWalletJob,
  getS1TransactionStatus,
  managedWalletExecute,
  submitS1Transaction,
} from "../../controllers/s1ActionController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.post("/register-user/build", requireSessionAuth, buildRegisterUserTransaction);
router.post("/claim-daily-spump/build", requireSessionAuth, buildClaimDailySpumpTransaction);
router.post("/engagement-reward/build", requireSessionAuth, buildClaimEngagementRewardTransaction);
router.post("/buy/build", requireSessionAuth, buildBuyS1Transaction);
router.post("/sell/build", requireSessionAuth, buildSellS1Transaction);
router.post("/rage-quit/build", requireSessionAuth, buildRageQuitS1Transaction);
router.post("/buyout/init/build", requireSessionAuth, buildInitS1BuyoutTransaction);
router.post("/buyout/offer/build", requireSessionAuth, buildSubmitBuyoutOfferTransaction);
router.post("/buyout/accept/build", requireSessionAuth, buildAcceptBuyoutOfferTransaction);
router.post("/buyout/cancel/build", requireSessionAuth, buildCancelBuyoutOfferTransaction);
router.post("/buyout/reclaim/build", requireSessionAuth, buildReclaimBuyoutOfferTransaction);
router.post("/buyout/abort/build", requireSessionAuth, buildAbortS1BuyoutTransaction);
router.post("/buyout/graduation/build", requireSessionAuth, buildExecuteS1GraduationTransaction);
router.post("/buyout/claim-usdc/build", requireSessionAuth, buildClaimS1BuyoutUsdcTransaction);
router.post("/buyout/sweep-residual/build", requireSessionAuth, buildSweepS1BuyoutResidualTransaction);
router.post("/managed/execute", requireSessionAuth, managedWalletExecute);
router.get("/managed/jobs/:jobId", requireSessionAuth, getManagedWalletJob);
router.post("/transactions/submit", requireSessionAuth, submitS1Transaction);
router.get("/transactions/:signature/status", requireSessionAuth, getS1TransactionStatus);

export default router;

import { Router } from "express";

import {
  getMarketCreatorProfile,
  getMarketOverview,
  getMarketPortfolio,
  listTrendingCreators,
} from "../../controllers/marketController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.get("/overview", getMarketOverview);
router.get("/trending-creators", listTrendingCreators);
router.get("/creators/:creatorWallet", getMarketCreatorProfile);
router.get("/portfolio", requireSessionAuth, getMarketPortfolio);

export default router;

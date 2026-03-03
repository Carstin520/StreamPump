import { Router } from "express";

import {
  buildSettlementReport,
  ingestViewEvent,
  viewStats,
} from "../controllers/eventController";

const router = Router();

router.post("/views", ingestViewEvent);
router.get("/views/:videoId", viewStats);
router.get("/reports/:proposalKey/:videoId", buildSettlementReport);

export default router;

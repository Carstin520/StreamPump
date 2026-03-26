/**
 * CN: 原型事件路由，暴露观看事件上报和统计查询接口。
 * EN: Prototype event routes that expose view ingestion and stats queries.
 */
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

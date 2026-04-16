"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 原型事件路由，暴露观看事件上报和统计查询接口。
 * EN: Prototype event routes that expose view ingestion and stats queries.
 */
const express_1 = require("express");
const eventController_1 = require("../controllers/eventController");
const router = (0, express_1.Router)();
router.post("/views", eventController_1.ingestViewEvent);
router.get("/views/:videoId", eventController_1.viewStats);
router.get("/reports/:proposalKey/:videoId", eventController_1.buildSettlementReport);
exports.default = router;

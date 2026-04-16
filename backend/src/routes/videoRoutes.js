"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 旧版视频原型路由，服务于脚手架前端和早期调试流程。
 * EN: Legacy video prototype routes used by the scaffold frontend and early debugging flows.
 */
const express_1 = require("express");
const videoController_1 = require("../controllers/videoController");
const router = (0, express_1.Router)();
router.get("/feed", videoController_1.listFeed);
router.post("/upload", videoController_1.uploadVideo);
exports.default = router;

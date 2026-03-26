/**
 * CN: 旧版视频原型路由，服务于脚手架前端和早期调试流程。
 * EN: Legacy video prototype routes used by the scaffold frontend and early debugging flows.
 */
import { Router } from "express";

import { listFeed, uploadVideo } from "../controllers/videoController";

const router = Router();

router.get("/feed", listFeed);
router.post("/upload", uploadVideo);

export default router;

import { Router } from "express";

import { listFeed, uploadVideo } from "../controllers/videoController";

const router = Router();

router.get("/feed", listFeed);
router.post("/upload", uploadVideo);

export default router;

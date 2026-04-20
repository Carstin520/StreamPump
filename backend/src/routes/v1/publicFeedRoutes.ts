import { Router } from "express";

import { listPublicFeedPosts } from "../../controllers/publicFeedController";

const router = Router();

router.get("/posts", listPublicFeedPosts);

export default router;

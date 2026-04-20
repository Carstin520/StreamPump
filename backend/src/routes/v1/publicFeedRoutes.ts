import { Router } from "express";

import {
  getPublicFeedPostById,
  listPublicFeedPosts,
} from "../../controllers/publicFeedController";

const router = Router();

router.get("/posts", listPublicFeedPosts);
router.get("/posts/:postId", getPublicFeedPostById);

export default router;

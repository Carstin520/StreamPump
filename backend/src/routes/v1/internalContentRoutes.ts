import { Router } from "express";

import {
  getContentPublicationForReview,
  listContentPublicationsForReview,
  reopenReviewedContentPublication,
  reviewContentPublication,
  revokeReviewedContentPublication,
} from "../../controllers/internalContentPublicationController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);
router.get("/publications", listContentPublicationsForReview);
router.get("/publications/:publicationId", getContentPublicationForReview);
router.post("/publications/:publicationId/review", reviewContentPublication);
router.post("/publications/:publicationId/reopen", reopenReviewedContentPublication);
router.post("/publications/:publicationId/revoke", revokeReviewedContentPublication);

export default router;

import { Router } from "express";

import { reviewContentPublication } from "../../controllers/internalContentPublicationController";
import { requireInternalOperatorAuth } from "../../middleware/internalOperatorAuth";

const router = Router();

router.use(requireInternalOperatorAuth);
router.post("/publications/:publicationId/review", reviewContentPublication);

export default router;

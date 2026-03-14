import { Router } from "express";

import { confirmUpload, requestUpload } from "../controllers/mediaController";

const router = Router();

router.post("/request-upload", requestUpload);
router.post("/confirm-upload", confirmUpload);

export default router;

import { Router } from "express";

import {
  completeManifestAssetUpload,
  createContentManifest,
  createContentPublication,
  finalizeContentManifest,
  presignManifestAssets,
} from "../../controllers/contentManifestController";

const router = Router();

router.post("/manifests", createContentManifest);
router.post("/manifests/:manifestId/assets/presign", presignManifestAssets);
router.post("/manifests/:manifestId/assets/:assetId/complete", completeManifestAssetUpload);
router.post("/manifests/:manifestId/finalize", finalizeContentManifest);
router.post("/publications", createContentPublication);

export default router;

/**
 * CN: v1 内容清单路由，负责 manifest、资产上传与 publication 映射。
 * EN: v1 content manifest routes for manifests, asset upload flow, and publication mapping.
 */
import { Router } from "express";

import {
  completeManifestAssetUpload,
  createContentManifest,
  createContentPublication,
  finalizeContentManifest,
  getContentManifestById,
  listContentManifests,
  presignManifestAssets,
} from "../../controllers/contentManifestController";
import { requireSessionAuth } from "../../middleware/walletAuth";

const router = Router();

router.use(requireSessionAuth);

router.get("/manifests", listContentManifests);
router.post("/manifests", createContentManifest);
router.get("/manifests/:manifestId", getContentManifestById);
router.post("/manifests/:manifestId/assets/presign", presignManifestAssets);
router.post("/manifests/:manifestId/assets/:assetId/complete", completeManifestAssetUpload);
router.post("/manifests/:manifestId/finalize", finalizeContentManifest);
router.post("/publications", createContentPublication);

export default router;

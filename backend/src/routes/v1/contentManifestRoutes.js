"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 内容清单路由，负责 manifest、资产上传与 publication 映射。
 * EN: v1 content manifest routes for manifests, asset upload flow, and publication mapping.
 */
const express_1 = require("express");
const contentManifestController_1 = require("../../controllers/contentManifestController");
const walletAuth_1 = require("../../middleware/walletAuth");
const router = (0, express_1.Router)();
router.use(walletAuth_1.requireSessionAuth);
router.get("/manifests", contentManifestController_1.listContentManifests);
router.post("/manifests", contentManifestController_1.createContentManifest);
router.get("/manifests/:manifestId", contentManifestController_1.getContentManifestById);
router.post("/manifests/:manifestId/assets/presign", contentManifestController_1.presignManifestAssets);
router.post("/manifests/:manifestId/assets/:assetId/complete", contentManifestController_1.completeManifestAssetUpload);
router.post("/manifests/:manifestId/finalize", contentManifestController_1.finalizeContentManifest);
router.post("/publications", contentManifestController_1.createContentPublication);
exports.default = router;

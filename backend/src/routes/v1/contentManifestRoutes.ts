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
  issueCreatorAuthSignature,
  listContentManifests,
  presignManifestAssets,
  verifyContentPublication,
} from "../../controllers/contentManifestController";
import { requireSessionAuth } from "../../middleware/walletAuth";
import { requireCreatorAccount } from "../../middleware/accountRole";
import { durableApiIdempotency } from "../../middleware/apiIdempotency";

const router = Router();

router.use(requireSessionAuth);

router.post(
  "/creator-auth-signature",
  requireCreatorAccount,
  durableApiIdempotency({ scope: "content.creator-auth-signature", responseTtlMs: 8 * 60 * 1000 }),
  issueCreatorAuthSignature
);
router.get("/manifests", listContentManifests);
router.post(
  "/manifests",
  requireCreatorAccount,
  durableApiIdempotency({ scope: "content.manifest.create" }),
  createContentManifest
);
router.get("/manifests/:manifestId", getContentManifestById);
router.post(
  "/manifests/:manifestId/assets/presign",
  requireCreatorAccount,
  durableApiIdempotency({
    scope: "content.asset.presign",
    resourceParams: ["manifestId"],
    responseTtlMs: 10 * 60 * 1000,
  }),
  presignManifestAssets
);
router.post(
  "/manifests/:manifestId/assets/:assetId/complete",
  requireCreatorAccount,
  durableApiIdempotency({
    scope: "content.asset.complete",
    resourceParams: ["manifestId", "assetId"],
  }),
  completeManifestAssetUpload
);
router.post(
  "/manifests/:manifestId/finalize",
  requireCreatorAccount,
  durableApiIdempotency({ scope: "content.manifest.finalize", resourceParams: ["manifestId"] }),
  finalizeContentManifest
);
router.post(
  "/publications",
  requireCreatorAccount,
  durableApiIdempotency({ scope: "content.publication.create" }),
  createContentPublication
);
router.patch(
  "/publications/:publicationId/verify",
  requireCreatorAccount,
  durableApiIdempotency({
    scope: "content.publication.creator-verify",
    resourceParams: ["publicationId"],
  }),
  verifyContentPublication
);

export default router;

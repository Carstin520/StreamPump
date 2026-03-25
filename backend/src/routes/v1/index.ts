import { Router } from "express";

import contentManifestRoutes from "./contentManifestRoutes";
import internalOracleRoutes from "./internalOracleRoutes";
import proposalIntentRoutes from "./proposalIntentRoutes";
import proposalRoutes from "./proposalRoutes";

const router = Router();

router.use("/content", contentManifestRoutes);
router.use("/proposal-intents", proposalIntentRoutes);
router.use("/proposals", proposalRoutes);
router.use("/internal/oracle", internalOracleRoutes);

export default router;

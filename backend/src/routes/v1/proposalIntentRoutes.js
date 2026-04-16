"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 proposal intent 路由，承载单次签名发起 proposal 的后端状态机。
 * EN: v1 proposal intent routes that drive the backend state machine for one-sign proposal launch.
 */
const express_1 = require("express");
const proposalIntentController_1 = require("../../controllers/proposalIntentController");
const walletAuth_1 = require("../../middleware/walletAuth");
const router = (0, express_1.Router)();
router.use(walletAuth_1.requireSessionAuth);
router.get("/", proposalIntentController_1.listProposalIntents);
router.post("/", proposalIntentController_1.createProposalIntent);
router.get("/:intentId", proposalIntentController_1.getProposalIntentById);
router.post("/:intentId/lock", proposalIntentController_1.lockProposalIntent);
router.post("/:intentId/build-bundle", proposalIntentController_1.buildProposalLaunchBundle);
router.post("/:intentId/creator-partial-sign", proposalIntentController_1.creatorPartialSignBundle);
router.post("/:intentId/submit", proposalIntentController_1.submitProposalBundle);
router.get("/:intentId/status", proposalIntentController_1.getProposalIntentStatus);
exports.default = router;

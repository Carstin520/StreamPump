"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: v1 proposal 查询路由，仅暴露链上确认后 proposal 的只读查询。
 * EN: v1 proposal query routes that expose read-only access to chain-confirmed proposals.
 */
const express_1 = require("express");
const proposalIntentController_1 = require("../../controllers/proposalIntentController");
const walletAuth_1 = require("../../middleware/walletAuth");
const router = (0, express_1.Router)();
router.use(walletAuth_1.optionalSessionAuth);
router.get("/:id", proposalIntentController_1.getProposalById);
exports.default = router;

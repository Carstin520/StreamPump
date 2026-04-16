"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: Backend 根路由，将原型接口和 v1 接口统一挂载到 /api 下。
 * EN: Root backend router that mounts both prototype and v1 APIs under /api.
 */
const express_1 = require("express");
const prototype_1 = __importDefault(require("./prototype"));
const v1_1 = __importDefault(require("./v1"));
const webhookRoutes_1 = __importDefault(require("./webhookRoutes"));
const router = (0, express_1.Router)();
router.use("/v1", v1_1.default);
router.use("/prototype", prototype_1.default);
router.use("/webhooks", webhookRoutes_1.default);
exports.default = router;

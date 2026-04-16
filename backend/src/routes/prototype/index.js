"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 原型期接口聚合路由，集中承载不属于 v1 主线的数据面。
 * EN: Prototype API aggregator that centralizes non-v1 data surfaces.
 */
const express_1 = require("express");
const eventRoutes_1 = __importDefault(require("../eventRoutes"));
const userRoutes_1 = __importDefault(require("../userRoutes"));
const videoRoutes_1 = __importDefault(require("../videoRoutes"));
const router = (0, express_1.Router)();
router.use("/events", eventRoutes_1.default);
router.use("/users", userRoutes_1.default);
router.use("/videos", videoRoutes_1.default);
exports.default = router;

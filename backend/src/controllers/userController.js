"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUpgradePayload = exports.getUserProfile = void 0;
const buildCreatorUpgradePayload_1 = require("../oracle/buildCreatorUpgradePayload");
const getUserProfile = async (req, res) => {
    res.json({
        id: req.params.userId,
        handle: "creator_handle",
        walletAddress: "",
    });
};
exports.getUserProfile = getUserProfile;
const buildUpgradePayload = async (req, res) => {
    const creatorWallet = String(req.params.userId ?? "");
    const newLevel = Number(req.body.newLevel ?? 2);
    const metricTypeRaw = String(req.body.metricType ?? "");
    const metricValue = Number(req.body.metricValue ?? 0);
    const observedAt = req.body.observedAt ? Number(req.body.observedAt) : undefined;
    if (!creatorWallet) {
        res.status(400).json({ error: "creator wallet is required" });
        return;
    }
    if (!Number.isFinite(newLevel) || newLevel <= 0) {
        res.status(400).json({ error: "newLevel must be a positive integer" });
        return;
    }
    if (!Number.isFinite(metricValue) || metricValue <= 0) {
        res.status(400).json({ error: "metricValue must be greater than 0" });
        return;
    }
    if (metricTypeRaw !== "followers" && metricTypeRaw !== "valid_views") {
        res.status(400).json({ error: "metricType must be followers or valid_views" });
        return;
    }
    const payload = (0, buildCreatorUpgradePayload_1.buildCreatorUpgradePayload)({
        creatorWallet,
        newLevel,
        metricType: metricTypeRaw,
        metricValue,
        observedAt,
    });
    res.json(payload);
};
exports.buildUpgradePayload = buildUpgradePayload;

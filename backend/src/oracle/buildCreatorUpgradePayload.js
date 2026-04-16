"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCreatorUpgradePayload = void 0;
/**
 * CN: 构造创作者升级观察结果的离链 payload，供后端或 oracle worker 签名与提交。
 * EN: Builds the off-chain creator-upgrade observation payload for backend or oracle-worker signing.
 */
const crypto_1 = require("crypto");
const buildCreatorUpgradePayload = (params) => {
    const observedAt = params.observedAt ?? Math.floor(Date.now() / 1000);
    const reportIdHex = (0, crypto_1.randomBytes)(32).toString("hex");
    const digestInput = JSON.stringify({
        creatorWallet: params.creatorWallet,
        newLevel: params.newLevel,
        metricType: params.metricType,
        metricValue: params.metricValue,
        observedAt,
        reportIdHex,
    });
    return {
        creatorWallet: params.creatorWallet,
        newLevel: params.newLevel,
        metricType: params.metricType,
        metricValue: params.metricValue,
        observedAt,
        reportIdHex,
        reportDigestHex: (0, crypto_1.createHash)("sha256").update(digestInput).digest("hex"),
    };
};
exports.buildCreatorUpgradePayload = buildCreatorUpgradePayload;

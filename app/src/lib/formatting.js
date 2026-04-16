"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatIsoLabel = exports.formatUsdcAtomic = exports.shortenWallet = void 0;
const utils_1 = require("@/lib/mocks/utils");
const USDC_DECIMALS = 1_000_000;
const shortenWallet = (value) => {
    if (!value) {
        return "Pending";
    }
    if (value.length <= 10) {
        return value;
    }
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
exports.shortenWallet = shortenWallet;
const formatUsdcAtomic = (value) => {
    if (value === null || value === undefined) {
        return (0, utils_1.formatUsd)(0);
    }
    const numeric = typeof value === "bigint" ? Number(value) : Number(value);
    if (!Number.isFinite(numeric)) {
        return (0, utils_1.formatUsd)(0);
    }
    return (0, utils_1.formatUsd)(numeric / USDC_DECIMALS);
};
exports.formatUsdcAtomic = formatUsdcAtomic;
const formatIsoLabel = (value) => {
    if (!value) {
        return "Pending";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};
exports.formatIsoLabel = formatIsoLabel;

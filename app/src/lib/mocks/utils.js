"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactNumber = exports.formatUsd = void 0;
const formatUsd = (value) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
}).format(value);
exports.formatUsd = formatUsd;
const compactNumber = (value) => new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
}).format(value);
exports.compactNumber = compactNumber;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueConstraintError = exports.ensureIdempotencyKey = exports.parseOptionalJsonObject = exports.parseStringArray = exports.parseNonNegativeBigInt = exports.parsePositiveInt = exports.parseNonNegativeInt = exports.parseSha256Hex = exports.parseOptionalString = exports.parseNonEmptyString = exports.parseWalletFromRequest = exports.parseOptionalWallet = exports.parseWallet = exports.handleControllerError = exports.fail = exports.ok = exports.HttpError = void 0;
/**
 * CN: HTTP 控制器通用工具，统一解析参数、抛出业务错误并格式化响应。
 * EN: Shared HTTP controller helpers for parsing input, throwing business errors, and formatting responses.
 */
const client_1 = require("@prisma/client");
const web3_js_1 = require("@solana/web3.js");
class HttpError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
exports.HttpError = HttpError;
const ok = (res, data, status = 200) => {
    res.status(status).json({
        ok: true,
        data,
    });
};
exports.ok = ok;
const fail = (res, status, code, message, details) => {
    res.status(status).json({
        ok: false,
        error: {
            code,
            message,
            details: details ?? null,
        },
    });
};
exports.fail = fail;
const handleControllerError = (res, error, fallback) => {
    if (error instanceof HttpError) {
        (0, exports.fail)(res, error.status, error.code, error.message, error.details);
        return;
    }
    (0, exports.fail)(res, 500, fallback, error instanceof Error ? error.message : fallback);
};
exports.handleControllerError = handleControllerError;
const parseWallet = (value, fieldName) => {
    const wallet = String(value ?? "").trim();
    if (!wallet) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
    }
    try {
        return new web3_js_1.PublicKey(wallet).toBase58();
    }
    catch (_error) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} is not a valid Solana public key`);
    }
};
exports.parseWallet = parseWallet;
const parseOptionalWallet = (value, fieldName) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }
    return (0, exports.parseWallet)(value, fieldName);
};
exports.parseOptionalWallet = parseOptionalWallet;
const parseWalletFromRequest = (req, headerName, bodyField) => {
    if (req.auth?.wallet) {
        return req.auth.wallet;
    }
    return (0, exports.parseWallet)(req.header(headerName) ?? req.body[bodyField], bodyField);
};
exports.parseWalletFromRequest = parseWalletFromRequest;
const parseNonEmptyString = (value, fieldName) => {
    const parsed = String(value ?? "").trim();
    if (!parsed) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
    }
    return parsed;
};
exports.parseNonEmptyString = parseNonEmptyString;
const parseOptionalString = (value) => {
    const parsed = String(value ?? "").trim();
    return parsed ? parsed : null;
};
exports.parseOptionalString = parseOptionalString;
const parseSha256Hex = (value, fieldName) => {
    const parsed = (0, exports.parseNonEmptyString)(value, fieldName).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(parsed)) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a 64-character SHA-256 hex`);
    }
    return parsed;
};
exports.parseSha256Hex = parseSha256Hex;
const parseNonNegativeInt = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a non-negative integer`);
    }
    return parsed;
};
exports.parseNonNegativeInt = parseNonNegativeInt;
const parsePositiveInt = (value, fieldName) => {
    const parsed = (0, exports.parseNonNegativeInt)(value, fieldName);
    if (parsed <= 0) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
    }
    return parsed;
};
exports.parsePositiveInt = parsePositiveInt;
const parseNonNegativeBigInt = (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
    }
    let parsed;
    try {
        parsed = BigInt(String(value));
    }
    catch (_error) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be an integer`);
    }
    if (parsed < 0n) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be non-negative`);
    }
    return parsed;
};
exports.parseNonNegativeBigInt = parseNonNegativeBigInt;
const parseStringArray = (value, fieldName) => {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be an array`);
    }
    return value
        .map((item) => String(item ?? "").trim())
        .filter((item) => item.length > 0);
};
exports.parseStringArray = parseStringArray;
const parseOptionalJsonObject = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    throw new HttpError(400, "INVALID_INPUT", "metadata must be a JSON object");
};
exports.parseOptionalJsonObject = parseOptionalJsonObject;
const ensureIdempotencyKey = (req) => {
    return (0, exports.parseNonEmptyString)(req.header("x-idempotency-key"), "x-idempotency-key");
};
exports.ensureIdempotencyKey = ensureIdempotencyKey;
const isUniqueConstraintError = (error) => {
    return (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002");
};
exports.isUniqueConstraintError = isUniqueConstraintError;

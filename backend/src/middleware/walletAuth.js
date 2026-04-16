"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutWalletSession = exports.requireSessionAuth = exports.requireWalletAuth = exports.optionalSessionAuth = exports.optionalWalletAuth = void 0;
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const auth_1 = require("../services/auth");
const http_1 = require("../controllers/http");
const parseWalletHeader = (value) => {
    const wallet = String(value ?? "").trim();
    if (!wallet) {
        return null;
    }
    try {
        return new web3_js_1.PublicKey(wallet).toBase58();
    }
    catch (_error) {
        return null;
    }
};
const getBearerToken = (req) => {
    const authorization = String(req.header("authorization") ?? "").trim();
    if (!authorization) {
        return null;
    }
    const [scheme, token] = authorization.split(/\s+/, 2);
    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
        return null;
    }
    return token;
};
const maybeApplyLegacyWalletHeader = (req) => {
    if (!default_1.config.auth.allowLegacyWalletHeader) {
        return false;
    }
    const wallet = parseWalletHeader(req.header("x-wallet-address"));
    if (!wallet) {
        return false;
    }
    req.auth = {
        wallet,
        sessionId: null,
        source: "legacy-header",
    };
    return true;
};
const optionalWalletAuth = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            maybeApplyLegacyWalletHeader(req);
            next();
            return;
        }
        const session = await (0, auth_1.verifyWalletSessionToken)(token);
        if (!session) {
            (0, http_1.fail)(res, 401, "AUTH_INVALID", "wallet session is invalid or expired");
            return;
        }
        req.auth = {
            wallet: session.wallet,
            sessionId: session.sessionId,
            source: "session",
        };
        next();
    }
    catch (error) {
        (0, http_1.fail)(res, 500, "AUTH_CHECK_FAILED", error instanceof Error ? error.message : "auth failed");
    }
};
exports.optionalWalletAuth = optionalWalletAuth;
const optionalSessionAuth = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            next();
            return;
        }
        const session = await (0, auth_1.verifyWalletSessionToken)(token);
        if (!session) {
            (0, http_1.fail)(res, 401, "AUTH_INVALID", "wallet session is invalid or expired");
            return;
        }
        req.auth = {
            wallet: session.wallet,
            sessionId: session.sessionId,
            source: "session",
        };
        next();
    }
    catch (error) {
        (0, http_1.fail)(res, 500, "AUTH_CHECK_FAILED", error instanceof Error ? error.message : "auth failed");
    }
};
exports.optionalSessionAuth = optionalSessionAuth;
const requireWalletAuth = async (req, res, next) => {
    await (0, exports.optionalWalletAuth)(req, res, () => {
        if (!req.auth) {
            (0, http_1.fail)(res, 401, "AUTH_REQUIRED", "wallet authentication is required");
            return;
        }
        next();
    });
};
exports.requireWalletAuth = requireWalletAuth;
const requireSessionAuth = async (req, res, next) => {
    await (0, exports.optionalSessionAuth)(req, res, () => {
        if (!req.auth || req.auth.source !== "session") {
            (0, http_1.fail)(res, 401, "AUTH_REQUIRED", "bearer session authentication is required");
            return;
        }
        next();
    });
};
exports.requireSessionAuth = requireSessionAuth;
const logoutWalletSession = async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (token) {
            await (0, auth_1.revokeWalletSession)(token);
        }
        res.status(204).send();
    }
    catch (error) {
        (0, http_1.fail)(res, 500, "AUTH_LOGOUT_FAILED", error instanceof Error ? error.message : "logout failed");
    }
};
exports.logoutWalletSession = logoutWalletSession;

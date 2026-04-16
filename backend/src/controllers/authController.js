"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSession = exports.exchangeProviderSession = exports.verifyAuthChallenge = exports.createAuthChallenge = void 0;
const client_1 = require("@prisma/client");
const web3_js_1 = require("@solana/web3.js");
const http_1 = require("./http");
const auth_1 = require("../services/auth");
const parseWallet = (value) => {
    const wallet = String(value ?? "").trim();
    if (!wallet) {
        throw new http_1.HttpError(400, "INVALID_INPUT", "wallet is required");
    }
    try {
        return new web3_js_1.PublicKey(wallet).toBase58();
    }
    catch (_error) {
        throw new http_1.HttpError(400, "INVALID_INPUT", "wallet is not a valid Solana public key");
    }
};
const parseIdentityProvider = (value) => {
    const provider = String(value ?? "").trim().toUpperCase();
    switch (provider) {
        case "GOOGLE":
            return client_1.IdentityProvider.GOOGLE;
        case "APPLE":
            return client_1.IdentityProvider.APPLE;
        case "EMAIL":
            return client_1.IdentityProvider.EMAIL;
        case "PASSKEY":
            return client_1.IdentityProvider.PASSKEY;
        default:
            throw new http_1.HttpError(400, "INVALID_INPUT", "provider must be one of: GOOGLE, APPLE, EMAIL, PASSKEY");
    }
};
const createAuthChallenge = async (req, res) => {
    try {
        const wallet = parseWallet(req.body.wallet);
        const challenge = await (0, auth_1.createWalletAuthChallenge)(wallet);
        (0, http_1.ok)(res, {
            wallet: challenge.wallet,
            challengeId: challenge.challengeId,
            nonce: challenge.nonce,
            message: challenge.message,
            expiresAt: challenge.expiresAt.toISOString(),
        }, 201);
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "CREATE_AUTH_CHALLENGE_FAILED");
    }
};
exports.createAuthChallenge = createAuthChallenge;
const verifyAuthChallenge = async (req, res) => {
    try {
        const wallet = parseWallet(req.body.wallet);
        const nonce = (0, http_1.parseNonEmptyString)(req.body.nonce, "nonce");
        const signature = (0, http_1.parseNonEmptyString)(req.body.signature, "signature");
        const session = await (0, auth_1.verifyWalletAuthChallenge)({
            wallet,
            nonce,
            signature,
        });
        (0, http_1.ok)(res, {
            wallet: session.wallet,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt.toISOString(),
            tokenType: "Bearer",
        });
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                (0, http_1.handleControllerError)(res, new http_1.HttpError(404, "AUTH_CHALLENGE_NOT_FOUND", error.message), "VERIFY_AUTH_CHALLENGE_FAILED");
                return;
            }
            if (error.message.includes("expired") || error.message.includes("consumed")) {
                (0, http_1.handleControllerError)(res, new http_1.HttpError(409, "AUTH_CHALLENGE_INVALID", error.message), "VERIFY_AUTH_CHALLENGE_FAILED");
                return;
            }
            if (error.message.includes("signature")) {
                (0, http_1.handleControllerError)(res, new http_1.HttpError(401, "AUTH_SIGNATURE_INVALID", error.message), "VERIFY_AUTH_CHALLENGE_FAILED");
                return;
            }
        }
        (0, http_1.handleControllerError)(res, error, "VERIFY_AUTH_CHALLENGE_FAILED");
    }
};
exports.verifyAuthChallenge = verifyAuthChallenge;
const exchangeProviderSession = async (req, res) => {
    try {
        const session = await (0, auth_1.exchangeProviderIdentitySession)({
            provider: parseIdentityProvider(req.body.provider),
            providerSubject: (0, http_1.parseNonEmptyString)(req.body.providerSubject, "providerSubject"),
            email: req.body.email ? String(req.body.email).trim() : null,
            displayName: req.body.displayName ? String(req.body.displayName).trim() : null,
            managedWalletAddress: req.body.managedWalletAddress
                ? parseWallet(req.body.managedWalletAddress)
                : null,
        });
        (0, http_1.ok)(res, {
            wallet: session.wallet,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt.toISOString(),
            tokenType: "Bearer",
            identity: session.identity,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "EXCHANGE_PROVIDER_SESSION_FAILED");
    }
};
exports.exchangeProviderSession = exchangeProviderSession;
const getCurrentSession = async (req, res) => {
    try {
        if (!req.auth) {
            throw new http_1.HttpError(401, "AUTH_REQUIRED", "wallet authentication is required");
        }
        const identity = await (0, auth_1.findAuthIdentityByWallet)(req.auth.wallet);
        (0, http_1.ok)(res, {
            wallet: req.auth.wallet,
            sessionId: req.auth.sessionId,
            source: req.auth.source,
            identity: identity
                ? {
                    id: identity.id,
                    provider: identity.provider,
                    providerSubject: identity.providerSubject,
                    email: identity.email,
                    displayName: identity.displayName,
                    managedWalletAddress: identity.managedWalletAddress,
                }
                : null,
        });
    }
    catch (error) {
        (0, http_1.handleControllerError)(res, error, "GET_CURRENT_SESSION_FAILED");
    }
};
exports.getCurrentSession = getCurrentSession;

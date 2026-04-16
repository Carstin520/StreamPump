"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWeb3AuthToken = exports.revokeWalletSession = exports.verifyWalletSessionToken = exports.findAuthIdentityByWallet = exports.exchangeProviderIdentitySession = exports.verifyWalletAuthChallenge = exports.createWalletAuthChallenge = void 0;
/**
 * CN: 钱包认证服务，提供 challenge/signature 登录、会话令牌签发与 Bearer 校验。
 * EN: Wallet authentication service providing challenge/signature login, session token issuance, and Bearer verification.
 */
const crypto_1 = require("crypto");
const ed25519_1 = require("@noble/curves/ed25519");
const bs58_1 = __importDefault(require("bs58"));
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const prisma_1 = require("./prisma");
const CHALLENGE_TTL_MS = default_1.config.auth.challengeTtlSeconds * 1000;
const SESSION_TTL_MS = default_1.config.auth.sessionTtlSeconds * 1000;
const SESSION_SECRET = default_1.config.auth.sessionSecret;
const encodeBase64Url = (value) => Buffer.isBuffer(value) ? value.toString("base64url") : Buffer.from(value).toString("base64url");
const decodeBase64Url = (value) => Buffer.from(value, "base64url");
const sha256Hex = (value) => (0, crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
const signSessionPayload = (payloadBase64Url) => (0, crypto_1.createHmac)("sha256", SESSION_SECRET).update(payloadBase64Url, "utf8").digest("base64url");
const getSessionDomain = () => {
    try {
        return new URL(default_1.config.app.apiBaseUrl).host;
    }
    catch (_error) {
        return "localhost";
    }
};
const parseSignatureBytes = (signature) => {
    const trimmed = signature.trim();
    if (!trimmed) {
        throw new Error("signature is required");
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed);
        return Uint8Array.from(parsed);
    }
    if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
        return Uint8Array.from(Buffer.from(trimmed, "hex"));
    }
    try {
        const asBase64 = Buffer.from(trimmed, "base64");
        if (asBase64.length === 64) {
            return Uint8Array.from(asBase64);
        }
    }
    catch (_error) {
        // Fall through to base58.
    }
    try {
        const asBase58 = bs58_1.default.decode(trimmed);
        if (asBase58.length !== 64) {
            throw new Error("signature must decode to 64 bytes");
        }
        return asBase58;
    }
    catch (error) {
        throw new Error(error instanceof Error ? error.message : "invalid signature encoding");
    }
};
const buildChallengeMessage = (wallet, nonce, issuedAt, expiresAt) => {
    const domain = getSessionDomain();
    return [
        "StreamPump wallet sign-in",
        `Domain: ${domain}`,
        `Wallet: ${wallet}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt.toISOString()}`,
        `Expires At: ${expiresAt.toISOString()}`,
    ].join("\n");
};
const buildSessionToken = (params) => {
    const payload = encodeBase64Url(JSON.stringify({
        sid: params.sessionId,
        wallet: params.wallet,
        exp: Math.floor(params.expiresAt.getTime() / 1000),
    }));
    const signature = signSessionPayload(payload);
    return `${payload}.${signature}`;
};
const parseSessionToken = (token) => {
    const [payloadBase64Url, signatureBase64Url] = token.trim().split(".");
    if (!payloadBase64Url || !signatureBase64Url) {
        return null;
    }
    const expectedSignature = signSessionPayload(payloadBase64Url);
    const providedBuffer = Buffer.from(signatureBase64Url, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (providedBuffer.length !== expectedBuffer.length ||
        !(0, crypto_1.timingSafeEqual)(providedBuffer, expectedBuffer)) {
        return null;
    }
    try {
        const payload = JSON.parse(decodeBase64Url(payloadBase64Url).toString("utf8"));
        if (!payload.sid || !payload.wallet || typeof payload.exp !== "number") {
            return null;
        }
        return {
            sessionId: payload.sid,
            wallet: new web3_js_1.PublicKey(payload.wallet).toBase58(),
            exp: payload.exp,
            tokenHash: sha256Hex(token),
        };
    }
    catch (_error) {
        return null;
    }
};
const normalizeManagedWallet = (value) => value && value.trim()
    ? new web3_js_1.PublicKey(value).toBase58()
    : web3_js_1.Keypair.generate().publicKey.toBase58();
const createWalletSession = async (wallet) => {
    const sessionId = (0, crypto_1.randomUUID)();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const accessToken = buildSessionToken({
        sessionId,
        wallet,
        expiresAt,
    });
    await prisma_1.prisma.walletSession.create({
        data: {
            id: sessionId,
            wallet,
            tokenHash: sha256Hex(accessToken),
            expiresAt,
        },
    });
    return {
        wallet,
        accessToken,
        expiresAt,
    };
};
const createWalletAuthChallenge = async (wallet) => {
    const normalizedWallet = new web3_js_1.PublicKey(wallet).toBase58();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const nonce = (0, crypto_1.randomBytes)(16).toString("hex");
    const message = buildChallengeMessage(normalizedWallet, nonce, issuedAt, expiresAt);
    const challenge = await prisma_1.prisma.walletAuthChallenge.create({
        data: {
            wallet: normalizedWallet,
            nonce,
            message,
            expiresAt,
        },
    });
    return {
        challengeId: challenge.id,
        wallet: normalizedWallet,
        nonce,
        message,
        expiresAt,
    };
};
exports.createWalletAuthChallenge = createWalletAuthChallenge;
const verifyWalletAuthChallenge = async (params) => {
    const normalizedWallet = new web3_js_1.PublicKey(params.wallet).toBase58();
    const challenge = await prisma_1.prisma.walletAuthChallenge.findFirst({
        where: {
            wallet: normalizedWallet,
            nonce: params.nonce,
        },
    });
    if (!challenge) {
        throw new Error("auth challenge not found");
    }
    if (challenge.consumedAt) {
        throw new Error("auth challenge has already been consumed");
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
        throw new Error("auth challenge has expired");
    }
    const signatureBytes = parseSignatureBytes(params.signature);
    const verified = ed25519_1.ed25519.verify(signatureBytes, Buffer.from(challenge.message, "utf8"), new web3_js_1.PublicKey(normalizedWallet).toBytes());
    if (!verified) {
        throw new Error("invalid wallet signature");
    }
    const sessionId = (0, crypto_1.randomUUID)();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const accessToken = buildSessionToken({
        sessionId,
        wallet: normalizedWallet,
        expiresAt,
    });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.walletAuthChallenge.update({
            where: { id: challenge.id },
            data: {
                consumedAt: new Date(),
            },
        }),
        prisma_1.prisma.walletSession.create({
            data: {
                id: sessionId,
                wallet: normalizedWallet,
                tokenHash: sha256Hex(accessToken),
                expiresAt,
            },
        }),
    ]);
    return {
        wallet: normalizedWallet,
        accessToken,
        expiresAt,
    };
};
exports.verifyWalletAuthChallenge = verifyWalletAuthChallenge;
const exchangeProviderIdentitySession = async (params) => {
    const providerSubject = params.providerSubject.trim();
    if (!providerSubject) {
        throw new Error("providerSubject is required");
    }
    const existingIdentity = await prisma_1.prisma.authIdentity.findUnique({
        where: {
            provider_providerSubject: {
                provider: params.provider,
                providerSubject,
            },
        },
    });
    const managedWalletAddress = existingIdentity?.managedWalletAddress ?? normalizeManagedWallet(params.managedWalletAddress);
    const identity = existingIdentity
        ? await prisma_1.prisma.authIdentity.update({
            where: { id: existingIdentity.id },
            data: {
                email: params.email ?? existingIdentity.email,
                displayName: params.displayName ?? existingIdentity.displayName,
                managedWalletAddress,
            },
        })
        : await prisma_1.prisma.authIdentity.create({
            data: {
                provider: params.provider,
                providerSubject,
                email: params.email ?? null,
                displayName: params.displayName ?? null,
                managedWalletAddress,
            },
        });
    const session = await createWalletSession(identity.managedWalletAddress);
    return {
        ...session,
        identity: {
            id: identity.id,
            provider: identity.provider,
            providerSubject: identity.providerSubject,
            email: identity.email,
            displayName: identity.displayName,
            managedWalletAddress: identity.managedWalletAddress,
        },
    };
};
exports.exchangeProviderIdentitySession = exchangeProviderIdentitySession;
const findAuthIdentityByWallet = async (wallet) => prisma_1.prisma.authIdentity.findFirst({
    where: {
        managedWalletAddress: wallet,
    },
});
exports.findAuthIdentityByWallet = findAuthIdentityByWallet;
const verifyWalletSessionToken = async (token) => {
    const parsed = parseSessionToken(token);
    if (!parsed) {
        return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
        return null;
    }
    const session = await prisma_1.prisma.walletSession.findUnique({
        where: { id: parsed.sessionId },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        return null;
    }
    if (session.wallet !== parsed.wallet || session.tokenHash !== parsed.tokenHash) {
        return null;
    }
    void prisma_1.prisma.walletSession.update({
        where: { id: session.id },
        data: {
            lastSeenAt: new Date(),
        },
    });
    return {
        sessionId: session.id,
        wallet: session.wallet,
        expiresAt: session.expiresAt,
    };
};
exports.verifyWalletSessionToken = verifyWalletSessionToken;
const revokeWalletSession = async (token) => {
    const parsed = parseSessionToken(token);
    if (!parsed) {
        return;
    }
    await prisma_1.prisma.walletSession.updateMany({
        where: {
            id: parsed.sessionId,
            tokenHash: parsed.tokenHash,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });
};
exports.revokeWalletSession = revokeWalletSession;
const verifyWeb3AuthToken = async (token) => {
    const session = await (0, exports.verifyWalletSessionToken)(token);
    if (!session) {
        return null;
    }
    return {
        isValid: true,
        userId: session.wallet,
    };
};
exports.verifyWeb3AuthToken = verifyWeb3AuthToken;

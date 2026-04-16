"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 钱包认证服务测试，覆盖 challenge、签名验证、provider exchange、会话校验和 revoke。
 * EN: Wallet auth service tests covering challenge creation, signature verification, provider exchange, session validation, and revoke.
 */
const chai_1 = require("chai");
const ed25519_1 = require("@noble/curves/ed25519");
const client_1 = require("@prisma/client");
const bs58_1 = __importDefault(require("bs58"));
const web3_js_1 = require("@solana/web3.js");
const prisma_1 = require("../src/services/prisma");
const auth_1 = require("../src/services/auth");
const installMockAuthPrisma = () => {
    const challenges = new Map();
    const sessions = new Map();
    const identities = new Map();
    let challengeCounter = 0;
    let identityCounter = 0;
    const prismaAny = prisma_1.prisma;
    const original = {
        walletAuthChallenge: {
            create: prisma_1.prisma.walletAuthChallenge.create,
            findFirst: prisma_1.prisma.walletAuthChallenge.findFirst,
            update: prisma_1.prisma.walletAuthChallenge.update,
            deleteMany: prisma_1.prisma.walletAuthChallenge.deleteMany,
        },
        walletSession: {
            create: prisma_1.prisma.walletSession.create,
            findUnique: prisma_1.prisma.walletSession.findUnique,
            updateMany: prisma_1.prisma.walletSession.updateMany,
            update: prisma_1.prisma.walletSession.update,
            deleteMany: prisma_1.prisma.walletSession.deleteMany,
        },
        authIdentity: {
            findUnique: prisma_1.prisma.authIdentity.findUnique,
            create: prisma_1.prisma.authIdentity.create,
            update: prisma_1.prisma.authIdentity.update,
            findFirst: prisma_1.prisma.authIdentity.findFirst,
        },
        $transaction: prismaAny.$transaction,
    };
    prismaAny.walletAuthChallenge.create = async ({ data }) => {
        challengeCounter += 1;
        const now = new Date();
        const record = {
            id: `challenge-${challengeCounter}`,
            wallet: data.wallet,
            nonce: data.nonce,
            message: data.message,
            expiresAt: data.expiresAt,
            consumedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        challenges.set(record.id, record);
        return record;
    };
    prismaAny.walletAuthChallenge.findFirst = async ({ where }) => {
        return (Array.from(challenges.values()).find((challenge) => challenge.wallet === where.wallet && challenge.nonce === where.nonce) ?? null);
    };
    prismaAny.walletAuthChallenge.update = async ({ where, data }) => {
        const current = challenges.get(where.id);
        if (!current) {
            throw new Error(`challenge ${where.id} not found`);
        }
        const updated = {
            ...current,
            ...data,
            updatedAt: new Date(),
        };
        challenges.set(where.id, updated);
        return updated;
    };
    prismaAny.walletAuthChallenge.deleteMany = async ({ where }) => {
        const removable = Array.from(challenges.values()).filter((challenge) => !where?.wallet || challenge.wallet === where.wallet);
        removable.forEach((challenge) => challenges.delete(challenge.id));
        return { count: removable.length };
    };
    prismaAny.walletSession.create = async ({ data }) => {
        const now = new Date();
        const record = {
            ...data,
            revokedAt: data.revokedAt ?? null,
            lastSeenAt: data.lastSeenAt ?? null,
            createdAt: data.createdAt ?? now,
            updatedAt: data.updatedAt ?? now,
        };
        sessions.set(record.id, record);
        return record;
    };
    prismaAny.walletSession.findUnique = async ({ where }) => {
        return sessions.get(where.id) ?? null;
    };
    prismaAny.walletSession.updateMany = async ({ where, data }) => {
        const session = sessions.get(where.id);
        if (!session) {
            return { count: 0 };
        }
        if (where.tokenHash && session.tokenHash !== where.tokenHash) {
            return { count: 0 };
        }
        if (where.revokedAt === null && session.revokedAt !== null) {
            return { count: 0 };
        }
        sessions.set(where.id, {
            ...session,
            ...data,
            updatedAt: new Date(),
        });
        return { count: 1 };
    };
    prismaAny.walletSession.update = async ({ where, data }) => {
        const session = sessions.get(where.id);
        if (!session) {
            throw new Error(`session ${where.id} not found`);
        }
        const updated = {
            ...session,
            ...data,
            updatedAt: new Date(),
        };
        sessions.set(where.id, updated);
        return updated;
    };
    prismaAny.walletSession.deleteMany = async ({ where }) => {
        const removable = Array.from(sessions.values()).filter((session) => !where?.wallet || session.wallet === where.wallet);
        removable.forEach((session) => sessions.delete(session.id));
        return { count: removable.length };
    };
    prismaAny.authIdentity.findUnique = async ({ where }) => {
        const key = `${where.provider_providerSubject.provider}:${where.provider_providerSubject.providerSubject}`;
        return identities.get(key) ?? null;
    };
    prismaAny.authIdentity.create = async ({ data }) => {
        identityCounter += 1;
        const now = new Date();
        const record = {
            id: `identity-${identityCounter}`,
            provider: data.provider,
            providerSubject: data.providerSubject,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            managedWalletAddress: data.managedWalletAddress,
            createdAt: now,
            updatedAt: now,
        };
        identities.set(`${record.provider}:${record.providerSubject}`, record);
        return record;
    };
    prismaAny.authIdentity.update = async ({ where, data }) => {
        const current = Array.from(identities.values()).find((identity) => identity.id === where.id);
        if (!current) {
            throw new Error(`identity ${where.id} not found`);
        }
        const updated = {
            ...current,
            ...data,
            updatedAt: new Date(),
        };
        identities.set(`${updated.provider}:${updated.providerSubject}`, updated);
        return updated;
    };
    prismaAny.authIdentity.findFirst = async ({ where }) => {
        return (Array.from(identities.values()).find((identity) => identity.managedWalletAddress === where.managedWalletAddress) ?? null);
    };
    prismaAny.$transaction = async (operations) => Promise.all(operations);
    return {
        restore: () => {
            prismaAny.walletAuthChallenge.create = original.walletAuthChallenge.create;
            prismaAny.walletAuthChallenge.findFirst = original.walletAuthChallenge.findFirst;
            prismaAny.walletAuthChallenge.update = original.walletAuthChallenge.update;
            prismaAny.walletAuthChallenge.deleteMany = original.walletAuthChallenge.deleteMany;
            prismaAny.walletSession.create = original.walletSession.create;
            prismaAny.walletSession.findUnique = original.walletSession.findUnique;
            prismaAny.walletSession.updateMany = original.walletSession.updateMany;
            prismaAny.walletSession.update = original.walletSession.update;
            prismaAny.walletSession.deleteMany = original.walletSession.deleteMany;
            prismaAny.authIdentity.findUnique = original.authIdentity.findUnique;
            prismaAny.authIdentity.create = original.authIdentity.create;
            prismaAny.authIdentity.update = original.authIdentity.update;
            prismaAny.authIdentity.findFirst = original.authIdentity.findFirst;
            prismaAny.$transaction = original.$transaction;
        },
    };
};
describe("wallet auth service", function () {
    this.timeout(20_000);
    let restorePrisma = null;
    beforeEach(() => {
        const mock = installMockAuthPrisma();
        restorePrisma = mock.restore;
    });
    afterEach(() => {
        restorePrisma?.();
        restorePrisma = null;
    });
    it("creates a challenge, verifies a wallet signature, and validates the resulting session", async () => {
        const wallet = web3_js_1.Keypair.generate();
        const walletAddress = wallet.publicKey.toBase58();
        const challenge = await (0, auth_1.createWalletAuthChallenge)(walletAddress);
        const signature = ed25519_1.ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32));
        const session = await (0, auth_1.verifyWalletAuthChallenge)({
            wallet: walletAddress,
            nonce: challenge.nonce,
            signature: bs58_1.default.encode(signature),
        });
        (0, chai_1.expect)(session.wallet).to.equal(walletAddress);
        (0, chai_1.expect)(session.accessToken).to.be.a("string");
        const validated = await (0, auth_1.verifyWalletSessionToken)(session.accessToken);
        (0, chai_1.expect)(validated?.wallet).to.equal(walletAddress);
        await (0, auth_1.revokeWalletSession)(session.accessToken);
        const revoked = await (0, auth_1.verifyWalletSessionToken)(session.accessToken);
        (0, chai_1.expect)(revoked).to.equal(null);
    });
    it("rejects challenge verification when the signature does not match the wallet", async () => {
        const wallet = web3_js_1.Keypair.generate();
        const wrongWallet = web3_js_1.Keypair.generate();
        const walletAddress = wallet.publicKey.toBase58();
        const challenge = await (0, auth_1.createWalletAuthChallenge)(walletAddress);
        const invalidSignature = ed25519_1.ed25519.sign(Buffer.from(challenge.message, "utf8"), wrongWallet.secretKey.slice(0, 32));
        let thrown = null;
        try {
            await (0, auth_1.verifyWalletAuthChallenge)({
                wallet: walletAddress,
                nonce: challenge.nonce,
                signature: bs58_1.default.encode(invalidSignature),
            });
        }
        catch (error) {
            thrown = error;
        }
        (0, chai_1.expect)(String(thrown)).to.match(/invalid wallet signature/i);
    });
    it("creates a provider-backed session and reuses the mapped managed wallet", async () => {
        const firstSession = await (0, auth_1.exchangeProviderIdentitySession)({
            provider: client_1.IdentityProvider.GOOGLE,
            providerSubject: "google-user-1",
            email: "alex@example.com",
            displayName: "Alex Chen",
        });
        const secondSession = await (0, auth_1.exchangeProviderIdentitySession)({
            provider: client_1.IdentityProvider.GOOGLE,
            providerSubject: "google-user-1",
            email: "alex@example.com",
            displayName: "Alex C.",
        });
        (0, chai_1.expect)(firstSession.wallet).to.equal(secondSession.wallet);
        (0, chai_1.expect)(firstSession.identity.provider).to.equal(client_1.IdentityProvider.GOOGLE);
        (0, chai_1.expect)(secondSession.identity.displayName).to.equal("Alex C.");
        const mappedIdentity = await (0, auth_1.findAuthIdentityByWallet)(firstSession.wallet);
        (0, chai_1.expect)(mappedIdentity?.providerSubject).to.equal("google-user-1");
        const validated = await (0, auth_1.verifyWalletSessionToken)(secondSession.accessToken);
        (0, chai_1.expect)(validated?.wallet).to.equal(firstSession.wallet);
    });
});

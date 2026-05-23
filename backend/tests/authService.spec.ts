/**
 * CN: 钱包认证服务测试，覆盖 challenge、签名验证、provider exchange、会话校验和 revoke。
 * EN: Wallet auth service tests covering challenge creation, signature verification, provider exchange, session validation, and revoke.
 */
import { expect } from "chai";
import { ed25519 } from "@noble/curves/ed25519";
import { AccountRole, IdentityProvider } from "@prisma/client";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { prisma } from "../src/services/prisma";
import {
  createWalletAuthChallenge,
  exchangeProviderIdentitySession,
  findAuthIdentityByWallet,
  revokeWalletSession,
  bindExternalWalletToIdentitySession,
  verifyWalletAuthChallenge,
  verifyWalletSessionToken,
} from "../src/services/auth";

type ChallengeRecord = {
  id: string;
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  wallet: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type IdentityRecord = {
  id: string;
  provider: IdentityProvider;
  providerSubject: string;
  email: string | null;
  displayName: string | null;
  managedWalletAddress: string;
  createdAt: Date;
  updatedAt: Date;
};

type AccountProfileRecord = {
  id: string;
  wallet: string;
  role: AccountRole;
  displayName: string | null;
  handle: string | null;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const installMockAuthPrisma = () => {
  const challenges = new Map<string, ChallengeRecord>();
  const sessions = new Map<string, SessionRecord>();
  const identities = new Map<string, IdentityRecord>();
  const accountProfiles = new Map<string, AccountProfileRecord>();

  let challengeCounter = 0;
  let identityCounter = 0;
  let accountProfileCounter = 0;

  const prismaAny = prisma as any;
  const original = {
    walletAuthChallenge: {
      create: prisma.walletAuthChallenge.create,
      findFirst: prisma.walletAuthChallenge.findFirst,
      update: prisma.walletAuthChallenge.update,
      deleteMany: prisma.walletAuthChallenge.deleteMany,
    },
    walletSession: {
      create: prisma.walletSession.create,
      findUnique: prisma.walletSession.findUnique,
      updateMany: prisma.walletSession.updateMany,
      update: prisma.walletSession.update,
      deleteMany: prisma.walletSession.deleteMany,
    },
    authIdentity: {
      findUnique: prisma.authIdentity.findUnique,
      create: prisma.authIdentity.create,
      update: prisma.authIdentity.update,
      findFirst: prisma.authIdentity.findFirst,
    },
    accountProfile: {
      findUnique: prisma.accountProfile.findUnique,
      upsert: prisma.accountProfile.upsert,
    },
    $transaction: prismaAny.$transaction,
  };

  prismaAny.walletAuthChallenge.create = async ({ data }: { data: Omit<ChallengeRecord, "id" | "createdAt" | "updatedAt" | "consumedAt"> }) => {
    challengeCounter += 1;
    const now = new Date();
    const record: ChallengeRecord = {
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

  prismaAny.walletAuthChallenge.findFirst = async ({ where }: { where: { wallet: string; nonce: string } }) => {
    return (
      Array.from(challenges.values()).find(
        (challenge) => challenge.wallet === where.wallet && challenge.nonce === where.nonce,
      ) ?? null
    );
  };

  prismaAny.walletAuthChallenge.update = async ({ where, data }: { where: { id: string }; data: Partial<ChallengeRecord> }) => {
    const current = challenges.get(where.id);
    if (!current) {
      throw new Error(`challenge ${where.id} not found`);
    }

    const updated: ChallengeRecord = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };
    challenges.set(where.id, updated);
    return updated;
  };

  prismaAny.walletAuthChallenge.deleteMany = async ({ where }: { where?: { wallet?: string } }) => {
    const removable = Array.from(challenges.values()).filter(
      (challenge) => !where?.wallet || challenge.wallet === where.wallet,
    );
    removable.forEach((challenge) => challenges.delete(challenge.id));
    return { count: removable.length };
  };

  prismaAny.walletSession.create = async ({ data }: { data: SessionRecord }) => {
    const now = new Date();
    const record: SessionRecord = {
      ...data,
      revokedAt: data.revokedAt ?? null,
      lastSeenAt: data.lastSeenAt ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
    sessions.set(record.id, record);
    return record;
  };

  prismaAny.walletSession.findUnique = async ({ where }: { where: { id: string } }) => {
    return sessions.get(where.id) ?? null;
  };

  prismaAny.walletSession.updateMany = async ({ where, data }: { where: { id: string; tokenHash?: string; revokedAt?: null }; data: Partial<SessionRecord> }) => {
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

  prismaAny.walletSession.update = async ({ where, data }: { where: { id: string }; data: Partial<SessionRecord> }) => {
    const session = sessions.get(where.id);
    if (!session) {
      throw new Error(`session ${where.id} not found`);
    }

    const updated: SessionRecord = {
      ...session,
      ...data,
      updatedAt: new Date(),
    };
    sessions.set(where.id, updated);
    return updated;
  };

  prismaAny.walletSession.deleteMany = async ({ where }: { where?: { wallet?: string } }) => {
    const removable = Array.from(sessions.values()).filter(
      (session) => !where?.wallet || session.wallet === where.wallet,
    );
    removable.forEach((session) => sessions.delete(session.id));
    return { count: removable.length };
  };

  prismaAny.authIdentity.findUnique = async ({
    where,
  }: {
    where: {
      provider_providerSubject?: { provider: IdentityProvider; providerSubject: string };
      managedWalletAddress?: string;
    };
  }) => {
    if (where.managedWalletAddress) {
      return (
        Array.from(identities.values()).find(
          (identity) => identity.managedWalletAddress === where.managedWalletAddress,
        ) ?? null
      );
    }

    if (!where.provider_providerSubject) {
      return null;
    }

    const key = `${where.provider_providerSubject.provider}:${where.provider_providerSubject.providerSubject}`;
    return identities.get(key) ?? null;
  };

  prismaAny.authIdentity.create = async ({ data }: { data: Omit<IdentityRecord, "id" | "createdAt" | "updatedAt"> }) => {
    identityCounter += 1;
    const now = new Date();
    const record: IdentityRecord = {
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

  prismaAny.authIdentity.update = async ({ where, data }: { where: { id: string }; data: Partial<IdentityRecord> }) => {
    const current = Array.from(identities.values()).find((identity) => identity.id === where.id);
    if (!current) {
      throw new Error(`identity ${where.id} not found`);
    }

    const updated: IdentityRecord = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };
    identities.set(`${updated.provider}:${updated.providerSubject}`, updated);
    return updated;
  };

  prismaAny.authIdentity.findFirst = async ({ where }: { where: { managedWalletAddress: string } }) => {
    return (
      Array.from(identities.values()).find(
        (identity) => identity.managedWalletAddress === where.managedWalletAddress,
      ) ?? null
    );
  };

  prismaAny.accountProfile.upsert = async ({
    where,
    update,
    create,
  }: {
    where: { wallet: string };
    update: Partial<AccountProfileRecord>;
    create: Pick<AccountProfileRecord, "wallet" | "role"> & Partial<AccountProfileRecord>;
  }) => {
    const existing = accountProfiles.get(where.wallet);
    const now = new Date();

    if (existing) {
      const updated: AccountProfileRecord = {
        ...existing,
        ...update,
        displayName: update.displayName === undefined ? existing.displayName : update.displayName ?? null,
        updatedAt: now,
      };
      accountProfiles.set(where.wallet, updated);
      return updated;
    }

    accountProfileCounter += 1;
    const record: AccountProfileRecord = {
      id: `account-profile-${accountProfileCounter}`,
      wallet: create.wallet,
      role: create.role,
      displayName: create.displayName ?? null,
      handle: create.handle ?? null,
      onboardingCompletedAt: create.onboardingCompletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    accountProfiles.set(record.wallet, record);
    return record;
  };

  prismaAny.accountProfile.findUnique = async ({ where }: { where: { wallet: string } }) =>
    accountProfiles.get(where.wallet) ?? null;

  prismaAny.$transaction = async (operations: Promise<unknown>[]) => Promise.all(operations);

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
      prismaAny.accountProfile.findUnique = original.accountProfile.findUnique;
      prismaAny.accountProfile.upsert = original.accountProfile.upsert;
      prismaAny.$transaction = original.$transaction;
    },
    accountProfiles,
  };
};

describe("wallet auth service", function () {
  this.timeout(20_000);

  let mockPrisma: ReturnType<typeof installMockAuthPrisma> | null = null;

  beforeEach(() => {
    mockPrisma = installMockAuthPrisma();
  });

  afterEach(() => {
    mockPrisma?.restore();
    mockPrisma = null;
  });

  it("creates a challenge, verifies a wallet signature, and validates the resulting session", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      wallet.secretKey.slice(0, 32),
    );

    const session = await verifyWalletAuthChallenge({
      wallet: walletAddress,
      nonce: challenge.nonce,
      signature: bs58.encode(signature),
    });

    expect(session.wallet).to.equal(walletAddress);
    expect(session.accessToken).to.be.a("string");

    const validated = await verifyWalletSessionToken(session.accessToken);
    expect(validated?.wallet).to.equal(walletAddress);

    await revokeWalletSession(session.accessToken);
    const revoked = await verifyWalletSessionToken(session.accessToken);
    expect(revoked).to.equal(null);
  });

  it("rejects challenge verification when the signature does not match the wallet", async () => {
    const wallet = Keypair.generate();
    const wrongWallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    const challenge = await createWalletAuthChallenge(walletAddress);
    const invalidSignature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      wrongWallet.secretKey.slice(0, 32),
    );

    let thrown: unknown = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature: bs58.encode(invalidSignature),
      });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).to.match(/invalid wallet signature/i);
  });

  it("creates a provider-backed session and reuses the mapped managed wallet", async () => {
    const firstSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.GOOGLE,
      providerSubject: "google-user-1",
      email: "alex@example.com",
      displayName: "Alex Chen",
    });

    const secondSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.GOOGLE,
      providerSubject: "google-user-1",
      email: "alex@example.com",
      displayName: "Alex C.",
    });

    expect(firstSession.wallet).to.equal(secondSession.wallet);
    expect(firstSession.identity.provider).to.equal(IdentityProvider.GOOGLE);
    expect(secondSession.identity.displayName).to.equal("Alex C.");

    const mappedIdentity = await findAuthIdentityByWallet(firstSession.wallet);
    expect(mappedIdentity?.providerSubject).to.equal("google-user-1");

    const validated = await verifyWalletSessionToken(secondSession.accessToken);
    expect(validated?.wallet).to.equal(firstSession.wallet);
  });

  it("binds a provider identity to a user-owned external wallet after wallet challenge verification", async () => {
    const identitySession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "sam@example.com",
      email: "sam@example.com",
      displayName: "Sam",
    });
    const externalWallet = Keypair.generate();
    const walletAddress = externalWallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      externalWallet.secretKey.slice(0, 32),
    );

    const boundSession = await bindExternalWalletToIdentitySession({
      currentAccessToken: identitySession.accessToken,
      wallet: walletAddress,
      nonce: challenge.nonce,
      signature: bs58.encode(signature),
    });

    expect(boundSession.wallet).to.equal(walletAddress);
    expect(boundSession.identity.managedWalletAddress).to.equal(walletAddress);

    const mappedIdentity = await findAuthIdentityByWallet(walletAddress);
    expect(mappedIdentity?.providerSubject).to.equal("sam@example.com");
  });

  it("rejects external wallet binding after managed account onboarding is complete", async () => {
    const identitySession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "onboarded@example.com",
      email: "onboarded@example.com",
      displayName: "Onboarded",
    });
    const currentProfile = mockPrisma?.accountProfiles.get(identitySession.wallet);
    expect(currentProfile).to.not.equal(undefined);
    if (currentProfile) {
      mockPrisma?.accountProfiles.set(identitySession.wallet, {
        ...currentProfile,
        onboardingCompletedAt: new Date(),
      });
    }

    const externalWallet = Keypair.generate();
    const walletAddress = externalWallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      externalWallet.secretKey.slice(0, 32),
    );

    let thrown: any = null;
    try {
      await bindExternalWalletToIdentitySession({
        currentAccessToken: identitySession.accessToken,
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature: bs58.encode(signature),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.status).to.equal(400);
    expect(thrown?.code).to.equal("CANNOT_BIND_ONBOARDED");
  });

  it("rejects external wallet binding when the wallet is already bound to another identity", async () => {
    const firstSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "first@example.com",
      email: "first@example.com",
      displayName: "First",
    });
    const secondSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.GOOGLE,
      providerSubject: "google-second",
      email: "second@example.com",
      displayName: "Second",
    });
    const walletAddress = firstSession.wallet;
    const challenge = await createWalletAuthChallenge(walletAddress);
    const wallet = Keypair.generate();
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      wallet.secretKey.slice(0, 32),
    );

    let thrown: any = null;
    try {
      await bindExternalWalletToIdentitySession({
        currentAccessToken: secondSession.accessToken,
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature: bs58.encode(signature),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.status).to.equal(409);
    expect(thrown?.code).to.equal("WALLET_ALREADY_BOUND");
  });
});

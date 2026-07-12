/**
 * CN: 钱包认证服务测试，覆盖 challenge、签名验证、provider exchange、会话校验和 revoke。
 * EN: Wallet auth service tests covering challenge creation, signature verification, provider exchange, session validation, and revoke.
 */
import { expect } from "chai";
import { ed25519 } from "@noble/curves/ed25519";
import { AccountRole, IdentityProvider, WalletType } from "@prisma/client";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { config } from "../config/default";
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
import { HttpError } from "../src/controllers/http";
import { loadManagedWalletKeypair } from "../src/services/managedWalletService";

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

type AccountWalletRecord = {
  id: string;
  accountProfileId: string;
  walletAddress: string;
  walletType: WalletType;
  isPrimary: boolean;
  label: string | null;
  encryptedSecretKey: Uint8Array | null;
  boundAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const installMockAuthPrisma = () => {
  const challenges = new Map<string, ChallengeRecord>();
  const sessions = new Map<string, SessionRecord>();
  const identities = new Map<string, IdentityRecord>();
  const accountProfiles = new Map<string, AccountProfileRecord>();
  const accountWallets = new Map<string, AccountWalletRecord>();

  let challengeCounter = 0;
  let identityCounter = 0;
  let accountProfileCounter = 0;
  let accountWalletCounter = 0;

  const prismaAny = prisma as any;
  const original = {
    walletAuthChallenge: {
      create: prisma.walletAuthChallenge.create,
      findFirst: prisma.walletAuthChallenge.findFirst,
      updateMany: prisma.walletAuthChallenge.updateMany,
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
      update: prisma.accountProfile.update,
      upsert: prisma.accountProfile.upsert,
    },
    accountWallet: {
      findUnique: prisma.accountWallet.findUnique,
      create: prisma.accountWallet.create,
      update: prisma.accountWallet.update,
      upsert: prisma.accountWallet.upsert,
    },
    $transaction: prismaAny.$transaction,
  };
  let walletSessionCreateFailuresRemaining = 0;
  let accountProfileUpsertFailuresRemaining = 0;
  let transactionQueue: Promise<void> = Promise.resolve();

  const cloneChallenges = () =>
    new Map(Array.from(challenges.entries()).map(([key, value]) => [key, { ...value }]));
  const cloneSessions = () =>
    new Map(Array.from(sessions.entries()).map(([key, value]) => [key, { ...value }]));
  const cloneIdentities = () =>
    new Map(Array.from(identities.entries()).map(([key, value]) => [key, { ...value }]));
  const cloneAccountProfiles = () =>
    new Map(Array.from(accountProfiles.entries()).map(([key, value]) => [key, { ...value }]));
  const cloneAccountWallets = () =>
    new Map(Array.from(accountWallets.entries()).map(([key, value]) => [key, { ...value }]));
  const replaceMap = <T>(target: Map<string, T>, snapshot: Map<string, T>) => {
    target.clear();
    for (const [key, value] of snapshot.entries()) {
      target.set(key, value);
    }
  };
  prismaAny.walletAuthChallenge.create = async ({ data }: { data: Omit<ChallengeRecord, "id" | "createdAt" | "updatedAt"> }) => {
    if (Array.from(challenges.values()).some((challenge) => challenge.nonce === data.nonce)) {
      throw Object.assign(new Error("unique constraint failed for challenge nonce"), {
        code: "P2002",
      });
    }
    challengeCounter += 1;
    const now = new Date();
    const record: ChallengeRecord = {
      id: `challenge-${challengeCounter}`,
      wallet: data.wallet,
      nonce: data.nonce,
      message: data.message,
      expiresAt: data.expiresAt,
      consumedAt: data.consumedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    challenges.set(record.id, record);
    return record;
  };

  prismaAny.walletAuthChallenge.findFirst = async ({
    where,
  }: {
    where: {
      wallet: string;
      nonce?: string;
      consumedAt?: null;
      expiresAt?: { gt: Date };
    };
  }) => {
    const found =
      Array.from(challenges.values()).find(
        (challenge) =>
          challenge.wallet === where.wallet &&
          (where.nonce === undefined || challenge.nonce === where.nonce) &&
          (where.consumedAt !== null || challenge.consumedAt === null) &&
          (!where.expiresAt?.gt || challenge.expiresAt.getTime() > where.expiresAt.gt.getTime()),
      ) ?? null;
    return found ? { ...found } : null;
  };

  prismaAny.walletAuthChallenge.updateMany = async ({
    where,
    data,
  }: {
    where: { id: string; consumedAt?: null; expiresAt?: { gt: Date } };
    data: Partial<ChallengeRecord>;
  }) => {
    const current = challenges.get(where.id);
    if (!current) {
      return { count: 0 };
    }

    if (where.consumedAt === null && current.consumedAt !== null) {
      return { count: 0 };
    }

    if (where.expiresAt?.gt && current.expiresAt.getTime() <= where.expiresAt.gt.getTime()) {
      return { count: 0 };
    }

    challenges.set(where.id, {
      ...current,
      ...data,
      updatedAt: new Date(),
    });
    return { count: 1 };
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

  prismaAny.walletAuthChallenge.deleteMany = async ({
    where,
  }: {
    where?: {
      wallet?: string;
      expiresAt?: { lte: Date };
      OR?: Array<{ consumedAt?: { not: null }; expiresAt?: { lte: Date } }>;
    };
  }) => {
    const removable = Array.from(challenges.values()).filter(
      (challenge) => {
        if (where?.wallet && challenge.wallet !== where.wallet) {
          return false;
        }
        if (where?.expiresAt?.lte) {
          return challenge.expiresAt.getTime() <= where.expiresAt.lte.getTime();
        }
        if (!where?.OR) {
          return true;
        }

        return where.OR.some((condition) =>
          Boolean(
            (condition.consumedAt?.not === null && challenge.consumedAt !== null) ||
            (condition.expiresAt?.lte &&
              challenge.expiresAt.getTime() <= condition.expiresAt.lte.getTime())
          )
        );
      },
    );
    removable.forEach((challenge) => challenges.delete(challenge.id));
    return { count: removable.length };
  };

  prismaAny.walletSession.create = async ({ data }: { data: SessionRecord }) => {
    if (walletSessionCreateFailuresRemaining > 0) {
      walletSessionCreateFailuresRemaining -= 1;
      throw new Error("injected wallet session create failure");
    }

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
    if (accountProfileUpsertFailuresRemaining > 0) {
      accountProfileUpsertFailuresRemaining -= 1;
      throw new Error("injected account profile upsert failure");
    }

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

  prismaAny.accountProfile.update = async ({
    where,
    data,
  }: {
    where: { id: string };
    data: Partial<AccountProfileRecord>;
  }) => {
    const current = Array.from(accountProfiles.values()).find((profile) => profile.id === where.id);
    if (!current) {
      throw new Error(`account profile ${where.id} not found`);
    }

    const updated: AccountProfileRecord = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };
    accountProfiles.delete(current.wallet);
    accountProfiles.set(updated.wallet, updated);
    return updated;
  };

  prismaAny.accountWallet.findUnique = async ({
    where,
    include,
  }: {
    where: { walletAddress: string };
    include?: { accountProfile?: boolean };
  }) => {
    const record = accountWallets.get(where.walletAddress) ?? null;
    if (!record || !include?.accountProfile) {
      return record;
    }

    return {
      ...record,
      accountProfile: Array.from(accountProfiles.values()).find(
        (profile) => profile.id === record.accountProfileId,
      ),
    };
  };

  prismaAny.accountWallet.create = async ({
    data,
  }: {
    data: Pick<AccountWalletRecord, "accountProfileId" | "walletAddress" | "walletType" | "isPrimary"> &
      Partial<Pick<AccountWalletRecord, "encryptedSecretKey">>;
  }) => {
    if (accountWallets.has(data.walletAddress)) {
      throw new Error("wallet already exists");
    }

    accountWalletCounter += 1;
    const now = new Date();
    const record: AccountWalletRecord = {
      id: `account-wallet-${accountWalletCounter}`,
      accountProfileId: data.accountProfileId,
      walletAddress: data.walletAddress,
      walletType: data.walletType,
      isPrimary: data.isPrimary,
      label: null,
      encryptedSecretKey: data.encryptedSecretKey ?? null,
      boundAt: now,
      createdAt: now,
      updatedAt: now,
    };
    accountWallets.set(record.walletAddress, record);
    return record;
  };

  prismaAny.accountWallet.upsert = async ({
    where,
    update,
    create,
  }: {
    where: { walletAddress: string };
    update: Partial<AccountWalletRecord>;
    create: Pick<AccountWalletRecord, "accountProfileId" | "walletAddress" | "walletType" | "isPrimary"> &
      Partial<Pick<AccountWalletRecord, "encryptedSecretKey">>;
  }) => {
    const existing = accountWallets.get(where.walletAddress);
    if (!existing) {
      return prismaAny.accountWallet.create({ data: create });
    }

    const updated: AccountWalletRecord = {
      ...existing,
      ...update,
      updatedAt: new Date(),
    };
    accountWallets.set(where.walletAddress, updated);
    return updated;
  };

  prismaAny.accountWallet.update = async ({
    where,
    data,
  }: {
    where: { walletAddress: string };
    data: Partial<AccountWalletRecord>;
  }) => {
    const existing = accountWallets.get(where.walletAddress);
    if (!existing) {
      throw new Error(`account wallet ${where.walletAddress} not found`);
    }

    const updated: AccountWalletRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    accountWallets.set(where.walletAddress, updated);
    return updated;
  };

  prismaAny.$transaction = async (
    operations:
      | Promise<unknown>[]
      | ((tx: typeof prismaAny) => Promise<unknown>)
  ) => {
    if (typeof operations !== "function") {
      return Promise.all(operations);
    }

    const run = async () => {
      const challengeSnapshot = cloneChallenges();
      const sessionSnapshot = cloneSessions();
      const identitySnapshot = cloneIdentities();
      const accountProfileSnapshot = cloneAccountProfiles();
      const accountWalletSnapshot = cloneAccountWallets();

      try {
        return await operations(prismaAny);
      } catch (error) {
        replaceMap(challenges, challengeSnapshot);
        replaceMap(sessions, sessionSnapshot);
        replaceMap(identities, identitySnapshot);
        replaceMap(accountProfiles, accountProfileSnapshot);
        replaceMap(accountWallets, accountWalletSnapshot);
        throw error;
      }
    };

    const result = transactionQueue.then(run, run);
    transactionQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return {
    restore: () => {
      prismaAny.walletAuthChallenge.create = original.walletAuthChallenge.create;
      prismaAny.walletAuthChallenge.findFirst = original.walletAuthChallenge.findFirst;
      prismaAny.walletAuthChallenge.updateMany = original.walletAuthChallenge.updateMany;
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
      prismaAny.accountProfile.update = original.accountProfile.update;
      prismaAny.accountProfile.upsert = original.accountProfile.upsert;
      prismaAny.accountWallet.findUnique = original.accountWallet.findUnique;
      prismaAny.accountWallet.create = original.accountWallet.create;
      prismaAny.accountWallet.update = original.accountWallet.update;
      prismaAny.accountWallet.upsert = original.accountWallet.upsert;
      prismaAny.$transaction = original.$transaction;
    },
    challenges,
    sessions,
    accountProfiles,
    accountWallets,
    failNextWalletSessionCreates: (count = 1) => {
      walletSessionCreateFailuresRemaining = count;
    },
    failNextAccountProfileUpserts: (count = 1) => {
      accountProfileUpsertFailuresRemaining = count;
    },
  };
};

describe("wallet auth service", function () {
  this.timeout(20_000);

  let mockPrisma: ReturnType<typeof installMockAuthPrisma> | null = null;

  beforeEach(() => {
    config.managedWallet.encryptionKey = "0".repeat(64);
    config.solana.isDevnet = false;
    config.pilot.inviteOnly = false;
    config.pilot.inviteWallets = [];
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
    expect(mockPrisma?.accountWallets.get(walletAddress)?.walletType).to.equal(WalletType.EXTERNAL);
    expect(mockPrisma?.accountWallets.get(walletAddress)?.isPrimary).to.equal(true);

    await revokeWalletSession(session.accessToken);
    const revoked = await verifyWalletSessionToken(session.accessToken);
    expect(revoked).to.equal(null);
  });

  it("allows an invited wallet through the normal challenge/signature/session flow", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [walletAddress];

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
    const validated = await verifyWalletSessionToken(session.accessToken);

    expect(session.wallet).to.equal(walletAddress);
    expect(validated?.wallet).to.equal(walletAddress);
  });

  it("issues indistinguishable random stateless challenges without database writes", async () => {
    const invitedWallet = Keypair.generate();
    const invitedAddress = invitedWallet.publicKey.toBase58();
    const uninvitedAddress = Keypair.generate().publicKey.toBase58();
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [invitedAddress];

    const uninvitedFirst = await createWalletAuthChallenge(uninvitedAddress);
    const uninvitedSecond = await createWalletAuthChallenge(uninvitedAddress);
    const invitedFirst = await createWalletAuthChallenge(invitedAddress);
    const invitedSecond = await createWalletAuthChallenge(invitedAddress);

    expect(uninvitedFirst.wallet).to.equal(uninvitedAddress);
    expect(uninvitedFirst.message).to.include(`Wallet: ${uninvitedAddress}`);
    expect(uninvitedFirst.expiresAt).to.be.instanceOf(Date);
    expect(uninvitedFirst.expiresAt.getTime() - Date.now()).to.be.greaterThan(
      config.auth.challengeTtlSeconds * 1000 * 0.89
    );
    expect(uninvitedFirst.nonce).not.to.equal(uninvitedSecond.nonce);
    expect(invitedFirst.nonce).not.to.equal(invitedSecond.nonce);
    expect(Object.keys(invitedFirst).sort()).to.deep.equal(Object.keys(uninvitedFirst).sort());
    for (const challenge of [uninvitedFirst, uninvitedSecond, invitedFirst, invitedSecond]) {
      expect(challenge.challengeId).to.match(/^[0-9a-f-]{36}$/i);
      expect(challenge.nonce.split(".")).to.have.length(2);
    }
    expect(mockPrisma?.challenges.size).to.equal(0);
  });

  it("rejects a valid uninvited signature without writing a receipt or session", async () => {
    const invitedAddress = Keypair.generate().publicKey.toBase58();
    const uninvitedWallet = Keypair.generate();
    const uninvitedAddress = uninvitedWallet.publicKey.toBase58();
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [invitedAddress];
    const challenge = await createWalletAuthChallenge(uninvitedAddress);
    const signature = bs58.encode(
      ed25519.sign(Buffer.from(challenge.message, "utf8"), uninvitedWallet.secretKey.slice(0, 32))
    );

    let verifyError: any = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: uninvitedAddress,
        nonce: challenge.nonce,
        signature,
      });
    } catch (error) {
      verifyError = error;
    }
    expect(verifyError).to.be.instanceOf(HttpError);
    expect(verifyError.code).to.equal("PILOT_INVITE_REQUIRED");
    expect(mockPrisma?.challenges.size).to.equal(0);
    expect(mockPrisma?.sessions.size).to.equal(0);
  });

  it("enforces the invite allowlist after a valid challenge signature", async () => {
    const invitedWallet = Keypair.generate();
    const invitedAddress = invitedWallet.publicKey.toBase58();
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [invitedAddress];

    const challenge = await createWalletAuthChallenge(invitedAddress);
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      invitedWallet.secretKey.slice(0, 32),
    );
    config.pilot.inviteWallets = [];

    let verifyError: any = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: invitedAddress,
        nonce: challenge.nonce,
        signature: bs58.encode(signature),
      });
    } catch (error) {
      verifyError = error;
    }

    expect(verifyError).to.be.instanceOf(HttpError);
    expect(verifyError.status).to.equal(403);
    expect(verifyError.code).to.equal("PILOT_INVITE_REQUIRED");
    expect(mockPrisma?.sessions.size).to.equal(0);
  });

  it("invalidates an existing session when the wallet is removed from the invite allowlist", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [walletAddress];

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

    expect(await verifyWalletSessionToken(session.accessToken)).not.to.equal(null);
    config.pilot.inviteWallets = [];
    expect(await verifyWalletSessionToken(session.accessToken)).to.equal(null);
  });

  it("rejects an allowlisted managed-wallet session while the Pilot is external-wallet-only", async () => {
    const managedSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "managed-not-pilot@example.com",
      email: "managed-not-pilot@example.com",
      displayName: "Managed Not Pilot",
    });

    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [managedSession.wallet];

    expect(await verifyWalletSessionToken(managedSession.accessToken)).to.equal(null);
  });

  it("does not issue an external Pilot session for a wallet already registered as managed", async () => {
    const managedSession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "managed-wallet-conflict@example.com",
      email: "managed-wallet-conflict@example.com",
      displayName: "Managed Wallet Conflict",
    });
    const managedKeypair = await loadManagedWalletKeypair(managedSession.wallet);
    if (!managedKeypair) {
      throw new Error("expected managed wallet keypair");
    }

    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [managedSession.wallet];
    const challenge = await createWalletAuthChallenge(managedSession.wallet);
    const signature = bs58.encode(
      ed25519.sign(
        Buffer.from(challenge.message, "utf8"),
        managedKeypair.secretKey.slice(0, 32)
      )
    );

    let thrown: unknown = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: managedSession.wallet,
        nonce: challenge.nonce,
        signature,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(HttpError);
    expect((thrown as HttpError).code).to.equal("WALLET_TYPE_CONFLICT");
    expect(mockPrisma?.sessions.size).to.equal(1);
    expect(mockPrisma?.challenges.size).to.equal(0);
  });

  it("atomically consumes one signed wallet challenge under concurrent replay", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = bs58.encode(
      ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32))
    );

    const results = await Promise.allSettled([
      verifyWalletAuthChallenge({ wallet: walletAddress, nonce: challenge.nonce, signature }),
      verifyWalletAuthChallenge({ wallet: walletAddress, nonce: challenge.nonce, signature }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).to.have.length(1);
    expect(results.filter((result) => result.status === "rejected")).to.have.length(1);
    expect(mockPrisma?.sessions.size).to.equal(1);
    expect(Array.from(mockPrisma?.challenges.values() ?? [])[0]?.consumedAt).to.be.instanceOf(Date);
  });

  it("cannot use an old signature with a newly issued nonce", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const first = await createWalletAuthChallenge(walletAddress);
    const oldSignature = bs58.encode(
      ed25519.sign(Buffer.from(first.message, "utf8"), wallet.secretKey.slice(0, 32))
    );

    const replacement = await createWalletAuthChallenge(walletAddress);
    expect(replacement.nonce).not.to.equal(first.nonce);
    expect(replacement.message).not.to.equal(first.message);

    let replayError: unknown = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: replacement.nonce,
        signature: oldSignature,
      });
    } catch (error) {
      replayError = error;
    }
    expect(String(replayError)).to.match(/invalid wallet signature/i);
    expect(mockPrisma?.sessions.size).to.equal(0);
  });

  it("rejects expired and tampered stateless challenge tokens", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = bs58.encode(
      ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32))
    );

    const tamperedNonce = `${challenge.nonce.slice(0, -1)}${challenge.nonce.endsWith("A") ? "B" : "A"}`;
    let tamperedError: unknown = null;
    try {
      await verifyWalletAuthChallenge({ wallet: walletAddress, nonce: tamperedNonce, signature });
    } catch (error) {
      tamperedError = error;
    }
    expect(String(tamperedError)).to.match(/auth challenge is invalid/i);

    const originalDateNow = Date.now;
    Date.now = () => challenge.expiresAt.getTime() + 1;
    let expiredError: unknown = null;
    try {
      await verifyWalletAuthChallenge({ wallet: walletAddress, nonce: challenge.nonce, signature });
    } catch (error) {
      expiredError = error;
    } finally {
      Date.now = originalDateNow;
    }
    expect(String(expiredError)).to.match(/auth challenge has expired/i);
    expect(mockPrisma?.challenges.size).to.equal(0);
    expect(mockPrisma?.sessions.size).to.equal(0);
  });

  it("rolls back the challenge claim if wallet session creation fails", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = bs58.encode(
      ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32))
    );

    mockPrisma?.failNextWalletSessionCreates();
    let thrown: unknown = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature,
      });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).to.match(/injected wallet session create failure/);
    expect(mockPrisma?.sessions.size).to.equal(0);
    expect(mockPrisma?.challenges.size).to.equal(0);

    const session = await verifyWalletAuthChallenge({
      wallet: walletAddress,
      nonce: challenge.nonce,
      signature,
    });
    expect(session.wallet).to.equal(walletAddress);
    expect(mockPrisma?.sessions.size).to.equal(1);
  });

  it("rolls back the challenge and session when external account creation fails", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = bs58.encode(
      ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32))
    );

    mockPrisma?.failNextAccountProfileUpserts();
    let thrown: unknown = null;
    try {
      await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature,
      });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).to.match(/injected account profile upsert failure/);
    expect(mockPrisma?.sessions.size).to.equal(0);
    expect(mockPrisma?.accountProfiles.size).to.equal(0);
    expect(mockPrisma?.accountWallets.size).to.equal(0);
    expect(mockPrisma?.challenges.size).to.equal(0);

    const session = await verifyWalletAuthChallenge({
      wallet: walletAddress,
      nonce: challenge.nonce,
      signature,
    });
    expect(session.wallet).to.equal(walletAddress);
    expect(mockPrisma?.sessions.size).to.equal(1);
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
    const managedWalletRecord = mockPrisma?.accountWallets.get(firstSession.wallet);
    expect(managedWalletRecord?.walletType).to.equal(WalletType.MANAGED);
    expect(managedWalletRecord?.encryptedSecretKey).to.be.instanceOf(Uint8Array);
    const loadedKeypair = await loadManagedWalletKeypair(firstSession.wallet);
    expect(loadedKeypair?.publicKey.toBase58()).to.equal(firstSession.wallet);
  });

  it("binds a provider identity to a user-owned external wallet without replacing the managed profile", async () => {
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
    expect(boundSession.identity.managedWalletAddress).to.equal(identitySession.wallet);

    const mappedIdentity = await findAuthIdentityByWallet(walletAddress);
    expect(mappedIdentity?.providerSubject).to.equal("sam@example.com");

    const managedProfile = mockPrisma?.accountProfiles.get(identitySession.wallet);
    const externalBinding = mockPrisma?.accountWallets.get(walletAddress);
    expect(externalBinding?.accountProfileId).to.equal(managedProfile?.id);
    expect(externalBinding?.walletType).to.equal(WalletType.EXTERNAL);
    expect(externalBinding?.isPrimary).to.equal(false);
  });

  it("rejects provider-to-wallet binding once invite-only mode invalidates the managed session", async () => {
    const identitySession = await exchangeProviderIdentitySession({
      provider: IdentityProvider.EMAIL,
      providerSubject: "pilot-bind@example.com",
      email: "pilot-bind@example.com",
      displayName: "Pilot Bind",
    });
    const externalWallet = Keypair.generate();
    const walletAddress = externalWallet.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge(walletAddress);
    const signature = ed25519.sign(
      Buffer.from(challenge.message, "utf8"),
      externalWallet.secretKey.slice(0, 32),
    );
    config.pilot.inviteOnly = true;
    config.pilot.inviteWallets = [identitySession.wallet];

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

    expect(String(thrown)).to.match(/current identity session is invalid or expired/i);
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

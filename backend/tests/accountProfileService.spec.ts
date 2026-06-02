import { expect } from "chai";
import { AccountRole, IdentityProvider, WalletType } from "@prisma/client";

import { prisma } from "../src/services/prisma";
import {
  getOrCreateAccountProfile,
  serializeAccountProfile,
  updateAccountProfile,
} from "../src/services/accountProfile";

type ProfileRecord = {
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

const installMockAccountProfilePrisma = () => {
  const profiles = new Map<string, ProfileRecord>();
  const accountWallets = new Map<string, AccountWalletRecord>();
  let counter = 0;
  let accountWalletCounter = 0;
  const prismaAny = prisma as any;
  const original = {
    accountProfile: {
      findUnique: prisma.accountProfile.findUnique,
      create: prisma.accountProfile.create,
      update: prisma.accountProfile.update,
      upsert: prisma.accountProfile.upsert,
    },
    accountWallet: {
      findUnique: prisma.accountWallet.findUnique,
      upsert: prisma.accountWallet.upsert,
    },
  };

  prismaAny.accountProfile.findUnique = async ({ where }: { where: { wallet: string } }) =>
    profiles.get(where.wallet) ?? null;

  prismaAny.accountProfile.create = async ({ data }: { data: Partial<ProfileRecord> & { wallet: string } }) => {
    counter += 1;
    const now = new Date();
    const record: ProfileRecord = {
      id: `profile-${counter}`,
      wallet: data.wallet,
      role: data.role ?? AccountRole.FAN,
      displayName: data.displayName ?? null,
      handle: data.handle ?? null,
      onboardingCompletedAt: data.onboardingCompletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    profiles.set(record.wallet, record);
    return record;
  };

  prismaAny.accountProfile.update = async ({
    where,
    data,
  }: {
    where: { id: string };
    data: Partial<ProfileRecord>;
  }) => {
    const existing = Array.from(profiles.values()).find((profile) => profile.id === where.id);
    if (!existing) {
      throw new Error(`profile ${where.id} not found`);
    }

    const updated: ProfileRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    profiles.delete(existing.wallet);
    profiles.set(updated.wallet, updated);
    return updated;
  };

  prismaAny.accountProfile.upsert = async ({
    where,
    create,
    update,
  }: {
    where: { wallet: string };
    create: Partial<ProfileRecord> & { wallet: string };
    update: Partial<ProfileRecord>;
  }) => {
    const existing = profiles.get(where.wallet);
    if (!existing) {
      return prismaAny.accountProfile.create({ data: create });
    }

    const updated: ProfileRecord = {
      ...existing,
      ...update,
      updatedAt: new Date(),
    };
    profiles.set(where.wallet, updated);
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
      accountProfile: Array.from(profiles.values()).find(
        (profile) => profile.id === record.accountProfileId,
      ),
    };
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
    if (existing) {
      const updated: AccountWalletRecord = {
        ...existing,
        ...update,
        updatedAt: new Date(),
      };
      accountWallets.set(where.walletAddress, updated);
      return updated;
    }

    accountWalletCounter += 1;
    const now = new Date();
    const record: AccountWalletRecord = {
      id: `account-wallet-${accountWalletCounter}`,
      accountProfileId: create.accountProfileId,
      walletAddress: create.walletAddress,
      walletType: create.walletType,
      isPrimary: create.isPrimary,
      label: null,
      encryptedSecretKey: create.encryptedSecretKey ?? null,
      boundAt: now,
      createdAt: now,
      updatedAt: now,
    };
    accountWallets.set(record.walletAddress, record);
    return record;
  };

  return {
    accountWallets,
    restore: () => {
      prismaAny.accountProfile.findUnique = original.accountProfile.findUnique;
      prismaAny.accountProfile.create = original.accountProfile.create;
      prismaAny.accountProfile.update = original.accountProfile.update;
      prismaAny.accountProfile.upsert = original.accountProfile.upsert;
      prismaAny.accountWallet.findUnique = original.accountWallet.findUnique;
      prismaAny.accountWallet.upsert = original.accountWallet.upsert;
    },
  };
};

describe("accountProfile service", () => {
  it("creates a default profile from the session identity", async () => {
    const mock = installMockAccountProfilePrisma();
    try {
      const profile = await getOrCreateAccountProfile("wallet-1", {
        id: "identity-1",
        provider: IdentityProvider.EMAIL,
        providerSubject: "jane@example.com",
        email: "jane@example.com",
        displayName: "Jane Creator",
        managedWalletAddress: "wallet-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(profile.role).to.equal(AccountRole.FAN);
      expect(profile.displayName).to.equal("Jane Creator");
      expect(mock.accountWallets.get("wallet-1")?.walletType).to.equal(WalletType.MANAGED);
      expect(mock.accountWallets.get("wallet-1")?.isPrimary).to.equal(true);
    } finally {
      mock.restore();
    }
  });

  it("updates role, handle, and onboarding completion", async () => {
    const mock = installMockAccountProfilePrisma();
    try {
      const profile = await updateAccountProfile("wallet-2", null, {
        role: AccountRole.SPONSOR,
        displayName: "Grid Labs",
        handle: "grid-labs",
        completeOnboarding: true,
      });
      const serialized = serializeAccountProfile(profile);

      expect(serialized.role).to.equal("SPONSOR");
      expect(serialized.handle).to.equal("grid-labs");
      expect(serialized.onboardingCompletedAt).to.be.a("string");
      expect(mock.accountWallets.get("wallet-2")?.walletType).to.equal(WalletType.EXTERNAL);
    } finally {
      mock.restore();
    }
  });
});

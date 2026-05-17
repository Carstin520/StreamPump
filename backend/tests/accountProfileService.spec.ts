import { expect } from "chai";
import { AccountRole, IdentityProvider } from "@prisma/client";

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

const installMockAccountProfilePrisma = () => {
  const profiles = new Map<string, ProfileRecord>();
  let counter = 0;
  const prismaAny = prisma as any;
  const original = {
    accountProfile: {
      findUnique: prisma.accountProfile.findUnique,
      create: prisma.accountProfile.create,
      upsert: prisma.accountProfile.upsert,
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

  return () => {
    prismaAny.accountProfile.findUnique = original.accountProfile.findUnique;
    prismaAny.accountProfile.create = original.accountProfile.create;
    prismaAny.accountProfile.upsert = original.accountProfile.upsert;
  };
};

describe("accountProfile service", () => {
  it("creates a default profile from the session identity", async () => {
    const restore = installMockAccountProfilePrisma();
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
    } finally {
      restore();
    }
  });

  it("updates role, handle, and onboarding completion", async () => {
    const restore = installMockAccountProfilePrisma();
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
    } finally {
      restore();
    }
  });
});

import {
  AccountProfile,
  AccountRole,
  AuthIdentity,
  Prisma,
  WalletType,
} from "@prisma/client";

import { prisma } from "./prisma";

export type SerializedAccountIdentity = {
  id: string;
  provider: AuthIdentity["provider"];
  providerSubject: string;
  email: string | null;
  displayName: string | null;
  managedWalletAddress: string;
};

export type SerializedAccountProfile = {
  id: string;
  wallet: string;
  role: AccountRole;
  displayName: string | null;
  handle: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountProfileInput = {
  role: AccountRole;
  displayName: string | null;
  handle: string | null;
  completeOnboarding: boolean;
};

const shortenWallet = (wallet: string) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

const defaultDisplayName = (wallet: string, identity: AuthIdentity | null) =>
  identity?.displayName?.trim() ||
  identity?.email?.split("@")[0]?.trim() ||
  `Wallet ${shortenWallet(wallet)}`;

const walletTypeForSessionWallet = (
  wallet: string,
  identity: AuthIdentity | null
): WalletType =>
  identity?.managedWalletAddress === wallet ? WalletType.MANAGED : WalletType.EXTERNAL;

export const serializeAccountIdentity = (
  identity: AuthIdentity | null
): SerializedAccountIdentity | null =>
  identity
    ? {
        id: identity.id,
        provider: identity.provider,
        providerSubject: identity.providerSubject,
        email: identity.email,
        displayName: identity.displayName,
        managedWalletAddress: identity.managedWalletAddress,
      }
    : null;

export const serializeAccountProfile = (
  profile: AccountProfile
): SerializedAccountProfile => ({
  id: profile.id,
  wallet: profile.wallet,
  role: profile.role,
  displayName: profile.displayName,
  handle: profile.handle,
  onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const isAccountProfileStorageError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

export const resolveAccountProfileByWallet = async (
  wallet: string
): Promise<AccountProfile | null> => {
  const boundWallet = await prisma.accountWallet.findUnique({
    where: { walletAddress: wallet },
    include: { accountProfile: true },
  });

  if (boundWallet) {
    return boundWallet.accountProfile;
  }

  return prisma.accountProfile.findUnique({
    where: { wallet },
  });
};

const ensurePrimaryWalletBinding = async (
  profile: AccountProfile,
  walletType: WalletType
) => {
  await prisma.accountWallet.upsert({
    where: { walletAddress: profile.wallet },
    update: {
      accountProfileId: profile.id,
      walletType,
      isPrimary: true,
    },
    create: {
      accountProfileId: profile.id,
      walletAddress: profile.wallet,
      walletType,
      isPrimary: true,
    },
  });
};

export const getOrCreateAccountProfile = async (
  wallet: string,
  identity: AuthIdentity | null
) => {
  const existing = await resolveAccountProfileByWallet(wallet);

  if (existing) {
    await ensurePrimaryWalletBinding(existing, walletTypeForSessionWallet(existing.wallet, identity));
    return existing;
  }

  const profile = await prisma.accountProfile.create({
    data: {
      wallet,
      displayName: defaultDisplayName(wallet, identity),
    },
  });

  await ensurePrimaryWalletBinding(profile, walletTypeForSessionWallet(wallet, identity));

  return profile;
};

export const updateAccountProfile = async (
  wallet: string,
  identity: AuthIdentity | null,
  input: AccountProfileInput
) => {
  const onboardingCompletedAt = input.completeOnboarding ? new Date() : undefined;
  const existing = await resolveAccountProfileByWallet(wallet);

  if (existing) {
    const updated = await prisma.accountProfile.update({
      where: { id: existing.id },
      data: {
        role: input.role,
        displayName: input.displayName ?? defaultDisplayName(existing.wallet, identity),
        handle: input.handle,
        ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
      },
    });

    await ensurePrimaryWalletBinding(
      updated,
      walletTypeForSessionWallet(updated.wallet, identity)
    );

    return updated;
  }

  const profile = await prisma.accountProfile.upsert({
    where: { wallet },
    create: {
      wallet,
      role: input.role,
      displayName: input.displayName ?? defaultDisplayName(wallet, identity),
      handle: input.handle,
      onboardingCompletedAt: onboardingCompletedAt ?? null,
    },
    update: {
      role: input.role,
      displayName: input.displayName ?? defaultDisplayName(wallet, identity),
      handle: input.handle,
      ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
    },
  });

  await ensurePrimaryWalletBinding(profile, walletTypeForSessionWallet(wallet, identity));

  return profile;
};

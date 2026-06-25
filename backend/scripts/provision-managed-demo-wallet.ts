import "../config/loadEnv";

import bs58 from "bs58";
import { AccountRole, IdentityProvider, WalletType } from "@prisma/client";
import { Keypair, PublicKey } from "@solana/web3.js";

import { isManagedWallet } from "../src/services/managedWalletService";
import { prisma } from "../src/services/prisma";
import { encryptSecretKey } from "../src/services/walletEncryption";

const DEFAULT_DEMO_MANAGED_WALLET = "HTso2VWboA92KSKbHRXR5vvGjwGqcZtSD4rKSD4hAn7W";
const DEFAULT_PROVIDER_SUBJECT = "managed-demo@streampump.local";

const readRequired = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const parseKeypairSecret = (): Keypair => {
  const base58Secret = process.env.DEMO_MANAGED_WALLET_SECRET_BASE58?.trim();
  if (base58Secret) {
    return Keypair.fromSecretKey(bs58.decode(base58Secret));
  }

  const jsonSecret = process.env.DEMO_MANAGED_WALLET_SECRET_KEY?.trim();
  if (jsonSecret) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(jsonSecret) as number[]));
  }

  throw new Error("DEMO_MANAGED_WALLET_SECRET_BASE58 or DEMO_MANAGED_WALLET_SECRET_KEY is required");
};

const parseProvider = (value: string | undefined): IdentityProvider => {
  const provider = value?.trim().toUpperCase() || IdentityProvider.EMAIL;
  if (!Object.values(IdentityProvider).includes(provider as IdentityProvider)) {
    throw new Error(`DEMO_MANAGED_WALLET_PROVIDER must be one of: ${Object.values(IdentityProvider).join(", ")}`);
  }
  return provider as IdentityProvider;
};

const main = async () => {
  readRequired("MANAGED_WALLET_ENCRYPTION_KEY");

  const walletAddress = new PublicKey(
    process.env.DEMO_MANAGED_WALLET_ADDRESS?.trim() || DEFAULT_DEMO_MANAGED_WALLET
  ).toBase58();
  const keypair = parseKeypairSecret();

  if (keypair.publicKey.toBase58() !== walletAddress) {
    throw new Error(
      `DEMO_MANAGED_WALLET secret resolves to ${keypair.publicKey.toBase58()}, expected ${walletAddress}`
    );
  }

  const provider = parseProvider(process.env.DEMO_MANAGED_WALLET_PROVIDER);
  const providerSubject =
    process.env.DEMO_MANAGED_WALLET_PROVIDER_SUBJECT?.trim() || DEFAULT_PROVIDER_SUBJECT;
  const displayName = process.env.DEMO_MANAGED_WALLET_DISPLAY_NAME?.trim() || "Platform Wallet";
  const email = provider === IdentityProvider.EMAIL ? providerSubject : null;
  const encryptedSecretKey = encryptSecretKey(keypair.secretKey);

  const profile = await prisma.accountProfile.upsert({
    where: { wallet: walletAddress },
    update: {
      role: AccountRole.FAN,
      displayName,
    },
    create: {
      wallet: walletAddress,
      role: AccountRole.FAN,
      displayName,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.accountWallet.upsert({
    where: { walletAddress },
    update: {
      accountProfileId: profile.id,
      walletType: WalletType.MANAGED,
      isPrimary: true,
      label: "Devnet managed demo wallet",
      encryptedSecretKey,
    },
    create: {
      accountProfileId: profile.id,
      walletAddress,
      walletType: WalletType.MANAGED,
      isPrimary: true,
      label: "Devnet managed demo wallet",
      encryptedSecretKey,
    },
  });

  const identity = await prisma.authIdentity.upsert({
    where: {
      provider_providerSubject: {
        provider,
        providerSubject,
      },
    },
    update: {
      email,
      displayName,
      managedWalletAddress: walletAddress,
    },
    create: {
      provider,
      providerSubject,
      email,
      displayName,
      managedWalletAddress: walletAddress,
    },
  });

  const executable = await isManagedWallet(walletAddress);
  if (!executable) {
    throw new Error(`isManagedWallet(${walletAddress}) returned false after provisioning`);
  }

  console.log(
    JSON.stringify(
      {
        walletAddress,
        accountProfileId: profile.id,
        authIdentityId: identity.id,
        provider,
        providerSubject,
        isManagedWallet: executable,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error("[provision-managed-demo-wallet] failed");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

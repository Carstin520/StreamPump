import {
  AccountRole,
  IdentityProvider,
  ManagedWalletPoolStatus,
  WalletType,
} from "@prisma/client";
import { Keypair } from "@solana/web3.js";

import { prisma } from "../src/services/prisma";
import { encryptSecretKey } from "../src/services/walletEncryption";

const parseTargetSize = (): number => {
  const fromArg = process.argv.find((arg) => arg.startsWith("--target="))?.split("=", 2)[1];
  const raw = fromArg ?? process.env.MANAGED_WALLET_POOL_SIZE ?? "200";
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 500) {
    throw new Error("MANAGED_WALLET_POOL_SIZE/--target must be an integer between 1 and 500");
  }

  return parsed;
};

const main = async (): Promise<void> => {
  const targetSize = parseTargetSize();
  const existingPoolWallets = await prisma.accountWallet.count({
    where: {
      walletType: WalletType.MANAGED,
      poolStatus: {
        in: [
          ManagedWalletPoolStatus.AVAILABLE,
          ManagedWalletPoolStatus.ASSIGNED,
          ManagedWalletPoolStatus.USED,
        ],
      },
    },
  });
  const createCount = Math.max(0, targetSize - existingPoolWallets);
  const createdAddresses: string[] = [];

  for (let index = 0; index < createCount; index += 1) {
    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const profile = await prisma.accountProfile.create({
      data: {
        wallet,
        role: AccountRole.FAN,
        displayName: "Demo Guest",
      },
    });

    await prisma.accountWallet.create({
      data: {
        accountProfileId: profile.id,
        walletAddress: wallet,
        walletType: WalletType.MANAGED,
        isPrimary: true,
        label: "Demo day managed wallet",
        encryptedSecretKey: encryptSecretKey(keypair.secretKey),
        poolStatus: ManagedWalletPoolStatus.AVAILABLE,
      },
    });
    await prisma.authIdentity.create({
      data: {
        provider: IdentityProvider.EMAIL,
        providerSubject: `managed-pool:${wallet}`,
        displayName: "Demo Guest",
        managedWalletAddress: wallet,
      },
    });
    createdAddresses.push(wallet);
  }

  console.log(
    JSON.stringify(
      {
        targetSize,
        existingPoolWallets,
        createdCount: createCount,
        createdAddresses,
        nextStep:
          "Fund these public addresses from the demo treasury before demo day; no secret keys were written or printed.",
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

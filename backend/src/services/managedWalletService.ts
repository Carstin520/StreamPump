import { Keypair } from "@solana/web3.js";
import { WalletType } from "@prisma/client";

import { prisma } from "./prisma";
import { decryptSecretKey } from "./walletEncryption";

export class ManagedWalletSecretMissingError extends Error {
  constructor(walletAddress: string) {
    super(`managed wallet ${walletAddress} is missing encrypted secret key`);
    this.name = "ManagedWalletSecretMissingError";
  }
}

export const loadManagedWalletKeypair = async (
  walletAddress: string
): Promise<Keypair | null> => {
  const accountWallet = await prisma.accountWallet.findUnique({
    where: { walletAddress },
  });

  if (!accountWallet || accountWallet.walletType !== WalletType.MANAGED) {
    return null;
  }

  if (!accountWallet.encryptedSecretKey) {
    throw new ManagedWalletSecretMissingError(walletAddress);
  }

  const secretKey = decryptSecretKey(accountWallet.encryptedSecretKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  if (keypair.publicKey.toBase58() !== walletAddress) {
    throw new Error("Managed wallet keypair mismatch after decryption");
  }

  return keypair;
};

export const isManagedWallet = async (walletAddress: string): Promise<boolean> => {
  const accountWallet = await prisma.accountWallet.findUnique({
    where: { walletAddress },
    select: { encryptedSecretKey: true, walletType: true },
  });

  return accountWallet?.walletType === WalletType.MANAGED && Boolean(accountWallet.encryptedSecretKey);
};

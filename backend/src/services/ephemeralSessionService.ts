import { createHmac } from "crypto";

import { AccountRole, IdentityProvider, ManagedWalletPoolStatus, WalletType } from "@prisma/client";

import { config } from "../../config/default";
import { HttpError } from "../controllers/http";
import { createWalletSession } from "./auth";
import { prisma } from "./prisma";

const normalizeSubject = (subject: string): string => subject.trim().toLowerCase();

const hashEphemeralSubject = (subject: string): string =>
  createHmac("sha256", config.auth.sessionSecret)
    .update(`ephemeral-session:${normalizeSubject(subject)}`, "utf8")
    .digest("hex");

export const createEphemeralSessionFromPool = async (params: {
  subject: string;
}): Promise<{
  wallet: string;
  accessToken: string;
  created: boolean;
  identity: {
    id: string;
    managedWalletAddress: string;
  };
}> => {
  const normalizedSubject = normalizeSubject(params.subject);
  if (!normalizedSubject || normalizedSubject.length > 160) {
    throw new HttpError(400, "INVALID_INPUT", "subject is required and must be at most 160 chars");
  }

  const subjectHash = hashEphemeralSubject(normalizedSubject);
  const providerSubject = `ephemeral:${subjectHash}`;
  const allocated = await prisma.$transaction(async (tx) => {
    const existingIdentity = await tx.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.EMAIL,
          providerSubject,
        },
      },
    });

    if (existingIdentity) {
      return {
        created: false,
        wallet: existingIdentity.managedWalletAddress,
        identity: existingIdentity,
      };
    }

    const availableWallets = await tx.$queryRaw<{ id: string; walletAddress: string }[]>`
      SELECT "id", "walletAddress"
      FROM "AccountWallet"
      WHERE "walletType"::text = ${WalletType.MANAGED}
        AND "poolStatus"::text = ${ManagedWalletPoolStatus.AVAILABLE}
        AND "encryptedSecretKey" IS NOT NULL
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const availableWallet = availableWallets[0];
    if (!availableWallet) {
      throw new HttpError(503, "MANAGED_WALLET_POOL_EMPTY", "no available managed wallet in pool");
    }

    const now = new Date();
    const wallet = await tx.accountWallet.update({
      where: { id: availableWallet.id },
      data: {
        poolStatus: ManagedWalletPoolStatus.ASSIGNED,
        poolSubjectHash: subjectHash,
        poolAssignedAt: now,
        label: "Demo day managed wallet",
      },
    });

    await tx.accountProfile.update({
      where: { id: wallet.accountProfileId },
      data: {
        role: AccountRole.FAN,
        displayName: "Demo Guest",
      },
    });

    const existingPoolIdentity = await tx.authIdentity.findUnique({
      where: {
        managedWalletAddress: wallet.walletAddress,
      },
    });
    const identity = existingPoolIdentity
      ? await tx.authIdentity.update({
          where: { id: existingPoolIdentity.id },
          data: {
            provider: IdentityProvider.EMAIL,
            providerSubject,
            displayName: "Demo Guest",
          },
        })
      : await tx.authIdentity.create({
          data: {
            provider: IdentityProvider.EMAIL,
            providerSubject,
            displayName: "Demo Guest",
            managedWalletAddress: wallet.walletAddress,
          },
        });

    return {
      created: true,
      wallet: wallet.walletAddress,
      identity,
    };
  });

  const session = await createWalletSession(allocated.wallet);

  return {
    wallet: session.wallet,
    accessToken: session.accessToken,
    created: allocated.created,
    identity: {
      id: allocated.identity.id,
      managedWalletAddress: allocated.identity.managedWalletAddress,
    },
  };
};

export const buildEphemeralSubjectRateLimitKey = (subject: string): string =>
  `ephemeral-subject:${hashEphemeralSubject(subject)}`;

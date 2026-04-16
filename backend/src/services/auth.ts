/**
 * CN: 钱包认证服务，提供 challenge/signature 登录、会话令牌签发与 Bearer 校验。
 * EN: Wallet authentication service providing challenge/signature login, session token issuance, and Bearer verification.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";

import { ed25519 } from "@noble/curves/ed25519";
import { IdentityProvider } from "@prisma/client";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { prisma } from "./prisma";

const CHALLENGE_TTL_MS = config.auth.challengeTtlSeconds * 1000;
const SESSION_TTL_MS = config.auth.sessionTtlSeconds * 1000;
const SESSION_SECRET = config.auth.sessionSecret;

const encodeBase64Url = (value: Buffer | string): string =>
  Buffer.isBuffer(value) ? value.toString("base64url") : Buffer.from(value).toString("base64url");

const decodeBase64Url = (value: string): Buffer => Buffer.from(value, "base64url");

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const signSessionPayload = (payloadBase64Url: string): string =>
  createHmac("sha256", SESSION_SECRET).update(payloadBase64Url, "utf8").digest("base64url");

const getSessionDomain = (): string => {
  try {
    return new URL(config.app.apiBaseUrl).host;
  } catch (_error) {
    return "localhost";
  }
};

const parseSignatureBytes = (signature: string): Uint8Array => {
  const trimmed = signature.trim();

  if (!trimmed) {
    throw new Error("signature is required");
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed) as number[];
    return Uint8Array.from(parsed);
  }

  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  }

  try {
    const asBase64 = Buffer.from(trimmed, "base64");
    if (asBase64.length === 64) {
      return Uint8Array.from(asBase64);
    }
  } catch (_error) {
    // Fall through to base58.
  }

  try {
    const asBase58 = bs58.decode(trimmed);
    if (asBase58.length !== 64) {
      throw new Error("signature must decode to 64 bytes");
    }

    return asBase58;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "invalid signature encoding");
  }
};

const buildChallengeMessage = (wallet: string, nonce: string, issuedAt: Date, expiresAt: Date): string => {
  const domain = getSessionDomain();

  return [
    "StreamPump wallet sign-in",
    `Domain: ${domain}`,
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join("\n");
};

const buildSessionToken = (params: {
  sessionId: string;
  wallet: string;
  expiresAt: Date;
}): string => {
  const payload = encodeBase64Url(
    JSON.stringify({
      sid: params.sessionId,
      wallet: params.wallet,
      exp: Math.floor(params.expiresAt.getTime() / 1000),
    })
  );
  const signature = signSessionPayload(payload);

  return `${payload}.${signature}`;
};

const parseSessionToken = (
  token: string
): {
  sessionId: string;
  wallet: string;
  exp: number;
  tokenHash: string;
} | null => {
  const [payloadBase64Url, signatureBase64Url] = token.trim().split(".");

  if (!payloadBase64Url || !signatureBase64Url) {
    return null;
  }

  const expectedSignature = signSessionPayload(payloadBase64Url);
  const providedBuffer = Buffer.from(signatureBase64Url, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadBase64Url).toString("utf8")) as {
      sid?: string;
      wallet?: string;
      exp?: number;
    };

    if (!payload.sid || !payload.wallet || typeof payload.exp !== "number") {
      return null;
    }

    return {
      sessionId: payload.sid,
      wallet: new PublicKey(payload.wallet).toBase58(),
      exp: payload.exp,
      tokenHash: sha256Hex(token),
    };
  } catch (_error) {
    return null;
  }
};

const normalizeManagedWallet = (value?: string | null): string =>
  value && value.trim()
    ? new PublicKey(value).toBase58()
    : Keypair.generate().publicKey.toBase58();

const createWalletSession = async (wallet: string) => {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = buildSessionToken({
    sessionId,
    wallet,
    expiresAt,
  });

  await prisma.walletSession.create({
    data: {
      id: sessionId,
      wallet,
      tokenHash: sha256Hex(accessToken),
      expiresAt,
    },
  });

  return {
    wallet,
    accessToken,
    expiresAt,
  };
};

export const createWalletAuthChallenge = async (wallet: string) => {
  const normalizedWallet = new PublicKey(wallet).toBase58();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const nonce = randomBytes(16).toString("hex");
  const message = buildChallengeMessage(normalizedWallet, nonce, issuedAt, expiresAt);

  const challenge = await prisma.walletAuthChallenge.create({
    data: {
      wallet: normalizedWallet,
      nonce,
      message,
      expiresAt,
    },
  });

  return {
    challengeId: challenge.id,
    wallet: normalizedWallet,
    nonce,
    message,
    expiresAt,
  };
};

export const verifyWalletAuthChallenge = async (params: {
  wallet: string;
  nonce: string;
  signature: string;
}) => {
  const normalizedWallet = new PublicKey(params.wallet).toBase58();
  const challenge = await prisma.walletAuthChallenge.findFirst({
    where: {
      wallet: normalizedWallet,
      nonce: params.nonce,
    },
  });

  if (!challenge) {
    throw new Error("auth challenge not found");
  }

  if (challenge.consumedAt) {
    throw new Error("auth challenge has already been consumed");
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new Error("auth challenge has expired");
  }

  const signatureBytes = parseSignatureBytes(params.signature);
  const verified = ed25519.verify(signatureBytes, Buffer.from(challenge.message, "utf8"), new PublicKey(normalizedWallet).toBytes());

  if (!verified) {
    throw new Error("invalid wallet signature");
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = buildSessionToken({
    sessionId,
    wallet: normalizedWallet,
    expiresAt,
  });

  await prisma.$transaction([
    prisma.walletAuthChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
      },
    }),
    prisma.walletSession.create({
      data: {
        id: sessionId,
        wallet: normalizedWallet,
        tokenHash: sha256Hex(accessToken),
        expiresAt,
      },
    }),
  ]);

  return {
    wallet: normalizedWallet,
    accessToken,
    expiresAt,
  };
};

export const exchangeProviderIdentitySession = async (params: {
  provider: IdentityProvider;
  providerSubject: string;
  email?: string | null;
  displayName?: string | null;
  managedWalletAddress?: string | null;
}) => {
  const providerSubject = params.providerSubject.trim();
  if (!providerSubject) {
    throw new Error("providerSubject is required");
  }

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: params.provider,
        providerSubject,
      },
    },
  });

  const managedWalletAddress = existingIdentity?.managedWalletAddress ?? normalizeManagedWallet(params.managedWalletAddress);

  const identity = existingIdentity
    ? await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: {
          email: params.email ?? existingIdentity.email,
          displayName: params.displayName ?? existingIdentity.displayName,
          managedWalletAddress,
        },
      })
    : await prisma.authIdentity.create({
        data: {
          provider: params.provider,
          providerSubject,
          email: params.email ?? null,
          displayName: params.displayName ?? null,
          managedWalletAddress,
        },
      });

  const session = await createWalletSession(identity.managedWalletAddress);

  return {
    ...session,
    identity: {
      id: identity.id,
      provider: identity.provider,
      providerSubject: identity.providerSubject,
      email: identity.email,
      displayName: identity.displayName,
      managedWalletAddress: identity.managedWalletAddress,
    },
  };
};

export const findAuthIdentityByWallet = async (wallet: string) =>
  prisma.authIdentity.findFirst({
    where: {
      managedWalletAddress: wallet,
    },
  });

export const verifyWalletSessionToken = async (token: string) => {
  const parsed = parseSessionToken(token);
  if (!parsed) {
    return null;
  }

  if (parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const session = await prisma.walletSession.findUnique({
    where: { id: parsed.sessionId },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (session.wallet !== parsed.wallet || session.tokenHash !== parsed.tokenHash) {
    return null;
  }

  void prisma.walletSession.update({
    where: { id: session.id },
    data: {
      lastSeenAt: new Date(),
    },
  });

  return {
    sessionId: session.id,
    wallet: session.wallet,
    expiresAt: session.expiresAt,
  };
};

export const revokeWalletSession = async (token: string): Promise<void> => {
  const parsed = parseSessionToken(token);
  if (!parsed) {
    return;
  }

  await prisma.walletSession.updateMany({
    where: {
      id: parsed.sessionId,
      tokenHash: parsed.tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const verifyWeb3AuthToken = async (token: string) => {
  const session = await verifyWalletSessionToken(token);

  if (!session) {
    return null;
  }

  return {
    isValid: true,
    userId: session.wallet,
  };
};

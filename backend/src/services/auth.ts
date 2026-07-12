/**
 * CN: 钱包认证服务，提供 challenge/signature 登录、会话令牌签发与 Bearer 校验。
 * EN: Wallet authentication service providing challenge/signature login, session token issuance, and Bearer verification.
 */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";

import { ed25519 } from "@noble/curves/ed25519";
import { AccountRole, IdentityProvider, Prisma, WalletType } from "@prisma/client";
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { HttpError } from "../controllers/http";
import { resolveAccountProfileByWallet } from "./accountProfile";
import {
  assertPilotWalletInvited,
  normalizeWalletAddress,
} from "./pilotInvitePolicy";
import { prisma } from "./prisma";
import { encryptSecretKey } from "./walletEncryption";

const CHALLENGE_TTL_MS = config.auth.challengeTtlSeconds * 1000;
const SESSION_TTL_MS = config.auth.sessionTtlSeconds * 1000;
const SESSION_SECRET = config.auth.sessionSecret;
const EMAIL_OTP_TTL_MS = config.email.otpTtlSeconds * 1000;
const MAX_EMAIL_OTP_ATTEMPTS = 5;

const encodeBase64Url = (value: Buffer | string): string =>
  Buffer.isBuffer(value) ? value.toString("base64url") : Buffer.from(value).toString("base64url");

const decodeBase64Url = (value: string): Buffer => Buffer.from(value, "base64url");

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const signSessionPayload = (payloadBase64Url: string): string =>
  createHmac("sha256", SESSION_SECRET).update(payloadBase64Url, "utf8").digest("base64url");

const hmacHex = (value: string): string =>
  createHmac("sha256", SESSION_SECRET).update(value, "utf8").digest("hex");

const signChallengePayload = (payloadBase64Url: string): string =>
  createHmac("sha256", SESSION_SECRET)
    .update(`wallet-auth-challenge:${payloadBase64Url}`, "utf8")
    .digest("base64url");

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

type WalletChallengeToken = {
  version: 1;
  wallet: string;
  issuedAtMs: number;
  expiresAtMs: number;
  tokenId: string;
};

const buildWalletChallengeToken = (wallet: string, issuedAt: Date, expiresAt: Date): string => {
  const payload = encodeBase64Url(
    JSON.stringify({
      version: 1,
      wallet,
      issuedAtMs: issuedAt.getTime(),
      expiresAtMs: expiresAt.getTime(),
      tokenId: randomBytes(16).toString("hex"),
    } satisfies WalletChallengeToken)
  );

  return `${payload}.${signChallengePayload(payload)}`;
};

const parseWalletChallengeToken = (
  nonce: string,
  expectedWallet: string
): {
  issuedAt: Date;
  expiresAt: Date;
  message: string;
} => {
  const parts = nonce.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("auth challenge is invalid");
  }

  const [payloadBase64Url, providedSignature] = parts;
  const expectedSignature = signChallengePayload(payloadBase64Url);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("auth challenge is invalid");
  }

  let payload: WalletChallengeToken;
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64Url).toString("utf8")) as WalletChallengeToken;
  } catch (_error) {
    throw new Error("auth challenge is invalid");
  }

  if (
    payload.version !== 1 ||
    payload.wallet !== expectedWallet ||
    !Number.isSafeInteger(payload.issuedAtMs) ||
    !Number.isSafeInteger(payload.expiresAtMs) ||
    payload.expiresAtMs - payload.issuedAtMs !== CHALLENGE_TTL_MS ||
    !/^[0-9a-f]{32}$/.test(payload.tokenId)
  ) {
    throw new Error("auth challenge is invalid");
  }

  const now = Date.now();
  if (payload.issuedAtMs > now) {
    throw new Error("auth challenge is invalid");
  }
  if (payload.expiresAtMs <= now) {
    throw new Error("auth challenge has expired");
  }

  const issuedAt = new Date(payload.issuedAtMs);
  const expiresAt = new Date(payload.expiresAtMs);
  return {
    issuedAt,
    expiresAt,
    message: buildChallengeMessage(expectedWallet, nonce, issuedAt, expiresAt),
  };
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

const createPlatformManagedWallet = (): {
  address: string;
  encryptedSecretKey: Uint8Array<ArrayBuffer>;
} => {
  const keypair = Keypair.generate();

  return {
    address: keypair.publicKey.toBase58(),
    encryptedSecretKey: encryptSecretKey(keypair.secretKey),
  };
};

const requestManagedWalletDevnetAirdrop = async (walletAddress: string): Promise<void> => {
  if (!config.solana.isDevnet) {
    return;
  }

  try {
    const connection = new Connection(config.solana.txRpcEndpoint);
    const signature = await connection.requestAirdrop(
      new PublicKey(walletAddress),
      Math.floor(0.01 * LAMPORTS_PER_SOL)
    );
    await connection.confirmTransaction(signature, "confirmed");
  } catch (error) {
    console.warn(
      "Managed wallet devnet airdrop failed (non-fatal):",
      error instanceof Error ? error.message : error
    );
  }
};

type AccountProfileDb = Pick<Prisma.TransactionClient, "accountProfile" | "accountWallet">;

const ensureFanAccountProfileWithDb = async (
  db: AccountProfileDb,
  wallet: string,
  displayName?: string | null,
  walletType: WalletType = WalletType.EXTERNAL,
  encryptedSecretKey?: Uint8Array<ArrayBuffer>
) => {
  const boundWallet = await db.accountWallet.findUnique({
    where: { walletAddress: wallet },
    include: { accountProfile: true },
  });

  if (boundWallet) {
    if (walletType === WalletType.EXTERNAL && boundWallet.walletType !== WalletType.EXTERNAL) {
      throw new HttpError(
        409,
        "WALLET_TYPE_CONFLICT",
        "This wallet is already registered as a managed wallet."
      );
    }

    if (displayName) {
      await db.accountProfile.update({
        where: { id: boundWallet.accountProfileId },
        data: { displayName },
      });
    }

    if (walletType === WalletType.MANAGED && encryptedSecretKey) {
      await db.accountWallet.update({
        where: { walletAddress: wallet },
        data: { encryptedSecretKey },
      });
    }

    return boundWallet.accountProfile;
  }

  if (walletType === WalletType.MANAGED && !encryptedSecretKey) {
    throw new Error("encrypted managed wallet secret is required");
  }

  const profile = await db.accountProfile.upsert({
    where: { wallet },
    update: {
      displayName: displayName ?? undefined,
    },
    create: {
      wallet,
      role: AccountRole.FAN,
      displayName: displayName ?? undefined,
    },
  });

  await db.accountWallet.upsert({
    where: { walletAddress: wallet },
    update: {
      accountProfileId: profile.id,
      walletType,
      isPrimary: true,
      encryptedSecretKey:
        walletType === WalletType.MANAGED ? encryptedSecretKey : null,
    },
    create: {
      accountProfileId: profile.id,
      walletAddress: wallet,
      walletType,
      isPrimary: true,
      encryptedSecretKey:
        walletType === WalletType.MANAGED ? encryptedSecretKey : null,
    },
  });

  return profile;
};

export const ensureFanAccountProfile = async (
  wallet: string,
  displayName?: string | null,
  walletType: WalletType = WalletType.EXTERNAL,
  encryptedSecretKey?: Uint8Array<ArrayBuffer>
) =>
  ensureFanAccountProfileWithDb(
    prisma,
    wallet,
    displayName,
    walletType,
    encryptedSecretKey
  );

const normalizeEmail = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("email is invalid");
  }

  return normalized;
};

const createEmailCode = (): string => {
  const configuredCode = config.email.devCode?.trim();
  if (configuredCode) {
    return configuredCode;
  }

  const length = Math.min(Math.max(Math.floor(config.email.otpCodeLength), 4), 10);
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
};

const hashEmailCode = (email: string, code: string): string =>
  hmacHex(`email-otp:${email}:${code.trim()}`);

const isEqualString = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const sendEmailOtp = async (email: string, code: string): Promise<void> => {
  if (config.email.deliveryMode === "console") {
    console.log(`[auth] email OTP for ${email}: ${code}`);
    return;
  }

  if (config.email.deliveryMode !== "resend") {
    throw new Error("EMAIL_DELIVERY_MODE must be console or resend");
  }

  const apiKey = config.email.resendApiKey?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.email.fromAddress,
      to: [email],
      subject: "Your StreamPump login code",
      text: `Your StreamPump login code is ${code}. It expires in ${Math.floor(config.email.otpTtlSeconds / 60)} minutes.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`failed to send email OTP (${response.status})`);
  }
};

export const createWalletSession = async (wallet: string) => {
  const normalizedWallet = assertPilotWalletInvited(wallet);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = buildSessionToken({
    sessionId,
    wallet: normalizedWallet,
    expiresAt,
  });

  await prisma.walletSession.create({
    data: {
      id: sessionId,
      wallet: normalizedWallet,
      tokenHash: sha256Hex(accessToken),
      expiresAt,
    },
  });

  return {
    wallet: normalizedWallet,
    accessToken,
    expiresAt,
  };
};

export const createWalletAuthChallenge = async (wallet: string) => {
  const normalizedWallet = normalizeWalletAddress(wallet);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const nonce = buildWalletChallengeToken(normalizedWallet, issuedAt, expiresAt);
  const message = buildChallengeMessage(normalizedWallet, nonce, issuedAt, expiresAt);

  return {
    challengeId: randomUUID(),
    wallet: normalizedWallet,
    nonce,
    message,
    expiresAt,
  };
};

const verifyPendingWalletAuthChallenge = async (params: {
  wallet: string;
  nonce: string;
  signature: string;
}) => {
  const normalizedWallet = normalizeWalletAddress(params.wallet);
  const challenge = parseWalletChallengeToken(params.nonce, normalizedWallet);

  const signatureBytes = parseSignatureBytes(params.signature);
  const verified = ed25519.verify(signatureBytes, Buffer.from(challenge.message, "utf8"), new PublicKey(normalizedWallet).toBytes());

  if (!verified) {
    throw new Error("invalid wallet signature");
  }

  return {
    challenge,
    normalizedWallet,
  };
};

const claimWalletAuthChallengeAndCreateSession = async (params: {
  nonce: string;
  message: string;
  normalizedWallet: string;
  sessionId: string;
  accessToken: string;
  expiresAt: Date;
  challengeExpiresAt: Date;
}): Promise<void> => {
  const claimedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      if (params.challengeExpiresAt.getTime() <= claimedAt.getTime()) {
        throw new Error("auth challenge has expired");
      }

      await tx.walletAuthChallenge.deleteMany({
        where: {
          wallet: params.normalizedWallet,
          expiresAt: { lte: claimedAt },
        },
      });

      await tx.walletAuthChallenge.create({
        data: {
          wallet: params.normalizedWallet,
          nonce: params.nonce,
          message: params.message,
          expiresAt: params.challengeExpiresAt,
          consumedAt: claimedAt,
        },
      });

      await tx.walletSession.create({
        data: {
          id: params.sessionId,
          wallet: params.normalizedWallet,
          tokenHash: sha256Hex(params.accessToken),
          expiresAt: params.expiresAt,
        },
      });

      await ensureFanAccountProfileWithDb(
        tx,
        params.normalizedWallet,
        null,
        WalletType.EXTERNAL
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("auth challenge has already been consumed");
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error("auth challenge has already been consumed");
    }
    throw error;
  }
};

export const verifyWalletAuthChallenge = async (params: {
  wallet: string;
  nonce: string;
  signature: string;
}) => {
  const { challenge, normalizedWallet } = await verifyPendingWalletAuthChallenge(params);
  assertPilotWalletInvited(normalizedWallet);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = buildSessionToken({
    sessionId,
    wallet: normalizedWallet,
    expiresAt,
  });

  await claimWalletAuthChallengeAndCreateSession({
    nonce: params.nonce,
    message: challenge.message,
    normalizedWallet,
    sessionId,
    accessToken,
    expiresAt,
    challengeExpiresAt: challenge.expiresAt,
  });

  return {
    wallet: normalizedWallet,
    accessToken,
    expiresAt,
  };
};

export const createEmailAuthChallenge = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const code = createEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  await prisma.emailAuthChallenge.create({
    data: {
      email: normalizedEmail,
      codeHash: hashEmailCode(normalizedEmail, code),
      expiresAt,
    },
  });

  await sendEmailOtp(normalizedEmail, code);

  return {
    email: normalizedEmail,
    expiresAt,
  };
};

export const verifyEmailAuthChallenge = async (params: {
  email: string;
  code: string;
}) => {
  const email = normalizeEmail(params.email);
  const code = params.code.trim();
  if (!/^\d{4,10}$/.test(code)) {
    throw new Error("email code is invalid");
  }

  const challenge = await prisma.emailAuthChallenge.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    throw new Error("email challenge not found or expired");
  }

  if (challenge.attempts >= MAX_EMAIL_OTP_ATTEMPTS) {
    throw new Error("email challenge attempt limit exceeded");
  }

  const valid = isEqualString(challenge.codeHash, hashEmailCode(email, code));
  if (!valid) {
    await prisma.emailAuthChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
    throw new Error("email code is invalid");
  }

  await prisma.emailAuthChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return exchangeProviderIdentitySession({
    provider: IdentityProvider.EMAIL,
    providerSubject: email,
    email,
    displayName: email.split("@")[0],
  });
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

  // Product model: the platform assigns the managed wallet identity. Client-supplied
  // wallet addresses are ignored here so users cannot bind arbitrary wallets during
  // preview/social registration. External user-owned wallets need a separate
  // challenge/signature link flow.
  const newManagedWallet = existingIdentity ? null : createPlatformManagedWallet();
  const managedWalletAddress =
    existingIdentity?.managedWalletAddress ?? newManagedWallet?.address;
  if (!managedWalletAddress) {
    throw new Error("failed to allocate managed wallet");
  }

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
  await ensureFanAccountProfile(
    identity.managedWalletAddress,
    identity.displayName,
    WalletType.MANAGED,
    newManagedWallet?.encryptedSecretKey
  );
  if (newManagedWallet) {
    void requestManagedWalletDevnetAirdrop(newManagedWallet.address);
  }

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

export const bindExternalWalletToIdentitySession = async (params: {
  currentAccessToken: string;
  wallet: string;
  nonce: string;
  signature: string;
}) => {
  const currentSession = await verifyWalletSessionToken(params.currentAccessToken);
  if (!currentSession) {
    throw new Error("current identity session is invalid or expired");
  }

  const identity = await findAuthIdentityByWallet(currentSession.wallet);
  if (!identity) {
    throw new Error("current session is not linked to a provider identity");
  }

  const currentAccountProfile =
    (await resolveAccountProfileByWallet(currentSession.wallet)) ??
    (await ensureFanAccountProfile(
      identity.managedWalletAddress,
      identity.displayName,
      WalletType.MANAGED
    ));

  const normalizedWallet = normalizeWalletAddress(params.wallet);
  const existingWalletBinding = await prisma.accountWallet.findUnique({
    where: { walletAddress: normalizedWallet },
    include: { accountProfile: true },
  });
  const existingManagedIdentity = await prisma.authIdentity.findUnique({
    where: { managedWalletAddress: normalizedWallet },
  });
  if (existingWalletBinding || existingManagedIdentity) {
    throw new HttpError(
      409,
      "WALLET_ALREADY_BOUND",
      "This external wallet is already bound to an account profile."
    );
  }

  const { challenge } = await verifyPendingWalletAuthChallenge({
    wallet: params.wallet,
    nonce: params.nonce,
    signature: params.signature,
  });
  assertPilotWalletInvited(normalizedWallet);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = buildSessionToken({
    sessionId,
    wallet: normalizedWallet,
    expiresAt,
  });

  const claimedAt = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      if (challenge.expiresAt.getTime() <= claimedAt.getTime()) {
        throw new Error("auth challenge has expired");
      }

      await tx.walletAuthChallenge.deleteMany({
        where: {
          wallet: normalizedWallet,
          expiresAt: { lte: claimedAt },
        },
      });
      await tx.walletAuthChallenge.create({
        data: {
          wallet: normalizedWallet,
          nonce: params.nonce,
          message: challenge.message,
          expiresAt: challenge.expiresAt,
          consumedAt: claimedAt,
        },
      });

      await tx.accountWallet.create({
        data: {
          accountProfileId: currentAccountProfile.id,
          walletAddress: normalizedWallet,
          walletType: WalletType.EXTERNAL,
          isPrimary: false,
        },
      });

      await tx.walletSession.create({
        data: {
          id: sessionId,
          wallet: normalizedWallet,
          tokenHash: sha256Hex(accessToken),
          expiresAt,
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error("auth challenge has already been consumed");
    }
    throw error;
  }

  return {
    wallet: normalizedWallet,
    accessToken,
    expiresAt,
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

export const findAuthIdentityByWallet = async (wallet: string) => {
  const directIdentity = await prisma.authIdentity.findFirst({
    where: {
      managedWalletAddress: wallet,
    },
  });

  if (directIdentity) {
    return directIdentity;
  }

  const profile = await resolveAccountProfileByWallet(wallet);
  if (!profile || profile.wallet === wallet) {
    return null;
  }

  return prisma.authIdentity.findFirst({
    where: {
      managedWalletAddress: profile.wallet,
    },
  });
};

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

  try {
    assertPilotWalletInvited(session.wallet);
  } catch (_error) {
    return null;
  }

  if (config.pilot.inviteOnly) {
    const accountWallet = await prisma.accountWallet.findUnique({
      where: { walletAddress: session.wallet },
      select: { walletType: true },
    });
    if (accountWallet?.walletType !== WalletType.EXTERNAL) {
      return null;
    }
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

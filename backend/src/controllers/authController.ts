/**
 * CN: 钱包认证控制器，处理 challenge 创建、签名验证、会话查询和退出登录。
 * EN: Wallet authentication controller handling challenge creation, signature verification, session introspection, and logout.
 */
import { Request, Response } from "express";
import { IdentityProvider } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import { handleControllerError, HttpError, ok, parseNonEmptyString } from "./http";
import {
  bindExternalWalletToIdentitySession,
  createEmailAuthChallenge,
  createWalletAuthChallenge,
  exchangeProviderIdentitySession,
  findAuthIdentityByWallet,
  verifyEmailAuthChallenge,
  verifyWalletAuthChallenge,
} from "../services/auth";
import { config } from "../../config/default";
import {
  buildEphemeralSubjectRateLimitKey,
  createEphemeralSessionFromPool,
} from "../services/ephemeralSessionService";
import { assertRateLimit, getClientIp } from "../services/rateLimiter";
import {
  createSponsorDocumentUpload,
  submitSponsorProfile,
} from "../services/sponsorProfile";
import {
  completeSocialAuthorization,
  createSocialAuthorization,
  renderSocialCallbackHtml,
  resolveSocialCallbackTarget,
  type SocialAuthProvider,
} from "../services/socialAuth";

const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_CHALLENGE_IP_LIMIT = 30;
// Challenge issuance is stateless and cheap; keep the per-wallet ceiling above
// the per-IP ceiling so one caller cannot trivially lock a public Pilot wallet.
const AUTH_CHALLENGE_WALLET_LIMIT = 60;
const AUTH_VERIFY_IP_LIMIT = 60;
const AUTH_VERIFY_WALLET_LIMIT = 12;
const SOCIAL_AUTH_START_IP_LIMIT = 20;

const assertWalletAuthRateLimits = (params: {
  operation: "challenge" | "verify";
  ip: string;
  wallet: string;
}): void => {
  const isChallenge = params.operation === "challenge";
  assertRateLimit({
    key: `wallet-auth:${params.operation}:ip:${params.ip}`,
    limit: isChallenge ? AUTH_CHALLENGE_IP_LIMIT : AUTH_VERIFY_IP_LIMIT,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    code: "AUTH_RATE_LIMITED",
    message: "too many wallet authentication attempts",
  });
  assertRateLimit({
    key: `wallet-auth:${params.operation}:wallet:${params.wallet}`,
    limit: isChallenge ? AUTH_CHALLENGE_WALLET_LIMIT : AUTH_VERIFY_WALLET_LIMIT,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    code: "AUTH_RATE_LIMITED",
    message: "too many wallet authentication attempts",
  });
};

const isAnonymousWalletVerificationFailure = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    return error.code === "PILOT_INVITE_REQUIRED";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error instanceof SyntaxError ||
    /auth challenge|wallet signature|signature.*bytes|invalid signature|base58/i.test(error.message)
  );
};

const anonymousWalletVerificationError = (): HttpError =>
  new HttpError(
    401,
    "AUTH_CHALLENGE_INVALID",
    "Wallet challenge could not be verified. Request a new challenge and try again."
  );

const shouldConcealWalletVerificationFailure = (error: unknown): boolean => {
  if (isAnonymousWalletVerificationFailure(error)) {
    return true;
  }

  if (!config.pilot.inviteOnly) {
    return false;
  }

  return !(
    error instanceof HttpError &&
    (error.code === "INVALID_INPUT" || error.code === "AUTH_RATE_LIMITED")
  );
};

const parseWallet = (value: unknown): string => {
  const wallet = String(value ?? "").trim();
  if (!wallet) {
    throw new HttpError(400, "INVALID_INPUT", "wallet is required");
  }

  try {
    return new PublicKey(wallet).toBase58();
  } catch (_error) {
    throw new HttpError(400, "INVALID_INPUT", "wallet is not a valid Solana public key");
  }
};

const parseIdentityProvider = (value: unknown): IdentityProvider => {
  const provider = String(value ?? "").trim().toUpperCase();

  switch (provider) {
    case "GOOGLE":
      return IdentityProvider.GOOGLE;
    case "APPLE":
      return IdentityProvider.APPLE;
    case "EMAIL":
      return IdentityProvider.EMAIL;
    case "PASSKEY":
      return IdentityProvider.PASSKEY;
    case "TWITTER":
      return IdentityProvider.TWITTER;
    default:
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "provider must be one of: GOOGLE, APPLE, EMAIL, PASSKEY, TWITTER"
      );
  }
};

const parseSocialAuthProvider = (value: unknown): SocialAuthProvider => {
  const provider = String(value ?? "").trim().toUpperCase();
  if (provider === "GOOGLE" || provider === "APPLE") {
    return provider;
  }
  throw new HttpError(400, "INVALID_INPUT", "provider must be GOOGLE or APPLE");
};

const parseBearerToken = (req: Request): string | null => {
  const authorization = String(req.header("authorization") ?? "").trim();
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export const createAuthChallenge = async (req: Request, res: Response) => {
  try {
    const wallet = parseWallet(req.body.wallet);
    assertWalletAuthRateLimits({
      operation: "challenge",
      ip: getClientIp(req),
      wallet,
    });
    const challenge = await createWalletAuthChallenge(wallet);

    ok(res, {
      wallet: challenge.wallet,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: challenge.expiresAt.toISOString(),
    }, 201);
  } catch (error) {
    handleControllerError(res, error, "CREATE_AUTH_CHALLENGE_FAILED");
  }
};

export const verifyAuthChallenge = async (req: Request, res: Response) => {
  try {
    const wallet = parseWallet(req.body.wallet);
    assertWalletAuthRateLimits({
      operation: "verify",
      ip: getClientIp(req),
      wallet,
    });
    const nonce = parseNonEmptyString(req.body.nonce, "nonce");
    const signature = parseNonEmptyString(req.body.signature, "signature");
    const existingIdentityToken = parseBearerToken(req);
    const session = existingIdentityToken && !config.pilot.inviteOnly
      ? await bindExternalWalletToIdentitySession({
          currentAccessToken: existingIdentityToken,
          wallet,
          nonce,
          signature,
        })
      : await verifyWalletAuthChallenge({
          wallet,
          nonce,
          signature,
        });

    ok(res, {
      wallet: session.wallet,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt.toISOString(),
      tokenType: "Bearer",
      identity: "identity" in session ? session.identity : null,
    });
  } catch (error) {
    if (shouldConcealWalletVerificationFailure(error)) {
      handleControllerError(
        res,
        anonymousWalletVerificationError(),
        "VERIFY_AUTH_CHALLENGE_FAILED"
      );
      return;
    }

    handleControllerError(res, error, "VERIFY_AUTH_CHALLENGE_FAILED");
  }
};

export const requestEmailLoginCode = async (req: Request, res: Response) => {
  try {
    const challenge = await createEmailAuthChallenge(
      parseNonEmptyString(req.body.email, "email")
    );

    ok(res, {
      email: challenge.email,
      expiresAt: challenge.expiresAt.toISOString(),
    }, 201);
  } catch (error) {
    handleControllerError(res, error, "REQUEST_EMAIL_LOGIN_CODE_FAILED");
  }
};

export const verifyEmailLoginCode = async (req: Request, res: Response) => {
  try {
    const session = await verifyEmailAuthChallenge({
      email: parseNonEmptyString(req.body.email, "email"),
      code: parseNonEmptyString(req.body.code, "code"),
    });

    ok(res, {
      wallet: session.wallet,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt.toISOString(),
      tokenType: "Bearer",
      identity: session.identity,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("expired")) {
        handleControllerError(
          res,
          new HttpError(404, "EMAIL_AUTH_CHALLENGE_NOT_FOUND", error.message),
          "VERIFY_EMAIL_LOGIN_CODE_FAILED"
        );
        return;
      }

      if (error.message.includes("attempt limit")) {
        handleControllerError(
          res,
          new HttpError(409, "EMAIL_AUTH_ATTEMPT_LIMIT", error.message),
          "VERIFY_EMAIL_LOGIN_CODE_FAILED"
        );
        return;
      }

      if (error.message.includes("code")) {
        handleControllerError(
          res,
          new HttpError(401, "EMAIL_AUTH_CODE_INVALID", error.message),
          "VERIFY_EMAIL_LOGIN_CODE_FAILED"
        );
        return;
      }
    }

    handleControllerError(res, error, "VERIFY_EMAIL_LOGIN_CODE_FAILED");
  }
};

export const exchangeProviderSession = async (req: Request, res: Response) => {
  try {
    if (!config.auth.allowPreviewProviderExchange) {
      throw new HttpError(
        403,
        "PREVIEW_PROVIDER_EXCHANGE_DISABLED",
        "provider-exchange is disabled; use wallet challenge/signature auth or explicitly enable preview provider exchange for local demos"
      );
    }

    const session = await exchangeProviderIdentitySession({
      provider: parseIdentityProvider(req.body.provider),
      providerSubject: parseNonEmptyString(req.body.providerSubject, "providerSubject"),
      email: req.body.email ? String(req.body.email).trim() : null,
      displayName: req.body.displayName ? String(req.body.displayName).trim() : null,
    });

    ok(res, {
      wallet: session.wallet,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt.toISOString(),
      tokenType: "Bearer",
      identity: session.identity,
    });
  } catch (error) {
    handleControllerError(res, error, "EXCHANGE_PROVIDER_SESSION_FAILED");
  }
};

export const startSocialLogin = async (req: Request, res: Response) => {
  try {
    assertRateLimit({
      key: `social-auth:start:ip:${getClientIp(req)}`,
      limit: SOCIAL_AUTH_START_IP_LIMIT,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
      code: "AUTH_RATE_LIMITED",
      message: "too many social authentication attempts",
    });
    const requestOrigin = String(req.header("origin") ?? "").trim();
    if (!requestOrigin) {
      throw new HttpError(403, "SOCIAL_AUTH_ORIGIN_REQUIRED", "Social login requires an allowed browser origin.");
    }
    const authorization = createSocialAuthorization({
      provider: parseSocialAuthProvider(req.body.provider),
      requestOrigin,
    });

    ok(res, {
      ...authorization,
      expiresAt: authorization.expiresAt.toISOString(),
    }, 201);
  } catch (error) {
    handleControllerError(res, error, "START_SOCIAL_LOGIN_FAILED");
  }
};

const sendSocialCallbackPage = (
  res: Response,
  params: {
    targetOrigin: string | null;
    message: Record<string, unknown>;
  }
): void => {
  const page = renderSocialCallbackHtml(params);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", page.csp);
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).type("html").send(page.html);
};

const completeSocialLoginCallback = async (
  provider: SocialAuthProvider,
  input: Record<string, unknown>,
  res: Response
): Promise<void> => {
  const state = String(input.state ?? "").trim();
  let targetOrigin: string | null = null;

  try {
    if (state) {
      targetOrigin = resolveSocialCallbackTarget(provider, state);
    }
    if (input.error) {
      throw new HttpError(401, "SOCIAL_AUTH_CANCELLED", "Social login was cancelled or denied.");
    }

    const result = await completeSocialAuthorization({
      provider,
      code: parseNonEmptyString(input.code, "code"),
      state: parseNonEmptyString(input.state, "state"),
      appleUser: input.user,
    });
    sendSocialCallbackPage(res, {
      targetOrigin: result.targetOrigin,
      message: {
        type: "streampump-social-auth",
        ok: true,
        session: result.session,
      },
    });
  } catch (_error) {
    sendSocialCallbackPage(res, {
      targetOrigin,
      message: {
        type: "streampump-social-auth",
        ok: false,
        error: "Social sign-in could not be completed. Please return to StreamPump and try again.",
      },
    });
  }
};

export const completeGoogleSocialLogin = async (req: Request, res: Response) =>
  completeSocialLoginCallback("GOOGLE", req.query as Record<string, unknown>, res);

export const completeAppleSocialLogin = async (req: Request, res: Response) =>
  completeSocialLoginCallback("APPLE", req.body as Record<string, unknown>, res);

export const createEphemeralSession = async (req: Request, res: Response) => {
  try {
    const subject = parseNonEmptyString(req.body.subject, "subject");
    const ip = getClientIp(req);

    assertRateLimit({
      key: `ephemeral-ip:${ip}`,
      limit: config.managedWallet.ephemeralIpLimit,
      windowMs: config.managedWallet.ephemeralIpWindowMs,
      code: "EPHEMERAL_SESSION_IP_RATE_LIMITED",
      message: "too many ephemeral session attempts from this IP",
    });
    assertRateLimit({
      key: buildEphemeralSubjectRateLimitKey(subject),
      limit: config.managedWallet.ephemeralSubjectLimit,
      windowMs: config.managedWallet.ephemeralSubjectWindowMs,
      code: "EPHEMERAL_SESSION_SUBJECT_RATE_LIMITED",
      message: "too many ephemeral session attempts for this subject",
    });

    const session = await createEphemeralSessionFromPool({ subject });
    res.status(session.created ? 201 : 200).json({
      accessToken: session.accessToken,
      wallet: session.wallet,
      identity: {
        managedWalletAddress: session.identity.managedWalletAddress,
      },
    });
  } catch (error) {
    handleControllerError(res, error, "CREATE_EPHEMERAL_SESSION_FAILED");
  }
};

export const presignSponsorDocumentUpload = async (req: Request, res: Response) => {
  try {
    if (!req.auth?.wallet || req.auth.source !== "session") {
      throw new HttpError(401, "AUTH_REQUIRED", "bearer session authentication is required");
    }

    const documentType = String(req.body.documentType ?? "").trim().toUpperCase();
    if (documentType !== "BUSINESS_LICENSE" && documentType !== "POWER_OF_ATTORNEY") {
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "documentType must be BUSINESS_LICENSE or POWER_OF_ATTORNEY"
      );
    }

    const upload = await createSponsorDocumentUpload({
      wallet: req.auth.wallet,
      documentType,
      fileName: parseNonEmptyString(req.body.fileName, "fileName"),
      mimeType: parseNonEmptyString(req.body.mimeType, "mimeType"),
      fileSizeBytes: Number(req.body.fileSizeBytes),
    });

    ok(res, upload, 201);
  } catch (error) {
    handleControllerError(res, error, "PRESIGN_SPONSOR_DOCUMENT_FAILED");
  }
};

export const registerSponsorProfile = async (req: Request, res: Response) => {
  try {
    if (!req.auth?.wallet || req.auth.source !== "session") {
      throw new HttpError(401, "AUTH_REQUIRED", "bearer session authentication is required");
    }

    const profile = await submitSponsorProfile({
      wallet: req.auth.wallet,
      companyName: parseNonEmptyString(req.body.companyName, "companyName"),
      sponsorType: parseNonEmptyString(req.body.sponsorType, "sponsorType"),
      registrationNumber: parseNonEmptyString(req.body.registrationNumber, "registrationNumber"),
      businessLicenseKey: parseNonEmptyString(req.body.businessLicenseKey, "businessLicenseKey"),
      legalRepresentative: parseNonEmptyString(req.body.legalRepresentative, "legalRepresentative"),
      contactPhone: parseNonEmptyString(req.body.contactPhone, "contactPhone"),
      contactEmail: parseNonEmptyString(req.body.contactEmail, "contactEmail"),
      powerOfAttorneyKey: req.body.powerOfAttorneyKey
        ? String(req.body.powerOfAttorneyKey).trim()
        : null,
    });

    ok(res, profile, 201);
  } catch (error) {
    handleControllerError(res, error, "REGISTER_SPONSOR_PROFILE_FAILED");
  }
};

export const getCurrentSession = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "wallet authentication is required");
    }

    const identity = await findAuthIdentityByWallet(req.auth.wallet);

    ok(res, {
      wallet: req.auth.wallet,
      sessionId: req.auth.sessionId,
      source: req.auth.source,
      identity: identity
        ? {
            id: identity.id,
            provider: identity.provider,
            providerSubject: identity.providerSubject,
            email: identity.email,
            displayName: identity.displayName,
            managedWalletAddress: identity.managedWalletAddress,
          }
        : null,
    });
  } catch (error) {
    handleControllerError(res, error, "GET_CURRENT_SESSION_FAILED");
  }
};

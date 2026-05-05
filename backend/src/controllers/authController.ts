/**
 * CN: 钱包认证控制器，处理 challenge 创建、签名验证、会话查询和退出登录。
 * EN: Wallet authentication controller handling challenge creation, signature verification, session introspection, and logout.
 */
import { Request, Response } from "express";
import { IdentityProvider } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import { handleControllerError, HttpError, ok, parseNonEmptyString } from "./http";
import {
  createWalletAuthChallenge,
  exchangeProviderIdentitySession,
  findAuthIdentityByWallet,
  verifyWalletAuthChallenge,
} from "../services/auth";
import { config } from "../../config/default";

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
    default:
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "provider must be one of: GOOGLE, APPLE, EMAIL, PASSKEY"
      );
  }
};

export const createAuthChallenge = async (req: Request, res: Response) => {
  try {
    const wallet = parseWallet(req.body.wallet);
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
    const nonce = parseNonEmptyString(req.body.nonce, "nonce");
    const signature = parseNonEmptyString(req.body.signature, "signature");
    const session = await verifyWalletAuthChallenge({
      wallet,
      nonce,
      signature,
    });

    ok(res, {
      wallet: session.wallet,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt.toISOString(),
      tokenType: "Bearer",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        handleControllerError(
          res,
          new HttpError(404, "AUTH_CHALLENGE_NOT_FOUND", error.message),
          "VERIFY_AUTH_CHALLENGE_FAILED"
        );
        return;
      }

      if (error.message.includes("expired") || error.message.includes("consumed")) {
        handleControllerError(
          res,
          new HttpError(409, "AUTH_CHALLENGE_INVALID", error.message),
          "VERIFY_AUTH_CHALLENGE_FAILED"
        );
        return;
      }

      if (error.message.includes("signature")) {
        handleControllerError(
          res,
          new HttpError(401, "AUTH_SIGNATURE_INVALID", error.message),
          "VERIFY_AUTH_CHALLENGE_FAILED"
        );
        return;
      }
    }

    handleControllerError(res, error, "VERIFY_AUTH_CHALLENGE_FAILED");
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

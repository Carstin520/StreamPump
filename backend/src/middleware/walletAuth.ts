/**
 * CN: 钱包认证中间件，支持 Bearer session，并在受控场景下允许 legacy x-wallet-address 回退。
 * EN: Wallet-auth middleware supporting Bearer sessions with an optional legacy x-wallet-address fallback for controlled environments.
 */
import { NextFunction, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { revokeWalletSession, verifyWalletSessionToken } from "../services/auth";
import { fail } from "../controllers/http";

const parseWalletHeader = (value: string | undefined): string | null => {
  const wallet = String(value ?? "").trim();
  if (!wallet) {
    return null;
  }

  try {
    return new PublicKey(wallet).toBase58();
  } catch (_error) {
    return null;
  }
};

const getBearerToken = (req: Request): string | null => {
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

const maybeApplyLegacyWalletHeader = (req: Request): boolean => {
  if (!config.auth.allowLegacyWalletHeader) {
    return false;
  }

  const wallet = parseWalletHeader(req.header("x-wallet-address"));
  if (!wallet) {
    return false;
  }

  req.auth = {
    wallet,
    sessionId: null,
    source: "legacy-header",
  };

  return true;
};

export const optionalWalletAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      maybeApplyLegacyWalletHeader(req);
      next();
      return;
    }

    const session = await verifyWalletSessionToken(token);
    if (!session) {
      fail(res, 401, "AUTH_INVALID", "wallet session is invalid or expired");
      return;
    }

    req.auth = {
      wallet: session.wallet,
      sessionId: session.sessionId,
      source: "session",
    };

    next();
  } catch (error) {
    fail(res, 500, "AUTH_CHECK_FAILED", error instanceof Error ? error.message : "auth failed");
  }
};

export const optionalSessionAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const session = await verifyWalletSessionToken(token);
    if (!session) {
      fail(res, 401, "AUTH_INVALID", "wallet session is invalid or expired");
      return;
    }

    req.auth = {
      wallet: session.wallet,
      sessionId: session.sessionId,
      source: "session",
    };

    next();
  } catch (error) {
    fail(res, 500, "AUTH_CHECK_FAILED", error instanceof Error ? error.message : "auth failed");
  }
};

export const requireWalletAuth = async (req: Request, res: Response, next: NextFunction) => {
  await optionalWalletAuth(req, res, () => {
    if (!req.auth) {
      fail(res, 401, "AUTH_REQUIRED", "wallet authentication is required");
      return;
    }

    next();
  });
};

export const requireSessionAuth = async (req: Request, res: Response, next: NextFunction) => {
  await optionalSessionAuth(req, res, () => {
    if (!req.auth || req.auth.source !== "session") {
      fail(res, 401, "AUTH_REQUIRED", "bearer session authentication is required");
      return;
    }

    next();
  });
};

export const logoutWalletSession = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      await revokeWalletSession(token);
    }

    res.status(204).send();
  } catch (error) {
    fail(res, 500, "AUTH_LOGOUT_FAILED", error instanceof Error ? error.message : "logout failed");
  }
};

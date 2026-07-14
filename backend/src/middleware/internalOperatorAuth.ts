import { NextFunction, Request, Response } from "express";
import { createHash, timingSafeEqual } from "crypto";

import { config } from "../../config/default";
import { fail } from "../controllers/http";
import { getAnchorService } from "../services/AnchorService";
import { optionalSessionAuth } from "./walletAuth";

const keyDigest = (value: string): Buffer =>
  createHash("sha256").update(value, "utf8").digest();

export const internalOperatorKeyMatches = (
  configuredKey: string | null | undefined,
  providedKey: string | null | undefined
): boolean => {
  const configured = configuredKey?.trim() ?? "";
  const provided = providedKey?.trim() ?? "";
  const digestsMatch = timingSafeEqual(keyDigest(configured), keyDigest(provided));
  return Boolean(configured && provided && digestsMatch);
};

export const internalOperatorKeyIdentity = (configuredKey: string): string =>
  `INTERNAL_KEY:${keyDigest(configuredKey.trim()).toString("hex").slice(0, 12)}`;

export const requireInternalOperatorAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredKey = config.auth.internalOperatorApiKey?.trim();
  const providedKey = String(req.header("x-internal-operator-key") ?? "").trim();

  if (internalOperatorKeyMatches(configuredKey, providedKey)) {
    req.operatorIdentity = internalOperatorKeyIdentity(configuredKey as string);
    next();
    return;
  }

  await optionalSessionAuth(req, res, () => {
    const wallet = req.auth?.wallet;
    const oracleWallet = getAnchorService().getOracleAuthorityPublicKey().toBase58();

    if (wallet === oracleWallet) {
      req.operatorIdentity = wallet;
      next();
      return;
    }

    fail(res, 403, "OPERATOR_AUTH_REQUIRED", "operator authorization is required");
  });
};

import { NextFunction, Request, Response } from "express";

import { config } from "../../config/default";
import { fail } from "../controllers/http";
import { getAnchorService } from "../services/AnchorService";
import { optionalSessionAuth } from "./walletAuth";

export const requireInternalOperatorAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredKey = config.auth.internalOperatorApiKey?.trim();
  const providedKey = String(req.header("x-internal-operator-key") ?? "").trim();

  if (configuredKey && providedKey && configuredKey === providedKey) {
    next();
    return;
  }

  await optionalSessionAuth(req, res, () => {
    const wallet = req.auth?.wallet;
    const oracleWallet = getAnchorService().getOracleAuthorityPublicKey().toBase58();

    if (wallet === oracleWallet) {
      next();
      return;
    }

    fail(res, 403, "OPERATOR_AUTH_REQUIRED", "operator authorization is required");
  });
};

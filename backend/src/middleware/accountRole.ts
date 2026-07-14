import { AccountRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { fail } from "../controllers/http";
import { resolveAccountProfileByWallet } from "../services/accountProfile";

export const isCreatorAccountProfile = (profile: { role: AccountRole } | null): boolean =>
  profile?.role === AccountRole.CREATOR;

export const requireCreatorAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const wallet = req.auth?.source === "session" ? req.auth.wallet : null;
  if (!wallet) {
    fail(res, 401, "AUTH_REQUIRED", "bearer session authentication is required");
    return;
  }

  try {
    const profile = await resolveAccountProfileByWallet(wallet);
    if (!isCreatorAccountProfile(profile)) {
      fail(res, 403, "CREATOR_ROLE_REQUIRED", "creator account role is required");
      return;
    }

    next();
  } catch (_error) {
    fail(res, 503, "ACCOUNT_PROFILE_UNAVAILABLE", "account profile storage is unavailable");
  }
};

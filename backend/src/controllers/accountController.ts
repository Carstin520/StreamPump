import { AccountRole } from "@prisma/client";
import { Request, Response } from "express";

import {
  handleControllerError,
  HttpError,
  isUniqueConstraintError,
  ok,
  requireSessionWallet,
} from "./http";
import {
  getOrCreateAccountProfile,
  isAccountProfileStorageError,
  serializeAccountIdentity,
  serializeAccountProfile,
  updateAccountProfile,
} from "../services/accountProfile";
import { findAuthIdentityByWallet } from "../services/auth";

const parseAccountRole = (value: unknown): AccountRole => {
  const role = String(value ?? "").trim().toUpperCase();
  switch (role) {
    case "FAN":
      return AccountRole.FAN;
    case "CREATOR":
      return AccountRole.CREATOR;
    case "SPONSOR":
      return AccountRole.SPONSOR;
    default:
      throw new HttpError(400, "INVALID_INPUT", "role must be one of: FAN, CREATOR, SPONSOR");
  }
};

const parseDisplayName = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim();
  if (!parsed) {
    return null;
  }
  if (parsed.length > 80) {
    throw new HttpError(400, "INVALID_INPUT", "displayName must be 80 characters or fewer");
  }
  return parsed;
};

const parseHandle = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (!parsed) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9_.-]{1,29}$/.test(parsed)) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "handle must be 2-30 characters and use letters, numbers, underscore, dot, or dash"
    );
  }
  return parsed;
};

export const getAccountMe = async (req: Request, res: Response) => {
  try {
    const wallet = requireSessionWallet(req);
    const identity = await findAuthIdentityByWallet(wallet);

    try {
      const profile = await getOrCreateAccountProfile(wallet, identity);
      ok(res, {
        wallet,
        sessionId: req.auth?.sessionId ?? null,
        source: req.auth?.source ?? "session",
        storageStatus: "LIVE",
        identity: serializeAccountIdentity(identity),
        profile: serializeAccountProfile(profile),
      });
    } catch (error) {
      if (!isAccountProfileStorageError(error)) {
        throw error;
      }

      ok(res, {
        wallet,
        sessionId: req.auth?.sessionId ?? null,
        source: req.auth?.source ?? "session",
        storageStatus: "MIGRATION_REQUIRED",
        identity: serializeAccountIdentity(identity),
        profile: null,
      });
    }
  } catch (error) {
    handleControllerError(res, error, "GET_ACCOUNT_ME_FAILED");
  }
};

export const updateAccountMe = async (req: Request, res: Response) => {
  try {
    const wallet = requireSessionWallet(req);
    const identity = await findAuthIdentityByWallet(wallet);
    const profile = await updateAccountProfile(wallet, identity, {
      role: parseAccountRole(req.body.role),
      displayName: parseDisplayName(req.body.displayName),
      handle: parseHandle(req.body.handle),
      completeOnboarding: Boolean(req.body.completeOnboarding),
    });

    ok(res, {
      wallet,
      sessionId: req.auth?.sessionId ?? null,
      source: req.auth?.source ?? "session",
      storageStatus: "LIVE",
      identity: serializeAccountIdentity(identity),
      profile: serializeAccountProfile(profile),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      handleControllerError(
        res,
        new HttpError(409, "ACCOUNT_HANDLE_TAKEN", "handle is already taken"),
        "UPDATE_ACCOUNT_ME_FAILED"
      );
      return;
    }

    if (isAccountProfileStorageError(error)) {
      handleControllerError(
        res,
        new HttpError(
          503,
          "ACCOUNT_PROFILE_MIGRATION_REQUIRED",
          "AccountProfile storage is not migrated yet; apply the account profile Prisma migration before production onboarding"
        ),
        "UPDATE_ACCOUNT_ME_FAILED"
      );
      return;
    }

    handleControllerError(res, error, "UPDATE_ACCOUNT_ME_FAILED");
  }
};

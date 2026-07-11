import { PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { HttpError } from "../controllers/http";

export class PilotInviteRequiredError extends HttpError {
  constructor() {
    super(
      403,
      "PILOT_INVITE_REQUIRED",
      "This StreamPump pilot is invite-only. Use an invited wallet to continue."
    );
    this.name = "PilotInviteRequiredError";
  }
}

export const normalizeWalletAddress = (wallet: string): string => new PublicKey(wallet).toBase58();

export const isPilotInviteRequired = (): boolean => config.pilot.inviteOnly;

export const isWalletPilotInvited = (wallet: string): boolean => {
  const normalizedWallet = normalizeWalletAddress(wallet);
  return config.pilot.inviteWallets.includes(normalizedWallet);
};

export const assertPilotWalletInvited = (wallet: string): string => {
  const normalizedWallet = normalizeWalletAddress(wallet);
  if (!isPilotInviteRequired()) {
    return normalizedWallet;
  }

  if (!config.pilot.inviteWallets.includes(normalizedWallet)) {
    throw new PilotInviteRequiredError();
  }

  return normalizedWallet;
};

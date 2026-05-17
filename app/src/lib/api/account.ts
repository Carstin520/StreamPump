import { apiClient } from "./client";
import { AccountMeRecord, AccountRole } from "./types";

type UpdateAccountMeInput = {
  role: AccountRole;
  displayName?: string | null;
  handle?: string | null;
  completeOnboarding?: boolean;
};

export const getAccountMe = (token: string) =>
  apiClient.get<AccountMeRecord>("/account/me", {
    token,
  });

export const updateAccountMe = (token: string, input: UpdateAccountMeInput) =>
  apiClient.put<AccountMeRecord>("/account/me", {
    token,
    body: input,
  });

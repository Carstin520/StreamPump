import { apiClient } from "./client";
import {
  AuthSessionRecord,
  CurrentSessionRecord,
  EmailAuthChallengeRecord,
  IdentityProvider,
  WalletAuthChallengeRecord,
} from "./types";

type ExchangeProviderSessionInput = {
  provider: IdentityProvider;
  providerSubject: string;
  email?: string | null;
  displayName?: string | null;
};

export const exchangeProviderSession = (input: ExchangeProviderSessionInput) =>
  apiClient.post<AuthSessionRecord>("/auth/provider-exchange", {
    body: input,
  });

export const requestEmailLoginCode = (email: string) =>
  apiClient.post<EmailAuthChallengeRecord>("/auth/email/request-code", {
    body: { email },
  });

export const verifyEmailLoginCode = (input: { email: string; code: string }) =>
  apiClient.post<AuthSessionRecord>("/auth/email/verify-code", {
    body: input,
  });

export const createWalletAuthChallenge = (wallet: string) =>
  apiClient.post<WalletAuthChallengeRecord>("/auth/challenge", {
    body: { wallet },
  });

export const verifyWalletAuthChallenge = (input: {
  wallet: string;
  nonce: string;
  signature: string;
}) =>
  apiClient.post<AuthSessionRecord>("/auth/verify", {
    body: input,
  });

export const getCurrentSession = (token: string) =>
  apiClient.get<CurrentSessionRecord>("/auth/session", {
    token,
  });

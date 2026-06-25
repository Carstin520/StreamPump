import { apiClient } from "./client";
import {
  AuthSessionRecord,
  CurrentSessionRecord,
  EmailAuthChallengeRecord,
  IdentityProvider,
  SponsorDocumentUploadRecord,
  SponsorProfileRecord,
  SponsorType,
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

// Demo-day scan entry: provision a per-user ephemeral managed-wallet session from
// the backend wallet pool (B0 contract: POST /auth/ephemeral-session {subject} →
// atomically assigns one pre-funded managed wallet). Until that endpoint ships we
// fall back to the existing (shared) platform-wallet provider-exchange so /try
// still works locally — the fallback is single-wallet and NOT safe for 100
// concurrent; the real per-user path comes from the pool endpoint.
export const provisionEphemeralSession = async (subject: string): Promise<AuthSessionRecord> => {
  try {
    return await apiClient.post<AuthSessionRecord>("/auth/ephemeral-session", {
      body: { subject },
      timeoutMs: 15000,
    });
  } catch (_error) {
    return exchangeProviderSession({
      provider: "EMAIL",
      providerSubject: subject,
      email: subject,
      displayName: "Demo Guest",
    });
  }
};

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
}, token?: string) =>
  apiClient.post<AuthSessionRecord>("/auth/verify", {
    body: input,
    token,
  });

export const getCurrentSession = (token: string) =>
  apiClient.get<CurrentSessionRecord>("/auth/session", {
    token,
  });

export const presignSponsorDocument = (
  input: {
    documentType: "BUSINESS_LICENSE" | "POWER_OF_ATTORNEY";
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  },
  token: string
) =>
  apiClient.post<SponsorDocumentUploadRecord>("/auth/sponsor/documents/presign", {
    body: input,
    token,
    timeoutMs: 15_000,
  });

export const registerSponsorProfile = (
  input: {
    companyName: string;
    sponsorType: SponsorType;
    registrationNumber: string;
    businessLicenseKey: string;
    legalRepresentative: string;
    contactPhone: string;
    contactEmail: string;
    powerOfAttorneyKey?: string | null;
  },
  token: string
) =>
  apiClient.post<SponsorProfileRecord>("/auth/sponsor/register", {
    body: input,
    token,
    timeoutMs: 15_000,
  });

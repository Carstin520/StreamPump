import { apiClient } from "./client";
import { CreatorAuthSignatureRecord } from "./types";

export const requestCreatorAuthSignature = (
  input: {
    twitterHandle: string;
    twitterAccessToken?: string | null;
  },
  token: string
) =>
  apiClient.post<CreatorAuthSignatureRecord>("/content/creator-auth-signature", {
    body: input,
    token,
    timeoutMs: 15_000,
  });

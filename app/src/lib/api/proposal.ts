import { apiClient } from "@/lib/api/client";

export type ProposalBuildTransactionResponse = {
  action: string;
  submitMode: "CLIENT_RELAY";
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: string;
  requiredSigners: string[];
  derived: Record<string, string | null>;
};

export type ProposalProjectionSyncResponse =
  | {
      status: "SYNCED";
      instructionCount: number;
      indexerStatus?: string;
    }
  | {
      status: "FAILED";
      instructionCount?: number;
      indexerStatus?: string;
      error?: string;
    };

export type ProposalSubmitTransactionResponse = {
  signature: string;
  projectionSync: ProposalProjectionSyncResponse;
};

export const buildEndorseProposalTransaction = (
  token: string,
  proposalId: string,
  input: { amount: number | string },
) =>
  apiClient.post<ProposalBuildTransactionResponse>(`/proposals/${proposalId}/endorse/build`, {
    token,
    body: {
      amount: String(input.amount),
    },
  });

export const buildClaimEndorsementTransaction = (token: string, proposalId: string) =>
  apiClient.post<ProposalBuildTransactionResponse>(`/proposals/${proposalId}/endorsement/claim/build`, {
    token,
  });

export const submitProposalTransaction = (
  token: string,
  input: {
    signedTransactionBase64: string;
    recentBlockhash: string;
    lastValidBlockHeight: string;
  },
) =>
  apiClient.post<ProposalSubmitTransactionResponse>("/proposals/transactions/submit", {
    token,
    body: input,
    timeoutMs: 30000,
  });

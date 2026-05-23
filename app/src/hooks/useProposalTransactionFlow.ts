import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import {
  ProposalBuildTransactionResponse,
  ProposalProjectionSyncResponse,
  ProposalSubmitTransactionResponse,
  submitProposalTransaction,
} from "@/lib/api/proposal";
import { getStoredAuthSession } from "@/lib/auth-session";
import { signVersionedTransactionBase64 } from "@/lib/solana/signVersionedTransaction";

export type ProposalTransactionFlowStatus =
  | "idle"
  | "building"
  | "waiting_signature"
  | "submitting"
  | "syncing_projection"
  | "success"
  | "failed";

export type ProposalTransactionFlowState = {
  status: ProposalTransactionFlowStatus;
  signature: string | null;
  projectionSync: ProposalProjectionSyncResponse | null;
  error: string | null;
};

const initialState: ProposalTransactionFlowState = {
  status: "idle",
  signature: null,
  projectionSync: null,
  error: null,
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || "Transaction failed");

export const useProposalTransactionFlow = () => {
  const wallet = useWallet();
  const [state, setState] = useState<ProposalTransactionFlowState>(initialState);

  const reset = useCallback(() => setState(initialState), []);

  const execute = useCallback(
    async (
      build: (token: string) => Promise<ProposalBuildTransactionResponse>
    ): Promise<ProposalSubmitTransactionResponse | null> => {
      const session = getStoredAuthSession();
      if (!session?.accessToken) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: "Sign in before sending an S2 proposal transaction.",
        });
        return null;
      }

      if (!wallet.publicKey || !wallet.connected) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: "Connect a wallet before sending an S2 proposal transaction.",
        });
        return null;
      }

      if (session.wallet && wallet.publicKey.toBase58() !== session.wallet) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: "Connected wallet must match the signed-in wallet session.",
        });
        return null;
      }

      try {
        setState({ status: "building", signature: null, projectionSync: null, error: null });
        const built = await build(session.accessToken);

        setState({ status: "waiting_signature", signature: null, projectionSync: null, error: null });
        const signedTransactionBase64 = await signVersionedTransactionBase64(wallet, built.transactionBase64);

        setState({ status: "submitting", signature: null, projectionSync: null, error: null });
        const submitted = await submitProposalTransaction(session.accessToken, {
          signedTransactionBase64,
          recentBlockhash: built.recentBlockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        });

        setState({
          status: "syncing_projection",
          signature: submitted.signature,
          projectionSync: submitted.projectionSync,
          error: null,
        });

        setState({
          status: "success",
          signature: submitted.signature,
          projectionSync: submitted.projectionSync,
          error: submitted.projectionSync.status === "FAILED" ? submitted.projectionSync.error ?? null : null,
        });

        return submitted;
      } catch (error) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: errorMessage(error),
        });
        return null;
      }
    },
    [wallet],
  );

  return {
    execute,
    reset,
    state,
  };
};

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import {
  executeManagedWalletAction,
  S1BuildTransactionResponse,
  S1ProjectionSyncResponse,
  S1SubmitTransactionResponse,
  submitS1Transaction,
} from "@/lib/api/s1";
import { getStoredAuthSession } from "@/lib/auth-session";
import { signVersionedTransactionBase64 } from "@/lib/solana/signVersionedTransaction";
import { useManagedWallet } from "./useManagedWallet";

export type S1TransactionFlowStatus =
  | "idle"
  | "building"
  | "waiting_signature"
  | "submitting"
  | "syncing_projection"
  | "success"
  | "failed";

export type S1TransactionFlowState = {
  status: S1TransactionFlowStatus;
  signature: string | null;
  projectionSync: S1ProjectionSyncResponse | null;
  error: string | null;
};

const initialState: S1TransactionFlowState = {
  status: "idle",
  signature: null,
  projectionSync: null,
  error: null,
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || "Transaction failed");

export const useS1TransactionFlow = () => {
  const wallet = useWallet();
  const managedWallet = useManagedWallet();
  const [state, setState] = useState<S1TransactionFlowState>(initialState);

  const reset = useCallback(() => setState(initialState), []);

  const execute = useCallback(
    async (
      build: (token: string) => Promise<S1BuildTransactionResponse>,
      managedAction?: { action: string; params?: Record<string, unknown> },
    ): Promise<S1SubmitTransactionResponse | null> => {
      const session = getStoredAuthSession();
      if (!session?.accessToken) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: "Sign in before sending an S1 transaction.",
        });
        return null;
      }

      if (managedWallet.isManagedWallet) {
        if (!managedAction) {
          setState({
            status: "failed",
            signature: null,
            projectionSync: null,
            error: "Managed wallet execution is not available for this action.",
          });
          return null;
        }

        try {
          setState({ status: "building", signature: null, projectionSync: null, error: null });
          const submitted = await executeManagedWalletAction(session.accessToken, managedAction);
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

          return {
            signature: submitted.signature,
            projectionSync: submitted.projectionSync,
          };
        } catch (error) {
          setState({
            status: "failed",
            signature: null,
            projectionSync: null,
            error: errorMessage(error),
          });
          return null;
        }
      }

      if (!wallet.publicKey || !wallet.connected) {
        setState({
          status: "failed",
          signature: null,
          projectionSync: null,
          error: "Connect a wallet before sending an S1 transaction.",
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
        const submitted = await submitS1Transaction(session.accessToken, {
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
    [managedWallet.isManagedWallet, wallet],
  );

  return {
    execute,
    reset,
    state,
  };
};

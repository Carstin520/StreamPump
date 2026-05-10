import { useCallback } from "react";

import { CloseIcon } from "@/components/shared/AppIcons";
import type { S1TransactionFlowState, S1TransactionFlowStatus } from "@/hooks/useS1TransactionFlow";
import { shortenWallet } from "@/lib/s1-market-view";

type S1TransactionDrawerProps = {
  actionLabel: string;
  amountLabel?: string;
  flow: S1TransactionFlowState;
  onClose: () => void;
  onRetry?: () => void;
};

const STEP_CONFIG: Record<
  S1TransactionFlowStatus,
  { idx: number; label: string; tone: "neutral" | "active" | "success" | "error" }
> = {
  idle: { idx: -1, label: "Ready", tone: "neutral" },
  building: { idx: 0, label: "Building transaction", tone: "active" },
  waiting_signature: { idx: 1, label: "Waiting for wallet signature", tone: "active" },
  submitting: { idx: 2, label: "Submitting to network", tone: "active" },
  syncing_projection: { idx: 3, label: "Syncing read model", tone: "active" },
  success: { idx: 4, label: "Confirmed", tone: "success" },
  failed: { idx: -1, label: "Failed", tone: "error" },
};

const STEPS = [
  { key: "building", label: "Build" },
  { key: "waiting_signature", label: "Sign" },
  { key: "submitting", label: "Submit" },
  { key: "syncing_projection", label: "Sync" },
  { key: "success", label: "Done" },
] as const;

const DEVNET_EXPLORER = "https://explorer.solana.com/tx";

export const S1TransactionDrawer = ({
  actionLabel,
  amountLabel,
  flow,
  onClose,
  onRetry,
}: S1TransactionDrawerProps) => {
  if (flow.status === "idle") return null;

  const step = STEP_CONFIG[flow.status];
  const isTerminal = flow.status === "success" || flow.status === "failed";
  const projectionLag = flow.projectionSync?.status === "FAILED";

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.96)_0%,rgba(8,12,20,0.96)_100%)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
            {actionLabel}
          </p>
          <p className={`mt-0.5 text-[13px] font-semibold ${step.tone === "error" ? "text-[#ff8a78]" : step.tone === "success" ? "text-[#8df0c4]" : "text-white"}`}>
            {step.label}
          </p>
          {amountLabel ? (
            <p className="mt-0.5 text-[11px] text-[#9aabc4]">{amountLabel}</p>
          ) : null}
        </div>
        {isTerminal ? (
          <button
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-[#7e90aa] transition hover:text-white"
            onClick={onClose}
            type="button"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        ) : (
          <Spinner />
        )}
      </div>

      <div className="mt-3 flex items-center gap-1">
        {STEPS.map((s, idx) => {
          const isDone = step.idx > idx;
          const isCurrent = step.idx === idx;
          const isFailed = flow.status === "failed";

          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={s.key}>
              <div className="flex w-full items-center">
                <div
                  className={`mx-auto h-1.5 w-full rounded-full transition-colors ${
                    isDone
                      ? "bg-[#65ecaf]"
                      : isCurrent && !isFailed
                        ? "bg-[#de402a] animate-pulse"
                        : isCurrent && isFailed
                          ? "bg-[#f67263]"
                          : "bg-white/[0.06]"
                  }`}
                />
              </div>
              <span
                className={`text-[9px] font-medium ${
                  isDone
                    ? "text-[#8df0c4]"
                    : isCurrent
                      ? isFailed
                        ? "text-[#ff8a78]"
                        : "text-white"
                      : "text-[#5a6b82]"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {flow.signature ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
          <span className="text-[10px] text-[#7486a1]">Tx signature</span>
          <a
            className="font-mono text-[10px] font-medium text-[#67b8ff] transition hover:text-white"
            href={`${DEVNET_EXPLORER}/${flow.signature}?cluster=devnet`}
            rel="noreferrer"
            target="_blank"
          >
            {shortenWallet(flow.signature)} ↗
          </a>
        </div>
      ) : null}

      {projectionLag ? (
        <p className="mt-2 rounded-lg border border-[#f3b33e]/20 bg-[#1a1408]/60 px-2.5 py-1.5 text-[10px] text-[#f3c66e]">
          Transaction confirmed on-chain. Read model may lag until the indexer catches up.
        </p>
      ) : null}

      {flow.error ? (
        <p className="mt-2 rounded-lg border border-[#f67263]/20 bg-[#1a1115]/60 px-2.5 py-1.5 text-[10px] text-[#ff8a78]">
          {flow.error}
        </p>
      ) : null}

      {isTerminal ? (
        <div className="mt-3 flex items-center gap-2">
          {flow.status === "failed" && onRetry ? (
            <button
              className="flex-1 rounded-xl bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] py-2 text-[11px] font-semibold text-white/90 transition hover:brightness-110"
              onClick={onRetry}
              type="button"
            >
              Retry
            </button>
          ) : null}
          <button
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-[11px] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
            onClick={onClose}
            type="button"
          >
            {flow.status === "success" ? "Done" : "Close"}
          </button>
        </div>
      ) : null}
    </div>
  );
};

const Spinner = () => (
  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
);

export const WalletSessionAlert = ({
  connectedWallet,
  sessionWallet,
}: {
  connectedWallet: string | null;
  sessionWallet: string | null;
}) => {
  if (!connectedWallet || !sessionWallet) return null;
  if (connectedWallet === sessionWallet) return null;

  return (
    <div className="rounded-lg border border-[#f3b33e]/25 bg-[#1a1408]/70 px-3 py-2">
      <p className="text-[11px] font-semibold text-[#f3c66e]">Wallet mismatch</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-[#c9a044]">
        Connected wallet ({shortenWallet(connectedWallet)}) differs from your signed-in session ({shortenWallet(sessionWallet)}).
        Switch wallets or sign in again to trade.
      </p>
    </div>
  );
};

export const DemoCreatorBanner = ({
  creatorWallet,
  buyoutHref,
  creatorHref,
  marketHref,
}: {
  creatorWallet: string;
  buyoutHref?: string;
  creatorHref?: string;
  marketHref?: string;
}) => {
  const isDemoEnv = process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === "1" || process.env.NODE_ENV === "development";
  if (!isDemoEnv) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#67b8ff]/15 bg-[#0e1726]/60 px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-[#67b8ff]" />
      <span className="text-[10px] font-medium text-[#8ad0ff]">Demo</span>
      <span className="text-[10px] text-[#7486a1]">
        Creator: {shortenWallet(creatorWallet)}
      </span>
      <a
        className="ml-auto text-[10px] font-medium text-[#8ad0ff] transition hover:text-white"
        href={marketHref ?? `/market/${creatorWallet}`}
      >
        Market ↗
      </a>
      {creatorHref ? (
        <a
          className="text-[10px] font-medium text-[#8ad0ff] transition hover:text-white"
          href={creatorHref}
        >
          Profile ↗
        </a>
      ) : null}
      <a
        className="text-[10px] font-medium text-[#8ad0ff] transition hover:text-white"
        href={buyoutHref ?? `/buyout/${creatorWallet}`}
      >
        Buyout ↗
      </a>
    </div>
  );
};

export const S1LoadingSkeleton = () => (
  <div className="space-y-4 py-6">
    <div className="h-[180px] animate-pulse rounded-[20px] border border-white/[0.05] bg-white/[0.02]" />
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="h-24 animate-pulse rounded-[16px] border border-white/[0.05] bg-white/[0.02]" key={i} />
      ))}
    </div>
    <div className="h-[300px] animate-pulse rounded-[20px] border border-white/[0.05] bg-white/[0.02]" />
  </div>
);

export const S1ErrorState = ({
  error,
  title = "Could not load data",
}: {
  error: string | null;
  title?: string;
}) => (
  <div className="rounded-[16px] border border-[#f67263]/20 bg-[#1a1115]/70 px-4 py-3.5">
    <p className="text-[12px] font-semibold text-[#ff8a78]">{title}</p>
    {error ? <p className="mt-1 text-[11px] text-[#c97065]">{error}</p> : null}
  </div>
);

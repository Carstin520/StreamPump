import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import {
  DemoCreatorBanner,
  S1ErrorState,
  S1LoadingSkeleton,
  S1TransactionDrawer,
  WalletSessionAlert,
} from "@/components/s1/S1TransactionDrawer";
import { DemoActionStatusCard } from "@/components/shared/DemoActionStatusCard";
import { StagePill } from "@/components/shared/StagePill";
import { useDemoActionFlow } from "@/hooks/useDemoActionFlow";
import { useS1TransactionFlow } from "@/hooks/useS1TransactionFlow";
import {
  buildS1ClaimUsdcTransaction,
  buildS1RageQuitTransaction,
  DEMO_S1_CREATOR_WALLET,
  getS1MarketProfile,
  getS1Portfolio,
  S1BuyoutStatus,
  S1MarketProfileResponse,
  S1PortfolioResponse,
} from "@/lib/api/s1";
import { getStoredAuthSession } from "@/lib/auth-session";
import {
  buildDemoS1MarketProfile,
  buildDemoS1Portfolio,
  displayCreatorHandle,
  displayCreatorName,
  findPortfolioPosition,
  formatGraduationProgressPercent,
  formatS1Amount,
  formatUsdcAmount,
  hasClaimableUsdc,
  isDemoCreatorRoute,
  resolveCreatorWalletForRoute,
  resolveFallbackCreator,
  shortenWallet,
} from "@/lib/s1-market-view";
import {
  DEMO_PATH,
  DEMO_S1_BUYOUT_PATH,
  DEMO_S1_CREATOR_PATH,
  DEMO_S1_MARKET_PATH,
  PORTFOLIO_PATH,
} from "@/lib/routes";

/* ------------------------------------------------------------------ */
/*  Phase helpers                                                      */
/* ------------------------------------------------------------------ */

type BuyoutPhase = "none" | "offers_open" | "offer_accepted" | "rage_quit" | "graduated";

const PHASES: { key: BuyoutPhase; label: string }[] = [
  { key: "offers_open", label: "Offers open" },
  { key: "offer_accepted", label: "Accepted" },
  { key: "rage_quit", label: "Rage quit window" },
  { key: "graduated", label: "Graduated" },
];

function phaseFromStatus(status: S1BuyoutStatus | undefined | null): BuyoutPhase {
  if (!status || status === "NONE") return "none";
  if (status === "GRADUATED") return "graduated";
  if (status === "EXECUTION_PENDING") return "rage_quit";
  if (status === "ACCEPTED") return "offer_accepted";
  return "offers_open";
}

/* ------------------------------------------------------------------ */
/*  Phase stepper                                                      */
/* ------------------------------------------------------------------ */

function PhaseStepper({ current }: { current: BuyoutPhase }) {
  const idx = Math.max(0, PHASES.findIndex((p) => p.key === current));

  return (
    <div className="flex items-center justify-between gap-0 overflow-x-auto rounded-[14px] border border-white/[0.05] bg-white/[0.015] px-3 py-3 sm:px-5">
      {PHASES.map((phase, i) => {
        const done = i < idx;
        const active = i === idx && current !== "none";
        return (
          <div className="flex items-center" key={phase.key}>
            {i > 0 ? (
              <div className={`mx-1 h-[1.5px] w-6 sm:w-10 ${done ? "bg-[#65ecaf]/60" : "bg-white/[0.06]"}`} />
            ) : null}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] transition-all ${
                  active
                    ? "border-[#de402a] bg-[#de402a]/15 shadow-[0_0_10px_rgba(222,64,42,0.35)]"
                    : done
                      ? "border-[#65ecaf]/60 bg-[#65ecaf]/10"
                      : "border-white/[0.12] bg-transparent"
                }`}
              >
                {done ? (
                  <svg className="h-2.5 w-2.5 text-[#65ecaf]" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                ) : active ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-[#de402a]" />
                ) : null}
              </div>
              <span
                className={`whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.1em] ${
                  active ? "text-white" : done ? "text-[#8df0c4]/80" : "text-[#5a6d87]"
                }`}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemoRouteRail() {
  const links = [
    { href: DEMO_PATH, label: "Demo hub" },
    { href: DEMO_S1_MARKET_PATH, label: "S1 market" },
    { href: PORTFOLIO_PATH, label: "Portfolio" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#67b8ff]/15 bg-[#0e1726]/55 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">S1 buyout path</span>
      {links.map((link) => (
        <Link
          className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[10px] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary metrics                                                    */
/* ------------------------------------------------------------------ */

function BuyoutMetrics({ buyout, phase }: { buyout: S1MarketProfileResponse["buyout"]; phase: BuyoutPhase }) {
  if (!buyout || phase === "none") return null;

  const items: { label: string; value: string; color?: string }[] = [];

  if (buyout.acceptedOfferUsdc) {
    items.push({ label: "Accepted offer", value: formatUsdcAmount(buyout.acceptedOfferUsdc), color: "text-[#65ecaf]" });
  } else if (buyout.latestOfferUsdc) {
    items.push({ label: "Latest offer", value: formatUsdcAmount(buyout.latestOfferUsdc) });
  }

  if (buyout.winningSponsorWallet) {
    items.push({ label: "Winning sponsor", value: shortenWallet(buyout.winningSponsorWallet) });
  }

  if (buyout.usdcDeposited) {
    items.push({ label: "USDC deposited", value: formatUsdcAmount(buyout.usdcDeposited), color: "text-[#67b8ff]" });
  }

  if (buyout.claimableUsdcRemaining) {
    items.push({ label: "Claimable USDC", value: formatUsdcAmount(buyout.claimableUsdcRemaining), color: "text-[#65ecaf]" });
  }

  if (buyout.claimableS1SupplyRemaining) {
    items.push({ label: "Claimable S1 supply", value: formatS1Amount(buyout.claimableS1SupplyRemaining) });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5" key={it.label}>
          <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{it.label}</p>
          <p className={`mt-1 text-sm font-semibold tracking-[-0.02em] ${it.color ?? "text-white"}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function DiscoveryProgressCard({ profile }: { profile: S1MarketProfileResponse }) {
  const progress = formatGraduationProgressPercent(profile.creator.graduationProgressBps);

  return (
    <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">
          S1 discovery progress
        </span>
        <span className="text-sm font-semibold text-white">{progress}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[#f3b33e]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown                                                          */
/* ------------------------------------------------------------------ */

function Countdown({ deadline }: { deadline: string | null | undefined }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!deadline) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-5 text-center text-xs text-[#8ea0ba]">
        No active rage quit deadline.
      </div>
    );
  }

  const ms = Math.max(0, Date.parse(deadline) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const expired = ms <= 0;

  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-[#de402a]/20 bg-[#1a120e]/60 py-6">
      <span
        className={`font-mono text-[36px] font-semibold tracking-[-0.04em] tabular-nums ${expired ? "text-[#ff8a78]/60" : "text-white"}`}
      >
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8ea0ba]">
        {expired ? "Rage quit window expired" : "Rage quit deadline"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Offers list                                                        */
/* ------------------------------------------------------------------ */

function OffersList({ offers, acceptedPda }: { offers: S1MarketProfileResponse["offers"]; acceptedPda: string | null }) {
  if (offers.length === 0) {
    return (
      <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.015] p-4 text-center text-xs text-[#8ea0ba]">
        No sponsor offers yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.05]">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_1fr_90px_80px] gap-2 border-b border-white/[0.04] bg-white/[0.015] px-3.5 py-2">
        {["Sponsor", "Amount", "Status", "Expires"].map((h) => (
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#5a6d87]" key={h}>{h}</span>
        ))}
      </div>
      {offers.map((offer) => {
        const isAccepted = offer.buyoutOfferPda === acceptedPda;
        return (
          <div
            className={`grid grid-cols-[1fr_1fr_90px_80px] items-center gap-2 border-b border-white/[0.03] px-3.5 py-2.5 last:border-0 ${
              isAccepted ? "bg-[#65ecaf]/[0.04]" : "bg-transparent"
            }`}
            key={offer.buyoutOfferPda}
          >
            <span className="truncate font-mono text-[11px] font-medium text-white">{shortenWallet(offer.sponsorWallet)}</span>
            <span className="text-[12px] font-semibold text-white">{formatUsdcAmount(offer.usdcAmount)}</span>
            <span className={`text-[10px] font-medium ${isAccepted ? "text-[#65ecaf]" : "text-[#8ea0ba]"}`}>
              {isAccepted ? "Accepted" : offer.status}
            </span>
            <span className="text-[10px] text-[#6f8099]">
              {offer.sponsorCancelAfterAt ? new Date(offer.sponsorCancelAfterAt).toLocaleDateString() : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rage quit panel                                                    */
/* ------------------------------------------------------------------ */

function RageQuitPanel({
  active,
  creatorWallet,
  currentPriceSpump,
  isDemoRoute,
  onDemoExit,
  onRefresh,
  positionBalance,
  sessionWallet,
}: {
  active: boolean;
  creatorWallet: string;
  currentPriceSpump?: string | null;
  isDemoRoute?: boolean;
  onDemoExit?: (amount: number) => void;
  onRefresh: () => Promise<void>;
  positionBalance: string;
  sessionWallet: string | null;
}) {
  const maxTokens = Math.max(0, Number(positionBalance || 0));
  const [amount, setAmount] = useState(maxTokens > 0 ? 1 : 0);
  const demoFlow = useDemoActionFlow();
  const flow = useS1TransactionFlow();
  const wallet = useWallet();

  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const walletMismatch = sessionWallet && connectedWallet && sessionWallet !== connectedWallet;
  const signedIn = Boolean(sessionWallet && wallet.connected && !walletMismatch);

  useEffect(() => {
    setAmount(maxTokens > 0 ? Math.min(1, maxTokens) : 0);
  }, [maxTokens]);

  const execute = useCallback(async () => {
    const submitted = await flow.execute((token) =>
      buildS1RageQuitTransaction(token, { creatorWallet, amount }),
    );
    if (submitted) await onRefresh();
  }, [flow, creatorWallet, amount, onRefresh]);

  const executeDemoExit = useCallback(
    (options?: { fail?: boolean }) => {
      demoFlow.submit({
        fail: options?.fail,
        onSuccess: () => onDemoExit?.(amount),
      });
    },
    [amount, demoFlow, onDemoExit],
  );

  const busy = flow.state.status === "building" || flow.state.status === "waiting_signature" || flow.state.status === "submitting" || flow.state.status === "syncing_projection";
  const demoBusy = demoFlow.state.status === "submitted";

  return (
    <div className={`rounded-[14px] border p-5 ${active ? "border-[#de402a]/25 bg-[#1a120e]/50" : "border-white/[0.05] bg-white/[0.015] opacity-70"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#de402a]">Rage Quit</h3>
        <span className="text-[10px] text-[#8ea0ba]">{formatS1Amount(positionBalance)} S1 held</span>
      </div>

      {maxTokens <= 0 ? (
        <p className="mt-3 text-xs text-[#6f8099]">No S1 position to rage quit.</p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#5a6d87]">Exit amount</span>
            <div className="flex items-center gap-2">
              <input
                className="w-16 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-right text-sm font-bold text-white outline-none transition focus:border-white/[0.16]"
                disabled={!active || demoBusy}
                max={maxTokens}
                min={1}
                onChange={(e) => { setAmount(Math.max(1, Math.min(maxTokens, Number(e.target.value) || 1))); demoFlow.reset(); }}
                type="number"
                value={amount}
              />
              <button
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] font-semibold text-[#8ea0ba] transition hover:text-white disabled:opacity-40"
                disabled={!active || demoBusy}
                onClick={() => { setAmount(maxTokens); demoFlow.reset(); }}
                type="button"
              >
                Max
              </button>
            </div>
          </div>

          <input
            className="mt-3 w-full accent-[#de402a]"
            disabled={!active || demoBusy}
            max={maxTokens}
            min={1}
            onChange={(e) => { setAmount(Number(e.target.value)); demoFlow.reset(); }}
            type="range"
            value={amount}
          />

          {currentPriceSpump && Number(currentPriceSpump) > 0 ? (
            <div className="mt-3 flex items-center justify-between rounded-[10px] border border-[#65ecaf]/15 bg-[#0e1f17]/40 px-3 py-2.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8ea0ba]">Est. SPUMP return</span>
              <span className="text-sm font-semibold tracking-[-0.02em] text-[#65ecaf]">
                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount * Number(currentPriceSpump) / 1_000_000_000)} SPUMP
              </span>
            </div>
          ) : null}

          <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />

          {isDemoRoute ? (
            <>
              <button
                className={`mt-4 w-full rounded-full py-2.5 text-[12px] font-semibold transition-all ${
                  active && amount > 0
                    ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.8)_0%,rgba(190,52,34,0.8)_100%)] text-white shadow-[0_6px_20px_rgba(222,64,42,0.2)] hover:brightness-110"
                    : "cursor-not-allowed bg-white/[0.04] text-white/30"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={!active || amount <= 0 || demoBusy || demoFlow.state.status === "success"}
                onClick={demoFlow.begin}
                type="button"
              >
                {demoBusy
                  ? "Submitting..."
                  : demoFlow.state.status === "success"
                    ? "Exited"
                    : "Exit Position"}
              </button>
              <DemoActionStatusCard
                amountLabel={`${amount} S1`}
                confirmLabel="Confirm Exit Position"
                description="Confirm this mock rage quit. The local S1 position decreases after submission."
                onCancel={demoFlow.reset}
                onConfirm={executeDemoExit}
                onRetry={demoFlow.retry}
                state={demoFlow.state}
                successLabel="Exited"
                title="Rage quit confirmation"
              />
            </>
          ) : !signedIn ? (
            <div className="mt-4 space-y-2">
              <WalletMultiButton className="!w-full !justify-center !rounded-full !text-sm" />
              <Link
                className="block text-center text-[11px] font-medium text-[#67b8ff] transition hover:text-white"
                href={`/login?next=/buyout/${creatorWallet}`}
              >
                {walletMismatch ? "Sign in again" : "Sign in to rage quit"}
              </Link>
            </div>
          ) : (
            <button
              className={`mt-4 w-full rounded-full py-2.5 text-[12px] font-semibold transition-all ${
                active && amount > 0
                  ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.8)_0%,rgba(190,52,34,0.8)_100%)] text-white shadow-[0_6px_20px_rgba(222,64,42,0.2)] hover:brightness-110"
                  : "cursor-not-allowed bg-white/[0.04] text-white/30"
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={!active || amount <= 0 || busy}
              onClick={() => void execute()}
              type="button"
            >
              {busy ? "Processing..." : "Exit position"}
            </button>
          )}
        </>
      )}

      <div className="mt-3">
        <S1TransactionDrawer
          actionLabel="Rage Quit"
          amountLabel={`${amount} S1`}
          flow={flow.state}
          onClose={flow.reset}
          onRetry={active ? () => void execute() : undefined}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claim panel                                                        */
/* ------------------------------------------------------------------ */

function ClaimPanel({
  claimableUsdc,
  creatorWallet,
  isDemoRoute,
  onDemoClaim,
  onRefresh,
  positionBalance,
  sessionWallet,
  sponsorWallet,
}: {
  claimableUsdc: string | null;
  creatorWallet: string;
  isDemoRoute?: boolean;
  onDemoClaim?: () => void;
  onRefresh: () => Promise<void>;
  positionBalance: string;
  sessionWallet: string | null;
  sponsorWallet: string | null;
}) {
  const demoFlow = useDemoActionFlow();
  const flow = useS1TransactionFlow();
  const wallet = useWallet();

  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const walletMismatch = sessionWallet && connectedWallet && sessionWallet !== connectedWallet;
  const signedIn = Boolean(sessionWallet && wallet.connected && !walletMismatch);
  const hasClaimable = hasClaimableUsdc(claimableUsdc) && Number(positionBalance || 0) > 0;
  const canClaim = isDemoRoute ? Boolean(sponsorWallet && hasClaimable) : Boolean(signedIn && sponsorWallet && hasClaimable);

  const execute = useCallback(async () => {
    if (!sponsorWallet) return;
    const submitted = await flow.execute((token) =>
      buildS1ClaimUsdcTransaction(token, { creatorWallet, sponsorWallet }),
    );
    if (submitted) await onRefresh();
  }, [flow, creatorWallet, sponsorWallet, onRefresh]);

  const executeDemoClaim = useCallback(
    (options?: { fail?: boolean }) => {
      demoFlow.submit({
        fail: options?.fail,
        onSuccess: onDemoClaim,
      });
    },
    [demoFlow, onDemoClaim],
  );

  const busy = flow.state.status === "building" || flow.state.status === "waiting_signature" || flow.state.status === "submitting" || flow.state.status === "syncing_projection";
  const demoBusy = demoFlow.state.status === "submitted";

  return (
    <div className="rounded-[14px] border border-[#65ecaf]/15 bg-[#0e1f17]/40 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#65ecaf]">Claim USDC</h3>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#f3b33e]">Your position</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{formatS1Amount(positionBalance)} S1</p>
        </div>
        <div className="rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#67b8ff]">Claimable</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{formatUsdcAmount(claimableUsdc)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] text-[#8ea0ba]">{canClaim ? "Ready to claim" : "Watch only"}</p>
          <p className="mt-0.5 font-mono text-[11px] font-medium text-white">{sponsorWallet ? shortenWallet(sponsorWallet) : "No winning sponsor"}</p>
        </div>
        {isDemoRoute ? (
          <button
            className="rounded-full bg-[#65ecaf] px-5 py-2 text-[12px] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canClaim || demoBusy || demoFlow.state.status === "success"}
            onClick={demoFlow.begin}
            type="button"
          >
            {demoBusy ? "Submitting..." : demoFlow.state.status === "success" ? "Claimed" : "Claim"}
          </button>
        ) : signedIn ? (
          <button
            className="rounded-full bg-[#65ecaf] px-5 py-2 text-[12px] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canClaim || busy}
            onClick={() => void execute()}
            type="button"
          >
            {busy ? "Processing..." : "Claim"}
          </button>
        ) : (
          <div className="space-y-2">
            <WalletMultiButton className="!rounded-full !text-sm" />
            <Link
              className="block text-center text-[11px] font-medium text-[#67b8ff] transition hover:text-white"
              href={`/login?next=/buyout/${creatorWallet}`}
            >
              {walletMismatch ? "Sign in again" : "Sign in to claim"}
            </Link>
          </div>
        )}
      </div>

      <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />

      {isDemoRoute ? (
        <DemoActionStatusCard
          amountLabel={formatUsdcAmount(claimableUsdc)}
          confirmLabel="Confirm Claim"
          description="Confirm this mock claim. The claimable USDC clears locally after submission."
          onCancel={demoFlow.reset}
          onConfirm={executeDemoClaim}
          onRetry={demoFlow.retry}
          state={demoFlow.state}
          successLabel="Claimed"
          title="Claim confirmation"
        />
      ) : null}

      <div className="mt-3">
        <S1TransactionDrawer
          actionLabel="Claim USDC"
          flow={flow.state}
          onClose={flow.reset}
          onRetry={canClaim ? () => void execute() : undefined}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function BuyoutPage() {
  const router = useRouter();
  const creatorId = String(router.query.creatorId ?? "");
  const fallbackCreator = useMemo(() => resolveFallbackCreator(creatorId || "luna-cai"), [creatorId]);
  const creatorWallet = useMemo(() => (creatorId ? resolveCreatorWalletForRoute(creatorId) : ""), [creatorId]);
  const isDemoRoute = useMemo(() => isDemoCreatorRoute(creatorId), [creatorId]);
  const [profile, setProfile] = useState<S1MarketProfileResponse | null>(null);
  const [portfolio, setPortfolio] = useState<S1PortfolioResponse | null>(null);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [demoSummary, setDemoSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!creatorWallet) return;
    const session = getStoredAuthSession();
    setSessionWallet(session?.wallet ?? null);
    if (isDemoRoute) {
      const demoProfile = buildDemoS1MarketProfile(fallbackCreator);
      setProfile(demoProfile);
      setPortfolio(buildDemoS1Portfolio(creatorWallet, demoProfile));
      return;
    }

    const marketProfile = await getS1MarketProfile(creatorWallet);
    setProfile(marketProfile);

    if (session?.accessToken) {
      try {
        setPortfolio(await getS1Portfolio(session.accessToken));
      } catch {
        setPortfolio(null);
      }
    } else {
      setPortfolio(null);
    }
  }, [creatorWallet, fallbackCreator, isDemoRoute]);

  useEffect(() => {
    if (!creatorWallet) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    refresh()
      .catch((e) => {
        if (!cancelled) {
          setProfile(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [creatorWallet, refresh]);

  const title = displayCreatorName(profile, fallbackCreator);
  const handle = displayCreatorHandle(profile, fallbackCreator);
  const phase = phaseFromStatus(profile?.buyout?.status);
  const position = findPortfolioPosition(portfolio, creatorWallet ?? "");
  const positionBalance = position?.internalTokenBalance ?? "0";

  const rageQuitActive =
    phase === "rage_quit" &&
    Boolean(profile?.buyout?.rageQuitDeadlineAt) &&
    Date.parse(profile?.buyout?.rageQuitDeadlineAt ?? "") > Date.now();

  const handleDemoExit = useCallback(
    (amount: number) => {
      const currentPrice = Number(profile?.creator.currentPriceSpump || 0);
      const spumpReturned = currentPrice > 0 ? amount * (currentPrice / 1_000_000_000) : 0;
      const currentPositionBalance = Math.max(0, Number(position?.internalTokenBalance || 0));
      const nextPositionBalance = Math.max(0, currentPositionBalance - amount);
      const retainedPositionRatio = currentPositionBalance > 0 ? nextPositionBalance / currentPositionBalance : 0;
      const currentPositionClaimable = Number(
        position?.estimatedClaimableUsdc ?? profile?.buyout?.claimableUsdcRemaining ?? 0,
      );
      const nextPositionClaimable = Math.round(currentPositionClaimable * retainedPositionRatio);
      const spumpReturnedLabel = spumpReturned >= 1_000_000
        ? `${(spumpReturned / 1_000_000).toFixed(1)}M`
        : spumpReturned >= 1_000
          ? `${(spumpReturned / 1_000).toFixed(1)}K`
          : spumpReturned.toFixed(0);

      setPortfolio((current) => {
        if (!current) return current;
        return {
          ...current,
          positions: current.positions.map((item) => {
            if (item.creatorWallet !== creatorWallet && item.creator?.creatorWallet !== creatorWallet) {
              return item;
            }
            const currentBalance = Math.max(0, Number(item.internalTokenBalance || 0));
            const nextBalance = Math.max(0, currentBalance - amount);
            const currentCostBasis = Math.max(0, Number(item.spumpCostBasis || 0));
            const retainedRatio = currentBalance > 0 ? nextBalance / currentBalance : 0;
            return {
              ...item,
              internalTokenBalance: String(Math.round(nextBalance)),
              spumpCostBasis: String(Math.round(currentCostBasis * retainedRatio)),
              estimatedClaimableUsdc: String(nextPositionClaimable),
              updatedAt: new Date().toISOString(),
            };
          }),
        };
      });

      setProfile((current) => {
        if (!current?.buyout) return current;
        const totalSupply = Number(current.buyout.claimableS1SupplyRemaining || 0);
        const nextSupply = Math.max(0, totalSupply - amount);
        const supplyRatio = totalSupply > 0 ? nextSupply / totalSupply : 0;
        const totalClaimable = Number(current.buyout.claimableUsdcRemaining || 0);
        return {
          ...current,
          creator: {
            ...current.creator,
            s1Supply: String(Math.max(0, Number(current.creator.s1Supply || 0) - amount)),
          },
          buyout: {
            ...current.buyout,
            claimableS1SupplyRemaining: String(Math.round(nextSupply)),
            claimableUsdcRemaining: String(
              currentPositionBalance > 0 ? nextPositionClaimable : Math.round(totalClaimable * supplyRatio),
            ),
          },
        };
      });

      setDemoSummary(`Rage quit ${amount} S1 → received ~${spumpReturnedLabel} SPUMP (zero exit tax).`);
    },
    [
      creatorWallet,
      position?.estimatedClaimableUsdc,
      position?.internalTokenBalance,
      profile?.buyout?.claimableUsdcRemaining,
      profile?.creator.currentPriceSpump,
    ],
  );

  const handleDemoClaim = useCallback(() => {
    const claimedLabel = formatUsdcAmount(position?.estimatedClaimableUsdc ?? null);
    setPortfolio((current) => {
      if (!current) return current;
      return {
        ...current,
        positions: current.positions.map((item) =>
          item.creatorWallet === creatorWallet || item.creator?.creatorWallet === creatorWallet
            ? { ...item, estimatedClaimableUsdc: "0", updatedAt: new Date().toISOString() }
            : item,
        ),
      };
    });
    setDemoSummary(`Claimed ${claimedLabel} in the mock buyout flow.`);
  }, [creatorWallet, position?.estimatedClaimableUsdc]);

  if (!creatorId || loading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl">
          <S1LoadingSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!creatorWallet) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl space-y-4 py-6">
          <S1ErrorState
            error="This route is a local creator preview slug, not a live S1 wallet address."
            title={`No live buyout for ${fallbackCreator.name}`}
          />
          <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
        </div>
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl space-y-4 py-6">
          <S1ErrorState error={error} title={`Could not load buyout for ${fallbackCreator.name}`} />
          <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <Head><title>{`StreamPump | ${title} Buyout Room`}</title></Head>
      <PageShell>
        <div className="mx-auto max-w-4xl space-y-4">
          <DemoCreatorBanner
            buyoutHref={isDemoRoute ? DEMO_S1_BUYOUT_PATH : undefined}
            creatorHref={isDemoRoute ? DEMO_S1_CREATOR_PATH : undefined}
            creatorWallet={profile.creator.creatorWallet}
            marketHref={isDemoRoute ? DEMO_S1_MARKET_PATH : undefined}
          />
          {isDemoRoute ? <DemoRouteRail /> : null}

          {/* Header */}
          <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-[#7e90aa] transition hover:bg-white/[0.08]"
                href={isDemoRoute ? DEMO_S1_MARKET_PATH : `/market/${creatorWallet}`}
              >
                <span aria-hidden className="text-sm">‹</span>
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">S1 Buyout Room</p>
                <h1 className="mt-0.5 truncate text-xl font-bold tracking-[-0.03em] text-white">{title}</h1>
                <p className="mt-0.5 truncate text-xs text-[#8ea0ba]">
                  @{handle} · {shortenWallet(profile.creator.creatorWallet)}
                </p>
              </div>
              <StagePill className="hidden sm:inline-flex" stage={profile.creator.stage} />
            </div>
          </div>

          {/* Phase stepper */}
          <PhaseStepper current={phase} />

          {/* Buyout metrics */}
          <BuyoutMetrics buyout={profile.buyout} phase={phase} />

          {/* No buyout state */}
          {phase === "none" ? (
            <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-8 text-center">
              <p className="text-base font-semibold text-white">No active buyout</p>
              <p className="mt-1.5 text-xs text-[#8ea0ba]">
                This creator is in S1 discovery. Buyout offers may appear when the market matures.
              </p>
              <DiscoveryProgressCard profile={profile} />
              <Link
                className="mt-4 inline-flex items-center text-[11px] font-medium text-[#67b8ff] transition hover:text-white"
                href={isDemoRoute ? DEMO_S1_MARKET_PATH : `/market/${creatorWallet}`}
              >
                ← Back to market
              </Link>
            </div>
          ) : null}

          {/* Countdown for rage quit */}
          {phase === "rage_quit" ? <Countdown deadline={profile.buyout?.rageQuitDeadlineAt} /> : null}

          {/* Two-column layout: offers + action panel */}
          {phase !== "none" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              {/* Offers */}
              <section className="space-y-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ea0ba]">
                  Sponsor offers
                </h2>
                <OffersList
                  acceptedPda={profile.buyout?.acceptedOfferPda ?? null}
                  offers={profile.offers}
                />
              </section>

              {/* Action panels */}
              <div className="space-y-4">
                {(phase === "rage_quit" || phase === "offer_accepted") ? (
                  <RageQuitPanel
                    active={rageQuitActive}
                    creatorWallet={profile.creator.creatorWallet}
                    currentPriceSpump={profile.creator.currentPriceSpump}
                    isDemoRoute={isDemoRoute}
                    onDemoExit={handleDemoExit}
                    onRefresh={refresh}
                    positionBalance={positionBalance}
                    sessionWallet={sessionWallet}
                  />
                ) : null}

                {phase === "graduated" || isDemoRoute ? (
                  <ClaimPanel
                    claimableUsdc={position?.estimatedClaimableUsdc ?? null}
                    creatorWallet={profile.creator.creatorWallet}
                    isDemoRoute={isDemoRoute}
                    onDemoClaim={handleDemoClaim}
                    onRefresh={refresh}
                    positionBalance={positionBalance}
                    sessionWallet={sessionWallet}
                    sponsorWallet={profile.buyout?.winningSponsorWallet ?? null}
                  />
                ) : null}

                {demoSummary ? (
                  <div className="rounded-[12px] border border-[#65ecaf]/20 bg-[#0e1f17]/45 px-3.5 py-3 text-[12px] font-medium text-[#8df0c4]">
                    {demoSummary}
                  </div>
                ) : null}

                {/* Position summary */}
                <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                  <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">Your S1 position</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatS1Amount(positionBalance)} S1</p>
                  {position?.estimatedClaimableUsdc && hasClaimableUsdc(position.estimatedClaimableUsdc) ? (
                    <p className="mt-0.5 text-[11px] text-[#65ecaf]">
                      Claimable: {formatUsdcAmount(position.estimatedClaimableUsdc)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PageShell>
    </>
  );
}

(BuyoutPage as typeof BuyoutPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;

export default BuyoutPage;

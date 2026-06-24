import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
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
  S1_MOCK_ACCESS_TOKEN,
  S1BuyoutStatus,
  S1MarketProfileResponse,
  S1PortfolioResponse,
} from "@/lib/api/s1";
import { getStoredAuthSession } from "@/lib/auth-session";
import { type Locale, useI18n } from "@/lib/i18n";
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

const PHASES: { key: BuyoutPhase; i18nKey: string }[] = [
  { key: "offers_open", i18nKey: "buyout.phase.offersOpen" },
  { key: "offer_accepted", i18nKey: "buyout.phase.accepted" },
  { key: "rage_quit", i18nKey: "buyout.phase.rageQuitWindow" },
  { key: "graduated", i18nKey: "buyout.phase.graduated" },
];

function phaseFromStatus(status: S1BuyoutStatus | undefined | null): BuyoutPhase {
  if (!status || status === "NONE") return "none";
  if (status === "GRADUATED") return "graduated";
  if (status === "EXECUTION_PENDING" || status === "RAGE_QUIT_OPEN") return "rage_quit";
  if (status === "ACCEPTED" || status === "OFFER_ACCEPTED") return "offer_accepted";
  return "offers_open";
}

/* ------------------------------------------------------------------ */
/*  Phase stepper                                                      */
/* ------------------------------------------------------------------ */

function PhaseStepper({ current }: { current: BuyoutPhase }) {
  const { t } = useI18n();
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
                className={`whitespace-nowrap text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.1em] ${
                  active ? "text-white" : done ? "text-[#8df0c4]/80" : "text-[#5a6d87]"
                }`}
              >
                {t(phase.i18nKey)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemoRouteRail() {
  const { t } = useI18n();
  const links = [
    { href: DEMO_PATH, labelKey: "buyout.demoHub" },
    { href: DEMO_S1_MARKET_PATH, labelKey: "buyout.demoS1Market" },
    { href: PORTFOLIO_PATH, labelKey: "buyout.demoPortfolio" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#67b8ff]/15 bg-[#0e1726]/55 px-3 py-2">
      <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">{t("buyout.demoRoutePath")}</span>
      {links.map((link) => (
        <Link
          className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
          href={link.href}
          key={link.href}
        >
          {t(link.labelKey)}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary metrics                                                    */
/* ------------------------------------------------------------------ */

function BuyoutMetrics({ buyout, phase }: { buyout: S1MarketProfileResponse["buyout"]; phase: BuyoutPhase }) {
  const { t } = useI18n();
  if (!buyout || phase === "none") return null;

  const items: { labelKey: string; value: string; color?: string }[] = [];

  if (buyout.acceptedOfferUsdc) {
    items.push({ labelKey: "buyout.metric.acceptedOffer", value: formatUsdcAmount(buyout.acceptedOfferUsdc), color: "text-[#65ecaf]" });
  } else if (buyout.latestOfferUsdc) {
    items.push({ labelKey: "buyout.metric.latestOffer", value: formatUsdcAmount(buyout.latestOfferUsdc) });
  }

  if (buyout.winningSponsorWallet) {
    items.push({ labelKey: "buyout.metric.winningSponsor", value: shortenWallet(buyout.winningSponsorWallet) });
  }

  if (buyout.usdcDeposited) {
    items.push({ labelKey: "buyout.metric.usdcDeposited", value: formatUsdcAmount(buyout.usdcDeposited), color: "text-[#67b8ff]" });
  }

  if (buyout.creatorPayoutUsdc) {
    items.push({ labelKey: "buyout.metric.creatorPayout", value: formatUsdcAmount(buyout.creatorPayoutUsdc), color: "text-[#65ecaf]" });
  }

  const discoveryPool = buyout.discoveryPoolRemaining ?? buyout.claimableUsdcRemaining;
  if (discoveryPool) {
    items.push({ labelKey: "buyout.metric.discoveryPoolLeft", value: formatUsdcAmount(discoveryPool), color: "text-[#67b8ff]" });
  }

  if (typeof buyout.eligibleHolderCount === "number") {
    items.push({ labelKey: "buyout.metric.eligibleBackers", value: String(buyout.eligibleHolderCount) });
  } else if (buyout.claimableS1SupplyRemaining) {
    items.push({ labelKey: "buyout.metric.eligibleSnapshot", value: formatS1Amount(buyout.claimableS1SupplyRemaining) });
  }

  if (buyout.graduatedAt) {
    items.push({ labelKey: "buyout.metric.graduated", value: new Date(buyout.graduatedAt).toLocaleDateString() });
  }

  if (buyout.residualSwept) {
    items.push({ labelKey: "buyout.metric.residualLabel", value: t("buyout.metric.residualSwept"), color: "text-[#f3b33e]" });
  }

  if (buyout.vaultClosed) {
    items.push({ labelKey: "buyout.metric.vaultLabel", value: t("buyout.metric.vaultClosed"), color: "text-[#f3b33e]" });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5" key={it.labelKey}>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{t(it.labelKey)}</p>
          <p className={`mt-1 text-sm font-semibold tracking-[-0.02em] ${it.color ?? "text-white"}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function BuyoutLifecycleNotice({ buyout }: { buyout: S1MarketProfileResponse["buyout"] }) {
  const { t } = useI18n();
  if (!buyout) return null;

  if (buyout.residualSwept) {
    return (
      <section className="rounded-[14px] border tone-state-warning px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em]">
          {t("buyout.lifecycle.sweptTitle")}
        </p>
        <p className="mt-1 text-xs leading-5">
          {buyout.residualSweptAt
            ? t("buyout.lifecycle.sweptBody", { date: new Date(buyout.residualSweptAt).toLocaleString() })
            : t("buyout.lifecycle.sweptBodyNoDate")}
        </p>
      </section>
    );
  }

  if (buyout.vaultClosed) {
    return (
      <section className="rounded-[14px] border tone-state-warning px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em]">
          {t("buyout.lifecycle.vaultClosedTitle")}
        </p>
        <p className="mt-1 text-xs leading-5">
          {t("buyout.lifecycle.vaultClosedBody")}
        </p>
      </section>
    );
  }

  if (buyout.graduatedAt) {
    return (
      <section className="rounded-[14px] border border-[#67b8ff]/15 bg-[#0d1b2a]/45 px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">
          {t("buyout.lifecycle.claimWindowTitle")}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
          {t("buyout.lifecycle.claimWindowBody", { date: new Date(buyout.graduatedAt).toLocaleString() })}
        </p>
      </section>
    );
  }

  return null;
}

function DiscoveryProgressCard({ profile }: { profile: S1MarketProfileResponse }) {
  const { t } = useI18n();
  const progress = formatGraduationProgressPercent(profile.creator.graduationProgressBps);

  return (
    <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">
          {t("buyout.discoveryProgress")}
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
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!deadline) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-5 text-center text-xs text-[#8ea0ba]">
        {t("buyout.countdown.noDeadline")}
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
        className={`font-mono text-[36px] font-semibold tracking-[-0.04em] tabular-nums ${expired ? "text-[color:var(--state-danger)]" : "text-white"}`}
      >
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <span className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#8ea0ba]">
        {expired ? t("buyout.countdown.expired") : t("buyout.countdown.deadline")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Offers list                                                        */
/* ------------------------------------------------------------------ */

const OFFER_STATUS_KEYS: Record<string, string> = {
  OPEN: "buyout.offerStatus.open",
  OUTBID: "buyout.offerStatus.outbid",
  ACCEPTED: "buyout.offerStatus.accepted",
  CANCELLED: "buyout.offerStatus.cancelled",
  CANCELED: "buyout.offerStatus.cancelled",
  EXPIRED: "buyout.offerStatus.expired",
  WITHDRAWN: "buyout.offerStatus.withdrawn",
  ABORTED: "buyout.offerStatus.aborted",
  PENDING: "buyout.offerStatus.pending",
};

function OffersList({ offers, acceptedPda }: { offers: S1MarketProfileResponse["offers"]; acceptedPda: string | null }) {
  const { t } = useI18n();
  if (offers.length === 0) {
    return (
      <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.015] p-4 text-center text-xs text-[#8ea0ba]">
        {t("buyout.offers.none")}
      </div>
    );
  }

  const headers = [
    t("buyout.offers.sponsor"),
    t("buyout.offers.amount"),
    t("buyout.offers.status"),
    t("buyout.offers.expires"),
  ];

  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.05]">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_1fr_90px_80px] gap-2 border-b border-white/[0.04] bg-white/[0.015] px-3.5 py-2">
        {headers.map((h) => (
          <span className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] text-[#5a6d87]" key={h}>{h}</span>
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
            <span className="truncate font-mono text-[length:var(--fs-micro)] font-medium text-white">{shortenWallet(offer.sponsorWallet)}</span>
            <span className="text-[length:var(--fs-overline)] font-semibold text-white">{formatUsdcAmount(offer.usdcAmount)}</span>
            <span className={`text-[length:var(--fs-micro)] font-medium ${isAccepted ? "text-[#65ecaf]" : "text-[#8ea0ba]"}`}>
              {isAccepted
                ? t("buyout.offers.accepted")
                : OFFER_STATUS_KEYS[offer.status]
                  ? t(OFFER_STATUS_KEYS[offer.status])
                  : offer.status}
            </span>
            <span className="text-[length:var(--fs-micro)] text-[#6f8099]">
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
  estimatedClaimableUsdc,
  isDemoRoute,
  onDemoExit,
  onRefresh,
  positionBalance,
  sessionWallet,
}: {
  active: boolean;
  creatorWallet: string;
  currentPriceSpump?: string | null;
  estimatedClaimableUsdc?: string | null;
  isDemoRoute?: boolean;
  onDemoExit?: (amount: number) => void;
  onRefresh: () => Promise<void>;
  positionBalance: string;
  sessionWallet: string | null;
}) {
  const { t } = useI18n();
  const maxTokens = Math.max(0, Number(positionBalance || 0));
  const [amount, setAmount] = useState(maxTokens > 0 ? 1 : 0);
  const demoFlow = useDemoActionFlow();
  const flow = useS1TransactionFlow();
  const wallet = useWallet();

  const sessionToken = getStoredAuthSession()?.accessToken ?? null;
  const isLocalDemoSession = sessionToken === S1_MOCK_ACCESS_TOKEN;
  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const walletMismatch = sessionWallet && connectedWallet && sessionWallet !== connectedWallet;
  const signedIn = Boolean(sessionToken && !isLocalDemoSession && sessionWallet && wallet.connected && !walletMismatch);
  const estimatedSpumpReturn =
    currentPriceSpump && Number(currentPriceSpump) > 0
      ? amount * Number(currentPriceSpump) / 1_000_000_000
      : null;
  const estimatedSpumpReturnLabel =
    estimatedSpumpReturn === null
      ? t("buyout.rageQuit.pendingQuote")
      : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(estimatedSpumpReturn)} SPUMP`;

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
        <h3 className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em] text-[#de402a]">{t("buyout.rageQuit.title")}</h3>
        <span className="text-[length:var(--fs-micro)] text-[#8ea0ba]">{t("buyout.rageQuit.heldLabel", { amount: formatS1Amount(positionBalance) })}</span>
      </div>

      {maxTokens <= 0 ? (
        <p className="mt-3 text-xs text-[#6f8099]">{t("buyout.rageQuit.noPosition")}</p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.14em] text-[#5a6d87]">{t("buyout.rageQuit.exitAmount")}</span>
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
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[length:var(--fs-nano)] font-semibold text-[#8ea0ba] transition hover:text-white disabled:opacity-40"
                disabled={!active || demoBusy}
                onClick={() => { setAmount(maxTokens); demoFlow.reset(); }}
                type="button"
              >
                {t("buyout.rageQuit.max")}
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

          <div className="mt-3 grid gap-2">
            <div className="rounded-[10px] border border-[#de402a]/20 bg-[#21100d]/45 px-3 py-2.5">
              <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.14em] text-[#ff9a88]">
                {t("buyout.rageQuit.exitOptionLabel")}
              </p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">
                {t("buyout.rageQuit.youReceive", { value: estimatedSpumpReturnLabel })}
              </p>
            </div>
            <div className="rounded-[10px] border border-[#65ecaf]/15 bg-[#0e1f17]/40 px-3 py-2.5">
              <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.14em] text-[#8df0c4]">
                留到毕业
              </p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">
                预计可领取 {formatUsdcAmount(estimatedClaimableUsdc ?? null)} USDC 发现奖励（封顶估算）
              </p>
              <p className="mt-2 border-t border-white/[0.06] pt-2 text-[length:var(--fs-micro)] leading-4 text-[#8ea0ba]">
                注意：发现奖励按合格人数与档位估算，并受单用户上限约束；S1 数量不会按比例放大 USDC 领取额。最终领取额以实际链上结算为准。
              </p>
            </div>
          </div>

          <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />

          {isDemoRoute ? (
            <>
              <button
                className={`mt-4 w-full rounded-full py-2.5 text-[length:var(--fs-overline)] font-semibold transition-all ${
                  active && amount > 0
                    ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.8)_0%,rgba(190,52,34,0.8)_100%)] text-white shadow-[0_6px_20px_rgba(222,64,42,0.2)] hover:brightness-110"
                    : "cursor-not-allowed bg-white/[0.04] text-white/30"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={!active || amount <= 0 || demoBusy || demoFlow.state.status === "success"}
                onClick={demoFlow.begin}
                type="button"
              >
                {demoBusy
                  ? t("buyout.rageQuit.previewingBtn")
                  : demoFlow.state.status === "success"
                    ? t("buyout.rageQuit.previewExited")
                    : t("buyout.rageQuit.previewExitBtn")}
              </button>
              <DemoActionStatusCard
                amountLabel={`${amount} S1`}
                confirmLabel={t("buyout.rageQuit.previewConfirmLabel")}
                description={t("buyout.rageQuit.previewConfirmDesc")}
                onCancel={demoFlow.reset}
                onConfirm={executeDemoExit}
                onRetry={demoFlow.retry}
                state={demoFlow.state}
                successLabel={t("buyout.rageQuit.previewSuccessLabel")}
                title={t("buyout.rageQuit.previewConfirmTitle")}
              />
            </>
          ) : !signedIn ? (
            <div className="mt-4 space-y-2">
              <WalletMultiButton className="!w-full !justify-center !rounded-full !text-sm" />
              <Link
                className="block text-center text-[length:var(--fs-micro)] font-medium text-[#67b8ff] transition hover:text-white"
                href={`/login?next=/buyout/${creatorWallet}`}
              >
                {walletMismatch ? t("buyout.rageQuit.signInAgain") : t("buyout.rageQuit.signInWithWallet")}
              </Link>
            </div>
          ) : (
            <button
              className={`mt-4 w-full rounded-full py-2.5 text-[length:var(--fs-overline)] font-semibold transition-all ${
                active && amount > 0
                  ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.8)_0%,rgba(190,52,34,0.8)_100%)] text-white shadow-[0_6px_20px_rgba(222,64,42,0.2)] hover:brightness-110"
                  : "cursor-not-allowed bg-white/[0.04] text-white/30"
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={!active || amount <= 0 || busy}
              onClick={() => void execute()}
              type="button"
            >
              {busy ? t("buyout.rageQuit.processing") : t("buyout.rageQuit.exitPosition")}
            </button>
          )}
        </>
      )}

      <div className="mt-3">
        <S1TransactionDrawer
          actionLabel={t("buyout.rageQuit.drawerAction")}
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
  discoveryRewardEligible,
  isDemoRoute,
  onDemoClaim,
  onRefresh,
  positionBalance,
  residualSwept,
  sessionWallet,
  sponsorWallet,
  vaultClosed,
}: {
  claimableUsdc: string | null;
  creatorWallet: string;
  discoveryRewardEligible?: boolean;
  isDemoRoute?: boolean;
  onDemoClaim?: () => void;
  onRefresh: () => Promise<void>;
  positionBalance: string;
  residualSwept?: boolean;
  sessionWallet: string | null;
  sponsorWallet: string | null;
  vaultClosed?: boolean;
}) {
  const { t } = useI18n();
  const demoFlow = useDemoActionFlow();
  const flow = useS1TransactionFlow();
  const wallet = useWallet();

  const sessionToken = getStoredAuthSession()?.accessToken ?? null;
  const isLocalDemoSession = sessionToken === S1_MOCK_ACCESS_TOKEN;
  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const walletMismatch = sessionWallet && connectedWallet && sessionWallet !== connectedWallet;
  const signedIn = Boolean(sessionToken && !isLocalDemoSession && sessionWallet && wallet.connected && !walletMismatch);
  const hasPosition = Number(positionBalance || 0) > 0;
  const hasPositiveReward = hasClaimableUsdc(claimableUsdc);
  const hasOpenVault = !residualSwept && !vaultClosed;
  const canFinalizeZeroReward = discoveryRewardEligible === true && !hasPositiveReward;
  const eligiblePosition = hasPosition && discoveryRewardEligible !== false;
  const canClaim = isDemoRoute
    ? Boolean(sponsorWallet && hasOpenVault && eligiblePosition && (hasPositiveReward || canFinalizeZeroReward))
    : Boolean(signedIn && sponsorWallet && hasOpenVault && eligiblePosition && (hasPositiveReward || canFinalizeZeroReward));
  const claimStatus = residualSwept
    ? t("buyout.claim.statusWindowSwept")
    : vaultClosed
      ? t("buyout.claim.statusVaultClosed")
      : discoveryRewardEligible === false
        ? t("buyout.claim.statusNotEligible")
        : !hasPosition
          ? t("buyout.claim.statusNoPosition")
          : canClaim
            ? canFinalizeZeroReward
              ? t("buyout.claim.statusZeroFinalize")
              : t("buyout.claim.statusReady")
            : t("buyout.claim.statusWatchOnly");

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
      <h3 className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em] text-[#65ecaf]">{t("buyout.claim.title")}</h3>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#f3b33e]">{t("buyout.claim.yourPosition")}</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{formatS1Amount(positionBalance)} S1</p>
        </div>
        <div className="rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#67b8ff]">{t("buyout.claim.discoveryReward")}</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{formatUsdcAmount(claimableUsdc)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[length:var(--fs-micro)] text-[#8ea0ba]">{claimStatus}</p>
          <p className="mt-0.5 font-mono text-[length:var(--fs-micro)] font-medium text-white">{sponsorWallet ? shortenWallet(sponsorWallet) : t("buyout.claim.noWinningSponsor")}</p>
        </div>
        {isDemoRoute ? (
          <button
            className="rounded-full bg-[#65ecaf] px-5 py-2 text-[length:var(--fs-overline)] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canClaim || demoBusy || demoFlow.state.status === "success"}
            onClick={demoFlow.begin}
            type="button"
          >
            {demoBusy
              ? t("buyout.claim.previewingBtn")
              : demoFlow.state.status === "success"
                ? t("buyout.claim.previewFinalized")
                : canFinalizeZeroReward
                  ? t("buyout.claim.previewFinalizeBtn")
                  : t("buyout.claim.previewClaimBtn")}
          </button>
        ) : signedIn ? (
          <button
            className="rounded-full bg-[#65ecaf] px-5 py-2 text-[length:var(--fs-overline)] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canClaim || busy}
            onClick={() => void execute()}
            type="button"
          >
            {busy ? t("buyout.claim.processing") : canFinalizeZeroReward ? t("buyout.claim.finalize") : t("buyout.claim.claim")}
          </button>
        ) : (
          <div className="space-y-2">
            <WalletMultiButton className="!rounded-full !text-sm" />
            <Link
              className="block text-center text-[length:var(--fs-micro)] font-medium text-[#67b8ff] transition hover:text-white"
              href={`/login?next=/buyout/${creatorWallet}`}
            >
              {walletMismatch ? t("buyout.claim.signInAgain") : t("buyout.claim.signInWithWallet")}
            </Link>
          </div>
        )}
      </div>

      <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />

      {isDemoRoute ? (
        <DemoActionStatusCard
          amountLabel={formatUsdcAmount(claimableUsdc)}
          confirmLabel={t("buyout.claim.previewConfirmLabel")}
          description={t("buyout.claim.previewConfirmDesc")}
          onCancel={demoFlow.reset}
          onConfirm={executeDemoClaim}
          onRetry={demoFlow.retry}
          state={demoFlow.state}
          successLabel={t("buyout.claim.previewSuccessLabel")}
          title={t("buyout.claim.previewConfirmTitle")}
        />
      ) : null}

      <div className="mt-3">
        <S1TransactionDrawer
          actionLabel={t("buyout.claim.drawerAction")}
          amountLabel={canFinalizeZeroReward ? "0 USDC" : formatUsdcAmount(claimableUsdc)}
          flow={flow.state}
          onClose={flow.reset}
          onRetry={canClaim ? () => void execute() : undefined}
        />
      </div>
    </div>
  );
}

function displayBuyoutTitle(
  profile: S1MarketProfileResponse | null,
  fallbackCreator: ReturnType<typeof resolveFallbackCreator>,
  isDemoRoute: boolean,
  locale: Locale,
) {
  if (isDemoRoute && locale === "en") {
    return "Seeded Buyout Creator";
  }

  return displayCreatorName(profile, fallbackCreator);
}

function BuyoutReadinessNotice({ isDemoRoute }: { isDemoRoute: boolean }) {
  const { t } = useI18n();
  const config = isDemoRoute
    ? {
        label: "MOCK_PREVIEW",
        titleKey: "buyout.readiness.demoTitle",
        bodyKey: "buyout.readiness.demoBody",
        tone: "tone-state-warning",
      }
    : {
        label: "SEEDED_DEMO + OPERATOR_REQUIRED",
        titleKey: "buyout.readiness.seededTitle",
        bodyKey: "buyout.readiness.seededBody",
        tone: "tone-state-info",
      };

  return (
    <section className={`rounded-[14px] border px-4 py-3 ${config.tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] opacity-80">毕业赞助数据来源</p>
          <p className="mt-1 text-sm font-semibold text-white">{t(config.titleKey)}</p>
          <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{t(config.bodyKey)}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[length:var(--fs-micro)] font-semibold">
          {config.label}
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function BuyoutPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
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

  const title = displayBuyoutTitle(profile, fallbackCreator, isDemoRoute, locale);
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
      const currentPositionClaimable = Number(
        position?.estimatedClaimableUsdc ?? profile?.buyout?.claimableUsdcRemaining ?? 0,
      );
      const nextPositionClaimable = nextPositionBalance > 0 ? currentPositionClaimable : 0;
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
        return {
          ...current,
          creator: {
            ...current.creator,
            s1Supply: String(Math.max(0, Number(current.creator.s1Supply || 0) - amount)),
          },
          buyout: {
            ...current.buyout,
            claimableS1SupplyRemaining: String(Math.round(nextSupply)),
            claimableUsdcRemaining: current.buyout.claimableUsdcRemaining,
            discoveryPoolRemaining:
              current.buyout.discoveryPoolRemaining ?? current.buyout.claimableUsdcRemaining,
          },
        };
      });

      setDemoSummary(t("buyout.demoExitSummary", { amount: String(amount), spump: spumpReturnedLabel }));
    },
    [
      t,
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
    setDemoSummary(t("buyout.demoClaimSummary", { amount: claimedLabel }));
  }, [t, creatorWallet, position?.estimatedClaimableUsdc]);

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
            error={t("buyout.errorNoLive")}
            title={t("buyout.errorNoLiveTitle", { title })}
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
          <S1ErrorState error={error} title={t("buyout.errorLoadTitle", { title })} />
          <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <Head><title>{`StreamPump | ${title} 毕业赞助`}</title></Head>
      <PageShell>
        <div className="mx-auto max-w-4xl space-y-4">
          <ProductReadinessBanner
            description={t("buyout.banner.description")}
            status="SEEDED_DEMO"
            title={t("buyout.banner.title")}
          />
          <BuyoutReadinessNotice isDemoRoute={isDemoRoute} />

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
                <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">S1 毕业赞助</p>
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
          <BuyoutLifecycleNotice buyout={profile.buyout} />

          {/* (B1) Capped/non-proportional disclaimer — standalone note */}
          {phase !== "none" ? (
            <p className="text-[length:var(--fs-micro)] leading-5 text-[#6f8099]">
              {t("buyout.cappedDisclaimerStandalone")}
            </p>
          ) : null}

          {/* No buyout state */}
          {phase === "none" ? (
            <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-8 text-center">
              <p className="text-base font-semibold text-white">{t("buyout.noBuyout.title")}</p>
              <p className="mt-1.5 text-xs text-[#8ea0ba]">
                {t("buyout.noBuyout.body")}
              </p>
              <DiscoveryProgressCard profile={profile} />
              <Link
                className="mt-4 inline-flex items-center text-[length:var(--fs-micro)] font-medium text-[#67b8ff] transition hover:text-white"
                href={isDemoRoute ? DEMO_S1_MARKET_PATH : `/market/${creatorWallet}`}
              >
                {t("buyout.noBuyout.backToMarket")}
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
                <h2 className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.14em] text-[#8ea0ba]">
                  {t("buyout.sponsorOffers")}
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
                    estimatedClaimableUsdc={position?.estimatedClaimableUsdc ?? null}
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
                    discoveryRewardEligible={position?.discoveryRewardEligible}
                    isDemoRoute={isDemoRoute}
                    onDemoClaim={handleDemoClaim}
                    onRefresh={refresh}
                    positionBalance={positionBalance}
                    residualSwept={Boolean(profile.buyout?.residualSwept)}
                    sessionWallet={sessionWallet}
                    sponsorWallet={profile.buyout?.winningSponsorWallet ?? null}
                    vaultClosed={Boolean(profile.buyout?.vaultClosed)}
                  />
                ) : null}

                {demoSummary ? (
                  <div className="tone-state-success rounded-[12px] border px-3.5 py-3 text-[length:var(--fs-overline)] font-medium">
                    {demoSummary}
                  </div>
                ) : null}

                {/* Position summary */}
                <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                  <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{t("buyout.yourS1Position")}</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatS1Amount(positionBalance)} S1</p>
                  {position?.estimatedClaimableUsdc && hasClaimableUsdc(position.estimatedClaimableUsdc) ? (
                    <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#65ecaf]">
                      {t("buyout.discoveryRewardLine", { amount: formatUsdcAmount(position.estimatedClaimableUsdc) })}
                    </p>
                  ) : null}
                  {/* (B2) Eligibility identity chip */}
                  {position?.discoveryRewardEligible === true ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#65ecaf]/30 bg-[#65ecaf]/10 px-2 py-0.5 text-[length:var(--fs-nano)] font-semibold text-[#65ecaf]">
                      {t("buyout.eligibleBacker")}
                    </span>
                  ) : position?.discoveryRewardEligible === false ? (
                    <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#6f8099]">
                      {t("buyout.notEligibleSnapshot")}
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

import Head from "next/head";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import {
  DemoCreatorBanner,
  S1ErrorState,
  S1LoadingSkeleton,
  S1TransactionDrawer,
  WalletSessionAlert,
} from "@/components/s1/S1TransactionDrawer";
import { StagePill } from "@/components/shared/StagePill";
import { useS1TransactionFlow } from "@/hooks/useS1TransactionFlow";
import {
  buildS1ClaimUsdcTransaction,
  DEMO_S1_CREATOR_WALLET,
  getS1MarketProfile,
  getS1Portfolio,
  S1_MOCK_ACCESS_TOKEN,
  S1_MOCK_USER_WALLET,
  S1PortfolioResponse,
} from "@/lib/api/s1";
import { clearStoredAuthSession, getStoredAuthSession, storeAuthSession } from "@/lib/auth-session";
import { useI18n } from "@/lib/i18n";
import {
  DEMO_PATH,
  DEMO_S1_BUYOUT_PATH,
  DEMO_S1_CREATOR_PATH,
  DEMO_S1_MARKET_PATH,
} from "@/lib/routes";
import {
  buildDemoS1MarketProfile,
  buildDemoS1Portfolio,
  formatS1Amount,
  formatSpump,
  formatUsdcAmount,
  hasClaimableUsdc,
  resolveFallbackCreator,
  shortenWallet,
} from "@/lib/s1-market-view";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type LiveTab = "Portfolio" | "Claim queue";
const LIVE_TABS: LiveTab[] = ["Portfolio", "Claim queue"];

const isExpiredSessionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /session.*(invalid|expired)|AUTH_INVALID/i.test(message);
};

function TabBar({ active, onChange }: { active: LiveTab; onChange: (t: LiveTab) => void }) {
  return (
    <div className="flex items-center gap-5 border-b border-white/[0.06]">
      {LIVE_TABS.map((tab) => (
        <button
          className={`relative pb-3 text-[12px] font-medium transition ${active === tab ? "text-white" : "text-[#7486a1] hover:text-white"}`}
          key={tab}
          onClick={() => onChange(tab)}
          type="button"
        >
          {tab}
          {active === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" /> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wallet / session header                                            */
/* ------------------------------------------------------------------ */

function WalletHeader({
  connectedWallet,
  portfolio,
  sessionWallet,
}: {
  connectedWallet: string | null;
  portfolio: S1PortfolioResponse;
  sessionWallet: string | null;
}) {
  const mismatch = connectedWallet && sessionWallet && connectedWallet !== sessionWallet;

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">Live Portfolio</p>
          <h1 className="mt-1 truncate font-mono text-lg font-bold tracking-[-0.02em] text-white sm:text-xl">
            {shortenWallet(portfolio.userWallet)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#8ea0ba]">
            <span>Session: {sessionWallet ? shortenWallet(sessionWallet) : "—"}</span>
            <span>Connected: {connectedWallet ? shortenWallet(connectedWallet) : "—"}</span>
          </div>
        </div>
        <WalletMultiButton className="!rounded-full !text-sm" />
      </div>
      {mismatch ? (
        <div className="mt-3">
          <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metrics strip                                                      */
/* ------------------------------------------------------------------ */

function MetricsStrip({ portfolio }: { portfolio: S1PortfolioResponse }) {
  const totalS1 = portfolio.positions.reduce((s, p) => s + Number(p.internalTokenBalance || 0), 0);
  const claimableCount = portfolio.positions.filter((p) => hasClaimableUsdc(p.estimatedClaimableUsdc)).length;
  const totalClaimable = portfolio.positions.reduce((s, p) => s + Number(p.estimatedClaimableUsdc || 0), 0);

  const items = [
    { label: "Positions", value: String(portfolio.positions.length), color: "text-white" },
    { label: "S1 balance", value: formatS1Amount(String(totalS1)), color: "text-white" },
    { label: "Claim queue", value: String(claimableCount), color: claimableCount > 0 ? "text-[#65ecaf]" : "text-white" },
    { label: "Total claimable", value: formatUsdcAmount(String(totalClaimable)), color: "text-[#65ecaf]" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3" key={it.label}>
          <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{it.label}</p>
          <p className={`mt-1 text-xl font-bold tracking-[-0.04em] ${it.color}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position row                                                       */
/* ------------------------------------------------------------------ */

function PositionRow({
  onRefresh,
  position,
}: {
  onRefresh: () => Promise<void>;
  position: S1PortfolioResponse["positions"][number];
}) {
  const name = position.creator?.displayName || position.creator?.handle || shortenWallet(position.creatorWallet);
  const claimable = hasClaimableUsdc(position.estimatedClaimableUsdc);

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.94)_0%,rgba(10,14,22,0.94)_100%)] p-4">
      {/* Desktop layout */}
      <div className="hidden items-center gap-4 xl:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[10px] font-bold text-[#67b8ff]">
          S1
        </div>
        <div className="min-w-[160px] flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link className="truncate text-[13px] font-semibold text-white transition hover:text-[#67b8ff]" href={`/market/${position.creatorWallet}`}>
              {name}
            </Link>
            {position.creator ? <StagePill compact stage={position.creator.stage} /> : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[#6f8099]">{shortenWallet(position.creatorWallet)}</p>
        </div>
        <MetricCell label="S1" value={formatS1Amount(position.internalTokenBalance)} />
        <MetricCell label="Cost basis" value={formatSpump(position.spumpCostBasis)} />
        <MetricCell label="Claimable" value={formatUsdcAmount(position.estimatedClaimableUsdc)} color={claimable ? "text-[#65ecaf]" : undefined} />
        <MetricCell label="Updated" value={new Date(position.updatedAt).toLocaleDateString()} />
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-[#8ea0ba] transition hover:border-white/[0.14] hover:text-white"
            href={`/market/${position.creatorWallet}`}
          >
            Market
          </Link>
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-[#8ea0ba] transition hover:border-white/[0.14] hover:text-white"
            href={`/buyout/${position.creatorWallet}`}
          >
            Buyout
          </Link>
          {claimable ? (
            <ClaimButton creatorWallet={position.creatorWallet} onRefresh={onRefresh} />
          ) : null}
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[10px] font-bold text-[#67b8ff]">
            S1
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link className="truncate text-[13px] font-semibold text-white" href={`/market/${position.creatorWallet}`}>
                {name}
              </Link>
              {position.creator ? <StagePill compact stage={position.creator.stage} /> : null}
            </div>
            <p className="truncate font-mono text-[10px] text-[#6f8099]">{shortenWallet(position.creatorWallet)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MobileMetric label="S1" value={formatS1Amount(position.internalTokenBalance)} />
          <MobileMetric label="Cost basis" value={formatSpump(position.spumpCostBasis)} />
          <MobileMetric label="Claimable" value={formatUsdcAmount(position.estimatedClaimableUsdc)} color={claimable ? "text-[#65ecaf]" : undefined} />
          <MobileMetric label="Updated" value={new Date(position.updatedAt).toLocaleDateString()} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-[#8ea0ba] transition hover:text-white"
            href={`/market/${position.creatorWallet}`}
          >
            Market
          </Link>
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-[#8ea0ba] transition hover:text-white"
            href={`/buyout/${position.creatorWallet}`}
          >
            Buyout
          </Link>
          {claimable ? (
            <ClaimButton creatorWallet={position.creatorWallet} onRefresh={onRefresh} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCell({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="min-w-[78px] text-right">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[#5a6d87]">{label}</p>
      <p className={`mt-0.5 text-[12px] font-semibold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function MobileMetric({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-[#5a6d87]">{label}</p>
      <p className={`mt-0.5 text-[11px] font-semibold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claim button (inline)                                              */
/* ------------------------------------------------------------------ */

function ClaimButton({
  creatorWallet,
  onRefresh,
}: {
  creatorWallet: string;
  onRefresh: () => Promise<void>;
}) {
  const flow = useS1TransactionFlow();
  const [showDrawer, setShowDrawer] = useState(false);

  const execute = useCallback(async () => {
    setShowDrawer(true);
    const submitted = await flow.execute(async (token) => {
      const profile = await getS1MarketProfile(creatorWallet);
      const sponsor = profile.buyout?.winningSponsorWallet;
      if (!sponsor) throw new Error("Winning sponsor not available for this buyout.");
      return buildS1ClaimUsdcTransaction(token, { creatorWallet, sponsorWallet: sponsor });
    });
    if (submitted) await onRefresh();
  }, [flow, creatorWallet, onRefresh]);

  const busy = flow.state.status === "building" || flow.state.status === "waiting_signature" || flow.state.status === "submitting" || flow.state.status === "syncing_projection";

  return (
    <div className="space-y-2">
      <button
        className="rounded-lg bg-[#65ecaf] px-3.5 py-1.5 text-[10px] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={busy}
        onClick={() => void execute()}
        type="button"
      >
        {busy ? "..." : "Claim"}
      </button>
      {showDrawer ? (
        <S1TransactionDrawer
          actionLabel="Claim USDC"
          flow={flow.state}
          onClose={() => { flow.reset(); setShowDrawer(false); }}
          onRetry={() => void execute()}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claim queue                                                        */
/* ------------------------------------------------------------------ */

function ClaimQueue({
  onRefresh,
  portfolio,
}: {
  onRefresh: () => Promise<void>;
  portfolio: S1PortfolioResponse;
}) {
  const claimable = portfolio.positions.filter((p) => hasClaimableUsdc(p.estimatedClaimableUsdc));
  const totalUsdc = claimable.reduce((s, p) => s + Number(p.estimatedClaimableUsdc || 0), 0);

  if (claimable.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-6 text-center text-xs text-[#8ea0ba]">
        No claimable S1 buyout positions for this wallet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#5a6d87]">
          {claimable.length} position{claimable.length > 1 ? "s" : ""} ready
        </span>
        <span className="text-[12px] font-semibold text-[#65ecaf]">
          Total: {formatUsdcAmount(String(totalUsdc))}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {claimable.map((pos) => (
          <div
            className="rounded-[14px] border border-[#65ecaf]/10 bg-[#0e1f17]/30 p-4"
            key={pos.positionPda}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {pos.creator?.displayName || pos.creator?.handle || shortenWallet(pos.creatorWallet)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8ea0ba]">
                  {formatS1Amount(pos.internalTokenBalance)} S1
                </p>
              </div>
              <p className="text-base font-semibold text-[#65ecaf]">
                {formatUsdcAmount(pos.estimatedClaimableUsdc)}
              </p>
            </div>
            <div className="mt-3">
              <ClaimButton creatorWallet={pos.creatorWallet} onRefresh={onRefresh} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Positions list                                                     */
/* ------------------------------------------------------------------ */

function PositionsList({
  onRefresh,
  portfolio,
}: {
  onRefresh: () => Promise<void>;
  portfolio: S1PortfolioResponse;
}) {
  if (portfolio.positions.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-6 text-center text-xs text-[#8ea0ba]">
        No live S1 positions for this wallet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {portfolio.positions.map((pos) => (
        <PositionRow key={pos.positionPda} onRefresh={onRefresh} position={pos} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Demo holder hints                                                  */
/* ------------------------------------------------------------------ */

function DemoHolderHints() {
  const isDemoEnv = process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === "1" || process.env.NODE_ENV === "development";
  if (!isDemoEnv) return null;

  const holders = [
    { label: "Early holder", wallet: "EhuyyNNfY7nyCZdMq3GgshrTYUctoxfCUTaZbJHbsy3L" },
    { label: "Regular holder", wallet: "5dVLXiue5BrsLRrMQuThaU5aiyuDDVZHf251ozFL3yq4" },
  ];

  return (
    <div className="rounded-[12px] border border-[#67b8ff]/10 bg-[#0e1726]/40 px-3.5 py-2.5">
      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">Seeded test wallets</p>
      <div className="mt-1.5 space-y-1">
        {holders.map((h) => (
          <div className="flex items-center justify-between gap-3" key={h.wallet}>
            <span className="text-[10px] text-[#8ea0ba]">{h.label}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[10px] text-[#7486a1]" title={h.wallet}>
                {shortenWallet(h.wallet)}
              </span>
              <button
                className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-[#8ad0ff] transition hover:border-white/[0.14] hover:text-white"
                onClick={() => void navigator.clipboard?.writeText(h.wallet)}
                type="button"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioDemoLinks({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <div className="rounded-[14px] border border-[#67b8ff]/15 bg-[#0e1726]/50 p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">
            Demo portfolio
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#8ea0ba]">
            Load a local mock session to preview S1 positions and claim queue without a wallet.
          </p>
        </div>
        <button
          className="rounded-full bg-[#de402a] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#ea523e]"
          onClick={onLoadDemo}
          type="button"
        >
          Load demo portfolio
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { href: DEMO_PATH, label: "Demo hub" },
          { href: DEMO_S1_MARKET_PATH, label: "S1 market" },
          { href: DEMO_S1_BUYOUT_PATH, label: "Buyout watch" },
          { href: DEMO_S1_CREATOR_PATH, label: "Creator profile" },
        ].map((link) => (
          <Link
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-[#8ad0ff] transition hover:border-white/[0.14] hover:text-white"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback preview (no auth / API error)                             */
/* ------------------------------------------------------------------ */

function FallbackPreview({ reason }: { reason: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4 py-6">
      <div className="rounded-[14px] border border-[#f3b33e]/20 bg-[#1a1408]/50 p-4 text-[11px] text-[#f3c66e]">
        Fallback preview — {reason}
      </div>
      <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
      <DemoHolderHints />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function PortfolioPage() {
  const { t } = useI18n();
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<LiveTab>("Portfolio");
  const [portfolio, setPortfolio] = useState<S1PortfolioResponse | null>(null);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [isMockPortfolioSession, setIsMockPortfolioSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const hasActiveWalletSession =
    isMockPortfolioSession || Boolean(sessionWallet && connectedWallet && sessionWallet === connectedWallet);
  const sawConnectedWalletRef = useRef(false);

  const clearPortfolioSession = useCallback(() => {
    clearStoredAuthSession();
    setSessionWallet(null);
    setIsMockPortfolioSession(false);
    setPortfolio(null);
    setFallbackReason(null);
    setActiveTab("Portfolio");
  }, []);

  const refresh = useCallback(async () => {
    const session = getStoredAuthSession();
    setSessionWallet(session?.wallet ?? null);
    setIsMockPortfolioSession(session?.accessToken === S1_MOCK_ACCESS_TOKEN);
    if (!session?.accessToken) {
      setPortfolio(null);
      return;
    }
    if (session.accessToken === S1_MOCK_ACCESS_TOKEN) {
      const demoProfile = buildDemoS1MarketProfile(resolveFallbackCreator("mika-zhou"));
      setPortfolio(buildDemoS1Portfolio(DEMO_S1_CREATOR_WALLET, demoProfile));
      return;
    }
    setPortfolio(await getS1Portfolio(session.accessToken));
  }, []);

  const loadDemoPortfolio = useCallback(() => {
    storeAuthSession({
      wallet: S1_MOCK_USER_WALLET,
      accessToken: S1_MOCK_ACCESS_TOKEN,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      tokenType: "Bearer",
      identity: null,
    });
    setLoading(true);
    refresh()
      .catch((err) => {
        setPortfolio(null);
        setFallbackReason(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (connectedWallet) {
      sawConnectedWalletRef.current = true;
      return;
    }

    if (sawConnectedWalletRef.current && sessionWallet && !isMockPortfolioSession) {
      clearPortfolioSession();
    }
  }, [clearPortfolioSession, connectedWallet, isMockPortfolioSession, sessionWallet]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFallbackReason(null);
    refresh()
      .catch((err) => {
        if (!cancelled) {
          if (isExpiredSessionError(err)) {
            clearPortfolioSession();
            return;
          }
          setPortfolio(null);
          setFallbackReason(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clearPortfolioSession, refresh]);

  return (
    <>
      <Head><title>{t("page.portfolio.title")}</title></Head>
      <PageShell>
        {loading ? (
          <div className="mx-auto max-w-4xl">
            <S1LoadingSkeleton />
          </div>
        ) : !hasActiveWalletSession ? (
          <div className="mx-auto max-w-[640px] space-y-5 py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              {connectedWallet && sessionWallet && connectedWallet !== sessionWallet
                ? t("portfolio.signInConnected")
                : connectedWallet
                  ? t("portfolio.signInLoad")
                  : t("portfolio.connectView")}
            </h1>
            <p className="text-xs leading-6 text-[#8ea0ba]">
              {connectedWallet && sessionWallet && connectedWallet !== sessionWallet
                ? "Connected wallet differs from the stored session. Sign in again to load this wallet's portfolio."
                : connectedWallet
                ? "Your wallet is connected. Sign one login message to create the backend session used by portfolio and claim actions."
                : "Portfolio and claim queue require a connected wallet plus an authenticated wallet session."}
            </p>
            {connectedWallet ? (
              <p className="mx-auto max-w-xs rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-[#8ea0ba]">
                {t("portfolio.connected")}: {shortenWallet(connectedWallet)}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <WalletMultiButton className="!rounded-full !text-sm" />
              <Link
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:border-white/[0.14]"
                href="/login?next=/portfolio"
              >
                {connectedWallet ? "Sign message to load portfolio" : "Sign in"}
              </Link>
            </div>
            <div className="mx-auto max-w-sm pt-4">
              <DemoCreatorBanner
                buyoutHref={DEMO_S1_BUYOUT_PATH}
                creatorHref={DEMO_S1_CREATOR_PATH}
                creatorWallet={DEMO_S1_CREATOR_WALLET}
                marketHref={DEMO_S1_MARKET_PATH}
              />
              <div className="mt-2">
                <DemoHolderHints />
              </div>
              <div className="mt-2">
                <PortfolioDemoLinks onLoadDemo={loadDemoPortfolio} />
              </div>
            </div>
          </div>
        ) : fallbackReason ? (
          <FallbackPreview reason={fallbackReason} />
        ) : portfolio ? (
          <div className="mx-auto max-w-[1100px] space-y-4 py-4">
            <DemoCreatorBanner
              buyoutHref={DEMO_S1_BUYOUT_PATH}
              creatorHref={DEMO_S1_CREATOR_PATH}
              creatorWallet={DEMO_S1_CREATOR_WALLET}
              marketHref={DEMO_S1_MARKET_PATH}
            />

            <WalletHeader
              connectedWallet={connectedWallet}
              portfolio={portfolio}
              sessionWallet={sessionWallet}
            />

            <MetricsStrip portfolio={portfolio} />

            <TabBar active={activeTab} onChange={setActiveTab} />

            {activeTab === "Portfolio" ? (
              <PositionsList onRefresh={refresh} portfolio={portfolio} />
            ) : null}

            {activeTab === "Claim queue" ? (
              <ClaimQueue onRefresh={refresh} portfolio={portfolio} />
            ) : null}

            <DemoHolderHints />
          </div>
        ) : (
          <FallbackPreview reason="Live portfolio is empty or unavailable." />
        )}
      </PageShell>
    </>
  );
}

(PortfolioPage as typeof PortfolioPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;

export default PortfolioPage;

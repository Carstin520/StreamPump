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
import { PriceHistoryChart } from "@/components/shared/PriceHistoryChart";
import { StagePill } from "@/components/shared/StagePill";
import { useDemoActionFlow } from "@/hooks/useDemoActionFlow";
import { useS1TransactionFlow } from "@/hooks/useS1TransactionFlow";
import {
  buildS1BuyTransaction,
  buildS1SellTransaction,
  DEMO_S1_CREATOR_WALLET,
  getS1MarketProfile,
  getS1Portfolio,
  S1_MOCK_ACCESS_TOKEN,
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
  formatSpump,
  formatUsdcAmount,
  isDemoCreatorRoute,
  resolveCreatorWalletForRoute,
  resolveFallbackCreator,
  shortenWallet,
} from "@/lib/s1-market-view";
import { compactNumber } from "@/lib/public-data";
import { createMockPriceHistory, parseAtomicSpumpToNumber } from "@/lib/price-history";
import {
  DEMO_PATH,
  DEMO_S1_BUYOUT_PATH,
  DEMO_S1_CREATOR_PATH,
  DEMO_S1_MARKET_PATH,
} from "@/lib/routes";

/* ------------------------------------------------------------------ */
/*  Price card                                                         */
/* ------------------------------------------------------------------ */

function PriceCard({ profile }: { profile: S1MarketProfileResponse }) {
  const { t } = useI18n();
  const priceHistory = useMemo(
    () =>
      createMockPriceHistory({
        basePrice: parseAtomicSpumpToNumber(profile.creator.currentPriceSpump),
        key: profile.creator.creatorWallet,
      }),
    [profile.creator.creatorWallet, profile.creator.currentPriceSpump],
  );

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">{t("common.currentPrice")}</p>
          <p className="mt-1.5 text-[32px] font-bold leading-none tracking-[-0.05em] text-white md:text-[40px]">
            {formatSpump(profile.creator.currentPriceSpump)}
          </p>
          <p className="mt-2 text-xs text-[#8ea0ba]">
            {t("market.nextTier")}: {formatSpump(profile.creator.nextPriceSpump)}
          </p>
        </div>
        <StagePill stage={profile.creator.stage} />
      </div>
      <div className="-mx-2 mt-3">
        <PriceHistoryChart
          className="px-2"
          currencyLabel="SPUMP"
          defaultRange="1M"
          height={260}
          points={priceHistory}
        />
      </div>
      {/* Chart note: current price is real on-chain; history curve is synthetic */}
      <p className="mt-2 text-[length:var(--fs-micro)] text-[#5a6d87]">{t("market.priceChartNote")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats grid                                                         */
/* ------------------------------------------------------------------ */

function StatsGrid({ profile }: { profile: S1MarketProfileResponse }) {
  const { t } = useI18n();
  const grad = formatGraduationProgressPercent(profile.creator.graduationProgressBps);
  const stats = [
    { label: t("market.supply"), value: formatS1Amount(profile.creator.s1Supply), color: "text-white" },
    { label: t("market.holders"), value: compactNumber(profile.creator.holderCount), color: "text-[#67b8ff]" },
    {
      label: t("market.graduation"),
      value: `${grad}%`,
      color: grad >= 100 ? "text-[color:var(--state-success)]" : "text-[color:var(--state-warning)]",
    },
    { label: t("market.pool"), value: formatSpump(profile.creator.supporterPoolSpump), color: "text-white" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((s) => (
        <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3" key={s.label}>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#5a6d87]">{s.label}</p>
          <p className={`mt-1 text-lg font-bold tracking-[-0.04em] ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Buyout summary                                                     */
/* ------------------------------------------------------------------ */

function BuyoutSummary({
  buyout,
  creatorWallet,
  href,
}: {
  buyout: S1MarketProfileResponse["buyout"];
  creatorWallet: string;
  href?: string;
}) {
  const { t } = useI18n();
  const status = buyout?.status ?? "NONE";
  const statusLabel: Record<string, string> = {
    NONE: t("market.buyoutStatus.none"),
    OFFER_OPEN: t("market.buyoutStatus.offerOpen"),
    ACCEPTED: t("market.buyoutStatus.accepted"),
    EXECUTION_PENDING: t("market.buyoutStatus.executionPending"),
    GRADUATED: t("market.buyoutStatus.graduated"),
  };

  return (
    <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#5a6d87]">{t("market.buyoutLabel")}</p>
          <p className="mt-1 text-sm font-semibold text-white">{statusLabel[status] ?? status}</p>
        </div>
        {buyout?.latestOfferUsdc ? (
          <div className="text-right">
            <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#5a6d87]">{t("market.latestOffer")}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#65ecaf]">{formatUsdcAmount(buyout.latestOfferUsdc)}</p>
          </div>
        ) : null}
      </div>
      <Link
        className="mt-2 inline-flex items-center text-[length:var(--fs-micro)] font-medium text-[#67b8ff] transition hover:text-white"
        href={href ?? `/buyout/${creatorWallet}`}
      >
        {t("market.openBuyoutRoom")}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User position                                                      */
/* ------------------------------------------------------------------ */

function PositionCard({
  portfolio,
  profile,
}: {
  portfolio: S1PortfolioResponse | null;
  profile: S1MarketProfileResponse;
}) {
  const { t } = useI18n();
  const pos = findPortfolioPosition(portfolio, profile.creator.creatorWallet);

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#65ecaf]/10 text-[length:var(--fs-micro)] font-bold text-[#65ecaf]">
          S1
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#5a6d87]">{t("market.yourPosition")}</p>
          <p className="mt-0.5 text-base font-bold tracking-[-0.03em] text-white">
            {pos ? `${formatS1Amount(pos.internalTokenBalance)} S1` : t("market.noPosition")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{pos ? formatSpump(pos.spumpCostBasis) : "—"}</p>
          <p className="text-[length:var(--fs-nano)] text-[#5a6d87]">{t("market.costBasis")}</p>
        </div>
      </div>
      {pos?.estimatedClaimableUsdc && Number(pos.estimatedClaimableUsdc) > 0 ? (
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.04] pt-2">
          <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#5a6d87]">{t("market.claimable")}</p>
          <p className="text-sm font-semibold text-[#65ecaf]">{formatUsdcAmount(pos.estimatedClaimableUsdc)}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trade panel                                                        */
/* ------------------------------------------------------------------ */

const AMOUNT_CHIPS = [1, 5, 10, 25] as const;

type DemoTradeInput = {
  amount: number;
  estimatedCost: number;
  side: "buy" | "sell";
};

function TradePanel({
  creatorWallet,
  isDemoRoute,
  onDemoTrade,
  onRefresh,
  portfolio,
  profile,
  sessionWallet,
}: {
  creatorWallet: string;
  isDemoRoute?: boolean;
  onDemoTrade?: (input: DemoTradeInput) => void;
  onRefresh: () => Promise<void>;
  portfolio: S1PortfolioResponse | null;
  profile: S1MarketProfileResponse;
  sessionWallet: string | null;
}) {
  const { t } = useI18n();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(10);
  const demoFlow = useDemoActionFlow();
  const flow = useS1TransactionFlow();
  const wallet = useWallet();

  const pos = findPortfolioPosition(portfolio, creatorWallet);
  const maxSell = Math.max(0, Number(pos?.internalTokenBalance || 0));
  const hasPosition = maxSell > 0;

  const sessionToken = getStoredAuthSession()?.accessToken ?? null;
  const isLocalDemoSession = sessionToken === S1_MOCK_ACCESS_TOKEN;
  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const walletMismatch = sessionWallet && connectedWallet && sessionWallet !== connectedWallet;
  const canTrade = Boolean(sessionToken && !isLocalDemoSession && wallet.connected && !walletMismatch);
  const sellOverLimit = side === "sell" && hasPosition && amount > maxSell;

  const estimatedCost = useMemo(() => {
    const price = Number(profile.creator.currentPriceSpump || 0) / 1e9;
    return price * amount;
  }, [amount, profile.creator.currentPriceSpump]);

  const executeTrade = useCallback(async () => {
    const submitted = await flow.execute((token) =>
      side === "buy"
        ? buildS1BuyTransaction(token, { creatorWallet, amount })
        : buildS1SellTransaction(token, { creatorWallet, amount }),
    );
    if (submitted) await onRefresh();
  }, [side, amount, creatorWallet, flow, onRefresh]);

  const executeDemoTrade = useCallback(
    (options?: { fail?: boolean }) => {
      demoFlow.submit({
        fail: options?.fail,
        onSuccess: () => onDemoTrade?.({ amount, estimatedCost, side }),
      });
    },
    [amount, demoFlow, estimatedCost, onDemoTrade, side],
  );

  const busy = flow.state.status === "building" || flow.state.status === "waiting_signature" || flow.state.status === "submitting" || flow.state.status === "syncing_projection";
  const demoBusy = demoFlow.state.status === "submitted";

  const ctaLabel = (): string => {
    if (!wallet.connected) return t("market.connectWallet");
    if (!sessionToken || isLocalDemoSession) return t("market.signInWithWallet");
    if (walletMismatch) return t("market.walletMismatch");
    if (side === "sell" && !hasPosition) return t("market.noPositionToSell");
    if (sellOverLimit) return t("market.amountExceedsPosition");
    return side === "buy" ? t("market.buySide") : t("market.sellSide");
  };

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.94)_0%,rgba(10,14,22,0.94)_100%)] p-4 md:p-5">
      {/* Buy / Sell tabs */}
      <div className="flex gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
        {(["buy", "sell"] as const).map((s) => (
          <button
            className={`flex-1 rounded-full py-2 text-[length:var(--fs-overline)] font-semibold transition-all ${
              side === s
                ? s === "buy"
                  ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.75)_0%,rgba(190,52,34,0.75)_100%)] text-white shadow-[0_4px_14px_rgba(222,64,42,0.25)]"
                  : "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-[#5a6d87] hover:text-white"
            }`}
            key={s}
            onClick={() => { setSide(s); flow.reset(); demoFlow.reset(); }}
            type="button"
          >
            {s === "buy" ? t("market.tabBuy") : t("market.tabSell")}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#5a6d87]">{t("market.amount")}</span>
          <input
            className="w-20 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-right text-lg font-bold tracking-[-0.03em] text-white outline-none transition focus:border-white/[0.16]"
            max={side === "sell" && hasPosition ? maxSell : undefined}
            min={1}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            type="number"
            value={amount}
          />
        </div>

        {/* Quick chips */}
        <div className="mt-2.5 flex gap-1.5">
          {AMOUNT_CHIPS.map((v) => (
            <button
              className={`flex-1 rounded-lg py-1.5 text-[length:var(--fs-micro)] font-semibold transition ${
                amount === v
                  ? "border border-[#de402a]/40 bg-[#de402a]/10 text-[#ff8a78]"
                  : "border border-white/[0.06] bg-white/[0.02] text-[#8ea0ba] hover:border-white/[0.12] hover:text-white"
              }`}
              key={v}
              onClick={() => setAmount(v)}
              type="button"
            >
              {v}
            </button>
          ))}
          {side === "sell" && hasPosition ? (
            <button
              className={`flex-1 rounded-lg py-1.5 text-[length:var(--fs-micro)] font-semibold transition ${
                amount === maxSell
                  ? "border border-[#de402a]/40 bg-[#de402a]/10 text-[#ff8a78]"
                  : "border border-white/[0.06] bg-white/[0.02] text-[#8ea0ba] hover:border-white/[0.12] hover:text-white"
              }`}
              onClick={() => setAmount(maxSell)}
              type="button"
            >
              {t("market.maxAmount")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Price info */}
      <div className="mt-4 space-y-1.5 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
        <Row label={t("common.currentPrice")} value={formatSpump(profile.creator.currentPriceSpump)} />
        <Row label={t("market.nextTier")} value={formatSpump(profile.creator.nextPriceSpump)} />
        <div className="h-px bg-white/[0.04]" />
        <Row
          label={side === "buy" ? t("market.estCost") : t("market.estReturn")}
          value={`~${estimatedCost.toFixed(3)} SPUMP`}
          bold
        />
        {sellOverLimit ? (
          <p className="mt-2 text-[length:var(--fs-micro)] font-medium text-[#ff8a78]">
            {t("market.sellOverLimitMsg", { balance: formatS1Amount(String(maxSell)) })}
          </p>
        ) : null}
      </div>

      {/* Wallet / session info */}
      <WalletSessionAlert connectedWallet={connectedWallet} sessionWallet={sessionWallet} />

      {/* CTA */}
      {isDemoRoute ? (
        <>
          <button
            className={`mt-4 w-full rounded-full py-3 text-[length:var(--fs-caption)] font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
              side === "buy"
                ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] text-white shadow-[0_8px_24px_rgba(222,64,42,0.2)] hover:brightness-110"
                : "bg-white/10 text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-white/14"
            }`}
            disabled={demoBusy || demoFlow.state.status === "success" || (side === "sell" && (!hasPosition || sellOverLimit))}
            onClick={demoFlow.begin}
            type="button"
          >
            {demoBusy
              ? t("market.previewing")
              : demoFlow.state.status === "success"
                ? side === "buy" ? t("market.previewBought") : t("market.previewSold")
                : side === "buy" ? t("market.previewBuyS1") : t("market.previewSellS1")}
          </button>
          <DemoActionStatusCard
            amountLabel={`${amount} S1 · ~${estimatedCost.toFixed(3)} SPUMP`}
            confirmLabel={side === "buy" ? t("market.confirmPreviewBuy") : t("market.confirmPreviewSell")}
            description={side === "buy" ? t("market.previewBuyDesc") : t("market.previewSellDesc")}
            onCancel={demoFlow.reset}
            onConfirm={executeDemoTrade}
            onRetry={demoFlow.retry}
            state={demoFlow.state}
            successLabel={side === "buy" ? t("market.previewBought") : t("market.previewSold")}
            title={side === "buy" ? t("market.previewBuyTitle") : t("market.previewSellTitle")}
          />
        </>
      ) : !wallet.connected ? (
        <div className="mt-4 space-y-2">
          <WalletMultiButton className="!w-full !justify-center !rounded-full !text-sm" />
          <Link
            className="block text-center text-[length:var(--fs-micro)] font-medium text-[#67b8ff] transition hover:text-white"
            href={`/login?next=/market/${creatorWallet}`}
          >
            {t("market.signInToTrade")}
          </Link>
        </div>
      ) : !sessionToken || isLocalDemoSession ? (
        <Link
          className="mt-4 block w-full rounded-full bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] py-3 text-center text-[length:var(--fs-caption)] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(222,64,42,0.2)] transition-all hover:brightness-110"
          href={`/login?next=/market/${creatorWallet}`}
        >
          {isLocalDemoSession ? t("market.signInWithWallet") : t("market.signInToTrade")}
        </Link>
      ) : (
        <button
          className={`mt-4 w-full rounded-full py-3 text-[length:var(--fs-caption)] font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            side === "buy"
              ? "bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] text-white shadow-[0_8px_24px_rgba(222,64,42,0.2)] hover:brightness-110"
              : "bg-white/10 text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-white/14"
          }`}
          disabled={!canTrade || busy || (side === "sell" && (!hasPosition || sellOverLimit))}
          onClick={() => void executeTrade()}
          type="button"
        >
          {busy ? t("common.processing") : ctaLabel()}
        </button>
      )}

      {/* Capped / non-proportional discovery reward disclaimer */}
      <p className="mt-3 text-[length:var(--fs-micro)] leading-relaxed text-[#5a6d87]">{t("market.cappedDisclaimer")}</p>

      {/* Shared transaction drawer */}
      <div className="mt-3">
        <S1TransactionDrawer
          actionLabel={side === "buy" ? t("market.buySide") : t("market.sellSide")}
          amountLabel={`${amount} S1`}
          flow={flow.state}
          onClose={flow.reset}
          onRetry={() => void executeTrade()}
        />
      </div>
    </div>
  );
}

function Row({ bold, label, value }: { bold?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-[length:var(--fs-micro)] ${bold ? "font-semibold text-[#8ea0ba]" : "text-[#6f8099]"}`}>{label}</span>
      <span className={`text-[length:var(--fs-micro)] ${bold ? "font-bold text-white" : "font-medium text-white"}`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function MarketHeader({
  fallbackAvatar,
  profile,
  title,
  handle,
}: {
  fallbackAvatar: string;
  profile: S1MarketProfileResponse;
  title: string;
  handle: string;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] p-5 md:p-6">
      <div className="flex items-center gap-3.5">
        <Link className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-[#7e90aa] transition hover:bg-white/[0.08]" href="/trending">
          <span aria-hidden className="text-sm">‹</span>
        </Link>
        <img alt="" className="h-10 w-10 rounded-full border border-white/[0.08] object-cover" src={fallbackAvatar} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-[-0.03em] text-white">{title}</h1>
          <p className="truncate text-xs text-[#8ea0ba]">
            @{handle} · {shortenWallet(profile.creator.creatorWallet)}
          </p>
        </div>
        <StagePill className="hidden sm:inline-flex" stage={profile.creator.stage} />
      </div>
    </div>
  );
}

function DemoRouteRail() {
  const { t } = useI18n();
  const links = [
    { href: DEMO_PATH, label: t("market.demoHub") },
    { href: DEMO_S1_CREATOR_PATH, label: t("market.demoCreatorProfile") },
    { href: DEMO_S1_BUYOUT_PATH, label: t("market.demoBuyoutWatch") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#67b8ff]/15 bg-[#0e1726]/55 px-3 py-2">
      <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">{t("market.demoPathLabel")}</span>
      {links.map((link) => (
        <Link
          className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function displayMarketTitle(
  profile: S1MarketProfileResponse | null,
  fallbackCreator: ReturnType<typeof resolveFallbackCreator>,
  isDemoRoute: boolean,
  locale: Locale,
) {
  if (isDemoRoute && locale === "en") {
    return "Seeded S1 Creator";
  }

  return displayCreatorName(profile, fallbackCreator);
}

function MarketReadinessNotice({ isDemoRoute }: { isDemoRoute: boolean }) {
  const { t } = useI18n();
  const config = isDemoRoute
    ? {
        label: "MOCK_PREVIEW",
        title: t("market.previewNoticeTitle"),
        body: t("market.previewNoticeBody"),
        tone: "tone-state-warning",
      }
    : {
        label: "SEEDED_DEMO",
        title: t("market.projectionNoticeTitle"),
        body: t("market.projectionNoticeBody"),
        tone: "tone-state-info",
      };

  return (
    <section className={`rounded-[14px] border px-4 py-3 ${config.tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] opacity-80">{t("market.dataSourceLabel")}</p>
          <p className="mt-1 text-sm font-semibold text-white">{config.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#9aabc4]">{config.body}</p>
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

function MarketPage() {
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

  const title = displayMarketTitle(profile, fallbackCreator, isDemoRoute, locale);
  const handle = displayCreatorHandle(profile, fallbackCreator);

  const handleDemoTrade = useCallback(
    ({ amount, estimatedCost, side }: DemoTradeInput) => {
      setPortfolio((current) => {
        if (!current) return current;
        const costDeltaAtomic = Math.max(0, Math.round(estimatedCost * 1_000_000_000));
        return {
          ...current,
          positions: current.positions.map((position) => {
            if (position.creatorWallet !== creatorWallet && position.creator?.creatorWallet !== creatorWallet) {
              return position;
            }
            const currentBalance = Math.max(0, Number(position.internalTokenBalance || 0));
            const currentCostBasis = Math.max(0, Number(position.spumpCostBasis || 0));
            const nextBalance =
              side === "buy"
                ? currentBalance + amount
                : Math.max(0, currentBalance - amount);
            const nextCostBasis =
              side === "buy"
                ? currentCostBasis + costDeltaAtomic
                : Math.max(0, currentCostBasis - costDeltaAtomic);

            return {
              ...position,
              internalTokenBalance: String(Math.round(nextBalance)),
              spumpCostBasis: String(Math.round(nextCostBasis)),
              updatedAt: new Date().toISOString(),
            };
          }),
        };
      });
      setDemoSummary(
        side === "buy"
          ? t("market.previewBoughtMsg", { amount: String(amount), cost: estimatedCost.toFixed(3) })
          : t("market.previewSoldMsg", { amount: String(amount), cost: estimatedCost.toFixed(3) }),
      );
    },
    [creatorWallet],
  );

  if (!creatorId || loading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl">
          <S1LoadingSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!creatorWallet) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl space-y-4 py-6">
          <S1ErrorState
            error="This route is a local creator preview slug, not a live S1 wallet address."
            title={`No live market for ${fallbackCreator.name}`}
          />
          <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
        </div>
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl space-y-4 py-6">
          <S1ErrorState error={error} title={t("market.loadError", { name: fallbackCreator.name })} />
          <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <Head><title>{`StreamPump | ${title} S1 Market`}</title></Head>
      <PageShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <ProductReadinessBanner
            description={t("market.readinessBody")}
            status="SEEDED_DEMO"
            title={t("market.readinessTitle")}
          />
          <MarketReadinessNotice isDemoRoute={isDemoRoute} />

          <DemoCreatorBanner
            buyoutHref={isDemoRoute ? DEMO_S1_BUYOUT_PATH : undefined}
            creatorHref={isDemoRoute ? DEMO_S1_CREATOR_PATH : undefined}
            creatorWallet={profile.creator.creatorWallet}
            marketHref={isDemoRoute ? DEMO_S1_MARKET_PATH : undefined}
          />
          {isDemoRoute ? <DemoRouteRail /> : null}

          <MarketHeader
            fallbackAvatar={fallbackCreator.avatarSrc}
            handle={handle}
            profile={profile}
            title={title}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            {/* Left column */}
            <div className="space-y-4">
              <PriceCard profile={profile} />
              <StatsGrid profile={profile} />
              <BuyoutSummary
                buyout={profile.buyout}
                creatorWallet={profile.creator.creatorWallet}
                href={isDemoRoute ? DEMO_S1_BUYOUT_PATH : undefined}
              />
            </div>

            {/* Right column */}
            <div className="space-y-3">
              <TradePanel
                creatorWallet={profile.creator.creatorWallet}
                isDemoRoute={isDemoRoute}
                onDemoTrade={handleDemoTrade}
                onRefresh={refresh}
                portfolio={portfolio}
                profile={profile}
                sessionWallet={sessionWallet}
              />
              {demoSummary ? (
                <div className="tone-state-success rounded-[12px] border px-3.5 py-3 text-[length:var(--fs-overline)] font-medium">
                  {demoSummary}
                </div>
              ) : null}
              <PositionCard portfolio={portfolio} profile={profile} />
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}

(MarketPage as typeof MarketPage & { requiresWalletProviders?: boolean }).requiresWalletProviders = true;

export default MarketPage;

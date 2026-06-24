import Head from "next/head";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import {
  PreviewHoldingsTable,
  PreviewRewardsPanel,
  PreviewWatchlistPanel,
  usePreviewPortfolio,
  usePreviewWatchlist,
} from "@/components/portfolio/PortfolioPreviewPanels";
import {
  DemoCreatorBanner,
  S1ErrorState,
  S1LoadingSkeleton,
  S1TransactionDrawer,
  WalletSessionAlert,
} from "@/components/s1/S1TransactionDrawer";
import { StagePill } from "@/components/shared/StagePill";
import { useS1TransactionFlow } from "@/hooks/useS1TransactionFlow";
import { useProposalTransactionFlow } from "@/hooks/useProposalTransactionFlow";
import { buildClaimEndorsementTransaction } from "@/lib/api/proposal";
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
import { type Locale, useI18n } from "@/lib/i18n";
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

type LiveTab = "Portfolio" | "Claim queue" | "S2 Endorsements" | "Preview Holdings" | "Watchlist" | "Rewards";
const LIVE_TABS: LiveTab[] = ["Portfolio", "Claim queue", "S2 Endorsements", "Preview Holdings", "Watchlist", "Rewards"];
type PortfolioPosition = S1PortfolioResponse["positions"][number];

const isExpiredSessionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /session.*(invalid|expired)|AUTH_INVALID/i.test(message);
};

const isDemoPosition = (position: PortfolioPosition) =>
  Boolean((position.creator?.metadata as { demo?: unknown } | null | undefined)?.demo);

const displayPortfolioCreatorName = (position: PortfolioPosition, locale: Locale) => {
  if (locale === "en" && isDemoPosition(position)) {
    return "Seeded S1 Creator";
  }

  return position.creator?.displayName || position.creator?.handle || shortenWallet(position.creatorWallet);
};

function TabBar({ active, onChange }: { active: LiveTab; onChange: (t: LiveTab) => void }) {
  return (
    <div className="flex items-center gap-5 border-b border-white/[0.06]">
      {LIVE_TABS.map((tab) => (
        <button
          className={`relative pb-3 text-[length:var(--fs-overline)] font-medium transition ${active === tab ? "text-white" : "text-[#7486a1] hover:text-white"}`}
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
  sourceLabel,
}: {
  connectedWallet: string | null;
  portfolio: S1PortfolioResponse;
  sessionWallet: string | null;
  sourceLabel: string;
}) {
  const mismatch = connectedWallet && sessionWallet && connectedWallet !== sessionWallet;

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(170deg,rgba(14,19,30,0.92)_0%,rgba(10,14,22,0.92)_100%)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#5a6d87]">{sourceLabel}</p>
          <h1 className="mt-1 truncate font-mono text-lg font-bold tracking-[-0.02em] text-white sm:text-xl">
            {shortenWallet(portfolio.userWallet)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--fs-micro)] text-[#8ea0ba]">
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
  const { t } = useI18n();
  const totalS1 = portfolio.positions.reduce((s, p) => s + Number(p.internalTokenBalance || 0), 0);
  const claimableCount = portfolio.positions.filter((p) => hasClaimableUsdc(p.estimatedClaimableUsdc)).length;
  const totalClaimable = portfolio.positions.reduce((s, p) => s + Number(p.estimatedClaimableUsdc || 0), 0);

  const items = [
    { label: t("portfolio.positions"), value: String(portfolio.positions.length), color: "text-white" },
    { label: t("portfolio.s1Backing"), value: formatS1Amount(String(totalS1)), color: "text-white" },
    { label: t("portfolio.claimQueue"), value: String(claimableCount), color: claimableCount > 0 ? "text-[#65ecaf]" : "text-white" },
    { label: t("portfolio.cappedRewards"), value: formatUsdcAmount(String(totalClaimable)), color: "text-[#65ecaf]" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3.5 py-3" key={it.label}>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{it.label}</p>
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
  claimsEnabled,
  onRefresh,
  position,
}: {
  claimsEnabled: boolean;
  onRefresh: () => Promise<void>;
  position: S1PortfolioResponse["positions"][number];
}) {
  const { locale, t } = useI18n();
  const name = displayPortfolioCreatorName(position, locale);
  const claimable = hasClaimableUsdc(position.estimatedClaimableUsdc);
  const hasPositionBalance = Number(position.internalTokenBalance || 0) > 0;
  const ineligible = position.discoveryRewardEligible === false && hasPositionBalance;
  const claimed = Boolean(position.discoveryRewardClaimed);
  const rewardState = claimed
    ? { label: "Reward status", value: "Claimed", color: "text-[#8ea0ba]" }
    : ineligible
      ? { label: "Reward status", value: "Not eligible", color: "text-[#f3c66e]" }
      : claimable
        ? { label: "Reward status", value: "Ready", color: "text-[#65ecaf]" }
        : { label: "Reward status", value: "No reward", color: "text-[#8ea0ba]" };

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.94)_0%,rgba(10,14,22,0.94)_100%)] p-4">
      {/* Desktop layout */}
      <div className="hidden items-center gap-4 xl:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-bold text-[#67b8ff]">
          S1
        </div>
        <div className="min-w-[160px] flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link className="truncate text-[length:var(--fs-caption)] font-semibold text-white transition hover:text-[#67b8ff]" href={`/market/${position.creatorWallet}`}>
              {name}
            </Link>
            {position.creator ? <StagePill compact stage={position.creator.stage} /> : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[length:var(--fs-micro)] text-[#6f8099]">{shortenWallet(position.creatorWallet)}</p>
        </div>
        <MetricCell label="S1" value={formatS1Amount(position.internalTokenBalance)} />
        <MetricCell label={t("portfolio.avgEntry")} value={formatSpump(position.spumpCostBasis)} />
        <MetricCell label="Discovery reward" value={formatUsdcAmount(position.estimatedClaimableUsdc)} color={claimable ? "text-[#65ecaf]" : undefined} />
        <MetricCell label={rewardState.label} value={rewardState.value} color={rewardState.color} />
        <MetricCell label="Updated" value={new Date(position.updatedAt).toLocaleDateString()} />
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:border-white/[0.14] hover:text-white"
            href={`/market/${position.creatorWallet}`}
          >
            Market
          </Link>
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:border-white/[0.14] hover:text-white"
            href={`/buyout/${position.creatorWallet}`}
          >
            Buyout
          </Link>
          {claimable && claimsEnabled && !ineligible ? (
            <ClaimButton creatorWallet={position.creatorWallet} onRefresh={onRefresh} />
          ) : null}
          {claimable && (!claimsEnabled || ineligible) ? <DisabledClaimPill label={ineligible ? "Not eligible" : undefined} /> : null}
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-bold text-[#67b8ff]">
            S1
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link className="truncate text-[length:var(--fs-caption)] font-semibold text-white" href={`/market/${position.creatorWallet}`}>
                {name}
              </Link>
              {position.creator ? <StagePill compact stage={position.creator.stage} /> : null}
            </div>
            <p className="truncate font-mono text-[length:var(--fs-micro)] text-[#6f8099]">{shortenWallet(position.creatorWallet)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MobileMetric label="S1" value={formatS1Amount(position.internalTokenBalance)} />
          <MobileMetric label={t("portfolio.avgEntry")} value={formatSpump(position.spumpCostBasis)} />
          <MobileMetric label="Discovery reward" value={formatUsdcAmount(position.estimatedClaimableUsdc)} color={claimable ? "text-[#65ecaf]" : undefined} />
          <MobileMetric label={rewardState.label} value={rewardState.value} color={rewardState.color} />
          <MobileMetric label="Updated" value={new Date(position.updatedAt).toLocaleDateString()} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:text-white"
            href={`/market/${position.creatorWallet}`}
          >
            Market
          </Link>
          <Link
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:text-white"
            href={`/buyout/${position.creatorWallet}`}
          >
            Buyout
          </Link>
          {claimable && claimsEnabled && !ineligible ? (
            <ClaimButton creatorWallet={position.creatorWallet} onRefresh={onRefresh} />
          ) : null}
          {claimable && (!claimsEnabled || ineligible) ? <DisabledClaimPill label={ineligible ? "Not eligible" : undefined} /> : null}
        </div>
      </div>
    </div>
  );
}

function DisabledClaimPill({ label = "Demo only" }: { label?: string }) {
  return (
    <span className="rounded-lg border tone-state-warning px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold">
      {label}
    </span>
  );
}

function MetricCell({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="min-w-[78px] text-right">
      <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.12em] text-[#5a6d87]">{label}</p>
      <p className={`mt-0.5 text-[length:var(--fs-overline)] font-semibold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function MobileMetric({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5">
      <p className="text-[length:var(--fs-nano)] uppercase tracking-[0.14em] text-[#5a6d87]">{label}</p>
      <p className={`mt-0.5 text-[length:var(--fs-micro)] font-semibold ${color ?? "text-white"}`}>{value}</p>
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
        className="rounded-lg bg-[#65ecaf] px-3.5 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
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
  claimsEnabled,
  onRefresh,
  portfolio,
}: {
  claimsEnabled: boolean;
  onRefresh: () => Promise<void>;
  portfolio: S1PortfolioResponse;
}) {
  const { locale } = useI18n();
  const claimable = portfolio.positions.filter((p) =>
    hasClaimableUsdc(p.estimatedClaimableUsdc) && p.discoveryRewardEligible !== false,
  );
  const ineligible = portfolio.positions.filter((p) =>
    p.discoveryRewardEligible === false && Number(p.internalTokenBalance || 0) > 0,
  );
  const claimed = portfolio.positions.filter((p) => p.discoveryRewardClaimed);
  const totalUsdc = claimable.reduce((s, p) => s + Number(p.estimatedClaimableUsdc || 0), 0);

  if (claimable.length === 0 && ineligible.length === 0 && claimed.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-6 text-center text-xs text-[#8ea0ba]">
        No capped S1 discovery rewards ready for this wallet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!claimsEnabled ? (
        <div className="rounded-[12px] border tone-state-warning px-3 py-2 text-[length:var(--fs-micro)] leading-5">
          Local demo sessions show discovery-reward eligibility only. A real claim requires a matching wallet session, backend builder, wallet signature, and synchronized S1 projection.
        </div>
      ) : null}

      <div className="flex items-center justify-between px-1">
        <span className="text-[length:var(--fs-micro)] uppercase tracking-[0.14em] text-[#5a6d87]">
          {claimable.length} ready · {ineligible.length} ineligible · {claimed.length} claimed
        </span>
        <span className="text-[length:var(--fs-overline)] font-semibold text-[#65ecaf]">
          Total capped rewards: {formatUsdcAmount(String(totalUsdc))}
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
                <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">
                  {displayPortfolioCreatorName(pos, locale)}
                </p>
                <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#8ea0ba]">
                  {formatS1Amount(pos.internalTokenBalance)} S1
                </p>
              </div>
              <p className="text-base font-semibold text-[#65ecaf]">
                {formatUsdcAmount(pos.estimatedClaimableUsdc)}
              </p>
            </div>
            <div className="mt-3">
              {claimsEnabled ? (
                <ClaimButton creatorWallet={pos.creatorWallet} onRefresh={onRefresh} />
              ) : (
                <DisabledClaimPill />
              )}
            </div>
          </div>
        ))}
      </div>

      {ineligible.length > 0 ? (
        <div className="rounded-[14px] border tone-state-warning p-4">
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em]">
            Not eligible in current snapshot
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {ineligible.map((pos) => (
              <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5" key={pos.positionPda}>
                <p className="truncate text-[length:var(--fs-overline)] font-semibold text-white">
                  {displayPortfolioCreatorName(pos, locale)}
                </p>
                <p className="mt-1 text-[length:var(--fs-micro)] leading-4">
                  This row is not counted in the discovery reward snapshot. The position is not cleared by an ineligible claim attempt.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {claimed.length > 0 ? (
        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#8ea0ba]">
            Already finalized
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {claimed.map((pos) => (
              <div className="rounded-[12px] border border-white/[0.05] bg-white/[0.02] px-3 py-2.5" key={pos.positionPda}>
                <p className="truncate text-[length:var(--fs-overline)] font-semibold text-white">
                  {displayPortfolioCreatorName(pos, locale)}
                </p>
                <p className="mt-1 text-[length:var(--fs-micro)] text-[#8ea0ba]">
                  Final discovery reward: {formatUsdcAmount(pos.lastDiscoveryRewardUsdc ?? "0")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Positions list                                                     */
/* ------------------------------------------------------------------ */

function PositionsList({
  claimsEnabled,
  onRefresh,
  portfolio,
}: {
  claimsEnabled: boolean;
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
        <PositionRow claimsEnabled={claimsEnabled} key={pos.positionPda} onRefresh={onRefresh} position={pos} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  S2 Endorsement Components                                          */
/* ------------------------------------------------------------------ */

function S2ClaimButton({
  proposalPda,
  onRefresh,
}: {
  proposalPda: string;
  onRefresh: () => Promise<void>;
}) {
  const flow = useProposalTransactionFlow();
  const [showDrawer, setShowDrawer] = useState(false);

  const execute = useCallback(async () => {
    setShowDrawer(true);
    const submitted = await flow.execute(async (token) => {
      return buildClaimEndorsementTransaction(token, proposalPda);
    });
    if (submitted) await onRefresh();
  }, [flow, proposalPda, onRefresh]);

  const busy =
    flow.state.status === "building" ||
    flow.state.status === "waiting_signature" ||
    flow.state.status === "submitting" ||
    flow.state.status === "syncing_projection";

  return (
    <div className="space-y-2">
      <button
        className="rounded-lg bg-[#65ecaf] px-3.5 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#090d14] transition hover:bg-[#7bf0bd] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={busy}
        onClick={() => void execute()}
        type="button"
      >
        {busy ? "..." : "Claim"}
      </button>
      {showDrawer ? (
        <S1TransactionDrawer
          actionLabel="Claim S2 Reward"
          flow={flow.state as any}
          onClose={() => {
            flow.reset();
            setShowDrawer(false);
          }}
          onRetry={() => void execute()}
        />
      ) : null}
    </div>
  );
}

function S2EndorsementRow({
  claimsEnabled,
  onRefresh,
  endorsement,
}: {
  claimsEnabled: boolean;
  onRefresh: () => Promise<void>;
  endorsement: Required<S1PortfolioResponse>["s2Endorsements"][number];
}) {
  const isClaimed = endorsement.claimedStatus;
  const isClaimable =
    !isClaimed &&
    ["RESOLVED_SUCCESS", "RESOLVED_FAIL", "CANCELLED", "VOIDED"].includes(
      endorsement.status ?? ""
    );
  const status = endorsement.status ?? "UNKNOWN";

  const stakedSpump = formatS1Amount(endorsement.stakedSpumpAmount);
  const rewardUsdc = formatUsdcAmount(endorsement.estimatedUsdcReward);

  let statusText = status.replace("_", " ");
  let statusColor = "tone-state-neutral";
  if (status === "RESOLVED_SUCCESS") {
    statusText = "Success";
    statusColor = "tone-state-success";
  } else if (status === "RESOLVED_FAIL") {
    statusText = "Failed";
    statusColor = "tone-state-danger";
  } else if (status === "CANCELLED" || status === "VOIDED") {
    statusText = "Voided";
    statusColor = "tone-state-neutral";
  } else if (status === "OPEN" || status === "FUNDED") {
    statusText = "Active";
    statusColor = "tone-state-info";
  }

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[linear-gradient(175deg,rgba(14,19,30,0.94)_0%,rgba(10,14,22,0.94)_100%)] p-4">
      {/* Desktop layout */}
      <div className="hidden items-center gap-4 xl:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-bold text-[#f3b33e]">
          S2
        </div>
        <div className="min-w-[160px] flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[length:var(--fs-caption)] font-semibold text-white">
              Campaign {shortenWallet(endorsement.proposalPda)}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[length:var(--fs-nano)] font-medium uppercase tracking-wider ${statusColor}`}>
              {statusText}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[length:var(--fs-micro)] text-[#6f8099]">
            Creator: {endorsement.creatorWallet ? shortenWallet(endorsement.creatorWallet) : "—"}
          </p>
        </div>
        <MetricCell label="Staked SPUMP" value={stakedSpump} />
        <MetricCell
          label={status === "RESOLVED_SUCCESS" ? "Capped reward" : "Reward est."}
          value={rewardUsdc}
          color={isClaimable && status === "RESOLVED_SUCCESS" ? "text-[color:var(--state-success)]" : undefined}
        />
        <MetricCell
          label="Status"
          value={isClaimed ? "Claimed" : "Unclaimed"}
          color={isClaimed ? "text-[#8ea0ba]" : "text-[#f3b33e]"}
        />
        <MetricCell label="Updated" value={new Date(endorsement.updatedAt).toLocaleDateString()} />
        <div className="flex items-center gap-2">
          {endorsement.proposalPda && (
            <Link
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:border-white/[0.14] hover:text-white"
              href={`/campaigns/${endorsement.proposalPda}`}
            >
              Campaign
            </Link>
          )}
          {isClaimable && claimsEnabled ? (
            <S2ClaimButton proposalPda={endorsement.proposalPda} onRefresh={onRefresh} />
          ) : null}
          {isClaimable && !claimsEnabled ? <DisabledClaimPill /> : null}
          {!isClaimable && !isClaimed && (
            <span className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#8ea0ba]">
              Staking
            </span>
          )}
          {isClaimed && (
            <span className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#8ea0ba]">
              Claimed
            </span>
          )}
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[length:var(--fs-micro)] font-bold text-[#f3b33e]">
            S2
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[length:var(--fs-caption)] font-semibold text-white">
                Campaign {shortenWallet(endorsement.proposalPda)}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[length:var(--fs-nano)] font-medium uppercase tracking-wider ${statusColor}`}>
                {statusText}
              </span>
            </div>
            <p className="truncate font-mono text-[length:var(--fs-micro)] text-[#6f8099]">
              Creator: {endorsement.creatorWallet ? shortenWallet(endorsement.creatorWallet) : "—"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MobileMetric label="Staked SPUMP" value={stakedSpump} />
          <MobileMetric
            label={status === "RESOLVED_SUCCESS" ? "Capped reward" : "Reward est."}
            value={rewardUsdc}
            color={isClaimable && status === "RESOLVED_SUCCESS" ? "text-[color:var(--state-success)]" : undefined}
          />
          <MobileMetric
            label="Status"
            value={isClaimed ? "Claimed" : "Unclaimed"}
            color={isClaimed ? "text-[#8ea0ba]" : "text-[#f3b33e]"}
          />
          <MobileMetric label="Updated" value={new Date(endorsement.updatedAt).toLocaleDateString()} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {endorsement.proposalPda && (
            <Link
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#8ea0ba] transition hover:text-white"
              href={`/campaigns/${endorsement.proposalPda}`}
            >
              Campaign
            </Link>
          )}
          {isClaimable && claimsEnabled ? (
            <S2ClaimButton proposalPda={endorsement.proposalPda} onRefresh={onRefresh} />
          ) : null}
          {isClaimable && !claimsEnabled ? <DisabledClaimPill /> : null}
          {!isClaimable && !isClaimed && (
            <span className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#8ea0ba]">
              Staking
            </span>
          )}
          {isClaimed && (
            <span className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#8ea0ba]">
              Claimed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function S2EndorsementsList({
  claimsEnabled,
  onRefresh,
  endorsements = [],
}: {
  claimsEnabled: boolean;
  onRefresh: () => Promise<void>;
  endorsements?: S1PortfolioResponse["s2Endorsements"];
}) {
  if (!endorsements || endorsements.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-6 text-center text-xs text-[#8ea0ba]">
        No S2 campaign endorsement positions found for this wallet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {endorsements.map((end) => (
        <S2EndorsementRow
          claimsEnabled={claimsEnabled}
          endorsement={end}
          key={end.positionPda}
          onRefresh={onRefresh}
        />
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
      <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">Seeded test wallets</p>
      <div className="mt-1.5 space-y-1">
        {holders.map((h) => (
          <div className="flex items-center justify-between gap-3" key={h.wallet}>
            <span className="text-[length:var(--fs-micro)] text-[#8ea0ba]">{h.label}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[length:var(--fs-micro)] text-[#7486a1]" title={h.wallet}>
                {shortenWallet(h.wallet)}
              </span>
              <button
                className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[length:var(--fs-nano)] font-medium text-[#8ad0ff] transition hover:border-white/[0.14] hover:text-white"
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
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#8ad0ff]">
            Demo portfolio
          </p>
          <p className="mt-1 text-[length:var(--fs-overline)] leading-5 text-[#8ea0ba]">
            Load a local mock session to preview S1 positions and claim eligibility labels without a wallet.
          </p>
        </div>
        <button
          className="rounded-full bg-[#de402a] px-4 py-2 text-[length:var(--fs-micro)] font-semibold text-white transition hover:bg-[#ea523e]"
          onClick={onLoadDemo}
          type="button"
        >
          Load demo preview
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
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#8ad0ff] transition hover:border-white/[0.14] hover:text-white"
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
      <div className="rounded-[14px] border tone-state-warning p-4">
        <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em]">Fallback preview</p>
        <p className="mt-1 text-[length:var(--fs-overline)] leading-5">
          No live portfolio projection is loaded from this state. Demo links below are informational until the API, session, RPC, and seeded S1 projection are available.
        </p>
        <p className="mt-2 font-mono text-[length:var(--fs-micro)] text-[#c9a044]">{reason}</p>
      </div>
      <DemoCreatorBanner creatorWallet={DEMO_S1_CREATOR_WALLET} />
      <DemoHolderHints />
    </div>
  );
}

function PortfolioSourceNotice({
  mode,
  reason,
}: {
  mode: "signed-out" | "live" | "mock" | "fallback";
  reason?: string | null;
}) {
  const config = {
    "signed-out": {
      label: "AUTH_REQUIRED",
      title: "Portfolio waits for wallet-backed session",
      body: "No portfolio API request is treated as usable until a wallet is connected and the stored auth session matches it. Demo shortcuts remain preview-only.",
      tone: "tone-state-neutral",
    },
    live: {
      label: "SEEDED_DEMO",
      title: "Backend portfolio projection",
      body: "Positions come from the portfolio API. USDC claim actions build a devnet transaction through the backend, require the matching wallet signature, and depend on the S1 projection being synchronized.",
      tone: "tone-state-info",
    },
    mock: {
      label: "MOCK_PREVIEW",
      title: "Local demo portfolio session",
      body: "This state is generated from a local mock token. It does not call the portfolio API, request a wallet signature, build a claim transaction, or update account balances.",
      tone: "tone-state-warning",
    },
    fallback: {
      label: "API_FALLBACK",
      title: "Live projection unavailable",
      body: `The portfolio API did not provide a usable live projection${reason ? `: ${reason}` : "."} Demo links below do not represent a production claim path.`,
      tone: "tone-state-warning",
    },
  }[mode];

  return (
    <section className={`mt-3 rounded-[14px] border px-4 py-3 ${config.tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] opacity-80">Portfolio data source</p>
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

function PortfolioPage() {
  const { t } = useI18n();
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<LiveTab>("Portfolio");
  const [portfolio, setPortfolio] = useState<S1PortfolioResponse | null>(null);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [isMockPortfolioSession, setIsMockPortfolioSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const previewPortfolio = usePreviewPortfolio();
  const previewWatchlist = usePreviewWatchlist();

  const connectedWallet = wallet.publicKey?.toBase58() ?? null;
  const hasActiveWalletSession =
    isMockPortfolioSession || Boolean(sessionWallet && connectedWallet && sessionWallet === connectedWallet);
  const portfolioSourceMode = !hasActiveWalletSession
    ? "signed-out"
    : fallbackReason
      ? "fallback"
      : isMockPortfolioSession
        ? "mock"
        : "live";
  const liveClaimsEnabled = hasActiveWalletSession && !fallbackReason && !isMockPortfolioSession;
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
        <div className="mx-auto max-w-[1100px] space-y-3">
          {!loading ? <PortfolioSourceNotice mode={portfolioSourceMode} reason={fallbackReason} /> : null}
        </div>

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
              <p className="mx-auto max-w-xs rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[length:var(--fs-micro)] text-[#8ea0ba]">
                {t("portfolio.connected")}: {shortenWallet(connectedWallet)}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <WalletMultiButton className="!rounded-full !text-sm" />
              <Link
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[length:var(--fs-overline)] font-semibold text-white transition hover:border-white/[0.14]"
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
              sourceLabel={isMockPortfolioSession ? "Demo Portfolio" : "Backend Portfolio"}
            />

            <MetricsStrip portfolio={portfolio} />

            <TabBar active={activeTab} onChange={setActiveTab} />

            {activeTab === "Portfolio" ? (
              <PositionsList claimsEnabled={liveClaimsEnabled} onRefresh={refresh} portfolio={portfolio} />
            ) : null}

            {activeTab === "Claim queue" ? (
              <ClaimQueue claimsEnabled={liveClaimsEnabled} onRefresh={refresh} portfolio={portfolio} />
            ) : null}

            {activeTab === "S2 Endorsements" ? (
              <S2EndorsementsList claimsEnabled={liveClaimsEnabled} onRefresh={refresh} endorsements={portfolio.s2Endorsements} />
            ) : null}

            {activeTab === "Preview Holdings" ? (
              <PreviewHoldingsTable rows={previewPortfolio.holdings} />
            ) : null}

            {activeTab === "Watchlist" ? (
              <PreviewWatchlistPanel rows={previewWatchlist} />
            ) : null}

            {activeTab === "Rewards" ? (
              <PreviewRewardsPanel portfolio={previewPortfolio} />
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

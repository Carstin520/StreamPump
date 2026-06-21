import Link from "next/link";
import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  ClockIcon,
  DotIcon,
  SendRoundedIcon,
  TrendUpIcon,
} from "@/components/shared/AppIcons";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { StagePill } from "@/components/shared/StagePill";
import {
  PortfolioClaimWindowRecord,
  PortfolioReentryRecord,
} from "@/lib/api/types";
import {
  findCreator,
  portfolioClaimWindows,
  portfolioExposureTrend,
  portfolioHoldings,
  portfolioReentryPositions,
  portfolioUpcomingClaims,
  formatUsd,
} from "@/lib/public-data";

const PRIMARY_BUTTON_CLASS =
  "glass-button-primary px-4 py-3 text-sm font-semibold";
const SECONDARY_BUTTON_CLASS =
  "glass-button-ghost px-4 py-3 text-sm font-medium";

export const PORTFOLIO_TABS = ["Portfolio", "Claim queue", "Endorsements", "Re-entry"] as const;

export type PortfolioTab = (typeof PORTFOLIO_TABS)[number];

export type PortfolioFlowState =
  | {
      kind: "claim";
      status: "confirm" | "processing" | "success";
      record: PortfolioClaimWindowRecord;
    }
  | {
      kind: "reentry";
      status: "confirm" | "processing" | "success";
      record: PortfolioReentryRecord;
    }
  | null;

export const getTrendTone = (points: number[]): "positive" | "negative" =>
  (points.at(-1) ?? 0) >= (points[0] ?? 0) ? "positive" : "negative";

export const PortfolioMetrics = ({
  exposureTone,
  totalExposure,
  waitingActionsCount,
}: {
  exposureTone: "positive" | "negative";
  totalExposure: number;
  waitingActionsCount: number;
}) => (
  <section className="grid gap-4 md:grid-cols-3">
    <MetricCard icon={<TrendUpIcon className="h-3.5 w-3.5" />} label="Active Backing" tone="neutral" value={String(portfolioHoldings.length)} />
    <MetricCard icon={<DotIcon className="h-2.5 w-2.5" />} label="Support Snapshot" tone={exposureTone} value={formatUsd(totalExposure)} />
    <MetricCard icon={<ClockIcon className="h-3.5 w-3.5" />} label="Waiting Actions" tone="neutral" value={String(waitingActionsCount)} />
  </section>
);

export const PortfolioTabBar = ({
  activeTab,
  onTabChange,
}: {
  activeTab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) => (
  <section className="flex items-center gap-6 border-b border-white/[0.08]">
    {PORTFOLIO_TABS.map((tab) => (
      <button
        className={`relative pb-4 text-sm font-medium transition ${
          activeTab === tab ? "text-white" : "text-[#8798b2] hover:text-white"
        }`}
        key={tab}
        onClick={() => onTabChange(tab)}
        type="button"
      >
        {tab}
        {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" /> : null}
      </button>
    ))}
  </section>
);

export const PortfolioHoldingsSection = ({
  onClaim,
  totalExposure,
}: {
  onClaim: (record: PortfolioClaimWindowRecord) => void;
  totalExposure: number;
}) => {
  const primaryClaim = portfolioClaimWindows[0] ?? null;

  return (
    <>
      <PortfolioOverviewCard totalExposure={totalExposure} />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Holdings</h2>
          <div className="space-y-3">
            {portfolioHoldings.map((holding) => {
              const creator = findCreator(holding.creatorId);
              const currentPrice = holding.currentPriceUsd ?? creator.tokenPrice;
              const trendTone = getTrendTone(holding.trend);

              return (
                <Link
                  className="card-radius block border border-white/[0.06] bg-[#121826] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition hover:border-white/[0.1] hover:bg-[#141b2a]"
                  href={`/creators/${creator.id}`}
                  key={holding.creatorId}
                >
                  <div className="flex flex-wrap items-center gap-4 xl:flex-nowrap">
                    <img alt={creator.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
                    <div className="min-w-[160px] flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-base font-semibold text-white">{creator.name}</p>
                        <StagePill compact stage={creator.state} />
                      </div>
                      <p className="mt-1 truncate text-sm text-[#8ea0ba]">{holding.tokenCount} S1 backing units</p>
                    </div>

                    <div className="min-w-[92px]">
                      <SparklineChart
                        className="w-[92px]"
                        color={trendTone === "positive" ? "#65ecaf" : "#f67263"}
                        fillColor={trendTone === "positive" ? "rgba(101,236,175,0.12)" : "rgba(246,114,99,0.12)"}
                        height={42}
                        points={holding.trend}
                        width={92}
                      />
                    </div>

                    <div className="ml-auto grid grid-cols-3 gap-4 text-right md:gap-8">
                      <HoldingMetric label="Support rate" value={formatUsd(currentPrice)} />
                      <HoldingMetric label="SPUMP used" value={formatUsd(holding.avgEntryUsd)} />
                      <HoldingMetric
                        highlight={holding.unrealizedChangePct > 0 ? "green" : holding.unrealizedChangePct < 0 ? "pink" : "neutral"}
                        label="Signal delta"
                        value={`${holding.unrealizedChangePct > 0 ? "+" : ""}${holding.unrealizedChangePct.toFixed(1)}%`}
                      />
                    </div>

                    <div className="ml-auto flex overflow-hidden rounded-full border border-white/10">
                      <button className="cursor-not-allowed border-r border-white/10 px-4 py-2 text-sm text-[#7f90ab]" disabled type="button">
                        Back preview
                      </button>
                      <button className="cursor-not-allowed px-4 py-2 text-sm text-[#7f90ab]" disabled type="button">
                        Unback preview
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Pending Actions</h2>
          {primaryClaim ? <PendingClaimCard record={primaryClaim} onClaim={() => onClaim(primaryClaim)} /> : null}
        </div>
      </section>
    </>
  );
};

export const ClaimQueueSection = ({
  onClaim,
}: {
  onClaim: (record: PortfolioClaimWindowRecord) => void;
}) => (
  <section className="space-y-7">
    <div>
      <h2 className="text-lg font-semibold text-white">Active Claim Windows</h2>
      <p className="mt-1 text-sm text-[#8ea0ba]">Buyout claims you can act on right now.</p>
    </div>

    <div className="space-y-4">
      {portfolioClaimWindows.map((record) => (
        <ActiveClaimCard key={record.id} record={record} onClaim={() => onClaim(record)} />
      ))}
    </div>

    <div className="pt-3">
      <h2 className="text-lg font-semibold text-white">Upcoming Windows</h2>
      <p className="mt-1 text-sm text-[#8ea0ba]">Scheduled buyouts opening soon — no action needed yet.</p>
      <div className="mt-4 space-y-3">
        {portfolioUpcomingClaims.map((record) => {
          const creator = findCreator(record.creatorId);
          return (
            <div
              className="card-radius flex flex-wrap items-center gap-4 border border-white/[0.06] bg-[#121826] px-4 py-4"
              key={record.id}
            >
              <img alt={creator.name} className="h-11 w-11 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-white">{creator.name}</p>
                <p className="mt-1 text-xs text-[#8ea0ba]">
                  {record.eligibleTokens} backing units · capped estimate
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Opens</p>
                <p className="mt-1 text-sm font-medium text-[#67b8ff]">{record.opensInLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Discovery reward</p>
                <p className="mt-1 text-sm font-medium text-white">{formatUsd(record.estimatedPayoutUsd)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export const ReentrySection = ({
  onReentry,
}: {
  onReentry: (record: PortfolioReentryRecord) => void;
}) => (
  <section className="space-y-6">
    <div className="card-radius border border-white/[0.06] bg-[#121826] px-5 py-4 text-sm leading-7 text-[#94a5be]">
      Re-entry shows creators you previously unbacked. You can support the creator again through the in-platform S1 backing flow; any USDC reward remains capped and eligibility-based.
    </div>

    <div>
      <h2 className="text-lg font-semibold text-white">Exited Positions</h2>
      <p className="mt-1 text-sm text-[#8ea0ba]">S1 backing units you&apos;ve fully unbacked or finalized.</p>
    </div>

    <div className="space-y-3">
      {portfolioReentryPositions.map((record) => {
        const creator = findCreator(record.creatorId);
        return (
          <div
            className="card-radius flex flex-wrap items-center gap-4 border border-white/[0.06] bg-[#121826] px-4 py-4"
            key={record.id}
          >
            <img alt={creator.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
            <div className="min-w-[180px] flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-base font-semibold text-white">{creator.name}</p>
                <StagePill compact stage={creator.state} />
              </div>
              <p className="mt-1 truncate text-sm text-[#8ea0ba]">
                {record.thesis} · {record.exitedAtLabel}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right md:min-w-[320px] md:gap-8">
              <HoldingMetric label="Unback rate" value={formatUsd(record.exitPriceUsd)} />
              <HoldingMetric label="Current signal" value={formatUsd(record.currentPriceUsd)} />
              <HoldingMetric highlight="green" label="Since unback" value={`+${record.sinceExitPerformancePct.toFixed(1)}%`} />
            </div>
            <button
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-[#7f90ab]"
              disabled
              onClick={() => undefined}
              type="button"
            >
              Preview only
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  </section>
);

export const ActionFlowModal = ({
  flowState,
  onClose,
  onConfirm,
}: {
  flowState: Exclude<PortfolioFlowState, null>;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const creator = findCreator(flowState.record.creatorId);
  const title = flowState.kind === "claim" ? `Claim ${creator.name}` : `Buy back ${creator.name}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <button className="absolute inset-0 bg-[#06090f]/68 backdrop-blur-[6px]" onClick={onClose} type="button" />
      <div className="card-radius relative z-10 w-full max-w-[480px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(18,25,37,0.96)_0%,rgba(11,17,27,0.96)_100%)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-center gap-4">
          <img alt={creator.name} className="h-14 w-14 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7485a0]">{flowState.kind === "claim" ? "Claim flow" : "Re-entry flow"}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
          </div>
        </div>

        {flowState.status === "confirm" ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm leading-7 text-[#c9d3e1]">
              {flowState.kind === "claim"
                ? `This mock flow will mark ${formatUsd(flowState.record.payoutUsd)} as a submitted discovery reward and move the window into a completed preview state.`
                : `This mock flow will stage a simulated buy-back at ${formatUsd(flowState.record.currentPriceUsd)} and add the position to your watchlist preview.`}
            </p>
            <div className="card-radius border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-[#92a3bc]">
              {flowState.kind === "claim"
                ? `${flowState.record.eligibleTokens} backing units · capped estimate · closes ${flowState.record.closesInLabel}`
                : `${flowState.record.thesis} · exited at ${formatUsd(flowState.record.exitPriceUsd)} · current ${formatUsd(flowState.record.currentPriceUsd)}`}
            </div>
            <div className="flex gap-3">
              <button className={`flex-1 ${SECONDARY_BUTTON_CLASS}`} onClick={onClose} type="button">
                Not now
              </button>
              <button className={`flex flex-1 items-center justify-center gap-2 ${PRIMARY_BUTTON_CLASS}`} onClick={onConfirm} type="button">
                Confirm
                <SendRoundedIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {flowState.status === "processing" ? (
          <div className="card-radius mt-6 border border-white/[0.06] bg-white/[0.03] p-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#de402a]" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[#c9d3e1]">
              {flowState.kind === "claim"
                ? "Submitting discovery-reward preview. The interface stays intentionally lightweight, but the state transition is explicit."
                : "Staging buy-back preview. This does not alter real holdings, but it completes the prototype flow end-to-end."}
            </p>
          </div>
        ) : null}

        {flowState.status === "success" ? (
          <div className="mt-6 space-y-4">
            <div className="card-radius border border-[#1d4d36] bg-[linear-gradient(180deg,rgba(18,45,33,0.68)_0%,rgba(9,21,16,0.92)_100%)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8df0bb]">Complete</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {flowState.kind === "claim" ? "Claim submitted in preview state." : "Buy-back preview added to your watchlist."}
              </p>
              <p className="mt-2 text-sm leading-7 text-[#b7d9c5]">
                {flowState.kind === "claim"
                  ? `Estimated discovery reward ${formatUsd(flowState.record.payoutUsd)} is now marked as submitted.`
                  : `${creator.name} is now surfaced as a re-entry watch candidate for this session.`}
              </p>
            </div>
            <button className={`w-full ${PRIMARY_BUTTON_CLASS}`} onClick={onClose} type="button">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const PortfolioOverviewCard = ({ totalExposure }: { totalExposure: number }) => {
  const tone = getTrendTone(portfolioExposureTrend.map((point) => point.value));
  const timelineLabels = compactTrendLabels(portfolioExposureTrend.map((point) => point.label));

  return (
    <section className="liquid-glass-shell card-radius p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#73849f]">Support trend</p>
          <h2 className="mt-3 text-[42px] font-semibold tracking-[-0.04em] text-white lg:text-[52px]">{formatUsd(totalExposure)}</h2>
          <p className={`mt-2 text-sm ${tone === "positive" ? "text-[#65ecaf]" : "text-[#f67263]"}`}>
            {tone === "positive" ? "Portfolio trend is still climbing across the last 8 sessions." : "Portfolio trend is softening across the last 8 sessions."}
          </p>
        </div>
        <div className="liquid-card card-radius min-w-[220px] px-4 py-3 text-sm text-[#8ea0ba]">
        Lightweight snapshots keep the trend readable without turning this section into a trading dashboard.
        </div>
      </div>

      <div className="liquid-card card-radius mt-6 overflow-hidden px-3 py-4">
        <SparklineChart
          className="h-[180px] w-full"
          color={tone === "positive" ? "#65ecaf" : "#f67263"}
          fillColor={tone === "positive" ? "rgba(101,236,175,0.14)" : "rgba(246,114,99,0.14)"}
          height={180}
          points={portfolioExposureTrend.map((point) => point.value)}
          strokeWidth={3}
          width={640}
        />
        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[#70819a]">
          {timelineLabels.map((label) => (
            <span className="shrink-0" key={label}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

const PendingClaimCard = ({
  record,
  onClaim,
}: {
  record: PortfolioClaimWindowRecord;
  onClaim: () => void;
}) => {
  const creator = findCreator(record.creatorId);

  return (
    <div className="card-radius border border-[#8d6120]/34 bg-[linear-gradient(180deg,rgba(77,49,20,0.3)_0%,rgba(24,17,12,0.95)_100%)] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3b33e]">
        <ClockIcon className="h-3.5 w-3.5" />
        {record.statusLabel}
      </div>

      <h3 className="mt-4 text-xl font-semibold text-white">{creator.name} S1 Buyout</h3>
      <p className="mt-3 text-sm leading-7 text-[#c8d3e2]">
        Your {record.eligibleTokens} backing units are eligible for a capped discovery reward. Claim window closes in {record.closesInLabel}.
      </p>

      <div className="card-radius mt-5 flex items-center gap-3 border border-white/8 bg-[#111722] p-3">
        <img alt={creator.name} className="h-10 w-10 rounded-full object-cover" src={creator.avatarSrc} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{creator.name}</p>
        </div>
      </div>

      <div className="card-radius mt-4 border border-[#65ecaf]/20 bg-[linear-gradient(180deg,rgba(18,45,33,0.4)_0%,rgba(9,21,16,0.6)_100%)] px-4 py-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8df0bb]">Estimated discovery reward</p>
        <p className="mt-2 text-[32px] font-bold tracking-[-0.04em] text-[#65ecaf]">{formatUsd(record.payoutUsd)}</p>
      </div>

      <button className={`mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 ${SECONDARY_BUTTON_CLASS}`} disabled onClick={() => undefined} type="button">
        Claim preview only
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

const ActiveClaimCard = ({
  record,
  onClaim,
}: {
  record: PortfolioClaimWindowRecord;
  onClaim: () => void;
}) => {
  const creator = findCreator(record.creatorId);

  return (
    <div className="card-radius border border-[#8d6120]/34 bg-[linear-gradient(180deg,rgba(77,49,20,0.18)_0%,rgba(18,21,32,0.86)_100%)] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img alt={creator.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-white">{creator.name}</p>
              <StagePill compact stage={creator.state} />
            </div>
            <p className="mt-1 text-sm text-[#8ea0ba]">{record.eligibleTokens} backing units eligible</p>
          </div>
        </div>
        <span className="rounded-full border border-[#7e5a23] bg-[#342515] px-3 py-1 text-xs font-semibold text-[#f3b33e]">
          {record.closesInLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ClaimMetricCard label="Reward model" value="Capped" />
        <ClaimMetricCard label="Backing units" value={String(record.eligibleTokens)} />
        <ClaimMetricCard label="Discovery reward" tone="positive" value={formatUsd(record.payoutUsd)} />
      </div>

      <button className={`mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 ${SECONDARY_BUTTON_CLASS}`} disabled onClick={() => undefined} type="button">
        Preview only: {formatUsd(record.payoutUsd)}
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

const ClaimMetricCard = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) => (
  <div className="card-radius border border-white/[0.06] bg-[#121826] px-4 py-4">
    <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">{label}</p>
    <p className={`mt-2 text-[28px] font-semibold tracking-[-0.04em] ${tone === "positive" ? "text-[#65ecaf]" : "text-white"}`}>{value}</p>
  </div>
);

const MetricCard = ({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "neutral" | "positive" | "negative";
  value: string;
}) => (
  <div className="card-radius border border-white/[0.08] bg-[#121826] px-5 py-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#6f8099]">
      <span className={tone === "positive" ? "text-[#65ecaf]" : tone === "negative" ? "text-[#f67263]" : "text-[#94a5be]"}>{icon}</span>
      {label}
    </div>
    <p className={`mt-3 text-[38px] font-semibold tracking-[-0.04em] ${tone === "positive" ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>
);

const HoldingMetric = ({
  label,
  value,
  highlight = "neutral",
}: {
  label: string;
  value: string;
  highlight?: "green" | "pink" | "neutral";
}) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">{label}</p>
    <p className={`mt-1 text-sm font-medium ${highlight === "green" ? "text-[#65ecaf]" : highlight === "pink" ? "text-[#ff8ca8]" : "text-white"}`}>{value}</p>
  </div>
);

type EndorsementRecord = {
  id: string;
  proposalLabel: string;
  creatorId: string;
  stakedSpump: number;
  status: "active" | "success" | "fail" | "voided";
  track2Progress: number;
  estimatedUsdcReward: number;
  claimable: boolean;
};

const MOCK_ENDORSEMENTS: EndorsementRecord[] = [
  { id: "e1", proposalLabel: "游戏预告片情绪拆解", creatorId: "neo-park", stakedSpump: 200000, status: "success", track2Progress: 80, estimatedUsdcReward: 160000, claimable: true },
  { id: "e2", proposalLabel: "重庆说唱现场", creatorId: "wudu-lowfreq", stakedSpump: 50000, status: "active", track2Progress: 42, estimatedUsdcReward: 0, claimable: false },
  { id: "e3", proposalLabel: "赛道现场切片", creatorId: "corner-heartbeat", stakedSpump: 80000, status: "fail", track2Progress: 28, estimatedUsdcReward: 0, claimable: true },
];

const ENDORSEMENT_TONES: Record<EndorsementRecord["status"], { border: string; badge: string; badgeText: string; label: string }> = {
  active: { border: "border-[#67b8ff]/20", badge: "bg-[#67b8ff]/12 text-[#8ad0ff]", badgeText: "Active", label: "text-[#8ad0ff]" },
  success: { border: "border-[#65ecaf]/20", badge: "bg-[#65ecaf]/12 text-[#8df0c4]", badgeText: "Success", label: "text-[#65ecaf]" },
  fail: { border: "border-[#f67263]/20", badge: "bg-[#f67263]/12 text-[#f67263]", badgeText: "Failed", label: "text-[#f67263]" },
  voided: { border: "border-white/10", badge: "bg-white/5 text-[#8ea0ba]", badgeText: "Voided", label: "text-[#8ea0ba]" },
};

export const EndorsementsSection = () => (
  <section className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-white">S2 Endorsements</h2>
      <p className="mt-1 text-sm text-[#8ea0ba]">Your active and settled SPUMP endorsement positions.</p>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="card-radius border border-white/[0.06] bg-[#121826] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Total staked</p>
        <p className="mt-2 text-[32px] font-semibold tracking-[-0.04em] text-white">
          {(MOCK_ENDORSEMENTS.reduce((s, e) => s + e.stakedSpump, 0) / 1000).toFixed(0)}k
        </p>
        <p className="mt-1 text-xs text-[#6b7d96]">SPUMP across {MOCK_ENDORSEMENTS.length} positions</p>
      </div>
      <div className="card-radius border border-white/[0.06] bg-[#121826] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Claimable USDC</p>
        <p className="mt-2 text-[32px] font-semibold tracking-[-0.04em] text-[#65ecaf]">
          {formatUsd(MOCK_ENDORSEMENTS.filter((e) => e.claimable && e.status === "success").reduce((s, e) => s + e.estimatedUsdcReward, 0))}
        </p>
      </div>
      <div className="card-radius border border-white/[0.06] bg-[#121826] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Active positions</p>
        <p className="mt-2 text-[32px] font-semibold tracking-[-0.04em] text-white">
          {MOCK_ENDORSEMENTS.filter((e) => e.status === "active").length}
        </p>
      </div>
    </div>

    <div className="space-y-3">
      {MOCK_ENDORSEMENTS.map((endorsement) => {
        const creator = findCreator(endorsement.creatorId);
        const tone = ENDORSEMENT_TONES[endorsement.status];

        return (
          <div className={`card-radius border ${tone.border} bg-[#121826] p-4`} key={endorsement.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img alt={creator.name} className="h-11 w-11 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{endorsement.proposalLabel}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${tone.badge}`}>
                      {tone.badgeText}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6b7d96]">{creator.name} · {(endorsement.stakedSpump / 1000).toFixed(0)}k SPUMP staked</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#73849f]">Track 2</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all ${endorsement.track2Progress >= 50 ? "bg-[#65ecaf]" : "bg-[#f67263]"}`}
                        style={{ width: `${endorsement.track2Progress}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${tone.label}`}>{endorsement.track2Progress}%</span>
                  </div>
                </div>
                {endorsement.claimable ? (
                  <Link
                    className="glass-button-primary px-4 py-2 text-xs font-semibold"
                    href={`/campaigns/${endorsement.id}`}
                  >
                    {endorsement.status === "success" ? `Claim ${formatUsd(endorsement.estimatedUsdcReward)}` : "Claim SPUMP"}
                  </Link>
                ) : (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-[#6b7d96]">
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export const RageQuitAlert = () => {
  const creator = findCreator("luna-cai");

  return (
    <section className="card-radius border border-[#de402a]/25 bg-[linear-gradient(180deg,rgba(60,20,16,0.3)_0%,rgba(18,21,32,0.9)_100%)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute -inset-1 animate-ping rounded-full bg-[#de402a]/30" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#de402a]/20">
              <ClockIcon className="h-5 w-5 text-[#ff8a78]" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{creator.name} — Rage Quit Window Active</p>
            <p className="mt-0.5 text-xs text-[#8ea0ba]">36h 14m remaining · 25 tokens eligible</p>
          </div>
        </div>
        <Link className="glass-button-primary px-5 py-2.5 text-sm font-semibold" href={`/buyout/${creator.id}`}>
          View Buyout
        </Link>
      </div>
    </section>
  );
};

const compactTrendLabels = (labels: string[]) => {
  if (labels.length <= 4) {
    return labels;
  }

  return [
    labels[0],
    labels[Math.floor((labels.length - 1) / 3)],
    labels[Math.floor(((labels.length - 1) * 2) / 3)],
    labels[labels.length - 1],
  ];
};

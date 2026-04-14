import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  ChevronRightIcon,
  ClockIcon,
  DotIcon,
  SendRoundedIcon,
  TrendUpIcon,
} from "@/components/shared/AppIcons";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { StagePill } from "@/components/shared/StagePill";
import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";
import {
  PortfolioClaimWindowRecord,
  PortfolioReentryRecord,
  findCreator,
  formatUsd,
  portfolioClaimWindows,
  portfolioExposureTrend,
  portfolioHoldings,
  portfolioReentryPositions,
  portfolioUpcomingClaims,
} from "@/lib/mock-data";

type PortfolioTab = "Portfolio" | "Claim queue" | "Re-entry";
type FlowState =
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

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>("Portfolio");
  const [flowState, setFlowState] = useState<FlowState>(null);

  const totalExposure = portfolioHoldings.reduce((sum, holding) => {
    const creator = findCreator(holding.creatorId);
    return sum + (holding.currentPriceUsd ?? creator.tokenPrice) * holding.tokenCount;
  }, 0);
  const waitingActionsCount = portfolioClaimWindows.length;
  const exposureTone = getTrendTone(portfolioExposureTrend.map((point) => point.value));
  const primaryClaim = portfolioClaimWindows[0] ?? null;

  useEffect(() => {
    if (!flowState || flowState.status !== "processing") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlowState((value) => (value ? { ...value, status: "success" } : value));
    }, 960);

    return () => window.clearTimeout(timeoutId);
  }, [flowState]);

  return (
    <>
      <Head>
        <title>StreamPump | Portfolio</title>
      </Head>
      <UserShell header={<UserTopbar />}>
        <div className="mx-auto max-w-[1180px] space-y-7 py-6">
          <section>
            <h1 className="text-[42px] font-semibold tracking-[-0.05em] text-white">Your S1 exposure and next actions</h1>
            <p className="mt-2 text-sm text-[#95a6be]">Manage your creator token holdings and upcoming claims.</p>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={<TrendUpIcon className="h-3.5 w-3.5" />} label="Active Holdings" tone="neutral" value={String(portfolioHoldings.length)} />
            <MetricCard icon={<DotIcon className="h-2.5 w-2.5" />} label="Exposure Value" tone={exposureTone} value={formatUsd(totalExposure)} />
            <MetricCard icon={<ClockIcon className="h-3.5 w-3.5" />} label="Waiting Actions" tone="neutral" value={String(waitingActionsCount)} />
          </section>

          <section className="flex items-center gap-6 border-b border-white/[0.08]">
            {(["Portfolio", "Claim queue", "Re-entry"] as PortfolioTab[]).map((tab) => (
              <button
                className={`relative pb-4 text-sm font-medium transition ${
                  activeTab === tab ? "text-white" : "text-[#8798b2] hover:text-white"
                }`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
                {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" /> : null}
              </button>
            ))}
          </section>

          {activeTab === "Portfolio" ? (
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
                            <div className="min-w-[180px] flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-semibold text-white">{creator.name}</p>
                                <StagePill compact stage={creator.state} />
                              </div>
                              <p className="mt-1 text-sm text-[#8ea0ba]">{holding.tokenCount} tokens held</p>
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
                              <HoldingMetric label="Price" value={formatUsd(currentPrice)} />
                              <HoldingMetric label="Avg entry" value={formatUsd(holding.avgEntryUsd)} />
                              <HoldingMetric
                                highlight={holding.unrealizedChangePct > 0 ? "green" : holding.unrealizedChangePct < 0 ? "pink" : "neutral"}
                                label="P/L"
                                value={`${holding.unrealizedChangePct > 0 ? "+" : ""}${holding.unrealizedChangePct.toFixed(1)}%`}
                              />
                            </div>

                            <div className="ml-auto flex overflow-hidden rounded-full border border-white/10">
                              <button className="border-r border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/6" type="button">
                                Buy
                              </button>
                              <button className="px-4 py-2 text-sm text-white transition hover:bg-white/6" type="button">
                                Sell
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
                  {primaryClaim ? (
                    <PendingClaimCard
                      record={primaryClaim}
                      onClaim={() => setFlowState({ kind: "claim", record: primaryClaim, status: "confirm" })}
                    />
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "Claim queue" ? (
            <section className="space-y-7">
              <div>
                <h2 className="text-lg font-semibold text-white">Active Claim Windows</h2>
                <p className="mt-1 text-sm text-[#8ea0ba]">Buyout claims you can act on right now.</p>
              </div>

              <div className="space-y-4">
                {portfolioClaimWindows.map((record) => (
                  <ActiveClaimCard
                    key={record.id}
                    record={record}
                    onClaim={() => setFlowState({ kind: "claim", record, status: "confirm" })}
                  />
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
                            {record.eligibleTokens} tokens · {formatUsd(record.expectedPriceUsd)}/token
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Opens</p>
                          <p className="mt-1 text-sm font-medium text-[#67b8ff]">{record.opensInLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">Payout</p>
                          <p className="mt-1 text-sm font-medium text-white">{formatUsd(record.estimatedPayoutUsd)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "Re-entry" ? (
            <section className="space-y-6">
              <div className="card-radius border border-white/[0.06] bg-[#121826] px-5 py-4 text-sm leading-7 text-[#94a5be]">
                Re-entry shows creators you previously exited. You can buy back into any creator token at the current market price. Past performance doesn&apos;t guarantee future returns.
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">Exited Positions</h2>
                <p className="mt-1 text-sm text-[#8ea0ba]">Tokens you&apos;ve fully sold or claimed out of.</p>
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
                      <div className="min-w-[220px] flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-white">{creator.name}</p>
                          <StagePill compact stage={creator.state} />
                        </div>
                        <p className="mt-1 text-sm text-[#8ea0ba]">
                          {record.thesis} · {record.exitedAtLabel}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right md:min-w-[320px] md:gap-8">
                        <HoldingMetric label="Exit price" value={formatUsd(record.exitPriceUsd)} />
                        <HoldingMetric label="Current" value={formatUsd(record.currentPriceUsd)} />
                        <HoldingMetric highlight="green" label="Since exit" value={`+${record.sinceExitPerformancePct.toFixed(1)}%`} />
                      </div>
                      <button
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/6"
                        onClick={() => setFlowState({ kind: "reentry", record, status: "confirm" })}
                        type="button"
                      >
                        Buy back
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        {flowState ? <ActionFlowModal flowState={flowState} onClose={() => setFlowState(null)} onConfirm={() => setFlowState({ ...flowState, status: "processing" })} /> : null}
      </UserShell>
    </>
  );
}

const PortfolioOverviewCard = ({ totalExposure }: { totalExposure: number }) => {
  const tone = getTrendTone(portfolioExposureTrend.map((point) => point.value));

  return (
    <section className="card-radius border border-white/[0.06] bg-[#111723] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#73849f]">Exposure trend</p>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-white">{formatUsd(totalExposure)}</h2>
          <p className={`mt-2 text-sm ${tone === "positive" ? "text-[#65ecaf]" : "text-[#f67263]"}`}>
            {tone === "positive" ? "Portfolio trend is still climbing across the last 8 sessions." : "Portfolio trend is softening across the last 8 sessions."}
          </p>
        </div>
        <div className="card-radius min-w-[220px] border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-sm text-[#8ea0ba]">
          Curve uses mock portfolio snapshots and helps separate mark-to-market movement from one-off claim windows.
        </div>
      </div>

      <div className="card-radius mt-6 overflow-hidden border border-white/[0.05] bg-[linear-gradient(180deg,rgba(12,18,28,0.92)_0%,rgba(11,16,24,0.72)_100%)] px-3 py-4">
        <SparklineChart
          className="h-[180px] w-full"
          color={tone === "positive" ? "#65ecaf" : "#f67263"}
          fillColor={tone === "positive" ? "rgba(101,236,175,0.14)" : "rgba(246,114,99,0.14)"}
          height={180}
          points={portfolioExposureTrend.map((point) => point.value)}
          strokeWidth={3}
          width={640}
        />
        <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-[#70819a] md:grid-cols-8">
          {portfolioExposureTrend.map((point) => (
            <span key={point.label}>{point.label}</span>
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
        Your {record.eligibleTokens} tokens are eligible for buyout at {formatUsd(record.claimPriceUsd)}/token. Claim window closes in {record.closesInLabel}.
      </p>

      <div className="card-radius mt-5 flex items-center gap-3 border border-white/8 bg-[#111722] p-3">
        <img alt={creator.name} className="h-10 w-10 rounded-full object-cover" src={creator.avatarSrc} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{creator.name}</p>
          <p className="text-xs text-[#8ea0ba]">Estimated payout: {formatUsd(record.payoutUsd)}</p>
        </div>
      </div>

      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90" onClick={onClaim} type="button">
        Claim Now
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
            <p className="mt-1 text-sm text-[#8ea0ba]">{record.eligibleTokens} tokens eligible</p>
          </div>
        </div>
        <span className="rounded-full border border-[#7e5a23] bg-[#342515] px-3 py-1 text-xs font-semibold text-[#f3b33e]">
          {record.closesInLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ClaimMetricCard label="Claim price" value={formatUsd(record.claimPriceUsd)} />
        <ClaimMetricCard label="Tokens" value={String(record.eligibleTokens)} />
        <ClaimMetricCard label="Payout" tone="positive" value={formatUsd(record.payoutUsd)} />
      </div>

      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90" onClick={onClaim} type="button">
        Claim {formatUsd(record.payoutUsd)}
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

const ActionFlowModal = ({
  flowState,
  onClose,
  onConfirm,
}: {
  flowState: Exclude<FlowState, null>;
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
                ? `This mock flow will mark ${formatUsd(flowState.record.payoutUsd)} as a submitted payout and move the window into a completed preview state.`
                : `This mock flow will stage a simulated buy-back at ${formatUsd(flowState.record.currentPriceUsd)} and add the position to your watchlist preview.`}
            </p>
            <div className="card-radius border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-[#92a3bc]">
              {flowState.kind === "claim"
                ? `${flowState.record.eligibleTokens} tokens · ${formatUsd(flowState.record.claimPriceUsd)}/token · closes ${flowState.record.closesInLabel}`
                : `${flowState.record.thesis} · exited at ${formatUsd(flowState.record.exitPriceUsd)} · current ${formatUsd(flowState.record.currentPriceUsd)}`}
            </div>
            <div className="flex gap-3">
              <button className="flex-1 rounded-full border border-white/[0.1] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/6" onClick={onClose} type="button">
                Not now
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90" onClick={onConfirm} type="button">
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
                ? "Submitting payout preview. The interface stays intentionally lightweight, but the state transition is explicit."
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
                  ? `Estimated payout ${formatUsd(flowState.record.payoutUsd)} is now marked as submitted.`
                  : `${creator.name} is now surfaced as a re-entry watch candidate for this session.`}
              </p>
            </div>
            <button className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90" onClick={onClose} type="button">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const getTrendTone = (points: number[]): "positive" | "negative" =>
  (points.at(-1) ?? 0) >= (points[0] ?? 0) ? "positive" : "negative";

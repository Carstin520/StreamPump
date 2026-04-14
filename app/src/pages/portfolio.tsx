import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { StagePill } from "@/components/shared/StagePill";
import { UserShell } from "@/components/user/UserShell";
import { UserTopbar } from "@/components/user/UserTopbar";
import { findCreator, formatUsd, portfolioActions, portfolioHoldings } from "@/lib/mock-data";

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("Portfolio");
  const totalExposure = portfolioHoldings.reduce((sum, holding) => {
    const creator = findCreator(holding.creatorId);
    return sum + creator.tokenPrice * holding.tokenCount;
  }, 0);
  const primaryAction = portfolioActions[0];
  const actionCreator = primaryAction.creatorId ? findCreator(primaryAction.creatorId) : null;

  return (
    <>
      <Head>
        <title>StreamPump | Portfolio</title>
      </Head>
      <UserShell header={<UserTopbar />}>
        <div className="mx-auto max-w-[1120px] space-y-8 py-6">
          <section>
            <h1 className="text-[42px] font-semibold tracking-[-0.05em] text-white">Your S1 exposure and next actions</h1>
            <p className="mt-2 text-sm text-[#95a6be]">Manage your creator token holdings and upcoming claims.</p>

            <div className="mt-6 flex items-center gap-6 border-b border-white/8">
              {["Portfolio", "Claim queue", "Re-entry"].map((tab) => (
                <button
                  className={`relative pb-4 text-sm font-medium ${
                    activeTab === tab ? "text-white" : "text-[#8798b2]"
                  }`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                  {activeTab === tab ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard glow="blue" label="Active holdings" value={String(portfolioHoldings.length)} />
            <MetricCard glow="green" label="Exposure value" value={formatUsd(totalExposure)} />
            <MetricCard glow="pink" label="Waiting actions" value="1" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">Holdings</h2>
              <div className="space-y-3">
                {portfolioHoldings.map((holding) => {
                  const creator = findCreator(holding.creatorId);

                  return (
                    <Link
                      className="block rounded-[18px] border border-white/[0.06] bg-[#121826] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition hover:border-white/[0.1] hover:bg-[#141b2a]"
                      href={`/creators/${creator.id}`}
                      key={holding.creatorId}
                    >
                      <div className="flex flex-wrap items-center gap-4 xl:flex-nowrap">
                        <img alt={creator.name} className="h-12 w-12 rounded-full border border-white/10 object-cover" src={creator.avatarSrc} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-white">{creator.name}</p>
                            <StagePill compact stage={creator.state} />
                          </div>
                          <p className="text-sm text-[#8ea0ba]">{holding.tokenCount} HELD</p>
                        </div>
                        <div className="ml-auto grid grid-cols-3 gap-4 text-right md:gap-8">
                          <HoldingMetric label="Price" value={formatUsd(creator.tokenPrice)} />
                          <HoldingMetric label="Avg entry" value={formatUsd(holding.avgEntryUsd)} />
                          <HoldingMetric
                            highlight={holding.unrealizedChangePct >= 0 ? "green" : "pink"}
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
              <div className="rounded-[22px] border border-[#8d6120]/34 bg-[linear-gradient(180deg,rgba(77,49,20,0.3)_0%,rgba(24,17,12,0.95)_100%)] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3b33e]">
                  <span className="h-2 w-2 rounded-full bg-[#f3b33e]" />
                  Claim window approaching
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">Luna Cai S1 Buyout</h3>
                <p className="mt-3 text-sm leading-7 text-[#c8d3e2]">
                  Your 154 tokens are eligible for buyout at {formatUsd(findCreator("luna-cai").tokenPrice)}/token. Claim window closes in 48 hours.
                </p>

                {actionCreator ? (
                  <div className="mt-5 flex items-center gap-3 rounded-[14px] border border-white/8 bg-[#111722] p-3">
                    <img alt={actionCreator.name} className="h-10 w-10 rounded-full object-cover" src={actionCreator.avatarSrc} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{actionCreator.name}</p>
                      <p className="text-xs text-[#8ea0ba]">Estimated payout: {formatUsd(actionCreator.tokenPrice * portfolioHoldings[0].tokenCount)}</p>
                    </div>
                  </div>
                ) : null}

                <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90" type="button">
                  Claim Now
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </UserShell>
    </>
  );
}

const MetricCard = ({
  label,
  value,
  glow,
}: {
  label: string;
  value: string;
  glow: "blue" | "green" | "pink";
}) => (
  <div
    className={`rounded-[18px] border bg-[#121826] px-4 py-4 ${
      glow === "blue"
        ? "border-white/[0.08]"
        : glow === "green"
          ? "border-white/[0.08]"
          : "border-white/[0.08]"
    }`}
  >
    <p className="text-xs uppercase tracking-[0.18em] text-[#6f8099]">{label}</p>
    <p className={`mt-2 text-[38px] font-semibold tracking-[-0.04em] ${glow === "green" ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>
);

const HoldingMetric = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "pink";
}) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.18em] text-[#73849f]">{label}</p>
    <p className={`mt-1 text-sm font-medium ${highlight === "green" ? "text-[#65ecaf]" : highlight === "pink" ? "text-[#ff8ca8]" : "text-white"}`}>{value}</p>
  </div>
);

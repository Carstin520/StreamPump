import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import {
  ActionFlowModal,
  ClaimQueueSection,
  getTrendTone,
  PortfolioFlowState,
  PortfolioHoldingsSection,
  PortfolioMetrics,
  PortfolioTab,
  PortfolioTabBar,
  ReentrySection,
} from "@/components/portfolio/PortfolioSections";
import {
  portfolioClaimWindows,
  portfolioExposureTrend,
  portfolioHoldings,
  findCreator,
} from "@/lib/public-data";

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>("Portfolio");
  const [flowState, setFlowState] = useState<PortfolioFlowState>(null);

  const totalExposure = useMemo(
    () =>
      portfolioHoldings.reduce((sum, holding) => {
        const creator = findCreator(holding.creatorId);
        return sum + (holding.currentPriceUsd ?? creator.tokenPrice) * holding.tokenCount;
      }, 0),
    [],
  );
  const waitingActionsCount = portfolioClaimWindows.length;
  const exposureTone = useMemo(() => getTrendTone(portfolioExposureTrend.map((point) => point.value)), []);

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
      <PageShell>
        <div className="mx-auto max-w-[1180px] space-y-7 py-6">
          <section>
            <h1 className="text-[42px] font-semibold tracking-[-0.05em] text-white">Your S1 exposure and next actions</h1>
            <p className="mt-2 text-sm text-[#95a6be]">Manage your creator token holdings and upcoming claims.</p>
          </section>

          <PortfolioMetrics exposureTone={exposureTone} totalExposure={totalExposure} waitingActionsCount={waitingActionsCount} />
          <PortfolioTabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "Portfolio" ? (
            <PortfolioHoldingsSection
              onClaim={(record) => setFlowState({ kind: "claim", record, status: "confirm" })}
              totalExposure={totalExposure}
            />
          ) : null}

          {activeTab === "Claim queue" ? (
            <ClaimQueueSection onClaim={(record) => setFlowState({ kind: "claim", record, status: "confirm" })} />
          ) : null}

          {activeTab === "Re-entry" ? (
            <ReentrySection onReentry={(record) => setFlowState({ kind: "reentry", record, status: "confirm" })} />
          ) : null}
        </div>

        {flowState ? (
          <ActionFlowModal
            flowState={flowState}
            onClose={() => setFlowState(null)}
            onConfirm={() => setFlowState({ ...flowState, status: "processing" })}
          />
        ) : null}
      </PageShell>
    </>
  );
}

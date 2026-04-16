"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PortfolioPage;
const head_1 = __importDefault(require("next/head"));
const react_1 = require("react");
const PortfolioSections_1 = require("@/components/portfolio/PortfolioSections");
const UserShell_1 = require("@/components/user/UserShell");
const UserTopbar_1 = require("@/components/user/UserTopbar");
const portfolio_1 = require("@/lib/mocks/portfolio");
const discover_1 = require("@/lib/mocks/discover");
function PortfolioPage() {
    const [activeTab, setActiveTab] = (0, react_1.useState)("Portfolio");
    const [flowState, setFlowState] = (0, react_1.useState)(null);
    const totalExposure = (0, react_1.useMemo)(() => portfolio_1.portfolioHoldings.reduce((sum, holding) => {
        const creator = (0, discover_1.findCreator)(holding.creatorId);
        return sum + (holding.currentPriceUsd ?? creator.tokenPrice) * holding.tokenCount;
    }, 0), []);
    const waitingActionsCount = portfolio_1.portfolioClaimWindows.length;
    const exposureTone = (0, react_1.useMemo)(() => (0, PortfolioSections_1.getTrendTone)(portfolio_1.portfolioExposureTrend.map((point) => point.value)), []);
    (0, react_1.useEffect)(() => {
        if (!flowState || flowState.status !== "processing") {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            setFlowState((value) => (value ? { ...value, status: "success" } : value));
        }, 960);
        return () => window.clearTimeout(timeoutId);
    }, [flowState]);
    return (<>
      <head_1.default>
        <title>StreamPump | Portfolio</title>
      </head_1.default>
      <UserShell_1.UserShell header={<UserTopbar_1.UserTopbar />}>
        <div className="mx-auto max-w-[1180px] space-y-7 py-6">
          <section>
            <h1 className="text-[42px] font-semibold tracking-[-0.05em] text-white">Your S1 exposure and next actions</h1>
            <p className="mt-2 text-sm text-[#95a6be]">Manage your creator token holdings and upcoming claims.</p>
          </section>

          <PortfolioSections_1.PortfolioMetrics exposureTone={exposureTone} totalExposure={totalExposure} waitingActionsCount={waitingActionsCount}/>
          <PortfolioSections_1.PortfolioTabBar activeTab={activeTab} onTabChange={setActiveTab}/>

          {activeTab === "Portfolio" ? (<PortfolioSections_1.PortfolioHoldingsSection onClaim={(record) => setFlowState({ kind: "claim", record, status: "confirm" })} totalExposure={totalExposure}/>) : null}

          {activeTab === "Claim queue" ? (<PortfolioSections_1.ClaimQueueSection onClaim={(record) => setFlowState({ kind: "claim", record, status: "confirm" })}/>) : null}

          {activeTab === "Re-entry" ? (<PortfolioSections_1.ReentrySection onReentry={(record) => setFlowState({ kind: "reentry", record, status: "confirm" })}/>) : null}
        </div>

        {flowState ? (<PortfolioSections_1.ActionFlowModal flowState={flowState} onClose={() => setFlowState(null)} onConfirm={() => setFlowState({ ...flowState, status: "processing" })}/>) : null}
      </UserShell_1.UserShell>
    </>);
}

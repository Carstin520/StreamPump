import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { Panel } from "@/components/shared/Panel";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import {
  getProposalById,
  getPublicCampaignProof,
  ProposalDetailResponse,
  PublicCampaignProofResponse,
} from "@/lib/api/workspace";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";
import { useI18n } from "@/lib/i18n";
import { findCreatorStrict } from "@/lib/mocks/discover";
import { findMockProposalDetail } from "@/lib/mocks/workspace";
import {
  DEMO_S2_ENDORSE_PATH,
  DEMO_S2_SETTLEMENT_PATH,
} from "@/lib/routes";
import { getAccessToken, loadWithPublicFallback } from "@/lib/session-flow";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      data: ProposalDetailResponse;
      proofStatus?: PublicCampaignProofResponse["proofStatus"];
      source: "live-campaign-proof" | "live-api" | "demo-fallback";
    };

const normalizeCampaignProof = (
  campaign: PublicCampaignProofResponse
): ProposalDetailResponse => ({
  viewerRole: "PUBLIC_FAN",
  proposal: {
    id: campaign.proposalId,
    proposalPda: campaign.proposalPda,
    creatorWallet: campaign.creatorWallet,
    sponsorWallet: campaign.sponsorWallet,
    deadlineAt: campaign.deadlineAt,
    status: campaign.status,
    track1BaseUsdc: campaign.budgetTracks.track1BaseUsdc,
    track1Claimed: campaign.budgetTracks.track1Claimed,
    track2MetricType: campaign.budgetTracks.track2MetricType,
    track2TargetValue: campaign.budgetTracks.track2TargetValue,
    track2MinAchievementBps: campaign.budgetTracks.track2MinAchievementBps,
    track2UsdcDeposited: campaign.budgetTracks.track2UsdcDeposited,
    track2ActualValue: campaign.budgetTracks.track2ActualValue,
    track2SettledAt: campaign.budgetTracks.track2SettledAt,
    track3UsdcDeposited: campaign.budgetTracks.track3UsdcDeposited,
    track3CpsPayout: campaign.budgetTracks.track3CpsPayout,
    track3DelayDays: campaign.budgetTracks.track3DelayDays,
    track3SettledAt: campaign.budgetTracks.track3SettledAt,
    onChainTxSignature: campaign.proof.latestChainTxSignature,
    oracleSyncStatus: campaign.proof.oracleSyncStatus ?? undefined,
    contentHashHex: campaign.proof.contentHashHex,
    contentAnchorPda: campaign.proof.contentAnchorPda,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  },
});

const resolveProposalRouteId = (
  queryValue: string | string[] | undefined,
  asPath: string
) => {
  const queryId = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (queryId?.trim()) {
    return queryId.trim();
  }

  const pathname = asPath.split("?")[0]?.split("#")[0] ?? "";
  const pathId = pathname.split("/").filter(Boolean).at(-1);
  return pathId ? decodeURIComponent(pathId).trim() : "";
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const proposalId = resolveProposalRouteId(router.query.proposalId, router.asPath);
    const token = getAccessToken();

    if (!proposalId) {
      if (!router.isReady) {
        return;
      }
      setState({ kind: "error", message: "proposalId is required" });
      return;
    }

    setState({ kind: "loading" });
    const mockProposal = findMockProposalDetail(proposalId);
    if (mockProposal) {
      setState({ kind: "ready", data: mockProposal, source: "demo-fallback" });
      return;
    }

    const loadProposal = async () => {
      try {
        const campaignProof = await getPublicCampaignProof(proposalId);
        const data = normalizeCampaignProof(campaignProof);
        if (!cancelled) {
          setState({
            kind: "ready",
            data,
            proofStatus: campaignProof.proofStatus,
            source: "live-campaign-proof",
          });
        }
      } catch (campaignError) {
        try {
          const data = await loadWithPublicFallback({
            loadPublic: () => getProposalById(proposalId),
            loadWithToken: (accessToken) => getProposalById(proposalId, accessToken),
            token,
          });
          if (!cancelled) {
            setState({ kind: "ready", data, source: "live-api" });
          }
        } catch (proposalError) {
          const message =
            proposalError instanceof Error
              ? proposalError.message
              : campaignError instanceof Error
                ? campaignError.message
                : "Failed to load proposal.";
          if (!cancelled) {
            setState({ kind: "error", message });
          }
        }
      }
    };

    void loadProposal();

    return () => {
      cancelled = true;
    };
  }, [router.asPath, router.isReady, router.query.proposalId]);

  const pageTitle = state.kind === "ready" ? state.data.proposal.id : "Campaign detail";
  const isPublicView = state.kind === "ready" && state.data.viewerRole === "PUBLIC_FAN";
  const isDemoProposal = state.kind === "ready" && state.source === "demo-fallback";
  const isCampaignProof = state.kind === "ready" && state.source === "live-campaign-proof";
  const demoCreator = isDemoProposal ? findCreatorStrict("neo-park") : undefined;
  const demoCreatorName = locale === "en" ? "Midnight Save" : demoCreator?.name;
  const campaignHeading = demoCreator
    ? `${demoCreatorName} × Nova Screen`
    : state.kind === "ready" && isPublicView
      ? shortenWallet(state.data.proposal.creatorWallet)
      : state.kind === "ready"
        ? `${shortenWallet(state.data.proposal.creatorWallet)} × ${shortenWallet(state.data.proposal.sponsorWallet)}`
        : "Campaign detail";
  const settlementHref = isDemoProposal
    ? DEMO_S2_SETTLEMENT_PATH
    : state.kind === "ready"
      ? `/campaigns/${state.data.proposal.proposalPda || state.data.proposal.id}/settlement`
      : DEMO_S2_SETTLEMENT_PATH;

  return (
    <>
      <Head>
        <title>{`StreamPump | ${pageTitle}`}</title>
      </Head>
      <PageShell
        subtitle="Campaign detail reads public or authenticated proposal projections. The known demo campaign uses local seeded fallback data and keeps endorsement/settlement links in preview mode."
        title="Campaign detail"
      >
        <ProductReadinessBanner
          description="Non-demo campaign IDs load through the proposal API, optionally with the current auth session. The Colosseum demo campaign is local fallback data; endorsement and settlement routes remain mock/operator preview surfaces until their projections and oracle flows are productized."
          status="SEEDED_DEMO"
          title="Campaign detail supports live proposal reads with labeled seeded fallback"
        />

        {state.kind === "loading" ? <AsyncStateCard body="Loading proposal detail." title="Loading campaign" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Campaign request failed" /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <CampaignSourceNotice isDemoProposal={isDemoProposal} viewerRole={state.data.viewerRole} />

              <Panel className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proposal</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {campaignHeading}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {isDemoProposal
                        ? "Local seeded demo fallback · Track 2 views target"
                        : `Viewer mode: ${state.data.viewerRole}`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-100">{state.data.proposal.status}</span>
                </div>
                {state.proofStatus ? (
                  <div className="rounded-2xl border border-[#67b8ff]/20 bg-[#0d1b2a]/55 px-4 py-3 text-sm text-slate-300">
                    Campaign proof projection: <span className="font-semibold text-white">{state.proofStatus}</span>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 1</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {state.data.proposal.track1BaseUsdc ? formatUsdcAtomic(state.data.proposal.track1BaseUsdc) : "Private"}
                    </p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 2</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatUsdcAtomic(state.data.proposal.track2UsdcDeposited)}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 3</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {state.data.proposal.track3UsdcDeposited ? formatUsdcAtomic(state.data.proposal.track3UsdcDeposited) : "Private"}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Binding and settlement</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">Content hash</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.contentHashHex ?? "Public view hides this field"}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">Content anchor</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.contentAnchorPda ?? "Pending / private"}</p>
                  </div>
                  <div className="surface-muted rounded-2xl p-4">
                    <p className="text-xs text-slate-400">On-chain tx</p>
                    <p className="mt-2 break-all text-sm text-white">{state.data.proposal.onChainTxSignature ?? "Pending / private"}</p>
                  </div>
                </div>
                <div className="surface-muted rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Metric progress</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {state.data.proposal.track2MetricType}: {state.data.proposal.track2ActualValue ?? "Pending report"} / {state.data.proposal.track2TargetValue}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Deadline: {formatIsoLabel(state.data.proposal.deadlineAt)}</p>
                </div>
              </Panel>
            </div>

            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Shared status language</p>
              <p className="text-sm leading-7 text-slate-300">
                {isDemoProposal
                  ? "This is the seeded S2 demo campaign used for controlled walkthroughs. It is not a live proposal projection from the backend."
                  : isCampaignProof
                    ? "This campaign overview comes from the public campaign proof projection, including proposal status, content anchor, and current proof readiness."
                  : "This campaign overview comes from the proposal API. Creator/sponsor sessions can expose the fuller projection; public viewers get the campaign state that is safe to show."}
              </p>
              <div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">
                <p>Oracle sync: {state.data.proposal.oracleSyncStatus ?? "Public view"}</p>
                <p className="mt-2">Track 2 settled: {state.data.proposal.track2SettledAt ? formatIsoLabel(state.data.proposal.track2SettledAt) : "Not settled"}</p>
                <p className="mt-2">Track 3 settled: {state.data.proposal.track3SettledAt ? formatIsoLabel(state.data.proposal.track3SettledAt) : "Not settled / private"}</p>
              </div>
              <div className="grid gap-3">
                {isDemoProposal ? (
                  <Link
                    className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                    href={DEMO_S2_ENDORSE_PATH}
                  >
                    Endorse demo
                  </Link>
                ) : null}
                <Link
                  className="block rounded-2xl bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_28px_rgba(222,64,42,0.25)] transition hover:brightness-[1.05]"
                  href={settlementHref}
                >
                  Settlement dashboard preview
                </Link>
                <p className="text-xs leading-5 text-slate-500">
                  Settlement detail is still a mock/operator preview surface until track evidence, oracle permissions, and reconciliation projections are live.
                </p>
              </div>
            </Panel>
          </div>
        ) : null}
      </PageShell>
    </>
  );
}

const CampaignSourceNotice = ({
  isDemoProposal,
  viewerRole,
}: {
  isDemoProposal: boolean;
  viewerRole: ProposalDetailResponse["viewerRole"];
}) => (
  <section
    className={`rounded-2xl border px-4 py-3 ${
      isDemoProposal
        ? "border-[#f3b33e]/25 bg-[#1f1708]/60"
        : "border-[#67b8ff]/20 bg-[#0d1b2a]/55"
    }`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Data source</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {isDemoProposal ? "Seeded local demo fallback" : "Live campaign projection"}
        </p>
      </div>
      <span
        className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold ${
          isDemoProposal
            ? "border-[#f3b33e]/30 bg-[#2a1f0b] text-[#f8d48a]"
            : "border-[#67b8ff]/25 bg-[#0d2236] text-[#a8d8ff]"
        }`}
      >
        {isDemoProposal ? "SEEDED_DEMO" : viewerRole}
      </span>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-400">
      {isDemoProposal
        ? "Use this path for the controlled S2 walkthrough only. Do not treat the values as backend, indexer, or oracle projection output."
        : "This page is reading backend campaign/proposal projection data. Settlement and endorsement actions still route to preview/operator surfaces."}
    </p>
  </section>
);

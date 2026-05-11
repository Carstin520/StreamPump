import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { Panel } from "@/components/shared/Panel";
import { getProposalById, ProposalDetailResponse } from "@/lib/api/workspace";
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
  | { kind: "ready"; data: ProposalDetailResponse };

export default function CampaignDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;
    const proposalId = String(router.query.proposalId ?? "").trim();
    const token = getAccessToken();

    if (!proposalId) {
      setState({ kind: "error", message: "proposalId is required" });
      return;
    }

    setState({ kind: "loading" });
    const mockProposal = findMockProposalDetail(proposalId);
    if (mockProposal) {
      setState({ kind: "ready", data: mockProposal });
      return;
    }

    const loadProposal = async () => {
      try {
        const data = await loadWithPublicFallback({
          loadPublic: () => getProposalById(proposalId),
          loadWithToken: (accessToken) => getProposalById(proposalId, accessToken),
          token,
        });
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load proposal.";
        if (!cancelled) {
          setState({ kind: "error", message });
        }
      }
    };

    void loadProposal();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.proposalId]);

  const pageTitle = state.kind === "ready" ? state.data.proposal.id : t("page.campaign.detailTitle");
  const isPublicView = state.kind === "ready" && state.data.viewerRole === "PUBLIC_FAN";
  const isDemoProposal =
    state.kind === "ready" && Boolean(findMockProposalDetail(state.data.proposal.id));
  const demoCreator = isDemoProposal ? findCreatorStrict("neo-park") : undefined;
  const campaignHeading = demoCreator
    ? `${demoCreator.name} × Nova Screen`
    : state.kind === "ready" && isPublicView
      ? shortenWallet(state.data.proposal.creatorWallet)
      : state.kind === "ready"
        ? `${shortenWallet(state.data.proposal.creatorWallet)} × ${shortenWallet(state.data.proposal.sponsorWallet)}`
        : t("page.campaign.detailTitle");
  const settlementHref = isDemoProposal
    ? DEMO_S2_SETTLEMENT_PATH
    : state.kind === "ready"
      ? `/campaigns/${state.data.proposal.id}/settlement`
      : DEMO_S2_SETTLEMENT_PATH;

  return (
    <>
      <Head>
        <title>{`StreamPump | ${pageTitle}`}</title>
      </Head>
      <PageShell
        subtitle={t("page.campaign.detailBody")}
        title={t("page.campaign.detailTitle")}
      >
        {state.kind === "loading" ? <AsyncStateCard body={t("page.campaign.loadingBody")} title={t("page.campaign.loadingTitle")} /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title={t("page.campaign.requestFailed")} /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <Panel className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proposal</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {campaignHeading}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {isDemoProposal
                        ? "S2 demo campaign · Track 2 views target"
                        : `Viewer mode: ${state.data.viewerRole}`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-100">{state.data.proposal.status}</span>
                </div>

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
                This campaign overview supports both demo fallback data and live proposal data. Creator/sponsor sessions can expose the fuller projection; public viewers get the campaign state that is safe to show.
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
                  Settlement dashboard
                </Link>
              </div>
            </Panel>
          </div>
        ) : null}
      </PageShell>
    </>
  );
}

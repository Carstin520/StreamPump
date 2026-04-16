import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { Panel } from "@/components/shared/Panel";
import { getProposalById, ProposalDetailResponse } from "@/lib/api/workspace";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ProposalDetailResponse };

export default function CampaignDetailPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;
    const proposalId = String(router.query.proposalId ?? "").trim();
    const session = getStoredAuthSession();

    if (!proposalId) {
      setState({ kind: "error", message: "proposalId is required" });
      return;
    }

    setState({ kind: "loading" });
    const loadProposal = async () => {
      try {
        const data = await getProposalById(proposalId, session?.accessToken);
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load proposal.";
        if (session?.accessToken && (message.includes("AUTH_INVALID") || message.includes("AUTH_REQUIRED") || message.includes("401"))) {
          clearStoredAuthSession();
          const publicData = await getProposalById(proposalId);
          if (!cancelled) {
            setState({ kind: "ready", data: publicData });
          }
          return;
        }

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

  const pageTitle = state.kind === "ready" ? state.data.proposal.id : "Campaign detail";
  const isPublicView = state.kind === "ready" && state.data.viewerRole === "PUBLIC_FAN";

  return (
    <>
      <Head>
        <title>{`StreamPump | ${pageTitle}`}</title>
      </Head>
      <AppShell
        subtitle="Campaign detail is the shared surface after launch. It should speak both to sponsors and creators without forcing them into different portals."
        title="Campaign detail"
      >
        {state.kind === "loading" ? <AsyncStateCard body="Loading proposal detail from the live v1 proposal endpoint." title="Loading campaign" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Campaign request failed" /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <Panel className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proposal</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {isPublicView
                        ? shortenWallet(state.data.proposal.creatorWallet)
                        : `${shortenWallet(state.data.proposal.creatorWallet)} × ${shortenWallet(state.data.proposal.sponsorWallet)}`}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">Viewer mode: {state.data.viewerRole}</p>
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
                This page now reads directly from the backend proposal endpoint. Creator/sponsor sessions get the fuller projection; public viewers get the stripped-down campaign state that is safe to expose.
              </p>
              <div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">
                <p>Oracle sync: {state.data.proposal.oracleSyncStatus ?? "Public view"}</p>
                <p className="mt-2">Track 2 settled: {state.data.proposal.track2SettledAt ? formatIsoLabel(state.data.proposal.track2SettledAt) : "Not settled"}</p>
                <p className="mt-2">Track 3 settled: {state.data.proposal.track3SettledAt ? formatIsoLabel(state.data.proposal.track3SettledAt) : "Not settled / private"}</p>
              </div>
            </Panel>
          </div>
        ) : null}
      </AppShell>
    </>
  );
}

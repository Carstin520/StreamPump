import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { Panel } from "@/components/shared/Panel";
import { getProposalById, ProposalDetailResponse } from "@/lib/api/workspace";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";
import { getAccessToken, loadWithPublicFallback } from "@/lib/session-flow";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ProposalDetailResponse };

type Proposal = ProposalDetailResponse["proposal"];

const sumAtomic = (values: Array<string | null | undefined>) => {
  const total = values.reduce((acc, value) => {
    if (!value) return acc;
    try {
      return acc + BigInt(value);
    } catch {
      return acc;
    }
  }, 0n);

  return total.toString();
};

const statusLabel = (value: string | null | undefined) => value?.replace(/_/g, " ") ?? "Pending";

const fieldValue = (value: string | number | null | undefined, fallback = "Pending") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
};

const resolveTrack2Achievement = (proposal: Proposal) => {
  if (!proposal.track2ActualValue || !proposal.track2TargetValue) {
    return null;
  }

  const actual = Number(proposal.track2ActualValue);
  const target = Number(proposal.track2TargetValue);
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) {
    return null;
  }

  return Math.round((actual / target) * 100);
};

export default function SettlementPage() {
  const router = useRouter();
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

  const proposal = state.kind === "ready" ? state.data.proposal : null;
  const totalBudget = useMemo(
    () =>
      proposal
        ? sumAtomic([
            proposal.track1BaseUsdc,
            proposal.track2UsdcDeposited,
            proposal.track3UsdcDeposited,
          ])
        : "0",
    [proposal],
  );
  const track2Achievement = proposal ? resolveTrack2Achievement(proposal) : null;
  const isPublicView = state.kind === "ready" && state.data.viewerRole === "PUBLIC_FAN";
  const title = proposal ? `Settlement | ${shortenWallet(proposal.creatorWallet)}` : "Settlement";

  return (
    <>
      <Head>
        <title>{`StreamPump | ${title}`}</title>
      </Head>

      <PageShell
        eyebrow="S2 Settlement"
        subtitle="Live proposal settlement state from the backend read model."
        title="Settlement dashboard"
      >
        {state.kind === "loading" ? <AsyncStateCard body="Loading proposal settlement from the live v1 proposal endpoint." title="Loading settlement" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Settlement request failed" /> : null}
        {proposal ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link className="glass-button-ghost px-4 py-2 text-sm" href={`/campaigns/${proposal.id}`}>
                Back to campaign
              </Link>
              {isPublicView ? (
                <span className="rounded-full border border-[#f3b33e]/25 bg-[#f3b33e]/10 px-3 py-1 text-xs text-[#f3d28b]">
                  Public view hides sponsor/private settlement fields
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Total budget" value={formatUsdcAtomic(totalBudget)} />
              <MetricCard label="Proposal status" value={statusLabel(proposal.status)} />
              <MetricCard label="Oracle sync" value={statusLabel(proposal.oracleSyncStatus)} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <Panel className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Track settlement</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                        {shortenWallet(proposal.creatorWallet)}
                        {!isPublicView ? ` × ${shortenWallet(proposal.sponsorWallet)}` : ""}
                      </h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-100">
                      {state.kind === "ready" ? state.data.viewerRole : "PUBLIC_FAN"}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <TrackCard
                      body="Fixed creator base payment."
                      rows={[
                        ["Budget", proposal.track1BaseUsdc ? formatUsdcAtomic(proposal.track1BaseUsdc) : "Private / public view"],
                        ["Claimed", proposal.track1Claimed ? "Yes" : "No"],
                      ]}
                      status={proposal.track1Claimed ? "SETTLED" : "PENDING"}
                      title="Track 1"
                    />
                    <TrackCard
                      body="Oracle-reported performance achievement."
                      rows={[
                        ["Budget", formatUsdcAtomic(proposal.track2UsdcDeposited)],
                        ["Metric", proposal.track2MetricType],
                        ["Actual / target", `${fieldValue(proposal.track2ActualValue)} / ${fieldValue(proposal.track2TargetValue)}`],
                        ["Achievement", track2Achievement === null ? "Pending" : `${track2Achievement}%`],
                        ["Settled", formatIsoLabel(proposal.track2SettledAt)],
                      ]}
                      status={proposal.track2SettledAt ? "SETTLED" : proposal.track2ActualValue ? "REPORTED" : "PENDING"}
                      title="Track 2"
                    />
                    <TrackCard
                      body="CPS settlement controlled by operator/oracle for this demo."
                      rows={[
                        ["Budget", proposal.track3UsdcDeposited ? formatUsdcAtomic(proposal.track3UsdcDeposited) : "Private / public view"],
                        ["CPS payout", proposal.track3CpsPayout ? formatUsdcAtomic(proposal.track3CpsPayout) : "Pending"],
                        ["Delay", proposal.track3DelayDays === null || proposal.track3DelayDays === undefined ? "Private / public view" : `${proposal.track3DelayDays} days`],
                        ["Settled", formatIsoLabel(proposal.track3SettledAt)],
                      ]}
                      status={proposal.track3SettledAt ? "SETTLED" : proposal.track3CpsPayout ? "APPROVED" : "PENDING"}
                      title="Track 3"
                    />
                  </div>
                </Panel>

                <Panel className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Proof binding</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ProofRow label="Content hash" value={proposal.contentHashHex ?? "Private / public view"} />
                    <ProofRow label="Content anchor PDA" value={proposal.contentAnchorPda ?? "Pending / private"} />
                    <ProofRow label="Proposal PDA" value={proposal.proposalPda ?? "Pending"} />
                    <ProofRow label="Latest tx signature" value={proposal.onChainTxSignature ?? "Pending / private"} />
                  </div>
                </Panel>
              </div>

              <Panel className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Settlement state</p>
                <div className="space-y-3 text-sm text-slate-300">
                  <StatusRow label="Created" value={formatIsoLabel(proposal.createdAt)} />
                  <StatusRow label="Deadline" value={formatIsoLabel(proposal.deadlineAt)} />
                  <StatusRow label="Track 2 target" value={fieldValue(proposal.track2TargetValue)} />
                  <StatusRow label="Track 2 cliff" value={`${proposal.track2MinAchievementBps / 100}%`} />
                  <StatusRow label="Track 2 settled" value={formatIsoLabel(proposal.track2SettledAt)} />
                  <StatusRow label="Track 3 settled" value={formatIsoLabel(proposal.track3SettledAt)} />
                </div>
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  Pending values mean the proposal has not reached that settlement step yet, or the current public view is intentionally stripped down.
                </p>
              </Panel>
            </div>
          </div>
        ) : null}
      </PageShell>
    </>
  );
}

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="surface-muted rounded-[24px] p-5">
    <p className="text-[10px] uppercase tracking-[0.24em] text-[#7486a1]">{label}</p>
    <p className="mt-2 truncate text-2xl font-semibold tracking-[-0.05em] text-white">{value}</p>
  </div>
);

const TrackCard = ({
  body,
  rows,
  status,
  title,
}: {
  body: string;
  rows: Array<[string, string]>;
  status: "PENDING" | "REPORTED" | "APPROVED" | "SETTLED";
  title: string;
}) => {
  const settled = status === "SETTLED";
  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${settled ? "bg-[#65ecaf]/15 text-[#8df0c4]" : "bg-white/[0.06] text-[#90a0b9]"}`}>
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <StatusRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
};

const ProofRow = ({ label, value }: { label: string; value: string }) => (
  <div className="surface-muted rounded-2xl p-4">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-2 break-all text-sm text-white">{value}</p>
  </div>
);

const StatusRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] py-2 last:border-0">
    <span className="text-xs text-[#8ea0ba]">{label}</span>
    <span className="min-w-0 break-words text-right text-sm font-medium text-white">{value}</span>
  </div>
);

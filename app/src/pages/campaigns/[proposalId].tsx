import Head from "next/head";
import { useRouter } from "next/router";

import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/shared/Panel";
import { findCampaign, formatUsd } from "@/lib/mock-data";

export default function CampaignDetailPage() {
  const router = useRouter();
  const campaign = findCampaign(String(router.query.proposalId ?? ""));

  return (
    <>
      <Head>
        <title>{`StreamPump | ${campaign.id}`}</title>
      </Head>
      <AppShell
        subtitle="Campaign detail is the shared surface after launch. It should speak both to sponsors and creators without forcing them into different portals."
        title="Campaign detail"
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Panel className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proposal</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{campaign.creatorName} × {campaign.sponsorName}</h3>
                </div>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{campaign.status}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 1</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(campaign.track1BaseUsd)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 2</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(campaign.track2PoolUsd)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 3</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(campaign.track3PoolUsd)}</p>
                </div>
              </div>
            </Panel>

            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Binding and settlement</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs text-slate-400">Content hash</p>
                  <p className="mt-2 text-sm text-white">{campaign.contentHashShort}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs text-slate-400">Content anchor</p>
                  <p className="mt-2 text-sm text-white">{campaign.contentAnchorShort}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs text-slate-400">On-chain tx</p>
                  <p className="mt-2 text-sm text-white">{campaign.chainTxShort}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Metric progress</p>
                <p className="mt-2 text-sm text-slate-200">{campaign.metric}: {campaign.actualValue}</p>
              </div>
            </Panel>
          </div>

          <Panel className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Shared status language</p>
            <p className="text-sm leading-7 text-slate-300">
              The point of this page is to translate chain and backend state into shared campaign clarity. It should answer the sponsor’s “what is funded and measured?” and the creator’s “what is confirmed and pending?” without splitting the UX.
            </p>
          </Panel>
        </div>
      </AppShell>
    </>
  );
}

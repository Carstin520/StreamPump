import Head from "next/head";
import { useRouter } from "next/router";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { Panel } from "@/components/shared/Panel";
import { findIntent, formatUsd } from "@/lib/mock-data";

export default function IntentDetailPage() {
  const router = useRouter();
  const intent = findIntent(String(router.query.intentId ?? ""));

  return (
    <>
      <Head>
        <title>{`StreamPump | ${intent.id}`}</title>
      </Head>
      <AppShell
        action={<WorkspaceTabs />}
        subtitle="This page is intentionally single-surface. The same intent detail should reveal creator actions or sponsor actions based on the current session context instead of splitting the product into separate portals."
        title="Launch intent detail"
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Panel className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Intent</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{intent.creatorName} × {intent.sponsorName}</h3>
                  <p className="mt-1 text-sm text-slate-300">{intent.manifestTitle}</p>
                </div>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{intent.status}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 1</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(intent.track1BaseUsd)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 2 pool</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(intent.track2PoolUsd)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 3 pool</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(intent.track3PoolUsd)}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Launch state machine</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Current action owner: <span className="font-medium text-white">{intent.actionOwner}</span>. In production this page should adapt buttons and copy by session context, while preserving the same underlying state timeline for everyone.
                </p>
              </div>
            </Panel>

            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Available actions</p>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" type="button">
                  Lock terms
                </button>
                <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200" type="button">
                  Build bundle
                </button>
                <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200" type="button">
                  Partial sign
                </button>
                <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200" type="button">
                  Sponsor submit
                </button>
              </div>
            </Panel>
          </div>

          <Panel className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Bundle notes</p>
            <p className="text-sm leading-7 text-slate-300">
              This panel becomes the place for blockhash expiry, bundle reuse, signature presence, and retry-safe submission feedback. It should feel like clear workflow guidance, not a raw transaction debugger.
            </p>
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
              <p>Metric target: {intent.metric} / {intent.targetValue}</p>
              <p className="mt-2">Deadline: {intent.deadlineLabel}</p>
            </div>
          </Panel>
        </div>
      </AppShell>
    </>
  );
}

import Head from "next/head";
import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { Panel } from "@/components/shared/Panel";
import { intents, manifests } from "@/lib/mock-data";

export default function WorkspacePage() {
  return (
    <>
      <Head>
        <title>StreamPump | Workspace</title>
      </Head>
      <AppShell
        action={<WorkspaceTabs />}
        subtitle="The workspace is not role-based. It is where users create content, follow launch state, and handle the next signature or review action that belongs to them."
        title="Unified workspace"
      >
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Create</p>
              <div className="space-y-3">
                {manifests.map((manifest) => (
                  <Link className="block rounded-2xl bg-white/5 p-4 hover:bg-white/8" href={`/workspace/content/${manifest.id}`} key={manifest.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{manifest.title}</p>
                        <p className="text-xs text-slate-400">{manifest.contentType} · {manifest.assetCount} assets</p>
                      </div>
                      <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{manifest.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <Link className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" href="/workspace/content/new">
                Start new content manifest
              </Link>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Needs your action</p>
              <div className="space-y-3">
                {intents.map((intent) => (
                  <Link className="block rounded-2xl bg-white/5 p-4 hover:bg-white/8" href={`/workspace/intents/${intent.id}`} key={intent.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{intent.creatorName} × {intent.sponsorName}</p>
                        <p className="text-xs text-slate-400">{intent.manifestTitle} · {intent.metric} goal {intent.targetValue}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{intent.actionOwner}</p>
                        <p className="text-sm text-white">{intent.status}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </AppShell>
    </>
  );
}

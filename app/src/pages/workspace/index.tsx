import Head from "next/head";
import Link from "next/link";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { intents, manifests } from "@/lib/mock-data";

export default function WorkspacePage() {
  return (
    <>
      <Head>
        <title>StreamPump | Workspace</title>
      </Head>
      <WorkspaceShell
        subtitle="The workspace is not role-based. It is where users create content, follow launch state, and handle the next signature or review action that belongs to them."
        title="Unified workspace"
      >
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <section className="app-shell-frame rounded-[28px] p-5">
              <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Create</p>
              <div className="space-y-3">
                {manifests.map((manifest) => (
                  <Link className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/content/${manifest.id}`} key={manifest.id}>
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
              <Link className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-[0_14px_28px_rgba(255,255,255,0.12)]" href="/workspace/content/new">
                Start new content manifest
              </Link>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="app-shell-frame rounded-[28px] p-5">
              <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Needs your action</p>
              <div className="space-y-3">
                {intents.map((intent) => (
                  <Link className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/intents/${intent.id}`} key={intent.id}>
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
              </div>
            </section>
          </div>
        </div>
      </WorkspaceShell>
    </>
  );
}

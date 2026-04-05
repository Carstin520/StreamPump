import Head from "next/head";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { Panel } from "@/components/shared/Panel";

export default function NewContentPage() {
  return (
    <>
      <Head>
        <title>StreamPump | New Content Manifest</title>
      </Head>
      <AppShell
        action={<WorkspaceTabs />}
        subtitle="Content starts here. The user decides when to publish, what media package to bind, and when that package becomes the exact object later referenced by a launch bundle."
        title="Create a content manifest"
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Panel className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Content type</span>
                <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
                  <option className="text-slate-950">SHORT_VIDEO</option>
                  <option className="text-slate-950">IMAGE_CAROUSEL</option>
                  <option className="text-slate-950">MIXED_MEDIA_NOTE</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Title</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" defaultValue="Night market snack crawl" />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Caption</span>
              <textarea className="min-h-[180px] w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none" defaultValue="A mixed-media post where the short video is the hook, the image carousel carries menu details, and the caption preserves the shopping logic." />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tags</span>
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" defaultValue="food, city, late-night" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" type="button">
                Create manifest draft
              </button>
              <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200" type="button">
                Save for later
              </button>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Why this page matters</p>
            <p className="text-sm leading-7 text-slate-300">
              The content manifest is the off-chain preparation surface for a later content hash and content anchor. Users should feel like they are packaging media, not filling out blockchain forms.
            </p>
          </Panel>
        </div>
      </AppShell>
    </>
  );
}

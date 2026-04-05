import Head from "next/head";
import { useRouter } from "next/router";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { Panel } from "@/components/shared/Panel";
import { findManifest } from "@/lib/mock-data";

export default function ManifestDetailPage() {
  const router = useRouter();
  const manifest = findManifest(String(router.query.manifestId ?? ""));

  return (
    <>
      <Head>
        <title>{`StreamPump | ${manifest.title}`}</title>
      </Head>
      <AppShell
        action={<WorkspaceTabs />}
        subtitle="This view is where upload, processing, and finalize status need to feel operationally clear without looking like an ops dashboard."
        title={manifest.title}
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Panel className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Manifest state</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{manifest.status}</h3>
                </div>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{manifest.updatedAtLabel}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {["Cover image", "Vertical video", "Carousel detail", "CTA card"].map((asset, index) => (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-4" key={asset}>
                    <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700" />
                    <p className="mt-3 text-sm font-medium text-white">{asset}</p>
                    <p className="text-xs text-slate-400">{index === 1 ? "PROCESSING" : "READY"}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Finalize state</p>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-slate-300">`manifestHashHex` and planned content anchor will appear here once every asset is fully ready and the manifest is frozen.</p>
              </div>
              <div className="flex gap-3">
                <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" type="button">
                  Finalize manifest
                </button>
                <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200" type="button">
                  Add publication URL
                </button>
              </div>
            </Panel>
          </div>

          <Panel className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Phase 1 note</p>
            <p className="text-sm leading-7 text-slate-300">
              Production wiring here should use presigned uploads, Mux processing state, and manifest finalize status from the backend. This preview page already models the expected interaction pattern.
            </p>
          </Panel>
        </div>
      </AppShell>
    </>
  );
}

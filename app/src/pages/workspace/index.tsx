import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getWorkspaceOverview, WorkspaceOverviewResponse } from "@/lib/api/workspace";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";
import { formatIsoLabel, shortenWallet } from "@/lib/formatting";

type PageState =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: WorkspaceOverviewResponse };

export default function WorkspacePage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const session = getStoredAuthSession();

    if (!session) {
      setState({ kind: "auth" });
      return;
    }

    void getWorkspaceOverview(session.accessToken)
      .then((data) => {
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load workspace.";
        if (message.includes("AUTH_REQUIRED") || message.includes("401")) {
          clearStoredAuthSession();
          setState({ kind: "auth" });
          return;
        }

        setState({ kind: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const actionIntents = useMemo(() => {
    if (state.kind !== "ready") {
      return [];
    }

    const actionable = state.data.intents.filter((intent) => intent.needsAction);
    return actionable.length > 0 ? actionable : state.data.intents;
  }, [state]);

  return (
    <>
      <Head>
        <title>StreamPump | Workspace</title>
      </Head>
      <WorkspaceShell
        subtitle="The workspace is not role-based. It is where users create content, follow launch state, and handle the next signature or review action that belongs to them."
        title="Unified workspace"
      >
        {state.kind === "loading" ? <AsyncStateCard body="Loading manifests, intents, and proposal summaries from the backend workspace view." title="Loading workspace" /> : null}
        {state.kind === "auth" ? <AsyncStateCard actionHref="/login" actionLabel="Open login" body="Workspace now reads from authenticated v1 APIs. Sign in through the tracked login screen to get a Bearer session first." title="Session required" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Workspace request failed" /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <section className="app-shell-frame rounded-[28px] p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Create</p>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-200">
                      {shortenWallet(state.data.wallet)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {state.data.manifests.map((manifest) => (
                      <Link className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/content/${manifest.manifestId}`} key={manifest.manifestId}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{manifest.title ?? manifest.manifestId}</p>
                            <p className="text-xs text-slate-400">{manifest.contentType} · {manifest.assetCount} assets · v{manifest.version}</p>
                          </div>
                          <div className="text-right">
                            <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{manifest.status}</span>
                            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">{formatIsoLabel(manifest.updatedAt)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {state.data.manifests.length === 0 ? (
                      <div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">No manifests are currently attached to this wallet.</div>
                    ) : null}
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
                    {actionIntents.map((intent) => (
                      <Link className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/intents/${intent.intentId}`} key={intent.intentId}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{shortenWallet(intent.creatorWallet)} × {shortenWallet(intent.sponsorWallet)}</p>
                            <p className="text-xs text-slate-400">
                              {intent.manifest?.title ?? "Manifest pending"} · {intent.viewerRole} · {intent.latestBundle?.status ?? "No bundle yet"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{intent.needsAction ? "action required" : intent.viewerRole}</p>
                            <p className="text-sm text-white">{intent.status}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {actionIntents.length === 0 ? (
                      <div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">No active intents are linked to the current session.</div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </WorkspaceShell>
    </>
  );
}

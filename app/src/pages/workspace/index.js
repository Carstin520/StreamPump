"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WorkspacePage;
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const AsyncStateCard_1 = require("@/components/shared/AsyncStateCard");
const WorkspaceShell_1 = require("@/components/workspace/WorkspaceShell");
const workspace_1 = require("@/lib/api/workspace");
const auth_session_1 = require("@/lib/auth-session");
const formatting_1 = require("@/lib/formatting");
function WorkspacePage() {
    const [state, setState] = (0, react_1.useState)({ kind: "loading" });
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const session = (0, auth_session_1.getStoredAuthSession)();
        if (!session) {
            setState({ kind: "auth" });
            return;
        }
        void (0, workspace_1.getWorkspaceOverview)(session.accessToken)
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
                (0, auth_session_1.clearStoredAuthSession)();
                setState({ kind: "auth" });
                return;
            }
            setState({ kind: "error", message });
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const actionIntents = (0, react_1.useMemo)(() => {
        if (state.kind !== "ready") {
            return [];
        }
        const actionable = state.data.intents.filter((intent) => intent.needsAction);
        return actionable.length > 0 ? actionable : state.data.intents;
    }, [state]);
    return (<>
      <head_1.default>
        <title>StreamPump | Workspace</title>
      </head_1.default>
      <WorkspaceShell_1.WorkspaceShell subtitle="The workspace is not role-based. It is where users create content, follow launch state, and handle the next signature or review action that belongs to them." title="Unified workspace">
        {state.kind === "loading" ? <AsyncStateCard_1.AsyncStateCard body="Loading manifests, intents, and proposal summaries from the backend workspace view." title="Loading workspace"/> : null}
        {state.kind === "auth" ? <AsyncStateCard_1.AsyncStateCard actionHref="/login" actionLabel="Open login" body="Workspace now reads from authenticated v1 APIs. Sign in through the tracked login screen to get a Bearer session first." title="Session required"/> : null}
        {state.kind === "error" ? <AsyncStateCard_1.AsyncStateCard body={state.message} title="Workspace request failed"/> : null}
        {state.kind === "ready" ? (<div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <section className="app-shell-frame rounded-[28px] p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Create</p>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-200">
                      {(0, formatting_1.shortenWallet)(state.data.wallet)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {state.data.manifests.map((manifest) => (<link_1.default className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/content/${manifest.manifestId}`} key={manifest.manifestId}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{manifest.title ?? manifest.manifestId}</p>
                            <p className="text-xs text-slate-400">{manifest.contentType} · {manifest.assetCount} assets · v{manifest.version}</p>
                          </div>
                          <div className="text-right">
                            <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{manifest.status}</span>
                            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">{(0, formatting_1.formatIsoLabel)(manifest.updatedAt)}</p>
                          </div>
                        </div>
                      </link_1.default>))}
                    {state.data.manifests.length === 0 ? (<div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">No manifests are currently attached to this wallet.</div>) : null}
                  </div>
                  <link_1.default className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-[0_14px_28px_rgba(255,255,255,0.12)]" href="/workspace/content/new">
                    Start new content manifest
                  </link_1.default>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="app-shell-frame rounded-[28px] p-5">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Needs your action</p>
                  <div className="space-y-3">
                    {actionIntents.map((intent) => (<link_1.default className="surface-muted block rounded-2xl p-4 transition duration-200 hover:bg-white/[0.07]" href={`/workspace/intents/${intent.intentId}`} key={intent.intentId}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{(0, formatting_1.shortenWallet)(intent.creatorWallet)} × {(0, formatting_1.shortenWallet)(intent.sponsorWallet)}</p>
                            <p className="text-xs text-slate-400">
                              {intent.manifest?.title ?? "Manifest pending"} · {intent.viewerRole} · {intent.latestBundle?.status ?? "No bundle yet"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{intent.needsAction ? "action required" : intent.viewerRole}</p>
                            <p className="text-sm text-white">{intent.status}</p>
                          </div>
                        </div>
                      </link_1.default>))}
                    {actionIntents.length === 0 ? (<div className="surface-muted rounded-2xl p-4 text-sm text-slate-300">No active intents are linked to the current session.</div>) : null}
                  </div>
                </div>
              </section>
            </div>
          </div>) : null}
      </WorkspaceShell_1.WorkspaceShell>
    </>);
}

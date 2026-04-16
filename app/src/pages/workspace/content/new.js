"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NewContentPage;
const head_1 = __importDefault(require("next/head"));
const router_1 = require("next/router");
const react_1 = require("react");
const AsyncStateCard_1 = require("@/components/shared/AsyncStateCard");
const WorkspaceShell_1 = require("@/components/workspace/WorkspaceShell");
const workspace_1 = require("@/lib/api/workspace");
const auth_session_1 = require("@/lib/auth-session");
const parseTags = (value) => value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
function NewContentPage() {
    const router = (0, router_1.useRouter)();
    const [authState, setAuthState] = (0, react_1.useState)("checking");
    const [contentType, setContentType] = (0, react_1.useState)("SHORT_VIDEO");
    const [title, setTitle] = (0, react_1.useState)("Night market snack crawl");
    const [captionText, setCaptionText] = (0, react_1.useState)("A mixed-media post where the short video is the hook, the image carousel carries menu details, and the caption preserves the shopping logic.");
    const [tagsInput, setTagsInput] = (0, react_1.useState)("food, city, late-night");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        setAuthState((0, auth_session_1.getStoredAuthSession)() ? "ready" : "auth");
    }, []);
    const handleCreate = async () => {
        const session = (0, auth_session_1.getStoredAuthSession)();
        if (!session) {
            setAuthState("auth");
            setMessage("Session required. Open login before creating a manifest draft.");
            return;
        }
        setBusy(true);
        setMessage("Creating manifest draft...");
        try {
            const manifest = await (0, workspace_1.createContentManifest)(session.accessToken, {
                contentType,
                title,
                captionText,
                tags: parseTags(tagsInput),
            });
            setMessage("Manifest draft created. Redirecting to detail view.");
            void router.push(`/workspace/content/${manifest.manifestId}`);
        }
        catch (error) {
            const nextMessage = error instanceof Error ? error.message : "Failed to create manifest draft.";
            if (nextMessage.includes("AUTH_REQUIRED") || nextMessage.includes("AUTH_INVALID") || nextMessage.includes("401")) {
                (0, auth_session_1.clearStoredAuthSession)();
                setAuthState("auth");
            }
            setMessage(nextMessage);
        }
        finally {
            setBusy(false);
        }
    };
    return (<>
      <head_1.default>
        <title>StreamPump | New Content Manifest</title>
      </head_1.default>
      <WorkspaceShell_1.WorkspaceShell subtitle="Content starts here. The user decides when to publish, what media package to bind, and when that package becomes the exact object later referenced by a launch bundle." title="Create a content manifest">
        {authState === "checking" ? (<AsyncStateCard_1.AsyncStateCard body="Checking whether a tracked Bearer session is available before opening manifest creation." title="Loading session"/>) : authState === "auth" ? (<AsyncStateCard_1.AsyncStateCard actionHref="/login" actionLabel="Open login" body="Manifest creation now uses the authenticated content API. Sign in first to create a creator-owned draft." title="Session required"/>) : (<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="glass-card p-5">
            <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Content type</span>
                <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" onChange={(event) => setContentType(event.target.value)} value={contentType}>
                  <option className="text-slate-950">SHORT_VIDEO</option>
                  <option className="text-slate-950">IMAGE_CAROUSEL</option>
                  <option className="text-slate-950">MIXED_MEDIA_NOTE</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Title</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" onChange={(event) => setTitle(event.target.value)} value={title}/>
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Caption</span>
              <textarea className="min-h-[180px] w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none" onChange={(event) => setCaptionText(event.target.value)} value={captionText}/>
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tags</span>
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" onChange={(event) => setTagsInput(event.target.value)} value={tagsInput}/>
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-wait disabled:opacity-70" disabled={busy} onClick={() => void handleCreate()} type="button">
                Create manifest draft
              </button>
              <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-70" disabled={busy} onClick={() => setMessage("Draft values kept locally in the page state. Server-side save-for-later is not implemented yet.")} type="button">
                Save for later
              </button>
            </div>
            {message ? (<div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>) : null}
            </div>
          </section>

          <section className="glass-card p-5">
            <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Why this page matters</p>
            <p className="text-sm leading-7 text-slate-300">
              The content manifest is the off-chain preparation surface for a later content hash and content anchor. Users should feel like they are packaging media, not filling out blockchain forms.
            </p>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
              This tracked page now performs the real draft creation step only. Asset upload, finalize, and publication mapping still happen from the manifest detail flow and follow-up endpoints.
            </div>
            </div>
          </section>
        </div>)}
      </WorkspaceShell_1.WorkspaceShell>
    </>);
}

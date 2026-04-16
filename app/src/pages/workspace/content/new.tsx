import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ContentType } from "@/lib/api/types";
import { createContentManifest } from "@/lib/api/workspace";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";

const parseTags = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function NewContentPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ready" | "auth">("checking");
  const [contentType, setContentType] = useState<ContentType>("SHORT_VIDEO");
  const [title, setTitle] = useState("Night market snack crawl");
  const [captionText, setCaptionText] = useState(
    "A mixed-media post where the short video is the hook, the image carousel carries menu details, and the caption preserves the shopping logic.",
  );
  const [tagsInput, setTagsInput] = useState("food, city, late-night");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAuthState(getStoredAuthSession() ? "ready" : "auth");
  }, []);

  const handleCreate = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      setAuthState("auth");
      setMessage("Session required. Open login before creating a manifest draft.");
      return;
    }

    setBusy(true);
    setMessage("Creating manifest draft...");

    try {
      const manifest = await createContentManifest(session.accessToken, {
        contentType,
        title,
        captionText,
        tags: parseTags(tagsInput),
      });

      setMessage("Manifest draft created. Redirecting to detail view.");
      void router.push(`/workspace/content/${manifest.manifestId}`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to create manifest draft.";
      if (nextMessage.includes("AUTH_REQUIRED") || nextMessage.includes("AUTH_INVALID") || nextMessage.includes("401")) {
        clearStoredAuthSession();
        setAuthState("auth");
      }
      setMessage(nextMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>StreamPump | New Content Manifest</title>
      </Head>
      <WorkspaceShell
        subtitle="Content starts here. The user decides when to publish, what media package to bind, and when that package becomes the exact object later referenced by a launch bundle."
        title="Create a content manifest"
      >
        {authState === "checking" ? (
          <AsyncStateCard
            body="Checking whether a tracked Bearer session is available before opening manifest creation."
            title="Loading session"
          />
        ) : authState === "auth" ? (
          <AsyncStateCard
            actionHref="/login"
            actionLabel="Open login"
            body="Manifest creation now uses the authenticated content API. Sign in first to create a creator-owned draft."
            title="Session required"
          />
        ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="glass-card p-5">
            <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Content type</span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  onChange={(event) => setContentType(event.target.value as ContentType)}
                  value={contentType}
                >
                  <option className="text-slate-950">SHORT_VIDEO</option>
                  <option className="text-slate-950">IMAGE_CAROUSEL</option>
                  <option className="text-slate-950">MIXED_MEDIA_NOTE</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Title</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Caption</span>
              <textarea
                className="min-h-[180px] w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none"
                onChange={(event) => setCaptionText(event.target.value)}
                value={captionText}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tags</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                onChange={(event) => setTagsInput(event.target.value)}
                value={tagsInput}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-wait disabled:opacity-70"
                disabled={busy}
                onClick={() => void handleCreate()}
                type="button"
              >
                Create manifest draft
              </button>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-70"
                disabled={busy}
                onClick={() => setMessage("Draft values kept locally in the page state. Server-side save-for-later is not implemented yet.")}
                type="button"
              >
                Save for later
              </button>
            </div>
            {message ? (
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            ) : null}
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
        </div>
        )}
      </WorkspaceShell>
    </>
  );
}

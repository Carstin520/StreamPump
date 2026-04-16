import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { AsyncStateCard } from "@/components/shared/AsyncStateCard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ProposalIntentStatus } from "@/lib/api/types";
import {
  buildProposalLaunchBundle,
  BundleSubmitMode,
  creatorPartialSignBundle,
  getProposalIntentById,
  getProposalIntentStatus,
  lockProposalIntent,
  ProposalIntentDetailResponse,
  submitProposalBundle,
} from "@/lib/api/workspace";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth-session";
import { formatIsoLabel, formatUsdcAtomic, shortenWallet } from "@/lib/formatting";

type PageState =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ProposalIntentDetailResponse };

const STATUS_ACTIONS: Record<ProposalIntentStatus, string[]> = {
  DRAFT: ["Lock exact terms against the finalized manifest", "Freeze launch economics before bundling"],
  TERMS_LOCKED: ["Build a versioned bundle", "Check whether anchor_content_hash is still required"],
  BUNDLE_BUILT: ["Creator signs the bundle message", "Keep the bundle fresh before expiry"],
  CREATOR_PARTIALLY_SIGNED: ["Sponsor applies the final signature", "Submit or relay the transaction"],
  SPONSOR_SIGNED: ["Wait for relay or submit through the chosen relay path", "Monitor chain confirmation"],
  SUBMITTED: ["Poll confirmation state", "Watch the resulting proposal linkage"],
  CONFIRMED: ["Review confirmed proposal state", "Open shared campaign detail"],
  FAILED: ["Inspect failure reason", "Rebuild a fresh bundle if safe"],
  EXPIRED: ["Rebuild bundle before asking either side to sign again"],
};

const canBuildFromStatus = (status: ProposalIntentStatus) =>
  status === "TERMS_LOCKED" ||
  status === "BUNDLE_BUILT" ||
  status === "CREATOR_PARTIALLY_SIGNED" ||
  status === "SPONSOR_SIGNED" ||
  status === "SUBMITTED" ||
  status === "FAILED" ||
  status === "EXPIRED";

export default function IntentDetailPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [busyAction, setBusyAction] = useState<"refresh" | "lock" | "build" | "creator-sign" | "submit" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<BundleSubmitMode>("SERVER_RELAY");
  const [forceRebuild, setForceRebuild] = useState(false);
  const [creatorSignedBase64, setCreatorSignedBase64] = useState("");
  const [fullySignedBase64, setFullySignedBase64] = useState("");

  const intentId = String(router.query.intentId ?? "").trim();

  const refreshIntent = async (token: string, currentIntentId: string) => {
    const data = await getProposalIntentById(token, currentIntentId);
    setState({ kind: "ready", data });
    return data;
  };

  const handleAuthFailure = () => {
    clearStoredAuthSession();
    setState({ kind: "auth" });
  };

  const handleApiError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    if (message.includes("AUTH_REQUIRED") || message.includes("AUTH_INVALID") || message.includes("401")) {
      handleAuthFailure();
      return;
    }

    setActionMessage(message);
  };

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;
    const session = getStoredAuthSession();
    const currentIntentId = String(router.query.intentId ?? "").trim();

    if (!session) {
      setState({ kind: "auth" });
      return;
    }

    if (!currentIntentId) {
      setState({ kind: "error", message: "intentId is required" });
      return;
    }

    setState({ kind: "loading" });
    void getProposalIntentById(session.accessToken, currentIntentId)
      .then((data) => {
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load intent.";
        if (message.includes("AUTH_REQUIRED") || message.includes("401")) {
          handleAuthFailure();
          return;
        }

        setState({ kind: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.intentId]);

  const title = state.kind === "ready" ? state.data.intent.intentId : "Launch intent detail";
  const nextSteps = useMemo(() => {
    if (state.kind !== "ready") {
      return [];
    }

    return STATUS_ACTIONS[state.data.intent.status] ?? [];
  }, [state]);

  const latestBundle = state.kind === "ready" ? state.data.bundles[0] ?? null : null;

  const handleRefresh = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      handleAuthFailure();
      return;
    }

    if (!intentId) {
      setActionMessage("intentId is required");
      return;
    }

    setBusyAction("refresh");
    try {
      const status = await getProposalIntentStatus(session.accessToken, intentId);
      await refreshIntent(session.accessToken, intentId);
      setActionMessage(
        `Refreshed intent status: ${status.intent.status}${status.latestBundle ? ` / latest bundle ${status.latestBundle.status}` : ""}.`,
      );
    } catch (error) {
      handleApiError(error, "Failed to refresh intent status.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleLock = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      handleAuthFailure();
      return;
    }

    if (!intentId) {
      setActionMessage("intentId is required");
      return;
    }

    setBusyAction("lock");
    try {
      const locked = await lockProposalIntent(session.accessToken, intentId);
      await refreshIntent(session.accessToken, intentId);
      setActionMessage(`Intent locked. Status is now ${locked.status}.`);
    } catch (error) {
      handleApiError(error, "Failed to lock proposal intent.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBuildBundle = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      handleAuthFailure();
      return;
    }

    if (!intentId) {
      setActionMessage("intentId is required");
      return;
    }

    setBusyAction("build");
    try {
      const result = await buildProposalLaunchBundle(session.accessToken, intentId, {
        submitMode,
        forceRebuild,
      });
      await refreshIntent(session.accessToken, intentId);
      setActionMessage(
        `${result.reused ? "Reused" : "Built"} bundle ${result.bundle.bundleId} in ${result.bundle.submitMode} mode.`,
      );
    } catch (error) {
      handleApiError(error, "Failed to build launch bundle.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatorPartialSign = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      handleAuthFailure();
      return;
    }

    if (!intentId) {
      setActionMessage("intentId is required");
      return;
    }

    if (!latestBundle?.bundleId) {
      setActionMessage("Build a bundle before submitting creator partial signature.");
      return;
    }

    if (!creatorSignedBase64.trim()) {
      setActionMessage("Paste a partially signed transaction base64 payload first.");
      return;
    }

    setBusyAction("creator-sign");
    try {
      const result = await creatorPartialSignBundle(session.accessToken, intentId, {
        bundleId: latestBundle.bundleId,
        partiallySignedTxBase64: creatorSignedBase64.trim(),
      });
      await refreshIntent(session.accessToken, intentId);
      setActionMessage(
        `${result.replayed ? "Replayed" : "Stored"} creator partial signature for bundle ${result.bundle.bundleId}.`,
      );
    } catch (error) {
      handleApiError(error, "Failed to submit creator partial signature.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitBundle = async () => {
    const session = getStoredAuthSession();
    if (!session) {
      handleAuthFailure();
      return;
    }

    if (!intentId) {
      setActionMessage("intentId is required");
      return;
    }

    if (!latestBundle?.bundleId) {
      setActionMessage("Build a bundle before submitting sponsor signature.");
      return;
    }

    if (!fullySignedBase64.trim()) {
      setActionMessage("Paste a fully signed transaction base64 payload first.");
      return;
    }

    setBusyAction("submit");
    try {
      const result = await submitProposalBundle(session.accessToken, intentId, {
        bundleId: latestBundle.bundleId,
        fullySignedTxBase64: fullySignedBase64.trim(),
      });
      await refreshIntent(session.accessToken, intentId);
      setActionMessage(
        `Submit result: ${result.relayStatus}${result.chainTxSignature ? ` / ${result.chainTxSignature}` : ""}.`,
      );
    } catch (error) {
      handleApiError(error, "Failed to submit proposal bundle.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <Head>
        <title>{`StreamPump | ${title}`}</title>
      </Head>
      <WorkspaceShell
        subtitle="This page is intentionally single-surface. The same intent detail should reveal creator actions or sponsor actions based on the current session context instead of splitting the product into separate portals."
        title="Launch intent detail"
      >
        {state.kind === "loading" ? <AsyncStateCard body="Loading intent, bundle, manifest, and proposal linkage from the v1 proposal-intent API." title="Loading intent" /> : null}
        {state.kind === "auth" ? <AsyncStateCard actionHref="/login" actionLabel="Open login" body="Intent detail is now authenticated. Sign in through the tracked login surface to inspect launch state." title="Session required" /> : null}
        {state.kind === "error" ? <AsyncStateCard body={state.message} title="Intent request failed" /> : null}
        {state.kind === "ready" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <section className="glass-card p-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Intent</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{shortenWallet(state.data.intent.creatorWallet)} × {shortenWallet(state.data.intent.sponsorWallet)}</h3>
                      <p className="mt-1 text-sm text-slate-300">{state.data.manifest?.title ?? state.data.intent.manifestId ?? "Manifest pending"}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-white/12 px-3 py-1 text-xs text-slate-100">{state.data.intent.status}</span>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">{state.data.viewerRole}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 1</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatUsdcAtomic(state.data.intent.track1BaseUsdc)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 2 pool</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatUsdcAtomic(state.data.intent.track2UsdcDeposited)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Track 3 pool</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatUsdcAtomic(state.data.intent.track3UsdcDeposited)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Launch state machine</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      Current viewer role: <span className="font-medium text-white">{state.data.viewerRole}</span>. Metric target is <span className="font-medium text-white">{state.data.intent.track2MetricType}</span> / <span className="font-medium text-white">{state.data.intent.track2TargetValue}</span>.
                    </p>
                    {state.data.intent.failureReason ? <p className="mt-3 text-sm text-[#ffb39f]">Failure reason: {state.data.intent.failureReason}</p> : null}
                  </div>
                </div>
              </section>

              <section className="glass-card p-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Runtime actions</p>
                    <button
                      className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 disabled:opacity-70"
                      disabled={busyAction !== null}
                      onClick={() => void handleRefresh()}
                      type="button"
                    >
                      Refresh status
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {nextSteps.map((step) => (
                      <span className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200" key={step}>
                        {step}
                      </span>
                    ))}
                    {nextSteps.length === 0 ? <span className="text-sm text-slate-300">No action hints available for this status.</span> : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={busyAction !== null || state.data.intent.status !== "DRAFT"}
                      onClick={() => void handleLock()}
                      type="button"
                    >
                      Lock terms
                    </button>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <span>Submit mode</span>
                        <select
                          className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                          disabled={busyAction !== null}
                          onChange={(event) => setSubmitMode(event.target.value as BundleSubmitMode)}
                          value={submitMode}
                        >
                          <option value="SERVER_RELAY">SERVER_RELAY</option>
                          <option value="CLIENT_RELAY">CLIENT_RELAY</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          checked={forceRebuild}
                          disabled={busyAction !== null}
                          onChange={(event) => setForceRebuild(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Force rebuild</span>
                      </label>
                    </div>
                  </div>

                  <button
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={busyAction !== null || !canBuildFromStatus(state.data.intent.status)}
                    onClick={() => void handleBuildBundle()}
                    type="button"
                  >
                    Build launch bundle
                  </button>

                  {actionMessage ? (
                    <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      {actionMessage}
                    </div>
                  ) : null}
                </div>
              </section>

              {state.data.viewerRole === "CREATOR" ? (
                <section className="glass-card p-5">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Creator partial signature</p>
                    <p className="text-sm leading-7 text-slate-300">
                      Wallet signing is not wired into the tracked UI yet. Use this bridge field to paste the creator-partially-signed `VersionedTransaction` base64 payload returned from your wallet or signing tool.
                    </p>
                    <textarea
                      className="min-h-[180px] w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none"
                      onChange={(event) => setCreatorSignedBase64(event.target.value)}
                      placeholder="Paste partiallySignedTxBase64 here"
                      value={creatorSignedBase64}
                    />
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={busyAction !== null || !latestBundle}
                      onClick={() => void handleCreatorPartialSign()}
                      type="button"
                    >
                      Submit creator partial signature
                    </button>
                  </div>
                </section>
              ) : null}

              {state.data.viewerRole === "SPONSOR" ? (
                <section className="glass-card p-5">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sponsor final submission</p>
                    <p className="text-sm leading-7 text-slate-300">
                      Wallet signing is still outside the tracked UI. Paste the fully-signed bundle payload here so the backend can transition to `CLIENT_RELAY_PENDING`, `SUBMITTED`, or `CONFIRMED`.
                    </p>
                    <textarea
                      className="min-h-[180px] w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none"
                      onChange={(event) => setFullySignedBase64(event.target.value)}
                      placeholder="Paste fullySignedTxBase64 here"
                      value={fullySignedBase64}
                    />
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={busyAction !== null || !latestBundle}
                      onClick={() => void handleSubmitBundle()}
                      type="button"
                    >
                      Submit fully signed bundle
                    </button>
                  </div>
                </section>
              ) : null}

              {state.data.proposal ? (
                <section className="glass-card p-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Proposal linkage</p>
                      <Link
                        className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200"
                        href={`/campaigns/${state.data.proposal.id}`}
                      >
                        Open campaign
                      </Link>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                      <p>Proposal PDA: {state.data.proposal.proposalPda}</p>
                      <p className="mt-2">Status: {state.data.proposal.status}</p>
                      <p className="mt-2">Deadline: {formatIsoLabel(state.data.proposal.deadlineAt)}</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <section className="glass-card p-5">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Bundle notes</p>
                <p className="text-sm leading-7 text-slate-300">
                  This panel is now backed by the live intent detail response. It surfaces bundle freshness, signature presence, and chain submission state instead of static mock labels.
                </p>
                <div className="space-y-3">
                  {state.data.bundles.map((bundle) => (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300" key={bundle.bundleId}>
                      <p className="font-medium text-white">{bundle.status}</p>
                      <p className="mt-2">Bundle id: {bundle.bundleId}</p>
                      <p className="mt-2">Submit mode: {bundle.submitMode}</p>
                      <p className="mt-2">Expires: {formatIsoLabel(bundle.expiresAt)}</p>
                      <p className="mt-2">Recent blockhash: {bundle.recentBlockhash ?? "Pending"}</p>
                      <p className="mt-2">Chain tx: {bundle.chainTxSignature ?? "Not submitted"}</p>
                      <p className="mt-2">Has tx payload: {bundle.versionedTxBase64 ? "Yes" : "No"}</p>
                    </div>
                  ))}
                  {state.data.bundles.length === 0 ? <p className="text-sm text-slate-300">No bundles have been created for this intent yet.</p> : null}
                </div>
                {state.data.manifest ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                    <p>Manifest status: {state.data.manifest.status}</p>
                    <p className="mt-2">Assets: {state.data.manifest.assets.length}</p>
                    <p className="mt-2">Anchor PDA: {state.data.manifest.currentAnchorPda ?? "Pending"}</p>
                    <p className="mt-2">Manifest hash: {state.data.manifest.manifestHashHex ?? "Pending"}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </WorkspaceShell>
    </>
  );
}

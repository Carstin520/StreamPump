import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { getStoredAuthSession } from "@/lib/auth-session";
import {
  WorkspaceIntentSummary,
  WorkspaceManifestSummary,
  WorkspaceOverviewResponse,
  WorkspaceProposalSummary,
  getWorkspaceOverview,
} from "@/lib/api/workspace";
import {
  ContentManifestStatus,
  ContentType,
  ProposalIntentStatus,
  ProposalStatus,
} from "@/lib/api/types";
import {
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_PATH,
  buildLoginHref,
} from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  IMAGE_CAROUSEL: "Image note",
  MIXED_MEDIA_NOTE: "Mixed media",
  SHORT_VIDEO: "Short video",
};

const MANIFEST_STATUS_LABELS: Record<ContentManifestStatus, string> = {
  ANCHORED: "Anchored",
  ARCHIVED: "Archived",
  DRAFT: "Draft",
  LOCKED: "Locked",
  PUBLISHED: "Published",
  READY: "Ready",
  UPLOADING: "Uploading",
};

const INTENT_STATUS_LABELS: Record<ProposalIntentStatus, string> = {
  BUNDLE_BUILT: "Bundle built",
  CONFIRMED: "Confirmed",
  CREATOR_PARTIALLY_SIGNED: "Creator signed",
  DRAFT: "Draft",
  EXPIRED: "Expired",
  FAILED: "Failed",
  SPONSOR_SIGNED: "Sponsor signed",
  SUBMITTED: "Submitted",
  TERMS_LOCKED: "Terms locked",
};

const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  CANCELLED: "Cancelled",
  FUNDED: "Funded",
  OPEN: "Open",
  RESOLVED_FAIL: "Resolved fail",
  RESOLVED_SUCCESS: "Resolved success",
  VOIDED: "Voided",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const shortenAddress = (value: string | null | undefined) => {
  if (!value) {
    return "Not set";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const resolveManifestTitle = (manifest: WorkspaceManifestSummary) =>
  manifest.title?.trim() || `Untitled manifest ${manifest.manifestId.slice(0, 6)}`;

const resolveIntentTitle = (intent: WorkspaceIntentSummary) =>
  intent.manifest?.title?.trim() || `Intent ${intent.intentId.slice(0, 8)}`;

type WorkspaceState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "error"; message: string; loginHref?: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

export default function WorkspacePage() {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({
        status: "unauthenticated",
        loginHref: buildLoginHref({ nextPath: WORKSPACE_PATH }),
      });
      return;
    }

    setState({ status: "loading" });

    getWorkspaceOverview(session.accessToken)
      .then((data) => {
        if (isMounted) {
          setState({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        if (isAuthError(error)) {
          setState({
            status: "error",
            message: "Your session has expired. Sign in again to view the workspace.",
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_PATH),
          });
          return;
        }

        const message = error instanceof Error ? error.message : "Workspace request failed.";
        setState({ status: "error", message });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <Head>
        <title>StreamPump | Workspace</title>
      </Head>
      <PageShell
        eyebrow="Workspace"
        subtitle="Live content, proposal intents, and campaign projections for the signed-in wallet."
        title="Creator workspace"
      >
        {state.status === "loading" ? <WorkspaceLoading /> : null}
        {state.status === "unauthenticated" ? (
          <WorkspaceAuthRequired loginHref={state.loginHref} />
        ) : null}
        {state.status === "error" ? (
          <WorkspaceError loginHref={state.loginHref} message={state.message} />
        ) : null}
        {state.status === "ready" ? <WorkspaceOverview data={state.data} /> : null}
      </PageShell>
    </>
  );
}

const WorkspaceLoading = () => (
  <section className="liquid-glass-shell card-radius px-6 py-10">
    <p className="text-sm font-medium text-[#8ea0ba]">Loading workspace data...</p>
  </section>
);

const WorkspaceAuthRequired = ({ loginHref }: { loginHref: string }) => (
  <section className="liquid-glass-shell card-radius px-6 py-10">
    <div className="max-w-[560px]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7486a1]">Session required</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Sign in to open your workspace</h2>
      <p className="mt-3 text-sm leading-7 text-[#8ea0ba]">
        工作台现在读取真实后端数据，需要 Bearer session 才能展示内容草稿、合作意向和链上
        campaign 投影。
      </p>
      <Link
        className="glass-button-primary mt-6 inline-flex px-5 py-2.5 text-sm font-semibold"
        href={loginHref}
      >
        Sign in
      </Link>
    </div>
  </section>
);

const WorkspaceError = ({
  loginHref,
  message,
}: {
  loginHref?: string;
  message: string;
}) => (
  <section className="liquid-glass-shell card-radius px-6 py-10">
    <div className="max-w-[640px]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#f67263]">Workspace error</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Could not load workspace data</h2>
      <p className="mt-3 text-sm leading-7 text-[#8ea0ba]">{message}</p>
      {loginHref ? (
        <Link
          className="glass-button-primary mt-6 inline-flex px-5 py-2.5 text-sm font-semibold"
          href={loginHref}
        >
          Sign in again
        </Link>
      ) : null}
    </div>
  </section>
);

const WorkspaceOverview = ({ data }: { data: WorkspaceOverviewResponse }) => {
  const actionIntents = useMemo(
    () => data.intents.filter((intent) => intent.needsAction),
    [data.intents],
  );
  const hasData = data.manifests.length > 0 || data.intents.length > 0 || data.proposals.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatBlock label="Wallet" value={shortenAddress(data.wallet)} />
        <StatBlock label="Manifests" value={String(data.manifests.length)} />
        <StatBlock label="Intents" value={String(data.intents.length)} />
        <StatBlock label="Needs action" value={String(actionIntents.length)} accent />
      </div>

      {!hasData ? <EmptyWorkspace /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <SectionHeader
            actionHref={WORKSPACE_CONTENT_NEW_PATH}
            actionLabel="Create content"
            eyebrow="Content"
            title="Recent manifests"
          />
          <div className="space-y-3">
            {data.manifests.map((manifest) => (
              <ManifestRow key={manifest.manifestId} manifest={manifest} />
            ))}
            {data.manifests.length === 0 ? (
              <EmptyList message="No content manifests yet." />
            ) : null}
          </div>

          <SectionHeader
            eyebrow="Campaigns"
            title="On-chain proposal projections"
          />
          <div className="space-y-3">
            {data.proposals.map((proposal) => (
              <ProposalRow key={proposal.proposalId} proposal={proposal} />
            ))}
            {data.proposals.length === 0 ? (
              <EmptyList message="No confirmed proposal projections yet." />
            ) : null}
          </div>
        </div>

        <aside className="space-y-5" id="intents">
          <SectionHeader eyebrow="Sponsorship" title="Proposal intents" />
          <div className="space-y-3">
            {data.intents.map((intent) => (
              <IntentRow key={intent.intentId} intent={intent} />
            ))}
            {data.intents.length === 0 ? (
              <EmptyList message="No sponsorship intents yet." />
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
};

const StatBlock = ({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#7486a1]">{label}</p>
    <p className={`mt-2 truncate text-xl font-semibold ${accent ? "text-[#de402a]" : "text-white"}`}>
      {value}
    </p>
  </div>
);

const SectionHeader = ({
  actionHref,
  actionLabel,
  eyebrow,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  eyebrow: string;
  title: string;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7486a1]">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
    </div>
    {actionHref && actionLabel ? (
      <Link
        className="glass-button-primary inline-flex px-4 py-2 text-xs font-semibold"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    ) : null}
  </div>
);

const ManifestRow = ({ manifest }: { manifest: WorkspaceManifestSummary }) => (
  <Link className="block" href={`/workspace/content/${manifest.manifestId}`}>
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 transition hover:border-white/[0.16] hover:bg-white/[0.07]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">
            {resolveManifestTitle(manifest)}
          </h3>
          <p className="mt-1 text-xs text-[#8ea0ba]">
            {CONTENT_TYPE_LABELS[manifest.contentType]} · {manifest.assetCount} assets · v{manifest.version}
          </p>
        </div>
        <StatusPill label={MANIFEST_STATUS_LABELS[manifest.status]} />
      </div>
      <p className="mt-3 text-xs text-[#7486a1]">Updated {formatDateTime(manifest.updatedAt)}</p>
    </article>
  </Link>
);

const IntentRow = ({ intent }: { intent: WorkspaceIntentSummary }) => (
  <Link className="block" href={`/workspace/intents/${intent.intentId}`}>
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 transition hover:border-white/[0.16] hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{resolveIntentTitle(intent)}</h3>
          <p className="mt-1 text-xs text-[#8ea0ba]">
            {intent.viewerRole.toLowerCase()} · {shortenAddress(intent.sponsorWallet)}
          </p>
        </div>
        <StatusPill label={INTENT_STATUS_LABELS[intent.status]} tone={intent.needsAction ? "hot" : "default"} />
      </div>
      {intent.latestBundle ? (
        <p className="mt-3 text-xs text-[#7486a1]">
          Bundle {intent.latestBundle.status} · expires {formatDateTime(intent.latestBundle.expiresAt)}
        </p>
      ) : (
        <p className="mt-3 text-xs text-[#7486a1]">No launch bundle yet</p>
      )}
    </article>
  </Link>
);

const ProposalRow = ({ proposal }: { proposal: WorkspaceProposalSummary }) => (
  <Link className="block" href={`/campaigns/${proposal.proposalId}`}>
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 transition hover:border-white/[0.16] hover:bg-white/[0.07]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">
            {shortenAddress(proposal.proposalPda)}
          </h3>
          <p className="mt-1 text-xs text-[#8ea0ba]">
            {proposal.track2MetricType} · oracle {proposal.oracleSyncStatus}
          </p>
        </div>
        <StatusPill label={PROPOSAL_STATUS_LABELS[proposal.status]} />
      </div>
      <p className="mt-3 text-xs text-[#7486a1]">Deadline {formatDateTime(proposal.deadlineAt)}</p>
    </article>
  </Link>
);

const StatusPill = ({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "hot";
}) => (
  <span
    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
      tone === "hot"
        ? "border-[#f3b33e]/35 bg-[#f3b33e]/12 text-[#f3c66e]"
        : "border-white/[0.1] bg-white/[0.06] text-[#b8c4d8]"
    }`}
  >
    {label}
  </span>
);

const EmptyWorkspace = () => (
  <section className="liquid-glass-shell card-radius px-6 py-10">
    <div className="max-w-[640px]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7486a1]">No workspace records</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Start with a content manifest</h2>
      <p className="mt-3 text-sm leading-7 text-[#8ea0ba]">
        当前钱包还没有内容、合作意向或链上 campaign。先创建一条内容记录，再进入赞助合作流程。
      </p>
      <Link
        className="glass-button-primary mt-6 inline-flex px-5 py-2.5 text-sm font-semibold"
        href={WORKSPACE_CONTENT_NEW_PATH}
      >
        Create content
      </Link>
    </div>
  </section>
);

const EmptyList = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-5 text-sm text-[#8ea0ba]">
    {message}
  </div>
);

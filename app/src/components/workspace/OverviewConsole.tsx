import Link from "next/link";
import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  CopyIcon,
  SignatureIcon,
  SparklesIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import {
  ContentManifestStatus,
  ContentType,
  CreatorSeasonState,
  ProposalIntentStatus,
} from "@/lib/api/types";
import {
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_PATH,
  WORKSPACE_SPONSORSHIPS_PATH,
} from "@/lib/routes";
import {
  WorkspaceActionItem,
  WorkspaceContentItem,
  WorkspacePersona,
} from "@/lib/mocks/workspace";

const STAGE_CONSOLE_TITLE: Record<CreatorSeasonState, string> = {
  S1_DISCOVERY: "S1 Discovery",
  S1_BUYOUT: "S1 毕业赞助",
  S2_ACTIVE: "S2 Sponsored Creator",
};

const RECENT_CONTENT_LIMIT = 3;

/* ────────────────────────────  Status maps  ──────────────────────────── */

export const MANIFEST_STATUS_LABELS: Record<ContentManifestStatus, string> = {
  DRAFT: "Draft",
  UPLOADING: "Uploading",
  READY: "Ready",
  LOCKED: "Locked",
  ANCHORED: "Anchored",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

// Mapped onto shared semantic tones by hue (see globals.css .tone-*).
export const MANIFEST_STATUS_TONES: Record<ContentManifestStatus, string> = {
  DRAFT: "tone-state-neutral",
  UPLOADING: "tone-state-info",
  READY: "tone-state-success",
  LOCKED: "tone-state-warning",
  ANCHORED: "tone-stage-buyout",
  PUBLISHED: "tone-state-success",
  ARCHIVED: "tone-state-neutral",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SHORT_VIDEO: "Short video",
  IMAGE_CAROUSEL: "Image carousel",
  MIXED_MEDIA_NOTE: "Mixed media",
};

export const INTENT_STATUS_LABELS: Record<ProposalIntentStatus, string> = {
  DRAFT: "Draft",
  TERMS_LOCKED: "Terms Locked",
  BUNDLE_BUILT: "Bundle Built",
  CREATOR_PARTIALLY_SIGNED: "Creator Signed",
  SPONSOR_SIGNED: "Sponsor Signed",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

export const INTENT_STATUS_TONES: Record<ProposalIntentStatus, string> = {
  DRAFT: "tone-state-neutral",
  TERMS_LOCKED: "tone-state-info",
  BUNDLE_BUILT: "tone-state-warning",
  CREATOR_PARTIALLY_SIGNED: "tone-state-success",
  SPONSOR_SIGNED: "tone-state-success",
  SUBMITTED: "tone-stage-buyout",
  CONFIRMED: "tone-stage-buyout",
  FAILED: "tone-state-danger",
  EXPIRED: "tone-state-neutral",
};

type StageRailStatus = "done" | "current" | "blocked" | "pending";

const truncateWallet = (wallet: string) => {
  if (!wallet) return "—";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
};

/* ────────────────────────────  Public component  ──────────────────────────── */

export const OverviewConsole = ({ persona }: { persona: WorkspacePersona }) => (
  <div className="space-y-4 pb-4">
    <OperatingHeader persona={persona} />
    <StageLifecycleRail persona={persona} />
    <KpiStrip persona={persona} />
    <NextActions persona={persona} />
    <RecentContent persona={persona} />
  </div>
);

export const OverviewAside = ({ persona }: { persona: WorkspacePersona }) => (
  <div className="space-y-3">
    <DeadlineReminderCard persona={persona} />
    <ContentPreviewCompact item={persona.previewItem} />
  </div>
);

/* ────────────────────────────  Operating header  ──────────────────────────── */

const OperatingHeader = ({ persona }: { persona: WorkspacePersona }) => {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.95)_0%,rgba(8,12,20,0.95)_100%)] px-4 py-3.5 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <img
            alt={persona.displayName}
            className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/[0.08]"
            src={persona.avatarSrc}
          />
          <div className="min-w-0">
            <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
              {today}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="truncate text-[length:var(--fs-sm)] font-semibold text-white">{persona.displayName}</p>
              <StagePill compact stage={persona.stage} />
              <span className="hidden text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.14em] text-[#6f8099] sm:inline">
                {STAGE_CONSOLE_TITLE[persona.stage]}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--fs-overline)] font-medium text-[#cbd6e7]">{persona.handle}</span>
              <button
                aria-label="Copy wallet"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[length:var(--fs-micro)] text-[#bcc8de] transition hover:border-white/[0.12] hover:text-white"
                type="button"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#65ecaf]" />
                {truncateWallet(persona.wallet)}
                <CopyIcon className="h-3 w-3 text-[#7486a1]" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:text-white"
            href={WORKSPACE_SPONSORSHIPS_PATH}
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            New campaign
          </Link>
          <Link
            className="flex items-center gap-1.5 rounded-md bg-[#de402a] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-white transition hover:bg-[#ea523e]"
            href={WORKSPACE_CONTENT_NEW_PATH}
          >
            <UploadIcon className="h-3.5 w-3.5" />
            Upload content
          </Link>
        </div>
      </div>
    </section>
  );
};

/* ────────────────────────────  Stage lifecycle rail  ──────────────────────────── */

const StageLifecycleRail = ({ persona }: { persona: WorkspacePersona }) => {
  const steps = buildLifecycleSteps(persona);

  return (
    <section className="overflow-hidden rounded-[16px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)] px-4 py-3 md:px-5 md:py-3.5">
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
          Today&rsquo;s flow
        </p>
        <Link
          className="text-[length:var(--fs-micro)] text-[#7486a1] hover:text-white"
          href={WORKSPACE_SPONSORSHIPS_PATH}
        >
          Detailed flow →
        </Link>
      </header>

      <div className="overflow-x-auto scrollbar-none">
        <div className="flex min-w-[460px] items-start gap-2">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;

            return (
              <div className="flex min-w-0 flex-1 items-start" key={step.id}>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <div className="flex w-full items-center gap-2">
                    <RailDot status={step.status} />
                    <p
                      className={`truncate text-[length:var(--fs-overline)] font-semibold tracking-[-0.01em] ${
                        step.status === "current"
                          ? "text-white"
                          : step.status === "done"
                            ? "text-[#8df0c4]"
                            : step.status === "blocked"
                              ? "text-[#f3c66e]"
                              : "text-[#7e90aa]"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  <p
                    className={`pl-7 text-[length:var(--fs-micro)] leading-snug ${
                      step.status === "pending" ? "text-[#5a6b82]" : "text-[#9aabc4]"
                    }`}
                  >
                    {step.detail}
                  </p>
                </div>
                {!isLast ? (
                  <div className="mt-[10px] hidden h-[2px] w-8 shrink-0 rounded-full md:block">
                    <div
                      className={`h-full w-full rounded-full ${
                        step.status === "done"
                          ? "bg-[#65ecaf]/55"
                          : step.status === "current"
                            ? "bg-gradient-to-r from-[#65ecaf]/45 to-[#de402a]/40"
                            : "bg-white/[0.06]"
                      }`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const RailDot = ({ status }: { status: StageRailStatus }) => {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#65ecaf]/22 text-[#8df0c4] ring-1 ring-[#65ecaf]/35">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#de402a] opacity-30" />
        <span className="relative h-3.5 w-3.5 rounded-full bg-[#de402a] ring-2 ring-[#de402a]/35 shadow-[0_0_14px_rgba(222,64,42,0.45)]" />
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f3b33e]/22 ring-1 ring-[#f3b33e]/35">
        <span className="h-2 w-2 rounded-full bg-[#f3b33e]" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#3a4556]" />
    </span>
  );
};

const buildLifecycleSteps = (persona: WorkspacePersona) => {
  const ready = persona.contentItems.filter((m) => ["READY", "ANCHORED", "PUBLISHED"].includes(m.status)).length;
  const totalContent = persona.contentItems.length;
  const intents = persona.sponsorshipItems;
  const hasTermsLocked = intents.some((i) =>
    [
      "TERMS_LOCKED",
      "BUNDLE_BUILT",
      "CREATOR_PARTIALLY_SIGNED",
      "SPONSOR_SIGNED",
      "SUBMITTED",
      "CONFIRMED",
    ].includes(i.status),
  );
  const hasCreatorSig = intents.some((i) =>
    ["CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(i.status),
  );
  const hasSponsorSig = intents.some((i) =>
    ["SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(i.status),
  );
  const confirmed = intents.some((i) => i.status === "CONFIRMED");
  const sigPendingForCreator = intents.some((s) => s.actionOwner === "creator");

  const contentDone = ready > 0;
  const termsDone = hasTermsLocked;
  const bothSigned = hasCreatorSig && hasSponsorSig;
  const settled = confirmed;

  const steps: Array<{ id: string; label: string; detail: string; status: StageRailStatus }> = [
    {
      id: "content",
      label: "Content prep",
      detail: contentDone
        ? `${ready} ready`
        : totalContent > 0
          ? `${totalContent} drafts in progress`
          : "Upload your first asset",
      status: contentDone ? "done" : totalContent > 0 ? "current" : "pending",
    },
    {
      id: "terms",
      label: "Lock terms",
      detail: termsDone
        ? "Terms locked"
        : intents.length > 0
          ? "Awaiting confirmation"
          : "No campaign yet",
      status: termsDone ? "done" : intents.length > 0 ? "current" : "pending",
    },
    {
      id: "signatures",
      label: "Both signatures",
      detail: bothSigned
        ? "Signed"
        : sigPendingForCreator
          ? "Your signature next"
          : hasCreatorSig
            ? "Awaiting sponsor"
            : "—",
      status: bothSigned
        ? "done"
        : sigPendingForCreator
          ? "blocked"
          : termsDone
            ? "current"
            : "pending",
    },
    {
      id: "settle",
      label: "Claim & settle",
      detail: settled
        ? "Funds available"
        : bothSigned
          ? "Awaiting oracle"
          : "—",
      status: settled ? "done" : bothSigned ? "current" : "pending",
    },
  ];

  return steps;
};

/* ────────────────────────────  KPI strip  ──────────────────────────── */

const KpiStrip = ({ persona }: { persona: WorkspacePersona }) => {
  const sponsorshipItems = persona.sponsorshipItems;
  const ready = persona.contentItems.filter((m) => ["READY", "ANCHORED", "PUBLISHED"].includes(m.status)).length;
  const pendingActions = persona.actions.filter((a) => !a.disabled && a.workflowState !== "blocked").length;
  const isLiveWorkspace = persona.dataSource === "live";
  const activeCampaigns =
    persona.activeCampaigns ??
    sponsorshipItems.filter((s) =>
      ["TERMS_LOCKED", "BUNDLE_BUILT", "CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(s.status),
    ).length;

  const claimableValue = isLiveWorkspace ? "—" : persona.stage === "S2_ACTIVE" ? "$1.2k" : "—";
  const claimableHint = isLiveWorkspace
    ? "Open detail pages"
    : persona.stage === "S2_ACTIVE"
      ? "USDC + SPUMP"
      : "Available after S2";

  return (
    <section className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
      <KpiTile
        accent="#67b8ff"
        delta={activeCampaigns > 0 ? "live" : "—"}
        hint={activeCampaigns > 0 ? "Campaigns in flight" : "No active sponsor"}
        label="Active campaigns"
        value={String(activeCampaigns)}
      />
      <KpiTile
        accent={pendingActions > 0 ? "#f3b33e" : "#7e90aa"}
        delta={pendingActions > 0 ? "today" : "clear"}
        hint={pendingActions > 0 ? "Items waiting on you" : "Nothing urgent"}
        label="Pending actions"
        tone={pendingActions > 0 ? "warn" : "neutral"}
        value={String(pendingActions)}
      />
      <KpiTile
        accent="#ffb38a"
        delta={persona.stage === "S2_ACTIVE" ? "Track 2" : "S2"}
        hint={claimableHint}
        label="Claimable"
        value={claimableValue}
      />
      <KpiTile
        accent="#65ecaf"
        delta={ready > 0 ? "ready" : "—"}
        hint={ready > 0 ? "Campaign-ready manifests" : "Upload a manifest"}
        label="Content ready"
        value={String(ready)}
      />
    </section>
  );
};

const KpiTile = ({
  accent,
  delta,
  hint,
  label,
  tone = "neutral",
  value,
}: {
  accent: string;
  delta?: string;
  hint: string;
  label: string;
  tone?: "neutral" | "warn";
  value: string;
}) => (
  <div className="rounded-xl border border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,19,28,0.95)_0%,rgba(9,13,20,0.95)_100%)] px-3 py-2.5">
    <div className="flex items-center justify-between gap-1">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <span className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.12em] text-[#5a6b82]">{delta}</span>
    </div>
    <p className="mt-1 text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] text-[#6f8099]">{label}</p>
    <p
      className={`mt-0.5 text-[20px] font-semibold leading-tight tracking-[-0.03em] ${
        tone === "warn" ? "text-[#f3c66e]" : "text-white"
      }`}
    >
      {value}
    </p>
    <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#6f8099]">{hint}</p>
  </div>
);

/* ────────────────────────────  Next actions  ──────────────────────────── */

const ACTION_ICONS: Record<WorkspaceActionItem["iconName"], ReactNode> = {
  upload: <UploadIcon className="h-4 w-4" />,
  signature: <SignatureIcon className="h-4 w-4" />,
  sparkles: <SparklesIcon className="h-4 w-4" />,
  chevron: <ChevronRightIcon className="h-4 w-4" />,
};

const ACTION_PRIORITY = (action: WorkspaceActionItem): number => {
  if (action.disabled) return 99;
  if (action.tone === "urgent") return 0;
  if (action.iconName === "signature") return 1;
  if (action.workflowState === "ready") return 2;
  if (action.workflowState === "waiting") return 3;
  return 4;
};

const NextActions = ({ persona }: { persona: WorkspacePersona }) => {
  const sorted = [...persona.actions].sort((a, b) => ACTION_PRIORITY(a) - ACTION_PRIORITY(b));
  const top = sorted.slice(0, 3);
  const hidden = persona.actions.length - top.length;

  return (
    <section className="rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.92)_0%,rgba(8,12,20,0.92)_100%)] p-3 md:p-4">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">
            What you should do today
          </p>
          <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">
            {top.length} priority · {hidden > 0 ? `${hidden} more queued` : "all surfaced"}
          </p>
        </div>
        <Link
          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:text-white"
          href={WORKSPACE_SPONSORSHIPS_PATH}
        >
          View all →
        </Link>
      </header>
      <div className="grid gap-2 md:grid-cols-3">
        {top.map((action) => (
          <NextActionCard action={action} key={`${action.title}-${action.ctaLabel}`} />
        ))}
      </div>
    </section>
  );
};

const workflowBadgeClass = (state: WorkspaceActionItem["workflowState"], disabled?: boolean) => {
  if (disabled) return "border-white/[0.08] bg-white/[0.04] text-[#7e90aa]";
  if (state === "ready") return "border-[#65ecaf]/25 bg-[#0e1f17]/80 text-[#8df0c4]";
  if (state === "blocked") return "border-[#f67263]/25 bg-[#1a1115]/80 text-[#f67263]";
  return "border-[#67b8ff]/22 bg-[#0e1726]/80 text-[#8ad0ff]";
};

const workflowLabel = (action: WorkspaceActionItem) => {
  if (action.disabled) return "Waiting";
  if (action.workflowState === "blocked") return "Blocked";
  if (action.workflowState === "waiting") return "Waiting";
  if (action.workflowState === "ready") return "Ready";
  return "Ready";
};

const NextActionCard = ({ action }: { action: WorkspaceActionItem }) => {
  const inner = (
    <article
      className={`flex h-full flex-col gap-2 rounded-xl border bg-white/[0.02] px-3 py-3 transition ${
        action.disabled
          ? "border-white/[0.05] opacity-75"
          : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[#cbd6e7]">
          {ACTION_ICONS[action.iconName]}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em] ${workflowBadgeClass(action.workflowState, action.disabled)}`}
        >
          {workflowLabel(action)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{action.title}</p>
        {action.subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-[length:var(--fs-micro)] leading-relaxed text-[#7e90aa]">{action.subtitle}</p>
        ) : null}
        {action.chainHint ? (
          <p className="mt-1.5 truncate font-mono text-[length:var(--fs-nano)] text-[#5a6b82]">{action.chainHint}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] pt-2">
        <span
          className={`truncate text-[length:var(--fs-micro)] font-semibold ${
            action.disabled ? "text-[#5a6b82]" : action.tone === "urgent" ? "text-[#ff8a78]" : "text-[#cbd6e7]"
          }`}
        >
          {action.ctaLabel}
        </span>
        <ChevronRightIcon className={`h-3.5 w-3.5 shrink-0 ${action.disabled ? "text-[#3a4556]" : "text-[#7e90aa]"}`} />
      </div>
    </article>
  );

  if (action.disabled || !action.href) {
    return inner;
  }
  return (
    <Link className="block" href={action.href}>
      {inner}
    </Link>
  );
};

/* ────────────────────────────  Recent content (compact)  ──────────────────────────── */

const creatorFriendlyStatus = (
  status: ContentManifestStatus,
): { label: string; tone: "ready" | "progress" | "wait" | "needs"; hint: string } => {
  switch (status) {
    case "READY":
    case "ANCHORED":
      return { label: "Campaign-ready", tone: "ready", hint: "Use in a sponsorship" };
    case "PUBLISHED":
      return { label: "Live · campaign-ready", tone: "ready", hint: "Visible on feed" };
    case "LOCKED":
      return { label: "In a campaign", tone: "ready", hint: "Locked to sponsor" };
    case "UPLOADING":
      return { label: "Uploading", tone: "progress", hint: "Hold tight" };
    case "DRAFT":
      return { label: "Needs assets", tone: "needs", hint: "Add files to publish" };
    case "ARCHIVED":
      return { label: "Archived", tone: "wait", hint: "Out of rotation" };
    default:
      return { label: "Pending", tone: "wait", hint: "—" };
  }
};

const statusToneClass = (tone: "ready" | "progress" | "wait" | "needs") => {
  switch (tone) {
    case "ready":
      return "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]";
    case "progress":
      return "border-[#67b8ff]/22 bg-[#0e1726]/80 text-[#8ad0ff]";
    case "needs":
      return "tone-state-warning";
    default:
      return "border-white/[0.08] bg-white/[0.04] text-[#9aabc4]";
  }
};

const RECENT_PRIORITY: Record<ContentManifestStatus, number> = {
  UPLOADING: 0,
  DRAFT: 1,
  READY: 2,
  ANCHORED: 3,
  LOCKED: 4,
  PUBLISHED: 5,
  ARCHIVED: 6,
};

const RecentContent = ({ persona }: { persona: WorkspacePersona }) => {
  const items = [...persona.contentItems]
    .sort((a, b) => RECENT_PRIORITY[a.status] - RECENT_PRIORITY[b.status])
    .slice(0, RECENT_CONTENT_LIMIT);

  return (
    <section className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.92)_0%,rgba(8,12,20,0.92)_100%)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2.5 md:px-4">
        <div>
          <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Recent content</p>
          <p className="mt-0.5 text-[length:var(--fs-micro)] text-[#7486a1]">
            {persona.contentItems.length} total · showing top {Math.min(items.length, RECENT_CONTENT_LIMIT)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {persona.pipelineDemoFallback ? (
            <span className="rounded-full border border-[#67b8ff]/25 bg-[#0e1726]/80 px-2.5 py-1 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.14em] text-[#8ad0ff]">
              Demo data
            </span>
          ) : null}
          <Link
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.12] hover:text-white"
            href={WORKSPACE_CONTENT_NEW_PATH}
          >
            <UploadIcon className="h-3 w-3" />
            New
          </Link>
        </div>
      </header>

      <div className="divide-y divide-white/[0.04]">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[length:var(--fs-overline)] text-[#7e90aa]">
            No content yet —{" "}
            <Link className="text-[#cbd6e7] underline-offset-4 hover:underline" href={WORKSPACE_CONTENT_NEW_PATH}>
              upload your first asset
            </Link>
            .
          </div>
        ) : null}
        {items.map((item) => (
          <RecentContentRow item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
};

const RecentContentRow = ({ item }: { item: WorkspaceContentItem }) => {
  const friendly = creatorFriendlyStatus(item.status);
  const eligible = friendly.tone === "ready";
  const needsUpload = item.status === "DRAFT" || item.status === "UPLOADING";

  const primary: { label: string; href: string; variant: "primary" | "secondary" } = needsUpload
    ? { label: "Continue upload", href: item.href ?? WORKSPACE_CONTENT_NEW_PATH, variant: "primary" }
    : eligible
      ? { label: "Use in campaign", href: WORKSPACE_SPONSORSHIPS_PATH, variant: "primary" }
      : { label: "Open", href: item.href ?? "#", variant: "secondary" };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 md:px-4">
      <Link className="flex min-w-0 flex-1 items-center gap-3" href={item.href ?? "#"}>
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#0d1420]">
          <ProgressiveImage
            alt={item.title}
            className="h-full w-full object-cover"
            fill
            sizes="48px"
            src={item.coverSrc}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full border px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.12em] ${statusToneClass(friendly.tone)}`}
            >
              {friendly.label}
            </span>
            <span className="truncate text-[length:var(--fs-micro)] text-[#7e90aa]">{friendly.hint}</span>
          </div>
        </div>
      </Link>

      <Link
        className={`flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-[length:var(--fs-micro)] font-semibold transition ${
          primary.variant === "primary"
            ? "bg-[#de402a] text-white hover:bg-[#ea523e]"
            : "border border-white/[0.08] bg-white/[0.03] text-[#cbd6e7] hover:border-white/[0.16] hover:text-white"
        }`}
        href={primary.href}
      >
        {primary.label}
      </Link>
    </div>
  );
};

/* ────────────────────────────  Aside: Today reminders  ──────────────────────────── */

const DeadlineReminderCard = ({ persona }: { persona: WorkspacePersona }) => {
  const sigPending = persona.sponsorshipItems.find((s) => s.actionOwner === "creator");
  const sponsorWaiting = persona.sponsorshipItems.find((s) => s.actionOwner === "sponsor");
  const upload = persona.contentItems.find((c) => c.status === "UPLOADING" || c.status === "DRAFT");

  const reminders: Array<{ id: string; tone: "warn" | "info" | "ok"; title: string; subtitle: string }> = [];
  if (sigPending) {
    reminders.push({
      id: "creator-sign",
      tone: "warn",
      title: "Your signature is needed",
      subtitle: `${sigPending.manifestTitle} · ${sigPending.deadlineLabel}`,
    });
  }
  if (sponsorWaiting) {
    reminders.push({
      id: "sponsor-sign",
      tone: "info",
      title: "Awaiting sponsor signature",
      subtitle: `${sponsorWaiting.manifestTitle} · ${sponsorWaiting.deadlineLabel}`,
    });
  }
  if (upload) {
    reminders.push({
      id: "upload",
      tone: "info",
      title: "Asset upload in progress",
      subtitle: `${upload.title} · resume to keep momentum`,
    });
  }
  if (reminders.length === 0) {
    reminders.push({
      id: "all-clear",
      tone: "ok",
      title: "Nothing urgent",
      subtitle: "Keep posting to attract sponsors",
    });
  }

  return (
    <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Today</p>
        <Link className="text-[length:var(--fs-micro)] text-[#cbd6e7] hover:text-white" href={WORKSPACE_SPONSORSHIPS_PATH}>
          Open desk →
        </Link>
      </header>
      <div className="space-y-1 p-2">
        {reminders.slice(0, 3).map((reminder) => {
          const dot =
            reminder.tone === "warn"
              ? "bg-[#ff8a78]"
              : reminder.tone === "ok"
                ? "bg-[#65ecaf]"
                : "bg-[#8ad0ff]";
          return (
            <div className="flex items-start gap-2 rounded-xl px-2.5 py-2" key={reminder.id}>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <div className="min-w-0">
                <p className="truncate text-[length:var(--fs-overline)] font-medium text-white">{reminder.title}</p>
                <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7486a1]">{reminder.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* ────────────────────────────  Aside: Content preview  ──────────────────────────── */

const ContentPreviewCompact = ({ item }: { item: WorkspacePersona["previewItem"] }) => {
  const empty = item.statusLabel === "EMPTY";

  return (
    <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.92)_0%,rgba(8,12,20,0.92)_100%)]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
        <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">Latest manifest</p>
        {item.href ? (
          <Link className="text-[length:var(--fs-micro)] text-[#cbd6e7] hover:text-white" href={item.href}>
            Open
          </Link>
        ) : null}
      </header>
      <div className="flex gap-2 p-2">
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.05] bg-[#0d1420]">
          <ProgressiveImage alt={item.title} className="h-full w-full object-cover" fill sizes="80px" src={item.coverSrc} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[length:var(--fs-micro)] font-semibold leading-snug text-white">{item.title}</p>
          <p className="mt-0.5 text-[length:var(--fs-nano)] text-[#7486a1]">{item.subtitle}</p>
          <span
            className={`mt-1 inline-block rounded border px-1.5 py-px text-[length:var(--fs-nano)] font-semibold uppercase ${
              empty
                ? "border-white/[0.08] bg-white/[0.04] text-[#9aabc4]"
                : "border-[#65ecaf]/25 bg-[#0e1f17]/80 text-[#8df0c4]"
            }`}
          >
            {item.statusLabel}
          </span>
        </div>
      </div>
    </section>
  );
};

/* ────────────────────────────  Workspace shell auxiliary states  ──────────────────────────── */

export const ConsoleLoading = () => (
  <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-8">
    <div className="flex items-center gap-3">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
      <p className="text-sm text-[#9aabc4]">Loading creator operating console…</p>
    </div>
  </section>
);

export const ConsoleAuthRequired = ({ loginHref }: { loginHref: string }) => (
  <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-8">
    <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.2em] text-[#7486a1]">Login required</p>
    <h2 className="mt-2 text-lg font-semibold text-white">Sign in to open the console</h2>
    <p className="mt-2 text-sm text-[#9aabc4]">
      Connect your wallet to load creator manifests, campaigns, and on-chain status.
    </p>
    <Link
      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white"
      href={loginHref}
    >
      Sign in
    </Link>
  </section>
);

export const ConsoleError = ({ message, loginHref }: { message: string; loginHref?: string }) => (
  <section className="rounded-2xl border border-[#f67263]/25 bg-[#1a1115]/80 px-6 py-8">
    <div className="flex items-center gap-3">
      <WarningIcon className="h-5 w-5 text-[#f67263]" />
      <p className="text-sm font-medium text-[#f67263]">Console failed to load</p>
    </div>
    <p className="mt-2 text-sm text-[#9aabc4]">{message}</p>
    {loginHref ? (
      <Link
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white"
        href={loginHref}
      >
        Sign in again
      </Link>
    ) : null}
  </section>
);

export const ROUTES = { WORKSPACE_PATH };

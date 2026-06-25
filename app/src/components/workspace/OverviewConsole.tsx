import Link from "next/link";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import {
  ContentManifestStatus,
  ContentType,
  CreatorSeasonState,
  ProposalIntentStatus,
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { compactNumber } from "@/lib/mocks/utils";
import {
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_PATH,
  WORKSPACE_SPONSORSHIPS_PATH,
} from "@/lib/routes";
import {
  WorkspaceContentItem,
  WorkspacePersona,
} from "@/lib/mocks/workspace";

/* ────────────────────────────  Status maps (shared exports)  ──────────────────────────── */

export const MANIFEST_STATUS_LABELS: Record<ContentManifestStatus, string> = {
  DRAFT: "Draft",
  UPLOADING: "Uploading",
  READY: "Ready",
  LOCKED: "Locked",
  ANCHORED: "Anchored",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

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

/* ────────────────────────────  Helpers  ──────────────────────────── */

const STAGE_BANNER_KEY: Record<CreatorSeasonState, string> = {
  S1_DISCOVERY: "ws.stageBanner.s1",
  S1_BUYOUT: "ws.stageBanner.buyout",
  S2_ACTIVE: "ws.stageBanner.s2",
};

// Friendly Chinese status for the recent-content rows.
const CONTENT_STATUS_KEY: Record<ContentManifestStatus, string> = {
  DRAFT: "ws.contentStatus.draft",
  UPLOADING: "ws.contentStatus.uploading",
  READY: "ws.contentStatus.ready",
  LOCKED: "ws.contentStatus.locked",
  ANCHORED: "ws.contentStatus.anchored",
  PUBLISHED: "ws.contentStatus.published",
  ARCHIVED: "ws.contentStatus.archived",
};

const CONTENT_STATUS_TONE: Record<ContentManifestStatus, string> = {
  DRAFT: "border-[#f3b33e]/25 bg-[#2a1f0b]/70 text-[#f3c66e]",
  UPLOADING: "border-[#67b8ff]/25 bg-[#0e1726]/70 text-[#8ad0ff]",
  READY: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]",
  LOCKED: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]",
  ANCHORED: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]",
  PUBLISHED: "border-[#65ecaf]/22 bg-[#0e1f17]/70 text-[#8df0c4]",
  ARCHIVED: "border-white/[0.08] bg-white/[0.04] text-[#9aabc4]",
};

export const RECENT_PRIORITY: Record<ContentManifestStatus, number> = {
  UPLOADING: 0,
  DRAFT: 1,
  READY: 2,
  ANCHORED: 3,
  LOCKED: 4,
  PUBLISHED: 5,
  ARCHIVED: 6,
};

const greetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return "ws.greeting.morning";
  if (h < 18) return "ws.greeting.afternoon";
  return "ws.greeting.evening";
};

/* ────────────────────────────  Home (prototype renderHome)  ──────────────────────────── */

export const OverviewConsole = ({ persona }: { persona: WorkspacePersona }) => {
  const { t } = useI18n();
  // Pending opportunities = sponsorship intents waiting on the creator.
  const pendingOpps = persona.sponsorshipItems.filter((s) => s.actionOwner === "creator");
  const weeklyViews = persona.viewsTrend.reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-4 pb-4">
      {/* Greeting */}
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-white">
        {t(greetingKey())}，{persona.handle} 👋
      </h1>

      {/* Stage banner — real persona data */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,19,28,0.95)_0%,rgba(9,13,20,0.95)_100%)] px-5 py-4">
        <div>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{t("ws.stageNow")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[length:var(--fs-caption)] font-bold text-[#67b8ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#67b8ff]" />
            {t(STAGE_BANNER_KEY[persona.stage])}
          </p>
        </div>
        <div className="h-8 w-px bg-white/[0.08]" />
        <div>
          <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.16em] text-[#5a6d87]">{t("ws.momentum")}</p>
          <p className="mt-1 text-[length:var(--fs-caption)] font-bold text-white">{persona.momentum}</p>
        </div>
        <div className="h-8 w-px bg-white/[0.08]" />
        <div className="min-w-[160px] flex-1">
          <p className="text-[length:var(--fs-nano)] font-medium text-[#5a6d87]">
            {t("ws.toMilestone", { milestone: persona.nextMilestone })} {persona.milestoneProgress}%
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#67b8ff,#de7a2a)]"
              style={{ width: `${Math.min(100, persona.milestoneProgress)}%` }}
            />
          </div>
        </div>
      </section>

      {/* New-opportunity alert */}
      {pendingOpps.length > 0 ? (
        <Link
          className="flex items-center gap-3 rounded-[14px] border border-[#de402a]/25 bg-[#de402a]/[0.08] px-4 py-3 transition hover:border-[#de402a]/45"
          href={WORKSPACE_SPONSORSHIPS_PATH}
        >
          <span className="text-lg">📨</span>
          <span className="flex-1 text-[length:var(--fs-caption)]">
            <b className="font-bold text-white">{t("ws.oppAlert", { n: String(pendingOpps.length) })}</b>
            <span className="ml-1.5 text-[#93a2bb]">· {pendingOpps[0].sponsorName}</span>
          </span>
          <span className="shrink-0 text-[length:var(--fs-caption)] font-semibold text-[#f5b8ab]">{t("ws.oppAlertGo")}</span>
        </Link>
      ) : null}

      {/* NEXT card */}
      <section className="flex items-center gap-4 rounded-[16px] border border-white/[0.06] bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-4">
        <div className="text-3xl">🎬</div>
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.16em] text-[#f0a08f]">{t("ws.nextLabel")}</p>
          <p className="mt-1 text-[length:var(--fs-base)] font-bold text-white">{t("ws.nextTitle")}</p>
          <p className="mt-1 text-[length:var(--fs-micro)] text-[#93a2bb]">{t("ws.nextDesc")}</p>
        </div>
        <Link
          className="shrink-0 rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-5 py-2.5 text-[length:var(--fs-caption)] font-bold text-white shadow-[0_10px_24px_rgba(222,64,42,0.28)] transition hover:brightness-110"
          href={WORKSPACE_CONTENT_NEW_PATH}
        >
          {t("ws.postContent")}
        </Link>
      </section>

      {/* Stats row — real persona data */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label={t("ws.stat.momentum")} value={String(persona.momentum)} accent="#f5b8ab" />
        <StatTile label={t("ws.stat.views")} value={compactNumber(weeklyViews)} />
        <StatTile label={t("ws.stat.fans")} value={compactNumber(persona.fans)} />
        <StatTile label={t("ws.stat.backing")} value={`⚡ ${compactNumber(persona.spumpBacking)}`} />
      </section>

      {/* Recent content */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[length:var(--fs-base)] font-bold text-white">{t("ws.recentTitle")}</p>
          <Link className="text-[length:var(--fs-micro)] text-[#93a2bb] transition hover:text-white" href={WORKSPACE_PATH}>
            {t("ws.viewAll")}
          </Link>
        </div>
        <div className="space-y-2">
          {persona.contentItems.length === 0 ? (
            <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-6 text-center text-[length:var(--fs-overline)] text-[#7e90aa]">
              {t("ws.noContent")} ·{" "}
              <Link className="text-[#cbd6e7] underline-offset-4 hover:underline" href={WORKSPACE_CONTENT_NEW_PATH}>
                {t("ws.uploadFirst")}
              </Link>
            </div>
          ) : (
            [...persona.contentItems]
              .sort((a, b) => RECENT_PRIORITY[a.status] - RECENT_PRIORITY[b.status])
              .slice(0, 3)
              .map((item) => <RecentContentRow item={item} key={item.id} />)
          )}
        </div>
      </section>
    </div>
  );
};

const StatTile = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
    <p className="text-[length:var(--fs-nano)] font-medium uppercase tracking-[0.14em] text-[#5a6d87]">{label}</p>
    <p className="mt-1 text-xl font-extrabold tracking-[-0.03em]" style={{ color: accent ?? "#ffffff" }}>{value}</p>
  </div>
);

export const RecentContentRow = ({ item }: { item: WorkspaceContentItem }) => {
  const { t } = useI18n();
  const needsUpload = item.status === "DRAFT" || item.status === "UPLOADING";
  const eligible = ["READY", "ANCHORED", "PUBLISHED", "LOCKED"].includes(item.status);
  const cta = needsUpload
    ? { label: t("ws.continueUpload"), href: item.href ?? WORKSPACE_CONTENT_NEW_PATH, primary: true }
    : eligible
      ? { label: t("ws.useInCampaign"), href: WORKSPACE_SPONSORSHIPS_PATH, primary: true }
      : { label: t("ws.openItem"), href: item.href ?? "#", primary: false };

  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Link className="flex min-w-0 flex-1 items-center gap-3" href={item.href ?? "#"}>
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#0d1420]">
          <ProgressiveImage alt={item.title} className="h-full w-full object-cover" fill sizes="48px" src={item.coverSrc} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--fs-caption)] font-semibold text-white">{item.title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[length:var(--fs-nano)] font-semibold ${CONTENT_STATUS_TONE[item.status]}`}>
              {t(CONTENT_STATUS_KEY[item.status])}
            </span>
            <span className="truncate text-[length:var(--fs-micro)] text-[#7e90aa]">{item.updatedAtLabel}</span>
          </div>
        </div>
      </Link>
      <Link
        className={`flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-[length:var(--fs-micro)] font-semibold transition ${
          cta.primary
            ? "bg-[#de402a] text-white hover:bg-[#ea523e]"
            : "border border-white/[0.08] bg-white/[0.03] text-[#cbd6e7] hover:border-white/[0.16] hover:text-white"
        }`}
        href={cta.href}
      >
        {cta.label}
      </Link>
    </div>
  );
};

/* ────────────────────────────  Aside (Today reminders + preview)  ──────────────────────────── */

export const OverviewAside = ({ persona }: { persona: WorkspacePersona }) => {
  const { t } = useI18n();
  const sigPending = persona.sponsorshipItems.find((s) => s.actionOwner === "creator");
  const upload = persona.contentItems.find((c) => c.status === "UPLOADING" || c.status === "DRAFT");

  return (
    <section className="rounded-[18px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,21,32,0.86)_0%,rgba(10,15,23,0.86)_100%)]">
      <header className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.2em] text-[#6f8099]">{t("ws.todayTitle")}</p>
        <Link className="text-[length:var(--fs-micro)] text-[#cbd6e7] hover:text-white" href={WORKSPACE_SPONSORSHIPS_PATH}>
          {t("ws.openDesk")}
        </Link>
      </header>
      <div className="space-y-1 p-2">
        {sigPending ? (
          <AsideReminder dot="bg-[#ff8a78]" title={t("ws.remindSign")} subtitle={`${sigPending.manifestTitle} · ${sigPending.deadlineLabel}`} />
        ) : null}
        {upload ? (
          <AsideReminder dot="bg-[#8ad0ff]" title={t("ws.remindUpload")} subtitle={upload.title} />
        ) : null}
        {!sigPending && !upload ? (
          <AsideReminder dot="bg-[#65ecaf]" title={t("ws.remindClear")} subtitle={t("ws.remindClearSub")} />
        ) : null}
      </div>
    </section>
  );
};

const AsideReminder = ({ dot, title, subtitle }: { dot: string; title: string; subtitle: string }) => (
  <div className="flex items-start gap-2 rounded-xl px-2.5 py-2">
    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
    <div className="min-w-0">
      <p className="truncate text-[length:var(--fs-overline)] font-medium text-white">{title}</p>
      <p className="mt-0.5 truncate text-[length:var(--fs-micro)] text-[#7486a1]">{subtitle}</p>
    </div>
  </div>
);

/* ────────────────────────────  Console states  ──────────────────────────── */

export const ConsoleLoading = () => {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
        <p className="text-sm text-[#9aabc4]">{t("ws.console.loading")}</p>
      </div>
    </section>
  );
};

export const ConsoleAuthRequired = ({ loginHref }: { loginHref: string }) => {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-8">
      <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.2em] text-[#7486a1]">{t("ws.console.loginRequired")}</p>
      <h2 className="mt-2 text-lg font-semibold text-white">{t("ws.console.signInTitle")}</h2>
      <p className="mt-2 text-sm text-[#9aabc4]">{t("ws.console.signInDesc")}</p>
      <Link
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white"
        href={loginHref}
      >
        {t("ws.console.signIn")}
      </Link>
    </section>
  );
};

export const ConsoleError = ({ message, loginHref }: { message: string; loginHref?: string }) => {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-[#f67263]/25 bg-[#1a1115]/80 px-6 py-8">
      <p className="text-sm font-medium text-[#f67263]">{t("ws.console.loadFailed")}</p>
      <p className="mt-2 text-sm text-[#9aabc4]">{message}</p>
      {loginHref ? (
        <Link
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#de402a] px-5 py-2 text-sm font-semibold text-white"
          href={loginHref}
        >
          {t("ws.console.signInAgain")}
        </Link>
      ) : null}
    </section>
  );
};

export const ROUTES = { WORKSPACE_PATH };

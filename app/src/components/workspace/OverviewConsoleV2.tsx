import Link from "next/link";
import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  EarningsIcon,
  OverviewIcon,
  SignatureIcon,
  SparklesIcon,
  SponsorIcon,
  UploadIcon,
} from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import {
  CONTENT_TYPE_LABELS,
  MANIFEST_STATUS_LABELS,
  MANIFEST_STATUS_TONES,
} from "@/components/workspace/OverviewConsole";
import { WorkspaceActionItem, WorkspacePersona } from "@/lib/mocks/workspace";
import {
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_SPONSORSHIPS_PATH,
} from "@/lib/routes";

const actionIcons: Record<WorkspaceActionItem["iconName"], ReactNode> = {
  upload: <UploadIcon className="h-4 w-4" />,
  signature: <SignatureIcon className="h-4 w-4" />,
  sparkles: <SparklesIcon className="h-4 w-4" />,
  chevron: <ChevronRightIcon className="h-4 w-4" />,
};

const walletLabel = (wallet: string) => {
  if (!wallet) return "—";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
};

const actionPriority = (action: WorkspaceActionItem) => {
  if (action.iconName === "signature" && !action.disabled) return 0;
  if (action.tone === "urgent" && !action.disabled) return 1;
  if (action.iconName === "upload" && !action.disabled) return 2;
  if (action.workflowState === "ready" && !action.disabled) return 3;
  return 6;
};

const readyContentCount = (persona: WorkspacePersona) =>
  persona.contentItems.filter((item) => ["READY", "ANCHORED", "PUBLISHED"].includes(item.status)).length;

const pendingActionCount = (persona: WorkspacePersona) =>
  persona.sponsorshipItems.filter((item) => item.actionOwner === "creator" || item.actionOwner === "sponsor").length;

const activeCampaignCount = (persona: WorkspacePersona) =>
  persona.activeCampaigns ??
  persona.sponsorshipItems.filter((item) => ["SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(item.status)).length;

const claimableValue = (persona: WorkspacePersona) =>
  persona.stage === "S2_ACTIVE" ? "$1.2k" : "—";

export const OverviewConsoleV2 = ({ persona }: { persona: WorkspacePersona }) => {
  const actions = [...persona.actions].sort((a, b) => actionPriority(a) - actionPriority(b)).slice(0, 3);

  return (
    <div className="space-y-4 pb-6">
      <DailyHero persona={persona} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.72fr)]">
        <TodayActions actions={actions} />
        <SummaryPanel persona={persona} />
      </section>
      <StageProgressCompact persona={persona} />
      <RecentContent persona={persona} />
    </div>
  );
};

const DailyHero = ({ persona }: { persona: WorkspacePersona }) => (
  <section className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[radial-gradient(circle_at_12%_10%,rgba(222,64,42,0.18),transparent_34%),linear-gradient(135deg,rgba(16,22,33,0.98)_0%,rgba(7,11,18,0.98)_68%)] px-5 py-5 md:px-6 md:py-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 gap-4">
        <img
          alt={persona.displayName}
          className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/[0.1]"
          src={persona.avatarSrc}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StagePill compact stage={persona.stage} />
            <span className="rounded-full border border-[#65ecaf]/20 bg-[#0e1f17]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8df0c4]">
              Creator desk
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white md:text-[34px] md:leading-tight">
            今天先处理最重要的创作动作
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#9aabc4]">
            <span className="font-medium text-white">{persona.displayName}</span>
            <span>{persona.handle}</span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-[#cbd6e7]">
              {walletLabel(persona.wallet)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#de402a] px-4 text-sm font-semibold text-white shadow-[0_14px_42px_rgba(222,64,42,0.24)] transition hover:bg-[#ea523e]"
          href={WORKSPACE_CONTENT_NEW_PATH}
        >
          <UploadIcon className="h-4 w-4" />
          新建内容
        </Link>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-[#d7e1f0] transition hover:border-white/[0.14] hover:text-white"
          href={WORKSPACE_SPONSORSHIPS_PATH}
        >
          <SponsorIcon className="h-4 w-4" />
          处理合作
        </Link>
      </div>
    </div>
  </section>
);

const TodayActions = ({ actions }: { actions: WorkspaceActionItem[] }) => (
  <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.94)_0%,rgba(8,12,20,0.94)_100%)] p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Today</p>
        <h2 className="mt-1 text-lg font-semibold text-white">今日动作</h2>
      </div>
      <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#7e90aa]">
        {actions.length} queued
      </span>
    </div>
    <div className="space-y-2">
      {actions.map((action) => (
        <ActionRow action={action} key={`${action.title}-${action.ctaLabel}`} />
      ))}
    </div>
  </section>
);

const ActionRow = ({ action }: { action: WorkspaceActionItem }) => {
  const content = (
    <article
      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
        action.disabled
          ? "border-white/[0.04] bg-white/[0.02] opacity-70"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.13] hover:bg-white/[0.05]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          action.tone === "urgent"
            ? "bg-[#de402a]/18 text-[#ff8a78]"
            : action.workflowState === "ready"
              ? "bg-[#0e1f17] text-[#8df0c4]"
              : "bg-white/[0.05] text-[#cbd6e7]"
        }`}
      >
        {actionIcons[action.iconName]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{action.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#7e90aa]">{action.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`hidden rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] sm:inline-flex ${
            action.disabled
              ? "border-white/[0.06] text-[#5a6b82]"
              : action.tone === "urgent"
                ? "border-[#de402a]/25 bg-[#1f120e]/80 text-[#ff8a78]"
                : "border-[#65ecaf]/22 bg-[#0e1f17]/80 text-[#8df0c4]"
          }`}
        >
          {action.disabled ? "Waiting" : action.ctaLabel}
        </span>
        <ChevronRightIcon className={`h-4 w-4 ${action.disabled ? "text-[#3a4556]" : "text-[#7e90aa] group-hover:text-white"}`} />
      </div>
    </article>
  );

  if (action.disabled || !action.href) return content;
  return <Link href={action.href}>{content}</Link>;
};

const SummaryPanel = ({ persona }: { persona: WorkspacePersona }) => {
  const tiles = [
    {
      icon: <SponsorIcon className="h-4 w-4" />,
      label: "进行中合作",
      value: String(activeCampaignCount(persona)),
      hint: persona.stage === "S2_ACTIVE" ? "S2 pipeline" : "等待进入 S2",
      accent: "#67b8ff",
    },
    {
      icon: <SignatureIcon className="h-4 w-4" />,
      label: "待处理动作",
      value: String(pendingActionCount(persona)),
      hint: pendingActionCount(persona) > 0 ? "需要钱包确认" : "当前无阻塞",
      accent: "#f3b33e",
    },
    {
      icon: <EarningsIcon className="h-4 w-4" />,
      label: "可领取收益",
      value: claimableValue(persona),
      hint: "USDC + SPUMP",
      accent: "#ffb38a",
    },
    {
      icon: <OverviewIcon className="h-4 w-4" />,
      label: "内容就绪",
      value: String(readyContentCount(persona)),
      hint: `${persona.contentItems.length} total`,
      accent: "#65ecaf",
    },
  ];

  return (
    <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.94)_0%,rgba(8,12,20,0.94)_100%)] p-4">
      <div className="mb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Snapshot</p>
        <h2 className="mt-1 text-lg font-semibold text-white">合作与收益摘要</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-3" key={tile.label}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]" style={{ color: tile.accent }}>
                {tile.icon}
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tile.accent }} />
            </div>
            <p className="text-[10px] text-[#7e90aa]">{tile.label}</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-white">{tile.value}</p>
            <p className="mt-0.5 truncate text-[10px] text-[#6f8099]">{tile.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

type ProgressStatus = "done" | "current" | "pending";

const stepClass = (status: ProgressStatus) => {
  if (status === "done") return "border-[#65ecaf]/25 bg-[#0e1f17]/80 text-[#8df0c4]";
  if (status === "current") return "border-[#de402a]/28 bg-[#1f120e]/80 text-[#ff8a78]";
  return "border-white/[0.06] bg-white/[0.03] text-[#7e90aa]";
};

const buildCompactSteps = (persona: WorkspacePersona): Array<{ label: string; detail: string; status: ProgressStatus }> => {
  const ready = readyContentCount(persona);
  const termsLocked = persona.sponsorshipItems.some((item) =>
    ["TERMS_LOCKED", "BUNDLE_BUILT", "CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(item.status),
  );
  const signed = persona.sponsorshipItems.some((item) =>
    ["CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(item.status),
  );
  const submitted = persona.sponsorshipItems.some((item) => ["SUBMITTED", "CONFIRMED"].includes(item.status));

  return [
    {
      label: "内容准备",
      detail: ready > 0 ? `${ready} 个内容可用于合作` : "等待可用素材",
      status: ready > 0 ? "done" : "current",
    },
    {
      label: "合作条款",
      detail: termsLocked ? "条款已锁定" : "等待创建 intent",
      status: termsLocked ? "done" : ready > 0 ? "current" : "pending",
    },
    {
      label: "双方签名",
      detail: signed ? "已有签名进度" : "等待 bundle",
      status: signed ? "done" : termsLocked ? "current" : "pending",
    },
    {
      label: "结算领取",
      detail: submitted ? "等待 oracle / 领取" : "尚未提交链上",
      status: submitted ? "current" : "pending",
    },
  ];
};

const StageProgressCompact = ({ persona }: { persona: WorkspacePersona }) => (
  <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.9)_0%,rgba(8,12,20,0.9)_100%)] p-4">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Flow</p>
        <h2 className="mt-1 text-lg font-semibold text-white">S2 工作进度</h2>
      </div>
      <p className="text-[11px] text-[#7486a1]">内容准备 → 合作条款 → 双方签名 → 结算领取</p>
    </div>
    <div className="grid gap-2 md:grid-cols-4">
      {buildCompactSteps(persona).map((step, index) => (
        <div className={`rounded-2xl border p-3 ${stepClass(step.status)}`} key={step.label}>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-[11px] font-semibold">
              {index + 1}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] opacity-75">
              {step.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-white">{step.label}</p>
          <p className="mt-1 text-[11px] leading-relaxed opacity-75">{step.detail}</p>
        </div>
      ))}
    </div>
  </section>
);

const RecentContent = ({ persona }: { persona: WorkspacePersona }) => (
  <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.92)_0%,rgba(8,12,20,0.92)_100%)] p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f8099]">Assets</p>
        <h2 className="mt-1 text-lg font-semibold text-white">最近内容资产</h2>
      </div>
      <Link className="text-[12px] font-medium text-[#cbd6e7] hover:text-white" href={WORKSPACE_CONTENT_NEW_PATH}>
        新建内容
      </Link>
    </div>
    <div className="grid gap-2 md:grid-cols-3">
      {persona.contentItems.slice(0, 3).map((item) => {
        const campaignReady = ["READY", "LOCKED", "ANCHORED", "PUBLISHED"].includes(item.status);
        return (
          <Link
            className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] transition hover:border-white/[0.13] hover:bg-white/[0.045]"
            href={item.href ?? WORKSPACE_CONTENT_NEW_PATH}
            key={item.id}
          >
            <div className="relative aspect-[16/10] bg-[#0d1420]">
              <ProgressiveImage alt={item.title} className="object-cover" fill sizes="(max-width: 768px) 100vw, 280px" src={item.coverSrc} />
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${MANIFEST_STATUS_TONES[item.status]}`}>
                  {MANIFEST_STATUS_LABELS[item.status]}
                </span>
                <span className="text-[10px] text-[#6f8099]">{CONTENT_TYPE_LABELS[item.contentType]}</span>
              </div>
              <p className="line-clamp-2 min-h-[38px] text-sm font-semibold leading-snug text-white">{item.title}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[#7e90aa]">{item.assetCount} assets</span>
                <span className={campaignReady ? "text-[#8df0c4]" : "text-[#7e90aa]"}>
                  {campaignReady ? "可用于合作" : "处理中"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </section>
);

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { ChevronRightIcon, SignatureIcon, SparklesIcon, UploadIcon } from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { ActionCard } from "@/components/workspace/ActionCard";
import { HealthChecklist } from "@/components/workspace/PreviewPanel";
import { StatusDot } from "@/components/workspace/StatusDot";
import { StepProgress, StepItem } from "@/components/workspace/StepProgress";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import {
  ContentManifestStatus,
  ContentType,
  CreatorSeasonState,
  ProposalIntentStatus,
} from "@/lib/api/types";
import {
  WorkspaceOverviewResponse,
  getWorkspaceOverview,
} from "@/lib/api/workspace";
import { getStoredAuthSession } from "@/lib/auth-session";
import {
  MOCK_COVERS,
  CreatorStageProfile,
  WorkspaceActionItem,
  WorkspaceContentItem,
  WorkspacePersona,
  WorkspaceSponsorshipItem,
  workspacePersonas,
} from "@/lib/mocks/workspace";
import { shortenWallet } from "@/lib/formatting";
import { formatUsd } from "@/lib/public-data";
import {
  WORKSPACE_CONTENT_NEW_PATH,
  WORKSPACE_PATH,
  buildLoginHref,
} from "@/lib/routes";
import { clearAuthAndBuildLoginHref, isAuthError } from "@/lib/session-flow";

const MANIFEST_STATUS_LABELS: Record<ContentManifestStatus, string> = {
  DRAFT: "草稿",
  UPLOADING: "上传中",
  READY: "可发布",
  LOCKED: "已锁定",
  ANCHORED: "已锚定",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const MANIFEST_STATUS_TONES: Record<ContentManifestStatus, string> = {
  DRAFT: "border-[#7486a1]/30 bg-[#7486a1]/12 text-[#a8b6cc]",
  UPLOADING: "border-[#67b8ff]/30 bg-[#67b8ff]/12 text-[#8ad0ff]",
  READY: "border-[#65ecaf]/30 bg-[#65ecaf]/12 text-[#8df0c4]",
  LOCKED: "border-[#f3b33e]/30 bg-[#f3b33e]/12 text-[#f3c66e]",
  ANCHORED: "border-[#de402a]/30 bg-[#de402a]/12 text-[#ff8a78]",
  PUBLISHED: "border-[#65ecaf]/40 bg-[#65ecaf]/16 text-[#65ecaf]",
  ARCHIVED: "border-white/10 bg-white/5 text-[#8ea0ba]",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SHORT_VIDEO: "短视频",
  IMAGE_CAROUSEL: "图文笔记",
  MIXED_MEDIA_NOTE: "混合媒体",
};

const INTENT_STATUS_LABELS: Record<ProposalIntentStatus, string> = {
  DRAFT: "草案",
  TERMS_LOCKED: "条款锁定",
  BUNDLE_BUILT: "交易构建",
  CREATOR_PARTIALLY_SIGNED: "创作者已签",
  SPONSOR_SIGNED: "赞助商已签",
  SUBMITTED: "已提交",
  CONFIRMED: "已确认",
  FAILED: "失败",
  EXPIRED: "已过期",
};

const INTENT_STATUS_TONES: Record<ProposalIntentStatus, string> = {
  DRAFT: "border-[#7486a1]/30 bg-[#7486a1]/12 text-[#a8b6cc]",
  TERMS_LOCKED: "border-[#67b8ff]/30 bg-[#67b8ff]/12 text-[#8ad0ff]",
  BUNDLE_BUILT: "border-[#f3b33e]/30 bg-[#f3b33e]/12 text-[#f3c66e]",
  CREATOR_PARTIALLY_SIGNED: "border-[#65ecaf]/30 bg-[#65ecaf]/12 text-[#8df0c4]",
  SPONSOR_SIGNED: "border-[#65ecaf]/40 bg-[#65ecaf]/16 text-[#65ecaf]",
  SUBMITTED: "border-[#de402a]/30 bg-[#de402a]/12 text-[#ff8a78]",
  CONFIRMED: "border-[#de402a]/40 bg-[#de402a]/16 text-[#ff8a78]",
  FAILED: "border-[#f67263]/30 bg-[#f67263]/12 text-[#f67263]",
  EXPIRED: "border-white/10 bg-white/5 text-[#8ea0ba]",
};

type WorkspaceState =
  | { status: "loading" }
  | { status: "unauthenticated"; loginHref: string }
  | { status: "error"; message: string; loginHref?: string }
  | { status: "ready"; data: WorkspaceOverviewResponse };

const DEMO_STAGE: CreatorSeasonState = "S2_ACTIVE";
const STAGE_ORDER: CreatorSeasonState[] = ["S1_DISCOVERY", "S1_BUYOUT", "S2_ACTIVE"];

type WorkspaceMode = "demo" | "real";

type ResolvedWorkspaceView = {
  mode: WorkspaceMode;
  stage: CreatorSeasonState;
  persona: WorkspacePersona;
  showStageSwitcher: boolean;
};

const resolveWorkspaceStage = (wallet: string, data: WorkspaceOverviewResponse): CreatorSeasonState => {
  const personaMatch = STAGE_ORDER.find((stage) => workspacePersonas[stage].wallet === wallet);
  if (personaMatch) return personaMatch;

  const hasActiveProposal = data.proposals.some((proposal) =>
    ["OPEN", "FUNDED", "RESOLVED_SUCCESS"].includes(proposal.status),
  );
  const hasS2Intent = data.intents.some((intent) =>
    ["BUNDLE_BUILT", "CREATOR_PARTIALLY_SIGNED", "SPONSOR_SIGNED", "SUBMITTED", "CONFIRMED"].includes(intent.status),
  );
  if (hasActiveProposal || hasS2Intent) return "S2_ACTIVE";

  if (data.intents.length > 0) return "S1_BUYOUT";

  return "S1_DISCOVERY";
};

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

const buildContentItems = (data: WorkspaceOverviewResponse): WorkspaceContentItem[] =>
  data.manifests.map((manifest, index) => ({
    id: manifest.manifestId,
    title: manifest.title ?? "未命名内容",
    status: manifest.status,
    contentType: manifest.contentType,
    assetCount: manifest.assetCount,
    updatedAtLabel: formatUpdatedAt(manifest.updatedAt),
    coverSrc: MOCK_COVERS[index % MOCK_COVERS.length],
    href: `/workspace/content/${manifest.manifestId}`,
  }));

const buildSponsorshipItems = (data: WorkspaceOverviewResponse): WorkspaceSponsorshipItem[] =>
  data.intents.map((intent) => ({
    id: intent.intentId,
    creatorId: "current",
    creatorName: "当前创作者",
    sponsorName: intent.sponsorWallet ? `Sponsor ${shortenWallet(intent.sponsorWallet)}` : "待确认赞助商",
    status: intent.status,
    actionOwner: intent.needsAction
      ? intent.viewerRole === "SPONSOR" ? "sponsor" : "creator"
      : "system",
    track1BaseUsd: 0,
    track2PoolUsd: 0,
    track3PoolUsd: 0,
    metric: "Views",
    targetValue: "Pending",
    manifestTitle: intent.manifest?.title ?? "未绑定内容",
    deadlineLabel: intent.latestBundle ? `Bundle ${intent.latestBundle.status}` : formatUpdatedAt(intent.updatedAt),
    href: `/workspace/intents/${intent.intentId}`,
  }));

const buildActions = (
  stage: CreatorSeasonState,
  contentItems: WorkspaceContentItem[],
  sponsorshipItems: WorkspaceSponsorshipItem[],
): WorkspaceActionItem[] => {
  const uploadTarget = contentItems.find((item) => item.status === "DRAFT" || item.status === "UPLOADING");
  const signTarget = sponsorshipItems.find((item) => item.actionOwner === "creator" || item.actionOwner === "sponsor");
  const readyTarget = contentItems.find((item) => ["READY", "ANCHORED", "PUBLISHED"].includes(item.status));

  if (stage === "S1_DISCOVERY") {
    return [
      {
        iconName: "upload",
        title: "发布新内容",
        subtitle: contentItems.length > 0 ? "保持稳定发布节奏" : "创建第一条内容进入成长路径",
        ctaLabel: "新建内容",
        href: WORKSPACE_CONTENT_NEW_PATH,
      },
      {
        iconName: "sparkles",
        title: "优化标签",
        subtitle: "用清晰标签提高被发现概率",
        ctaLabel: "查看建议",
        tone: "info",
        disabled: true,
      },
      {
        iconName: "chevron",
        title: "互动回复",
        subtitle: "提升 momentum 和粉丝活跃",
        ctaLabel: "查看互动",
        disabled: true,
      },
    ];
  }

  if (stage === "S1_BUYOUT") {
    return [
      {
        iconName: "signature",
        title: signTarget ? "审核赞助 Offer" : "等待赞助 Offer",
        subtitle: signTarget ? `${signTarget.sponsorName} · ${signTarget.deadlineLabel}` : "收到 offer 后会在这里处理",
        ctaLabel: signTarget ? "处理 Offer" : "暂无操作",
        tone: signTarget ? "urgent" : "default",
        href: signTarget?.href,
        disabled: !signTarget,
      },
      {
        iconName: "upload",
        title: "准备赞助内容",
        subtitle: "提前上传素材，加速进入 S2",
        ctaLabel: "上传素材",
        href: uploadTarget?.href ?? WORKSPACE_CONTENT_NEW_PATH,
      },
      {
        iconName: "sparkles",
        title: "了解 Buyout",
        subtitle: "查看权益变化和后续流程",
        ctaLabel: "查看说明",
        disabled: true,
      },
    ];
  }

  return [
    {
      iconName: "upload",
      title: uploadTarget ? "上传素材" : "新建内容",
      subtitle: uploadTarget ? `${uploadTarget.title} · 待继续上传` : "创建下一条可赞助内容",
      ctaLabel: uploadTarget ? "上传素材" : "新建内容",
      href: uploadTarget?.href ?? WORKSPACE_CONTENT_NEW_PATH,
      tone: "info",
    },
    {
      iconName: "signature",
      title: signTarget ? "处理签名" : "暂无待签名",
      subtitle: signTarget ? `${signTarget.manifestTitle} · ${signTarget.deadlineLabel}` : "新的签名请求会显示在这里",
      ctaLabel: signTarget ? "前往签名" : "已同步",
      href: signTarget?.href,
      tone: signTarget ? "urgent" : "success",
      disabled: !signTarget,
    },
    {
      iconName: "sparkles",
      title: "创建赞助合作",
      subtitle: readyTarget ? `${readyTarget.title} 已可发起` : "内容 READY 后可发起 proposal",
      ctaLabel: readyTarget ? "创建合作" : "等待内容",
      href: readyTarget?.href,
      disabled: !readyTarget,
    },
  ];
};

const buildPersonaFromWorkspace = (data: WorkspaceOverviewResponse): WorkspacePersona => {
  const stage = resolveWorkspaceStage(data.wallet, data);
  const base = workspacePersonas[stage];
  const contentItems = buildContentItems(data);
  const sponsorshipItems = buildSponsorshipItems(data);
  const previewContent = contentItems[0];

  return {
    ...base,
    stage,
    wallet: data.wallet,
    displayName: "当前创作者",
    momentum: Math.max(base.momentum, 55 + contentItems.length * 7 + sponsorshipItems.length * 4),
    fans: base.fans,
    spumpBacking: base.spumpBacking,
    activeCampaigns: stage === "S2_ACTIVE" ? Math.max(base.activeCampaigns ?? 0, data.proposals.length) : base.activeCampaigns,
    actions: buildActions(stage, contentItems, sponsorshipItems),
    contentItems,
    sponsorshipItems,
    previewItem: previewContent
      ? {
          title: previewContent.title,
          subtitle: `${CONTENT_TYPE_LABELS[previewContent.contentType]} · ${previewContent.assetCount} 素材`,
          coverSrc: previewContent.coverSrc,
          statusLabel: MANIFEST_STATUS_LABELS[previewContent.status],
          tags: ["Workspace", "Content"],
          href: previewContent.href,
        }
      : {
          title: "准备第一条内容",
          subtitle: "创建内容后将在这里预览",
          coverSrc: MOCK_COVERS[0],
          statusLabel: "待创建",
          tags: ["Draft"],
          href: WORKSPACE_CONTENT_NEW_PATH,
        },
    healthItems: [
      { label: contentItems.length > 0 ? "内容就绪" : "等待内容", tone: contentItems.length > 0 ? "success" : "warning" },
      { label: sponsorshipItems.length > 0 ? "合作同步" : "暂无合作", tone: sponsorshipItems.length > 0 ? "processing" : "warning" },
      { label: data.proposals.length > 0 ? "链上记录" : "链上待创建", tone: data.proposals.length > 0 ? "success" : "processing" },
      { label: "Feed 可见", tone: contentItems.some((item) => item.status === "PUBLISHED") ? "success" : "processing" },
    ],
  };
};

const resolveWorkspaceView = (data: WorkspaceOverviewResponse): ResolvedWorkspaceView => {
  const persona = buildPersonaFromWorkspace(data);
  return {
    mode: "real",
    stage: persona.stage,
    persona,
    showStageSwitcher: false,
  };
};

export default function WorkspacePage() {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [activeStage, setActiveStage] = useState<CreatorSeasonState>(DEMO_STAGE);
  const isDemoMode = router.isReady && router.query.demo === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (isDemoMode) return;

    let isMounted = true;
    const session = getStoredAuthSession();

    if (!session) {
      setState({
        status: "unauthenticated",
        loginHref: buildLoginHref({ nextPath: WORKSPACE_PATH }),
      });
      return;
    }

    getWorkspaceOverview(session.accessToken)
      .then((data) => {
        if (isMounted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if (isAuthError(error)) {
          setState({
            status: "error",
            message: "会话已过期，请重新登录。",
            loginHref: clearAuthAndBuildLoginHref(WORKSPACE_PATH),
          });
          return;
        }
        const message = error instanceof Error ? error.message : "加载失败";
        setState({ status: "error", message });
      });

    return () => { isMounted = false; };
  }, [isDemoMode, router.isReady]);

  const demoView = useMemo<ResolvedWorkspaceView>(() => ({
    mode: "demo",
    stage: activeStage,
    persona: workspacePersonas[activeStage],
    showStageSwitcher: true,
  }), [activeStage]);

  const realView = useMemo<ResolvedWorkspaceView | null>(() => {
    if (state.status !== "ready") return null;
    return resolveWorkspaceView(state.data);
  }, [state]);

  const view = isDemoMode ? demoView : realView;
  const shellPersona = view?.persona ?? workspacePersonas[DEMO_STAGE];

  const rightPanel = (
    <div className="space-y-4">
      <ContentPreviewCard item={shellPersona.previewItem} />
      <PendingSignaturesCard items={shellPersona.sponsorshipItems} />
      <HealthChecklist items={shellPersona.healthItems} />
    </div>
  );

  return (
    <>
      <Head>
        <title>StreamPump | 创作中心</title>
      </Head>
      <WorkspaceShell
        aside={rightPanel}
        stage={shellPersona.stage}
        wallet={shellPersona.wallet}
      >
        {isDemoMode && (
          <OverviewDashboard
            activeStage={demoView.stage}
            onStageChange={setActiveStage}
            persona={demoView.persona}
            showStageSwitcher={demoView.showStageSwitcher}
          />
        )}
        {!isDemoMode && state.status === "loading" && <LoadingState />}
        {!isDemoMode && state.status === "unauthenticated" && <AuthRequired loginHref={state.loginHref} />}
        {!isDemoMode && state.status === "error" && <ErrorState message={state.message} loginHref={state.loginHref} />}
        {!isDemoMode && realView && (
          <OverviewDashboard
            activeStage={realView.stage}
            onStageChange={setActiveStage}
            persona={realView.persona}
            showStageSwitcher={realView.showStageSwitcher}
          />
        )}
      </WorkspaceShell>
    </>
  );
}

/* ── Stage Card ──────────────────────────────────────────────── */

const StageCard = ({
  profile,
  activeStage,
  onStageChange,
  showStageSwitcher,
}: {
  profile: CreatorStageProfile;
  activeStage: CreatorSeasonState;
  onStageChange: (stage: CreatorSeasonState) => void;
  showStageSwitcher: boolean;
}) => {
  return (
    <section className="liquid-glass-shell hero-glow card-radius overflow-hidden">
      {/* Stage switcher tabs (for demo/preview) */}
      {showStageSwitcher && (
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-5 pt-4 pb-0">
          {STAGE_ORDER.map((s) => (
            <button
              className={`relative rounded-t-xl px-4 py-2 text-xs font-medium transition ${
                activeStage === s ? "bg-white/[0.06] text-white" : "text-[#6b7d96] hover:text-white"
              }`}
              key={s}
              onClick={() => onStageChange(s)}
              type="button"
            >
              <StagePill compact stage={s} />
              {activeStage === s && (
                <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#de402a]" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              alt={profile.displayName}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/[0.1]"
              src={profile.avatarSrc}
            />
            <div>
              <p className="text-base font-semibold text-white">{profile.displayName}</p>
              <p className="text-xs text-[#8ea0ba]">{profile.wallet}</p>
            </div>
          </div>
          <StagePill stage={profile.stage} />
        </div>

        {/* Metrics row */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCell label="Momentum" value={String(profile.momentum)} />
          <MetricCell label="粉丝" value={profile.fans >= 10000 ? `${(profile.fans / 10000).toFixed(1)}万` : String(profile.fans)} />
          <MetricCell label="SPUMP 支持" value={profile.spumpBacking >= 10000 ? `${(profile.spumpBacking / 10000).toFixed(1)}万` : String(profile.spumpBacking)} />
          {profile.stage === "S2_ACTIVE" && profile.totalEarningsUsd != null ? (
            <MetricCell label="累计收益" value={formatUsd(profile.totalEarningsUsd)} accent />
          ) : (
            <MetricCell label="下一里程碑" value={profile.nextMilestone} />
          )}
        </div>

        {/* Stage-specific progress */}
        {profile.stage === "S1_DISCOVERY" && <DiscoveryGrowthPath progress={profile.milestoneProgress} />}
        {profile.stage === "S1_BUYOUT" && <BuyoutProgressBar progress={profile.buyoutProgress ?? 0} />}
        {profile.stage === "S2_ACTIVE" && <S2LaunchProgress />}
      </div>
    </section>
  );
};

const MetricCell = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7d96]">{label}</p>
    <p className={`mt-1 text-lg font-semibold tracking-[-0.02em] ${accent ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>
);

/* ── S1 Discovery ──────────────────────────────────────────── */

const DiscoveryGrowthPath = ({ progress }: { progress: number }) => {
  const steps: StepItem[] = [
    { label: "内容发布", status: progress > 20 ? "done" : "current" },
    { label: "粉丝互动", status: progress > 40 ? "done" : progress > 20 ? "current" : "pending" },
    { label: "赞助商关注", status: progress > 60 ? "done" : progress > 40 ? "current" : "pending" },
    { label: "Buyout 候选", status: progress > 80 ? "done" : progress > 60 ? "current" : "pending" },
  ];

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-[#7486a1]">成长路径</p>
        <p className="text-xs font-medium text-[#65ecaf]">{progress}%</p>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#de402a] to-[#ff8a78] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <StepProgress className="mt-4" compact steps={steps} />
    </div>
  );
};

/* ── S1 Buyout ─────────────────────────────────────────────── */

const BuyoutProgressBar = ({ progress }: { progress: number }) => {
  const steps: StepItem[] = [
    { label: "发现期", status: "done" },
    { label: "收到 Offer", status: progress >= 1 ? "done" : "pending" },
    { label: "审核条款", status: progress >= 2 ? "done" : progress >= 1 ? "current" : "pending" },
    { label: "接受/拒绝", status: progress >= 3 ? "done" : progress >= 2 ? "current" : "pending" },
    { label: "升级至 S2", status: progress >= 4 ? "done" : progress >= 3 ? "current" : "pending" },
  ];

  return (
    <div className="mt-5">
      <p className="mb-3 text-[11px] text-[#7486a1]">Buyout 进程</p>
      <StepProgress steps={steps} />
    </div>
  );
};

/* ── S2 Launch Progress ────────────────────────────────────── */

const S2LaunchProgress = () => {
  const steps: StepItem[] = [
    { label: "草稿", status: "done" },
    { label: "上传", status: "done" },
    { label: "完善", status: "done" },
    { label: "发布", status: "done" },
    { label: "赞助条款", status: "current" },
    { label: "创作者签", status: "pending" },
    { label: "赞助商签", status: "pending" },
    { label: "链上确认", status: "pending" },
  ];

  return (
    <div className="mt-5">
      <p className="mb-3 text-[11px] text-[#7486a1]">S2 发布进程</p>
      <StepProgress steps={steps} />
    </div>
  );
};

/* ── Next Actions ──────────────────────────────────────────── */

const ACTION_ICONS: Record<WorkspaceActionItem["iconName"], React.ReactNode> = {
  upload: <UploadIcon className="h-4 w-4" />,
  signature: <SignatureIcon className="h-4 w-4" />,
  sparkles: <SparklesIcon className="h-4 w-4" />,
  chevron: <ChevronRightIcon className="h-4 w-4" />,
};

const NextActionsSection = ({ persona }: { persona: WorkspacePersona }) => (
  <section>
    <SectionLabel>{persona.stage === "S1_DISCOVERY" ? "推荐下一步" : persona.stage === "S1_BUYOUT" ? "待处理" : "下一步行动"}</SectionLabel>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      {persona.actions.map((action) => (
        <ActionCard
          ctaHref={action.href}
          ctaLabel={action.ctaLabel}
          disabled={action.disabled}
          icon={ACTION_ICONS[action.iconName]}
          key={`${action.title}-${action.ctaLabel}`}
          subtitle={action.subtitle}
          title={action.title}
          tone={action.tone}
        />
      ))}
    </div>
  </section>
);

/* ── Content Pipeline ──────────────────────────────────────── */

const ContentPipeline = ({ persona }: { persona: WorkspacePersona }) => (
  <section>
    <div className="flex items-center justify-between">
      <SectionLabel>内容动态</SectionLabel>
      <Link className="text-xs text-[#8ea0ba] transition hover:text-white" href={WORKSPACE_CONTENT_NEW_PATH}>
        查看全部
      </Link>
    </div>
    <div className="mt-3 space-y-2.5">
      {persona.contentItems.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm text-[#8ea0ba]">
          暂无内容，创建第一条内容后会出现在这里。
        </div>
      )}
      {persona.contentItems.map((manifest) => {
        const row = (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.05]">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#0d1420]">
              <ProgressiveImage
                alt={manifest.title}
                className="h-full w-full object-cover"
                fill
                sizes="48px"
                src={manifest.coverSrc}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-white">{manifest.title}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${MANIFEST_STATUS_TONES[manifest.status]}`}>
                  {MANIFEST_STATUS_LABELS[manifest.status]}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#6b7d96]">
                {CONTENT_TYPE_LABELS[manifest.contentType]} · {manifest.assetCount} 素材 · {manifest.updatedAtLabel}
              </p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#4a5568]" />
          </div>
        );

        return manifest.href ? (
          <Link className="block" href={manifest.href} key={manifest.id}>
            {row}
          </Link>
        ) : (
          <div key={manifest.id}>{row}</div>
        );
      })}
    </div>
  </section>
);

/* ── Sponsorship Pipeline ──────────────────────────────────── */

const SponsorshipPipeline = ({ persona }: { persona: WorkspacePersona }) => {
  if (persona.stage === "S1_DISCOVERY") {
    return (
      <section>
        <SectionLabel>赞助商动向</SectionLabel>
        <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
          <p className="text-sm text-[#8ea0ba]">持续创作优质内容，赞助商正在关注你</p>
          <div className="mx-auto mt-4 flex max-w-[320px] items-center justify-between">
            {["内容发布", "被发现", "收到 Offer"].map((step, i) => (
              <div className="flex items-center gap-2" key={step}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${i === 0 ? "bg-[#de402a] text-white" : "bg-white/[0.06] text-[#5a6b82]"}`}>
                  {i + 1}
                </span>
                <span className="text-[11px] text-[#8ea0ba]">{step}</span>
                {i < 2 && <div className="mx-1 h-px w-6 bg-white/[0.08]" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (persona.stage === "S1_BUYOUT") {
    const offer = persona.sponsorshipItems[0];

    return (
      <section>
        <SectionLabel>赞助 Offer</SectionLabel>
        <div className="mt-3 space-y-2.5">
          <div className="rounded-2xl border border-[#f3b33e]/20 bg-[linear-gradient(180deg,rgba(77,49,20,0.12)_0%,rgba(18,21,32,0.7)_100%)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3b33e]/15 text-sm font-bold text-[#f3b33e]">
                  {(offer?.sponsorName ?? "S").slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{offer?.sponsorName ?? "等待赞助商"}</p>
                  <p className="text-[11px] text-[#8ea0ba]">
                    {persona.buyoutOffer ? `${formatUsd(persona.buyoutOffer.budgetUsd)} · ${persona.buyoutOffer.deadline} 截止` : "Offer 会在这里出现"}
                  </p>
                </div>
              </div>
              <span className="animate-pulse rounded-full bg-[#f3b33e] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1a1108]">
                {persona.buyoutOffer?.status ?? "待出现"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniMetric label="基础报酬" value={formatUsd(offer?.track1BaseUsd ?? 0)} />
              <MiniMetric label="绩效预算" value={formatUsd(offer?.track2PoolUsd ?? 0)} />
              <MiniMetric label="延迟结算" value={formatUsd(offer?.track3PoolUsd ?? 0)} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel>赞助合作</SectionLabel>
        <Link className="text-xs text-[#8ea0ba] transition hover:text-white" href="/workspace#intents">
          查看全部
        </Link>
      </div>
      <div className="mt-3 space-y-2.5">
        {persona.sponsorshipItems.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm text-[#8ea0ba]">
            暂无赞助合作，内容 READY 后可发起 proposal。
          </div>
        )}
        {persona.sponsorshipItems.slice(0, 3).map((intent) => {
          const row = (
            <div className={`flex items-center gap-3 rounded-2xl border p-3 transition hover:border-white/[0.12] ${
              intent.actionOwner === "creator" ? "border-[#f3b33e]/20 bg-[#f3b33e]/[0.03]" : "border-white/[0.06] bg-white/[0.03]"
            }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{intent.manifestTitle}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${INTENT_STATUS_TONES[intent.status]}`}>
                    {INTENT_STATUS_LABELS[intent.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#6b7d96]">
                  {intent.sponsorName} · {intent.deadlineLabel}
                </p>
              </div>
              {intent.actionOwner === "creator" && (
                <StatusDot tone="warning" pulse size="sm" />
              )}
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#4a5568]" />
            </div>
          );

          return intent.href ? (
            <Link className="block" href={intent.href} key={intent.id}>
              {row}
            </Link>
          ) : (
            <div key={intent.id}>{row}</div>
          );
        })}
      </div>
    </section>
  );
};

/* ── Analytics Preview ─────────────────────────────────────── */

const AnalyticsPreview = ({ profile }: { profile: CreatorStageProfile }) => (
  <section>
    <SectionLabel>数据概览</SectionLabel>
    <div className="mt-3 liquid-card card-radius p-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniMetric label="浏览量" value={profile.fans >= 10000 ? `${(profile.fans * 6.2 / 10000).toFixed(0)}万` : String(Math.floor(profile.fans * 6.2))} />
        <MiniMetric label="收藏" value={String(Math.floor(profile.fans * 0.8))} />
        <MiniMetric label={profile.stage === "S2_ACTIVE" ? "活跃 Campaign" : "赞助商关注"} value={profile.activeCampaigns != null ? String(profile.activeCampaigns) : String(Math.floor(profile.momentum / 20))} accent />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.04] bg-[#0b1016] p-2">
        <SparklineChart
          className="h-[72px] w-full"
          color="#65ecaf"
          fillColor="rgba(101,236,175,0.1)"
          height={72}
          points={profile.viewsTrend}
          strokeWidth={1.5}
          width={400}
        />
      </div>
      <p className="mt-2 text-[10px] text-[#5a6b82]">最近 8 期影响力趋势</p>
    </div>
  </section>
);

/* ── Right Panel Cards ─────────────────────────────────────── */

const ContentPreviewCard = ({ item }: { item: WorkspacePersona["previewItem"] }) => (
  <div className="liquid-card card-radius overflow-hidden">
    <div className="relative aspect-video">
      <ProgressiveImage
        alt={item.title}
        className="h-full w-full object-cover"
        fill
        sizes="280px"
        src={item.coverSrc}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(8,17,28,0.7)_100%)]" />
      <span className="absolute right-2 top-2 rounded-full border border-[#65ecaf]/30 bg-[#65ecaf]/12 px-2 py-0.5 text-[9px] font-semibold uppercase text-[#65ecaf]">
        {item.statusLabel}
      </span>
    </div>
    <div className="p-3.5">
      <p className="text-sm font-medium text-white">{item.title}</p>
      <p className="mt-1 text-[11px] text-[#6b7d96]">{item.subtitle}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.tags.map((t) => (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-[#7486a1]" key={t}>#{t}</span>
        ))}
      </div>
    </div>
  </div>
);

const PendingSignaturesCard = ({ items }: { items: WorkspaceSponsorshipItem[] }) => {
  const pendingItems = items.filter((item) => item.actionOwner === "creator" || item.actionOwner === "sponsor").slice(0, 2);

  return (
  <div className="liquid-card card-radius p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">待签名</p>
    <div className="mt-3 space-y-2">
      {pendingItems.length === 0 && (
        <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-[#6b7d96]">暂无待签名事项</p>
      )}
      {pendingItems.map((item) => {
        const row = (
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.07]">
            <StatusDot tone="warning" pulse size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{item.manifestTitle}</p>
              <p className="text-[10px] text-[#5a6b82]">
                {item.actionOwner === "sponsor" ? "等待赞助商签名" : "等待创作者签名"}
              </p>
            </div>
            <SignatureIcon className="h-3.5 w-3.5 text-[#f3b33e]" />
          </div>
        );

        return item.href ? (
          <Link className="block" href={item.href} key={item.id}>
            {row}
          </Link>
        ) : (
          <div key={item.id}>{row}</div>
        );
      })}
    </div>
  </div>
  );
};

/* ── Layout States ─────────────────────────────────────────── */

const LoadingState = () => (
  <section className="liquid-card card-radius flex items-center gap-3 px-6 py-8">
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#de402a] border-t-transparent" />
    <p className="text-sm text-[#8ea0ba]">加载工作台数据...</p>
  </section>
);

const AuthRequired = ({ loginHref }: { loginHref: string }) => (
  <section className="liquid-card card-radius px-6 py-8">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#7486a1]">需要登录</p>
    <h2 className="mt-2 text-lg font-semibold text-white">登录后查看工作台</h2>
    <p className="mt-2 text-sm text-[#8ea0ba]">连接钱包以查看你的内容、合作和收益数据。</p>
    <Link className="glass-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold" href={loginHref}>
      登录
    </Link>
  </section>
);

const ErrorState = ({ message, loginHref }: { message: string; loginHref?: string }) => (
  <section className="liquid-card card-radius px-6 py-8">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#f67263]">加载失败</p>
    <h2 className="mt-2 text-lg font-semibold text-white">无法加载工作台数据</h2>
    <p className="mt-2 text-sm text-[#8ea0ba]">{message}</p>
    {loginHref && (
      <Link className="glass-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold" href={loginHref}>
        重新登录
      </Link>
    )}
  </section>
);

/* ── Full Dashboard (with real data) ─────────────────────── */

const OverviewDashboard = ({
  activeStage,
  onStageChange,
  persona,
  showStageSwitcher,
}: {
  activeStage: CreatorSeasonState;
  onStageChange: (s: CreatorSeasonState) => void;
  persona: WorkspacePersona;
  showStageSwitcher: boolean;
}) => {
  return (
    <div className="space-y-6">
      <StageCard activeStage={activeStage} onStageChange={onStageChange} profile={persona} showStageSwitcher={showStageSwitcher} />
      <NextActionsSection persona={persona} />
      <ContentPipeline persona={persona} />
      <SponsorshipPipeline persona={persona} />
      <AnalyticsPreview profile={persona} />
    </div>
  );
};

/* ── Helpers ───────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{children}</p>
);

const MiniMetric = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
    <p className="text-[9px] uppercase tracking-[0.14em] text-[#5a6b82]">{label}</p>
    <p className={`mt-0.5 text-sm font-semibold ${accent ? "text-[#de402a]" : "text-white"}`}>{value}</p>
  </div>
);

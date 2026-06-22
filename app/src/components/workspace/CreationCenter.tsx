import Link from "next/link";
import { useState } from "react";

import {
  ChevronRightIcon,
  ClockIcon,
  SendRoundedIcon,
  TrendUpIcon,
} from "@/components/shared/AppIcons";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { SparklineChart } from "@/components/shared/SparklineChart";
import {
  ContentManifestStatus,
  ContentType,
  IntentRecord,
  ManifestRecord,
  ProposalIntentStatus,
} from "@/lib/api/types";
import { manifests, intents } from "@/lib/mocks/workspace";
import { formatUsd } from "@/lib/public-data";

type CreationTab = "drafts" | "collaborations" | "compose";

const STATUS_LABELS: Record<ContentManifestStatus, string> = {
  DRAFT: "草稿",
  UPLOADING: "上传中",
  READY: "待发布",
  LOCKED: "已锁定",
  ANCHORED: "已锚定",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

// Mapped onto shared semantic tones by hue: gray→neutral, blue→info,
// green→success, amber→warning, on-chain coral→stage-buyout.
const STATUS_TONES: Record<ContentManifestStatus, string> = {
  DRAFT: "tone-state-neutral",
  UPLOADING: "tone-state-info",
  READY: "tone-state-success",
  LOCKED: "tone-state-warning",
  ANCHORED: "tone-stage-buyout",
  PUBLISHED: "tone-state-success",
  ARCHIVED: "tone-state-neutral",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SHORT_VIDEO: "短视频",
  IMAGE_CAROUSEL: "图文笔记",
  MIXED_MEDIA_NOTE: "混合媒体",
};

const INTENT_STATUS_LABELS: Record<ProposalIntentStatus, string> = {
  DRAFT: "草案阶段",
  TERMS_LOCKED: "条款已锁定",
  BUNDLE_BUILT: "交易已构建",
  CREATOR_PARTIALLY_SIGNED: "等待赞助商签名",
  SPONSOR_SIGNED: "赞助商已签名",
  SUBMITTED: "已提交",
  CONFIRMED: "已确认",
  FAILED: "失败",
  EXPIRED: "已过期",
};

const INTENT_STATUS_TONES: Record<ProposalIntentStatus, string> = {
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

const MOCK_COVERS = [
  "/mock/user-surface/posts/singer-911.svg",
  "/mock/user-surface/posts/project-helix.svg",
  "/mock/user-surface/posts/tamburins-red.svg",
];

const DASHBOARD_STATS = {
  totalViews: 284600,
  totalInteractions: 42300,
  activeCollaborations: 2,
  pendingActions: 1,
  spumpEarned: 1240,
  exposureTrend: [420, 680, 550, 780, 950, 1100, 890, 1240],
};

export const CreationCenter = () => {
  const [activeTab, setActiveTab] = useState<CreationTab>("drafts");

  const tabs: { id: CreationTab; label: string }[] = [
    { id: "drafts", label: "我的创作" },
    { id: "collaborations", label: "合作管理" },
    { id: "compose", label: "新建内容" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-white/[0.06] pb-1">
        {tabs.map((tab) => (
          <button
            className={`relative pb-4 text-sm font-medium transition ${
              activeTab === tab.id ? "text-white" : "text-[#8394ad] hover:text-white"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {activeTab === tab.id ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#de402a]" />
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "drafts" ? <DraftsView /> : null}
      {activeTab === "collaborations" ? <CollaborationsView /> : null}
      {activeTab === "compose" ? <ComposeView /> : null}
    </div>
  );
};

const DraftsView = () => (
  <div className="section-enter grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">内容管理</h2>
          <p className="mt-1 text-sm text-[#8ea0ba]">管理你的内容草稿、上传进度和发布状态</p>
        </div>
        <Link
          className="glass-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          href="/workspace/content/new"
        >
          <span>+</span>
          <span>创建内容</span>
        </Link>
      </div>

      <div className="space-y-3">
        {manifests.map((manifest, index) => (
          <DraftCard key={manifest.id} manifest={manifest} coverIndex={index} />
        ))}
      </div>

      {manifests.length === 0 ? (
        <div className="liquid-glass-shell card-radius px-6 py-10 text-center">
          <p className="text-lg font-semibold text-white">开始你的第一个创作</p>
          <p className="mx-auto mt-3 max-w-[360px] text-sm leading-7 text-[#8ea0ba]">
            创建图文笔记、短视频或混合媒体内容，让赞助商发现你的创意价值。
          </p>
          <Link
            className="glass-button-primary mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold"
            href="/workspace/content/new"
          >
            + 创建内容
          </Link>
        </div>
      ) : null}
    </div>

    <div className="space-y-4">
      <DashboardCard />
      <PendingActionsCard />
    </div>
  </div>
);

const DraftCard = ({
  manifest,
  coverIndex,
}: {
  manifest: ManifestRecord;
  coverIndex: number;
}) => {
  const coverSrc = MOCK_COVERS[coverIndex % MOCK_COVERS.length];

  return (
    <Link
      className="block transition duration-200"
      href={`/workspace/content/${manifest.id}`}
    >
      <div className="glass-card card-radius flex gap-4 p-4">
        <div className="relative h-[88px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-[#0d1420]">
          <ProgressiveImage
            alt={manifest.title}
            className="h-full w-full object-cover"
            fill
            sizes="72px"
            src={coverSrc}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(8,17,28,0.5)_100%)]" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[length:var(--fs-sm)] font-medium text-white">{manifest.title}</h3>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em] ${STATUS_TONES[manifest.status]}`}>
                {STATUS_LABELS[manifest.status]}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[#8ea0ba]">
              {CONTENT_TYPE_LABELS[manifest.contentType]} · {manifest.assetCount} 个素材
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[length:var(--fs-micro)] text-[#7486a1]">{manifest.updatedAtLabel}</span>
            <ChevronRightIcon className="h-4 w-4 text-[#7486a1]" />
          </div>
        </div>
      </div>
    </Link>
  );
};

const DashboardCard = () => {
  const tone = "positive";
  const trendColor = tone === "positive" ? "#65ecaf" : "#f67263";
  const trendFill = tone === "positive" ? "rgba(101,236,175,0.14)" : "rgba(246,114,99,0.14)";

  return (
    <div className="liquid-glass-shell hero-glow card-radius p-5">
      <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.22em] text-[#7486a1]">创作数据</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCell label="总浏览" value={compactCreatorNumber(DASHBOARD_STATS.totalViews)} />
        <StatCell label="总互动" value={compactCreatorNumber(DASHBOARD_STATS.totalInteractions)} />
        <StatCell label="活跃合作" value={String(DASHBOARD_STATS.activeCollaborations)} accent />
        <StatCell label="SPUMP 收入" value={compactCreatorNumber(DASHBOARD_STATS.spumpEarned)} />
      </div>

      <div className="liquid-card card-radius mt-4 overflow-hidden p-3">
        <SparklineChart
          className="h-[100px] w-full"
          color={trendColor}
          fillColor={trendFill}
          height={100}
          points={DASHBOARD_STATS.exposureTrend}
          strokeWidth={2}
          width={280}
        />
      </div>

      <p className="mt-3 text-xs text-[#7486a1]">最近 8 期的影响力趋势</p>
    </div>
  );
};

const StatCell = ({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
    <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#73849e]">{label}</p>
    <p className={`mt-1.5 text-xl font-semibold tracking-[-0.03em] ${accent ? "text-[#de402a]" : "text-white"}`}>
      {value}
    </p>
  </div>
);

const PendingActionsCard = () => {
  const actionableIntents = intents.filter((intent) => intent.actionOwner === "creator");

  if (actionableIntents.length === 0) {
    return (
      <div className="liquid-card card-radius px-5 py-4">
        <div className="flex items-center gap-2 text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">
          <ClockIcon className="h-3.5 w-3.5" />
          待处理
        </div>
        <p className="mt-3 text-sm text-[#8ea0ba]">暂无需要你操作的合作提案</p>
      </div>
    );
  }

  return (
    <div className="card-radius border border-[#8d6120]/34 bg-[linear-gradient(180deg,rgba(77,49,20,0.2)_0%,rgba(18,21,32,0.9)_100%)] p-5">
      <div className="flex items-center gap-2 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#f3b33e]">
        <ClockIcon className="h-3.5 w-3.5" />
        需要你的操作
      </div>

      <div className="mt-4 space-y-3">
        {actionableIntents.map((intent) => (
          <Link
            className="block rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
            href={`/workspace/intents/${intent.id}`}
            key={intent.id}
          >
            <p className="text-sm font-medium text-white">{intent.manifestTitle}</p>
            <p className="mt-1 text-xs text-[#8ea0ba]">
              {intent.sponsorName} · {intent.deadlineLabel}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

const CollaborationsView = () => (
  <div className="section-enter space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-white">合作提案</h2>
      <p className="mt-1 text-sm text-[#8ea0ba]">赞助商发起的合作意向和进行中的 campaign</p>
    </div>

    <div className="space-y-4">
      {intents.map((intent) => (
        <CollaborationCard key={intent.id} intent={intent} />
      ))}
    </div>

    {intents.length === 0 ? (
      <div className="liquid-glass-shell card-radius px-6 py-10 text-center">
        <p className="text-lg font-semibold text-white">暂无合作提案</p>
        <p className="mx-auto mt-3 max-w-[400px] text-sm leading-7 text-[#8ea0ba]">
          当赞助商对你的内容感兴趣时，合作提案会出现在这里。持续创作优质内容来吸引赞助商关注。
        </p>
      </div>
    ) : null}
  </div>
);

const CollaborationCard = ({ intent }: { intent: IntentRecord }) => {
  const totalBudget = intent.track1BaseUsd + intent.track2PoolUsd + intent.track3PoolUsd;
  const isActionable = intent.actionOwner === "creator";

  return (
    <Link
      className="block transition duration-200"
      href={`/workspace/intents/${intent.id}`}
    >
      <div className={`glass-card card-radius p-5 ${isActionable ? "ring-1 ring-[#f3b33e]/20" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white">{intent.manifestTitle}</h3>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.12em] ${INTENT_STATUS_TONES[intent.status]}`}>
                {INTENT_STATUS_LABELS[intent.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#8ea0ba]">
              {intent.sponsorName} × {intent.creatorName}
            </p>
          </div>
          {isActionable ? (
            <span className="shrink-0 animate-pulse rounded-full bg-[#f3b33e] px-3 py-1 text-[length:var(--fs-micro)] font-bold uppercase tracking-[0.16em] text-[#1a1108]">
              需要操作
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <BudgetCell label="基础报酬" value={formatUsd(intent.track1BaseUsd)} sublabel="Track 1" />
          <BudgetCell label="绩效预算" value={formatUsd(intent.track2PoolUsd)} sublabel="Track 2" />
          <BudgetCell label="延迟结算" value={formatUsd(intent.track3PoolUsd)} sublabel="Track 3" />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-4">
          <div className="flex items-center gap-4 text-xs text-[#8ea0ba]">
            <span>目标: {intent.metric} {intent.targetValue}</span>
            <span>·</span>
            <span>总预算 {formatUsd(totalBudget)}</span>
          </div>
          <span className="text-xs text-[#7486a1]">{intent.deadlineLabel}</span>
        </div>
      </div>
    </Link>
  );
};

const BudgetCell = ({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
    <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#73849e]">{label}</p>
    <p className="mt-1.5 text-base font-semibold text-white">{value}</p>
    <p className="mt-1 text-[length:var(--fs-micro)] text-[#7486a1]">{sublabel}</p>
  </div>
);

const ComposeView = () => {
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const tags = tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const typeOptions: { type: ContentType; label: string; description: string; icon: string }[] = [
    {
      type: "IMAGE_CAROUSEL",
      label: "图文笔记",
      description: "分享产品体验、日常穿搭、美食推荐",
      icon: "🖼",
    },
    {
      type: "SHORT_VIDEO",
      label: "短视频",
      description: "Vlog、教程、开箱、剪辑作品",
      icon: "🎬",
    },
    {
      type: "MIXED_MEDIA_NOTE",
      label: "混合媒体",
      description: "图文 + 视频的组合表达形式",
      icon: "✦",
    },
  ];

  return (
    <div className="section-enter mx-auto max-w-[820px] space-y-6">
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                step === s
                  ? "bg-[#de402a] text-white shadow-[0_8px_20px_rgba(222,64,42,0.3)]"
                  : step > s
                    ? "bg-[#65ecaf]/20 text-[#65ecaf]"
                    : "bg-white/[0.06] text-[#7486a1]"
              }`}
            >
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs ${step === s ? "text-white" : "text-[#7486a1]"}`}>
              {s === 1 ? "选择类型" : s === 2 ? "编辑内容" : "发布设置"}
            </span>
            {s < 3 ? <div className="mx-2 h-px w-8 bg-white/[0.08]" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">选择内容类型</h2>
            <p className="mt-1 text-sm text-[#8ea0ba]">不同类型会影响展示方式和赞助商匹配</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {typeOptions.map((option) => (
              <button
                className={`card-radius border p-5 text-left transition ${
                  contentType === option.type
                    ? "border-[#de402a]/40 bg-[#de402a]/8 shadow-[0_0_24px_rgba(222,64,42,0.1)]"
                    : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]"
                }`}
                key={option.type}
                onClick={() => setContentType(option.type)}
                type="button"
              >
                <span className="text-2xl">{option.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-white">{option.label}</h3>
                <p className="mt-2 text-xs leading-5 text-[#8ea0ba]">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              className="glass-button-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-40"
              disabled={!contentType}
              onClick={() => setStep(2)}
              type="button"
            >
              下一步
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">编辑内容</h2>
              <p className="mt-1 text-sm text-[#8ea0ba]">
                {contentType ? CONTENT_TYPE_LABELS[contentType] : ""}
              </p>
            </div>
            <button
              className="glass-button-ghost px-4 py-2 text-xs"
              onClick={() => setStep(1)}
              type="button"
            >
              返回
            </button>
          </div>

          <div className="glass-card card-radius p-5">
            <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
              <div>
                <p className="mb-2 text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">封面</p>
                <div className="glass-vignette aspect-[4/5] overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-[#0d1420]">
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
                      <TrendUpIcon className="h-5 w-5 text-[#7486a1]" />
                    </div>
                    <p className="text-xs text-[#7486a1]">点击上传封面</p>
                    <p className="text-[length:var(--fs-micro)] text-[#5a6b82]">JPG / PNG / WebP</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">标题</span>
                  <input
                    className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#5a6b82]"
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="给你的内容起个标题..."
                    value={title}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">正文</span>
                  <textarea
                    className="input-glass min-h-[160px] w-full resize-none rounded-3xl px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-[#5a6b82]"
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="分享你的创作故事..."
                    value={caption}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">标签</span>
                  <input
                    className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#5a6b82]"
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="用逗号分隔，如: 美食, 城市, 深夜"
                    value={tagsInput}
                  />
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tags.map((tag) => (
                        <span
                          className="liquid-pill rounded-full px-3 py-1 text-xs text-[#dce6f8]"
                          key={tag}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </label>

                <div className="space-y-2">
                  <span className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">素材上传</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((index) => (
                      <div
                        className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-[#0d1420] transition hover:border-white/[0.2]"
                        key={index}
                      >
                        <span className="text-xl text-[#5a6b82]">+</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              className="glass-button-ghost px-4 py-2.5 text-sm"
              onClick={() => setStep(1)}
              type="button"
            >
              上一步
            </button>
            <button
              className="glass-button-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-40"
              disabled={!title.trim()}
              onClick={() => setStep(3)}
              type="button"
            >
              下一步
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">发布设置</h2>
              <p className="mt-1 text-sm text-[#8ea0ba]">确认内容设置后发布或保存为草稿</p>
            </div>
            <button
              className="glass-button-ghost px-4 py-2 text-xs"
              onClick={() => setStep(2)}
              type="button"
            >
              返回编辑
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="glass-card card-radius p-5">
                <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">内容预览</p>
                <div className="mt-4 glass-card card-radius overflow-hidden">
                  <div className="relative h-[180px] bg-[linear-gradient(135deg,#121826_0%,#1a2438_100%)]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl opacity-30">
                        {contentType === "SHORT_VIDEO" ? "🎬" : contentType === "MIXED_MEDIA_NOTE" ? "✦" : "🖼"}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(8,17,28,0.7)_100%)]" />
                    {contentType ? (
                      <div className="liquid-pill absolute right-3 top-3 rounded-full px-2.5 py-1 text-[length:var(--fs-micro)] uppercase tracking-[0.16em] text-white">
                        {CONTENT_TYPE_LABELS[contentType]}
                      </div>
                    ) : null}
                  </div>
                  <div className="glass-card-footer px-4 pb-4 pt-3">
                    <p className="line-clamp-2 text-[length:var(--fs-sm)] font-medium text-white">{title || "未命名内容"}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-[#8ea0ba]">{caption || "暂无描述"}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card card-radius p-5">
                <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">赞助合作设置</p>
                <div className="mt-4 space-y-3">
                  <ToggleRow
                    label="开放赞助商匹配"
                    description="允许赞助商发起合作提案"
                    defaultOn
                  />
                  <ToggleRow
                    label="接受自动匹配"
                    description="系统根据内容标签自动推荐赞助商"
                    defaultOn={false}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="liquid-card card-radius p-5">
                <p className="text-[length:var(--fs-micro)] uppercase tracking-[0.18em] text-[#7486a1]">发布选项</p>
                <div className="mt-4 space-y-3">
                  <VisibilityOption label="公开" sublabel="所有用户可见" active />
                  <VisibilityOption label="仅粉丝" sublabel="只有关注你的人可见" />
                  <VisibilityOption label="私密" sublabel="仅自己可见" />
                </div>
              </div>

              <div className="liquid-card card-radius px-5 py-4">
                <p className="text-xs leading-6 text-[#8ea0ba]">
                  发布后内容将进入链上锚定流程。你可以随时在草稿管理中修改未锚定的内容。
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              className="glass-button-ghost px-5 py-2.5 text-sm"
              onClick={() => setStep(2)}
              type="button"
            >
              上一步
            </button>
            <div className="flex gap-3">
              <button
                className="glass-button-ghost px-5 py-2.5 text-sm"
                type="button"
              >
                保存草稿
              </button>
              <button
                className="glass-button-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold"
                type="button"
              >
                发布内容
                <SendRoundedIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ToggleRow = ({
  label,
  description,
  defaultOn = false,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-[#7486a1]">{description}</p>
      </div>
      <button
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          on ? "bg-[#de402a]" : "bg-white/[0.1]"
        }`}
        onClick={() => setOn((v) => !v)}
        type="button"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
};

const VisibilityOption = ({
  label,
  sublabel,
  active = false,
}: {
  label: string;
  sublabel: string;
  active?: boolean;
}) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
      active
        ? "border-[#de402a]/30 bg-[#de402a]/8"
        : "border-white/[0.06] bg-white/[0.02]"
    }`}
  >
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
        active
          ? "border-[#de402a] bg-[#de402a]"
          : "border-white/20 bg-transparent"
      }`}
    >
      {active ? <span className="text-[length:var(--fs-micro)] text-white">✓</span> : null}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-[length:var(--fs-micro)] text-[#7486a1]">{sublabel}</p>
    </div>
  </div>
);

const compactCreatorNumber = (value: number) => {
  if (value >= 10000) {
    const wan = value / 10000;
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(value);
};

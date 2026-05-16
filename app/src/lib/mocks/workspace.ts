import { CampaignRecord, CreatorSeasonState, IntentRecord, ManifestRecord } from "@/lib/api/types";
import type { ProposalDetailResponse } from "@/lib/api/workspace";
import { WORKSPACE_SPONSORSHIPS_PATH } from "@/lib/routes";

export const manifests: ManifestRecord[] = [
  {
    id: "cmna6yckj0000qt4p9rehgen0",
    title: "F1 aesthetics gallery",
    status: "ANCHORED",
    contentType: "IMAGE_CAROUSEL",
    assetCount: 5,
    updatedAtLabel: "6 min ago",
  },
  {
    id: "cmna4hq390006qteqss16aj8b",
    title: "Game trailer moodboard",
    status: "READY",
    contentType: "IMAGE_CAROUSEL",
    assetCount: 5,
    updatedAtLabel: "28 min ago",
  },
  {
    id: "cmna2z7sx0002qtezlaunch1",
    title: "City after dark reel",
    status: "UPLOADING",
    contentType: "SHORT_VIDEO",
    assetCount: 3,
    updatedAtLabel: "just now",
  },
];

export const intents: IntentRecord[] = [
  {
    id: "intent-luna-radiantlab",
    creatorId: "luna-cai",
    creatorName: "弯心入坑",
    sponsorName: "Apex Motion",
    status: "CREATOR_PARTIALLY_SIGNED",
    actionOwner: "sponsor",
    track1BaseUsd: 1200,
    track2PoolUsd: 2400,
    track3PoolUsd: 3000,
    metric: "Saves",
    targetValue: "18,000",
    manifestTitle: "F1 aesthetics gallery",
    deadlineLabel: "Closes in 18h",
  },
  {
    id: "intent-neo-pulsefit",
    creatorId: "neo-park",
    creatorName: "深夜不下线",
    sponsorName: "Nova Screen",
    status: "SPONSOR_SIGNED",
    actionOwner: "system",
    track1BaseUsd: 1800,
    track2PoolUsd: 3600,
    track3PoolUsd: 5200,
    metric: "Clicks",
    targetValue: "9,500",
    manifestTitle: "Game trailer moodboard",
    deadlineLabel: "Closes in 9h",
  },
  {
    id: "intent-mika-grain",
    creatorId: "mika-zhou",
    creatorName: "胶片落进沙里",
    sponsorName: "Slate Journal",
    status: "BUNDLE_BUILT",
    actionOwner: "creator",
    track1BaseUsd: 900,
    track2PoolUsd: 1400,
    track3PoolUsd: 2100,
    metric: "Views",
    targetValue: "120,000",
    manifestTitle: "Dune afterglow note",
    deadlineLabel: "Closes in 26h",
  },
];

export const campaigns: CampaignRecord[] = [
  {
    id: "prop-neo-park-2026q2",
    creatorName: "深夜不下线",
    sponsorName: "Nova Screen",
    status: "RESOLVED_SUCCESS",
    contentHashShort: "f4e2...9a17",
    contentAnchorShort: "5Yk3...R8wF",
    track1BaseUsd: 100000,
    track2PoolUsd: 1000000,
    track3PoolUsd: 300000,
    metric: "Views",
    actualValue: "800 / 1,000",
    chainTxShort: "8nQo...S2Q2",
  },
  {
    id: "proposal-radiantlab-luna",
    creatorName: "弯心入坑",
    sponsorName: "Apex Motion",
    status: "OPEN",
    contentHashShort: "a46c...1da7",
    contentAnchorShort: "5Y3s...Rx2N",
    track1BaseUsd: 1200,
    track2PoolUsd: 2400,
    track3PoolUsd: 3000,
    metric: "Saves",
    actualValue: "12,480 / 18,000",
    chainTxShort: "5e3E...oZ4m",
  },
  {
    id: "proposal-pulsefit-neo",
    creatorName: "深夜不下线",
    sponsorName: "Nova Screen",
    status: "FUNDED",
    contentHashShort: "d1cc...ab91",
    contentAnchorShort: "9vQ4...cK8j",
    track1BaseUsd: 1800,
    track2PoolUsd: 3600,
    track3PoolUsd: 5200,
    metric: "Clicks",
    actualValue: "Pending report",
    chainTxShort: "2RzM...Xn7Q",
  },
];

const manifestIndex = new Map(manifests.map((manifest) => [manifest.id, manifest]));
const intentIndex = new Map(intents.map((intent) => [intent.id, intent]));
const campaignIndex = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

export const mockProposalDetails: Record<string, ProposalDetailResponse> = {
  "prop-neo-park-2026q2": {
    viewerRole: "PUBLIC_FAN",
    proposal: {
      id: "prop-neo-park-2026q2",
      proposalPda: "DemoNeoParkProposalPda2026Q2",
      creatorWallet: "3kRvDemoNeoParkWallet111111111111111111111",
      sponsorWallet: "NovaScreenDemoSponsor1111111111111111111",
      deadlineAt: "2026-05-15T00:00:00.000Z",
      status: "RESOLVED_SUCCESS",
      track1BaseUsdc: "100000000000",
      track1Claimed: true,
      track2MetricType: "VIEWS",
      track2TargetValue: "1000",
      track2MinAchievementBps: 5000,
      track2UsdcDeposited: "1000000000000",
      track2ActualValue: "800",
      track2SettledAt: "2026-05-10T00:00:00.000Z",
      track3UsdcDeposited: "300000000000",
      track3CpsPayout: "250000000000",
      track3DelayDays: 0,
      track3SettledAt: "2026-05-10T00:00:00.000Z",
      onChainTxSignature: "8nQoDemoNeoParkS2Q2SettlementTx",
      oracleSyncStatus: "SYNCED",
      contentHashHex: "f4e2c6d7310bb31f2dff84f4227d5522e0bd9a17",
      contentAnchorPda: "5Yk3DemoNeoParkCampaignAnchorR8wF",
      createdAt: "2026-04-28T08:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    },
  },
};

export const findMockProposalDetail = (proposalId: string | null | undefined) => {
  if (!proposalId) {
    return undefined;
  }

  return mockProposalDetails[proposalId];
};

export const findIntent = (intentId: string) => intentIndex.get(intentId) ?? intents[0];
export const findCampaign = (campaignId: string) => campaignIndex.get(campaignId) ?? campaigns[0];
export const findManifest = (manifestId: string) => manifestIndex.get(manifestId) ?? manifests[0];

export type CreatorStageProfile = {
  stage: CreatorSeasonState;
  wallet: string;
  displayName: string;
  handle: string;
  avatarSrc: string;
  momentum: number;
  fans: number;
  spumpBacking: number;
  nextMilestone: string;
  milestoneProgress: number;
  buyoutProgress?: number;
  buyoutOffer?: { sponsorName: string; budgetUsd: number; deadline: string; status: string };
  activeCampaigns?: number;
  totalEarningsUsd?: number;
  viewsTrend: number[];
};

export type WorkspaceHealthItem = {
  label: string;
  tone: "success" | "processing" | "warning" | "error";
};

export type WorkspaceActionItem = {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  tone?: "default" | "urgent" | "success" | "info";
  iconName: "upload" | "signature" | "sparkles" | "chevron";
  href?: string;
  disabled?: boolean;
  chainHint?: string;
  workflowState?: "ready" | "waiting" | "blocked";
};

export type WorkspaceContentItem = ManifestRecord & {
  coverSrc: string;
  href?: string;
};

export type WorkspaceSponsorshipItem = IntentRecord & {
  href?: string;
};

export type WorkspacePreviewItem = {
  title: string;
  subtitle: string;
  coverSrc: string;
  statusLabel: string;
  tags: string[];
  href?: string;
};

export type WorkspacePersona = CreatorStageProfile & {
  dataSource?: "demo" | "live";
  actions: WorkspaceActionItem[];
  contentItems: WorkspaceContentItem[];
  sponsorshipItems: WorkspaceSponsorshipItem[];
  previewItem: WorkspacePreviewItem;
  healthItems: WorkspaceHealthItem[];
  pipelineDemoFallback?: boolean;
};

const baseProfiles: Record<CreatorSeasonState, CreatorStageProfile> = {
  S1_DISCOVERY: {
    stage: "S1_DISCOVERY",
    wallet: "7xKp...r3Nq",
    displayName: "胶片落进沙里",
    handle: "@mikazhou",
    avatarSrc: "/mock/user-surface/avatars/mika-zhou.svg",
    momentum: 72,
    fans: 1840,
    spumpBacking: 4200,
    nextMilestone: "粉丝 3,000",
    milestoneProgress: 61,
    viewsTrend: [120, 180, 260, 340, 410, 520, 480, 640],
  },
  S1_BUYOUT: {
    stage: "S1_BUYOUT",
    wallet: "9mBx...f2Kw",
    displayName: "弯心入坑",
    handle: "@wanxinrk",
    avatarSrc: "/mock/user-surface/avatars/luna-cai.svg",
    momentum: 91,
    fans: 12400,
    spumpBacking: 38000,
    nextMilestone: "进入 S2",
    milestoneProgress: 85,
    buyoutProgress: 3,
    buyoutOffer: {
      sponsorName: "Apex Motion",
      budgetUsd: 6600,
      deadline: "48h",
      status: "待审核",
    },
    viewsTrend: [820, 960, 1100, 1340, 1500, 1680, 1820, 2100],
  },
  S2_ACTIVE: {
    stage: "S2_ACTIVE",
    wallet: "3kRv...w7Zp",
    displayName: "深夜不下线",
    handle: "@neocity",
    avatarSrc: "/mock/user-surface/avatars/neo-park.svg",
    momentum: 88,
    fans: 48200,
    spumpBacking: 142000,
    nextMilestone: "Campaign 交付",
    milestoneProgress: 62,
    activeCampaigns: 2,
    totalEarningsUsd: 8400,
    viewsTrend: [4200, 5100, 4800, 6200, 7400, 6800, 8100, 9200],
  },
};

export const MOCK_COVERS = [
  "/mock/user-surface/posts/singer-911.svg",
  "/mock/user-surface/posts/project-helix.svg",
  "/mock/user-surface/posts/tamburins-red.svg",
];

export const workspacePersonas: Record<CreatorSeasonState, WorkspacePersona> = {
  S1_DISCOVERY: {
    ...baseProfiles.S1_DISCOVERY,
    actions: [
      {
        iconName: "upload",
        title: "发布新内容",
        subtitle: "再发布 2 条内容，提高被赞助商发现概率",
        ctaLabel: "新建内容",
        href: "/workspace/content/new",
      },
      {
        iconName: "sparkles",
        title: "优化标签",
        subtitle: "热门标签可增加曝光",
        ctaLabel: "查看建议",
        tone: "info",
        disabled: true,
      },
      {
        iconName: "chevron",
        title: "互动回复",
        subtitle: "回复评论可提升 momentum",
        ctaLabel: "查看互动",
        disabled: true,
      },
    ],
    contentItems: [
      { ...manifests[1], coverSrc: MOCK_COVERS[1] },
      { ...manifests[2], coverSrc: MOCK_COVERS[2] },
    ],
    sponsorshipItems: [],
    previewItem: {
      title: "Game trailer moodboard",
      subtitle: "图文笔记 · 5 素材",
      coverSrc: MOCK_COVERS[1],
      statusLabel: "可发布",
      tags: ["游戏", "剪辑", "预告"],
    },
    healthItems: [
      { label: "素材就绪", tone: "success" },
      { label: "视频处理", tone: "success" },
      { label: "Feed 可见", tone: "processing" },
      { label: "链上同步", tone: "warning" },
    ],
  },
  S1_BUYOUT: {
    ...baseProfiles.S1_BUYOUT,
    actions: [
      {
        iconName: "signature",
        title: "审核赞助 Offer",
        subtitle: "Apex Motion · $6,600 · 48h",
        ctaLabel: "审核 Offer",
        tone: "urgent",
        disabled: true,
      },
      {
        iconName: "upload",
        title: "准备赞助内容",
        subtitle: "提前上传素材，加速进入 S2",
        ctaLabel: "上传素材",
        href: "/workspace/content/new",
      },
      {
        iconName: "sparkles",
        title: "了解 Buyout",
        subtitle: "查看权益变化和后续流程",
        ctaLabel: "查看说明",
        disabled: true,
      },
    ],
    contentItems: [
      { ...manifests[0], coverSrc: MOCK_COVERS[0] },
      { ...manifests[1], coverSrc: MOCK_COVERS[1] },
    ],
    sponsorshipItems: [intents[0]],
    previewItem: {
      title: "F1 aesthetics gallery",
      subtitle: "图文笔记 · 5 素材",
      coverSrc: MOCK_COVERS[0],
      statusLabel: "已锚定",
      tags: ["F1", "赛车", "美学"],
    },
    healthItems: [
      { label: "Offer 待审核", tone: "warning" },
      { label: "素材就绪", tone: "success" },
      { label: "Feed 可见", tone: "success" },
      { label: "链上同步", tone: "processing" },
    ],
  },
  S2_ACTIVE: {
    ...baseProfiles.S2_ACTIVE,
    actions: [
      {
        iconName: "upload",
        title: "上传素材",
        subtitle: "City after dark reel · 3 个文件待上传",
        ctaLabel: "上传素材",
        tone: "info",
        href: "/workspace/content/new",
      },
      {
        iconName: "signature",
        title: "创作者签名",
        subtitle: "Dune afterglow note · 等待签名",
        ctaLabel: "前往签名",
        tone: "urgent",
        href: "/workspace/intents/intent-neo-pulsefit?demo=1",
        chainHint: "mock signing step",
        workflowState: "ready",
      },
      {
        iconName: "sparkles",
        title: "创建赞助合作",
        subtitle: "F1 aesthetics gallery 已可发起",
        ctaLabel: "创建合作",
        href: `${WORKSPACE_SPONSORSHIPS_PATH}?demo=1`,
        chainHint: "mock intent draft",
        workflowState: "ready",
      },
    ],
    contentItems: manifests.map((manifest, index) => ({
      ...manifest,
      coverSrc: MOCK_COVERS[index % MOCK_COVERS.length],
    })),
    sponsorshipItems: intents.slice(0, 3),
    previewItem: {
      title: "F1 aesthetics gallery",
      subtitle: "图文笔记 · 5 素材",
      coverSrc: MOCK_COVERS[0],
      statusLabel: "已锚定",
      tags: ["F1", "赛车", "美学"],
    },
    healthItems: [
      { label: "素材就绪", tone: "success" },
      { label: "视频处理", tone: "success" },
      { label: "Feed 可见", tone: "success" },
      { label: "链上同步", tone: "processing" },
    ],
  },
};

export const stageProfiles: Record<CreatorSeasonState, CreatorStageProfile> = {
  S1_DISCOVERY: workspacePersonas.S1_DISCOVERY,
  S1_BUYOUT: workspacePersonas.S1_BUYOUT,
  S2_ACTIVE: workspacePersonas.S2_ACTIVE,
};

export const MOCK_SYSTEM_HEALTH = workspacePersonas.S2_ACTIVE.healthItems;

export const DEMO_OVERVIEW_CONTENT_PIPELINE: WorkspaceContentItem[] =
  workspacePersonas.S2_ACTIVE.contentItems;

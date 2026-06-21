import { CreatorSeasonState } from "@/lib/api/types";
import { WorkspaceOverviewResponse } from "@/lib/api/workspace";
import { shortenWallet } from "@/lib/formatting";
import {
  MOCK_COVERS,
  WorkspaceActionItem,
  WorkspaceContentItem,
  WorkspacePersona,
  WorkspaceSponsorshipItem,
  workspacePersonas,
} from "@/lib/mocks/workspace";
import { WORKSPACE_CONTENT_NEW_PATH } from "@/lib/routes";

export const WORKSPACE_DEMO_STAGE: CreatorSeasonState = "S2_ACTIVE";
export const WORKSPACE_STAGE_ORDER: CreatorSeasonState[] = ["S1_DISCOVERY", "S1_BUYOUT", "S2_ACTIVE"];

export const isLocalPreviewToken = (token: string) => token.startsWith("preview-local.");

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const buildContentItems = (data: WorkspaceOverviewResponse): WorkspaceContentItem[] =>
  data.manifests.map((manifest, index) => ({
    id: manifest.manifestId,
    title: manifest.title ?? "Untitled content",
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
    creatorName: "Current creator",
    sponsorName: intent.sponsorWallet ? `Sponsor ${shortenWallet(intent.sponsorWallet)}` : "Pending sponsor",
    status: intent.status,
    actionOwner: intent.needsAction ? (intent.viewerRole === "SPONSOR" ? "sponsor" : "creator") : "system",
    track1BaseUsd: 0,
    track2PoolUsd: 0,
    track3PoolUsd: 0,
    metric: "Views",
    targetValue: "Pending",
    manifestTitle: intent.manifest?.title ?? "Unbound manifest",
    deadlineLabel: intent.latestBundle ? `Bundle ${intent.latestBundle.status}` : formatUpdatedAt(intent.updatedAt),
    href: `/workspace/intents/${intent.intentId}`,
  }));

const resolveWorkspaceStage = (
  wallet: string,
  data: WorkspaceOverviewResponse,
): CreatorSeasonState => {
  const personaMatch = WORKSPACE_STAGE_ORDER.find((stage) => workspacePersonas[stage].wallet === wallet);
  if (personaMatch) return personaMatch;
  const hasActiveProposal = data.proposals.some((proposal) =>
    ["OPEN", "FUNDED", "RESOLVED_SUCCESS"].includes(proposal.status),
  );
  const hasS2Intent = data.intents.some((intent) =>
    [
      "BUNDLE_BUILT",
      "CREATOR_PARTIALLY_SIGNED",
      "SPONSOR_SIGNED",
      "SUBMITTED",
      "CONFIRMED",
    ].includes(intent.status),
  );
  if (hasActiveProposal || hasS2Intent) return "S2_ACTIVE";
  if (data.intents.length > 0) return "S1_BUYOUT";
  return "S1_DISCOVERY";
};

const buildActions = (
  stage: CreatorSeasonState,
  contentItems: WorkspaceContentItem[],
  sponsorshipItems: WorkspaceSponsorshipItem[],
): WorkspaceActionItem[] => {
  const uploadTarget = contentItems.find((item) => ["DRAFT", "UPLOADING"].includes(item.status));
  const signTarget = sponsorshipItems.find((item) => item.actionOwner === "creator" || item.actionOwner === "sponsor");
  const readyTarget = contentItems.find((item) => ["READY", "ANCHORED", "PUBLISHED"].includes(item.status));

  if (stage === "S1_DISCOVERY") {
    return [
      {
        iconName: "upload",
        title: "Publish new content",
        subtitle: contentItems.length > 0 ? "Keep a steady cadence to attract sponsors" : "Create your first manifest",
        ctaLabel: "New manifest",
        href: WORKSPACE_CONTENT_NEW_PATH,
        workflowState: "ready",
        chainHint: "draft manifest · off-chain",
      },
      {
        iconName: "sparkles",
        title: "Refine tags & metadata",
        subtitle: "Tune signal so sponsors discover you faster",
        ctaLabel: "Suggestions",
        tone: "info",
        disabled: true,
        workflowState: "waiting",
        chainHint: "projection queue",
      },
      {
        iconName: "chevron",
        title: "Reply to fan signals",
        subtitle: "Engagement drives momentum score",
        ctaLabel: "View signals",
        disabled: true,
        workflowState: "blocked",
        chainHint: "no on-chain action",
      },
    ];
  }

  if (stage === "S1_BUYOUT") {
    return [
      {
        iconName: "signature",
        title: signTarget ? "Review sponsor offer" : "Awaiting sponsor offer",
        subtitle: signTarget ? `${signTarget.sponsorName} · ${signTarget.deadlineLabel}` : "Offers will appear here once received",
        ctaLabel: signTarget ? "Preview Review" : "Idle",
        tone: signTarget ? "urgent" : "default",
        href: signTarget?.href,
        disabled: !signTarget,
        workflowState: signTarget ? "ready" : "waiting",
        chainHint: signTarget ? "buyout window live" : "no offer bound",
      },
      {
        iconName: "upload",
        title: "Prepare campaign assets",
        subtitle: "Upload reusable creative ahead of S2 graduation",
        ctaLabel: "Upload assets",
        href: uploadTarget?.href ?? WORKSPACE_CONTENT_NEW_PATH,
        workflowState: "ready",
        chainHint: "R2 presign ready",
      },
      {
        iconName: "sparkles",
        title: "Buyout flow brief",
        subtitle: "Understand rage-quit window & supporter discovery rewards",
        ctaLabel: "Read brief",
        disabled: true,
        workflowState: "blocked",
        chainHint: "docs only",
      },
    ];
  }

  return [
    {
      iconName: "upload",
      title: uploadTarget ? "Continue upload" : "Create new manifest",
      subtitle: uploadTarget ? `${uploadTarget.title} · upload pending` : "Build the next campaign-ready content",
      ctaLabel: uploadTarget ? "Resume upload" : "New manifest",
      href: uploadTarget?.href ?? WORKSPACE_CONTENT_NEW_PATH,
      tone: "info",
      workflowState: uploadTarget ? "ready" : "waiting",
      chainHint: uploadTarget ? "multipart in flight" : "no draft",
    },
    {
      iconName: "signature",
      title: signTarget ? "Sign campaign bundle" : "Signatures synced",
      subtitle: signTarget ? `${signTarget.manifestTitle} · ${signTarget.deadlineLabel}` : "All bundles signed and confirmed",
      ctaLabel: signTarget ? "Preview Sign" : "Idle",
      href: signTarget?.href,
      tone: signTarget ? "urgent" : "success",
      disabled: !signTarget,
      workflowState: signTarget ? "ready" : "waiting",
      chainHint: signTarget ? "bundle built · vtx ready" : "submitted",
    },
    {
      iconName: "sparkles",
      title: "Create sponsorship intent",
      subtitle: readyTarget ? `${readyTarget.title} is anchor-ready` : "Lock a manifest first to draft an intent",
      ctaLabel: readyTarget ? "Preview intent" : "Waiting",
      href: readyTarget?.href,
      disabled: !readyTarget,
      workflowState: readyTarget ? "ready" : "blocked",
      chainHint: readyTarget ? "terms lock → build bundle" : "anchor required",
    },
  ];
};

export const buildPersonaFromWorkspace = (data: WorkspaceOverviewResponse): WorkspacePersona => {
  const stage = resolveWorkspaceStage(data.wallet, data);
  const base = workspacePersonas[stage];
  const contentFromApi = buildContentItems(data);
  const contentItems = contentFromApi;
  const sponsorshipItems = buildSponsorshipItems(data);
  const previewContent = contentItems[0];

  return {
    ...base,
    dataSource: "live",
    stage,
    wallet: data.wallet,
    displayName: "Current creator",
    momentum: Math.max(base.momentum, 55 + contentItems.length * 7 + sponsorshipItems.length * 4),
    activeCampaigns: data.proposals.length,
    actions: buildActions(stage, contentItems, sponsorshipItems),
    contentItems,
    sponsorshipItems,
    previewItem: previewContent
      ? {
          title: previewContent.title,
          subtitle: `${previewContent.assetCount} assets`,
          coverSrc: previewContent.coverSrc,
          statusLabel: previewContent.status,
          tags: ["Workspace", "Content"],
          href: previewContent.href,
        }
      : {
          title: "No live manifest yet",
          subtitle: "Create a manifest to populate this console",
          coverSrc: MOCK_COVERS[0],
          statusLabel: "EMPTY",
          tags: ["Live API", "Empty"],
          href: WORKSPACE_CONTENT_NEW_PATH,
        },
    healthItems: base.healthItems,
    pipelineDemoFallback: false,
  };
};

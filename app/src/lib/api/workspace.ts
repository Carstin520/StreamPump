import { apiClient } from "./client";
import { ContentManifestStatus, ContentType, ProposalIntentStatus, ProposalStatus } from "./types";

export type WorkspaceManifestSummary = {
  manifestId: string;
  title: string | null;
  status: ContentManifestStatus;
  contentType: ContentType;
  version: number;
  assetCount: number;
  updatedAt: string;
};

export type WorkspaceIntentSummary = {
  intentId: string;
  status: ProposalIntentStatus;
  viewerRole: "CREATOR" | "SPONSOR" | "OBSERVER";
  needsAction: boolean;
  creatorWallet: string;
  sponsorWallet: string | null;
  manifest: {
    manifestId: string;
    title: string | null;
    status: ContentManifestStatus;
    contentType: ContentType;
  } | null;
  latestBundle: {
    bundleId: string;
    status: string;
    expiresAt: string;
    chainTxSignature: string | null;
  } | null;
  updatedAt: string;
};

export type WorkspaceProposalSummary = {
  proposalId: string;
  proposalPda: string;
  status: ProposalStatus;
  creatorWallet: string;
  sponsorWallet: string | null;
  manifestId: string | null;
  intentId: string | null;
  deadlineAt: string;
  track2MetricType: string;
  oracleSyncStatus: string;
  updatedAt: string;
};

export type WorkspaceOverviewResponse = {
  wallet: string;
  manifests: WorkspaceManifestSummary[];
  intents: WorkspaceIntentSummary[];
  proposals: WorkspaceProposalSummary[];
};

export type ContentManifestAssetResponse = {
  assetId: string;
  assetType: string;
  orderIndex: number;
  storageKey: string;
  originUrl: string | null;
  uploadStrategy: "SINGLE_PART" | "MULTIPART";
  uploadStatus: string;
  processingStatus: string;
  ingestStatus: string;
  deliveryStatus: string;
  preferredPlaybackSource: "ORIGIN" | "MUX" | null;
  preferredPlaybackUrl: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxPlaybackUrl: string | null;
  muxLastKnownStatus: string | null;
  processingError: string | null;
  updatedAt: string;
};

export type ContentPublicationResponse = {
  publicationId: string;
  platform: string;
  externalUrl: string;
  verificationStatus: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentManifestDetailResponse = {
  manifestId: string;
  creatorWallet: string;
  contentType: ContentType;
  status: ContentManifestStatus;
  version: number;
  title: string | null;
  captionText: string | null;
  tags: string[];
  metadata: unknown;
  manifestHashHex: string | null;
  currentAnchorPda: string | null;
  currentAnchorTx: string | null;
  internalCanonicalUrl: string | null;
  internalUrlDigestHex: string | null;
  coverAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  assets: ContentManifestAssetResponse[];
  publications: ContentPublicationResponse[];
};

export type IntentSummaryResponse = {
  intentId: string;
  status: ProposalIntentStatus;
  version: number;
  creatorWallet: string;
  sponsorWallet: string | null;
  sponsorOrgId: string | null;
  creatorOrgId: string | null;
  manifestId: string | null;
  lockedManifestHashHex: string | null;
  lockedAnchorPda: string | null;
  deadlineUnix: string;
  track1BaseUsdc: string;
  track2MetricType: string;
  track2TargetValue: string;
  track2MinAchievementBps: number;
  track2UsdcDeposited: string;
  track3UsdcDeposited: string;
  track3DelayDays: number;
  plannedProposalPda: string | null;
  plannedUsdcVaultPda: string | null;
  creatorApprovedAt: string | null;
  sponsorApprovedAt: string | null;
  chainTxSignature: string | null;
  chainSubmittedAt: string | null;
  chainConfirmedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BundleResponse = {
  bundleId: string;
  status: string;
  submitMode: string;
  instructionPlan: unknown;
  requiredSigners: unknown;
  versionedTxBase64: string | null;
  partiallySignedTxBase64: string | null;
  recentBlockhash: string | null;
  lastValidBlockHeight: string | null;
  expiresAt: string;
  chainTxSignature: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalDetailRecord = {
  id: string;
  proposalPda: string;
  creatorWallet: string;
  sponsorWallet?: string | null;
  deadlineAt: string;
  status: ProposalStatus;
  track1BaseUsdc?: string;
  track1Claimed?: boolean;
  track2MetricType: string;
  track2TargetValue: string;
  track2MinAchievementBps: number;
  track2UsdcDeposited: string;
  track2ActualValue: string | null;
  track2SettledAt: string | null;
  track2InitialFanPool?: string;
  track2InitialSpumpStaked?: string;
  track3UsdcDeposited?: string;
  track3CpsPayout?: string | null;
  track3DelayDays?: number;
  track3SettledAt?: string | null;
  onChainTxSignature?: string | null;
  oracleSyncStatus?: string;
  contentHashHex?: string | null;
  contentAnchorPda?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProposalIntentDetailResponse = {
  intent: IntentSummaryResponse;
  viewerRole: "CREATOR" | "SPONSOR";
  manifest: {
    manifestId: string;
    title: string | null;
    contentType: ContentType;
    status: ContentManifestStatus;
    version: number;
    manifestHashHex: string | null;
    currentAnchorPda: string | null;
    assets: ContentManifestAssetResponse[];
  } | null;
  proposal: ProposalDetailRecord | null;
  bundles: BundleResponse[];
};

export type ProposalDetailResponse = {
  viewerRole: "CREATOR_OR_SPONSOR" | "PUBLIC_FAN";
  proposal: ProposalDetailRecord;
};

export type PublicCampaignProofResponse = {
  proposalId: string;
  proposalPda: string;
  viewerRole: "PUBLIC";
  status: ProposalStatus;
  proofStatus: "DRAFT" | "FUNDED" | "ANCHORED" | "SETTLING" | "SETTLED" | "CANCELLED" | "VOIDED";
  creatorWallet: string;
  sponsorWallet: string | null;
  manifestId: string | null;
  intentId: string | null;
  deadlineAt: string;
  budgetTracks: {
    track1BaseUsdc: string;
    track1Claimed: boolean;
    track2MetricType: string;
    track2TargetValue: string;
    track2MinAchievementBps: number;
    track2UsdcDeposited: string;
    track2ActualValue: string | null;
    track2SettledAt: string | null;
    track2InitialFanPool: string;
    track2InitialSpumpStaked: string;
    track3UsdcDeposited: string;
    track3CpsPayout: string | null;
    track3DelayDays: number;
    track3SettledAt: string | null;
  };
  proof: {
    contentHashHex: string | null;
    contentAnchorPda: string | null;
    contentAnchorTx: string | null;
    latestChainTxSignature: string | null;
    oracleSyncStatus: string | null;
    contentPublishedVerifiedAt: string | null;
  };
  manifest: {
    manifestId: string;
    title: string | null;
    contentType: ContentType;
    status: ContentManifestStatus;
    version: number;
    manifestHashHex: string | null;
    currentAnchorPda: string | null;
    currentAnchorTx: string | null;
    publishedAt: string | null;
  } | null;
  endorsementSummary?: {
    endorserCount: number;
    totalStakedSpump: string;
    estimatedUsdcReward: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreatorMarketProfileResponse = {
  creator: {
    creatorWallet: string;
    creatorProfilePda: string;
    stage: "S1_DISCOVERY" | "S1_BUYOUT" | "S2_ACTIVE";
    level: number;
    handle: string | null;
    displayName: string | null;
  };
};

export type ManifestAssetKind = "IMAGE" | "VIDEO" | "COVER";
export type BundleSubmitMode = "SERVER_RELAY" | "CLIENT_RELAY";
export type ManifestAssetUploadStrategy = "SINGLE_PART" | "MULTIPART";

type CreateContentManifestInput = {
  contentType: ContentType;
  title?: string | null;
  captionText?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type PresignManifestAssetInput = {
  assetType: ManifestAssetKind;
  orderIndex: number;
  sha256Hex: string;
  mimeType: string;
  fileSizeBytes: string;
};

type CreatePublicationInput = {
  manifestId: string;
  platform: string;
  externalUrl: string;
  externalPostId?: string | null;
};

type CreateProposalIntentInput = {
  manifestId: string;
  creatorWallet: string;
  sponsorWallet: string;
  sponsorOrgId?: string | null;
  creatorOrgId?: string | null;
  deadlineUnix: string;
  track1BaseUsdc: string;
  track2MetricType: "VIEWS" | "CLICKS" | "SAVES";
  track2TargetValue: string;
  track2MinAchievementBps: number;
  track2UsdcDeposited: string;
  track3UsdcDeposited: string;
  track3DelayDays: number;
};

export type PresignManifestAssetsResponse = {
  manifestId: string;
  uploads: Array<
    | {
        assetId: string;
        assetType: ManifestAssetKind;
        orderIndex: number;
        storageKey: string;
        uploadStrategy: "SINGLE_PART";
        presignedUrl: string;
        expiresInSeconds: number;
      }
    | {
        assetId: string;
        assetType: ManifestAssetKind;
        orderIndex: number;
        storageKey: string;
        uploadStrategy: "MULTIPART";
        multipartUploadId: string;
        partCount: number;
        partSizeBytes: number;
        parts: Array<{
          partNumber: number;
          presignedUrl: string;
          expiresInSeconds: number;
        }>;
      }
  >;
};

export type CompleteManifestAssetUploadResponse = {
  manifestId: string;
  asset: ContentManifestAssetResponse;
};

export type CompleteManifestAssetUploadInput = {
  multipartUploadId: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
};

export type FinalizeManifestResponse = Pick<
  ContentManifestDetailResponse,
  | "manifestId"
  | "creatorWallet"
  | "contentType"
  | "status"
  | "version"
  | "manifestHashHex"
  | "currentAnchorPda"
  | "currentAnchorTx"
  | "createdAt"
  | "updatedAt"
> & {
  internalCanonicalUrl: string | null;
  internalUrlDigestHex: string | null;
  plannedContentAnchorPda: string | null;
};

export type CreatePublicationResponse = {
  publicationId: string;
  manifestId: string;
  platform: string;
  externalUrl: string;
  verificationStatus: string;
  createdAt: string;
};

export type BuildProposalBundleResponse = {
  intentId: string;
  plannedProposalPda: string | null;
  plannedContentAnchorPda: string | null;
  bundle: BundleResponse;
  reused: boolean;
};

export type CreatorPartialSignResponse = {
  intentId: string;
  bundle: BundleResponse;
  replayed: boolean;
};

export type SubmitProposalBundleResponse = {
  intentId: string;
  bundle: BundleResponse;
  relayStatus: string;
  chainTxSignature?: string | null;
};

export type ProposalIntentStatusResponse = {
  intent: IntentSummaryResponse;
  latestBundle: BundleResponse | null;
};

const createIdempotencyKey = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getWorkspaceOverview = (token: string) =>
  apiClient.get<WorkspaceOverviewResponse>("/workspace", { token });

export const getContentManifestById = (token: string, manifestId: string) =>
  apiClient.get<ContentManifestDetailResponse>(`/content/manifests/${manifestId}`, { token });

export const createContentManifest = (token: string, input: CreateContentManifestInput) =>
  apiClient.post<Pick<ContentManifestDetailResponse, "manifestId" | "creatorWallet" | "contentType" | "status" | "version" | "manifestHashHex" | "currentAnchorPda" | "currentAnchorTx" | "createdAt" | "updatedAt">>("/content/manifests", {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("manifest"),
    },
    body: input,
  });

export const presignManifestAssets = (
  token: string,
  manifestId: string,
  assets: PresignManifestAssetInput[],
) =>
  apiClient.post<PresignManifestAssetsResponse>(`/content/manifests/${manifestId}/assets/presign`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("presign"),
    },
    body: {
      assets,
    },
  });

export const completeManifestAssetUpload = (
  token: string,
  manifestId: string,
  assetId: string,
  input?: CompleteManifestAssetUploadInput,
) =>
  apiClient.post<CompleteManifestAssetUploadResponse>(
    `/content/manifests/${manifestId}/assets/${assetId}/complete`,
    {
      token,
      headers: {
        "x-idempotency-key": createIdempotencyKey("asset-complete"),
      },
      body: input,
    },
  );

export const finalizeContentManifest = (token: string, manifestId: string) =>
  apiClient.post<FinalizeManifestResponse>(`/content/manifests/${manifestId}/finalize`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("manifest-finalize"),
    },
  });

export const createContentPublication = (token: string, input: CreatePublicationInput) =>
  apiClient.post<CreatePublicationResponse>("/content/publications", {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("publication"),
    },
    body: input,
  });

export const createProposalIntent = (token: string, input: CreateProposalIntentInput) =>
  apiClient.post<IntentSummaryResponse>("/proposal-intents", {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("proposal-intent"),
    },
    body: input,
  });

export const lockProposalIntent = (token: string, intentId: string) =>
  apiClient.post<IntentSummaryResponse>(`/proposal-intents/${intentId}/lock`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("intent-lock"),
    },
  });

export const buildProposalLaunchBundle = (
  token: string,
  intentId: string,
  input: { submitMode: BundleSubmitMode; forceRebuild?: boolean },
) =>
  apiClient.post<BuildProposalBundleResponse>(`/proposal-intents/${intentId}/build-bundle`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("intent-build"),
    },
    body: input,
  });

export const creatorPartialSignBundle = (
  token: string,
  intentId: string,
  input: { bundleId: string; partiallySignedTxBase64: string },
) =>
  apiClient.post<CreatorPartialSignResponse>(`/proposal-intents/${intentId}/creator-partial-sign`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("intent-creator-sign"),
    },
    body: input,
  });

export const submitProposalBundle = (
  token: string,
  intentId: string,
  input: { bundleId: string; fullySignedTxBase64: string },
) =>
  apiClient.post<SubmitProposalBundleResponse>(`/proposal-intents/${intentId}/submit`, {
    token,
    headers: {
      "x-idempotency-key": createIdempotencyKey("intent-submit"),
    },
    body: input,
  });

export const getProposalIntentStatus = (token: string, intentId: string) =>
  apiClient.get<ProposalIntentStatusResponse>(`/proposal-intents/${intentId}/status`, { token });

export const getProposalIntentById = (token: string, intentId: string) =>
  apiClient.get<ProposalIntentDetailResponse>(`/proposal-intents/${intentId}`, { token });

export const getProposalById = (proposalId: string, token?: string) =>
  apiClient.get<ProposalDetailResponse>(`/proposals/${proposalId}`, token ? { token } : undefined);

export const getPublicCampaignProof = (proposalId: string) =>
  apiClient.get<PublicCampaignProofResponse>(`/campaigns/${proposalId}/public`);

export const getCreatorMarketProfile = (creatorWallet: string) =>
  apiClient.get<CreatorMarketProfileResponse>(`/market/creators/${creatorWallet}`);

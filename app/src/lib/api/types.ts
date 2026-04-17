export type CreatorSeasonState = "S1_DISCOVERY" | "S1_BUYOUT" | "S2_ACTIVE";
export type PostType = "IMAGE" | "VIDEO";
export type ContentType = "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
export type ContentManifestStatus = "DRAFT" | "UPLOADING" | "READY" | "LOCKED" | "ANCHORED" | "PUBLISHED" | "ARCHIVED";
export type ProposalIntentStatus =
  | "DRAFT"
  | "TERMS_LOCKED"
  | "BUNDLE_BUILT"
  | "CREATOR_PARTIALLY_SIGNED"
  | "SPONSOR_SIGNED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "EXPIRED";
export type ProposalStatus = "OPEN" | "FUNDED" | "RESOLVED_SUCCESS" | "RESOLVED_FAIL" | "CANCELLED" | "VOIDED";
export type IdentityProvider = "GOOGLE" | "APPLE" | "EMAIL" | "PASSKEY";
export type LoginPreviewMode = "welcome" | "switch";

export type SessionIdentityRecord = {
  id: string;
  provider: IdentityProvider;
  providerSubject: string;
  email: string | null;
  displayName: string | null;
  managedWalletAddress: string | null;
};

export type AuthSessionRecord = {
  wallet: string;
  accessToken: string;
  expiresAt: string;
  tokenType: "Bearer";
  identity?: SessionIdentityRecord | null;
};

export type WalletAuthChallengeRecord = {
  wallet: string;
  challengeId: string;
  nonce: string;
  message: string;
  expiresAt: string;
};

export type CurrentSessionRecord = {
  wallet: string;
  sessionId: string;
  source: string;
  identity: SessionIdentityRecord | null;
};

export type CommentRecord = {
  id: string;
  author: string;
  avatarSeed: string;
  avatarSrc: string;
  content: string;
  likes: number;
  timeLabel: string;
};

export type PostRecord = {
  id: string;
  type: PostType;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatarSrc: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  stage: CreatorSeasonState | "NONE";
  likes: number;
  saves: number;
  commentsCount: number;
  timeLabel: string;
  location: string;
  mediaHeightClass: string;
  mediaStyle: string;
  coverSrc: string;
  videoSrc?: string;
  durationLabel?: string;
  gallerySrcs?: string[];
  hasMultipleImages?: boolean;
  comments: CommentRecord[];
};

export type CreatorMarketRecord = {
  id: string;
  name: string;
  handle: string;
  avatarSrc: string;
  heroSrc: string;
  followingCount: number;
  followersCount: number;
  totalLikesAndSavesCount: number;
  niche: string;
  city: string;
  intro: string;
  level: string;
  momentumScore: number;
  tokenPrice: number;
  supply: number;
  graduationProgress: number;
  buyoutStatus: string;
  state: CreatorSeasonState;
  teaser: string;
  tags: string[];
  holderCount: number;
  topHolders: Array<{ rank: number; label: string; share: string }>;
  targetGraduationPrice: number;
  potentialSponsors: string[];
  supporterDistributableUsd?: number;
  buyoutOfferUsd?: number;
  buyoutTimeline?: string[];
  activeCampaignCount?: number;
  activityScore?: number;
  valuationUsd?: number;
  contentPool: string[];
};

export type ManifestRecord = {
  id: string;
  title: string;
  status: ContentManifestStatus;
  contentType: ContentType;
  assetCount: number;
  updatedAtLabel: string;
};

export type IntentRecord = {
  id: string;
  creatorId: string;
  creatorName: string;
  sponsorName: string;
  status: ProposalIntentStatus;
  actionOwner: "creator" | "sponsor" | "system";
  track1BaseUsd: number;
  track2PoolUsd: number;
  track3PoolUsd: number;
  metric: string;
  targetValue: string;
  manifestTitle: string;
  deadlineLabel: string;
};

export type CampaignRecord = {
  id: string;
  creatorName: string;
  sponsorName: string;
  status: ProposalStatus;
  contentHashShort: string;
  contentAnchorShort: string;
  track1BaseUsd: number;
  track2PoolUsd: number;
  track3PoolUsd: number;
  metric: string;
  actualValue: string;
  chainTxShort: string;
};

export type LoginMethodRecord = {
  id: "email" | "google" | "apple" | "wallet";
  label: string;
  subtitle: string;
  tone?: "default" | "wallet";
};

export type LoginAccountRecord = {
  id: string;
  name: string;
  handle: string;
  avatarSrc: string;
  sessionLabel: string;
  methodLabel: string;
  isCurrent?: boolean;
};

export type CurrentUserRecord = {
  id: string;
  name: string;
  handle: string;
  location: string;
  bio: string;
  followingCount: number;
  followersCount: number;
  totalLikesAndSavesCount: number;
  sessionMode: string;
  primaryWallet: string;
  avatarSrc: string;
  bannerSrc: string;
};

export type PortfolioHoldingRecord = {
  creatorId: string;
  tokenCount: number;
  avgEntryUsd: number;
  unrealizedChangePct: number;
  note: string;
  currentPriceUsd?: number;
  trend: number[];
};

export type PortfolioActionRecord = {
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "buyout" | "opportunity";
  creatorId?: string;
  actionLabel?: string;
};

export type PortfolioExposurePointRecord = {
  label: string;
  value: number;
};

export type PortfolioClaimWindowRecord = {
  id: string;
  creatorId: string;
  eligibleTokens: number;
  claimPriceUsd: number;
  payoutUsd: number;
  closesInLabel: string;
  statusLabel: string;
};

export type PortfolioUpcomingClaimRecord = {
  id: string;
  creatorId: string;
  eligibleTokens: number;
  expectedPriceUsd: number;
  opensInLabel: string;
  estimatedPayoutUsd: number;
};

export type PortfolioReentryRecord = {
  id: string;
  creatorId: string;
  exitPriceUsd: number;
  currentPriceUsd: number;
  exitedAtLabel: string;
  sinceExitPerformancePct: number;
  thesis: string;
};

export type ActivityTab = "overview" | "video";

export type ActivityFeedTabRecord = {
  id: ActivityTab;
  label: string;
};

export type ActivityAuthorRecord = {
  creatorId: string;
  note: string;
  hasUnread?: boolean;
};

export type ActivityFeedItemRecord = {
  id: string;
  kind: "post" | "status";
  creatorId: string;
  postId: string;
  postedAtLabel: string;
  title?: string;
  body: string;
  actionSummary: string;
  commentsCount: number;
  likesCount: number;
  sharesCount: number;
  coverSrc?: string;
  mediaType?: PostType;
  durationLabel?: string;
  stage: CreatorSeasonState | "NONE";
};

export type ActivityVideoItemRecord = {
  id: string;
  creatorId: string;
  postId: string;
  title: string;
  coverSrc: string;
  durationLabel?: string;
  viewsCount: number;
  commentsCount: number;
  timeLabel: string;
};

export type ActivitySidebarHighlightRecord = {
  creatorId: string;
  headline: string;
  statusLabel: string;
};

export type UserNoteRecord = {
  id: string;
  sourcePostId?: string;
  title: string;
  coverSrc: string;
  likes: number;
  stage: CreatorSeasonState | "NONE";
  authorName: string;
  authorAvatarSrc: string;
  mediaHeightClass: string;
};

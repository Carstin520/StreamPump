/**
 * End-to-end smoke for the first production corridor:
 * real session -> R2/Mux/backend content publish -> backend feed/detail ->
 * proposal intent -> optional signed launch/proposal proof.
 *
 * The script exits with code 2 for expected product blockers. It exits 0 only
 * when the whole corridor reaches a confirmed campaign detail read model.
 */
import "../backend/config/loadEnv";

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { Keypair } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type Blocker = {
  code: string;
  message: string;
  details?: JsonValue;
};

type SmokeSummary = {
  ok: boolean;
  apiBaseUrl: string;
  completedSteps: string[];
  blockers: Blocker[];
  artifacts: Record<string, JsonValue>;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: JsonValue;
  };
};

type AccountMeResponse = {
  wallet: string;
  storageStatus: "LIVE" | "MIGRATION_REQUIRED" | string;
  profile: null | {
    role: string;
    displayName: string | null;
    handle: string | null;
    onboardingCompletedAt: string | null;
  };
};

type AuthChallengeResponse = {
  nonce: string;
  message: string;
};

type AuthSessionResponse = {
  accessToken: string;
  wallet: string;
};

type ContentManifestResponse = {
  manifestId: string;
  creatorWallet: string;
  status: string;
};

type PresignResponse = {
  manifestId: string;
  uploads: Array<{
    assetId: string;
    assetType: string;
    orderIndex: number;
    storageKey: string;
    uploadStrategy: "SINGLE_PART" | "MULTIPART";
    presignedUrl?: string;
    multipartUploadId?: string;
    partSizeBytes?: number;
    parts?: Array<{
      partNumber: number;
      presignedUrl: string;
    }>;
  }>;
  completedAssets?: AssetRecord[];
};

type AssetRecord = {
  assetId: string;
  assetType: string;
  orderIndex: number;
  processingStatus: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxLastKnownStatus: string | null;
  preferredPlaybackUrl?: string | null;
};

type ManifestDetailResponse = ContentManifestResponse & {
  manifestHashHex: string | null;
  internalCanonicalUrl: string | null;
  currentAnchorPda: string | null;
  assets: AssetRecord[];
};

type ContentPublicationResponse = {
  publicationId: string;
  manifestId: string;
  platform: string;
  externalUrl: string;
  verificationStatus: string;
};

type PublicationReviewResponse = {
  publicationId: string;
  verificationStatus: string;
  publicFeedEligible: boolean;
  assetsReady: boolean;
};

type PublicFeedResponse = {
  posts: Array<{
    postId: string;
    manifestId: string;
    status: string;
    assets: AssetRecord[];
  }>;
};

type PublicPostResponse = {
  post: {
    postId: string;
    manifestId: string;
    status: string;
    assets: AssetRecord[];
  };
};

type IntentResponse = {
  intentId: string;
  status: string;
  creatorWallet: string;
  sponsorWallet: string;
  manifestId: string;
  plannedProposalPda: string | null;
};

type BundleResponse = {
  bundleId: string;
  status: string;
  versionedTxBase64: string | null;
  partiallySignedTxBase64: string | null;
  chainTxSignature: string | null;
};

type BuildBundleResponse = {
  intentId: string;
  plannedProposalPda: string | null;
  plannedContentAnchorPda: string | null;
  bundle: BundleResponse;
};

type SubmitBundleResponse = {
  intentId: string;
  bundle: BundleResponse;
  relayStatus: string;
  chainTxSignature?: string | null;
};

type ProposalResponse = {
  viewerRole: string;
  proposal: {
    id: string;
    proposalPda: string;
    status: string;
    manifestId?: string | null;
    contentAnchorPda?: string | null;
  };
};

type PublicCampaignProofResponse = {
  proposalPda: string;
  proofStatus: string;
  manifest: {
    manifestId: string;
    manifestHashHex: string | null;
    currentAnchorPda: string | null;
  } | null;
  proof: {
    contentHashHex: string | null;
    contentAnchorPda: string | null;
    contentAnchorTx: string | null;
    fundingTxSignature: string | null;
    latestSettlementTxSignature: string | null;
  };
  integrity?: Record<string, boolean>;
};

class ExpectedBlocker extends Error {
  readonly code: string;
  readonly details?: JsonValue;

  constructor(code: string, message: string, details?: JsonValue) {
    super(message);
    this.name = "ExpectedBlocker";
    this.code = code;
    this.details = details;
  }
}

class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: JsonValue;

  constructor(status: number, code: string, message: string, details?: JsonValue) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const completedSteps: string[] = [];
const blockers: Blocker[] = [];
const artifacts: Record<string, JsonValue> = {};

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");

const apiBaseUrl = normalizeBaseUrl(
  process.env.STREAM_PUMP_SMOKE_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:4000/api/v1"
);

const waitForMuxReadySeconds = Number(process.env.STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS ?? 0);
const smokeRunId = (process.env.STREAM_PUMP_SMOKE_RUN_ID ?? "").trim();
const uploadAttempt = (process.env.STREAM_PUMP_SMOKE_UPLOAD_ATTEMPT ?? "1").trim();
const bundleAttempt = (process.env.STREAM_PUMP_SMOKE_BUNDLE_ATTEMPT ?? "1").trim();

const smokeIdempotencyKey = (stage: string, attempt?: string): string =>
  ["pilot-corridor", smokeRunId, stage, attempt].filter(Boolean).join(":");

const isTruthyEnv = (name: string): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const addStep = (step: string) => {
  completedSteps.push(step);
};

let activeStage = "environment validation";
const beginStage = (stage: string) => {
  activeStage = stage;
};

const addBlocker = (code: string, message: string, details?: JsonValue) => {
  blockers.push({ code, message, ...(details === undefined ? {} : { details }) });
};

const printSummary = (ok: boolean) => {
  const summary: SmokeSummary = {
    ok,
    apiBaseUrl: (() => {
      try {
        const safeUrl = new URL(apiBaseUrl);
        safeUrl.username = "";
        safeUrl.password = "";
        safeUrl.search = "";
        safeUrl.hash = "";
        return safeUrl.toString().replace(/\/$/, "");
      } catch {
        return "configured-api-base";
      }
    })(),
    completedSteps,
    blockers,
    artifacts,
  };
  console.log(JSON.stringify(summary, null, 2));
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ExpectedBlocker(
      `${name}_REQUIRED`,
      `Set ${name} before running the production corridor smoke.`
    );
  }
  return value;
};

const request = async <T>(
  route: string,
  options: {
    method?: string;
    token?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${route}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined;

    if (!response.ok) {
      throw new ApiError(
        response.status,
        parsed?.error?.code ?? "API_REQUEST_FAILED",
        parsed?.error?.message ?? text ?? `API request failed with ${response.status}`,
        parsed?.error?.details
      );
    }

    if (parsed && typeof parsed === "object" && "ok" in parsed) {
      return parsed.data as T;
    }

    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
};

const uploadToPresignedUrl = async (
  presignedUrl: string,
  body: Buffer,
  mimeType: string
): Promise<Headers> => {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: body as unknown as BodyInit,
  });

  if (!response.ok) {
    throw new Error(`R2 presigned upload failed with ${response.status}: ${await response.text()}`);
  }

  return response.headers;
};

const mimeTypeForPath = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".png":
      return "image/png";
    default:
      throw new ExpectedBlocker(
        "UNSUPPORTED_SMOKE_MEDIA",
        "Set STREAM_PUMP_SMOKE_MEDIA_PATH to a png, jpg, webp, mp4, or mov file.",
        { mediaPath: filePath }
      );
  }
};

const getMediaBuffer = (
  mediaPath: string
): { body: Buffer; mimeType: string; source: string; isVideo: boolean } => {
  if (!existsSync(mediaPath)) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_MEDIA_NOT_FOUND",
      "STREAM_PUMP_SMOKE_MEDIA_PATH must point to an existing real media file."
    );
  }

  const mimeType = mimeTypeForPath(mediaPath);
  return {
    body: readFileSync(mediaPath),
    mimeType,
    source: path.resolve(mediaPath),
    isVideo: mimeType.startsWith("video/"),
  };
};

const sha256Hex = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

type RuntimeKeypair = Keypair;

const loadSolanaWeb3 = async () => import("@solana/web3.js");

const signTransactionBase64 = async (
  transactionBase64: string,
  keypair: RuntimeKeypair
): Promise<string> => {
  const { VersionedTransaction } = await loadSolanaWeb3();
  const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
  tx.sign([keypair]);
  return Buffer.from(tx.serialize()).toString("base64");
};

const keypairFromEnv = async (name: string): Promise<RuntimeKeypair | null> => {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const { Keypair } = await loadSolanaWeb3();
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
};

const signInWallet = async (wallet: RuntimeKeypair): Promise<AuthSessionResponse> => {
  const challenge = await request<AuthChallengeResponse>("/auth/challenge", {
    method: "POST",
    body: { wallet: wallet.publicKey.toBase58() },
  });
  const signature = ed25519.sign(
    Buffer.from(challenge.message, "utf8"),
    wallet.secretKey.slice(0, 32)
  );
  return request<AuthSessionResponse>("/auth/verify", {
    method: "POST",
    body: {
      wallet: wallet.publicKey.toBase58(),
      nonce: challenge.nonce,
      signature: bs58.encode(signature),
    },
  });
};

const completeUpload = async (
  creatorToken: string,
  manifestId: string,
  upload: PresignResponse["uploads"][number],
  body: Buffer,
  mimeType: string
) => {
  if (upload.uploadStrategy === "SINGLE_PART") {
    if (!upload.presignedUrl) {
      throw new Error("single-part upload is missing presignedUrl");
    }

    await uploadToPresignedUrl(upload.presignedUrl, body, mimeType);
    await request(`/content/manifests/${manifestId}/assets/${upload.assetId}/complete`, {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("asset-complete", uploadAttempt),
      },
    });
    return;
  }

  if (!upload.multipartUploadId || !upload.partSizeBytes || !upload.parts?.length) {
    throw new Error("multipart upload is missing upload id, part size, or parts");
  }

  const completedParts = [];
  for (const part of upload.parts.sort((left, right) => left.partNumber - right.partNumber)) {
    const start = (part.partNumber - 1) * upload.partSizeBytes;
    const end = Math.min(start + upload.partSizeBytes, body.length);
    const partBody = body.subarray(start, end);
    const headers = await uploadToPresignedUrl(part.presignedUrl, partBody, mimeType);
    const etag = headers.get("etag");
    if (!etag) {
      throw new Error(`R2 multipart part ${part.partNumber} did not return an ETag`);
    }
    completedParts.push({
      partNumber: part.partNumber,
      etag,
    });
  }

  await request(`/content/manifests/${manifestId}/assets/${upload.assetId}/complete`, {
    method: "POST",
    token: creatorToken,
    headers: {
      "x-idempotency-key": smokeIdempotencyKey("asset-complete", uploadAttempt),
    },
    body: {
      multipartUploadId: upload.multipartUploadId,
      parts: completedParts,
    },
  });
};

const pollMuxReadiness = async (
  creatorToken: string,
  manifestId: string,
  assetId: string,
  operatorKey: string
): Promise<AssetRecord | null> => {
  const deadline = Date.now() + Math.max(0, waitForMuxReadySeconds) * 1000;

  while (Date.now() <= deadline) {
    await request(`/internal/mux/assets/${assetId}/reconcile`, {
      method: "POST",
      headers: { "x-internal-operator-key": operatorKey },
    }).catch(() => null);
    const detail = await request<ManifestDetailResponse>(`/content/manifests/${manifestId}`, {
      token: creatorToken,
    });
    const asset = detail.assets.find((candidate) => candidate.assetId === assetId) ?? null;
    if (!asset || asset.processingStatus === "READY" || asset.processingStatus === "ERRORED") {
      return asset;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const detail = await request<ManifestDetailResponse>(`/content/manifests/${manifestId}`, {
    token: creatorToken,
  });
  return detail.assets.find((candidate) => candidate.assetId === assetId) ?? null;
};

const usdc = (value: number): string => String(Math.floor(value * 1_000_000));

const proposalDeadlineUnix = (): string => {
  const value = (process.env.STREAM_PUMP_SMOKE_PROPOSAL_DEADLINE_UNIX ?? "").trim();
  if (!/^\d+$/.test(value) || BigInt(value) <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_PROPOSAL_DEADLINE_UNIX_REQUIRED",
      "Set one stable future STREAM_PUMP_SMOKE_PROPOSAL_DEADLINE_UNIX and reuse it with the same smoke run id."
    );
  }
  return value;
};

const run = async () => {
  beginStage("environment validation");
  if (!smokeRunId) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_RUN_ID_REQUIRED",
      "Set a stable STREAM_PUMP_SMOKE_RUN_ID so an interrupted smoke can replay safely."
    );
  }
  const operatorKey = requireEnv("STREAM_PUMP_SMOKE_OPERATOR_KEY");
  const mediaPath = requireEnv("STREAM_PUMP_SMOKE_MEDIA_PATH");
  const creatorKeypair = await keypairFromEnv("STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON");
  const sponsorKeypair = await keypairFromEnv("STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON");
  if (!creatorKeypair || !sponsorKeypair) {
    throw new ExpectedBlocker(
      "EXTERNAL_WALLET_KEYPAIRS_REQUIRED",
      "Set disposable creator and sponsor keypairs; the smoke verifies the real wallet challenge/signature flow before using either session."
    );
  }
  artifacts.runId = smokeRunId;

  beginStage("external wallet authentication");
  const creatorSession = await signInWallet(creatorKeypair);
  const sponsorSession = await signInWallet(sponsorKeypair);
  const creatorToken = creatorSession.accessToken;
  const sponsorToken = sponsorSession.accessToken;
  const sponsorWallet = sponsorKeypair.publicKey.toBase58();
  artifacts.creatorWallet = creatorSession.wallet;
  artifacts.sponsorWallet = sponsorSession.wallet;
  const sponsorAccount = await request<AccountMeResponse>("/account/me", {
    token: sponsorToken,
  });
  if (
    sponsorAccount.wallet !== sponsorWallet ||
    sponsorAccount.storageStatus !== "LIVE" ||
    sponsorAccount.profile?.role !== "SPONSOR"
  ) {
    throw new ExpectedBlocker(
      "SPONSOR_ACCOUNT_NOT_READY",
      "The authenticated sponsor wallet must have a live SPONSOR account profile before launch.",
      {
        walletMatches: sponsorAccount.wallet === sponsorWallet,
        storageStatus: sponsorAccount.storageStatus,
        role: sponsorAccount.profile?.role ?? null,
      }
    );
  }
  addStep("creator and sponsor external-wallet challenge/signature sessions verified");

  beginStage("creator account verification");
  const account = await request<AccountMeResponse>("/account/me", { token: creatorToken });
  if (account.wallet !== creatorKeypair.publicKey.toBase58()) {
    throw new ExpectedBlocker(
      "CREATOR_SESSION_WALLET_MISMATCH",
      "The authenticated creator session does not match the configured creator keypair."
    );
  }
  artifacts.accountStorageStatus = account.storageStatus;

  if (account.storageStatus !== "LIVE") {
    throw new ExpectedBlocker(
      "ACCOUNT_PROFILE_MIGRATION_REQUIRED",
      "AccountProfile storage is not live for the current backend database. Apply the account profile Prisma migration before running the production corridor.",
      { storageStatus: account.storageStatus }
    );
  }
  addStep("authenticated creator session");

  if (
    account.profile?.role !== "CREATOR" ||
    account.profile.onboardingCompletedAt === null
  ) {
    if (!isTruthyEnv("STREAM_PUMP_SMOKE_ALLOW_PROFILE_UPDATE")) {
      throw new ExpectedBlocker(
        "CREATOR_PROFILE_REQUIRED",
        "The authenticated account is not an onboarded creator. Set STREAM_PUMP_SMOKE_ALLOW_PROFILE_UPDATE=1 for a disposable smoke account, or complete creator onboarding in the app.",
        { profile: account.profile as JsonValue }
      );
    }

    const updated = await request<AccountMeResponse>("/account/me", {
      method: "PUT",
      token: creatorToken,
      body: {
        role: "CREATOR",
        displayName: process.env.STREAM_PUMP_SMOKE_CREATOR_NAME?.trim() || "StreamPump Smoke Creator",
        handle: process.env.STREAM_PUMP_SMOKE_CREATOR_HANDLE?.trim() || `smoke-${smokeRunId}`,
        completeOnboarding: true,
      },
    });
    artifacts.updatedCreatorProfile = updated.profile as JsonValue;
    addStep("creator profile persisted");
  }

  beginStage("real media loading");
  const media = getMediaBuffer(mediaPath);
  artifacts.mediaSource = media.source;
  artifacts.mediaMimeType = media.mimeType;
  artifacts.mediaBytes = media.body.length;

  beginStage("content manifest creation");
  const manifest = await request<ContentManifestResponse>("/content/manifests", {
    method: "POST",
    token: creatorToken,
    headers: {
      "x-idempotency-key": smokeIdempotencyKey("manifest"),
    },
    body: {
      contentType: media.isVideo ? "SHORT_VIDEO" : "IMAGE_CAROUSEL",
      title: process.env.STREAM_PUMP_SMOKE_TITLE?.trim() || `Production corridor smoke ${smokeRunId}`,
      captionText:
        process.env.STREAM_PUMP_SMOKE_CAPTION?.trim() ||
        "Smoke-tested content published through the real StreamPump backend pipeline.",
      tags: ["smoke", "production-corridor"],
      metadata: {
        smoke: true,
        source: "scripts/smoke-production-corridor.ts",
      },
    },
  });
  artifacts.manifestId = manifest.manifestId;

  beginStage("media upload and storage verification");
  const presign = await request<PresignResponse>(
    `/content/manifests/${manifest.manifestId}/assets/presign`,
    {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("presign", uploadAttempt),
      },
      body: {
        assets: [
          {
            assetType: media.isVideo ? "VIDEO" : "IMAGE",
            orderIndex: 0,
            sha256Hex: sha256Hex(media.body),
            mimeType: media.mimeType,
            fileSizeBytes: String(media.body.length),
          },
        ],
      },
    }
  );
  const upload = presign.uploads[0];
  const completedAsset = presign.completedAssets?.find((asset) => asset.orderIndex === 0);
  if (!upload && !completedAsset) {
    throw new Error("backend did not return an upload plan");
  }
  if (upload) {
    await completeUpload(creatorToken, manifest.manifestId, upload, media.body, media.mimeType);
    addStep("R2 upload completed through backend presign");
  } else {
    addStep("previously verified R2 asset reused for this smoke run");
  }
  const assetId = upload?.assetId ?? (completedAsset as AssetRecord).assetId;

  if (media.isVideo) {
    await request("/internal/mux/reconcile/run-once", {
      method: "POST",
      headers: { "x-internal-operator-key": operatorKey },
    }).catch(() => {
      addBlocker(
        "MUX_RECONCILIATION_TRIGGER_FAILED",
        "Mux reconciliation could not be triggered during the media readiness stage."
      );
    });
    const muxAsset = await pollMuxReadiness(
      creatorToken,
      manifest.manifestId,
      assetId,
      operatorKey
    );
    artifacts.muxAsset = (muxAsset ?? null) as JsonValue;
    if (muxAsset?.processingStatus === "READY" && muxAsset.muxPlaybackId) {
      addStep("Mux playback ready");
    } else {
      addBlocker(
        "MUX_READY_NOT_VERIFIED",
        "Video upload reached the backend/R2 path, but Mux playback is not READY yet. Increase STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS or inspect Mux reconciliation/webhook status.",
        (muxAsset ?? { waitForMuxReadySeconds }) as JsonValue
      );
    }
  }

  beginStage("content manifest finalization");
  const finalized = await request<ManifestDetailResponse>(
    `/content/manifests/${manifest.manifestId}/finalize`,
    {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("finalize"),
      },
    }
  );
  artifacts.manifestHashHex = finalized.manifestHashHex;
  addStep("content manifest finalized");

  beginStage("publication creation and operator approval");
  const explicitPublicationUrl = process.env.STREAM_PUMP_SMOKE_PUBLICATION_URL?.trim();
  const publicationPlatform = explicitPublicationUrl
    ? requireEnv("STREAM_PUMP_SMOKE_PUBLICATION_PLATFORM")
    : "STREAMPUMP";
  const publicationUrl = explicitPublicationUrl ?? finalized.internalCanonicalUrl;
  if (!publicationUrl) {
    throw new ExpectedBlocker(
      "FINALIZED_CANONICAL_URL_MISSING",
      "The finalized manifest did not expose an internal canonical URL."
    );
  }
  const publication = await request<ContentPublicationResponse>("/content/publications", {
    method: "POST",
    token: creatorToken,
    headers: {
      "x-idempotency-key": smokeIdempotencyKey("publication"),
    },
    body: {
      manifestId: manifest.manifestId,
      platform: publicationPlatform,
      externalUrl: publicationUrl,
      externalPostId: `smoke-${manifest.manifestId}`,
    },
  });
  addStep("content publication recorded");

  const evidenceDigestHex = sha256Hex(
    Buffer.from(
      stableJson({
        manifestHashHex: finalized.manifestHashHex,
        manifestId: manifest.manifestId,
        mediaSha256Hex: sha256Hex(media.body),
        platform: publication.platform,
        publicationUrl: publication.externalUrl,
      }),
      "utf8"
    )
  );
  const reviewed = await request<PublicationReviewResponse>(
    `/internal/content/publications/${publication.publicationId}/review`,
    {
      method: "POST",
      headers: { "x-internal-operator-key": operatorKey },
      body: {
        decision: "APPROVE",
        note: "Production corridor smoke evidence verified by operator.",
        evidenceDigestHex,
      },
    }
  );
  if (
    reviewed.verificationStatus !== "VERIFIED" ||
    !reviewed.assetsReady ||
    !reviewed.publicFeedEligible
  ) {
    throw new ExpectedBlocker(
      "PUBLICATION_APPROVAL_INCOMPLETE",
      "Operator review completed without making the publication eligible for the public feed."
    );
  }
  artifacts.publicationId = publication.publicationId;
  artifacts.publicationEvidenceDigestHex = evidenceDigestHex;
  addStep("operator approved publication evidence");

  beginStage("public feed and post verification");
  const feed = await request<PublicFeedResponse>("/feed/posts?limit=24");
  const feedPost = feed.posts.find((post) => post.manifestId === manifest.manifestId);
  if (!feedPost) {
    throw new ExpectedBlocker(
      "FEED_PROJECTION_MISSING",
      "The published manifest did not appear in the backend public feed projection.",
      { manifestId: manifest.manifestId }
    );
  }
  addStep("explore/feed projection includes published content");

  const detail = await request<PublicPostResponse>(`/feed/posts/${manifest.manifestId}`);
  artifacts.postId = detail.post.postId;
  addStep("post detail projection loads from backend");

  beginStage("Track1-only proposal intent creation");
  let intent: IntentResponse;
  try {
    intent = await request<IntentResponse>("/proposal-intents", {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("proposal-intent"),
      },
      body: {
        manifestId: manifest.manifestId,
        creatorWallet: account.wallet,
        sponsorWallet,
        deadlineUnix: proposalDeadlineUnix(),
        track1BaseUsdc: usdc(25),
        track2MetricType: "VIEWS",
        track2TargetValue: "0",
        track2MinAchievementBps: 0,
        track2UsdcDeposited: "0",
        maxEndorsementSpump: "0",
        track3UsdcDeposited: "0",
        track3DelayDays: 0,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "CREATOR_NOT_S2_READY") {
      throw new ExpectedBlocker(
        "CREATOR_NOT_S2_READY",
        "The authenticated creator does not have an on-chain S2_ACTIVE profile with level >= 2, so a real proposal intent cannot be created yet.",
        { creatorWallet: account.wallet }
      );
    }
    throw error;
  }
  artifacts.intentId = intent.intentId;
  addStep("proposal intent created from published content");

  beginStage("proposal intent lock and bundle build");
  const locked = await request<IntentResponse>(`/proposal-intents/${intent.intentId}/lock`, {
    method: "POST",
    token: creatorToken,
    headers: {
      "x-idempotency-key": smokeIdempotencyKey("intent-lock"),
    },
  });
  artifacts.plannedProposalPda = locked.plannedProposalPda;
  addStep("proposal terms locked");

  const allowChainSubmit = isTruthyEnv("STREAM_PUMP_SMOKE_ALLOW_CHAIN_SUBMIT");
  const build = await request<BuildBundleResponse>(
    `/proposal-intents/${intent.intentId}/build-bundle`,
    {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("intent-build", bundleAttempt),
      },
      body: {
        submitMode: allowChainSubmit ? "SERVER_RELAY" : "CLIENT_RELAY",
        forceRebuild: true,
      },
    }
  );
  artifacts.bundleId = build.bundle.bundleId;
  artifacts.plannedContentAnchorPda = build.plannedContentAnchorPda;
  addStep("proposal launch bundle built");

  beginStage("proposal transaction signing");
  if (!build.bundle.versionedTxBase64) {
    throw new ExpectedBlocker(
      "CREATOR_SIGNATURE_REQUIRED",
      "Set STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON for a disposable creator wallet to continue from bundle build to campaign proof.",
      { bundleId: build.bundle.bundleId }
    );
  }

  const partiallySignedTxBase64 = await signTransactionBase64(
    build.bundle.versionedTxBase64,
    creatorKeypair
  );
  const creatorSigned = await request<{ intentId: string; bundle: BundleResponse }>(
    `/proposal-intents/${intent.intentId}/creator-partial-sign`,
    {
      method: "POST",
      token: creatorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("intent-creator-sign", bundleAttempt),
      },
      body: {
        bundleId: build.bundle.bundleId,
        partiallySignedTxBase64,
      },
    }
  );
  addStep("creator partial signature accepted");

  if (!allowChainSubmit) {
    throw new ExpectedBlocker(
      "SPONSOR_CHAIN_SUBMIT_REQUIRED",
      "Set STREAM_PUMP_SMOKE_ALLOW_CHAIN_SUBMIT=1 to relay the fully signed disposable-wallet proposal and verify campaign proof.",
      {
        allowChainSubmit,
      }
    );
  }

  const fullySignedTxBase64 = await signTransactionBase64(
    creatorSigned.bundle.partiallySignedTxBase64 ?? partiallySignedTxBase64,
    sponsorKeypair
  );
  beginStage("proposal transaction submission");
  const submitted = await request<SubmitBundleResponse>(
    `/proposal-intents/${intent.intentId}/submit`,
    {
      method: "POST",
      token: sponsorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("intent-submit", bundleAttempt),
      },
      body: {
        bundleId: build.bundle.bundleId,
        fullySignedTxBase64,
      },
      timeoutMs: 120_000,
    }
  );
  artifacts.relayStatus = submitted.relayStatus;
  artifacts.chainTxSignature = submitted.chainTxSignature ?? null;
  addStep("sponsor signature submitted");

  if (submitted.relayStatus !== "CONFIRMED") {
    throw new ExpectedBlocker(
      "CAMPAIGN_NOT_CONFIRMED",
      "The proposal transaction was submitted but did not reach a confirmed campaign projection yet.",
      { relayStatus: submitted.relayStatus, chainTxSignature: submitted.chainTxSignature ?? null }
    );
  }

  const proposalId = build.plannedProposalPda ?? locked.plannedProposalPda;
  if (!proposalId) {
    throw new ExpectedBlocker(
      "PROPOSAL_PDA_MISSING",
      "The confirmed launch did not expose a proposal PDA for campaign detail verification."
    );
  }

  beginStage("campaign proof verification");
  const proposal = await request<ProposalResponse>(`/proposals/${proposalId}`, {
    token: sponsorToken,
  });
  artifacts.proposal = proposal.proposal as JsonValue;
  const publicProof = await request<PublicCampaignProofResponse>(
    `/campaigns/${encodeURIComponent(proposalId)}/public`
  );
  const requiredIntegrity = [
    "manifestFinalized",
    "assetsReady",
    "operatorApprovedPublication",
    "contentHashMatchesManifest",
    "contentAnchorMatchesManifest",
    "contentAnchorTransactionPresent",
    "track1OnlyBudget",
  ];
  const failedIntegrity = requiredIntegrity.filter(
    (key) => publicProof.integrity?.[key] !== true
  );
  const publicProofMismatch =
    publicProof.proposalPda !== proposalId ||
    publicProof.manifest?.manifestId !== manifest.manifestId ||
    publicProof.manifest?.manifestHashHex !== finalized.manifestHashHex ||
    publicProof.proof.contentHashHex !== finalized.manifestHashHex ||
    publicProof.manifest?.currentAnchorPda !== publicProof.proof.contentAnchorPda ||
    !publicProof.proof.contentAnchorTx ||
    !publicProof.proof.fundingTxSignature;
  if (publicProofMismatch || failedIntegrity.length > 0) {
    throw new ExpectedBlocker(
      "PUBLIC_CAMPAIGN_PROOF_INCOMPLETE",
      "The confirmed launch did not produce a complete public manifest/anchor/funding proof.",
      {
        publicProofMismatch,
        failedIntegrity,
      }
    );
  }
  artifacts.publicCampaignProof = {
    proposalPda: publicProof.proposalPda,
    proofStatus: publicProof.proofStatus,
    manifestId: publicProof.manifest.manifestId,
    contentAnchorTx: publicProof.proof.contentAnchorTx,
    fundingTxSignature: publicProof.proof.fundingTxSignature,
    integrity: publicProof.integrity ?? {},
  } as JsonValue;
  addStep("authenticated proposal and complete public campaign proof verified");
};

run()
  .then(() => {
    if (blockers.length > 0) {
      printSummary(false);
      process.exit(2);
    }

    printSummary(true);
  })
  .catch((error) => {
    if (error instanceof ExpectedBlocker) {
      addBlocker(error.code, error.message, error.details);
      printSummary(false);
      process.exit(2);
    }

    if (error instanceof ApiError) {
      addBlocker("API_STAGE_FAILED", `API request failed during ${activeStage}.`, {
        stage: activeStage,
        status: error.status,
        code: error.code,
      });
      printSummary(false);
      process.exit(1);
    }

    addBlocker("STAGE_FAILED", `Smoke failed during ${activeStage}.`, { stage: activeStage });
    printSummary(false);
    process.exit(1);
  });

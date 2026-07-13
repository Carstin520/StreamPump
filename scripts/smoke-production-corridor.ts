/**
 * End-to-end smoke for the controlled technical Pilot corridor:
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
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, type Keypair } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import {
  PilotCorridorConfigError,
  M6_PILOT_TEST_USDC_MINT,
  M6_TRACK1_BASE_RAW,
  assertDedicatedDevnetRpcUrl,
  buildPilotTestSponsorProfile,
  buildPilotTestSponsorReviewMarker,
  formatRawUsdc,
  loadExclusiveKeypairInput,
  loadM6ActorPrepEvidence,
  parseTrack1BaseRaw,
} from "./pilot-corridor-config";

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

type ProposalIntentReadinessResponse = {
  ready: boolean;
  creator: {
    wallet: string;
    source: "SOLANA_CHAIN";
    profileFound: boolean;
    level: number | null;
    status: string | null;
    ready: boolean;
  };
  sponsor: {
    wallet: string;
    source: "DATABASE";
    status: string | null;
    ready: boolean;
    classification: "UNAPPROVED" | "KYB_APPROVED" | "PILOT_TEST_ONLY";
  };
  blockers: Array<{ code: string; message: string }>;
};

type SponsorDocumentPresignResponse = {
  storageKey: string;
  mimeType: string;
  fileName: string;
  documentType: string;
  presignedUrl: string;
};

type SponsorProfileResponse = {
  id: string;
  wallet: string;
  companyName: string;
  status: string;
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

let waitForMuxReadySeconds = 0;
const smokeRunId = (process.env.STREAM_PUMP_SMOKE_RUN_ID ?? "").trim();
const uploadAttempt = (process.env.STREAM_PUMP_SMOKE_UPLOAD_ATTEMPT ?? "1").trim();
const bundleAttempt = (process.env.STREAM_PUMP_SMOKE_BUNDLE_ATTEMPT ?? "1").trim();

const smokeIdempotencyKey = (stage: string, attempt?: string): string =>
  ["pilot-corridor", smokeRunId, stage, attempt].filter(Boolean).join(":");

const readBooleanEnv = (name: string, fallback = false): boolean => {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  throw new ExpectedBlocker(
    `${name}_INVALID_BOOLEAN`,
    `${name} must be one of 1/true/yes or 0/false/no.`
  );
};

const readMuxWaitSeconds = (m6Mode: boolean): number => {
  const raw = process.env.STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS?.trim();
  if (!raw) {
    if (m6Mode) {
      throw new ExpectedBlocker(
        "STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS_REQUIRED",
        "M6 requires a positive bounded Mux readiness wait before any API mutation."
      );
    }
    return 0;
  }
  if (!/^\d+$/.test(raw)) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS_INVALID",
      "STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS must be an integer from 0 to 1800."
    );
  }
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds > 1800 || (m6Mode && seconds <= 0)) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS_INVALID",
      "STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS must be an integer from 0 to 1800 and positive in M6."
    );
  }
  return seconds;
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
      `Set ${name} before running the controlled Pilot corridor smoke.`
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

type LoadedMedia = ReturnType<typeof getMediaBuffer>;

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

const simulateFullySignedPilotTransaction = async (transactionBase64: string): Promise<void> => {
  const rpcEndpoint = requireEnv("PILOT_TX_RPC_URL");
  let rpcUrl: URL;
  try {
    rpcUrl = new URL(rpcEndpoint);
  } catch {
    throw new ExpectedBlocker("DEDICATED_RPC_REQUIRED", "PILOT_TX_RPC_URL must be an absolute URL.");
  }
  if (
    rpcUrl.protocol !== "https:" ||
    rpcUrl.username ||
    rpcUrl.password ||
    ["api.devnet.solana.com", "api.mainnet-beta.solana.com"].includes(rpcUrl.hostname.toLowerCase())
  ) {
    throw new ExpectedBlocker(
      "DEDICATED_RPC_REQUIRED",
      "PILOT_TX_RPC_URL must be a credential-free dedicated HTTPS devnet endpoint."
    );
  }
  const { Connection, VersionedTransaction } = await loadSolanaWeb3();
  const connection = new Connection(rpcEndpoint, "confirmed");
  const genesis = await connection.getGenesisHash();
  if (genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") {
    throw new ExpectedBlocker("SOLANA_DEVNET_REQUIRED", "PILOT_TX_RPC_URL is not Solana devnet.");
  }
  const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
  const simulation = await connection.simulateTransaction(transaction, {
    commitment: "confirmed",
    sigVerify: true,
  });
  if (simulation.value.err) {
    throw new ExpectedBlocker(
      "PROPOSAL_TRANSACTION_SIMULATION_FAILED",
      "The fully signed Track1-only launch transaction failed simulation; no submission was attempted."
    );
  }
  artifacts.chainSimulation = {
    cluster: "SOLANA_DEVNET",
    rpcHost: rpcUrl.hostname,
    signatureVerification: true,
    passed: true,
    unitsConsumed: simulation.value.unitsConsumed ?? null,
  };
  addStep("fully signed Track1-only launch transaction simulated on devnet");
};

const keypairFromConfiguredInput = async (
  pathName: string,
  jsonName: string,
  pathOnly = false
): Promise<{ keypair: RuntimeKeypair; source: string }> => {
  let input;
  try {
    input = loadExclusiveKeypairInput(process.env, pathName, jsonName, { pathOnly });
  } catch (error) {
    if (error instanceof PilotCorridorConfigError) {
      throw new ExpectedBlocker(error.code, error.message);
    }
    throw error;
  }
  const { Keypair } = await loadSolanaWeb3();
  try {
    return {
      keypair: Keypair.fromSecretKey(Uint8Array.from(input.secretKey)),
      source: input.source,
    };
  } catch {
    throw new ExpectedBlocker(
      `${pathName}_INVALID_KEYPAIR`,
      `${pathName} or legacy ${jsonName} does not contain a valid Solana keypair.`
    );
  }
};

const getTrack1BaseRaw = (): bigint => {
  try {
    return parseTrack1BaseRaw(process.env.STREAM_PUMP_SMOKE_TRACK1_BASE_RAW);
  } catch (error) {
    if (error instanceof PilotCorridorConfigError) {
      throw new ExpectedBlocker(error.code, error.message);
    }
    throw error;
  }
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

const fetchReadiness = (
  token: string,
  creatorWallet: string,
  sponsorWallet: string
): Promise<ProposalIntentReadinessResponse> =>
  request<ProposalIntentReadinessResponse>(
    `/proposal-intents/readiness?creatorWallet=${encodeURIComponent(creatorWallet)}&sponsorWallet=${encodeURIComponent(sponsorWallet)}`,
    { token, headers: { "x-pilot-run-id": smokeRunId } }
  );

const preparePilotTestSponsor = async (params: {
  sponsorToken: string;
  sponsorWallet: string;
  operatorKey: string;
  authorized: boolean;
  document: LoadedMedia | null;
}) => {
  if (!params.authorized) {
    throw new ExpectedBlocker(
      "TEST_SPONSOR_PREP_NOT_AUTHORIZED",
      "Sponsor readiness is not approved. Set STREAM_PUMP_SMOKE_ALLOW_TEST_SPONSOR_PREP=1 only for an explicitly authorized disposable PILOT TEST ONLY sponsor."
    );
  }
  const document = params.document;
  if (!document || document.isVideo) {
    throw new ExpectedBlocker(
      "SPONSOR_DOCUMENT_IMAGE_REQUIRED",
      "An explicitly prevalidated, independent PILOT TEST ONLY sponsor document image is required."
    );
  }

  const presign = await request<SponsorDocumentPresignResponse>(
    "/auth/sponsor/documents/presign",
    {
      method: "POST",
      token: params.sponsorToken,
      body: {
        documentType: "BUSINESS_LICENSE",
        fileName: `PILOT-TEST-ONLY-${smokeRunId}${path.extname(document.source)}`,
        mimeType: document.mimeType,
        fileSizeBytes: document.body.length,
      },
    }
  );
  await uploadToPresignedUrl(presign.presignedUrl, document.body, document.mimeType);
  const profile = await request<SponsorProfileResponse>("/auth/sponsor/register", {
    method: "POST",
    token: params.sponsorToken,
    body: buildPilotTestSponsorProfile(smokeRunId, presign.storageKey),
  });
  if (profile.wallet !== params.sponsorWallet || profile.status !== "PENDING_REVIEW") {
    throw new ExpectedBlocker(
      "TEST_SPONSOR_REGISTRATION_INCOMPLETE",
      "The PILOT TEST ONLY SponsorProfile did not enter PENDING_REVIEW for the disposable sponsor wallet."
    );
  }
  const reviewed = await request<SponsorProfileResponse>(
    `/internal/sponsors/${encodeURIComponent(profile.id)}/verify`,
    {
      method: "POST",
      headers: { "x-internal-operator-key": params.operatorKey },
      body: {
        decision: "APPROVED",
        note: JSON.stringify(buildPilotTestSponsorReviewMarker(smokeRunId, params.sponsorWallet)),
      },
    }
  );
  if (reviewed.wallet !== params.sponsorWallet || reviewed.status !== "APPROVED") {
    throw new ExpectedBlocker(
      "TEST_SPONSOR_OPERATOR_APPROVAL_INCOMPLETE",
      "Operator review did not approve the disposable PILOT TEST ONLY sponsor profile."
    );
  }

  artifacts.testSponsorPreparation = {
    classification: "PILOT_TEST_ONLY_NOT_REAL_KYB",
    documentMimeType: document.mimeType,
    documentBytes: document.body.length,
    documentSha256Hex: sha256Hex(document.body),
    profileId: profile.id,
    status: reviewed.status,
  };
  addStep("explicitly authorized PILOT TEST ONLY sponsor profile prepared and operator-approved");
};

const ensureCreatorAccount = async (params: {
  creatorToken: string;
  creatorWallet: string;
  allowProfileUpdate: boolean;
}): Promise<AccountMeResponse> => {
  beginStage("creator account verification");
  let account = await request<AccountMeResponse>("/account/me", { token: params.creatorToken });
  if (account.wallet !== params.creatorWallet) {
    throw new ExpectedBlocker(
      "CREATOR_SESSION_WALLET_MISMATCH",
      "The authenticated creator session does not match the configured creator keypair."
    );
  }
  artifacts.accountStorageStatus = account.storageStatus;
  if (account.storageStatus !== "LIVE") {
    throw new ExpectedBlocker(
      "ACCOUNT_PROFILE_MIGRATION_REQUIRED",
      "AccountProfile storage is not live for the current backend database. Apply the approved Pilot migration before running the corridor.",
      { storageStatus: account.storageStatus }
    );
  }
  if (account.profile?.role !== "CREATOR" || account.profile.onboardingCompletedAt === null) {
    if (!params.allowProfileUpdate) {
      throw new ExpectedBlocker(
        "CREATOR_PROFILE_REQUIRED",
        "The authenticated account is not an onboarded creator and disposable profile update was not explicitly authorized.",
        { profile: account.profile as JsonValue }
      );
    }
    account = await request<AccountMeResponse>("/account/me", {
      method: "PUT",
      token: params.creatorToken,
      body: {
        role: "CREATOR",
        displayName: process.env.STREAM_PUMP_SMOKE_CREATOR_NAME?.trim() || "PILOT TEST ONLY Creator",
        handle: process.env.STREAM_PUMP_SMOKE_CREATOR_HANDLE?.trim() || `smoke-${smokeRunId}`,
        completeOnboarding: true,
      },
    });
    if (
      account.wallet !== params.creatorWallet ||
      account.storageStatus !== "LIVE" ||
      account.profile?.role !== "CREATOR" ||
      account.profile.onboardingCompletedAt === null
    ) {
      throw new ExpectedBlocker(
        "CREATOR_PROFILE_UPDATE_INCOMPLETE",
        "The explicitly authorized disposable creator profile update did not persist a live onboarded creator."
      );
    }
    artifacts.updatedCreatorProfile = account.profile as JsonValue;
    addStep("PILOT TEST ONLY creator profile persisted");
  }
  addStep("authenticated creator account verified");
  return account;
};

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

const M6_DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

const runConfigCheck = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PilotCorridorConfigError) {
      throw new ExpectedBlocker(error.code, error.message);
    }
    throw error;
  }
};

const run = async () => {
  beginStage("environment validation");
  if (!smokeRunId) {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_RUN_ID_REQUIRED",
      "Set a stable STREAM_PUMP_SMOKE_RUN_ID so an interrupted smoke can replay safely."
    );
  }
  const m6Mode = readBooleanEnv("STREAM_PUMP_SMOKE_M6_MODE");
  const allowChainSubmit = readBooleanEnv("STREAM_PUMP_SMOKE_ALLOW_CHAIN_SUBMIT");
  const allowProfileUpdate = readBooleanEnv("STREAM_PUMP_SMOKE_ALLOW_PROFILE_UPDATE");
  const allowTestSponsorPrep = readBooleanEnv("STREAM_PUMP_SMOKE_ALLOW_TEST_SPONSOR_PREP");
  waitForMuxReadySeconds = readMuxWaitSeconds(m6Mode);
  try {
    const configuredApiUrl = new URL(apiBaseUrl);
    if (configuredApiUrl.username || configuredApiUrl.password || (m6Mode && configuredApiUrl.protocol !== "https:")) {
      throw new Error("unsafe API URL");
    }
  } catch {
    throw new ExpectedBlocker(
      "STREAM_PUMP_SMOKE_API_BASE_URL_INVALID",
      "The API base URL must be absolute, credential-free, and HTTPS in M6."
    );
  }
  const operatorKey = requireEnv("STREAM_PUMP_SMOKE_OPERATOR_KEY");
  const mediaPath = requireEnv("STREAM_PUMP_SMOKE_MEDIA_PATH");
  const proposalDeadline = proposalDeadlineUnix();
  const track1BaseRaw = getTrack1BaseRaw();
  if (!allowChainSubmit) {
    throw new ExpectedBlocker(
      "SPONSOR_CHAIN_SUBMIT_REQUIRED",
      "Set STREAM_PUMP_SMOKE_ALLOW_CHAIN_SUBMIT=1 before any API mutation for the full corridor smoke."
    );
  }
  if (m6Mode && track1BaseRaw !== M6_TRACK1_BASE_RAW) {
    throw new ExpectedBlocker(
      "M6_TRACK1_EXACT_BUDGET_REQUIRED",
      `M6 requires the exact ${M6_TRACK1_BASE_RAW} raw test-USDC Track1 budget.`
    );
  }
  if (m6Mode && (!allowProfileUpdate || !allowTestSponsorPrep)) {
    throw new ExpectedBlocker(
      "M6_DISPOSABLE_PROFILE_PREP_AUTHORIZATION_REQUIRED",
      "M6 requires explicit creator profile update and PILOT TEST ONLY sponsor preparation authorization before any API mutation."
    );
  }
  const creatorInput = await keypairFromConfiguredInput(
    "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH",
    "STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON",
    m6Mode
  );
  const sponsorInput = await keypairFromConfiguredInput(
    "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH",
    "STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_JSON",
    m6Mode
  );
  const creatorKeypair = creatorInput.keypair;
  const sponsorKeypair = sponsorInput.keypair;
  if (creatorKeypair.publicKey.equals(sponsorKeypair.publicKey)) {
    throw new ExpectedBlocker(
      "DISTINCT_EXTERNAL_WALLETS_REQUIRED",
      "Disposable creator and sponsor must be distinct external wallets."
    );
  }
  const creatorWallet = creatorKeypair.publicKey.toBase58();
  const sponsorWallet = sponsorKeypair.publicKey.toBase58();
  const media = getMediaBuffer(mediaPath);
  if (m6Mode && !media.isVideo) {
    throw new ExpectedBlocker(
      "M6_VIDEO_MEDIA_REQUIRED",
      "M6 requires a real mp4 or mov video so the R2, Mux, webhook, and playback corridor is exercised."
    );
  }
  const explicitPublicationUrl = process.env.STREAM_PUMP_SMOKE_PUBLICATION_URL?.trim();
  const publicationPlatform = explicitPublicationUrl
    ? requireEnv("STREAM_PUMP_SMOKE_PUBLICATION_PLATFORM")
    : "STREAMPUMP";
  if (explicitPublicationUrl) {
    try {
      const url = new URL(explicitPublicationUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe URL");
    } catch {
      throw new ExpectedBlocker(
        "STREAM_PUMP_SMOKE_PUBLICATION_URL_INVALID",
        "An explicit publication URL must be credential-free HTTPS before any API mutation."
      );
    }
  }
  let sponsorDocument: LoadedMedia | null = null;
  if (allowTestSponsorPrep) {
    const documentPath = requireEnv("STREAM_PUMP_SMOKE_SPONSOR_DOCUMENT_IMAGE_PATH");
    if (path.resolve(documentPath) === path.resolve(mediaPath)) {
      throw new ExpectedBlocker(
        "INDEPENDENT_SPONSOR_DOCUMENT_REQUIRED",
        "The PILOT TEST ONLY sponsor document must be separate from creator media."
      );
    }
    sponsorDocument = getMediaBuffer(documentPath);
    if (sponsorDocument.isVideo || sponsorDocument.body.length > 12 * 1024 * 1024) {
      throw new ExpectedBlocker(
        "SPONSOR_DOCUMENT_IMAGE_REQUIRED",
        "The prevalidated sponsor document must be a png, jpg, or webp image no larger than 12 MiB."
      );
    }
  }

  if (m6Mode) {
    const actorEvidencePath = requireEnv("STREAM_PUMP_SMOKE_ACTOR_PREP_EVIDENCE_PATH");
    const actorBinding = runConfigCheck(() =>
      loadM6ActorPrepEvidence({
        evidencePath: actorEvidencePath,
        runId: smokeRunId,
        creator: creatorWallet,
        sponsor: sponsorWallet,
      })
    );
    const expectedMint = requireEnv("PILOT_EXPECTED_USDC_MINT");
    if (expectedMint !== M6_PILOT_TEST_USDC_MINT) {
      throw new ExpectedBlocker(
        "M6_TEST_USDC_MINT_MISMATCH",
        "PILOT_EXPECTED_USDC_MINT must match the frozen M6 test-USDC mint."
      );
    }
    const rpcEndpoint = runConfigCheck(() =>
      assertDedicatedDevnetRpcUrl(requireEnv("PILOT_TX_RPC_URL"))
    );
    beginStage("M6 dedicated devnet sponsor budget preflight");
    const connection = new Connection(rpcEndpoint, "confirmed");
    let sponsorAtaBalance: bigint;
    let sponsorAta: PublicKey;
    try {
      if ((await connection.getGenesisHash()) !== M6_DEVNET_GENESIS) {
        throw new ExpectedBlocker("M6_DEVNET_REQUIRED", "PILOT_TX_RPC_URL is not Solana devnet.");
      }
      const mint = new PublicKey(M6_PILOT_TEST_USDC_MINT);
      sponsorAta = getAssociatedTokenAddressSync(mint, sponsorKeypair.publicKey, false, TOKEN_PROGRAM_ID);
      const account = await getAccount(connection, sponsorAta, "confirmed", TOKEN_PROGRAM_ID);
      if (!account.owner.equals(sponsorKeypair.publicKey) || !account.mint.equals(mint)) {
        throw new ExpectedBlocker(
          "M6_SPONSOR_ATA_AUTHORITY_MISMATCH",
          "The disposable sponsor ATA owner or mint does not match actor-prep evidence."
        );
      }
      sponsorAtaBalance = account.amount;
    } catch (error) {
      if (error instanceof ExpectedBlocker) throw error;
      throw new ExpectedBlocker(
        "M6_SPONSOR_BUDGET_PREFLIGHT_FAILED",
        "The dedicated devnet RPC could not prove the disposable sponsor test-USDC ATA."
      );
    }
    if (sponsorAtaBalance < M6_TRACK1_BASE_RAW) {
      throw new ExpectedBlocker(
        "M6_SPONSOR_BUDGET_INSUFFICIENT",
        "The disposable sponsor ATA has less than the exact M6 Track1 test-USDC budget."
      );
    }
    artifacts.actorPrepEvidence = actorBinding as unknown as JsonValue;
    artifacts.sponsorBudgetPreflight = {
      ata: sponsorAta.toBase58(),
      mint: M6_PILOT_TEST_USDC_MINT,
      balanceRaw: sponsorAtaBalance.toString(),
      requiredRaw: M6_TRACK1_BASE_RAW.toString(),
      dedicatedDevnetRpcVerified: true,
    };
  }
  artifacts.runId = smokeRunId;
  artifacts.pilotBoundaries = {
    m6Mode,
    inviteOnly: true,
    externalWalletFirst: true,
    network: "SOLANA_DEVNET",
    asset: "TEST_USDC_ONLY",
    settlement: "TRACK1_MANUAL_OPERATOR_ONLY",
    realFunds: false,
  };
  artifacts.budgetEvidence = {
    track1BaseRaw: track1BaseRaw.toString(),
    track1BaseTestUsdc: formatRawUsdc(track1BaseRaw),
    track2Raw: "0",
    track3Raw: "0",
    safetyCapRaw: "25000000",
  };
  artifacts.mediaSource = media.source;
  artifacts.mediaMimeType = media.mimeType;
  artifacts.mediaBytes = media.body.length;

  beginStage("external wallet authentication");
  const creatorSession = await signInWallet(creatorKeypair);
  const sponsorSession = await signInWallet(sponsorKeypair);
  const creatorToken = creatorSession.accessToken;
  const sponsorToken = sponsorSession.accessToken;
  artifacts.creatorWallet = creatorSession.wallet;
  artifacts.sponsorWallet = sponsorSession.wallet;
  artifacts.actorEvidence = {
    creator: { wallet: creatorWallet, keypairInput: creatorInput.source },
    sponsor: { wallet: sponsorWallet, keypairInput: sponsorInput.source },
    distinctWallets: true,
  };
  if (creatorSession.wallet !== creatorWallet || sponsorSession.wallet !== sponsorWallet) {
    throw new ExpectedBlocker(
      "EXTERNAL_WALLET_SESSION_MISMATCH",
      "Wallet challenge sessions must match both configured disposable external wallets."
    );
  }
  addStep("creator and sponsor external-wallet challenge/signature sessions verified");

  beginStage("read-only creator chain and sponsor database readiness preflight");
  let readiness = await fetchReadiness(sponsorToken, creatorWallet, sponsorWallet);
  artifacts.initialReadiness = readiness as unknown as JsonValue;
  if (!readiness.creator.ready) {
    throw new ExpectedBlocker(
      "CREATOR_NOT_S2_READY",
      "Read-only product API preflight did not verify an on-chain S2_ACTIVE creator profile with level >= 2. No media or manifest mutation was attempted.",
      readiness.creator as unknown as JsonValue
    );
  }
  const account = await ensureCreatorAccount({
    creatorToken,
    creatorWallet,
    allowProfileUpdate,
  });
  if (!readiness.sponsor.ready) {
    beginStage("explicitly authorized PILOT TEST ONLY sponsor preparation");
    await preparePilotTestSponsor({
      sponsorToken,
      sponsorWallet,
      operatorKey,
      authorized: allowTestSponsorPrep,
      document: sponsorDocument,
    });
    beginStage("post-preparation read-only readiness preflight");
    readiness = await fetchReadiness(sponsorToken, creatorWallet, sponsorWallet);
  }
  artifacts.finalReadiness = readiness as unknown as JsonValue;
  if (!readiness.ready || !readiness.creator.ready || !readiness.sponsor.ready) {
    throw new ExpectedBlocker(
      "PILOT_ACTOR_READINESS_NOT_VERIFIED",
      "Read-only product API did not verify both chain-sourced creator readiness and database-sourced sponsor approval. No media or manifest mutation was attempted.",
      { blockers: readiness.blockers } as unknown as JsonValue
    );
  }
  if (m6Mode && readiness.sponsor.classification !== "PILOT_TEST_ONLY") {
    throw new ExpectedBlocker(
      "M6_TEST_SPONSOR_CLASSIFICATION_REQUIRED",
      "M6 requires the disposable sponsor approval to be durably classified as PILOT TEST ONLY for this run."
    );
  }
  addStep("read-only chain creator and database sponsor readiness verified before content mutation");

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

  beginStage("content manifest creation");
  const manifest = await request<ContentManifestResponse>("/content/manifests", {
    method: "POST",
    token: creatorToken,
    headers: {
      "x-idempotency-key": smokeIdempotencyKey("manifest"),
    },
    body: {
      contentType: media.isVideo ? "SHORT_VIDEO" : "IMAGE_CAROUSEL",
      title: process.env.STREAM_PUMP_SMOKE_TITLE?.trim() || `PILOT TEST ONLY corridor ${smokeRunId}`,
      captionText:
        process.env.STREAM_PUMP_SMOKE_CAPTION?.trim() ||
        "PILOT TEST ONLY content sent through the controlled StreamPump technical corridor.",
      tags: ["smoke", "pilot-test-only"],
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
    try {
      await request("/internal/mux/reconcile/run-once", {
        method: "POST",
        headers: { "x-internal-operator-key": operatorKey },
      });
    } catch {
      throw new ExpectedBlocker(
        "MUX_RECONCILIATION_TRIGGER_FAILED",
        "Mux reconciliation could not be verified; the Pilot corridor stopped before proposal creation."
      );
    }
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
      throw new ExpectedBlocker(
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
        note: "PILOT TEST ONLY technical corridor evidence verified by operator; not production truth.",
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
        "x-pilot-run-id": smokeRunId,
      },
      body: {
        manifestId: manifest.manifestId,
        creatorWallet: account.wallet,
        sponsorWallet,
        deadlineUnix: proposalDeadline,
        track1BaseUsdc: track1BaseRaw.toString(),
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
      "Provide the disposable creator keypair via STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH (preferred) or legacy STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_JSON to continue.",
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

  const fullySignedTxBase64 = await signTransactionBase64(
    creatorSigned.bundle.partiallySignedTxBase64 ?? partiallySignedTxBase64,
    sponsorKeypair
  );
  beginStage("proposal transaction simulation");
  await simulateFullySignedPilotTransaction(fullySignedTxBase64);
  beginStage("proposal transaction submission");
  const submitted = await request<SubmitBundleResponse>(
    `/proposal-intents/${intent.intentId}/submit`,
    {
      method: "POST",
      token: sponsorToken,
      headers: {
        "x-idempotency-key": smokeIdempotencyKey("intent-submit", bundleAttempt),
        "x-pilot-run-id": smokeRunId,
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

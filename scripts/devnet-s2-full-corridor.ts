import "../backend/config/loadEnv";

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import * as anchor from "@coral-xyz/anchor";
import { ed25519 } from "@noble/curves/ed25519";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

type StoredKeypair = {
  publicKey: string;
  secretKey: number[];
};

type S2State = {
  rpcEndpoint: string;
  programId: string;
  admin: StoredKeypair;
  oracle: StoredKeypair;
  creator: StoredKeypair;
  sponsor: StoredKeypair;
  usdcMint?: string;
};

type S1State = {
  sponsor: StoredKeypair;
  fans: StoredKeypair[];
  spumpMint: string | StoredKeypair;
  usdcMint?: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type AuthChallenge = {
  nonce: string;
  message: string;
};

type AuthSession = {
  wallet: string;
  accessToken: string;
};

type AccountMe = {
  wallet: string;
  storageStatus: string;
  profile: {
    role: string;
    displayName: string | null;
    handle: string | null;
    onboardingCompletedAt: string | null;
  } | null;
};

type ManifestDetail = {
  manifestId: string;
  manifestHashHex: string | null;
  currentAnchorPda: string | null;
  assets: Array<{
    assetId: string;
    assetType: string;
    uploadStatus?: string;
    processingStatus: string;
    muxAssetId: string | null;
    muxPlaybackId: string | null;
    muxLastKnownStatus: string | null;
  }>;
};

type PresignResponse = {
  manifestId: string;
  uploads: Array<{
    assetId: string;
    uploadStrategy: "SINGLE_PART" | "MULTIPART";
    presignedUrl?: string;
    multipartUploadId?: string;
    partSizeBytes?: number;
    parts?: Array<{
      partNumber: number;
      presignedUrl: string;
    }>;
  }>;
};

type FeedResponse = {
  posts: Array<{
    postId: string;
    manifestId: string;
    status: string;
  }>;
};

type IntentResponse = {
  intentId: string;
  status: string;
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
  chainTxSignature: string | null;
};

type CampaignPublicResponse = {
  proposalPda: string;
  status: string;
  proofStatus: string;
};

type ScenarioConfig = {
  name: "full-capped" | "partial" | "below-cliff";
  sponsor: Keypair;
  deadlineOffsetSeconds: number;
  actualValue: number;
  track1BaseUsdc: bigint;
  track2BudgetUsdc: bigint;
  track3BudgetUsdc: bigint;
  track3ApprovedUsdc: bigint;
  fanStakes: Array<{
    fan: Keypair;
    amount: bigint;
  }>;
};

type FanSnapshot = {
  fan: PublicKey;
  fanSpumpAta: PublicKey;
  fanUsdcAta: PublicKey;
  endorsementPosition: PublicKey;
  stake: bigint;
  spumpBefore: bigint;
  usdcBefore: bigint;
};

class ExpectedBlocker extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ExpectedBlocker";
  }
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ROOT = process.cwd();
const S2_STATE_PATH = path.resolve(ROOT, ".local/devnet-s2-happy-path.json");
const S1_STATE_PATH = path.resolve(ROOT, ".local/devnet-s1-buyout-claim-seed.json");
const MEDIA_PATH = path.resolve(ROOT, "test_files/test_mux.mp4");
const API_BASE_URL = (process.env.STREAM_PUMP_FULL_CORRIDOR_API_BASE_URL || "http://localhost:4000/api/v1")
  .trim()
  .replace(/\/+$/, "");
const HEALTH_URL = API_BASE_URL.replace(/\/api\/v1$/, "/health");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const MUX_READY_TIMEOUT_MS = Number(process.env.STREAM_PUMP_FULL_CORRIDOR_MUX_TIMEOUT_MS ?? 10 * 60_000);
const POLL_INTERVAL_MS = 10_000;
const RPC_THROTTLE_MS = Number(process.env.STREAM_PUMP_FULL_CORRIDOR_RPC_THROTTLE_MS ?? 1_500);
const TRACK2_TARGET_VALUE = 1_000n;
const TRACK2_MIN_ACHIEVEMENT_BPS = 5_000;

const log = (message: string) => console.log(`[s2-full] ${message}`);
const short = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;
const usdc = (value: number) => BigInt(Math.floor(value * 1_000_000));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stringifyJson = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry),
    2
  );

const readJson = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;
const keypairFromStored = (stored: StoredKeypair): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));

const spumpMintFromState = (state: S1State): string =>
  typeof state.spumpMint === "string" ? state.spumpMint : state.spumpMint.publicKey;

const sha256Hex = (body: Buffer): string => createHash("sha256").update(body).digest("hex");

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
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${route}`, {
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
        parsed?.error?.message ?? text,
        parsed?.error?.details
      );
    }
    return parsed && typeof parsed === "object" && "ok" in parsed ? (parsed.data as T) : (parsed as T);
  } finally {
    clearTimeout(timeout);
  }
};

const signInWallet = async (wallet: Keypair): Promise<AuthSession> => {
  const challenge = await request<AuthChallenge>("/auth/challenge", {
    method: "POST",
    body: { wallet: wallet.publicKey.toBase58() },
  });
  const signature = ed25519.sign(Buffer.from(challenge.message, "utf8"), wallet.secretKey.slice(0, 32));
  return request<AuthSession>("/auth/verify", {
    method: "POST",
    body: {
      wallet: wallet.publicKey.toBase58(),
      nonce: challenge.nonce,
      signature: bs58.encode(signature),
    },
  });
};

const upsertAccountProfile = async (
  token: string,
  params: {
    role: "CREATOR" | "SPONSOR" | "FAN";
    displayName: string;
    handle: string;
  }
): Promise<AccountMe> => {
  const account = await request<AccountMe>("/account/me", { token });
  if (account.storageStatus !== "LIVE") {
    throw new ExpectedBlocker("ACCOUNT_PROFILE_NOT_LIVE", "AccountProfile storage is not live.", account);
  }
  return request<AccountMe>("/account/me", {
    method: "PUT",
    token,
    body: {
      role: params.role,
      displayName: params.displayName,
      handle: params.handle,
      completeOnboarding: true,
    },
  });
};

const uploadToPresignedUrl = async (presignedUrl: string, body: Buffer, mimeType: string) => {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body,
  });
  if (!response.ok) {
    throw new Error(`R2 presigned upload failed with ${response.status}: ${await response.text()}`);
  }
  return response.headers;
};

const completeUpload = async (
  token: string,
  manifestId: string,
  upload: PresignResponse["uploads"][number],
  body: Buffer,
  mimeType: string
) => {
  if (upload.uploadStrategy === "SINGLE_PART") {
    if (!upload.presignedUrl) throw new Error("single-part upload missing presignedUrl");
    await uploadToPresignedUrl(upload.presignedUrl, body, mimeType);
    await request(`/content/manifests/${manifestId}/assets/${upload.assetId}/complete`, {
      method: "POST",
      token,
      headers: { "x-idempotency-key": `asset-complete-${RUN_ID}` },
    });
    return;
  }

  if (!upload.multipartUploadId || !upload.partSizeBytes || !upload.parts?.length) {
    throw new Error("multipart upload missing upload id, part size, or parts");
  }

  const completedParts = [];
  for (const part of upload.parts.sort((left, right) => left.partNumber - right.partNumber)) {
    const start = (part.partNumber - 1) * upload.partSizeBytes;
    const end = Math.min(start + upload.partSizeBytes, body.length);
    const headers = await uploadToPresignedUrl(part.presignedUrl, body.subarray(start, end), mimeType);
    const etag = headers.get("etag");
    if (!etag) throw new Error(`R2 multipart part ${part.partNumber} did not return an ETag`);
    completedParts.push({ partNumber: part.partNumber, etag });
  }

  await request(`/content/manifests/${manifestId}/assets/${upload.assetId}/complete`, {
    method: "POST",
    token,
    headers: { "x-idempotency-key": `asset-complete-${RUN_ID}` },
    body: {
      multipartUploadId: upload.multipartUploadId,
      parts: completedParts,
    },
  });
};

const pollMuxReady = async (
  token: string,
  manifestId: string,
  assetId: string
): Promise<ManifestDetail["assets"][number]> => {
  const deadline = Date.now() + MUX_READY_TIMEOUT_MS;
  let lastAsset: ManifestDetail["assets"][number] | null = null;

  await request("/internal/mux/reconcile/run-once", { method: "POST" }).catch(() => null);

  while (Date.now() <= deadline) {
    await request(`/internal/mux/assets/${assetId}/reconcile`, { method: "POST" }).catch(() => null);
    const detail = await request<ManifestDetail>(`/content/manifests/${manifestId}`, { token });
    lastAsset = detail.assets.find((asset) => asset.assetId === assetId) ?? null;
    if (lastAsset?.processingStatus === "READY" && lastAsset.muxPlaybackId) {
      return lastAsset;
    }
    if (lastAsset?.processingStatus === "ERRORED") {
      throw new ExpectedBlocker("MUX_RECONCILIATION_ERRORED", "Mux reconciliation returned ERRORED.", lastAsset);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new ExpectedBlocker(
    "MUX_READY_TIMEOUT",
    "Mux did not reach READY within the configured timeout.",
    lastAsset
  );
};

const signTransactionBase64 = (transactionBase64: string, keypair: Keypair): string => {
  const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
  tx.sign([keypair]);
  return Buffer.from(tx.serialize()).toString("base64");
};

const launchProposalViaApi = async (params: {
  label: string;
  manifestId: string;
  creator: Keypair;
  creatorToken: string;
  sponsor: Keypair;
  sponsorToken: string;
  deadlineUnix: bigint;
  track1BaseUsdc: bigint;
  track2BudgetUsdc: bigint;
  track3BudgetUsdc: bigint;
}): Promise<{
  intentId: string;
  proposalPda: string;
  launchSignature: string;
}> => {
  const intent = await request<IntentResponse>("/proposal-intents", {
    method: "POST",
    token: params.creatorToken,
    headers: { "x-idempotency-key": `intent-${params.label}-${RUN_ID}` },
    body: {
      manifestId: params.manifestId,
      creatorWallet: params.creator.publicKey.toBase58(),
      sponsorWallet: params.sponsor.publicKey.toBase58(),
      deadlineUnix: params.deadlineUnix.toString(),
      track1BaseUsdc: params.track1BaseUsdc.toString(),
      track2MetricType: "VIEWS",
      track2TargetValue: TRACK2_TARGET_VALUE.toString(),
      track2MinAchievementBps: TRACK2_MIN_ACHIEVEMENT_BPS,
      track2UsdcDeposited: params.track2BudgetUsdc.toString(),
      track3UsdcDeposited: params.track3BudgetUsdc.toString(),
      track3DelayDays: 0,
    },
  });

  const locked = await request<IntentResponse>(`/proposal-intents/${intent.intentId}/lock`, {
    method: "POST",
    token: params.creatorToken,
    headers: { "x-idempotency-key": `lock-${params.label}-${RUN_ID}` },
  });

  const build = await request<BuildBundleResponse>(`/proposal-intents/${intent.intentId}/build-bundle`, {
    method: "POST",
    token: params.creatorToken,
    headers: { "x-idempotency-key": `build-${params.label}-${RUN_ID}` },
    body: { submitMode: "SERVER_RELAY", forceRebuild: true },
  });
  if (!build.bundle.versionedTxBase64) {
    throw new Error(`launch bundle for ${params.label} did not include versionedTxBase64`);
  }

  const partial = signTransactionBase64(build.bundle.versionedTxBase64, params.creator);
  const creatorSigned = await request<{ intentId: string; bundle: BundleResponse }>(
    `/proposal-intents/${intent.intentId}/creator-partial-sign`,
    {
      method: "POST",
      token: params.creatorToken,
      headers: { "x-idempotency-key": `creator-sign-${params.label}-${RUN_ID}` },
      body: {
        bundleId: build.bundle.bundleId,
        partiallySignedTxBase64: partial,
      },
    }
  );

  const fullySigned = signTransactionBase64(
    creatorSigned.bundle.partiallySignedTxBase64 ?? partial,
    params.sponsor
  );
  const submitted = await request<SubmitBundleResponse>(`/proposal-intents/${intent.intentId}/submit`, {
    method: "POST",
    token: params.sponsorToken,
    headers: { "x-idempotency-key": `submit-${params.label}-${RUN_ID}` },
    body: {
      bundleId: build.bundle.bundleId,
      fullySignedTxBase64: fullySigned,
    },
    timeoutMs: 180_000,
  });

  const proposalPda = build.plannedProposalPda ?? locked.plannedProposalPda;
  if (!proposalPda || submitted.relayStatus !== "CONFIRMED" || !submitted.chainTxSignature) {
    throw new ExpectedBlocker("PROPOSAL_LAUNCH_NOT_CONFIRMED", `Proposal ${params.label} did not confirm.`, {
      proposalPda,
      relayStatus: submitted.relayStatus,
      chainTxSignature: submitted.chainTxSignature,
    });
  }

  return {
    intentId: intent.intentId,
    proposalPda,
    launchSignature: submitted.chainTxSignature,
  };
};

const tokenAmount = async (
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey
): Promise<bigint> => {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);
  try {
    const balance = await connection.getTokenAccountBalance(ata, "confirmed");
    return BigInt(balance.value.amount);
  } catch (_error) {
    return 0n;
  }
};

const tokenAccountAmount = async (connection: Connection, tokenAccount: PublicKey): Promise<bigint> => {
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount, "confirmed");
    return BigInt(balance.value.amount);
  } catch (_error) {
    return 0n;
  }
};

const ensureAta = async (
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey
): Promise<PublicKey> => {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        tokenProgram
      )
    ),
    [payer],
    { commitment: "confirmed" }
  );
  return ata;
};

const deriveEndorsementPosition = (programId: PublicKey, user: PublicKey, proposal: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("endorsement"), user.toBuffer(), proposal.toBuffer()],
    programId
  )[0];

const waitUntilUnix = async (deadlineUnix: bigint, label: string) => {
  const waitMs = Math.max(0, Number(deadlineUnix) * 1000 - Date.now() + 3_000);
  if (waitMs > 0) {
    log(`waiting ${Math.ceil(waitMs / 1000)}s for ${label}`);
    await sleep(waitMs);
  }
};

const assertDelta = (label: string, actual: bigint, expected: bigint) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected.toString()}, got ${actual.toString()}`);
  }
};

const prepareScenarioEndorsements = async (params: {
  scenario: ScenarioConfig;
  proposalPda: string;
  connection: Connection;
  admin: Keypair;
  usdcMint: PublicKey;
  spumpMint: PublicKey;
  program: any;
  anchorService: any;
  protocolConfig: PublicKey;
}): Promise<FanSnapshot[]> => {
  const proposal = new PublicKey(params.proposalPda);
  const proposalStateBefore = await params.anchorService.fetchProposalState(proposal);
  if (!proposalStateBefore || proposalStateBefore.status !== "FUNDED") {
    throw new Error(`${params.scenario.name} proposal is not FUNDED before endorsement`);
  }

  const fanSnapshots: FanSnapshot[] = [];
  for (const stake of params.scenario.fanStakes) {
    const fan = stake.fan.publicKey;
    const fanSpumpAta = await ensureAta(params.connection, params.admin, params.spumpMint, fan, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAta = await ensureAta(params.connection, params.admin, params.usdcMint, fan, TOKEN_PROGRAM_ID);
    const spumpBefore = await tokenAmount(params.connection, fan, params.spumpMint, TOKEN_2022_PROGRAM_ID);
    const usdcBefore = await tokenAmount(params.connection, fan, params.usdcMint, TOKEN_PROGRAM_ID);
    if (spumpBefore < stake.amount) {
      throw new ExpectedBlocker("FAN_SPUMP_REQUIRED", "A selected fan does not have enough SPUMP.", {
        fan: fan.toBase58(),
        required: stake.amount.toString(),
        current: spumpBefore.toString(),
      });
    }
    const endorsementPosition = deriveEndorsementPosition(params.anchorService.getProgramId(), fan, proposal);
    await params.program.methods
      .endorseProposal({ amount: new anchor.BN(stake.amount.toString()) })
      .accounts({
        user: fan,
        protocolConfig: params.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: fanSpumpAta,
        spumpMint: params.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([stake.fan])
      .rpc();
    await sleep(RPC_THROTTLE_MS);
    fanSnapshots.push({
      fan,
      fanSpumpAta,
      fanUsdcAta,
      endorsementPosition,
      stake: stake.amount,
      spumpBefore,
      usdcBefore,
    });
  }
  return fanSnapshots;
};

const runSettlementScenario = async (params: {
  scenario: ScenarioConfig;
  proposalPda: string;
  deadlineUnix: bigint;
  connection: Connection;
  admin: Keypair;
  oracle: Keypair;
  protocolConfig: PublicKey;
  usdcMint: PublicKey;
  spumpMint: PublicKey;
  program: any;
  anchorService: any;
  syncProposalProjectionFromChain: (params: {
    proposalPda: string;
    signature: string;
    instructionName: string;
  }) => Promise<unknown>;
  fanSnapshots?: FanSnapshot[];
}) => {
  const proposal = new PublicKey(params.proposalPda);
  const proposalStateBefore = await params.anchorService.fetchProposalState(proposal);
  if (!proposalStateBefore || proposalStateBefore.status !== "FUNDED") {
    throw new Error(`${params.scenario.name} proposal is not FUNDED before settlement`);
  }
  const creator = proposalStateBefore.creator as PublicKey;
  const sponsor = params.scenario.sponsor.publicKey;
  const proposalUsdcVault = params.anchorService.deriveProposalUsdcVaultPda(proposal);
  const creatorUsdcAta = getAssociatedTokenAddressSync(params.usdcMint, creator);
  const sponsorUsdcAta = await ensureAta(params.connection, params.admin, params.usdcMint, sponsor, TOKEN_PROGRAM_ID);

  const fanSnapshots =
    params.fanSnapshots ??
    (await prepareScenarioEndorsements({
      scenario: params.scenario,
      proposalPda: params.proposalPda,
      connection: params.connection,
      admin: params.admin,
      usdcMint: params.usdcMint,
      spumpMint: params.spumpMint,
      program: params.program,
      anchorService: params.anchorService,
      protocolConfig: params.protocolConfig,
    }));

  const creatorBeforeTrack1 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);
  const track1Signature = await params.anchorService.executeSettleTrack1Base(proposal);
  await sleep(RPC_THROTTLE_MS);
  await params.syncProposalProjectionFromChain({
    proposalPda: params.proposalPda,
    signature: track1Signature,
    instructionName: "settle_track1_base",
  });
  const creatorAfterTrack1 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);
  assertDelta(
    `${params.scenario.name} Track1 creator payout`,
    creatorAfterTrack1 - creatorBeforeTrack1,
    params.scenario.track1BaseUsdc
  );

  await waitUntilUnix(params.deadlineUnix, `${params.scenario.name} Track2/Track3 deadline`);

  const vaultBeforeTrack2 = await tokenAccountAmount(params.connection, proposalUsdcVault);
  const creatorBeforeTrack2 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);
  const track2Signature = await params.anchorService.executeSettleTrack2(proposal, params.scenario.actualValue);
  await sleep(RPC_THROTTLE_MS);
  await params.syncProposalProjectionFromChain({
    proposalPda: params.proposalPda,
    signature: track2Signature,
    instructionName: "settle_track2",
  });
  const vaultAfterTrack2 = await tokenAccountAmount(params.connection, proposalUsdcVault);
  const creatorAfterTrack2 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);

  const achieved =
    params.scenario.actualValue * 10_000 < TRACK2_MIN_ACHIEVEMENT_BPS * Number(TRACK2_TARGET_VALUE)
      ? 0n
      : (params.scenario.track2BudgetUsdc *
          BigInt(Math.min(params.scenario.actualValue, Number(TRACK2_TARGET_VALUE)))) /
        TRACK2_TARGET_VALUE;
  const sponsorTrack2Refund = params.scenario.track2BudgetUsdc - achieved;
  const creatorTrack2Payout = (achieved * 8_000n) / 10_000n;
  const fanPool = achieved - creatorTrack2Payout;
  assertDelta(`${params.scenario.name} Track2 creator payout`, creatorAfterTrack2 - creatorBeforeTrack2, creatorTrack2Payout);
  assertDelta(
    `${params.scenario.name} Track2 vault outflow`,
    vaultBeforeTrack2 - vaultAfterTrack2,
    sponsorTrack2Refund + creatorTrack2Payout
  );
  assertDelta(
    `${params.scenario.name} Track2 remaining vault`,
    vaultAfterTrack2,
    params.scenario.track3BudgetUsdc + fanPool
  );

  let remainingPool = fanPool;
  let remainingSpump = fanSnapshots.reduce((sum, fan) => sum + fan.stake, 0n);
  for (const [index, fan] of fanSnapshots.entries()) {
    const expectedUsdcReward =
      achieved === 0n
        ? 0n
        : index === fanSnapshots.length - 1
          ? remainingPool
          : remainingSpump === 0n
            ? 0n
            : (fan.stake * remainingPool) / remainingSpump;
    const expectedSpumpAfter =
      achieved === 0n ? fan.spumpBefore - (fan.stake * 500n) / 10_000n : fan.spumpBefore;

    await params.program.methods
      .claimEndorsement()
      .accounts({
        user: fan.fan,
        protocolConfig: params.protocolConfig,
        proposal,
        endorsementPosition: fan.endorsementPosition,
        userSpumpAta: fan.fanSpumpAta,
        spumpMint: params.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        userUsdcAta: fan.fanUsdcAta,
        proposalUsdcVault,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await sleep(RPC_THROTTLE_MS);

    const spumpAfter = await tokenAmount(params.connection, fan.fan, params.spumpMint, TOKEN_2022_PROGRAM_ID);
    const usdcAfter = await tokenAmount(params.connection, fan.fan, params.usdcMint, TOKEN_PROGRAM_ID);
    assertDelta(`${params.scenario.name} fan ${short(fan.fan.toBase58())} SPUMP after claim`, spumpAfter, expectedSpumpAfter);
    assertDelta(
      `${params.scenario.name} fan ${short(fan.fan.toBase58())} USDC reward`,
      usdcAfter - fan.usdcBefore,
      expectedUsdcReward
    );
    remainingPool -= expectedUsdcReward;
    remainingSpump -= fan.stake;
  }

  const vaultBeforeTrack3 = await tokenAccountAmount(params.connection, proposalUsdcVault);
  const creatorBeforeTrack3 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);
  const track3Signature = await params.anchorService.executeSettleTrack3Cps(
    proposal,
    Number(params.scenario.track3ApprovedUsdc)
  );
  await sleep(RPC_THROTTLE_MS);
  await params.syncProposalProjectionFromChain({
    proposalPda: params.proposalPda,
    signature: track3Signature,
    instructionName: "settle_track3_cps",
  });
  const vaultAfterTrack3 = await tokenAccountAmount(params.connection, proposalUsdcVault);
  const creatorAfterTrack3 = await tokenAmount(params.connection, creator, params.usdcMint, TOKEN_PROGRAM_ID);
  assertDelta(
    `${params.scenario.name} Track3 creator payout`,
    creatorAfterTrack3 - creatorBeforeTrack3,
    params.scenario.track3ApprovedUsdc
  );
  assertDelta(`${params.scenario.name} Track3 vault outflow`, vaultBeforeTrack3 - vaultAfterTrack3, params.scenario.track3BudgetUsdc);
  assertDelta(`${params.scenario.name} Track3 remaining vault`, vaultAfterTrack3, 0n);

  const finalProposal = await params.anchorService.fetchProposalState(proposal);
  return {
    name: params.scenario.name,
    proposalPda: params.proposalPda,
    status: finalProposal?.status ?? null,
    actualValue: params.scenario.actualValue,
    fanPool: fanPool.toString(),
    track1Signature,
    track2Signature,
    track3Signature,
  };
};

const ensureBranch = () => {
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (branch !== "codex/post-deadline-phase-0") {
    throw new ExpectedBlocker("WRONG_BRANCH", "Refusing to run outside codex/post-deadline-phase-0.", { branch });
  }
};

const ensureBackend = async () => {
  try {
    const response = await fetch(HEALTH_URL);
    if (!response.ok) throw new Error(`health returned ${response.status}`);
  } catch (error) {
    throw new ExpectedBlocker("BACKEND_NOT_RUNNING", "Start the backend on localhost:4000 before running this corridor.", {
      healthUrl: HEALTH_URL,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const ensureRequiredEnv = () => {
  const missing = ["R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL", "MUX_TOKEN_ID", "MUX_TOKEN_SECRET"].filter(
    (name) => !process.env[name]?.trim()
  );
  if (missing.length > 0) {
    throw new ExpectedBlocker("ENV_REQUIRED", "R2/Mux environment variables are missing.", { missing });
  }
};

const ensureSolBalances = async (
  connection: Connection,
  actors: Array<{ label: string; keypair: Keypair; minSol: number }>
) => {
  const underfunded = [];
  for (const actor of actors) {
    const balance = await connection.getBalance(actor.keypair.publicKey, "confirmed");
    if (balance < actor.minSol * LAMPORTS_PER_SOL) {
      underfunded.push({
        label: actor.label,
        wallet: actor.keypair.publicKey.toBase58(),
        currentSol: balance / LAMPORTS_PER_SOL,
        requiredSol: actor.minSol,
      });
    }
  }
  if (underfunded.length > 0) {
    throw new ExpectedBlocker("DEVNET_SOL_REQUIRED", "Fund these devnet addresses with SOL, then rerun.", {
      underfunded,
    });
  }
};

const createBackup = async (params: {
  prisma: any;
  connection: Connection;
  wallets: string[];
  creatorWallet: string;
  usdcMint: PublicKey;
  spumpMint: PublicKey;
}) => {
  const [profiles, identities, sessions, manifests, intents, proposals, campaignProofs] = await Promise.all([
    params.prisma.accountProfile.findMany({ where: { wallet: { in: params.wallets } } }),
    params.prisma.authIdentity.findMany({ where: { managedWalletAddress: { in: params.wallets } } }),
    params.prisma.walletSession.findMany({ where: { wallet: { in: params.wallets } } }),
    params.prisma.contentManifest.findMany({
      where: { creatorWallet: params.creatorWallet },
      include: { assets: true, publications: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    params.prisma.proposalIntent.findMany({
      where: { OR: [{ creatorWallet: { in: params.wallets } }, { sponsorWallet: { in: params.wallets } }] },
      include: { txBundles: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    params.prisma.proposal.findMany({
      where: { OR: [{ creatorWallet: { in: params.wallets } }, { sponsorWallet: { in: params.wallets } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    params.prisma.campaignProofProjection.findMany({
      where: { OR: [{ creatorWallet: { in: params.wallets } }, { sponsorWallet: { in: params.wallets } }] },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const balances = [];
  for (const wallet of params.wallets) {
    const owner = new PublicKey(wallet);
    balances.push({
      wallet,
      solLamports: await params.connection.getBalance(owner, "confirmed"),
      usdcAmount: (await tokenAmount(params.connection, owner, params.usdcMint, TOKEN_PROGRAM_ID)).toString(),
      spumpAmount: (await tokenAmount(params.connection, owner, params.spumpMint, TOKEN_2022_PROGRAM_ID)).toString(),
    });
  }

  const backupPath = path.resolve(ROOT, `.local/backups/s2-full-corridor-${RUN_ID}.json`);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  writeFileSync(
    backupPath,
    `${stringifyJson({ createdAt: new Date().toISOString(), wallets: params.wallets, balances, profiles, identities, sessions, manifests, intents, proposals, campaignProofs })}\n`
  );
  return backupPath;
};

const main = async () => {
  ensureBranch();
  ensureRequiredEnv();
  await ensureBackend();

  if (!existsSync(S2_STATE_PATH) || !existsSync(S1_STATE_PATH)) {
    throw new ExpectedBlocker("LOCAL_STATE_REQUIRED", "Missing devnet state files.", {
      required: [S2_STATE_PATH, S1_STATE_PATH],
    });
  }
  if (!existsSync(MEDIA_PATH)) {
    throw new ExpectedBlocker("MEDIA_REQUIRED", "Missing test video file.", { mediaPath: MEDIA_PATH });
  }

  const s2 = readJson<S2State>(S2_STATE_PATH);
  const s1 = readJson<S1State>(S1_STATE_PATH);
  const admin = keypairFromStored(s2.admin);
  const oracle = keypairFromStored(s2.oracle);
  const creator = keypairFromStored(s2.creator);
  const primarySponsor = keypairFromStored(s2.sponsor);
  const secondarySponsor = keypairFromStored(s1.sponsor);
  const fans = s1.fans.slice(0, 6).map(keypairFromStored);
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || s2.rpcEndpoint;
  const programId = process.env.STREAMPUMP_PROGRAM_ID || s2.programId;
  const connection = new Connection(rpcEndpoint, "confirmed");
  const usdcMint = new PublicKey(s2.usdcMint || s1.usdcMint);
  const spumpMint = new PublicKey(spumpMintFromState(s1));

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.PROTOCOL_ADMIN_SECRET_KEY = JSON.stringify(Array.from(admin.secretKey));
  process.env.CONTENT_ANCHOR_SIGNER_SECRET_KEY = JSON.stringify(Array.from(creator.secretKey));
  process.env.INDEXER_ENABLED = "false";
  process.env.ORACLE_SCHEDULER_ENABLED = "false";
  process.env.ORACLE_RUN_ON_BOOT = "false";

  const backend = await import("../backend/src/services/prisma");
  const anchorModule = await import("../backend/src/services/AnchorService");
  const chainProjection = await import("../backend/src/services/chainProjectionService");
  const prisma = backend.prisma;
  const anchorService = anchorModule.getAnchorService();
  const program = anchorService.program as any;
  const protocolConfig = anchorService.deriveProtocolConfigPda();

  const programAccount = await connection.getAccountInfo(new PublicKey(programId), "confirmed");
  if (!programAccount?.executable) {
    throw new ExpectedBlocker("PROGRAM_NOT_DEPLOYED", "Configured devnet program is not executable.", { programId });
  }

  const creatorProfile = await anchorService.fetchCreatorProfileByWallet(creator.publicKey);
  if (!creatorProfile || creatorProfile.level < 2 || creatorProfile.status !== "S2_ACTIVE") {
    throw new ExpectedBlocker("CREATOR_NOT_S2_READY", "Selected creator is not S2_ACTIVE on chain.", {
      creator: creator.publicKey.toBase58(),
      creatorProfile,
    });
  }

  await ensureSolBalances(connection, [
    { label: "admin", keypair: admin, minSol: 1 },
    { label: "oracle", keypair: oracle, minSol: 0.05 },
    { label: "creator", keypair: creator, minSol: 0.1 },
    { label: "primarySponsor", keypair: primarySponsor, minSol: 0.2 },
    { label: "secondarySponsor", keypair: secondarySponsor, minSol: 0.2 },
    ...fans.map((fan, index) => ({ label: `fan${index + 1}`, keypair: fan, minSol: 0.03 })),
  ]);

  const wallets = [creator, primarySponsor, secondarySponsor, ...fans].map((keypair) => keypair.publicKey.toBase58());
  const backupPath = await createBackup({
    prisma,
    connection,
    wallets,
    creatorWallet: creator.publicKey.toBase58(),
    usdcMint,
    spumpMint,
  });
  log(`backup written: ${backupPath}`);

  const sponsorFundingTarget = usdc(500);
  for (const sponsor of [primarySponsor, secondarySponsor]) {
    const sponsorAta = await ensureAta(connection, admin, usdcMint, sponsor.publicKey, TOKEN_PROGRAM_ID);
    const balance = await tokenAmount(connection, sponsor.publicKey, usdcMint, TOKEN_PROGRAM_ID);
    if (balance < sponsorFundingTarget) {
      await mintTo(
        connection,
        admin,
        usdcMint,
        sponsorAta,
        admin.publicKey,
        sponsorFundingTarget - balance,
        [],
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID
      );
    }
  }
  for (const fan of fans) {
    await ensureAta(connection, admin, usdcMint, fan.publicKey, TOKEN_PROGRAM_ID);
    await ensureAta(connection, admin, spumpMint, fan.publicKey, TOKEN_2022_PROGRAM_ID);
  }

  log("creating wallet sessions and AccountProfile records");
  const creatorSession = await signInWallet(creator);
  const primarySponsorSession = await signInWallet(primarySponsor);
  const secondarySponsorSession = await signInWallet(secondarySponsor);
  const fanSessions = [];
  await upsertAccountProfile(creatorSession.accessToken, {
    role: "CREATOR",
    displayName: "S2 Corridor Creator",
    handle: `s2-creator-${creator.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  await upsertAccountProfile(primarySponsorSession.accessToken, {
    role: "SPONSOR",
    displayName: "Primary Corridor Sponsor",
    handle: `sponsor-${primarySponsor.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  await upsertAccountProfile(secondarySponsorSession.accessToken, {
    role: "SPONSOR",
    displayName: "Secondary Corridor Sponsor",
    handle: `sponsor-${secondarySponsor.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  for (const [index, fan] of fans.entries()) {
    const session = await signInWallet(fan);
    fanSessions.push(session);
    await upsertAccountProfile(session.accessToken, {
      role: "FAN",
      displayName: `Retail Fan ${index + 1}`,
      handle: `fan-${fan.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
    });
  }

  const reusableManifestId = process.env.STREAM_PUMP_FULL_CORRIDOR_REUSE_MANIFEST_ID?.trim();
  let mediaMode: "NEW_R2_MUX_UPLOAD" | "REUSED_READY_MANIFEST" = "NEW_R2_MUX_UPLOAD";
  let manifest: { manifestId: string };
  let muxAsset: ManifestDetail["assets"][number];
  let finalized: ManifestDetail;

  if (reusableManifestId) {
    log(`reusing existing READY manifest ${reusableManifestId}`);
    mediaMode = "REUSED_READY_MANIFEST";
    manifest = { manifestId: reusableManifestId };
    finalized = await request<ManifestDetail>(`/content/manifests/${manifest.manifestId}`, {
      token: creatorSession.accessToken,
    });
    const readyAsset = finalized.assets.find(
      (asset) => asset.assetType === "VIDEO" && asset.processingStatus === "READY" && asset.muxPlaybackId
    );
    if (!readyAsset) {
      throw new ExpectedBlocker("REUSABLE_MANIFEST_NOT_READY", "Reusable manifest does not have a READY video asset.", {
        manifestId: manifest.manifestId,
        assets: finalized.assets,
      });
    }
    muxAsset = readyAsset;
  } else {
    log("publishing real video through R2/Mux/content APIs");
    const mediaBody = readFileSync(MEDIA_PATH);
    manifest = await request<{ manifestId: string }>("/content/manifests", {
      method: "POST",
      token: creatorSession.accessToken,
      headers: { "x-idempotency-key": `manifest-${RUN_ID}` },
      body: {
        contentType: "SHORT_VIDEO",
        title: `S2 full corridor ${RUN_ID}`,
        captionText: "Full S2 corridor test: R2, Mux, feed projection, proposal proof, and settlement branches.",
        tags: ["s2", "corridor", "devnet"],
        metadata: { source: "scripts/devnet-s2-full-corridor.ts", runId: RUN_ID },
      },
    });

    const presign = await request<PresignResponse>(`/content/manifests/${manifest.manifestId}/assets/presign`, {
      method: "POST",
      token: creatorSession.accessToken,
      headers: { "x-idempotency-key": `presign-${RUN_ID}` },
      body: {
        assets: [
          {
            assetType: "VIDEO",
            orderIndex: 0,
            sha256Hex: sha256Hex(mediaBody),
            mimeType: "video/mp4",
            fileSizeBytes: String(mediaBody.length),
          },
        ],
      },
    });
    const upload = presign.uploads[0];
    if (!upload) throw new Error("presign did not return an upload plan");
    await completeUpload(creatorSession.accessToken, manifest.manifestId, upload, mediaBody, "video/mp4");
    muxAsset = await pollMuxReady(creatorSession.accessToken, manifest.manifestId, upload.assetId);
    finalized = await request<ManifestDetail>(`/content/manifests/${manifest.manifestId}/finalize`, {
      method: "POST",
      token: creatorSession.accessToken,
      headers: { "x-idempotency-key": `finalize-${RUN_ID}` },
    });
    await request("/content/publications", {
      method: "POST",
      token: creatorSession.accessToken,
      headers: { "x-idempotency-key": `publication-${RUN_ID}` },
      body: {
        manifestId: manifest.manifestId,
        platform: "STREAMPUMP",
        externalUrl: `https://streampump.local/s2-full/${manifest.manifestId}`,
        externalPostId: `s2-full-${manifest.manifestId}`,
      },
    });
  }

  const feed = await request<FeedResponse>("/feed/posts?limit=24");
  const feedPost = feed.posts.find((post) => post.manifestId === manifest.manifestId);
  if (!feedPost) {
    throw new ExpectedBlocker("FEED_PROJECTION_MISSING", "Published manifest is missing from backend feed projection.", {
      manifestId: manifest.manifestId,
    });
  }
  await request(`/feed/posts/${feedPost.postId}`);

  log("launching primary FUNDED campaign proof");
  const now = Math.floor(Date.now() / 1000);
  const primaryLaunch = await launchProposalViaApi({
    label: "primary",
    manifestId: manifest.manifestId,
    creator,
    creatorToken: creatorSession.accessToken,
    sponsor: primarySponsor,
    sponsorToken: primarySponsorSession.accessToken,
    deadlineUnix: BigInt(now + 6 * 24 * 60 * 60),
    track1BaseUsdc: usdc(25),
    track2BudgetUsdc: usdc(150),
    track3BudgetUsdc: usdc(75),
  });
  const primaryCampaign = await request<CampaignPublicResponse>(`/campaigns/${primaryLaunch.proposalPda}/public`);
  if (
    primaryCampaign.status !== "FUNDED" ||
    !["FUNDED", "ANCHORED"].includes(primaryCampaign.proofStatus)
  ) {
    throw new ExpectedBlocker("CAMPAIGN_PROOF_NOT_FUNDED", "Primary campaign proof projection is not in a funded proof state.", {
      primaryCampaign,
    });
  }

  log("launching settlement scenario proposals");
  const scenarios: ScenarioConfig[] = [
    {
      name: "full-capped",
      sponsor: primarySponsor,
      deadlineOffsetSeconds: 480,
      actualValue: 1_200,
      track1BaseUsdc: usdc(1),
      track2BudgetUsdc: usdc(5),
      track3BudgetUsdc: usdc(2),
      track3ApprovedUsdc: usdc(1.2),
      fanStakes: [
        { fan: fans[0], amount: 1_000_000n },
        { fan: fans[1], amount: 2_000_000n },
      ],
    },
    {
      name: "partial",
      sponsor: primarySponsor,
      deadlineOffsetSeconds: 600,
      actualValue: 800,
      track1BaseUsdc: usdc(1),
      track2BudgetUsdc: usdc(5),
      track3BudgetUsdc: usdc(2),
      track3ApprovedUsdc: usdc(1.2),
      fanStakes: [
        { fan: fans[2], amount: 1_500_000n },
        { fan: fans[3], amount: 2_500_000n },
      ],
    },
    {
      name: "below-cliff",
      sponsor: secondarySponsor,
      deadlineOffsetSeconds: 720,
      actualValue: 300,
      track1BaseUsdc: usdc(1),
      track2BudgetUsdc: usdc(5),
      track3BudgetUsdc: usdc(2),
      track3ApprovedUsdc: usdc(1.2),
      fanStakes: [
        { fan: fans[4], amount: 1_200_000n },
        { fan: fans[5], amount: 1_800_000n },
      ],
    },
  ];

  const scenarioLaunches = [];
  for (const scenario of scenarios) {
    const sponsorToken =
      scenario.sponsor.publicKey.equals(primarySponsor.publicKey)
        ? primarySponsorSession.accessToken
        : secondarySponsorSession.accessToken;
    const launch = await launchProposalViaApi({
      label: scenario.name,
      manifestId: manifest.manifestId,
      creator,
      creatorToken: creatorSession.accessToken,
      sponsor: scenario.sponsor,
      sponsorToken,
      deadlineUnix: BigInt(now + scenario.deadlineOffsetSeconds),
      track1BaseUsdc: scenario.track1BaseUsdc,
      track2BudgetUsdc: scenario.track2BudgetUsdc,
      track3BudgetUsdc: scenario.track3BudgetUsdc,
    });
    scenarioLaunches.push({ scenario, launch, deadlineUnix: BigInt(now + scenario.deadlineOffsetSeconds) });
  }

  log("endorsing scenario proposals");
  const preparedScenarioLaunches = [];
  for (const item of scenarioLaunches) {
    const fanSnapshots = await prepareScenarioEndorsements({
      scenario: item.scenario,
      proposalPda: item.launch.proposalPda,
      connection,
      admin,
      usdcMint,
      spumpMint,
      program,
      anchorService,
      protocolConfig,
    });
    preparedScenarioLaunches.push({ ...item, fanSnapshots });
  }

  log("settling scenario proposals");
  const scenarioResults = [];
  for (const item of preparedScenarioLaunches) {
    scenarioResults.push(
      await runSettlementScenario({
        scenario: item.scenario,
        proposalPda: item.launch.proposalPda,
        deadlineUnix: item.deadlineUnix,
        connection,
        admin,
        oracle,
        protocolConfig,
        usdcMint,
        spumpMint,
        program,
        anchorService,
        syncProposalProjectionFromChain: chainProjection.syncProposalProjectionFromChain,
        fanSnapshots: item.fanSnapshots,
      })
    );
  }

  const report = {
    ok: true,
    createdAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    backupPath,
    actors: {
      creator: creator.publicKey.toBase58(),
      primarySponsor: primarySponsor.publicKey.toBase58(),
      secondarySponsor: secondarySponsor.publicKey.toBase58(),
      fans: fans.map((fan) => fan.publicKey.toBase58()),
    },
    media: {
      mode: mediaMode,
      manifestId: manifest.manifestId,
      postId: feedPost.postId,
      manifestHashHex: finalized.manifestHashHex,
      muxAsset,
    },
    primaryCampaign: {
      ...primaryLaunch,
      status: primaryCampaign.status,
      proofStatus: primaryCampaign.proofStatus,
      url: `http://localhost:3000/campaigns/${primaryLaunch.proposalPda}`,
    },
    scenarioResults,
    browserUrls: {
      explore: "http://localhost:3000/explore",
      postDetail: `http://localhost:3000/posts/${feedPost.postId}`,
      campaignDetail: `http://localhost:3000/campaigns/${primaryLaunch.proposalPda}`,
    },
  };

  const reportPath = path.resolve(ROOT, `.local/reports/s2-full-corridor-${RUN_ID}.json`);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${stringifyJson(report)}\n`);
  log(`report written: ${reportPath}`);
  console.log(stringifyJson(report));

  await prisma.$disconnect();
};

main().catch((error) => {
  if (error instanceof ExpectedBlocker) {
    console.error("[s2-full] blocker");
    console.error(stringifyJson({ code: error.code, message: error.message, details: error.details }));
    process.exitCode = 2;
    return;
  }
  if (error instanceof ApiError) {
    console.error("[s2-full] api error");
    console.error(stringifyJson({ status: error.status, code: error.code, message: error.message, details: error.details }));
    process.exitCode = 1;
    return;
  }
  console.error("[s2-full] failed");
  console.error(error);
  process.exitCode = 1;
});

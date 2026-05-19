import "../backend/config/loadEnv";

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import * as anchor from "@coral-xyz/anchor";
import { ed25519 } from "@noble/curves/ed25519";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
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
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

type StoredKeypair = {
  publicKey: string;
  secretKey: number[];
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

type S1BuildTransactionResponse = {
  action: string;
  submitMode: "CLIENT_RELAY";
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: string;
  requiredSigners: string[];
  derived: Record<string, string | null>;
};

type S1SubmitTransactionResponse = {
  signature: string;
  projectionSync: {
    status: "SYNCED" | "FAILED";
    instructionCount?: number;
    indexerStatus?: string;
    error?: string;
  };
};

type S1MarketProfileResponse = {
  creator: {
    creatorWallet: string;
    creatorProfilePda: string;
    stage: string;
    level: number;
    s1Supply: string;
    holderCount: number;
  };
  buyout: {
    status: string;
    buyoutStatePda: string | null;
    winningSponsorWallet: string | null;
    acceptedOfferPda: string | null;
    acceptedOfferUsdc: string | null;
    usdcDeposited: string | null;
    claimableUsdcRemaining: string | null;
    claimableS1SupplyRemaining: string | null;
  } | null;
  offers: Array<{
    buyoutOfferPda: string;
    sponsorWallet: string;
    usdcAmount: string;
    status: string;
  }>;
};

type S1PortfolioResponse = {
  userWallet: string;
  positions: Array<{
    positionPda: string;
    creatorWallet: string | null;
    creatorProfilePda: string;
    internalTokenBalance: string;
    spumpCostBasis: string;
    estimatedClaimableUsdc: string | null;
  }>;
};

type ActorSessions = {
  creator: AuthSession;
  sponsor: AuthSession;
  fans: AuthSession[];
  tradeFan: AuthSession;
};

type CorridorState = {
  runId: string;
  createdAt: string;
  creator: string;
  sponsor: string;
  fans: Array<{
    wallet: string;
    cohort: "EARLY" | "REGULAR";
  }>;
  tradeFan: string;
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
const AUTHORITIES_PATH = path.resolve(ROOT, ".local/devnet-demo-authorities.json");
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp";
const REQUIRED_BRANCH = "codex/post-deadline-phase-0";
const API_BASE_URL = (process.env.STREAM_PUMP_S1_FULL_CORRIDOR_API_BASE_URL || "http://localhost:4000/api/v1")
  .trim()
  .replace(/\/+$/, "");
const HEALTH_URL = API_BASE_URL.replace(/\/api\/v1$/, "/health");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const CORE_FAN_COUNT = 22;
const EARLY_FAN_COUNT = 20;
const BUY_AMOUNT = 25n;
const TRADE_AMOUNT = 5n;
const RAGE_QUIT_AMOUNT = BUY_AMOUNT;
const OFFER_USDC_AMOUNT = 1_000_000_000n;
const USER_ROLE_FAN = 1 << 0;
const TEST_RAGE_QUIT_SECONDS = 15;
const PRODUCTION_RAGE_QUIT_SECONDS = 48 * 3_600;
const USER_REWARD_AMOUNT = 20_000_000n;
const USER_XP_GAIN = 10n;
const RPC_THROTTLE_MS = Number(process.env.STREAM_PUMP_S1_FULL_CORRIDOR_RPC_THROTTLE_MS ?? 1_200);

const reportPath = path.resolve(ROOT, `.local/reports/s1-full-corridor-${RUN_ID}.json`);
const statePath = path.resolve(ROOT, `.local/s1-full-corridor-${RUN_ID}.json`);

const log = (message: string) => console.log(`[s1-full] ${message}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;
const digestHex = (value: string) => createHash("sha256").update(value).digest("hex");

const stringifyJson = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry),
    2
  );

const writeJson = (filePath: string, value: unknown) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${stringifyJson(value)}\n`);
};

const parseKeypairSecret = (value: string, label: string): Keypair => {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value) as number[]));
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${String(error)}`);
  }
};

const requireEnvKeypair = (envName: string): Keypair => {
  const value = process.env[envName]?.trim();
  if (!value) throw new ExpectedBlocker("ENV_KEYPAIR_REQUIRED", `${envName} is required.`, { envName });
  return parseKeypairSecret(value, envName);
};

const keypairFromStored = (stored: StoredKeypair): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));

const loadDemoAuthorityKeypair = (key: "oracle"): Keypair | null => {
  if (!existsSync(AUTHORITIES_PATH)) return null;
  const state = JSON.parse(readFileSync(AUTHORITIES_PATH, "utf8")) as Record<string, StoredKeypair | unknown>;
  const stored = state[key] as StoredKeypair | undefined;
  return stored?.secretKey ? keypairFromStored(stored) : null;
};

const optionalEnvKeypair = (envName: string): Keypair | null => {
  const value = process.env[envName]?.trim();
  return value ? parseKeypairSecret(value, envName) : null;
};

const loadAdmin = (): Keypair => {
  if (process.env.PROTOCOL_ADMIN_SECRET_KEY?.trim()) {
    return requireEnvKeypair("PROTOCOL_ADMIN_SECRET_KEY");
  }
  const adminPath = path.resolve(ROOT, ".local/devnet-admin-keypair.json");
  if (!existsSync(adminPath)) {
    throw new ExpectedBlocker("ADMIN_KEYPAIR_REQUIRED", "Missing protocol admin keypair.", {
      envName: "PROTOCOL_ADMIN_SECRET_KEY",
      fallbackPath: adminPath,
    });
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(adminPath, "utf8")) as number[]));
};

const loadOracle = (): Keypair => {
  if (process.env.ORACLE_AUTHORITY_SECRET_KEY?.trim()) {
    return requireEnvKeypair("ORACLE_AUTHORITY_SECRET_KEY");
  }
  const oracle = loadDemoAuthorityKeypair("oracle");
  if (!oracle) {
    throw new ExpectedBlocker("ORACLE_KEYPAIR_REQUIRED", "Missing oracle authority keypair.", {
      envName: "ORACLE_AUTHORITY_SECRET_KEY",
      fallbackPath: AUTHORITIES_PATH,
    });
  }
  return oracle;
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
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
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

const ensureBranch = () => {
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (branch !== REQUIRED_BRANCH) {
    throw new ExpectedBlocker("WRONG_BRANCH", `Refusing to run outside ${REQUIRED_BRANCH}.`, { branch });
  }
};

const ensureBackend = async () => {
  try {
    const response = await fetch(HEALTH_URL);
    if (!response.ok) throw new Error(`health returned ${response.status}`);
  } catch (error) {
    throw new ExpectedBlocker("BACKEND_NOT_RUNNING", "Start the backend before running the S1 corridor.", {
      healthUrl: HEALTH_URL,
      error: error instanceof Error ? error.message : String(error),
    });
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

const signTransactionBase64 = (transactionBase64: string, keypair: Keypair): string => {
  const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
  tx.sign([keypair]);
  return Buffer.from(tx.serialize()).toString("base64");
};

const submitS1ApiTransaction = async (params: {
  label: string;
  route: string;
  token: string;
  signer: Keypair;
  body?: Record<string, unknown>;
}): Promise<{
  signature: string;
  build: S1BuildTransactionResponse;
  submit: S1SubmitTransactionResponse;
}> => {
  const build = await request<S1BuildTransactionResponse>(params.route, {
    method: "POST",
    token: params.token,
    body: params.body ?? {},
  });
  const signedTransactionBase64 = signTransactionBase64(build.transactionBase64, params.signer);
  const submit = await request<S1SubmitTransactionResponse>("/s1/transactions/submit", {
    method: "POST",
    token: params.token,
    timeoutMs: 180_000,
    body: {
      signedTransactionBase64,
      recentBlockhash: build.recentBlockhash,
      lastValidBlockHeight: build.lastValidBlockHeight,
    },
  });
  if (submit.projectionSync.status !== "SYNCED") {
    throw new Error(`${params.label} projection sync failed: ${stringifyJson(submit.projectionSync)}`);
  }
  log(`${params.label}: ${submit.signature}`);
  await sleep(RPC_THROTTLE_MS);
  return { signature: submit.signature, build, submit };
};

const expectS1ApiTransactionFailure = async (params: {
  label: string;
  route: string;
  token: string;
  signer: Keypair;
  body?: Record<string, unknown>;
}): Promise<string> => {
  try {
    const result = await submitS1ApiTransaction(params);
    throw new Error(`${params.label} unexpectedly succeeded: ${result.signature}`);
  } catch (error) {
    if (error instanceof ApiError) {
      log(`${params.label}: expected failure ${error.code}`);
      await sleep(RPC_THROTTLE_MS);
      return error.code;
    }
    if (error instanceof Error && /unexpectedly succeeded/.test(error.message)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    log(`${params.label}: expected failure ${message}`);
    await sleep(RPC_THROTTLE_MS);
    return message;
  }
};

const ensureAta = async (params: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  owner: PublicKey;
  tokenProgramId: PublicKey;
}): Promise<PublicKey> => {
  const ata = getAssociatedTokenAddressSync(
    params.mint,
    params.owner,
    false,
    params.tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  await sendAndConfirmTransaction(
    params.connection,
    new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        params.payer.publicKey,
        ata,
        params.owner,
        params.mint,
        params.tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    ),
    [params.payer],
    { commitment: "confirmed" }
  );
  await sleep(RPC_THROTTLE_MS);
  return ata;
};

const ensureSolBalances = async (
  connection: Connection,
  admin: Keypair,
  actors: Array<{ label: string; keypair: Keypair; minSol: number }>
) => {
  const topUps: Array<{ label: string; keypair: Keypair; lamports: number }> = [];
  for (const actor of actors) {
    const balance = await connection.getBalance(actor.keypair.publicKey, "confirmed");
    const required = Math.ceil(actor.minSol * LAMPORTS_PER_SOL);
    if (balance < required) {
      topUps.push({ label: actor.label, keypair: actor.keypair, lamports: required - balance });
    }
  }

  const adminBalance = await connection.getBalance(admin.publicKey, "confirmed");
  const adminReserve = Math.ceil(0.25 * LAMPORTS_PER_SOL);
  const totalTopUp = topUps
    .filter((topUp) => !topUp.keypair.publicKey.equals(admin.publicKey))
    .reduce((sum, topUp) => sum + topUp.lamports, 0);
  if (adminBalance < totalTopUp + adminReserve) {
    throw new ExpectedBlocker("DEVNET_SOL_REQUIRED", "Fund these devnet addresses with SOL, then rerun.", {
      admin: {
        wallet: admin.publicKey.toBase58(),
        currentSol: adminBalance / LAMPORTS_PER_SOL,
        requiredSol: (totalTopUp + adminReserve) / LAMPORTS_PER_SOL,
      },
      underfunded: topUps.map((topUp) => ({
        label: topUp.label,
        wallet: topUp.keypair.publicKey.toBase58(),
        missingSol: topUp.lamports / LAMPORTS_PER_SOL,
      })),
    });
  }

  for (const topUp of topUps) {
    if (topUp.keypair.publicKey.equals(admin.publicKey)) continue;
    log(`funding ${topUp.label} ${short(topUp.keypair.publicKey.toBase58())} with ${topUp.lamports / LAMPORTS_PER_SOL} SOL`);
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: topUp.keypair.publicKey,
          lamports: topUp.lamports,
        })
      ),
      [admin],
      { commitment: "confirmed" }
    );
    await sleep(RPC_THROTTLE_MS);
  }
};

const ensureSponsorUsdcBalance = async (params: {
  connection: Connection;
  admin: Keypair;
  sponsorUsdcAta: PublicKey;
  usdcMint: PublicKey;
}) => {
  const existing = await getAccount(params.connection, params.sponsorUsdcAta, "confirmed", TOKEN_PROGRAM_ID);
  if (existing.amount >= OFFER_USDC_AMOUNT) return;

  const mint = await getMint(params.connection, params.usdcMint, "confirmed", TOKEN_PROGRAM_ID);
  const demoMintAuthority = optionalEnvKeypair("DEMO_USDC_MINT_AUTHORITY_SECRET_KEY");
  const mintAuthority =
    mint.mintAuthority?.equals(params.admin.publicKey) === true
      ? params.admin
      : demoMintAuthority && mint.mintAuthority?.equals(demoMintAuthority.publicKey)
        ? demoMintAuthority
        : null;

  if (!mintAuthority) {
    throw new ExpectedBlocker("USDC_MINT_AUTHORITY_REQUIRED", "Sponsor needs simulated USDC before submitting buyout offer.", {
      sponsorUsdcAta: params.sponsorUsdcAta.toBase58(),
      requiredBaseUnits: OFFER_USDC_AMOUNT.toString(),
      currentBaseUnits: existing.amount.toString(),
      hint: "Set DEMO_USDC_MINT_AUTHORITY_SECRET_KEY or manually fund the sponsor ATA.",
    });
  }

  await mintTo(
    params.connection,
    mintAuthority,
    params.usdcMint,
    params.sponsorUsdcAta,
    mintAuthority.publicKey,
    OFFER_USDC_AMOUNT - existing.amount,
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  await sleep(RPC_THROTTLE_MS);
};

const loadBackendModules = async () => {
  const anchorService = await import("../backend/src/services/AnchorService");
  const indexer = await import("../backend/src/services/indexer");
  const market = await import("../backend/src/services/marketProjectionService");
  const prismaModule = await import("../backend/src/services/prisma");

  return {
    getAnchorService: anchorService.getAnchorService as typeof anchorService.getAnchorService,
    ingestConfirmedProgramTransaction:
      indexer.ingestConfirmedProgramTransaction as typeof indexer.ingestConfirmedProgramTransaction,
    getCreatorMarketProjection:
      market.getCreatorMarketProjection as typeof market.getCreatorMarketProjection,
    getPortfolioProjection: market.getPortfolioProjection as typeof market.getPortfolioProjection,
    reconcileGraduatedS1BuyoutProjection:
      market.reconcileGraduatedS1BuyoutProjection as typeof market.reconcileGraduatedS1BuyoutProjection,
    refreshS1PositionProjectionByPda:
      market.refreshS1PositionProjectionByPda as typeof market.refreshS1PositionProjectionByPda,
    prisma: prismaModule.prisma as typeof prismaModule.prisma,
  };
};

const createBackup = async (params: {
  prisma: any;
  connection: Connection;
  wallets: string[];
  creatorWallet: string;
  creatorProfilePda: string;
  usdcMint: PublicKey;
  spumpMint: PublicKey;
}) => {
  const [
    profiles,
    identities,
    sessions,
    creatorMarket,
    positions,
    offers,
    buyouts,
  ] = await Promise.all([
    params.prisma.accountProfile.findMany({ where: { wallet: { in: params.wallets } } }),
    params.prisma.authIdentity.findMany({ where: { managedWalletAddress: { in: params.wallets } } }),
    params.prisma.walletSession.findMany({ where: { wallet: { in: params.wallets } } }),
    params.prisma.creatorMarketProjection.findMany({
      where: { OR: [{ creatorWallet: params.creatorWallet }, { creatorProfilePda: params.creatorProfilePda }] },
    }),
    params.prisma.s1PositionProjection.findMany({
      where: { OR: [{ userWallet: { in: params.wallets } }, { creatorProfilePda: params.creatorProfilePda }] },
    }),
    params.prisma.s1BuyoutOfferProjection.findMany({
      where: { OR: [{ sponsorWallet: { in: params.wallets } }, { creatorProfilePda: params.creatorProfilePda }] },
    }),
    params.prisma.s1BuyoutProjection.findMany({
      where: { OR: [{ creatorWallet: params.creatorWallet }, { creatorProfilePda: params.creatorProfilePda }] },
    }),
  ]);

  const balances = [];
  for (const wallet of params.wallets) {
    const owner = new PublicKey(wallet);
    balances.push({
      wallet,
      solLamports: await params.connection.getBalance(owner, "confirmed"),
      usdcAmount: await tokenAmount(params.connection, owner, params.usdcMint, TOKEN_PROGRAM_ID),
      spumpAmount: await tokenAmount(params.connection, owner, params.spumpMint, TOKEN_2022_PROGRAM_ID),
    });
  }

  const backupPath = path.resolve(ROOT, `.local/backups/s1-full-corridor-${RUN_ID}.json`);
  writeJson(backupPath, {
    createdAt: new Date().toISOString(),
    wallets: params.wallets,
    balances,
    profiles,
    identities,
    sessions,
    creatorMarket,
    positions,
    offers,
    buyouts,
  });
  return backupPath;
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

const waitUntilDeadline = async (deadline: anchor.BN) => {
  const targetMs = deadline.toNumber() * 1000;
  const waitMs = Math.max(0, targetMs - Date.now() + 2_500);
  if (waitMs > 0) {
    log(`waiting ${Math.ceil(waitMs / 1000)}s for rage quit deadline`);
    await sleep(waitMs);
  }
};

const buildActors = () => {
  const creator = Keypair.generate();
  const sponsor = Keypair.generate();
  const fans = Array.from({ length: CORE_FAN_COUNT }, () => Keypair.generate());
  const tradeFan = Keypair.generate();
  writeJson(statePath, {
    runId: RUN_ID,
    createdAt: new Date().toISOString(),
    creator: creator.publicKey.toBase58(),
    sponsor: sponsor.publicKey.toBase58(),
    fans: fans.map((fan, index) => ({
      wallet: fan.publicKey.toBase58(),
      cohort: index < EARLY_FAN_COUNT ? "EARLY" : "REGULAR",
    })),
    tradeFan: tradeFan.publicKey.toBase58(),
  });
  return { creator, sponsor, fans, tradeFan };
};

const assertPosition = (
  portfolio: Awaited<ReturnType<Awaited<ReturnType<typeof loadBackendModules>>["getPortfolioProjection"]>>,
  creatorProfilePda: string
) => portfolio.positions.find((position) => position.creatorProfilePda === creatorProfilePda) ?? null;

const reconcileExistingRun = async (stateFilePath: string) => {
  await ensureBackend();
  const resolvedStatePath = path.resolve(ROOT, stateFilePath);
  if (!existsSync(resolvedStatePath)) {
    throw new ExpectedBlocker("RECONCILE_STATE_NOT_FOUND", "Cannot reconcile missing S1 corridor state file.", {
      stateFilePath: resolvedStatePath,
    });
  }

  const state = JSON.parse(readFileSync(resolvedStatePath, "utf8")) as CorridorState;
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || DEFAULT_RPC;
  const backend = await loadBackendModules();
  try {
    await backend.prisma.$queryRawUnsafe("select 1");
    const anchorService = backend.getAnchorService();
    const creator = new PublicKey(state.creator);
    const creatorProfile = anchorService.deriveCreatorProfilePda(creator);
    await backend.reconcileGraduatedS1BuyoutProjection(creatorProfile.toBase58(), {
      signature: `manual-reconcile-${RUN_ID}`,
      observedAt: new Date(),
    });

    for (const fan of state.fans) {
      const positionPda = anchorService.deriveS1PositionPda(new PublicKey(fan.wallet), creatorProfile);
      await backend.refreshS1PositionProjectionByPda(positionPda.toBase58(), {
        signature: `manual-reconcile-${RUN_ID}`,
        observedAt: new Date(),
      });
    }

    const market = await backend.getCreatorMarketProjection(state.creator);
    if (!market?.creator || market.creator.stage !== "S2_ACTIVE") {
      throw new Error(`Expected reconciled creator stage S2_ACTIVE, got ${market?.creator?.stage ?? "null"}`);
    }
    if (market.buyout?.status !== "GRADUATED") {
      throw new Error(`Expected reconciled buyout status GRADUATED, got ${market.buyout?.status ?? "null"}`);
    }

    const earlyClaimWallet = state.fans[0]?.wallet;
    const unclaimedWallet = state.fans[1]?.wallet;
    const rageQuitWallet = state.fans[2]?.wallet;
    const regularClaimWallet = state.fans[EARLY_FAN_COUNT]?.wallet;
    if (!earlyClaimWallet || !unclaimedWallet || !rageQuitWallet || !regularClaimWallet) {
      throw new Error("S1 corridor state is missing required fan indexes.");
    }

    const [earlyPortfolio, unclaimedPortfolio, ragePortfolio, regularPortfolio] = await Promise.all([
      backend.getPortfolioProjection(earlyClaimWallet),
      backend.getPortfolioProjection(unclaimedWallet),
      backend.getPortfolioProjection(rageQuitWallet),
      backend.getPortfolioProjection(regularClaimWallet),
    ]);
    const creatorProfilePda = creatorProfile.toBase58();
    const earlyPosition = assertPosition(earlyPortfolio, creatorProfilePda);
    const unclaimedPosition = assertPosition(unclaimedPortfolio, creatorProfilePda);
    const ragePosition = assertPosition(ragePortfolio, creatorProfilePda);
    const regularPosition = assertPosition(regularPortfolio, creatorProfilePda);

    if (earlyPosition && BigInt(earlyPosition.internalTokenBalance) !== 0n) {
      throw new Error(`Expected early claimed holder balance 0, got ${earlyPosition.internalTokenBalance}`);
    }
    if (regularPosition && BigInt(regularPosition.internalTokenBalance) !== 0n) {
      throw new Error(`Expected regular claimed holder balance 0, got ${regularPosition.internalTokenBalance}`);
    }
    if (ragePosition && BigInt(ragePosition.internalTokenBalance) !== 0n) {
      throw new Error(`Expected rage quitter balance 0, got ${ragePosition.internalTokenBalance}`);
    }
    if (!unclaimedPosition || BigInt(unclaimedPosition.estimatedClaimableUsdc ?? "0") <= 0n) {
      throw new Error("Expected unclaimed holder to retain positive claimable USDC after projection reconciliation.");
    }

    const finalReport = {
      status: "COMPLETED",
      mode: "RECONCILE_EXISTING_RUN",
      runId: RUN_ID,
      reconciledSourceRunId: state.runId,
      createdAt: new Date().toISOString(),
      rpcEndpoint,
      statePath: resolvedStatePath,
      actors: {
        creator: state.creator,
        sponsor: state.sponsor,
        tradeFan: state.tradeFan,
        earlyClaimFan: earlyClaimWallet,
        regularClaimFan: regularClaimWallet,
        rageQuitFan: rageQuitWallet,
        unclaimedFan: unclaimedWallet,
      },
      assertions: {
        creatorStage: market.creator.stage,
        buyoutStatus: market.buyout.status,
        remainingClaimableUsdc: market.buyout.claimableUsdcRemaining,
        remainingClaimableS1Supply: market.buyout.claimableS1SupplyRemaining,
        unclaimedEstimatedClaimableUsdc: unclaimedPosition.estimatedClaimableUsdc,
        earlyClaimedBalance: earlyPosition?.internalTokenBalance ?? "0",
        regularClaimedBalance: regularPosition?.internalTokenBalance ?? "0",
        rageQuitBalance: ragePosition?.internalTokenBalance ?? "0",
      },
      reviewUrls: {
        market: `http://localhost:3000/market/${state.creator}`,
        buyout: `http://localhost:3000/buyout/${state.creator}`,
        portfolio: "http://localhost:3000/portfolio",
      },
    };
    writeJson(reportPath, finalReport);
    console.log("[s1-full] success");
    console.log(stringifyJson(finalReport));
  } finally {
    await backend.prisma.$disconnect();
  }
};

const createSessionsAndProfiles = async (actors: {
  creator: Keypair;
  sponsor: Keypair;
  fans: Keypair[];
  tradeFan: Keypair;
}): Promise<ActorSessions> => {
  log("creating wallet sessions and AccountProfile records");
  const creator = await signInWallet(actors.creator);
  const sponsor = await signInWallet(actors.sponsor);
  const fans = [];
  const tradeFan = await signInWallet(actors.tradeFan);

  await upsertAccountProfile(creator.accessToken, {
    role: "CREATOR",
    displayName: `S1 Corridor Creator ${RUN_ID.slice(0, 10)}`,
    handle: `s1-creator-${actors.creator.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  await upsertAccountProfile(sponsor.accessToken, {
    role: "SPONSOR",
    displayName: `S1 Corridor Sponsor ${RUN_ID.slice(0, 10)}`,
    handle: `s1-sponsor-${actors.sponsor.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  await upsertAccountProfile(tradeFan.accessToken, {
    role: "FAN",
    displayName: "S1 Corridor Trade Fan",
    handle: `s1-trade-${actors.tradeFan.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
  });
  for (const [index, fan] of actors.fans.entries()) {
    const session = await signInWallet(fan);
    fans.push(session);
    await upsertAccountProfile(session.accessToken, {
      role: "FAN",
      displayName: `S1 Corridor Fan ${index + 1}`,
      handle: `s1-fan-${fan.publicKey.toBase58().slice(0, 6).toLowerCase()}`,
    });
  }

  return { creator, sponsor, fans, tradeFan };
};

const buildRewardBody = (label: string) => ({
  missionType: "COMPLETE_PROFILE",
  rewardAmount: USER_REWARD_AMOUNT.toString(),
  xpGain: USER_XP_GAIN.toString(),
  newLevel: null,
  reportIdHex: digestHex(`s1-full-report-id-${RUN_ID}-${label}`),
  reportDigestHex: digestHex(`s1-full-report-digest-${RUN_ID}-${label}`),
  observedAtUnix: String(Math.floor(Date.now() / 1000) - 5),
});

const main = async () => {
  ensureBranch();
  const reconcileStatePath = process.env.STREAM_PUMP_S1_FULL_RECONCILE_STATE?.trim();
  if (reconcileStatePath) {
    await reconcileExistingRun(reconcileStatePath);
    return;
  }
  await ensureBackend();

  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || DEFAULT_RPC;
  const programId = process.env.STREAMPUMP_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  const admin = loadAdmin();
  const oracle = loadOracle();
  const connection = new Connection(rpcEndpoint, "confirmed");
  const programPubkey = new PublicKey(programId);
  const programAccount = await connection.getAccountInfo(programPubkey, "confirmed");
  if (!programAccount?.executable) {
    throw new ExpectedBlocker("PROGRAM_NOT_DEPLOYED", "Configured devnet program is not executable.", {
      programId,
      rpcEndpoint,
    });
  }

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.PROTOCOL_ADMIN_SECRET_KEY = JSON.stringify(Array.from(admin.secretKey));
  process.env.INDEXER_ENABLED = "false";

  const actors = buildActors();
  log(`state written: ${statePath}`);
  log(`creator=${actors.creator.publicKey.toBase58()}`);
  log(`sponsor=${actors.sponsor.publicKey.toBase58()}`);

  await ensureSolBalances(connection, admin, [
    { label: "admin", keypair: admin, minSol: 0.25 },
    { label: "oracle", keypair: oracle, minSol: 0.05 },
    { label: "creator", keypair: actors.creator, minSol: 0.12 },
    { label: "sponsor", keypair: actors.sponsor, minSol: 0.12 },
    { label: "tradeFan", keypair: actors.tradeFan, minSol: 0.03 },
    ...actors.fans.map((fan, index) => ({ label: `fan${index}`, keypair: fan, minSol: 0.035 })),
  ]);

  const backend = await loadBackendModules();
  await backend.prisma.$queryRawUnsafe("select 1");
  const anchorService = backend.getAnchorService();
  const program = anchorService.program as any;
  const protocolConfigPda = anchorService.deriveProtocolConfigPda();
  const protocolConfig = await anchorService.fetchProtocolConfigAccount();

  if (!(protocolConfig.admin as PublicKey).equals(admin.publicKey)) {
    throw new ExpectedBlocker("ADMIN_MISMATCH", "PROTOCOL_ADMIN_SECRET_KEY does not match protocol config admin.", {
      expected: (protocolConfig.admin as PublicKey).toBase58(),
      actual: admin.publicKey.toBase58(),
    });
  }
  if (!(protocolConfig.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
    throw new ExpectedBlocker("ORACLE_MISMATCH", "ORACLE_AUTHORITY_SECRET_KEY does not match protocol config oracle.", {
      expected: (protocolConfig.oracleAuthority as PublicKey).toBase58(),
      actual: oracle.publicKey.toBase58(),
    });
  }

  const usdcMint = protocolConfig.usdcMint as PublicKey;
  const spumpMint = protocolConfig.spumpMint as PublicKey;
  const creatorProfile = anchorService.deriveCreatorProfilePda(actors.creator.publicKey);
  const wallets = [
    actors.creator.publicKey.toBase58(),
    actors.sponsor.publicKey.toBase58(),
    actors.tradeFan.publicKey.toBase58(),
    ...actors.fans.map((fan) => fan.publicKey.toBase58()),
  ];
  const backupPath = await createBackup({
    prisma: backend.prisma,
    connection,
    wallets,
    creatorWallet: actors.creator.publicKey.toBase58(),
    creatorProfilePda: creatorProfile.toBase58(),
    usdcMint,
    spumpMint,
  });
  log(`backup written: ${backupPath}`);

  const syncTx = async (label: string, signature: string) => {
    log(`${label}: ${signature}`);
    await backend.ingestConfirmedProgramTransaction(signature, { updateCursor: false });
    await sleep(RPC_THROTTLE_MS);
  };

    const setS1RageQuitWindow = async (seconds: number) => {
    const current = await anchorService.fetchProtocolS1Config();
    const signature = await program.methods
      .updateProtocolS1Emission({
        dailySpumpEmissionMultiplierBps: current.dailySpumpEmissionMultiplierBps,
        newUserEmissionBps: current.newUserEmissionBps,
        newUserEmissionWindowSeconds: new anchor.BN(current.newUserEmissionWindowSeconds),
        s1MinUserXp: new anchor.BN(current.s1MinUserXp.toString()),
        maxS1DailyBuySpump: new anchor.BN(current.maxS1DailyBuySpump.toString()),
        s1EarlyCohortSupplyThreshold: new anchor.BN(current.s1EarlyCohortSupplyThreshold.toString()),
        s1EarlyCohortBuyoutCapBps: current.s1EarlyCohortBuyoutCapBps,
        s1RageQuitWindowSeconds: new anchor.BN(seconds),
      })
      .accounts({
        admin: admin.publicKey,
        protocolConfig: protocolConfigPda,
      })
      .signers([admin])
      .rpc();
    await syncTx(`set rage quit window ${seconds}s`, signature);
    return signature;
  };

  const signatures: Record<string, string | string[]> = {};
  let windowShortened = false;
  try {
    const sessions = await createSessionsAndProfiles(actors);

    await ensureAta({
      connection,
      payer: admin,
      mint: usdcMint,
      owner: actors.creator.publicKey,
      tokenProgramId: TOKEN_PROGRAM_ID,
    });
    await ensureAta({
      connection,
      payer: admin,
      mint: spumpMint,
      owner: actors.creator.publicKey,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    });
    const sponsorUsdcAta = await ensureAta({
      connection,
      payer: admin,
      mint: usdcMint,
      owner: actors.sponsor.publicKey,
      tokenProgramId: TOKEN_PROGRAM_ID,
    });
    await ensureSponsorUsdcBalance({ connection, admin, sponsorUsdcAta, usdcMint });

    const registerCreatorSignature = await program.methods
      .registerCreator({
        handle: `s1_full_${actors.creator.publicKey.toBase58().slice(0, 6)}`,
        payoutUsdcAta: getAssociatedTokenAddressSync(usdcMint, actors.creator.publicKey),
      })
      .accounts({
        authority: actors.creator.publicKey,
        protocolConfig: protocolConfigPda,
        creatorProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([actors.creator])
      .rpc();
    signatures.registerCreator = registerCreatorSignature;
    await syncTx("register creator", registerCreatorSignature);

    await setS1RageQuitWindow(TEST_RAGE_QUIT_SECONDS);
    windowShortened = true;

    const claimEngagementRewardDirect = async (fan: Keypair, label: string, userSpumpAta: PublicKey) => {
      const userProfile = anchorService.deriveUserProfilePda(fan.publicKey);
      const reportId = Uint8Array.from(Buffer.from(digestHex(`s1-full-report-id-${RUN_ID}-${label}`), "hex"));
      const reportDigest = Array.from(Buffer.from(digestHex(`s1-full-report-digest-${RUN_ID}-${label}`), "hex"));
      const rewardReceipt = anchorService.deriveUserRewardReceiptPda(userProfile, reportId);
      const signature = await program.methods
        .claimEngagementReward({
          missionType: { completeProfile: {} },
          rewardAmount: new anchor.BN(USER_REWARD_AMOUNT.toString()),
          xpGain: new anchor.BN(USER_XP_GAIN.toString()),
          newLevel: null,
          reportId: Array.from(reportId),
          reportDigest,
          observedAt: new anchor.BN(Math.floor(Date.now() / 1000) - 5),
        })
        .accounts({
          user: fan.publicKey,
          oracle: oracle.publicKey,
          protocolConfig: protocolConfigPda,
          userProfile,
          rewardReceipt,
          userSpumpAta,
          spumpMint,
          spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([fan, oracle])
        .rpc();
      await syncTx(`${label} engagement reward`, signature);
      return signature;
    };

    const refreshCorePositionProjections = async (label: string, signature?: string) => {
      log(`refreshing core S1 position projections: ${label}`);
      await backend.reconcileGraduatedS1BuyoutProjection(creatorProfile.toBase58(), {
        signature,
        observedAt: new Date(),
      });
      for (const fan of actors.fans) {
        const positionPda = anchorService.deriveS1PositionPda(fan.publicKey, creatorProfile);
        await backend.refreshS1PositionProjectionByPda(positionPda.toBase58(), {
          signature,
          observedAt: new Date(),
        });
      }
    };

    const registerAndRewardFan = async (fan: Keypair, session: AuthSession, label: string) => {
      const userSpumpAta = await ensureAta({
        connection,
        payer: admin,
        mint: spumpMint,
        owner: fan.publicKey,
        tokenProgramId: TOKEN_2022_PROGRAM_ID,
      });
      await ensureAta({
        connection,
        payer: admin,
        mint: usdcMint,
        owner: fan.publicKey,
        tokenProgramId: TOKEN_PROGRAM_ID,
      });
      await submitS1ApiTransaction({
        label: `${label} register user`,
        route: "/s1/register-user/build",
        token: session.accessToken,
        signer: fan,
        body: { roleFlags: USER_ROLE_FAN },
      });
      await claimEngagementRewardDirect(fan, label, userSpumpAta);
    };

    await registerAndRewardFan(actors.tradeFan, sessions.tradeFan, "trade fan");
    for (const [index, fan] of actors.fans.entries()) {
      await registerAndRewardFan(fan, sessions.fans[index], `fan ${index}`);
    }

    const tradeBuy = await submitS1ApiTransaction({
      label: "trade fan buy",
      route: "/s1/buy/build",
      token: sessions.tradeFan.accessToken,
      signer: actors.tradeFan,
      body: { creatorWallet: actors.creator.publicKey.toBase58(), amount: TRADE_AMOUNT.toString() },
    });
    const tradeSpumpBeforeSell = await tokenAmount(connection, actors.tradeFan.publicKey, spumpMint, TOKEN_2022_PROGRAM_ID);
    const tradeSell = await submitS1ApiTransaction({
      label: "trade fan sell",
      route: "/s1/sell/build",
      token: sessions.tradeFan.accessToken,
      signer: actors.tradeFan,
      body: { creatorWallet: actors.creator.publicKey.toBase58(), amount: TRADE_AMOUNT.toString() },
    });
    const tradeSpumpAfterSell = await tokenAmount(connection, actors.tradeFan.publicKey, spumpMint, TOKEN_2022_PROGRAM_ID);
    if (tradeSpumpAfterSell <= tradeSpumpBeforeSell) {
      throw new Error("Trade fan SPUMP balance did not increase after selling S1");
    }
    signatures.tradeBuy = tradeBuy.signature;
    signatures.tradeSell = tradeSell.signature;

    const buySignatures: string[] = [];
    for (const [index, fan] of actors.fans.entries()) {
      const buy = await submitS1ApiTransaction({
        label: `core fan ${index} buy`,
        route: "/s1/buy/build",
        token: sessions.fans[index].accessToken,
        signer: fan,
        body: { creatorWallet: actors.creator.publicKey.toBase58(), amount: BUY_AMOUNT.toString() },
      });
      buySignatures.push(buy.signature);
    }
    signatures.coreFanBuys = buySignatures;

    const activeMarket = await request<S1MarketProfileResponse>(
      `/market/creators/${actors.creator.publicKey.toBase58()}`
    );
    if (activeMarket.creator.stage !== "S1_DISCOVERY" || BigInt(activeMarket.creator.s1Supply) < BUY_AMOUNT * BigInt(CORE_FAN_COUNT)) {
      throw new Error(`Unexpected active S1 market projection: ${stringifyJson(activeMarket.creator)}`);
    }

    const init = await submitS1ApiTransaction({
      label: "creator init buyout",
      route: "/s1/buyout/init/build",
      token: sessions.creator.accessToken,
      signer: actors.creator,
    });
    signatures.initBuyout = init.signature;

    const blockedBuyAfterInit = await expectS1ApiTransactionFailure({
      label: "ordinary buy after buyout init",
      route: "/s1/buy/build",
      token: sessions.tradeFan.accessToken,
      signer: actors.tradeFan,
      body: { creatorWallet: actors.creator.publicKey.toBase58(), amount: "1" },
    });
    const blockedSellAfterInit = await expectS1ApiTransactionFailure({
      label: "ordinary sell after buyout init",
      route: "/s1/sell/build",
      token: sessions.fans[3].accessToken,
      signer: actors.fans[3],
      body: { creatorWallet: actors.creator.publicKey.toBase58(), amount: "1" },
    });

    const offer = await submitS1ApiTransaction({
      label: "sponsor submit buyout offer",
      route: "/s1/buyout/offer/build",
      token: sessions.sponsor.accessToken,
      signer: actors.sponsor,
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        usdcAmount: OFFER_USDC_AMOUNT.toString(),
      },
    });
    signatures.submitOffer = offer.signature;

    const accept = await submitS1ApiTransaction({
      label: "creator accept offer",
      route: "/s1/buyout/accept/build",
      token: sessions.creator.accessToken,
      signer: actors.creator,
      body: { sponsorWallet: actors.sponsor.publicKey.toBase58() },
    });
    signatures.acceptOffer = accept.signature;

    const earlyGraduationFailure = await expectS1ApiTransactionFailure({
      label: "graduation before rage quit deadline",
      route: "/s1/buyout/graduation/build",
      token: sessions.fans[0].accessToken,
      signer: actors.fans[0],
      body: { creatorWallet: actors.creator.publicKey.toBase58() },
    });

    const rageFanIndex = 2;
    const rageSpumpBefore = await tokenAmount(connection, actors.fans[rageFanIndex].publicKey, spumpMint, TOKEN_2022_PROGRAM_ID);
    const rageQuit = await submitS1ApiTransaction({
      label: `fan ${rageFanIndex} rage quit`,
      route: "/s1/rage-quit/build",
      token: sessions.fans[rageFanIndex].accessToken,
      signer: actors.fans[rageFanIndex],
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        amount: RAGE_QUIT_AMOUNT.toString(),
      },
    });
    const rageSpumpAfter = await tokenAmount(connection, actors.fans[rageFanIndex].publicKey, spumpMint, TOKEN_2022_PROGRAM_ID);
    const rageQuitSpumpDelta = rageSpumpAfter - rageSpumpBefore;
    if (rageQuitSpumpDelta <= 0n) {
      throw new Error(
        `Rage quit did not return SPUMP: before ${rageSpumpBefore.toString()}, after ${rageSpumpAfter.toString()}`
      );
    }
    signatures.rageQuit = rageQuit.signature;

    const buyoutState = await program.account.s1BuyoutState.fetch(anchorService.deriveS1BuyoutStatePda(creatorProfile));
    await waitUntilDeadline(buyoutState.rageQuitDeadline);

    const graduation = await submitS1ApiTransaction({
      label: "execute S1 graduation",
      route: "/s1/buyout/graduation/build",
      token: sessions.fans[0].accessToken,
      signer: actors.fans[0],
      body: { creatorWallet: actors.creator.publicKey.toBase58() },
    });
    signatures.executeGraduation = graduation.signature;
    await refreshCorePositionProjections("after graduation", graduation.signature);

    const earlyClaimIndex = 0;
    const regularClaimIndex = EARLY_FAN_COUNT;
    const earlyUsdcBefore = await tokenAmount(connection, actors.fans[earlyClaimIndex].publicKey, usdcMint, TOKEN_PROGRAM_ID);
    const earlyClaim = await submitS1ApiTransaction({
      label: "early holder claim USDC",
      route: "/s1/buyout/claim-usdc/build",
      token: sessions.fans[earlyClaimIndex].accessToken,
      signer: actors.fans[earlyClaimIndex],
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        sponsorWallet: actors.sponsor.publicKey.toBase58(),
      },
    });
    const earlyUsdcAfter = await tokenAmount(connection, actors.fans[earlyClaimIndex].publicKey, usdcMint, TOKEN_PROGRAM_ID);
    if (earlyUsdcAfter <= earlyUsdcBefore) {
      throw new Error("Early holder USDC balance did not increase after claim");
    }

    const regularUsdcBefore = await tokenAmount(connection, actors.fans[regularClaimIndex].publicKey, usdcMint, TOKEN_PROGRAM_ID);
    const regularClaim = await submitS1ApiTransaction({
      label: "regular holder claim USDC",
      route: "/s1/buyout/claim-usdc/build",
      token: sessions.fans[regularClaimIndex].accessToken,
      signer: actors.fans[regularClaimIndex],
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        sponsorWallet: actors.sponsor.publicKey.toBase58(),
      },
    });
    const regularUsdcAfter = await tokenAmount(connection, actors.fans[regularClaimIndex].publicKey, usdcMint, TOKEN_PROGRAM_ID);
    if (regularUsdcAfter <= regularUsdcBefore) {
      throw new Error("Regular holder USDC balance did not increase after claim");
    }
    signatures.claims = [earlyClaim.signature, regularClaim.signature];

    const rageClaimFailure = await expectS1ApiTransactionFailure({
      label: "rage-quit holder claim after full exit",
      route: "/s1/buyout/claim-usdc/build",
      token: sessions.fans[rageFanIndex].accessToken,
      signer: actors.fans[rageFanIndex],
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        sponsorWallet: actors.sponsor.publicKey.toBase58(),
      },
    });
    const doubleClaimFailure = await expectS1ApiTransactionFailure({
      label: "double claim early holder",
      route: "/s1/buyout/claim-usdc/build",
      token: sessions.fans[earlyClaimIndex].accessToken,
      signer: actors.fans[earlyClaimIndex],
      body: {
        creatorWallet: actors.creator.publicKey.toBase58(),
        sponsorWallet: actors.sponsor.publicKey.toBase58(),
      },
    });
    await refreshCorePositionProjections("after claims", regularClaim.signature);

    const graduatedMarket = await request<S1MarketProfileResponse>(
      `/market/creators/${actors.creator.publicKey.toBase58()}`
    );
    if (graduatedMarket.creator.stage !== "S2_ACTIVE") {
      throw new Error(`Expected creator stage S2_ACTIVE, got ${graduatedMarket.creator.stage}`);
    }
    if (graduatedMarket.buyout?.status !== "GRADUATED") {
      throw new Error(`Expected buyout status GRADUATED, got ${graduatedMarket.buyout?.status ?? "null"}`);
    }
    if (graduatedMarket.offers.length === 0) {
      throw new Error("Expected market projection to include the accepted buyout offer");
    }

    const earlyPortfolio = await request<S1PortfolioResponse>("/market/portfolio", {
      token: sessions.fans[earlyClaimIndex].accessToken,
    });
    const regularPortfolio = await request<S1PortfolioResponse>("/market/portfolio", {
      token: sessions.fans[regularClaimIndex].accessToken,
    });
    const claimablePortfolio = await request<S1PortfolioResponse>("/market/portfolio", {
      token: sessions.fans[1].accessToken,
    });
    const ragePortfolio = await request<S1PortfolioResponse>("/market/portfolio", {
      token: sessions.fans[rageFanIndex].accessToken,
    });
    const claimablePosition = claimablePortfolio.positions.find(
      (position) => position.creatorProfilePda === creatorProfile.toBase58()
    );
    if (!claimablePosition || BigInt(claimablePosition.estimatedClaimableUsdc ?? "0") <= 0n) {
      throw new Error("Expected an unclaimed holder to retain claimable USDC in portfolio projection");
    }
    const ragePosition = ragePortfolio.positions.find(
      (position) => position.creatorProfilePda === creatorProfile.toBase58()
    );
    if (ragePosition && BigInt(ragePosition.internalTokenBalance) !== 0n) {
      throw new Error(`Expected rage quitter S1 balance to be zero, got ${ragePosition.internalTokenBalance}`);
    }

    const finalReport = {
      status: "COMPLETED",
      runId: RUN_ID,
      createdAt: new Date().toISOString(),
      rpcEndpoint,
      programId,
      backupPath,
      statePath,
      actors: {
        creator: actors.creator.publicKey.toBase58(),
        sponsor: actors.sponsor.publicKey.toBase58(),
        tradeFan: actors.tradeFan.publicKey.toBase58(),
        earlyClaimFan: actors.fans[earlyClaimIndex].publicKey.toBase58(),
        regularClaimFan: actors.fans[regularClaimIndex].publicKey.toBase58(),
        rageQuitFan: actors.fans[rageFanIndex].publicKey.toBase58(),
        unclaimedFan: actors.fans[1].publicKey.toBase58(),
      },
      pdas: {
        creatorProfile: creatorProfile.toBase58(),
        buyoutState: graduatedMarket.buyout.buyoutStatePda,
        acceptedOffer: graduatedMarket.buyout.acceptedOfferPda,
      },
      assertions: {
        blockedBuyAfterInit,
        blockedSellAfterInit,
        earlyGraduationFailure,
        rageClaimFailure,
        doubleClaimFailure,
        rageQuitSpumpDelta: rageQuitSpumpDelta.toString(),
        earlyClaimUsdcDelta: (earlyUsdcAfter - earlyUsdcBefore).toString(),
        regularClaimUsdcDelta: (regularUsdcAfter - regularUsdcBefore).toString(),
        remainingClaimableUsdc: graduatedMarket.buyout.claimableUsdcRemaining,
        remainingClaimableS1Supply: graduatedMarket.buyout.claimableS1SupplyRemaining,
        earlyPortfolioPositions: earlyPortfolio.positions.length,
        regularPortfolioPositions: regularPortfolio.positions.length,
      },
      signatures,
      reviewUrls: {
        market: `http://localhost:3000/market/${actors.creator.publicKey.toBase58()}`,
        buyout: `http://localhost:3000/buyout/${actors.creator.publicKey.toBase58()}`,
        portfolio: "http://localhost:3000/portfolio",
      },
    };
    writeJson(reportPath, finalReport);
    console.log("[s1-full] success");
    console.log(stringifyJson(finalReport));
  } finally {
    if (windowShortened) {
      try {
        await setS1RageQuitWindow(PRODUCTION_RAGE_QUIT_SECONDS);
        log("restored rage quit window to 48h");
      } catch (error) {
        console.error("[s1-full] failed to restore rage quit window");
        console.error(error);
      }
    }
    await backend.prisma.$disconnect();
  }
};

main().catch((error) => {
  const payload =
    error instanceof ExpectedBlocker
      ? {
          status: "BLOCKED",
          runId: RUN_ID,
          code: error.code,
          message: error.message,
          details: error.details,
        }
      : error instanceof ApiError
        ? {
            status: "FAILED",
            runId: RUN_ID,
            code: error.code,
            message: error.message,
            httpStatus: error.status,
            details: error.details,
          }
        : {
            status: "FAILED",
            runId: RUN_ID,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };
  writeJson(reportPath, payload);
  console.error("[s1-full] failed");
  console.error(stringifyJson(payload));
  process.exitCode = 1;
});

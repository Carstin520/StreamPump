import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createInitializeNonTransferableMintInstruction,
  createMint,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  mintTo,
  setAuthority,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { keccak_256 } from "@noble/hashes/sha3";
import bs58 from "bs58";

import "../backend/config/loadEnv";

type StoredKeypair = {
  publicKey: string;
  secretKey: number[];
};

type SmokeState = {
  generatedAt: string;
  rpcEndpoint: string;
  programId: string;
  admin: StoredKeypair;
  oracle: StoredKeypair;
  creator: StoredKeypair;
  sponsor: StoredKeypair;
  usdcMint?: string;
  spumpMint?: StoredKeypair;
  protocolConfig?: string;
  creatorProfile?: string;
  creatorUsdcAta?: string;
  sponsorUsdcAta?: string;
  lastRun?: Record<string, unknown>;
};

const OUTPUT_PATH = path.resolve(process.cwd(), ".local/devnet-s2-happy-path.json");
const ADMIN_KEYPAIR_PATH = path.resolve(process.cwd(), ".local/devnet-admin-keypair.json");
const DEMO_AUTHORITIES_PATH = path.resolve(process.cwd(), ".local/devnet-demo-authorities.json");
const DEFAULT_RPC = "https://api.devnet.solana.com";
const SPONSOR_TEST_USDC_MINT_AMOUNT = 5_000_000_000n;
const TRACK1_AMOUNT = 10_000_000n;
const TRACK2_AMOUNT = 20_000_000n;
const TRACK3_AMOUNT = 5_000_000n;
const TRACK2_TARGET_VALUE = 1_000n;
const TRACK2_MIN_ACHIEVEMENT_BPS = 5_000;
const MOCK_TRACK2_ACTUAL_VALUE = 800;
const MOCK_TRACK3_APPROVED_CPS_PAYOUT = 3_000_000n;
const SETTLEMENT_DEADLINE_BUFFER_SECONDS = 90;
const RPC_STEP_TIMEOUT_MS = 45_000;

const log = (message: string) => {
  console.log(`[devnet-s2] ${message}`);
};

const withTimeout = async <T>(
  label: string,
  promise: Promise<T>,
  timeoutMs = RPC_STEP_TIMEOUT_MS
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const withRetry = async <T>(
  label: string,
  operation: () => Promise<T>,
  attempts = 5
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      const waitMs = attempt * 2_000;
      log(`${label} failed on attempt ${attempt}/${attempts}; retrying in ${waitMs / 1000}s`);
      await sleep(waitMs);
    }
  }

  throw lastError;
};

const keypairJson = (keypair: Keypair): StoredKeypair => ({
  publicKey: keypair.publicKey.toBase58(),
  secretKey: Array.from(keypair.secretKey),
});

const keypairFromStored = (stored: StoredKeypair): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));

const keypairFromEnv = (envName: string): Keypair | null => {
  const value = process.env[envName]?.trim();
  if (!value) {
    return null;
  }

  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value) as number[]));
};

type DemoAuthoritiesState = {
  admin?: StoredKeypair;
  oracle?: StoredKeypair;
};

const readJson = <T>(filePath: string): T | null => {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const keypairFromFile = (filePath: string): Keypair | null => {
  const stored = readJson<number[]>(filePath);
  if (!stored) {
    return null;
  }

  return Keypair.fromSecretKey(Uint8Array.from(stored));
};

const keypairFromDemoAuthorities = (name: keyof DemoAuthoritiesState): Keypair | null => {
  const authorities = readJson<DemoAuthoritiesState>(DEMO_AUTHORITIES_PATH);
  const stored = authorities?.[name];
  return stored ? keypairFromStored(stored) : null;
};

const writeState = (state: SmokeState) => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(state, null, 2)}\n`);
};

const loadOrCreateState = (rpcEndpoint: string, programId: string): SmokeState => {
  const existing = readJson<SmokeState>(OUTPUT_PATH);
  if (existing && existing.rpcEndpoint === rpcEndpoint && existing.programId === programId) {
    return existing;
  }

  if (existing && existing.rpcEndpoint === rpcEndpoint) {
    const migrated: SmokeState = {
      generatedAt: new Date().toISOString(),
      rpcEndpoint,
      programId,
      admin: existing.admin,
      oracle: existing.oracle,
      creator: existing.creator,
      sponsor: existing.sponsor,
    };
    writeState(migrated);
    return migrated;
  }

  const state: SmokeState = {
    generatedAt: new Date().toISOString(),
    rpcEndpoint,
    programId,
    admin: keypairJson(Keypair.generate()),
    oracle: keypairJson(Keypair.generate()),
    creator: keypairJson(Keypair.generate()),
    sponsor: keypairJson(Keypair.generate()),
  };
  writeState(state);
  return state;
};

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitUntilUnixTime = async (targetUnix: bigint, label: string) => {
  const targetMs = Number(targetUnix) * 1000;
  const waitMs = Math.max(0, targetMs - Date.now() + 3_000);
  if (waitMs > 0) {
    log(`waiting ${Math.ceil(waitMs / 1000)}s for ${label}`);
    await sleep(waitMs);
  }
};

const toSafeNumber = (value: bigint, label: string): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds JavaScript safe integer range`);
  }
  return Number(value);
};

const requestAirdropIfNeeded = async (
  connection: Connection,
  pubkey: PublicKey,
  minLamports: number,
  label: string,
  funder?: Keypair
) => {
  log(`checking SOL balance for ${label}: ${pubkey.toBase58()}`);
  const balance = await withTimeout(
    `getBalance(${label})`,
    connection.getBalance(pubkey, "confirmed")
  );
  if (balance >= minLamports) {
    log(`${label} has ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
    return;
  }

  if (funder && !funder.publicKey.equals(pubkey)) {
    const topUpLamports = minLamports - balance;
    log(`transferring ${topUpLamports / LAMPORTS_PER_SOL} SOL from admin to ${label}`);
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: funder.publicKey,
          toPubkey: pubkey,
          lamports: topUpLamports,
        })
      ),
      [funder],
      { commitment: "confirmed" }
    );
    return;
  }

  try {
    log(`requesting ${(minLamports - balance) / LAMPORTS_PER_SOL} devnet SOL for ${label}`);
    const signature = await withTimeout(
      `requestAirdrop(${label})`,
      connection.requestAirdrop(pubkey, minLamports - balance)
    );
    await withTimeout(
      `confirmAirdrop(${label})`,
      connection.confirmTransaction(signature, "confirmed")
    );
  } catch (error) {
    console.error(`[devnet-s2] airdrop failed for ${label}: ${pubkey.toBase58()}`);
    console.error(`[devnet-s2] request faucet SOL for this address, then rerun the script.`);
    throw error;
  }
};

const ensureProgramDeployed = async (connection: Connection, programId: PublicKey) => {
  log(`checking program deployment: ${programId.toBase58()}`);
  const account = await withTimeout(
    "getAccountInfo(program)",
    connection.getAccountInfo(programId, "confirmed")
  );
  if (!account?.executable) {
    throw new Error(
      `Program ${programId.toBase58()} is not deployed/executable on ${connection.rpcEndpoint}. Deploy first or set STREAMPUMP_PROGRAM_ID.`
    );
  }
};

const loadBackendModules = async () => {
  log("import backend AnchorService");
  const anchorService = await import("../backend/src/services/AnchorService");
  log("import backend prisma");
  const prismaModule = await import("../backend/src/services/prisma");
  log("import backend auth");
  const authService = await import("../backend/src/services/auth");
  log("import backend proposalLaunchService");
  const launchService = await import("../backend/src/services/proposalLaunchService");
  log("import backend proposalIntentShared");
  const proposalShared = await import("../backend/src/controllers/proposalIntentShared");
  log("import backend chainProjectionService");
  const chainProjectionService = await import("../backend/src/services/chainProjectionService");

  return {
    getAnchorService: anchorService.getAnchorService as typeof anchorService.getAnchorService,
    prisma: prismaModule.prisma as typeof prismaModule.prisma,
    createWalletAuthChallenge:
      authService.createWalletAuthChallenge as typeof authService.createWalletAuthChallenge,
    verifyWalletAuthChallenge:
      authService.verifyWalletAuthChallenge as typeof authService.verifyWalletAuthChallenge,
    buildBundleRecord: launchService.buildBundleRecord as typeof launchService.buildBundleRecord,
    buildLaunchBundleTransaction:
      launchService.buildLaunchBundleTransaction as typeof launchService.buildLaunchBundleTransaction,
    finalizeConfirmedLaunchBundle:
      proposalShared.finalizeConfirmedLaunchBundle as typeof proposalShared.finalizeConfirmedLaunchBundle,
    syncProposalProjectionFromChain:
      chainProjectionService.syncProposalProjectionFromChain as typeof chainProjectionService.syncProposalProjectionFromChain,
  };
};

const signInWallet = async (
  wallet: Keypair,
  auth: {
    createWalletAuthChallenge: (wallet: string) => Promise<{ nonce: string; message: string }>;
    verifyWalletAuthChallenge: (params: {
      wallet: string;
      nonce: string;
      signature: string;
    }) => Promise<{ accessToken: string }>;
  }
) => {
  const challenge = await withRetry(`create auth challenge ${wallet.publicKey.toBase58()}`, () =>
    auth.createWalletAuthChallenge(wallet.publicKey.toBase58())
  );
  const signature = ed25519.sign(
    Buffer.from(challenge.message, "utf8"),
    wallet.secretKey.slice(0, 32)
  );
  return withRetry(`verify auth challenge ${wallet.publicKey.toBase58()}`, () =>
    auth.verifyWalletAuthChallenge({
      wallet: wallet.publicKey.toBase58(),
      nonce: challenge.nonce,
      signature: bs58.encode(signature),
    })
  );
};

const ensureSpumpMint = async (params: {
  connection: Connection;
  payer: Keypair;
  protocolConfig: PublicKey;
  state: SmokeState;
}): Promise<Keypair> => {
  const existing = params.state.spumpMint ? keypairFromStored(params.state.spumpMint) : null;
  if (existing) {
    const account = await withTimeout(
      "getAccountInfo(spumpMint)",
      params.connection.getAccountInfo(existing.publicKey, "confirmed")
    );
    if (account) {
      return existing;
    }
  }

  log("creating SPUMP Token-2022 mint");
  const spumpMint = Keypair.generate();
  const mintSpace = getMintLen([ExtensionType.NonTransferable]);
  const lamports = await params.connection.getMinimumBalanceForRentExemption(mintSpace);

  await sendAndConfirmTransaction(
    params.connection,
    new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: params.payer.publicKey,
        newAccountPubkey: spumpMint.publicKey,
        lamports,
        space: mintSpace,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeNonTransferableMintInstruction(
        spumpMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        spumpMint.publicKey,
        6,
        params.payer.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    ),
    [params.payer, spumpMint],
    { commitment: "confirmed" }
  );

  await setAuthority(
    params.connection,
    params.payer,
    spumpMint.publicKey,
    params.payer.publicKey,
    AuthorityType.MintTokens,
    params.protocolConfig,
    [],
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID
  );

  params.state.spumpMint = keypairJson(spumpMint);
  writeState(params.state);
  return spumpMint;
};

const ensureTestUsdcMint = async (params: {
  connection: Connection;
  payer: Keypair;
  state: SmokeState;
}): Promise<PublicKey> => {
  if (params.state.usdcMint) {
    const mint = new PublicKey(params.state.usdcMint);
    const account = await withTimeout(
      "getAccountInfo(testUsdcMint)",
      params.connection.getAccountInfo(mint, "confirmed")
    );
    if (account) {
      return mint;
    }
  }

  log("creating devnet test SPL mint to act as USDC");
  const mint = await createMint(
    params.connection,
    params.payer,
    params.payer.publicKey,
    null,
    6,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  params.state.usdcMint = mint.toBase58();
  writeState(params.state);
  return mint;
};

const ensureTokenAta = async (params: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  owner: PublicKey;
}): Promise<PublicKey> => {
  const ata = getAssociatedTokenAddressSync(params.mint, params.owner);
  log(`ensuring token account ${ata.toBase58()} for ${params.owner.toBase58()}`);
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer.publicKey,
      ata,
      params.owner,
      params.mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(params.connection, transaction, [params.payer], {
    commitment: "confirmed",
  });

  return ata;
};

const main = async () => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || DEFAULT_RPC;
  const programId = process.env.STREAMPUMP_PROGRAM_ID || "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp";
  log(`starting devnet S2 happy path against ${rpcEndpoint}`);
  const connection = new Connection(rpcEndpoint, "confirmed");
  const state = loadOrCreateState(rpcEndpoint, programId);
  log(`state file: ${OUTPUT_PATH}`);

  const admin =
    keypairFromEnv("PROTOCOL_ADMIN_SECRET_KEY") ??
    keypairFromFile(ADMIN_KEYPAIR_PATH) ??
    keypairFromStored(state.admin);
  const oracle =
    keypairFromEnv("ORACLE_AUTHORITY_SECRET_KEY") ??
    keypairFromDemoAuthorities("oracle") ??
    keypairFromStored(state.oracle);
  const creator = keypairFromStored(state.creator);
  const sponsor = keypairFromStored(state.sponsor);
  state.admin = keypairJson(admin);
  state.oracle = keypairJson(oracle);
  writeState(state);
  log(`admin=${admin.publicKey.toBase58()}`);
  log(`oracle=${oracle.publicKey.toBase58()}`);
  log(`creator=${creator.publicKey.toBase58()}`);
  log(`sponsor=${sponsor.publicKey.toBase58()}`);

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.PROTOCOL_ADMIN_SECRET_KEY = JSON.stringify(Array.from(admin.secretKey));
  process.env.CONTENT_ANCHOR_SIGNER_SECRET_KEY = JSON.stringify(Array.from(creator.secretKey));
  process.env.INDEXER_ENABLED = "false";
  process.env.ORACLE_SCHEDULER_ENABLED = "false";
  process.env.ORACLE_RUN_ON_BOOT = "false";
  process.env.ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED = "false";

  await ensureProgramDeployed(connection, new PublicKey(programId));

  for (const [label, keypair, sol] of [
    ["admin", admin, 2],
    ["oracle", oracle, 0.5],
    ["creator", creator, 0.5],
    ["sponsor", sponsor, 1.5],
  ] as const) {
    await requestAirdropIfNeeded(
      connection,
      keypair.publicKey,
      sol * LAMPORTS_PER_SOL,
      label,
      admin
    );
  }

  log("loading backend modules");
  const backend = await loadBackendModules();
  await withRetry("database warmup", () => backend.prisma.$queryRawUnsafe("select 1"));
  const anchorService = backend.getAnchorService();
  const protocolConfig = anchorService.deriveProtocolConfigPda();
  state.protocolConfig = protocolConfig.toBase58();

  const program = anchorService.program as any;
  log(`protocolConfig=${protocolConfig.toBase58()}`);
  const protocolConfigAccount = await withTimeout(
    "getAccountInfo(protocolConfig)",
    connection.getAccountInfo(protocolConfig, "confirmed")
  );
  let protocolUsdcMint = await ensureTestUsdcMint({
    connection,
    payer: admin,
    state,
  });

  if (!protocolConfigAccount) {
    log("initializing protocol_config");
    const spumpMint = await ensureSpumpMint({
      connection,
      payer: admin,
      protocolConfig,
      state,
    });

    await program.methods
      .initializeProtocol({
        oracleAuthority: oracle.publicKey,
        usdcMint: protocolUsdcMint,
        spumpMint: spumpMint.publicKey,
        maxProposalDurationSeconds: new anchor.BN(7 * 24 * 3_600),
        maxExitTaxBps: 1_500,
        minExitTaxBps: 500,
        taxDecayThresholdSupply: new anchor.BN(1_000_000),
        dailySpumpEmissionMultiplierBps: 50_000,
        newUserEmissionBps: 2_500,
        newUserEmissionWindowSeconds: new anchor.BN(7 * 24 * 3_600),
        s1MinUserXp: new anchor.BN(10),
        maxS1DailyBuySpump: new anchor.BN(15_000_000),
        s1EarlyCohortSupplyThreshold: new anchor.BN(500),
        s1EarlyCohortBuyoutCapBps: 2_000,
        minCreatorRatingBps: 5_000,
        maxCreatorRatingBps: 20_000,
        maxCreatorRatingDailyDeltaBps: 1_000,
        s1RatingEffectiveDelaySeconds: new anchor.BN(24 * 3_600),
        defaultS1GraduationTargetSupply: new anchor.BN(2_500),
        s1RageQuitWindowSeconds: new anchor.BN(48 * 3_600),
        s2MinFollowers: new anchor.BN(100),
        s2MinValidViews: new anchor.BN(1_000),
      })
      .accounts({
        admin: admin.publicKey,
        protocolConfig,
        spumpMint: spumpMint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  } else {
    log("protocol_config already exists; reusing it");
    const existingConfig = await anchorService.fetchProtocolConfigAccount();
    protocolUsdcMint = existingConfig.usdcMint as PublicKey;
    if (state.usdcMint && !protocolUsdcMint.equals(new PublicKey(state.usdcMint))) {
      log(
        `state usdc_mint ${state.usdcMint} differs from protocol_config ${protocolUsdcMint.toBase58()}; using protocol_config mint`
      );
    }
    state.usdcMint = protocolUsdcMint.toBase58();

    if (!(existingConfig.admin as PublicKey).equals(admin.publicKey)) {
      throw new Error(
        `Existing protocol_config admin ${(existingConfig.admin as PublicKey).toBase58()} does not match configured admin ${admin.publicKey.toBase58()}. Set PROTOCOL_ADMIN_SECRET_KEY for the existing admin or use a fresh devnet config.`
      );
    }

    if (!(existingConfig.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
      throw new Error(
        `Existing protocol_config oracle ${(existingConfig.oracleAuthority as PublicKey).toBase58()} does not match configured oracle ${oracle.publicKey.toBase58()}. Set ORACLE_AUTHORITY_SECRET_KEY for the existing oracle or run demo:protocol:migrate first.`
      );
    }
  }

  const creatorUsdcAta = await ensureTokenAta({
    connection,
    payer: admin,
    mint: protocolUsdcMint,
    owner: creator.publicKey,
  });
  const sponsorUsdcAta = await ensureTokenAta({
    connection,
    payer: admin,
    mint: protocolUsdcMint,
    owner: sponsor.publicKey,
  });
  await mintTo(
    connection,
    admin,
    protocolUsdcMint,
    sponsorUsdcAta,
    admin.publicKey,
    SPONSOR_TEST_USDC_MINT_AMOUNT,
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  state.creatorUsdcAta = creatorUsdcAta.toBase58();
  state.sponsorUsdcAta = sponsorUsdcAta.toBase58();

  const creatorProfile = anchorService.deriveCreatorProfilePda(creator.publicKey);
  state.creatorProfile = creatorProfile.toBase58();

  log(`creatorProfile=${creatorProfile.toBase58()}`);
  const existingCreatorProfile = await anchorService.fetchCreatorProfileByWallet(creator.publicKey);
  if (!existingCreatorProfile) {
    log("registering creator");
    await program.methods
      .registerCreator({
        handle: `devnet_s2_${creator.publicKey.toBase58().slice(0, 6)}`,
        payoutUsdcAta: creatorUsdcAta,
      })
      .accounts({
        authority: creator.publicKey,
        protocolConfig,
        creatorProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();
  }

  const refreshedCreator = await anchorService.fetchCreatorProfileByWallet(creator.publicKey);
  if (!refreshedCreator || refreshedCreator.level < 2 || refreshedCreator.status !== "S2_ACTIVE") {
    log("upgrading creator to S2");
    const reportId = Array.from(Keypair.generate().publicKey.toBytes());
    const reportDigest = Array.from(Keypair.generate().publicKey.toBytes());
    const upgradeReceipt = PublicKey.findProgramAddressSync(
      [Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), Buffer.from(reportId)],
      anchorService.getProgramId()
    )[0];

    await program.methods
      .upgradeCreator({
        newLevel: 2,
        metricType: { followers: {} },
        metricValue: new anchor.BN(500),
        reportId,
        reportDigest,
        observedAt: new anchor.BN(Math.floor(Date.now() / 1000) - 5),
      })
      .accounts({
        oracle: oracle.publicKey,
        protocolConfig,
        creatorProfile,
        upgradeReceipt,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracle])
      .rpc();
  }

  log("creating wallet sessions");
  const creatorSession = await signInWallet(creator, backend);
  const sponsorSession = await signInWallet(sponsor, backend);

  log("creating backend manifest and intent records");
  const runId = `${Date.now()}-${creator.publicKey.toBase58().slice(0, 6)}`;
  const canonicalManifest = JSON.stringify({
    runId,
    title: "Devnet S2 backend smoke",
    contentType: "MIXED_MEDIA_NOTE",
    creatorWallet: creator.publicKey.toBase58(),
  });
  const manifestHashHex = sha256Hex(canonicalManifest);
  const internalCanonicalUrl = `streampump://devnet-smoke/${runId}`;
  const internalUrlDigestHex = Buffer.from(
    keccak_256(new TextEncoder().encode(internalCanonicalUrl))
  ).toString("hex");

  const manifest = await withRetry("create content manifest", () =>
    backend.prisma.contentManifest.create({
      data: {
        creatorWallet: creator.publicKey.toBase58(),
        contentType: "MIXED_MEDIA_NOTE",
        status: "READY",
        title: "Devnet S2 backend smoke",
        captionText: "Backend-created smoke manifest",
        tagsJson: ["devnet", "s2", "smoke"],
        canonicalManifestJson: JSON.parse(canonicalManifest),
        manifestHashHex,
        internalCanonicalUrl,
        internalUrlDigestHex,
      },
    })
  );

  const deadlineUnix = BigInt(Math.floor(Date.now() / 1000) + SETTLEMENT_DEADLINE_BUFFER_SECONDS);
  const intent = await withRetry("create proposal intent", () =>
    backend.prisma.proposalIntent.create({
      data: {
        creatorWallet: creator.publicKey.toBase58(),
        sponsorWallet: sponsor.publicKey.toBase58(),
        manifestId: manifest.id,
        deadlineUnix,
        track1BaseUsdc: TRACK1_AMOUNT,
        track2MetricType: "VIEWS",
        track2TargetValue: TRACK2_TARGET_VALUE,
        track2MinAchievementBps: TRACK2_MIN_ACHIEVEMENT_BPS,
        track2UsdcDeposited: TRACK2_AMOUNT,
        track3UsdcDeposited: TRACK3_AMOUNT,
        track3DelayDays: 0,
      },
    })
  );

  const derived = {
    proposalPda: anchorService.deriveProposalPda(creator.publicKey, deadlineUnix).toBase58(),
    proposalUsdcVaultPda: anchorService
      .deriveProposalUsdcVaultPda(anchorService.deriveProposalPda(creator.publicKey, deadlineUnix))
      .toBase58(),
  };

  const lockedIntent = await withRetry("lock proposal intent", () =>
    backend.prisma.proposalIntent.update({
      where: { id: intent.id },
      data: {
        status: "TERMS_LOCKED",
        version: { increment: 1 },
        lockedManifestHashHex: manifestHashHex,
        lockedAnchorPda: null,
        plannedProposalPda: derived.proposalPda,
        plannedUsdcVaultPda: derived.proposalUsdcVaultPda,
      },
    })
  );

  await withRetry("lock content manifest", () =>
    backend.prisma.contentManifest.update({
      where: { id: manifest.id },
      data: { status: "LOCKED" },
    })
  );

  log("building launch bundle through backend service");
  const assembled = await backend.buildLaunchBundleTransaction({
    intent: lockedIntent,
    manifest,
  });

  const bundle = await withRetry("create tx bundle", () =>
    backend.prisma.txBundle.create({
      data: backend.buildBundleRecord({
        intent: lockedIntent,
        instructionPlan: assembled.instructionPlan,
        submitMode: "SERVER_RELAY",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        versionedTxBase64: assembled.versionedTxBase64,
        recentBlockhash: assembled.recentBlockhash,
        lastValidBlockHeight: assembled.lastValidBlockHeight,
      }),
    })
  );

  await withRetry("mark bundle built", () =>
    backend.prisma.proposalIntent.update({
      where: { id: lockedIntent.id },
      data: { status: "BUNDLE_BUILT", version: { increment: 1 } },
    })
  );

  log("signing bundle as creator");
  const tx = VersionedTransaction.deserialize(Buffer.from(bundle.messageBase64!, "base64"));
  tx.sign([creator]);
  const partiallySignedBase64 = Buffer.from(tx.serialize()).toString("base64");
  await withRetry("persist creator partial signature", () =>
    backend.prisma.$transaction([
      backend.prisma.txBundle.update({
        where: { id: bundle.id },
        data: {
          partiallySignedBase64,
          status: "PARTIAL",
        },
      }),
      backend.prisma.proposalIntent.update({
        where: { id: lockedIntent.id },
        data: {
          status: "CREATOR_PARTIALLY_SIGNED",
          version: { increment: 1 },
          creatorApprovedAt: new Date(),
        },
      }),
    ])
  );

  log("signing and relaying bundle as sponsor");
  tx.sign([sponsor]);
  const fullySignedBase64 = Buffer.from(tx.serialize()).toString("base64");
  const signature = await anchorService.sendAndConfirmVersionedTransaction({
    serializedTxBase64: fullySignedBase64,
    recentBlockhash: assembled.recentBlockhash,
    lastValidBlockHeight: assembled.lastValidBlockHeight,
  });

  log(`confirmed tx=${signature}`);
  await withRetry("persist submitted tx bundle", () =>
    backend.prisma.txBundle.update({
      where: { id: bundle.id },
      data: {
        fullySignedBase64,
        status: "SUBMITTED",
        chainTxSignature: signature,
      },
    })
  );
  await withRetry("persist submitted proposal intent", () =>
    backend.prisma.proposalIntent.update({
      where: { id: lockedIntent.id },
      data: {
        status: "SUBMITTED",
        version: { increment: 1 },
        sponsorApprovedAt: new Date(),
        chainTxSignature: signature,
        chainSubmittedAt: new Date(),
      },
    })
  );

  log("finalizing backend proposal projection");
  await withRetry("finalize backend proposal projection", () =>
    backend.finalizeConfirmedLaunchBundle({
      intentId: lockedIntent.id,
      bundleId: bundle.id,
      fullySignedTxBase64: fullySignedBase64,
      chainTxSignature: signature,
    })
  );

  log("fetching on-chain proposal state");
  const onChainProposal = await anchorService.fetchProposalState(new PublicKey(derived.proposalPda));
  if (!onChainProposal || onChainProposal.status !== "FUNDED") {
    throw new Error(`Expected funded on-chain proposal, got ${JSON.stringify(onChainProposal)}`);
  }

  log("settling Track1 fixed base pay");
  const track1Signature = await anchorService.executeSettleTrack1Base(
    new PublicKey(derived.proposalPda)
  );
  await withRetry("sync Track1 projection", () =>
    backend.syncProposalProjectionFromChain({
      proposalPda: derived.proposalPda,
      signature: track1Signature,
      instructionName: "settle_track1_base",
    })
  );

  await waitUntilUnixTime(deadlineUnix, "Track2/Track3 settlement eligibility");

  log(`settling Track2 with mocked actual value=${MOCK_TRACK2_ACTUAL_VALUE}`);
  const track2Signature = await anchorService.executeSettleTrack2(
    new PublicKey(derived.proposalPda),
    MOCK_TRACK2_ACTUAL_VALUE
  );
  await withRetry("sync Track2 projection", () =>
    backend.syncProposalProjectionFromChain({
      proposalPda: derived.proposalPda,
      signature: track2Signature,
      instructionName: "settle_track2",
    })
  );

  log(`settling Track3 with mocked approved CPS payout=${MOCK_TRACK3_APPROVED_CPS_PAYOUT}`);
  const track3Signature = await anchorService.executeSettleTrack3Cps(
    new PublicKey(derived.proposalPda),
    toSafeNumber(MOCK_TRACK3_APPROVED_CPS_PAYOUT, "MOCK_TRACK3_APPROVED_CPS_PAYOUT")
  );
  await withRetry("sync Track3 projection", () =>
    backend.syncProposalProjectionFromChain({
      proposalPda: derived.proposalPda,
      signature: track3Signature,
      instructionName: "settle_track3_cps",
    })
  );

  log("fetching settled on-chain proposal state");
  const settledProposal = await anchorService.fetchProposalState(new PublicKey(derived.proposalPda));
  if (
    !settledProposal ||
    !settledProposal.track1Claimed ||
    settledProposal.track2SettledAtUnix <= 0n ||
    settledProposal.track3SettledAtUnix <= 0n ||
    settledProposal.track3CpsPayout !== MOCK_TRACK3_APPROVED_CPS_PAYOUT
  ) {
    throw new Error(`Expected fully settled on-chain proposal, got ${JSON.stringify(settledProposal)}`);
  }

  state.lastRun = {
    completedAt: new Date().toISOString(),
    creatorWallet: creator.publicKey.toBase58(),
    sponsorWallet: sponsor.publicKey.toBase58(),
    creatorAccessTokenPreview: creatorSession.accessToken.slice(0, 24),
    sponsorAccessTokenPreview: sponsorSession.accessToken.slice(0, 24),
    protocolConfig: protocolConfig.toBase58(),
    usdcMintForSmoke: protocolUsdcMint.toBase58(),
    usdcMintKind: "devnet test SPL token",
    manifestId: manifest.id,
    intentId: lockedIntent.id,
    bundleId: bundle.id,
    proposalPda: derived.proposalPda,
    proposalUsdcVaultPda: derived.proposalUsdcVaultPda,
    creatorUsdcAta: creatorUsdcAta.toBase58(),
    sponsorUsdcAta: sponsorUsdcAta.toBase58(),
    launchSignature: signature,
    track1Signature,
    track2Signature,
    track3Signature,
    track1BaseUsdc: TRACK1_AMOUNT.toString(),
    track2Deposited: TRACK2_AMOUNT.toString(),
    track2TargetValue: TRACK2_TARGET_VALUE.toString(),
    track2MinAchievementBps: TRACK2_MIN_ACHIEVEMENT_BPS,
    track2MockActualValue: MOCK_TRACK2_ACTUAL_VALUE,
    track3Deposited: TRACK3_AMOUNT.toString(),
    track3DelayDays: 0,
    track3MockApprovedCpsPayout: MOCK_TRACK3_APPROVED_CPS_PAYOUT.toString(),
    settledStatus: settledProposal.status,
    track1Claimed: settledProposal.track1Claimed,
    track2SettledAtUnix: settledProposal.track2SettledAtUnix.toString(),
    track3SettledAtUnix: settledProposal.track3SettledAtUnix.toString(),
    signature,
  };
  writeState(state);

  console.log("[devnet-s2] success");
  console.log(JSON.stringify(state.lastRun, null, 2));

  await backend.prisma.$disconnect();
};

main().catch((error) => {
  console.error("[devnet-s2] failed");
  console.error(error);
  process.exitCode = 1;
});

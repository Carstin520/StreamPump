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
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import "../backend/config/loadEnv";

type StoredKeypair = {
  publicKey: string;
  secretKey: number[];
};

type SeedFan = StoredKeypair & {
  userProfilePda?: string;
  spumpAta?: string;
  usdcAta?: string;
  s1PositionPda?: string;
  cohort?: "EARLY" | "REGULAR";
  claimed?: boolean;
};

type SeedState = {
  generatedAt: string;
  rpcEndpoint: string;
  programId: string;
  creator: StoredKeypair;
  sponsor: StoredKeypair;
  fans: SeedFan[];
  protocolConfig?: string;
  usdcMint?: string;
  spumpMint?: string;
  creatorProfilePda?: string;
  creatorSpumpAta?: string;
  creatorUsdcAta?: string;
  sponsorUsdcAta?: string;
  buyoutOfferPda?: string;
  offerUsdcVaultPda?: string;
  buyoutStatePda?: string;
  signatures?: Record<string, string | string[]>;
  lastRun?: Record<string, unknown>;
};

const OUTPUT_PATH = path.resolve(process.cwd(), ".local/devnet-s1-buyout-claim-seed.json");
const AUTHORITIES_PATH = path.resolve(process.cwd(), ".local/devnet-demo-authorities.json");
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp";
const FAN_COUNT = 22;
const EARLY_FAN_COUNT = 20;
const BUY_AMOUNT = 25n;
const OFFER_USDC_AMOUNT = 1_000_000_000n;
const USER_ROLE_FAN = 1 << 0;
const TEST_RAGE_QUIT_SECONDS = 2;
const PRODUCTION_RAGE_QUIT_SECONDS = 48 * 3_600;
const USER_REWARD_AMOUNT = 20_000_000n;
const USER_XP_GAIN = 10n;
const REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 1);

const log = (message: string) => {
  console.log(`[devnet-s1] ${message}`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildCreatorAuthMessage = (
  creator: PublicKey,
  handle: string,
  timestampUnix: number,
  nonce: Uint8Array
): Buffer => {
  const domain = Buffer.from("streampump:creator-register:v1", "utf8");
  const handleBytes = Buffer.from(handle, "utf8");
  const handleLength = Buffer.alloc(2);
  const timestamp = Buffer.alloc(8);

  handleLength.writeUInt16LE(handleBytes.length, 0);
  timestamp.writeBigInt64LE(BigInt(timestampUnix), 0);

  return Buffer.concat([
    domain,
    creator.toBuffer(),
    handleLength,
    handleBytes,
    Buffer.from(nonce),
    timestamp,
  ]);
};

const creatorAuthPreInstruction = (
  oracle: Keypair,
  creator: PublicKey,
  handle: string
): TransactionInstruction => {
  const normalizedHandle = handle.toLowerCase();
  const nonce = Keypair.generate().publicKey.toBytes();
  const message = buildCreatorAuthMessage(
    creator,
    normalizedHandle,
    Math.floor(Date.now() / 1000),
    nonce
  );
  const signature = ed25519.sign(message, oracle.secretKey.slice(0, 32));

  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: oracle.publicKey.toBytes(),
    message,
    signature,
  });
};

const withRetry = async <T>(label: string, operation: () => Promise<T>, attempts = 5): Promise<T> => {
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

const readJson = <T>(filePath: string): T | null => {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const writeState = (state: SeedState) => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(state, null, 2)}\n`);
};

const createState = (rpcEndpoint: string, programId: string): SeedState => ({
  generatedAt: new Date().toISOString(),
  rpcEndpoint,
  programId,
  creator: keypairJson(Keypair.generate()),
  sponsor: keypairJson(Keypair.generate()),
  fans: Array.from({ length: FAN_COUNT }, (_, index) => ({
    ...keypairJson(Keypair.generate()),
    cohort: index < EARLY_FAN_COUNT ? "EARLY" : "REGULAR",
    claimed: false,
  })),
  signatures: {},
});

const loadOrCreateState = (rpcEndpoint: string, programId: string): SeedState => {
  const existing = readJson<SeedState>(OUTPUT_PATH);
  const forceNew = process.env.DEMO_S1_SEED_FORCE_NEW?.toLowerCase() === "true";
  if (
    existing &&
    !forceNew &&
    existing.rpcEndpoint === rpcEndpoint &&
    existing.programId === programId &&
    !existing.lastRun?.completedAt
  ) {
    return existing;
  }

  const state = createState(rpcEndpoint, programId);
  writeState(state);
  return state;
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
  if (!value) {
    throw new Error(`${envName} is required for devnet S1 seed`);
  }

  return parseKeypairSecret(value, envName);
};

const loadDemoAuthorityKeypair = (key: "oracle"): Keypair | null => {
  if (!existsSync(AUTHORITIES_PATH)) {
    return null;
  }

  const state = JSON.parse(readFileSync(AUTHORITIES_PATH, "utf8")) as Record<
    string,
    StoredKeypair | unknown
  >;
  const stored = state[key] as StoredKeypair | undefined;
  return stored?.secretKey ? keypairFromStored(stored) : null;
};

const optionalEnvKeypair = (envName: string): Keypair | null => {
  const value = process.env[envName]?.trim();
  return value ? parseKeypairSecret(value, envName) : null;
};

const ensureProgramDeployed = async (connection: Connection, programId: PublicKey) => {
  const account = await connection.getAccountInfo(programId, "confirmed");
  if (!account?.executable) {
    throw new Error(`Program ${programId.toBase58()} is not deployed/executable on devnet`);
  }
};

const requestAirdropIfNeeded = async (
  connection: Connection,
  pubkey: PublicKey,
  minLamports: number,
  label: string,
  funder?: Keypair
) => {
  const balance = await connection.getBalance(pubkey, "confirmed");
  if (balance >= minLamports) {
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

  log(`requesting devnet SOL for ${label}: ${pubkey.toBase58()}`);
  const signature = await connection.requestAirdrop(pubkey, minLamports - balance);
  await connection.confirmTransaction(signature, "confirmed");
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
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer.publicKey,
      ata,
      params.owner,
      params.mint,
      params.tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(params.connection, transaction, [params.payer], {
    commitment: "confirmed",
  });

  return ata;
};

const ensureSponsorUsdcBalance = async (params: {
  connection: Connection;
  admin: Keypair;
  sponsorUsdcAta: PublicKey;
  usdcMint: PublicKey;
}) => {
  const existing = await getAccount(
    params.connection,
    params.sponsorUsdcAta,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  if (existing.amount >= OFFER_USDC_AMOUNT) {
    return;
  }

  const mint = await getMint(params.connection, params.usdcMint, "confirmed", TOKEN_PROGRAM_ID);
  const demoMintAuthority = optionalEnvKeypair("DEMO_USDC_MINT_AUTHORITY_SECRET_KEY");
  const mintAuthority =
    mint.mintAuthority?.equals(params.admin.publicKey) === true
      ? params.admin
      : demoMintAuthority && mint.mintAuthority?.equals(demoMintAuthority.publicKey)
        ? demoMintAuthority
        : null;

  if (!mintAuthority) {
    throw new Error(
      [
        `Sponsor USDC ATA ${params.sponsorUsdcAta.toBase58()} needs ${OFFER_USDC_AMOUNT.toString()} base units.`,
        "The protocol USDC mint authority is not the admin key.",
        "Set DEMO_USDC_MINT_AUTHORITY_SECRET_KEY or manually fund the sponsor ATA, then rerun.",
      ].join(" ")
    );
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
    prisma: prismaModule.prisma as typeof prismaModule.prisma,
  };
};

const waitUntilDeadline = async (deadline: anchor.BN) => {
  const targetMs = deadline.toNumber() * 1000;
  const waitMs = Math.max(0, targetMs - Date.now() + 2_000);
  if (waitMs > 0) {
    log(`waiting ${Math.ceil(waitMs / 1000)}s for rage quit deadline`);
    await sleep(waitMs);
  }
};

const main = async () => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || DEFAULT_RPC;
  const programId = process.env.STREAMPUMP_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  const admin = process.env.PROTOCOL_ADMIN_SECRET_KEY?.trim()
    ? requireEnvKeypair("PROTOCOL_ADMIN_SECRET_KEY")
    : keypairFromStored({
        publicKey: "",
        secretKey: JSON.parse(
          readFileSync(path.resolve(process.cwd(), ".local/devnet-admin-keypair.json"), "utf8")
        ) as number[],
      });
  const oracle =
    (process.env.ORACLE_AUTHORITY_SECRET_KEY?.trim()
      ? requireEnvKeypair("ORACLE_AUTHORITY_SECRET_KEY")
      : loadDemoAuthorityKeypair("oracle")) ??
    (() => {
      throw new Error(
        `ORACLE_AUTHORITY_SECRET_KEY is required; run npm run demo:protocol:migrate first to create ${AUTHORITIES_PATH}`
      );
    })();
  const connection = new Connection(rpcEndpoint, "confirmed");
  const state = loadOrCreateState(rpcEndpoint, programId);
  const creator = keypairFromStored(state.creator);
  const sponsor = keypairFromStored(state.sponsor);
  const fans = state.fans.map(keypairFromStored);

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.PROTOCOL_ADMIN_SECRET_KEY = JSON.stringify(Array.from(admin.secretKey));
  process.env.INDEXER_ENABLED = "false";

  log(`state file: ${OUTPUT_PATH}`);
  log(`program=${programId}`);
  log(`creator=${creator.publicKey.toBase58()}`);
  log(`sponsor=${sponsor.publicKey.toBase58()}`);

  await ensureProgramDeployed(connection, new PublicKey(programId));

  for (const [label, keypair, sol] of [
    ["admin", admin, 2],
    ["oracle", oracle, 0.5],
    ["creator", creator, 0.8],
    ["sponsor", sponsor, 0.8],
    ...fans.map((fan, index) => [`fan${index}`, fan, 0.1] as const),
  ] as const) {
    await requestAirdropIfNeeded(
      connection,
      keypair.publicKey,
      sol * LAMPORTS_PER_SOL,
      label,
      admin
    );
  }

  const backend = await loadBackendModules();
  await withRetry("database warmup", () => backend.prisma.$queryRawUnsafe("select 1"));
  const anchorService = backend.getAnchorService();
  const program = anchorService.program as any;
  const protocolConfigPda = anchorService.deriveProtocolConfigPda();
  const protocolConfig = await anchorService.fetchProtocolConfigAccount();

  if (!(protocolConfig.admin as PublicKey).equals(admin.publicKey)) {
    throw new Error(
      `PROTOCOL_ADMIN_SECRET_KEY does not match protocol admin ${(protocolConfig.admin as PublicKey).toBase58()}`
    );
  }
  if (!(protocolConfig.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
    throw new Error(
      `ORACLE_AUTHORITY_SECRET_KEY does not match protocol oracle ${(protocolConfig.oracleAuthority as PublicKey).toBase58()}`
    );
  }

  const usdcMint = protocolConfig.usdcMint as PublicKey;
  const spumpMint = protocolConfig.spumpMint as PublicKey;
  state.protocolConfig = protocolConfigPda.toBase58();
  state.usdcMint = usdcMint.toBase58();
  state.spumpMint = spumpMint.toBase58();

  const syncTx = async (label: string, signature: string) => {
    log(`sync ${label}: ${signature}`);
    await backend.ingestConfirmedProgramTransaction(signature, { updateCursor: false });
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
        s1EarlyCohortSupplyThreshold: new anchor.BN(
          current.s1EarlyCohortSupplyThreshold.toString()
        ),
        s1EarlyCohortBuyoutCapBps: current.s1EarlyCohortBuyoutCapBps,
        s1RageQuitWindowSeconds: new anchor.BN(seconds),
      })
      .accounts({
        admin: admin.publicKey,
        protocolConfig: protocolConfigPda,
      })
      .signers([admin])
      .rpc();
    await syncTx(`rage window ${seconds}s`, signature);
    return signature;
  };

  let windowShortened = false;
  try {
    await setS1RageQuitWindow(TEST_RAGE_QUIT_SECONDS);
    windowShortened = true;

    const creatorProfile = anchorService.deriveCreatorProfilePda(creator.publicKey);
    const creatorUsdcAta = await ensureAta({
      connection,
      payer: oracle,
      mint: usdcMint,
      owner: creator.publicKey,
      tokenProgramId: TOKEN_PROGRAM_ID,
    });
    const creatorSpumpAta = await ensureAta({
      connection,
      payer: oracle,
      mint: spumpMint,
      owner: creator.publicKey,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    });
    const sponsorUsdcAta = await ensureAta({
      connection,
      payer: oracle,
      mint: usdcMint,
      owner: sponsor.publicKey,
      tokenProgramId: TOKEN_PROGRAM_ID,
    });

    state.creatorProfilePda = creatorProfile.toBase58();
    state.creatorUsdcAta = creatorUsdcAta.toBase58();
    state.creatorSpumpAta = creatorSpumpAta.toBase58();
    state.sponsorUsdcAta = sponsorUsdcAta.toBase58();
    await ensureSponsorUsdcBalance({ connection, admin, sponsorUsdcAta, usdcMint });

    const existingCreator = await anchorService.fetchCreatorProfileByWallet(creator.publicKey);
    if (!existingCreator) {
      const creatorHandle = `s1_demo_${creator.publicKey.toBase58().slice(0, 6)}`;
      const signature = await program.methods
        .registerCreator({
          handle: creatorHandle,
          payoutUsdcAta: creatorUsdcAta,
        })
        .accounts({
          authority: creator.publicKey,
          protocolConfig: protocolConfigPda,
          creatorProfile,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          creatorAuthPreInstruction(oracle, creator.publicKey, creatorHandle),
        ])
        .signers([creator])
        .rpc();
      await syncTx("register creator", signature);
      state.signatures = { ...state.signatures, registerCreator: signature };
    } else if (existingCreator.status !== "S1_ACTIVE") {
      throw new Error(
        `Seed creator is ${existingCreator.status}; set DEMO_S1_SEED_FORCE_NEW=true for a fresh demo state`
      );
    }

    const buySignatures: string[] = [];
    for (let index = 0; index < fans.length; index += 1) {
      const fan = fans[index];
      const fanState = state.fans[index];
      const userProfile = anchorService.deriveUserProfilePda(fan.publicKey);
      const s1Position = anchorService.deriveS1PositionPda(fan.publicKey, creatorProfile);
      const userSpumpAta = await ensureAta({
        connection,
        payer: oracle,
        mint: spumpMint,
        owner: fan.publicKey,
        tokenProgramId: TOKEN_2022_PROGRAM_ID,
      });
      const userUsdcAta = await ensureAta({
        connection,
        payer: oracle,
        mint: usdcMint,
        owner: fan.publicKey,
        tokenProgramId: TOKEN_PROGRAM_ID,
      });
      fanState.userProfilePda = userProfile.toBase58();
      fanState.s1PositionPda = s1Position.toBase58();
      fanState.spumpAta = userSpumpAta.toBase58();
      fanState.usdcAta = userUsdcAta.toBase58();

      const registerUserSignature = await program.methods
        .registerUser({ roleFlags: USER_ROLE_FAN })
        .accounts({
          authority: fan.publicKey,
          protocolConfig: protocolConfigPda,
          userProfile,
          systemProgram: SystemProgram.programId,
        })
        .signers([fan])
        .rpc();
      await syncTx(`register fan ${index}`, registerUserSignature);

      const reportId = Array.from(Keypair.generate().publicKey.toBytes());
      const rewardReceipt = PublicKey.findProgramAddressSync(
        [Buffer.from("user_reward_receipt"), userProfile.toBuffer(), Buffer.from(reportId)],
        anchorService.getProgramId()
      )[0];
      const rewardSignature = await program.methods
        .claimEngagementReward({
          missionType: { completeProfile: {} },
          rewardAmount: new anchor.BN(USER_REWARD_AMOUNT.toString()),
          xpGain: new anchor.BN(USER_XP_GAIN.toString()),
          newLevel: null,
          reportId,
          reportDigest: REPORT_DIGEST,
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
      await syncTx(`reward fan ${index}`, rewardSignature);

      const existingPosition = await anchorService.fetchS1PositionByPda(s1Position);
      if ((existingPosition?.internalTokenBalance ?? 0n) >= BUY_AMOUNT) {
        log(`fan ${index} already has S1 position; skipping buy`);
      } else {
        const buySignature = await program.methods
          .buyS1Token({ amount: new anchor.BN(BUY_AMOUNT.toString()) })
          .accounts({
            user: fan.publicKey,
            protocolConfig: protocolConfigPda,
            userProfile,
            creatorProfile,
            s1UserPosition: s1Position,
            userSpumpAta,
            spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([fan])
          .rpc();
        await syncTx(`buy fan ${index}`, buySignature);
        buySignatures.push(buySignature);
      }
      writeState(state);
    }

    const initSignature = await program.methods
      .initS1Buyout()
      .accounts({
        creator: creator.publicKey,
        creatorProfile,
      })
      .signers([creator])
      .rpc();
    await syncTx("init buyout", initSignature);

    const buyoutOffer = anchorService.deriveBuyoutOfferPda(sponsor.publicKey, creatorProfile);
    const offerUsdcVault = anchorService.deriveOfferUsdcVaultPda(buyoutOffer);
    const buyoutState = anchorService.deriveS1BuyoutStatePda(creatorProfile);
    state.buyoutOfferPda = buyoutOffer.toBase58();
    state.offerUsdcVaultPda = offerUsdcVault.toBase58();
    state.buyoutStatePda = buyoutState.toBase58();

    const offerSignature = await program.methods
      .submitBuyoutOffer({ usdcAmount: new anchor.BN(OFFER_USDC_AMOUNT.toString()) })
      .accounts({
        sponsor: sponsor.publicKey,
        protocolConfig: protocolConfigPda,
        creatorProfile,
        buyoutOffer,
        sponsorUsdcAta,
        offerUsdcVault,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([sponsor])
      .rpc();
    await syncTx("submit offer", offerSignature);

    const acceptSignature = await program.methods
      .acceptBuyoutOffer()
      .accounts({
        creator: creator.publicKey,
        protocolConfig: protocolConfigPda,
        creatorProfile,
        buyoutOffer,
        offerUsdcVault,
        s1BuyoutState: buyoutState,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();
    await syncTx("accept offer", acceptSignature);

    const acceptedBuyout = await program.account.s1BuyoutState.fetch(buyoutState);
    await waitUntilDeadline(acceptedBuyout.rageQuitDeadline);

    const graduationSignature = await program.methods
      .executeS1Graduation()
      .accounts({
        executor: fans[0].publicKey,
        protocolConfig: protocolConfigPda,
        creatorProfile,
        s1BuyoutState: buyoutState,
        creatorRevenueSpumpAta: creatorSpumpAta,
        spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([fans[0]])
      .rpc();
    await syncTx("execute graduation", graduationSignature);

    const claimIndexes = [0, EARLY_FAN_COUNT];
    const claimSignatures: string[] = [];
    for (const index of claimIndexes) {
      const fan = fans[index];
      const fanState = state.fans[index];
      const claimSignature = await program.methods
        .claimS1BuyoutUsdc()
        .accounts({
          user: fan.publicKey,
          protocolConfig: protocolConfigPda,
          creatorProfile,
          s1BuyoutState: buyoutState,
          s1UserPosition: new PublicKey(fanState.s1PositionPda!),
          buyoutOffer,
          offerUsdcVault,
          userUsdcAta: new PublicKey(fanState.usdcAta!),
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([fan])
        .rpc();
      fanState.claimed = true;
      claimSignatures.push(claimSignature);
      await syncTx(`claim fan ${index}`, claimSignature);
    }

    state.signatures = {
      ...state.signatures,
      buys: buySignatures,
      initBuyout: initSignature,
      submitOffer: offerSignature,
      acceptOffer: acceptSignature,
      executeGraduation: graduationSignature,
      claims: claimSignatures,
    };

    const creatorMarket = await backend.getCreatorMarketProjection(creator.publicKey.toBase58());
    const earlyClaimable = state.fans[1];
    const regularClaimable = state.fans[EARLY_FAN_COUNT + 1];
    const earlyPortfolio = await backend.getPortfolioProjection(earlyClaimable.publicKey);
    const regularPortfolio = await backend.getPortfolioProjection(regularClaimable.publicKey);

    if (!creatorMarket?.creator || !creatorMarket.buyout || creatorMarket.offers.length === 0) {
      throw new Error("Market projection did not include creator, buyout, and offer data");
    }
    if (creatorMarket.buyout.status !== "GRADUATED") {
      throw new Error(`Expected buyout status GRADUATED, got ${creatorMarket.buyout.status}`);
    }
    if (earlyPortfolio.positions.length === 0 || regularPortfolio.positions.length === 0) {
      throw new Error("Expected unclaimed early and regular holder positions in portfolio projection");
    }

    state.lastRun = {
      completedAt: new Date().toISOString(),
      creatorWallet: creator.publicKey.toBase58(),
      sponsorWallet: sponsor.publicKey.toBase58(),
      creatorProfilePda: creatorProfile.toBase58(),
      buyoutOfferPda: buyoutOffer.toBase58(),
      offerUsdcVaultPda: offerUsdcVault.toBase58(),
      buyoutStatePda: buyoutState.toBase58(),
      claimedEarlyFanWallet: state.fans[0].publicKey,
      claimedRegularFanWallet: state.fans[EARLY_FAN_COUNT].publicKey,
      claimableEarlyFanWallet: earlyClaimable.publicKey,
      claimableRegularFanWallet: regularClaimable.publicKey,
      buyoutStatus: creatorMarket.buyout.status,
      claimableUsdcRemaining: creatorMarket.buyout.claimableUsdcRemaining,
      claimableS1SupplyRemaining: creatorMarket.buyout.claimableS1SupplyRemaining,
    };
    writeState(state);

    console.log("[devnet-s1] success");
    console.log(JSON.stringify(state.lastRun, null, 2));
  } finally {
    if (windowShortened) {
      try {
        await setS1RageQuitWindow(PRODUCTION_RAGE_QUIT_SECONDS);
        log("restored rage quit window to 48h");
      } catch (error) {
        console.error("[devnet-s1] failed to restore rage quit window");
        console.error(error);
      }
    }
    await backend.prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("[devnet-s1] failed");
  console.error(error);
  process.exitCode = 1;
});

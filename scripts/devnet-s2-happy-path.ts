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
const DEFAULT_RPC = "https://api.devnet.solana.com";
const SPONSOR_TEST_USDC_MINT_AMOUNT = 5_000_000_000n;
const TRACK1_AMOUNT = 10_000_000n;
const TRACK2_AMOUNT = 20_000_000n;
const TRACK3_AMOUNT = 5_000_000n;
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

const requestAirdropIfNeeded = async (
  connection: Connection,
  pubkey: PublicKey,
  minLamports: number,
  label: string
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
  const challenge = await auth.createWalletAuthChallenge(wallet.publicKey.toBase58());
  const signature = ed25519.sign(
    Buffer.from(challenge.message, "utf8"),
    wallet.secretKey.slice(0, 32)
  );
  return auth.verifyWalletAuthChallenge({
    wallet: wallet.publicKey.toBase58(),
    nonce: challenge.nonce,
    signature: bs58.encode(signature),
  });
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

  const admin = keypairFromStored(state.admin);
  const oracle = keypairFromStored(state.oracle);
  const creator = keypairFromStored(state.creator);
  const sponsor = keypairFromStored(state.sponsor);
  log(`admin=${admin.publicKey.toBase58()}`);
  log(`oracle=${oracle.publicKey.toBase58()}`);
  log(`creator=${creator.publicKey.toBase58()}`);
  log(`sponsor=${sponsor.publicKey.toBase58()}`);

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.CONTENT_ANCHOR_SIGNER_SECRET_KEY = JSON.stringify(Array.from(creator.secretKey));
  process.env.INDEXER_ENABLED = "false";
  process.env.ORACLE_SCHEDULER_ENABLED = "false";
  process.env.ORACLE_RUN_ON_BOOT = "false";
  process.env.ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED = "false";

  await ensureProgramDeployed(connection, new PublicKey(programId));

  for (const [label, keypair, sol] of [
    ["admin", admin, 2],
    ["oracle", oracle, 2],
    ["creator", creator, 2],
    ["sponsor", sponsor, 3],
  ] as const) {
    await requestAirdropIfNeeded(connection, keypair.publicKey, sol * LAMPORTS_PER_SOL, label);
  }

  log("loading backend modules");
  const backend = await loadBackendModules();
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
      throw new Error(
        `Existing protocol_config uses ${protocolUsdcMint.toBase58()} as usdc_mint, but this smoke state expects ${state.usdcMint}. Use a fresh devnet program/config or remove .local/devnet-s2-happy-path.json before first initialization.`
      );
    }
    state.usdcMint = protocolUsdcMint.toBase58();

    if (!(existingConfig.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
      throw new Error(
        `Existing protocol_config oracle ${(existingConfig.oracleAuthority as PublicKey).toBase58()} does not match generated oracle ${oracle.publicKey.toBase58()}. Set ORACLE_AUTHORITY_SECRET_KEY for the existing oracle or use a fresh devnet config.`
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

  const manifest = await backend.prisma.contentManifest.create({
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
  });

  const deadlineUnix = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
  const intent = await backend.prisma.proposalIntent.create({
    data: {
      creatorWallet: creator.publicKey.toBase58(),
      sponsorWallet: sponsor.publicKey.toBase58(),
      manifestId: manifest.id,
      deadlineUnix,
      track1BaseUsdc: TRACK1_AMOUNT,
      track2MetricType: "VIEWS",
      track2TargetValue: 1000n,
      track2MinAchievementBps: 5000,
      track2UsdcDeposited: TRACK2_AMOUNT,
      track3UsdcDeposited: TRACK3_AMOUNT,
      track3DelayDays: 45,
    },
  });

  const derived = {
    proposalPda: anchorService.deriveProposalPda(creator.publicKey, deadlineUnix).toBase58(),
    proposalUsdcVaultPda: anchorService
      .deriveProposalUsdcVaultPda(anchorService.deriveProposalPda(creator.publicKey, deadlineUnix))
      .toBase58(),
  };

  const lockedIntent = await backend.prisma.proposalIntent.update({
    where: { id: intent.id },
    data: {
      status: "TERMS_LOCKED",
      version: { increment: 1 },
      lockedManifestHashHex: manifestHashHex,
      lockedAnchorPda: null,
      plannedProposalPda: derived.proposalPda,
      plannedUsdcVaultPda: derived.proposalUsdcVaultPda,
    },
  });

  await backend.prisma.contentManifest.update({
    where: { id: manifest.id },
    data: { status: "LOCKED" },
  });

  log("building launch bundle through backend service");
  const assembled = await backend.buildLaunchBundleTransaction({
    intent: lockedIntent,
    manifest,
  });

  const bundle = await backend.prisma.txBundle.create({
    data: backend.buildBundleRecord({
      intent: lockedIntent,
      instructionPlan: assembled.instructionPlan,
      submitMode: "SERVER_RELAY",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      versionedTxBase64: assembled.versionedTxBase64,
      recentBlockhash: assembled.recentBlockhash,
      lastValidBlockHeight: assembled.lastValidBlockHeight,
    }),
  });

  await backend.prisma.proposalIntent.update({
    where: { id: lockedIntent.id },
    data: { status: "BUNDLE_BUILT", version: { increment: 1 } },
  });

  log("signing bundle as creator");
  const tx = VersionedTransaction.deserialize(Buffer.from(bundle.messageBase64!, "base64"));
  tx.sign([creator]);
  const partiallySignedBase64 = Buffer.from(tx.serialize()).toString("base64");
  await backend.prisma.$transaction([
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
  ]);

  log("signing and relaying bundle as sponsor");
  tx.sign([sponsor]);
  const fullySignedBase64 = Buffer.from(tx.serialize()).toString("base64");
  const signature = await anchorService.sendAndConfirmVersionedTransaction({
    serializedTxBase64: fullySignedBase64,
    recentBlockhash: assembled.recentBlockhash,
    lastValidBlockHeight: assembled.lastValidBlockHeight,
  });

  log(`confirmed tx=${signature}`);
  await backend.prisma.txBundle.update({
    where: { id: bundle.id },
    data: {
      fullySignedBase64,
      status: "SUBMITTED",
      chainTxSignature: signature,
    },
  });
  await backend.prisma.proposalIntent.update({
    where: { id: lockedIntent.id },
    data: {
      status: "SUBMITTED",
      version: { increment: 1 },
      sponsorApprovedAt: new Date(),
      chainTxSignature: signature,
      chainSubmittedAt: new Date(),
    },
  });

  log("finalizing backend proposal projection");
  await backend.finalizeConfirmedLaunchBundle({
    intentId: lockedIntent.id,
    bundleId: bundle.id,
    fullySignedTxBase64: fullySignedBase64,
    chainTxSignature: signature,
  });

  log("fetching on-chain proposal state");
  const onChainProposal = await anchorService.fetchProposalState(new PublicKey(derived.proposalPda));
  if (!onChainProposal || onChainProposal.status !== "FUNDED") {
    throw new Error(`Expected funded on-chain proposal, got ${JSON.stringify(onChainProposal)}`);
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

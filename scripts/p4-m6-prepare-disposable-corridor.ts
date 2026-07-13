import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import * as anchor from "@coral-xyz/anchor";
import {
  Account,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

import {
  assertSeparatedRoles,
  assertTokenAccountIdentity,
  buildPilotTestReport,
  extractKeypairBytes,
  M6_CONSTANTS,
  parseDedicatedRpcEnv,
  parseM6Args,
  toJsonSafe,
} from "./p4-m6-disposable-corridor-lib";

const FINALIZATION_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;
const MAX_RPC_RETRIES = 3;
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

type Evidence = {
  schemaVersion: 1;
  phase: string;
  generatedAt: string;
  completedAt?: string;
  boundaries: Record<string, unknown>;
  constants: typeof M6_CONSTANTS;
  actors: Record<string, string>;
  approvedAmounts: Record<string, string>;
  preflight: Record<string, unknown>;
  plannedMutations: Array<Record<string, string>>;
  pilotTestUpgradeReport: Record<string, unknown>;
  transactions: Array<{
    step: string;
    signature: string;
    state: "prepared" | "finalized";
    simulation: "passed";
    confirmationStatus?: "finalized";
  }>;
  postflight?: Record<string, unknown>;
  stopConditions: string[];
  irreversibleWarning: string[];
};

const fail = (message: string): never => {
  throw new Error(message);
};

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const safeRpc = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RPC_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RPC_RETRIES) await sleep(attempt * 500);
    }
  }
  throw new Error(`${label} failed after ${MAX_RPC_RETRIES} attempts`, { cause: lastError });
};

const readPrivateRegularFile = (filePath: string, label: string): string => {
  const absolute = path.resolve(filePath);
  let descriptor: number;
  try {
    descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    return fail(`${label} must be an existing regular non-symlink file`);
  }
  try {
    const info = fstatSync(descriptor);
    if (!info.isFile()) fail(`${label} must be a regular non-symlink file`);
    if ((info.mode & 0o777) !== 0o600) fail(`${label} must have exact mode 0600`);
    if (info.size > 128 * 1024) fail(`${label} exceeds the 128 KiB safety limit`);
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
};

const assertPrivateEvidenceDestination = (filePath: string): string => {
  const absolute = path.resolve(filePath);
  if (existsSync(absolute)) fail("evidence path already exists; refuse blind overwrite or replay");
  const parent = path.dirname(absolute);
  const parentInfo = lstatSync(parent);
  if (parentInfo.isSymbolicLink() || !parentInfo.isDirectory()) {
    fail("evidence parent must be a regular directory, not a symlink");
  }
  if ((parentInfo.mode & 0o077) !== 0) fail("evidence parent must not be accessible by group or other");
  return absolute;
};

const loadKeypair = (
  filePath: string,
  label: string,
  format: "oracle" | "direct" = "direct"
): Keypair => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readPrivateRegularFile(filePath, label));
  } catch {
    return fail(`${label} is not valid JSON`);
  }
  try {
    return Keypair.fromSecretKey(extractKeypairBytes(parsed, format));
  } catch {
    return fail(`${label} does not contain a valid Ed25519 keypair`);
  }
};

const writeEvidence = (evidencePath: string, evidence: Evidence) => {
  const body = `${JSON.stringify(toJsonSafe(evidence), null, 2)}\n`;
  const parentPath = path.dirname(evidencePath);
  let parentDescriptor: number;
  try {
    parentDescriptor = openSync(parentPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    return fail("evidence parent could not be opened without following symlinks");
  }
  const writeNewFileDurably = (targetPath: string) => {
    const descriptor = openSync(
      targetPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    try {
      writeFileSync(descriptor, body, { encoding: "utf8" });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  };
  try {
    const parentInfo = fstatSync(parentDescriptor);
    if (!parentInfo.isDirectory() || (parentInfo.mode & 0o077) !== 0) {
      fail("evidence parent must remain a private directory");
    }
    if (!existsSync(evidencePath)) {
      // The exclusive first write is also the no-blind-replay marker. If the
      // process stops after a possibly-landed transaction, a later run refuses
      // to overwrite this file and requires operator reconciliation.
      writeNewFileDurably(evidencePath);
    } else {
      const temporaryPath = `${evidencePath}.tmp-${process.pid}`;
      writeNewFileDurably(temporaryPath);
      renameSync(temporaryPath, evidencePath);
    }
    // Make the initial directory entry or atomic rename durable before a
    // transaction may be broadcast.
    fsyncSync(parentDescriptor);
  } finally {
    closeSync(parentDescriptor);
  }
  if ((statSync(evidencePath).mode & 0o777) !== 0o600) {
    fail("evidence file mode is not 0600 after write");
  }
};

const valueOf = <T>(record: Record<string, unknown>, snake: string, camel: string): T => {
  const value = record[snake] ?? record[camel];
  if (value === undefined) fail(`decoded ProtocolConfig missing ${snake}`);
  return value as T;
};

const accountOrNull = async (
  connection: Connection,
  address: PublicKey,
  expectedOwner: PublicKey,
  expectedMint: PublicKey,
  label: string
): Promise<Account | null> => {
  const info = await safeRpc(`token account ${address.toBase58()}`, () =>
    connection.getAccountInfo(address, "confirmed")
  );
  if (!info) return null;
  const account = await safeRpc(`decode token account ${address.toBase58()}`, () =>
    getAccount(connection, address, "confirmed", TOKEN_PROGRAM_ID)
  );
  assertTokenAccountIdentity({
    label,
    owner: account.owner.toBase58(),
    mint: account.mint.toBase58(),
    expectedOwner: expectedOwner.toBase58(),
    expectedMint: expectedMint.toBase58(),
  });
  return account;
};

const buildCreatorAuthInstruction = (
  oracle: Keypair,
  creator: PublicKey,
  handle: string
): TransactionInstruction => {
  const domain = Buffer.from("streampump:creator-register:v1", "utf8");
  const handleBytes = Buffer.from(handle, "utf8");
  const handleLength = Buffer.alloc(2);
  handleLength.writeUInt16LE(handleBytes.length, 0);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1_000)), 0);
  const message = Buffer.concat([
    domain,
    creator.toBuffer(),
    handleLength,
    handleBytes,
    randomBytes(32),
    timestamp,
  ]);
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: oracle.publicKey.toBytes(),
    message,
    signature: ed25519.sign(message, oracle.secretKey.slice(0, 32)),
  });
};

const awaitFinalized = async (connection: Connection, signature: string): Promise<void> => {
  const deadline = Date.now() + FINALIZATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await safeRpc(`signature status ${signature}`, () =>
      connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
    );
    const status = response.value[0];
    if (status?.err) fail(`transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "finalized") {
      const transaction = await safeRpc(`finalized transaction ${signature}`, () =>
        connection.getTransaction(signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        })
      );
      if (!transaction || transaction.meta?.err) fail(`transaction ${signature} is not finalized cleanly`);
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  fail(`transaction ${signature} did not finalize before the safety timeout`);
};

const sendVerified = async (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  step: string,
  evidencePath: string,
  evidence: Evidence
): Promise<string> => {
  const latestBlockhash = await safeRpc(`${step} latest blockhash`, () =>
    connection.getLatestBlockhash("confirmed")
  );
  transaction.feePayer = transaction.feePayer ?? signers[0]?.publicKey;
  if (!transaction.feePayer) fail(`${step} is missing an explicit fee payer`);
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(...signers);
  const localSignatureBytes = transaction.signature;
  if (!localSignatureBytes) fail(`${step} did not produce a local transaction signature`);
  const localSignature = anchor.utils.bytes.bs58.encode(localSignatureBytes);

  const simulation = await safeRpc(`${step} simulation`, () =>
    connection.simulateTransaction(transaction)
  );
  if (simulation.value.err) {
    fail(`${step} simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  evidence.transactions.push({
    step,
    signature: localSignature,
    state: "prepared",
    simulation: "passed",
  });
  writeEvidence(evidencePath, evidence);

  // Send exactly once. If the RPC response is ambiguous, the durable local
  // signature above is the reconciliation key; a later operator must query it
  // instead of blindly resending the mutation.
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: "confirmed",
    skipPreflight: false,
    maxRetries: 0,
  });
  if (signature !== localSignature) {
    fail(`${step} RPC signature does not match the pre-recorded local signature`);
  }
  await awaitFinalized(connection, signature);
  const transactionEvidence = evidence.transactions.at(-1);
  if (!transactionEvidence || transactionEvidence.signature !== signature) {
    fail(`${step} durable transaction evidence is missing`);
  }
  transactionEvidence.state = "finalized";
  transactionEvidence.confirmationStatus = "finalized";
  writeEvidence(evidencePath, evidence);
  return signature;
};

const enumName = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>)[0] ?? "";
  return "";
};

const main = async () => {
  const config = parseM6Args(process.argv.slice(2));
  const rpcUrl = parseDedicatedRpcEnv(
    readPrivateRegularFile(config.rpcEnvPath, "RPC env file")
  );
  const evidencePath = assertPrivateEvidenceDestination(config.evidencePath);

  const feePayer = loadKeypair(config.feePayerPath, "fee payer keypair");
  const admin = loadKeypair(config.adminMintAuthorityPath, "admin/mint-authority keypair");
  const oracle = loadKeypair(config.oracleAuthorityPath, "oracle authority bundle/keypair", "oracle");
  const creator = loadKeypair(config.creatorPath, "disposable creator keypair");
  const sponsor = loadKeypair(config.sponsorPath, "disposable sponsor keypair");

  const exactSignerChecks: Array<[string, PublicKey, string]> = [
    ["fee payer", feePayer.publicKey, M6_CONSTANTS.feePayer],
    ["admin/mint authority", admin.publicKey, M6_CONSTANTS.adminMintAuthority],
    ["oracle authority", oracle.publicKey, M6_CONSTANTS.oracleAuthority],
  ];
  for (const [label, actual, expected] of exactSignerChecks) {
    if (actual.toBase58() !== expected) fail(`${label} signer does not match the frozen public key`);
  }
  assertSeparatedRoles({
    feePayer: feePayer.publicKey.toBase58(),
    adminMintAuthority: admin.publicKey.toBase58(),
    oracleAuthority: oracle.publicKey.toBase58(),
    creator: creator.publicKey.toBase58(),
    sponsor: sponsor.publicKey.toBase58(),
  });

  const connection = new Connection(rpcUrl, { commitment: "confirmed", confirmTransactionInitialTimeout: 60_000 });
  const genesis = await safeRpc("genesis hash", () => connection.getGenesisHash());
  if (genesis !== M6_CONSTANTS.devnetGenesis) fail("RPC is not the frozen Solana devnet genesis");

  const programId = new PublicKey(M6_CONSTANTS.programId);
  const programDataAddress = new PublicKey(M6_CONSTANTS.programData);
  const protocolConfigAddress = new PublicKey(M6_CONSTANTS.protocolConfig);
  const mintAddress = new PublicKey(M6_CONSTANTS.testUsdcMint);
  const [programInfo, programDataInfo, protocolInfo, mintInfo] = await Promise.all([
    safeRpc("program account", () => connection.getAccountInfo(programId, "confirmed")),
    safeRpc("ProgramData account", () => connection.getAccountInfo(programDataAddress, "confirmed")),
    safeRpc("ProtocolConfig account", () => connection.getAccountInfo(protocolConfigAddress, "confirmed")),
    safeRpc("test-USDC mint account", () => connection.getAccountInfo(mintAddress, "confirmed")),
  ]);
  if (!programInfo || !programDataInfo || !protocolInfo || !mintInfo) fail("one or more frozen chain accounts are missing");
  if (!programInfo.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)) fail("program owner mismatch");
  if (programInfo.data.length !== 36 || programInfo.data.readUInt32LE(0) !== 2) fail("program layout mismatch");
  if (!new PublicKey(programInfo.data.subarray(4, 36)).equals(programDataAddress)) {
    fail("program points to an unexpected ProgramData account");
  }
  if (!programDataInfo.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)) fail("ProgramData owner mismatch");
  if (programDataInfo.data.readUInt32LE(0) !== 3 || programDataInfo.data[12] !== 1) {
    fail("ProgramData header mismatch");
  }
  if (
    !new PublicKey(programDataInfo.data.subarray(13, 45)).equals(
      new PublicKey(M6_CONSTANTS.adminMintAuthority)
    )
  ) {
    fail("upgrade authority mismatch");
  }
  const deployedBytes = programDataInfo.data.subarray(45);
  if (
    deployedBytes.length !== M6_CONSTANTS.programCapacity ||
    sha256(deployedBytes) !== M6_CONSTANTS.programSha256
  ) {
    fail("deployed program hash/capacity is outside the frozen M6 candidate");
  }
  if (!protocolInfo.owner.equals(programId) || sha256(protocolInfo.data) !== M6_CONSTANTS.protocolConfigSha256) {
    fail("ProtocolConfig owner/hash mismatch");
  }
  if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID) || sha256(mintInfo.data) !== M6_CONSTANTS.testUsdcMintSha256) {
    fail("test-USDC mint owner/preparation hash mismatch");
  }

  const idl = JSON.parse(
    readFileSync(path.join(__dirname, "../backend/idl/streampump_core.json"), "utf8")
  ) as anchor.Idl;
  if (idl.address !== M6_CONSTANTS.programId) fail("packaged IDL program address mismatch");
  const coder = new anchor.BorshAccountsCoder(idl);
  const protocol = coder.decode("ProtocolConfig", protocolInfo.data) as Record<string, unknown>;
  const protocolAdmin = valueOf<PublicKey>(protocol, "admin", "admin");
  const protocolOracle = valueOf<PublicKey>(protocol, "oracle_authority", "oracleAuthority");
  const protocolMint = valueOf<PublicKey>(protocol, "usdc_mint", "usdcMint");
  if (protocolAdmin.toBase58() !== M6_CONSTANTS.adminMintAuthority) fail("ProtocolConfig admin mismatch");
  if (protocolOracle.toBase58() !== M6_CONSTANTS.oracleAuthority) fail("ProtocolConfig oracle mismatch");
  if (protocolMint.toBase58() !== M6_CONSTANTS.testUsdcMint) fail("ProtocolConfig USDC mint mismatch");
  const thresholdValue = valueOf<anchor.BN>(protocol, "s2_min_followers", "s2MinFollowers");
  const metricValue = Math.max(1, Number(thresholdValue.toString()));
  if (!Number.isSafeInteger(metricValue)) fail("S2 follower threshold exceeds the safe integer range");

  const mint = await safeRpc("test-USDC decode", () =>
    getMint(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID)
  );
  if (
    mint.decimals !== 6 ||
    !mint.isInitialized ||
    mint.freezeAuthority !== null ||
    mint.mintAuthority?.toBase58() !== M6_CONSTANTS.adminMintAuthority
  ) {
    fail("test-USDC mint invariants mismatch");
  }

  const feePayerAta = getAssociatedTokenAddressSync(mintAddress, feePayer.publicKey, false, TOKEN_PROGRAM_ID);
  const creatorAta = getAssociatedTokenAddressSync(mintAddress, creator.publicKey, false, TOKEN_PROGRAM_ID);
  const sponsorAta = getAssociatedTokenAddressSync(mintAddress, sponsor.publicKey, false, TOKEN_PROGRAM_ID);
  const [feePayerToken, creatorToken, sponsorToken, feePayerLamports, creatorLamports, sponsorLamports, oracleLamports] =
    await Promise.all([
      accountOrNull(connection, feePayerAta, feePayer.publicKey, mintAddress, "fee-payer test-USDC ATA"),
      accountOrNull(connection, creatorAta, creator.publicKey, mintAddress, "creator test-USDC ATA"),
      accountOrNull(connection, sponsorAta, sponsor.publicKey, mintAddress, "sponsor test-USDC ATA"),
      safeRpc("fee payer balance", () => connection.getBalance(feePayer.publicKey, "confirmed")),
      safeRpc("creator balance", () => connection.getBalance(creator.publicKey, "confirmed")),
      safeRpc("sponsor balance", () => connection.getBalance(sponsor.publicKey, "confirmed")),
      safeRpc("oracle balance", () => connection.getBalance(oracle.publicKey, "confirmed")),
    ]);
  const tokenAmount = (account: Account | null) => account?.amount ?? 0n;
  if (tokenAmount(feePayerToken) !== 0n) fail("fee-payer test-USDC ATA must start empty");
  if (tokenAmount(creatorToken) > config.maxActorStartingTestUsdcRaw) {
    fail("creator test-USDC exceeds the explicitly approved starting ceiling");
  }
  if (tokenAmount(sponsorToken) > config.maxActorStartingTestUsdcRaw) {
    fail("sponsor test-USDC exceeds the explicitly approved starting ceiling");
  }
  if (BigInt(creatorLamports) > config.maxCreatorStartingLamports) {
    fail("creator SOL exceeds the explicitly approved starting ceiling");
  }
  if (BigInt(sponsorLamports) > config.maxSponsorStartingLamports) {
    fail("sponsor SOL exceeds the explicitly approved starting ceiling");
  }
  if (BigInt(creatorLamports) > config.creatorTargetLamports) fail("creator already exceeds approved target SOL");
  if (BigInt(sponsorLamports) > config.sponsorTargetLamports) fail("sponsor already exceeds approved target SOL");

  const creatorProfile = PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), creator.publicKey.toBuffer()],
    programId
  )[0];
  const handle = `p4m6_${config.runId.replace(/[-_]/g, "").slice(0, 20)}`;
  const observedAt = Math.floor(Date.now() / 1_000) - 5;
  const testReport = buildPilotTestReport({
    runId: config.runId,
    creator: creator.publicKey.toBase58(),
    creatorProfile: creatorProfile.toBase58(),
    metricValue,
    observedAt,
  });
  const reportId = Buffer.from(testReport.reportIdHex, "hex");
  const reportDigest = Buffer.from(testReport.digestHex, "hex");
  const upgradeReceipt = PublicKey.findProgramAddressSync(
    [Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), reportId],
    programId
  )[0];
  const [creatorProfileInfo, upgradeReceiptInfo] = await Promise.all([
    safeRpc("creator profile absence", () => connection.getAccountInfo(creatorProfile, "confirmed")),
    safeRpc("upgrade receipt absence", () => connection.getAccountInfo(upgradeReceipt, "confirmed")),
  ]);
  if (creatorProfileInfo) fail("disposable creator already has an on-chain profile");
  if (upgradeReceiptInfo) fail("deterministic PILOT TEST ONLY upgrade receipt already exists");

  const creatorProfileRent = await safeRpc("creator profile rent", () =>
    connection.getMinimumBalanceForRentExemption(coder.size("CreatorProfile"), "confirmed")
  );
  const upgradeReceiptRent = await safeRpc("upgrade receipt rent", () =>
    connection.getMinimumBalanceForRentExemption(coder.size("UpgradeReceipt"), "confirmed")
  );
  const tokenAccountRent = await safeRpc("token account rent", () =>
    connection.getMinimumBalanceForRentExemption(165, "confirmed")
  );
  if (config.creatorTargetLamports < BigInt(creatorProfileRent)) {
    fail("creator target SOL is below CreatorProfile rent; increase the explicitly approved target");
  }
  if (oracleLamports < upgradeReceiptRent) fail("oracle authority lacks rent for the PILOT TEST ONLY receipt");
  const creatorTopUp = config.creatorTargetLamports - BigInt(creatorLamports);
  const sponsorTopUp = config.sponsorTargetLamports - BigInt(sponsorLamports);
  const missingAtaCount = [feePayerToken, creatorToken, sponsorToken].filter((entry) => !entry).length;
  const conservativeFeeReserve = 100_000n;
  const requiredFeePayerLamports =
    creatorTopUp + sponsorTopUp + BigInt(missingAtaCount * tokenAccountRent) + conservativeFeeReserve;
  if (BigInt(feePayerLamports) < requiredFeePayerLamports) fail("fee payer lacks the approved funding plus rent/fee reserve");

  const evidence: Evidence = {
    schemaVersion: 1,
    phase: config.execute ? "execution_started" : "read_only_preflight_passed",
    generatedAt: new Date().toISOString(),
    boundaries: {
      inviteOnly: true,
      externalWalletFirst: true,
      cluster: "solana-devnet",
      asset: "test-USDC",
      testUsdcDecimals: 6,
      allowedLane: "Track1-only",
      manualSettlementOnly: true,
      automaticSettlement: false,
      forbiddenInstructions: ["S1 lifecycle", "endorse_proposal", "settle_track2", "settle_track3_cps"],
      readinessClaim: "controlled technical Pilot preparation; not production and not real funds",
    },
    constants: M6_CONSTANTS,
    actors: {
      feePayer: feePayer.publicKey.toBase58(),
      adminMintAuthority: admin.publicKey.toBase58(),
      oracleAuthority: oracle.publicKey.toBase58(),
      creator: creator.publicKey.toBase58(),
      sponsor: sponsor.publicKey.toBase58(),
      feePayerTestUsdcAta: feePayerAta.toBase58(),
      creatorTestUsdcAta: creatorAta.toBase58(),
      sponsorTestUsdcAta: sponsorAta.toBase58(),
      creatorProfile: creatorProfile.toBase58(),
      upgradeReceipt: upgradeReceipt.toBase58(),
    },
    approvedAmounts: {
      creatorStartingCeilingLamports: config.maxCreatorStartingLamports.toString(),
      sponsorStartingCeilingLamports: config.maxSponsorStartingLamports.toString(),
      actorStartingCeilingTestUsdcRaw: config.maxActorStartingTestUsdcRaw.toString(),
      creatorTargetLamports: config.creatorTargetLamports.toString(),
      sponsorTargetLamports: config.sponsorTargetLamports.toString(),
      creatorTopUpLamports: creatorTopUp.toString(),
      sponsorTopUpLamports: sponsorTopUp.toString(),
      mintToFeePayerTestUsdcRaw: config.mintTestUsdcRaw.toString(),
      transferToSponsorTestUsdcRaw: config.sponsorTestUsdcRaw.toString(),
    },
    preflight: {
      rpcClass: "dedicated-devnet",
      rpcHostname: new URL(rpcUrl).hostname,
      genesis,
      programCapacity: deployedBytes.length,
      programSha256: sha256(deployedBytes),
      protocolConfigSha256: sha256(protocolInfo.data),
      testUsdcMintPreMutationSha256: sha256(mintInfo.data),
      testUsdcSupplyRaw: mint.supply.toString(),
      s2MinFollowers: metricValue,
      balancesBefore: {
        feePayerLamports: feePayerLamports.toString(),
        creatorLamports: creatorLamports.toString(),
        sponsorLamports: sponsorLamports.toString(),
        oracleLamports: oracleLamports.toString(),
        feePayerTestUsdcRaw: tokenAmount(feePayerToken).toString(),
        creatorTestUsdcRaw: tokenAmount(creatorToken).toString(),
        sponsorTestUsdcRaw: tokenAmount(sponsorToken).toString(),
      },
      accountRents: { creatorProfileRent, upgradeReceiptRent, tokenAccountRent },
      signerPublicKeysVerified: true,
      roleSeparationVerified: true,
      creatorProfileAbsent: true,
      upgradeReceiptAbsent: true,
    },
    plannedMutations: [
      ...(creatorTopUp > 0n
        ? [{ step: "fund_disposable_creator_sol", rawAmount: creatorTopUp.toString() }]
        : []),
      ...(sponsorTopUp > 0n
        ? [{ step: "fund_disposable_sponsor_sol", rawAmount: sponsorTopUp.toString() }]
        : []),
      ...([
        ["create_fee_payer_test_usdc_ata", feePayerToken],
        ["create_creator_test_usdc_ata", creatorToken],
        ["create_sponsor_test_usdc_ata", sponsorToken],
      ] as const)
        .filter(([, account]) => !account)
        .map(([step]) => ({ step, rawAmount: "rent-exempt account allocation" })),
      { step: "mint_approved_test_usdc_to_fee_payer_ata", rawAmount: config.mintTestUsdcRaw.toString() },
      { step: "transfer_approved_test_usdc_to_sponsor", rawAmount: config.sponsorTestUsdcRaw.toString() },
      { step: "oracle_authorized_register_disposable_creator", rawAmount: "creator profile rent" },
      { step: "create_pilot_test_only_s2_upgrade_receipt", rawAmount: "upgrade receipt rent" },
    ],
    pilotTestUpgradeReport: {
      report: testReport.report,
      canonicalJson: testReport.canonical,
      reportIdHex: testReport.reportIdHex,
      reportDigestSha256: testReport.digestHex,
      explicitTruth: "synthetic eligibility fixture only; never a real follower or view observation",
    },
    transactions: [],
    stopConditions: [
      "Stop on any genesis, hash, capacity, authority, signer, role-separation, balance, mint, or account mismatch.",
      "Stop on the first failed, unconfirmed, or non-finalized transaction; never blind-resend.",
      "Stop if any S1, Track2, Track3, rewards, managed-wallet, or automatic-settlement lane would be required.",
      "Stop if evidence cannot remain mode 0600 or a prior evidence file already exists.",
    ],
    irreversibleWarning: [
      "Minting increases this devnet test-USDC mint supply and is not automatically reversed.",
      "Creator registration and the level-2 upgrade receipt are durable on-chain accounts; there is no downgrade instruction.",
      "Account allocation/rent and transaction fees are not fully reversible even though disposable-wallet balances can later be reclaimed.",
      "This preparation is test-only and cannot be represented as real metrics, real funds, production readiness, or formal launch.",
    ],
  };

  if (!config.execute) {
    console.log(JSON.stringify(toJsonSafe(evidence), null, 2));
    return;
  }

  writeEvidence(evidencePath, evidence);
  if (creatorTopUp > 0n) {
    await sendVerified(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: feePayer.publicKey,
          toPubkey: creator.publicKey,
          lamports: creatorTopUp,
        })
      ),
      [feePayer],
      "fund_disposable_creator_sol",
      evidencePath,
      evidence
    );
  }
  if (sponsorTopUp > 0n) {
    await sendVerified(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: feePayer.publicKey,
          toPubkey: sponsor.publicKey,
          lamports: sponsorTopUp,
        })
      ),
      [feePayer],
      "fund_disposable_sponsor_sol",
      evidencePath,
      evidence
    );
  }

  const ataPlans: Array<[string, PublicKey, PublicKey, Account | null]> = [
    ["create_fee_payer_test_usdc_ata", feePayerAta, feePayer.publicKey, feePayerToken],
    ["create_creator_test_usdc_ata", creatorAta, creator.publicKey, creatorToken],
    ["create_sponsor_test_usdc_ata", sponsorAta, sponsor.publicKey, sponsorToken],
  ];
  for (const [step, ata, owner, prior] of ataPlans) {
    if (prior) continue;
    await sendVerified(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          ata,
          owner,
          mintAddress,
          TOKEN_PROGRAM_ID
        )
      ),
      [feePayer],
      step,
      evidencePath,
      evidence
    );
  }

  await sendVerified(
    connection,
    new Transaction().add(
      createMintToCheckedInstruction(
        mintAddress,
        feePayerAta,
        admin.publicKey,
        config.mintTestUsdcRaw,
        6,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, admin],
    "mint_approved_test_usdc_to_fee_payer_ata",
    evidencePath,
    evidence
  );
  await sendVerified(
    connection,
    new Transaction().add(
      createTransferCheckedInstruction(
        feePayerAta,
        mintAddress,
        sponsorAta,
        feePayer.publicKey,
        config.sponsorTestUsdcRaw,
        6,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer],
    "transfer_approved_test_usdc_to_sponsor",
    evidencePath,
    evidence
  );

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(feePayer), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, provider) as anchor.Program;
  const registerTransaction = await (program.methods as any)
    .registerCreator({ handle, payoutUsdcAta: creatorAta })
    .accounts({
      authority: creator.publicKey,
      protocolConfig: protocolConfigAddress,
      creatorProfile,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([buildCreatorAuthInstruction(oracle, creator.publicKey, handle)])
    .transaction();
  await sendVerified(
    connection,
    registerTransaction,
    [feePayer, creator],
    "oracle_authorized_register_disposable_creator",
    evidencePath,
    evidence
  );

  const upgradeTransaction = await (program.methods as any)
    .upgradeCreator({
      newLevel: 2,
      metricType: { followers: {} },
      metricValue: new anchor.BN(metricValue),
      reportId: Array.from(reportId),
      reportDigest: Array.from(reportDigest),
      observedAt: new anchor.BN(observedAt),
    })
    .accounts({
      oracle: oracle.publicKey,
      protocolConfig: protocolConfigAddress,
      creatorProfile,
      upgradeReceipt,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
  await sendVerified(
    connection,
    upgradeTransaction,
    [feePayer, oracle],
    "create_pilot_test_only_s2_upgrade_receipt",
    evidencePath,
    evidence
  );

  const [postMint, postFeePayerToken, postCreatorToken, postSponsorToken, postCreatorProfile, postReceipt, postFeePayerSol, postCreatorSol, postSponsorSol, postOracleSol] =
    await Promise.all([
      safeRpc("post test-USDC mint", () => getMint(connection, mintAddress, "finalized", TOKEN_PROGRAM_ID)),
      accountOrNull(connection, feePayerAta, feePayer.publicKey, mintAddress, "post fee-payer test-USDC ATA"),
      accountOrNull(connection, creatorAta, creator.publicKey, mintAddress, "post creator test-USDC ATA"),
      accountOrNull(connection, sponsorAta, sponsor.publicKey, mintAddress, "post sponsor test-USDC ATA"),
      safeRpc("post creator profile", () => connection.getAccountInfo(creatorProfile, "finalized")),
      safeRpc("post upgrade receipt", () => connection.getAccountInfo(upgradeReceipt, "finalized")),
      safeRpc("post fee payer SOL", () => connection.getBalance(feePayer.publicKey, "finalized")),
      safeRpc("post creator SOL", () => connection.getBalance(creator.publicKey, "finalized")),
      safeRpc("post sponsor SOL", () => connection.getBalance(sponsor.publicKey, "finalized")),
      safeRpc("post oracle SOL", () => connection.getBalance(oracle.publicKey, "finalized")),
    ]);
  if (postMint.supply !== mint.supply + config.mintTestUsdcRaw) fail("test-USDC supply delta mismatch");
  if (!postFeePayerToken || postFeePayerToken.amount !== 0n) fail("fee-payer test-USDC ATA did not end at zero");
  if (!postCreatorToken || postCreatorToken.amount !== tokenAmount(creatorToken)) {
    fail("creator test-USDC ATA changed unexpectedly");
  }
  if (!postSponsorToken || postSponsorToken.amount !== tokenAmount(sponsorToken) + config.sponsorTestUsdcRaw) {
    fail("sponsor test-USDC balance delta mismatch");
  }
  if (!postCreatorProfile || !postReceipt) fail("creator profile or PILOT TEST ONLY receipt missing postflight");
  const decodedCreator = coder.decode("CreatorProfile", postCreatorProfile.data) as Record<string, unknown>;
  const decodedReceipt = coder.decode("UpgradeReceipt", postReceipt.data) as Record<string, unknown>;
  const creatorLevel = Number(valueOf<number>(decodedCreator, "level", "level"));
  const creatorStatus = enumName(valueOf(decodedCreator, "status", "status"));
  if (creatorLevel !== 2 || creatorStatus.replace(/_/g, "").toLowerCase() !== "s2active") {
    fail("creator is not exact level-2 S2_ACTIVE after test-only preparation");
  }
  const receiptDigest = Buffer.from(
    valueOf<number[] | Uint8Array>(decodedReceipt, "report_digest", "reportDigest")
  ).toString("hex");
  const receiptReportId = Buffer.from(
    valueOf<number[] | Uint8Array>(decodedReceipt, "report_id", "reportId")
  ).toString("hex");
  if (receiptDigest !== testReport.digestHex || receiptReportId !== testReport.reportIdHex) {
    fail("on-chain PILOT TEST ONLY receipt does not match saved report evidence");
  }

  evidence.phase = "actor_chain_preparation_complete";
  evidence.completedAt = new Date().toISOString();
  evidence.postflight = {
    allTransactionsFinalized: true,
    transactionCount: evidence.transactions.length,
    testUsdcSupplyBeforeRaw: mint.supply.toString(),
    testUsdcSupplyAfterRaw: postMint.supply.toString(),
    feePayerTestUsdcRaw: postFeePayerToken.amount.toString(),
    creatorTestUsdcRaw: postCreatorToken.amount.toString(),
    sponsorTestUsdcRaw: postSponsorToken.amount.toString(),
    feePayerLamports: postFeePayerSol.toString(),
    creatorLamports: postCreatorSol.toString(),
    sponsorLamports: postSponsorSol.toString(),
    oracleLamports: postOracleSol.toString(),
    creatorLevel,
    creatorStatus,
    receiptDigestVerified: true,
    receiptReportIdVerified: true,
    forbiddenLaneInstructionsSent: 0,
  };
  writeEvidence(evidencePath, evidence);
  console.log(
    JSON.stringify(
      toJsonSafe({
        phase: evidence.phase,
        evidencePath,
        evidenceMode: "0600",
        actors: evidence.actors,
        approvedAmounts: evidence.approvedAmounts,
        transactions: evidence.transactions,
        postflight: evidence.postflight,
        truthBoundary: evidence.boundaries.readinessClaim,
      }),
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown M6 preparation failure");
  process.exitCode = 1;
});

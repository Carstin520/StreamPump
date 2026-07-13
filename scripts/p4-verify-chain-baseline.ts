import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PROGRAM_ID = new PublicKey("FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp");
const PROGRAMDATA_ID = new PublicKey("58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs");
const UPGRADE_AUTHORITY = new PublicKey("BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw");
const ORACLE_AUTHORITY = new PublicKey("HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC");
const PROTOCOL_CONFIG = new PublicKey("GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g");
const TEST_USDC_MINT = new PublicKey("5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ");
const FEE_PAYER = new PublicKey("Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9");
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);
const PROTOCOL_CONFIG_SHA256 = "9b31d5bddff4f8b4828ed4baf695d9514ca180de6c126b54cc7b22bf710fcc8d";
const TEST_USDC_MINT_SHA256 = "c422c88798c152d9eaf5c4f7329b9f0c1642093dfd021b69a47a9b49c393ee04";
const APPROVED_PROGRAMS = new Map([
  ["96b114bb1b130695b7a7cccc1ce9a41bf953c4acd6179120acc4a2a87e591457", 1_318_104],
  ["a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732", 1_328_344],
  ["8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247", 1_328_344],
]);

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const safeRpc = async <T>(label: string, operation: Promise<T>): Promise<T> => {
  try {
    return await operation;
  } catch (_error) {
    throw new Error(`${label} failed`);
  }
};

const requireAccount = (label: string, account: AccountInfo<Buffer> | null): AccountInfo<Buffer> => {
  if (!account) throw new Error(`${label} account not found`);
  return account;
};

const assertPublicKey = (label: string, actual: PublicKey, expected: PublicKey) => {
  if (!actual.equals(expected)) throw new Error(`${label} mismatch`);
};

const main = async () => {
  const rpcUrl = required("PILOT_TX_RPC_URL");
  const rpcHost = new URL(rpcUrl).hostname;
  if (rpcHost === "api.devnet.solana.com") throw new Error("public devnet RPC is forbidden");
  const rpcClass = rpcHost.endsWith("helius-rpc.com") ? "helius-devnet" : "dedicated-devnet";

  const expectedProgramHash = required("P4_EXPECTED_PROGRAM_SHA256");
  const expectedCapacity = APPROVED_PROGRAMS.get(expectedProgramHash);
  if (!expectedCapacity) throw new Error("expected program hash is not approved for P4");

  const connection = new Connection(rpcUrl, "confirmed");
  if ((await safeRpc("genesis verification", connection.getGenesisHash())) !== DEVNET_GENESIS) {
    throw new Error("RPC is not Solana devnet");
  }

  const [program, programData, protocolConfig, mintAccount, feePayerLamports] = await Promise.all([
    safeRpc("program read", connection.getAccountInfo(PROGRAM_ID, "confirmed")),
    safeRpc("ProgramData read", connection.getAccountInfo(PROGRAMDATA_ID, "confirmed")),
    safeRpc("ProtocolConfig read", connection.getAccountInfo(PROTOCOL_CONFIG, "confirmed")),
    safeRpc("test-USDC mint read", connection.getAccountInfo(TEST_USDC_MINT, "confirmed")),
    safeRpc("fee payer balance read", connection.getBalance(FEE_PAYER, "confirmed")),
  ]);
  const programInfo = requireAccount("program", program);
  const programDataInfo = requireAccount("ProgramData", programData);
  const protocolInfo = requireAccount("ProtocolConfig", protocolConfig);
  const mintInfo = requireAccount("test-USDC mint", mintAccount);

  assertPublicKey("program owner", programInfo.owner, BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  if (programInfo.data.length !== 36 || programInfo.data.readUInt32LE(0) !== 2) {
    throw new Error("program account layout mismatch");
  }
  assertPublicKey("ProgramData address", new PublicKey(programInfo.data.subarray(4, 36)), PROGRAMDATA_ID);

  assertPublicKey("ProgramData owner", programDataInfo.owner, BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  if (programDataInfo.data.readUInt32LE(0) !== 3 || programDataInfo.data[12] !== 1) {
    throw new Error("ProgramData header mismatch");
  }
  assertPublicKey(
    "upgrade authority",
    new PublicKey(programDataInfo.data.subarray(13, 45)),
    UPGRADE_AUTHORITY
  );
  const deployedBytes = programDataInfo.data.subarray(45);
  if (deployedBytes.length !== expectedCapacity || sha256(deployedBytes) !== expectedProgramHash) {
    throw new Error("deployed program bytes mismatch");
  }

  assertPublicKey("ProtocolConfig owner", protocolInfo.owner, PROGRAM_ID);
  if (protocolInfo.data.length !== 297 || sha256(protocolInfo.data) !== PROTOCOL_CONFIG_SHA256) {
    throw new Error("ProtocolConfig frozen data mismatch");
  }
  const idl = JSON.parse(
    readFileSync(path.join(__dirname, "../backend/idl/streampump_core.json"), "utf8")
  ) as Idl;
  const decoded = new BorshAccountsCoder(idl).decode("ProtocolConfig", protocolInfo.data) as {
    admin: PublicKey;
    oracle_authority: PublicKey;
    usdc_mint: PublicKey;
  };
  assertPublicKey("ProtocolConfig admin", decoded.admin, UPGRADE_AUTHORITY);
  assertPublicKey("ProtocolConfig oracle", decoded.oracle_authority, ORACLE_AUTHORITY);
  assertPublicKey("ProtocolConfig USDC mint", decoded.usdc_mint, TEST_USDC_MINT);

  assertPublicKey("test-USDC owner", mintInfo.owner, TOKEN_PROGRAM_ID);
  if (mintInfo.data.length !== 82 || sha256(mintInfo.data) !== TEST_USDC_MINT_SHA256) {
    throw new Error("test-USDC frozen data mismatch");
  }
  const mint = await safeRpc(
    "test-USDC decode",
    getMint(connection, TEST_USDC_MINT, "confirmed", TOKEN_PROGRAM_ID)
  );
  if (!mint.mintAuthority || !mint.mintAuthority.equals(UPGRADE_AUTHORITY)) {
    throw new Error("test-USDC mint authority mismatch");
  }
  if (mint.freezeAuthority !== null || mint.decimals !== 6 || !mint.isInitialized) {
    throw new Error("test-USDC mint invariants mismatch");
  }

  console.log(JSON.stringify({
    phase: "chain_baseline_verified",
    rpcClass,
    programId: PROGRAM_ID.toBase58(),
    programData: PROGRAMDATA_ID.toBase58(),
    programCapacity: deployedBytes.length,
    programSha256: expectedProgramHash,
    upgradeAuthority: UPGRADE_AUTHORITY.toBase58(),
    protocolConfig: PROTOCOL_CONFIG.toBase58(),
    protocolConfigSha256: PROTOCOL_CONFIG_SHA256,
    oracleAuthority: ORACLE_AUTHORITY.toBase58(),
    testUsdcMint: TEST_USDC_MINT.toBase58(),
    testUsdcMintSha256: TEST_USDC_MINT_SHA256,
    testUsdcSupply: mint.supply.toString(),
    feePayerSol: feePayerLamports / 1_000_000_000,
  }));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});

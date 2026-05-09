import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import "../backend/config/loadEnv";

type StoredKeypair = {
  publicKey: string;
  secretKey: number[];
};

type DemoAuthoritiesState = {
  generatedAt: string;
  rpcEndpoint: string;
  programId: string;
  admin: {
    publicKey: string;
    source: string;
  };
  oracle: StoredKeypair;
  protocolConfig?: string;
  usdcMint?: string;
  spumpMint?: string;
  migrationSignature?: string;
  migratedAt?: string;
};

const FYPH_PROGRAM_ID = "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp";
const ADMIN_KEYPAIR_PATH = path.resolve(process.cwd(), ".local/devnet-admin-keypair.json");
const OUTPUT_PATH = path.resolve(process.cwd(), ".local/devnet-demo-authorities.json");
const IDL_PATH = path.resolve(process.cwd(), "target/idl/streampump_core.json");

const log = (message: string) => {
  console.log(`[devnet-migrate] ${message}`);
};

const keypairJson = (keypair: Keypair): StoredKeypair => ({
  publicKey: keypair.publicKey.toBase58(),
  secretKey: Array.from(keypair.secretKey),
});

const keypairFromSecretFile = (filePath: string): Keypair => {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
};

const keypairFromStored = (stored: StoredKeypair): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));

const readJson = <T>(filePath: string): T | null => {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const writeState = (state: DemoAuthoritiesState) => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(state, null, 2)}\n`);
};

const loadOrCreateState = (
  rpcEndpoint: string,
  programId: string,
  admin: Keypair
): { state: DemoAuthoritiesState; oracle: Keypair } => {
  const existing = readJson<DemoAuthoritiesState>(OUTPUT_PATH);
  if (existing && existing.programId === programId && existing.oracle?.secretKey) {
    const oracle = keypairFromStored(existing.oracle);
    const state = {
      ...existing,
      rpcEndpoint,
      admin: {
        publicKey: admin.publicKey.toBase58(),
        source: ADMIN_KEYPAIR_PATH,
      },
      oracle: keypairJson(oracle),
    };
    writeState(state);
    return { state, oracle };
  }

  const oracle = Keypair.generate();
  const state: DemoAuthoritiesState = {
    generatedAt: new Date().toISOString(),
    rpcEndpoint,
    programId,
    admin: {
      publicKey: admin.publicKey.toBase58(),
      source: ADMIN_KEYPAIR_PATH,
    },
    oracle: keypairJson(oracle),
  };
  writeState(state);
  return { state, oracle };
};

const loadProgram = (
  connection: Connection,
  payer: Keypair,
  programId: string
): { program: Program<Idl>; protocolConfig: PublicKey } => {
  const idl = JSON.parse(readFileSync(IDL_PATH, "utf8")) as Idl & { address?: string };
  idl.address = programId;
  const provider = new AnchorProvider(connection, new Wallet(payer), AnchorProvider.defaultOptions());
  const program = new Program(idl, provider);
  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    new PublicKey(programId)
  );

  return { program, protocolConfig };
};

const main = async () => {
  const rpcEndpoint =
    process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const programId = FYPH_PROGRAM_ID;
  if (!existsSync(ADMIN_KEYPAIR_PATH)) {
    throw new Error(`Missing admin keypair at ${ADMIN_KEYPAIR_PATH}`);
  }

  const admin = keypairFromSecretFile(ADMIN_KEYPAIR_PATH);
  const { state, oracle } = loadOrCreateState(rpcEndpoint, programId, admin);

  process.env.SOLANA_RPC_ENDPOINT = rpcEndpoint;
  process.env.STREAMPUMP_PROGRAM_ID = programId;
  process.env.PROTOCOL_ADMIN_SECRET_KEY = JSON.stringify(Array.from(admin.secretKey));
  process.env.ORACLE_AUTHORITY_SECRET_KEY = JSON.stringify(Array.from(oracle.secretKey));
  process.env.INDEXER_ENABLED = "false";

  const connection = new Connection(rpcEndpoint, "confirmed");
  const { program, protocolConfig } = loadProgram(connection, admin, programId);

  log(`program=${programId}`);
  log(`admin=${admin.publicKey.toBase58()}`);
  log(`newOracle=${oracle.publicKey.toBase58()}`);
  log(`protocolConfig=${protocolConfig.toBase58()}`);

  const programAccount = await connection.getAccountInfo(new PublicKey(programId), "confirmed");
  if (!programAccount?.executable) {
    throw new Error(`Program ${programId} is not deployed/executable on ${rpcEndpoint}`);
  }

  const before = await connection.getAccountInfo(protocolConfig, "confirmed");
  if (!before) {
    throw new Error(`protocol_config does not exist at ${protocolConfig.toBase58()}`);
  }

  let spumpMint: PublicKey;
  if (before.data.length === 8 + 234) {
    const current = await program.account.protocolConfig.fetch(protocolConfig);
    spumpMint = current.spumpMint as PublicKey;
    if (!(current.admin as PublicKey).equals(admin.publicKey)) {
      throw new Error(`Migrated protocol admin mismatch: ${(current.admin as PublicKey).toBase58()}`);
    }
    if (!(current.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
      throw new Error(
        `protocol_config is already migrated but oracle is ${(current.oracleAuthority as PublicKey).toBase58()}, expected ${oracle.publicKey.toBase58()}`
      );
    }
    log("protocol_config already migrated; no chain write needed");
  } else {
    if (before.data.length !== 174) {
      throw new Error(`Unexpected protocol_config length ${before.data.length}`);
    }
    spumpMint = new PublicKey(before.data.subarray(104, 136));
    const legacyAdmin = new PublicKey(before.data.subarray(8, 40));
    if (!legacyAdmin.equals(admin.publicKey)) {
      throw new Error(
        `Legacy protocol admin ${legacyAdmin.toBase58()} does not match ${admin.publicKey.toBase58()}`
      );
    }

    const signature = await program.methods
      .migrateLegacyProtocolConfig({
        newOracleAuthority: oracle.publicKey,
      })
      .accounts({
        admin: admin.publicKey,
        protocolConfig,
        spumpMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    log(`migrationSignature=${signature}`);
    state.migrationSignature = signature;
    state.migratedAt = new Date().toISOString();
  }

  const migrated = await program.account.protocolConfig.fetch(protocolConfig);
  if (!(migrated.admin as PublicKey).equals(admin.publicKey)) {
    throw new Error("post-migration admin mismatch");
  }
  if (!(migrated.oracleAuthority as PublicKey).equals(oracle.publicKey)) {
    throw new Error("post-migration oracle mismatch");
  }

  state.rpcEndpoint = rpcEndpoint;
  state.programId = programId;
  state.protocolConfig = protocolConfig.toBase58();
  state.usdcMint = (migrated.usdcMint as PublicKey).toBase58();
  state.spumpMint = (migrated.spumpMint as PublicKey).toBase58();
  writeState(state);

  console.log("[devnet-migrate] success");
  console.log(
    JSON.stringify(
      {
        STREAMPUMP_PROGRAM_ID: programId,
        protocolConfig: state.protocolConfig,
        admin: state.admin.publicKey,
        oracle: state.oracle.publicKey,
        usdcMint: state.usdcMint,
        spumpMint: state.spumpMint,
        migrationSignature: state.migrationSignature ?? null,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error("[devnet-migrate] failed");
  console.error(error);
  process.exitCode = 1;
});

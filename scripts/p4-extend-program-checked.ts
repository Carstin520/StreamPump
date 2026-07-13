import { createHash } from "crypto";
import { readFileSync } from "fs";

import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);
const PROGRAM_ID = new PublicKey("FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp");
const PROGRAMDATA_ID = new PublicKey("58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs");
const EXTEND_PROGRAM_CHECKED_FEATURE = new PublicKey(
  "2oMRZEDWT2tqtYMofhmmfQ8SsjqUFzT6sYXppQDavxwz"
);
const UPGRADE_AUTHORITY = new PublicKey("BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw");
const FEE_PAYER = new PublicKey("Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9");
const PRE_UPGRADE_SHA256 = "96b114bb1b130695b7a7cccc1ce9a41bf953c4acd6179120acc4a2a87e591457";
const PADDED_ROLLBACK_SHA256 = "8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247";
const CURRENT_CAPACITY = 1_318_104;
const TARGET_CAPACITY = 1_328_344;
const ADDITIONAL_BYTES = 10_240;
const PROGRAMDATA_HEADER_LEN = 45;
const EXTEND_PROGRAM_VARIANT = 6;
const EXTEND_PROGRAM_CHECKED_VARIANT = 9;

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const keypair = (path: string): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]));

const u32 = (value: number): Buffer => {
  const result = Buffer.alloc(4);
  result.writeUInt32LE(value);
  return result;
};

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const safeRpc = async <T>(label: string, operation: Promise<T>): Promise<T> => {
  try {
    return await operation;
  } catch (_error) {
    throw new Error(`${label} failed`);
  }
};

const assertProgramDataHeader = (account: AccountInfo<Buffer>) => {
  if (!account.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)) {
    throw new Error("ProgramData owner mismatch");
  }
  if (account.data.readUInt32LE(0) !== 3 || account.data[12] !== 1) {
    throw new Error("ProgramData header mismatch");
  }
  const authority = new PublicKey(account.data.subarray(13, PROGRAMDATA_HEADER_LEN));
  if (!authority.equals(UPGRADE_AUTHORITY)) throw new Error("upgrade authority mismatch");
};

const main = async () => {
  const rpcUrl = required("PILOT_TX_RPC_URL");
  const rpcHost = new URL(rpcUrl).hostname;
  if (rpcHost === "api.devnet.solana.com") throw new Error("public devnet RPC is forbidden");
  const rpcClass = rpcHost.endsWith("helius-rpc.com") ? "helius-devnet" : "dedicated-devnet";

  const authority = keypair(required("P4_BUFFER_AUTHORITY_KEYPAIR"));
  const feePayer = keypair(required("P4_FEE_PAYER_KEYPAIR"));
  if (!authority.publicKey.equals(UPGRADE_AUTHORITY)) throw new Error("authority keypair mismatch");
  if (!feePayer.publicKey.equals(FEE_PAYER)) throw new Error("fee payer keypair mismatch");

  const connection = new Connection(rpcUrl, "confirmed");
  if ((await safeRpc("genesis verification", connection.getGenesisHash())) !== DEVNET_GENESIS) {
    throw new Error("RPC is not Solana devnet");
  }
  const [program, programData, checkedFeature, feePayerLamports] = await Promise.all([
    safeRpc("program read", connection.getAccountInfo(PROGRAM_ID, "confirmed")),
    safeRpc("ProgramData read", connection.getAccountInfo(PROGRAMDATA_ID, "confirmed")),
    safeRpc(
      "ExtendProgramChecked feature read",
      connection.getAccountInfo(EXTEND_PROGRAM_CHECKED_FEATURE, "confirmed")
    ),
    safeRpc("fee payer balance read", connection.getBalance(FEE_PAYER, "confirmed")),
  ]);
  const checkedFeatureActive = checkedFeature !== null;
  const instructionMode = checkedFeatureActive
    ? "extend-program-checked"
    : "legacy-extend-feature-inactive";
  if (!program || !programData) throw new Error("program account pair missing");
  if (!program.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)
    || program.data.length !== 36
    || program.data.readUInt32LE(0) !== 2
    || !new PublicKey(program.data.subarray(4, 36)).equals(PROGRAMDATA_ID)) {
    throw new Error("program account invariant mismatch");
  }
  assertProgramDataHeader(programData);

  const deployedBytes = programData.data.subarray(PROGRAMDATA_HEADER_LEN);
  const deployedHash = sha256(deployedBytes);
  if (deployedBytes.length === TARGET_CAPACITY && deployedHash === PADDED_ROLLBACK_SHA256) {
    console.log(JSON.stringify({
      phase: "already_extended_verified",
      rpcClass,
      programCapacity: TARGET_CAPACITY,
      programSha256: PADDED_ROLLBACK_SHA256,
    }));
    return;
  }
  if (deployedBytes.length !== CURRENT_CAPACITY || deployedHash !== PRE_UPGRADE_SHA256) {
    throw new Error("program is not at the approved pre-extend state");
  }

  const targetAccountBytes = PROGRAMDATA_HEADER_LEN + TARGET_CAPACITY;
  const targetRent = await safeRpc(
    "target rent calculation",
    connection.getMinimumBalanceForRentExemption(targetAccountBytes, "confirmed")
  );
  const rentTopUp = Math.max(0, targetRent - programData.lamports);
  if (feePayerLamports <= rentTopUp + 100_000) {
    throw new Error("fee payer balance is insufficient for extend rent and fees");
  }

  console.log(JSON.stringify({
    phase: "extend_inventory",
    rpcClass,
    programId: PROGRAM_ID.toBase58(),
    programData: PROGRAMDATA_ID.toBase58(),
    authority: UPGRADE_AUTHORITY.toBase58(),
    feePayer: FEE_PAYER.toBase58(),
    currentCapacity: CURRENT_CAPACITY,
    targetCapacity: TARGET_CAPACITY,
    additionalBytes: ADDITIONAL_BYTES,
    checkedFeature: EXTEND_PROGRAM_CHECKED_FEATURE.toBase58(),
    instructionMode,
    rentTopUpLamports: rentTopUp,
    dryRun: process.env.P4_DRY_RUN === "true",
  }));
  if (process.env.P4_DRY_RUN === "true") return;
  const simulateOnly = process.env.P4_SIMULATE_ONLY === "true";
  if (!simulateOnly && process.env.P4_EXTEND_PROGRAM !== "true") {
    throw new Error("P4_EXTEND_PROGRAM=true is required for checked extension");
  }

  const instruction = new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    keys: checkedFeatureActive
      ? [
          { pubkey: PROGRAMDATA_ID, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
          { pubkey: UPGRADE_AUTHORITY, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: FEE_PAYER, isSigner: true, isWritable: true },
        ]
      : [
          { pubkey: PROGRAMDATA_ID, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: FEE_PAYER, isSigner: true, isWritable: true },
        ],
    data: Buffer.concat([
      u32(checkedFeatureActive ? EXTEND_PROGRAM_CHECKED_VARIANT : EXTEND_PROGRAM_VARIANT),
      u32(ADDITIONAL_BYTES),
    ]),
  });
  const latest = await safeRpc(
    "latest blockhash read",
    connection.getLatestBlockhash("confirmed")
  );
  const transaction = new Transaction({
    feePayer: FEE_PAYER,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(instruction);
  transaction.sign(...(checkedFeatureActive ? [feePayer, authority] : [feePayer]));
  if (!transaction.signature) throw new Error("checked extend signature missing");
  const expectedSignature = bs58.encode(transaction.signature);

  if (simulateOnly) {
    const simulation = await safeRpc(
      "checked extend simulation",
      connection.simulateTransaction(
        transaction,
        checkedFeatureActive ? [feePayer, authority] : [feePayer],
        [PROGRAMDATA_ID]
      )
    );
    if (simulation.value.err) throw new Error("checked extend simulation rejected");
    const simulatedAccount = simulation.value.accounts?.[0];
    if (!simulatedAccount) throw new Error("checked extend simulation omitted ProgramData");
    const simulatedData = Buffer.from(simulatedAccount.data[0], "base64");
    if (simulatedData.length !== PROGRAMDATA_HEADER_LEN + TARGET_CAPACITY
      || simulatedData.readUInt32LE(0) !== 3
      || simulatedData[12] !== 1
      || !new PublicKey(simulatedData.subarray(13, PROGRAMDATA_HEADER_LEN)).equals(UPGRADE_AUTHORITY)
      || sha256(simulatedData.subarray(PROGRAMDATA_HEADER_LEN)) !== PADDED_ROLLBACK_SHA256) {
      throw new Error("checked extend simulated ProgramData mismatch");
    }
    console.log(JSON.stringify({
      phase: "extend_simulation_verified",
      instructionMode,
      unitsConsumed: simulation.value.unitsConsumed ?? null,
      programCapacity: TARGET_CAPACITY,
      programSha256: PADDED_ROLLBACK_SHA256,
    }));
    return;
  }

  try {
    const returnedSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 0,
    });
    if (returnedSignature !== expectedSignature) {
      throw new Error("checked extend signature mismatch");
    }
  } catch (_error) {
    // Resolve an ambiguous send only from finalized ProgramData state below.
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await sleep(1_000);
    let finalized = null;
    try {
      finalized = await connection.getAccountInfo(PROGRAMDATA_ID, "finalized");
    } catch (_error) {
      continue;
    }
    if (!finalized) continue;
    assertProgramDataHeader(finalized);
    const finalizedBytes = finalized.data.subarray(PROGRAMDATA_HEADER_LEN);
    if (finalizedBytes.length === TARGET_CAPACITY
      && sha256(finalizedBytes) === PADDED_ROLLBACK_SHA256) {
      console.log(JSON.stringify({
        phase: "extended_finalized",
        signature: expectedSignature,
        instructionMode,
        programCapacity: TARGET_CAPACITY,
        programSha256: PADDED_ROLLBACK_SHA256,
      }));
      return;
    }
    if (finalizedBytes.length !== CURRENT_CAPACITY || sha256(finalizedBytes) !== PRE_UPGRADE_SHA256) {
      throw new Error("unexpected finalized ProgramData state after extend attempt");
    }
  }
  throw new Error("checked extend did not resolve to finalized chain state");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});

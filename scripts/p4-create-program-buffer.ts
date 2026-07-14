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
const EXPECTED_AUTHORITY = new PublicKey("BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw");
const EXPECTED_FEE_PAYER = new PublicKey("Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9");
const BUFFER_HEADER_LEN = 37;
const CANDIDATE_BUFFER = new PublicKey("BEwVgZ3MnBuLaMNKYiUg6NVDDLnnija7i4adFzaJ6Kof");
const CANDIDATE_SHA256 = "5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4";
const ROLLBACK_SHA256 = "8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247";
const CANDIDATE_BYTES = 1_321_192;
const ROLLBACK_BYTES = 1_328_344;

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

const assertBuffer = (
  account: AccountInfo<Buffer> | null,
  expectedBytes: number,
  expectedAuthority: PublicKey
) => {
  if (!account) throw new Error("buffer account not found");
  if (!account.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)) {
    throw new Error("buffer owner mismatch");
  }
  if (account.data.length !== BUFFER_HEADER_LEN + expectedBytes) {
    throw new Error("buffer allocation mismatch");
  }
  if (account.data.readUInt32LE(0) !== 1 || account.data[4] !== 1) {
    throw new Error("buffer header state mismatch");
  }
  const onChainAuthority = new PublicKey(account.data.subarray(5, BUFFER_HEADER_LEN));
  if (!onChainAuthority.equals(expectedAuthority)) {
    throw new Error("on-chain buffer authority mismatch");
  }
};

const main = async () => {
  const rpcUrl = required("PILOT_TX_RPC_URL");
  const rpcHost = new URL(rpcUrl).hostname;
  if (rpcHost === "api.devnet.solana.com") throw new Error("public devnet RPC is forbidden");
  const rpcClass = rpcHost.endsWith("helius-rpc.com") ? "helius-devnet" : "dedicated-devnet";

  const bufferSigner = keypair(required("P4_BUFFER_KEYPAIR"));
  const authority = keypair(required("P4_BUFFER_AUTHORITY_KEYPAIR"));
  const feePayer = keypair(required("P4_FEE_PAYER_KEYPAIR"));
  const expectedBuffer = new PublicKey(required("P4_EXPECTED_BUFFER"));
  const artifactRole = required("P4_ARTIFACT_ROLE");
  if (!bufferSigner.publicKey.equals(expectedBuffer)) throw new Error("buffer address mismatch");
  if (!authority.publicKey.equals(EXPECTED_AUTHORITY)) throw new Error("authority keypair mismatch");
  if (!feePayer.publicKey.equals(EXPECTED_FEE_PAYER)) throw new Error("fee payer keypair mismatch");

  const program = readFileSync(required("P4_PROGRAM_SO"));
  const expectedHash = required("P4_EXPECTED_SHA256");
  if (artifactRole === "candidate") {
    if (!expectedBuffer.equals(CANDIDATE_BUFFER)
      || expectedHash !== CANDIDATE_SHA256
      || program.length !== CANDIDATE_BYTES) {
      throw new Error("candidate role buffer/hash mismatch");
    }
  } else if (artifactRole === "rollback") {
    if (expectedBuffer.equals(CANDIDATE_BUFFER)
      || expectedHash !== ROLLBACK_SHA256
      || program.length !== ROLLBACK_BYTES) {
      throw new Error("rollback role buffer/hash mismatch");
    }
  } else {
    throw new Error("P4_ARTIFACT_ROLE must be candidate or rollback");
  }
  if (sha256(program) !== expectedHash) throw new Error("program SHA256 mismatch");

  const connection = new Connection(rpcUrl, "confirmed");
  if ((await safeRpc("genesis verification", connection.getGenesisHash())) !== DEVNET_GENESIS) {
    throw new Error("RPC is not Solana devnet");
  }

  const existing = await safeRpc(
    "buffer account read",
    connection.getAccountInfo(bufferSigner.publicKey, "confirmed")
  );
  if (existing) {
    assertBuffer(existing, program.length, authority.publicKey);
    console.log(JSON.stringify({
      phase: "existing_verified",
      rpcClass,
      artifactRole,
      buffer: bufferSigner.publicKey.toBase58(),
      authority: authority.publicKey.toBase58(),
      payloadBytes: program.length,
    }));
    return;
  }

  const space = BUFFER_HEADER_LEN + program.length;
  const rentLamports = await safeRpc(
    "rent calculation",
    connection.getMinimumBalanceForRentExemption(space, "confirmed")
  );
  const feePayerLamports = await safeRpc(
    "fee payer balance read",
    connection.getBalance(feePayer.publicKey, "confirmed")
  );
  if (feePayerLamports <= rentLamports + 100_000) {
    throw new Error("fee payer balance is insufficient for buffer rent and fees");
  }

  console.log(JSON.stringify({
    phase: "create_inventory",
    rpcClass,
    artifactRole,
    buffer: bufferSigner.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    feePayer: feePayer.publicKey.toBase58(),
    payloadBytes: program.length,
    programSha256: expectedHash,
    rentLamports,
    dryRun: process.env.P4_DRY_RUN === "true",
  }));
  if (process.env.P4_DRY_RUN === "true") return;
  if (process.env.P4_CREATE_BUFFER !== "true") {
    throw new Error("P4_CREATE_BUFFER=true is required for buffer creation");
  }

  const latest = await safeRpc(
    "latest blockhash read",
    connection.getLatestBlockhash("confirmed")
  );
  const initializeBuffer = new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    keys: [
      { pubkey: bufferSigner.publicKey, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: false, isWritable: false },
    ],
    data: u32(0),
  });
  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey,
      newAccountPubkey: bufferSigner.publicKey,
      lamports: rentLamports,
      space,
      programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    }),
    initializeBuffer
  );
  transaction.sign(feePayer, bufferSigner);
  if (!transaction.signature) throw new Error("buffer creation signature missing");
  const expectedSignature = bs58.encode(transaction.signature);

  let signature = expectedSignature;
  try {
    const returnedSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    });
    if (returnedSignature !== expectedSignature) {
      throw new Error("buffer creation signature mismatch");
    }
  } catch (_error) {
    // A lost response can still mean the signed transaction landed. Resolve
    // only by finalized account state; never rebuild or re-sign blindly.
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await sleep(1_000);
    let account = null;
    try {
      account = await connection.getAccountInfo(bufferSigner.publicKey, "finalized");
    } catch (_error) {
      continue;
    }
    if (!account) continue;
    assertBuffer(account, program.length, authority.publicKey);
    console.log(JSON.stringify({
      phase: "created_finalized",
      signature,
      buffer: bufferSigner.publicKey.toBase58(),
      payloadBytes: program.length,
      rentLamports,
    }));
    return;
  }
  throw new Error("buffer creation did not resolve to finalized chain state");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});

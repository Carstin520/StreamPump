import { createHash, randomUUID } from "crypto";
import { appendFileSync, chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";

import {
  Connection,
  Keypair,
  PublicKey,
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
const CHUNK_SIZE = 900;
const WRITER_LOCK_DIR = "/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/.p4-buffer-writer.lock";
const CANDIDATE_BUFFER = new PublicKey("BEwVgZ3MnBuLaMNKYiUg6NVDDLnnija7i4adFzaJ6Kof");
const CANDIDATE_SHA256 = "5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4";
const ROLLBACK_SHA256 = "8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247";
const CANDIDATE_BYTES = 1_321_192;
const ROLLBACK_BYTES = 1_328_344;
const CANDIDATE_SIGNATURE_LOG = "/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/candidate-buffer-write-signatures.jsonl";
const ROLLBACK_SIGNATURE_LOG = "/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/rollback-buffer-write-signatures.jsonl";
const WRITE_DELAY_MS = Number(process.env.P4_WRITE_DELAY_MS ?? "3000");
const MAX_CHUNKS = Number(process.env.P4_MAX_CHUNKS ?? "0");

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

const u64 = (value: number): Buffer => {
  const result = Buffer.alloc(8);
  result.writeBigUInt64LE(BigInt(value));
  return result;
};

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const writeInstruction = (
  buffer: PublicKey,
  authority: PublicKey,
  offset: number,
  bytes: Buffer
): TransactionInstruction =>
  new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([u32(1), u32(offset), u64(bytes.length), bytes]),
  });

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryDelayMs = (attempt: number, retryAfter: string | null): number => {
  const backoffMs = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
  const retryAfterSeconds = Number(retryAfter);
  const baseDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1_000
    : backoffMs[attempt - 1];
  return Math.round(baseDelay * (0.75 + Math.random() * 0.5));
};

const acquireWriterLock = (): (() => void) => {
  const token = `${process.pid}:${randomUUID()}`;
  const ownerPath = `${WRITER_LOCK_DIR}/owner`;
  while (true) {
    try {
      mkdirSync(WRITER_LOCK_DIR, { mode: 0o700 });
      writeFileSync(ownerPath, `${token}\n`, { mode: 0o600 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let previousOwner = "";
      try {
        previousOwner = readFileSync(ownerPath, "utf8").trim();
      } catch (_error) {
        // The creator may still be writing its owner token. Fail closed.
        throw new Error("P4 writer lock exists without a readable owner");
      }
      const previousPid = Number(previousOwner.split(":", 1)[0]);
      if (Number.isInteger(previousPid) && previousPid > 0) {
        try {
          process.kill(previousPid, 0);
          throw new Error("another P4 buffer writer is active");
        } catch (ownerError) {
          if (ownerError instanceof Error
            && ownerError.message === "another P4 buffer writer is active") {
            throw ownerError;
          }
        }
      }
      const quarantine = `${WRITER_LOCK_DIR}.stale-${process.pid}-${randomUUID()}`;
      try {
        renameSync(WRITER_LOCK_DIR, quarantine);
        rmSync(quarantine, { recursive: true, force: true });
      } catch (renameError) {
        if ((renameError as NodeJS.ErrnoException).code !== "ENOENT") throw renameError;
      }
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (readFileSync(ownerPath, "utf8").trim() === token) {
        rmSync(WRITER_LOCK_DIR, { recursive: true, force: true });
      }
    } catch (_error) {
      // A missing lock on process shutdown is harmless.
    }
  };
};

const safeRpc = async <T>(label: string, operation: Promise<T>): Promise<T> => {
  try {
    return await operation;
  } catch (_error) {
    throw new Error(`${label} failed`);
  }
};

const retryRpc = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await operation();
    } catch (_error) {
      if (attempt === 6) throw new Error(`${label} failed`);
      await sleep(retryDelayMs(attempt, null));
    }
  }
  throw new Error(`${label} retry budget exhausted`);
};

let rpcRequestId = 0;
const jsonRpc = async <T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> => {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcRequestId, method, params }),
      });
    } catch (_error) {
      if (attempt === 6) throw new Error(`${method} transport failed`);
      await sleep(retryDelayMs(attempt, null));
      continue;
    }

    const retryableStatus = response.status === 408
      || response.status === 425
      || response.status === 429
      || response.status === 500
      || response.status === 502
      || response.status === 503
      || response.status === 504;
    if (retryableStatus) {
      if (attempt === 6) {
        const reason = response.status === 429 ? "rate limited" : `HTTP ${response.status}`;
        throw new Error(`${method} ${reason}`);
      }
      await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
      continue;
    }
    if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);

    const body = (await response.json()) as {
      result?: T;
      error?: { code?: number };
    };
    if (body.error || body.result === undefined) {
      throw new Error(`${method} RPC error ${body.error?.code ?? "unknown"}`);
    }
    return body.result;
  }
  throw new Error(`${method} retry budget exhausted`);
};

const sendChunk = async (
  rpcUrl: string,
  feePayer: Keypair,
  signers: Keypair[],
  instruction: TransactionInstruction,
  signatureLog: string,
  artifactRole: string,
  buffer: PublicKey,
  offset: number
): Promise<string> => {
  const latest = await jsonRpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }]);

  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latest.value.blockhash,
    lastValidBlockHeight: latest.value.lastValidBlockHeight,
  }).add(instruction);
  transaction.sign(...signers);
  if (!transaction.signature) throw new Error("buffer write signature missing");
  const expectedSignature = bs58.encode(transaction.signature);
  appendFileSync(signatureLog, `${JSON.stringify({
    at: new Date().toISOString(),
    phase: "signed",
    artifactRole,
    buffer: buffer.toBase58(),
    offset,
    signature: expectedSignature,
  })}\n`, { mode: 0o600 });
  const encoded = transaction.serialize().toString("base64");

  const signature = await jsonRpc<string>(rpcUrl, "sendTransaction", [encoded, {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 5,
  }]);
  if (signature !== expectedSignature) throw new Error("buffer write signature mismatch");

  for (let poll = 1; poll <= 45; poll += 1) {
    await sleep(1_000);
    const statuses = await jsonRpc<{
      value: Array<{
        err: unknown;
        confirmationStatus?: "processed" | "confirmed" | "finalized";
      } | null>;
    }>(rpcUrl, "getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
    const status = statuses.value[0];
    if (status?.err) throw new Error("buffer write transaction failed");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      appendFileSync(signatureLog, `${JSON.stringify({
        at: new Date().toISOString(),
        phase: status.confirmationStatus,
        artifactRole,
        buffer: buffer.toBase58(),
        offset,
        signature: expectedSignature,
      })}\n`, { mode: 0o600 });
      return signature;
    }
  }
  throw new Error("buffer write confirmation timed out");
};

const main = async () => {
  const releaseWriterLock = acquireWriterLock();
  process.once("exit", releaseWriterLock);
  process.once("SIGINT", () => process.exit(130));
  process.once("SIGTERM", () => process.exit(143));

  const rpcUrl = required("PILOT_TX_RPC_URL");
  const rpcHost = new URL(rpcUrl).hostname;
  if (rpcHost === "api.devnet.solana.com") throw new Error("public devnet RPC is forbidden");
  const rpcClass = rpcHost.endsWith("helius-rpc.com") ? "helius-devnet" : "dedicated-devnet";
  const expectedBuffer = new PublicKey(required("P4_EXPECTED_BUFFER"));
  const artifactRole = required("P4_ARTIFACT_ROLE");

  const connection = new Connection(rpcUrl, "confirmed");
  if ((await retryRpc("genesis verification", () => connection.getGenesisHash())) !== DEVNET_GENESIS) {
    throw new Error("RPC is not Solana devnet");
  }

  const bufferSigner = keypair(required("P4_BUFFER_KEYPAIR"));
  const authority = keypair(required("P4_BUFFER_AUTHORITY_KEYPAIR"));
  const feePayer = keypair(required("P4_FEE_PAYER_KEYPAIR"));
  if (!bufferSigner.publicKey.equals(expectedBuffer)) throw new Error("buffer address mismatch");
  if (!authority.publicKey.equals(EXPECTED_AUTHORITY)) throw new Error("authority keypair mismatch");
  if (!feePayer.publicKey.equals(EXPECTED_FEE_PAYER)) throw new Error("fee payer keypair mismatch");
  const candidate = readFileSync(required("P4_PROGRAM_SO"));
  const expectedHash = required("P4_EXPECTED_SHA256");
  if (artifactRole === "candidate") {
    if (!expectedBuffer.equals(CANDIDATE_BUFFER)
      || expectedHash !== CANDIDATE_SHA256
      || candidate.length !== CANDIDATE_BYTES) {
      throw new Error("candidate role buffer/hash mismatch");
    }
  } else if (artifactRole === "rollback") {
    if (expectedBuffer.equals(CANDIDATE_BUFFER)
      || expectedHash !== ROLLBACK_SHA256
      || candidate.length !== ROLLBACK_BYTES) {
      throw new Error("rollback role buffer/hash mismatch");
    }
  } else {
    throw new Error("P4_ARTIFACT_ROLE must be candidate or rollback");
  }
  if (sha256(candidate) !== expectedHash) throw new Error("candidate SHA256 mismatch");

  const account = await retryRpc(
    "buffer account read",
    () => connection.getAccountInfo(bufferSigner.publicKey, "confirmed")
  );
  if (!account) throw new Error("buffer account not found");
  if (!account.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)) {
    throw new Error("buffer owner mismatch");
  }
  if (account.data.length !== BUFFER_HEADER_LEN + candidate.length) {
    throw new Error("buffer allocation mismatch");
  }
  if (account.data.readUInt32LE(0) !== 1 || account.data[4] !== 1) {
    throw new Error("buffer header state mismatch");
  }
  const onChainAuthority = new PublicKey(account.data.subarray(5, BUFFER_HEADER_LEN));
  if (!onChainAuthority.equals(EXPECTED_AUTHORITY)) {
    throw new Error("on-chain buffer authority mismatch");
  }

  const current = account.data.subarray(BUFFER_HEADER_LEN);
  const pending: number[] = [];
  for (let offset = 0; offset < candidate.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, candidate.length);
    if (!current.subarray(offset, end).equals(candidate.subarray(offset, end))) {
      pending.push(offset);
    }
  }
  const planned = MAX_CHUNKS > 0 ? pending.slice(0, MAX_CHUNKS) : pending;

  console.log(
    JSON.stringify({
      phase: "inventory",
      rpcClass,
      artifactRole,
      buffer: bufferSigner.publicKey.toBase58(),
      authority: authority.publicKey.toBase58(),
      feePayer: feePayer.publicKey.toBase58(),
      candidateBytes: candidate.length,
      candidateSha256: expectedHash,
      pendingChunks: pending.length,
      plannedChunks: planned.length,
      chunkSize: CHUNK_SIZE,
      writeDelayMs: WRITE_DELAY_MS,
      dryRun: process.env.P4_DRY_RUN === "true",
    })
  );

  if (process.env.P4_DRY_RUN === "true") return;
  if (!Number.isInteger(MAX_CHUNKS) || MAX_CHUNKS < 1 || MAX_CHUNKS > 25) {
    throw new Error("P4_MAX_CHUNKS must be an integer from 1 to 25 for mutation runs");
  }
  if (!Number.isFinite(WRITE_DELAY_MS) || WRITE_DELAY_MS < 3_000) {
    throw new Error("P4_WRITE_DELAY_MS must be at least 3000");
  }
  const signatureLog = artifactRole === "candidate"
    ? CANDIDATE_SIGNATURE_LOG
    : ROLLBACK_SIGNATURE_LOG;
  appendFileSync(signatureLog, "", { mode: 0o600 });
  chmodSync(signatureLog, 0o600);

  const signers = authority.publicKey.equals(feePayer.publicKey)
    ? [authority]
    : [feePayer, authority];

  for (let index = 0; index < planned.length; index += 1) {
    const offset = planned[index];
    const bytes = candidate.subarray(offset, Math.min(offset + CHUNK_SIZE, candidate.length));
    try {
      await sendChunk(
        rpcUrl,
        feePayer,
        signers,
        writeInstruction(bufferSigner.publicKey, authority.publicKey, offset, bytes),
        signatureLog,
        artifactRole,
        bufferSigner.publicKey,
        offset
      );
    } catch (_error) {
      throw new Error(`buffer write failed at offset ${offset}`);
    }
    if (WRITE_DELAY_MS > 0) await sleep(WRITE_DELAY_MS);
    if ((index + 1) % 25 === 0 || index + 1 === planned.length) {
      console.log(JSON.stringify({ phase: "write", completed: index + 1, total: planned.length }));
    }
  }

  if (planned.length < pending.length) {
    for (let verificationAttempt = 1; verificationAttempt <= 60; verificationAttempt += 1) {
      const partial = await retryRpc(
        "partial buffer verification",
        () => connection.getAccountInfo(bufferSigner.publicKey, "finalized")
      );
      if (partial) {
        if (!partial.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)
          || partial.data.length !== BUFFER_HEADER_LEN + candidate.length
          || partial.data.readUInt32LE(0) !== 1
          || partial.data[4] !== 1
          || !new PublicKey(partial.data.subarray(5, BUFFER_HEADER_LEN)).equals(EXPECTED_AUTHORITY)) {
          throw new Error("finalized buffer invariant mismatch");
        }
        const payload = partial.data.subarray(BUFFER_HEADER_LEN, BUFFER_HEADER_LEN + candidate.length);
        const plannedMatch = planned.every((offset) => {
          const end = Math.min(offset + CHUNK_SIZE, candidate.length);
          return payload.subarray(offset, end).equals(candidate.subarray(offset, end));
        });
        if (plannedMatch) {
          let remaining = 0;
          for (let offset = 0; offset < candidate.length; offset += CHUNK_SIZE) {
            const end = Math.min(offset + CHUNK_SIZE, candidate.length);
            if (!payload.subarray(offset, end).equals(candidate.subarray(offset, end))) remaining += 1;
          }
          if (remaining > pending.length - planned.length) {
            throw new Error("pending chunk count increased after batch");
          }
          console.log(
            JSON.stringify({
              phase: "partial_verified",
              commitment: "finalized",
              chunks: planned.length,
              pendingBefore: pending.length,
              pendingAfter: remaining,
            })
          );
          return;
        }
      }
      await sleep(1_000);
    }
    throw new Error("partial finalized verification timed out");
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const finalized = await retryRpc(
      "finalized buffer read",
      () => connection.getAccountInfo(bufferSigner.publicKey, "finalized")
    );
    if (finalized) {
      if (!finalized.owner.equals(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)
        || finalized.data.length !== BUFFER_HEADER_LEN + candidate.length
        || finalized.data.readUInt32LE(0) !== 1
        || finalized.data[4] !== 1
        || !new PublicKey(finalized.data.subarray(5, BUFFER_HEADER_LEN)).equals(EXPECTED_AUTHORITY)) {
        throw new Error("finalized buffer invariant mismatch");
      }
      const payload = finalized.data.subarray(BUFFER_HEADER_LEN, BUFFER_HEADER_LEN + candidate.length);
      if (payload.length === candidate.length && payload.equals(candidate)) {
        console.log(
          JSON.stringify({
            phase: "verified",
            bytes: payload.length,
            sha256: sha256(payload),
            commitment: "finalized",
          })
        );
        return;
      }
    }
    await sleep(1_000);
  }
  throw new Error("finalized buffer bytes did not converge to candidate");
};

main().catch((error) => {
  console.error(
    JSON.stringify({
      phase: "failed",
      message: error instanceof Error ? error.message : "unknown failure",
    })
  );
  process.exitCode = 1;
});

import { existsSync, readFileSync } from "fs";
import path from "path";

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import "../backend/config/loadEnv";

const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);
const PROGRAM_ID = new PublicKey("FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp");
const PROGRAM_SO_PATH = path.resolve(process.cwd(), "target/deploy/streampump_core.so");
const ADMIN_KEYPAIR_PATH = path.resolve(process.cwd(), ".local/devnet-admin-keypair.json");
const BUFFER_KEYPAIR_PATH = path.resolve(process.cwd(), ".local/devnet-upgrade-buffer-keypair.json");
const BUFFER_HEADER_LEN = 37;
const WRITE_CHUNK_SIZE = 900;
const WRITE_BATCH_SIZE = 5;

const log = (message: string) => console.log(`[devnet-upgrade] ${message}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const keypairFromFile = (filePath: string): Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8")) as number[]));

const u32 = (value: number): Buffer => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
};

const u64 = (value: number): Buffer => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
};

const loaderInstruction = (
  variant: number,
  keys: TransactionInstruction["keys"],
  payload: Buffer[] = []
): TransactionInstruction =>
  new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    keys,
    data: Buffer.concat([u32(variant), ...payload]),
  });

const createInitializeBufferInstruction = (buffer: PublicKey, authority: PublicKey) =>
  loaderInstruction(0, [
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
  ]);

const createWriteInstruction = (
  buffer: PublicKey,
  authority: PublicKey,
  offset: number,
  bytes: Buffer
) =>
  loaderInstruction(
    1,
    [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    [u32(offset), u64(bytes.length), bytes]
  );

const createUpgradeInstruction = (
  program: PublicKey,
  buffer: PublicKey,
  authority: PublicKey,
  spill: PublicKey
) => {
  const [programData] = PublicKey.findProgramAddressSync(
    [program.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  );

  return loaderInstruction(3, [
    { pubkey: programData, isSigner: false, isWritable: true },
    { pubkey: program, isSigner: false, isWritable: true },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: spill, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: true, isWritable: false },
  ]);
};

const send = async (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  label: string
): Promise<string> => {
  const signature = await sendAndConfirmTransaction(connection, transaction, signers, {
    commitment: "confirmed",
    skipPreflight: false,
    maxRetries: 5,
  });
  log(`${label}: ${signature}`);
  return signature;
};

const sendWriteBatch = async (
  connection: Connection,
  admin: Keypair,
  buffer: PublicKey,
  programData: Buffer,
  startOffset: number
) => {
  const offsets: number[] = [];
  for (
    let offset = startOffset;
    offset < programData.length && offsets.length < WRITE_BATCH_SIZE;
    offset += WRITE_CHUNK_SIZE
  ) {
    offsets.push(offset);
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const latest = await connection.getLatestBlockhash("confirmed");
      const signed = offsets.map((offset) => {
        const chunk = programData.subarray(offset, Math.min(offset + WRITE_CHUNK_SIZE, programData.length));
        const tx = new Transaction({
          feePayer: admin.publicKey,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        }).add(createWriteInstruction(buffer, admin.publicKey, offset, chunk));
        tx.sign(admin);
        return { offset, raw: tx.serialize() };
      });

      const signatures = await Promise.all(
        signed.map(({ raw }) =>
          connection.sendRawTransaction(raw, {
            skipPreflight: true,
            maxRetries: 5,
          })
        )
      );

      const confirmations = await Promise.all(
        signatures.map((signature) =>
          connection.confirmTransaction(
            {
              signature,
              blockhash: latest.blockhash,
              lastValidBlockHeight: latest.lastValidBlockHeight,
            },
            "confirmed"
          )
        )
      );
      const failed = confirmations.find((confirmation) => confirmation.value.err);
      if (failed) {
        throw new Error(`write batch failed: ${JSON.stringify(failed.value.err)}`);
      }
      break;
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }
      const waitMs = attempt * 1_500;
      log(`write batch retry ${attempt}/5 after ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  const lastOffset = offsets[offsets.length - 1];
  const lastEnd = Math.min(lastOffset + WRITE_CHUNK_SIZE, programData.length);
  log(`write ${lastEnd}/${programData.length}`);
  await sleep(250);
  return lastEnd;
};

const main = async () => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
  if (!existsSync(PROGRAM_SO_PATH)) {
    throw new Error(`Missing program binary at ${PROGRAM_SO_PATH}`);
  }
  if (!existsSync(ADMIN_KEYPAIR_PATH)) {
    throw new Error(`Missing admin keypair at ${ADMIN_KEYPAIR_PATH}`);
  }
  if (!existsSync(BUFFER_KEYPAIR_PATH)) {
    throw new Error(`Missing buffer keypair at ${BUFFER_KEYPAIR_PATH}`);
  }

  const connection = new Connection(rpcEndpoint, "confirmed");
  const admin = keypairFromFile(ADMIN_KEYPAIR_PATH);
  const buffer = keypairFromFile(BUFFER_KEYPAIR_PATH);
  const programData = readFileSync(PROGRAM_SO_PATH);
  const bufferSpace = BUFFER_HEADER_LEN + programData.length;
  const bufferLamports = await connection.getMinimumBalanceForRentExemption(bufferSpace);

  log(`program=${PROGRAM_ID.toBase58()}`);
  log(`admin=${admin.publicKey.toBase58()}`);
  log(`buffer=${buffer.publicKey.toBase58()}`);
  log(`programBytes=${programData.length}`);

  const existingBuffer = await connection.getAccountInfo(buffer.publicKey, "confirmed");
  if (!existingBuffer) {
    log(`creating buffer account with ${bufferSpace} bytes`);
    await send(
      connection,
      new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: admin.publicKey,
          newAccountPubkey: buffer.publicKey,
          lamports: bufferLamports,
          space: bufferSpace,
          programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
        }),
        createInitializeBufferInstruction(buffer.publicKey, admin.publicKey)
      ),
      [admin, buffer],
      "initializeBuffer"
    );
  } else {
    log(`reusing existing buffer account length=${existingBuffer.data.length}`);
  }

  for (let offset = 0; offset < programData.length; ) {
    offset = await sendWriteBatch(connection, admin, buffer.publicKey, programData, offset);
  }

  const written = await connection.getAccountInfo(buffer.publicKey, "confirmed");
  if (!written) {
    throw new Error("buffer disappeared before upgrade");
  }
  if (!written.data.subarray(BUFFER_HEADER_LEN, BUFFER_HEADER_LEN + programData.length).equals(programData)) {
    throw new Error("buffer content does not match local program binary");
  }
  log("buffer content verified");

  await send(
    connection,
    new Transaction().add(
      createUpgradeInstruction(PROGRAM_ID, buffer.publicKey, admin.publicKey, admin.publicKey)
    ),
    [admin],
    "upgrade"
  );

  log("upgrade complete");
};

main().catch((error) => {
  console.error("[devnet-upgrade] failed");
  console.error(error);
  process.exitCode = 1;
});

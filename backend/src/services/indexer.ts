import { Connection, PublicKey } from "@solana/web3.js";

export const startIndexer = (rpcEndpoint: string, programId: string) => {
  const connection = new Connection(rpcEndpoint, "confirmed");
  const targetProgram = new PublicKey(programId);

  return connection.onLogs(targetProgram, (logs) => {
    // TODO: decode Anchor events and persist into Postgres/Redis.
    console.log("[indexer] program log", logs.signature);
  });
};

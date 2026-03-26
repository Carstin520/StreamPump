/**
 * CN: 链上日志索引器骨架，当前只监听程序日志，后续需要解码事件并写库。
 * EN: On-chain log indexer skeleton that currently listens to program logs and later must decode events into the DB.
 */
import { Connection, PublicKey } from "@solana/web3.js";

export const startIndexer = (rpcEndpoint: string, programId: string) => {
  const connection = new Connection(rpcEndpoint, "confirmed");
  const targetProgram = new PublicKey(programId);

  return connection.onLogs(targetProgram, (logs) => {
    // TODO: decode Anchor events and persist into Postgres/Redis.
    console.log("[indexer] program log", logs.signature);
  });
};

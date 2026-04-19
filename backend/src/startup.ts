import { type config } from "../config/default";
import { startMuxReconciliationScheduler } from "./schedulers/MuxReconciliationScheduler";
import { startOracleScheduler } from "./schedulers/OracleScheduler";
import { startIndexer } from "./services/indexer";

type RuntimeConfig = typeof config;

export const startBackgroundServices = async (runtimeConfig: RuntimeConfig): Promise<void> => {
  const { solana } = runtimeConfig;

  await startIndexer(solana.rpcEndpoint, solana.programId);
  startMuxReconciliationScheduler();
  startOracleScheduler();
};

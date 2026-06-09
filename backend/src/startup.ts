import { type config } from "../config/default";
import { startMuxReconciliationScheduler } from "./schedulers/MuxReconciliationScheduler";
import { startOracleScheduler } from "./schedulers/OracleScheduler";
import { startIndexer } from "./services/indexer";

type RuntimeConfig = typeof config;

export const startBackgroundServices = async (runtimeConfig: RuntimeConfig): Promise<void> => {
  const { solana } = runtimeConfig;

  try {
    await startIndexer(solana.rpcEndpoint, solana.programId);
  } catch (error) {
    console.error("[startup] indexer failed to start", error);
  }

  try {
    startMuxReconciliationScheduler();
  } catch (error) {
    console.error("[startup] mux reconciliation scheduler failed to start", error);
  }

  try {
    startOracleScheduler();
  } catch (error) {
    console.error("[startup] oracle scheduler failed to start", error);
  }
};

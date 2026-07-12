import { type config } from "../config/default";
import { startMuxReconciliationScheduler } from "./schedulers/MuxReconciliationScheduler";
import { startOracleScheduler } from "./schedulers/OracleScheduler";
import { startIndexer } from "./services/indexer";
import { startManagedWalletJobWorker } from "./services/managedWalletJobs";
import { prisma } from "./services/prisma";
import {
  appStartupReadiness,
  type StartupReadiness,
  type StartupReadinessSnapshot,
} from "./services/startupReadiness";

type RuntimeConfig = typeof config;

export interface BackgroundServiceDependencies {
  checkDatabase(): Promise<void>;
  startIndexer: typeof startIndexer;
  startManagedWalletJobWorker: typeof startManagedWalletJobWorker;
  startMuxReconciliationScheduler: typeof startMuxReconciliationScheduler;
  startOracleScheduler: typeof startOracleScheduler;
}

const defaultBackgroundServiceDependencies: BackgroundServiceDependencies = {
  async checkDatabase() {
    await prisma.$queryRaw`SELECT 1`;
  },
  startIndexer,
  startManagedWalletJobWorker,
  startMuxReconciliationScheduler,
  startOracleScheduler,
};

export const startBackgroundServices = async (
  runtimeConfig: RuntimeConfig,
  readiness: StartupReadiness = appStartupReadiness,
  dependencies: BackgroundServiceDependencies = defaultBackgroundServiceDependencies
): Promise<StartupReadinessSnapshot> => {
  const { solana } = runtimeConfig;
  readiness.begin(runtimeConfig);

  try {
    await dependencies.checkDatabase();
    readiness.markReady("database");
  } catch (_error) {
    readiness.markFailed("database");
    console.error("[startup] database readiness check failed");
  }

  if (runtimeConfig.indexer.enabled) {
    try {
      const indexerRuntime = await dependencies.startIndexer(
        solana.indexerRpcEndpoint,
        solana.programId,
        {
          onUnhealthy: () => readiness.markFailed("indexer"),
        }
      );
      if (indexerRuntime === null) {
        throw new Error("indexer did not create a subscription");
      }
      readiness.markReady("indexer");
    } catch (_error) {
      readiness.markFailed("indexer");
      console.error("[startup] indexer failed to start");
    }
  }

  if (runtimeConfig.managedWallet.publicExecutionEnabled) {
    try {
      dependencies.startManagedWalletJobWorker();
    } catch (_error) {
      console.error("[startup] managed wallet job worker failed to start");
    }
  }

  if (runtimeConfig.mux.reconciliation.enabled) {
    try {
      if (!dependencies.startMuxReconciliationScheduler()) {
        throw new Error("Mux reconciliation scheduler remained disabled");
      }
      readiness.markReady("muxReconciliation");
    } catch (_error) {
      readiness.markFailed("muxReconciliation");
      console.error("[startup] mux reconciliation scheduler failed to start");
    }
  }

  try {
    dependencies.startOracleScheduler();
  } catch (_error) {
    console.error("[startup] oracle scheduler failed to start");
  }

  readiness.complete();
  return readiness.snapshot();
};

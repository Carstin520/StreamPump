import { expect } from "chai";
import { type AddressInfo } from "net";

import { config } from "../config/default";
import { createApp } from "../src/app";
import { StartupReadiness } from "../src/services/startupReadiness";
import {
  type BackgroundServiceDependencies,
  startBackgroundServices,
} from "../src/startup";

describe("startup readiness", () => {
  const pilotRuntimeConfig = (): typeof config => ({
    ...config,
    indexer: {
      ...config.indexer,
      enabled: true,
    },
    mux: {
      ...config.mux,
      reconciliation: {
        ...config.mux.reconciliation,
        enabled: true,
      },
    },
    managedWallet: {
      ...config.managedWallet,
      publicExecutionEnabled: false,
    },
    oracle: {
      ...config.oracle,
      schedulerEnabled: false,
    },
  });

  const successfulDependencies = (): BackgroundServiceDependencies => ({
    async checkDatabase() {},
    async startIndexer() {
      return {
        subscriptionId: 123,
        async probeNow() {
          return true;
        },
        async stop() {},
      };
    },
    startManagedWalletJobWorker() {},
    startMuxReconciliationScheduler() {
      return true;
    },
    startOracleScheduler() {},
  });

  const withMutedStartupErrors = async <T>(operation: () => Promise<T>): Promise<T> => {
    const original = console.error;
    console.error = () => undefined;
    try {
      return await operation();
    } finally {
      console.error = original;
    }
  };

  it("becomes ready only after the required database, Indexer, and Mux services start", async () => {
    const readiness = new StartupReadiness();
    const runtimeConfig = pilotRuntimeConfig();
    readiness.begin(runtimeConfig);

    expect(readiness.snapshot()).to.deep.equal({
      ok: false,
      status: "NOT_READY",
      services: {
        database: "PENDING",
        indexer: "PENDING",
        muxReconciliation: "PENDING",
      },
    });

    const snapshot = await startBackgroundServices(
      runtimeConfig,
      readiness,
      successfulDependencies()
    );

    expect(snapshot).to.deep.equal({
      ok: true,
      status: "READY",
      services: {
        database: "READY",
        indexer: "READY",
        muxReconciliation: "READY",
      },
    });
  });

  it("passes the configured WebSocket endpoint to the Indexer runtime", async () => {
    const readiness = new StartupReadiness();
    const runtimeConfig = pilotRuntimeConfig();
    runtimeConfig.solana.indexerWsEndpoint = "wss://indexer.example.com";
    const dependencies = successfulDependencies();
    let observedWsEndpoint: string | undefined;
    dependencies.startIndexer = async (_rpcEndpoint, _programId, options) => {
      observedWsEndpoint = options.wsEndpoint;
      return {
        subscriptionId: 123,
        async probeNow() {
          return true;
        },
        async stop() {},
      };
    };

    const snapshot = await startBackgroundServices(runtimeConfig, readiness, dependencies);
    expect(snapshot.ok).to.equal(true);
    expect(observedWsEndpoint).to.equal("wss://indexer.example.com");
  });

  it("stays not ready when the Indexer or Mux scheduler fails", async () => {
    const indexerReadiness = new StartupReadiness();
    const indexerFailure = successfulDependencies();
    indexerFailure.startIndexer = async () => {
      throw new Error("rpc with secret query failed");
    };

    const indexerSnapshot = await withMutedStartupErrors(() =>
      startBackgroundServices(pilotRuntimeConfig(), indexerReadiness, indexerFailure)
    );
    expect(indexerSnapshot.ok).to.equal(false);
    expect(indexerSnapshot.services.indexer).to.equal("FAILED");
    expect(JSON.stringify(indexerSnapshot)).not.to.contain("secret query");

    const muxReadiness = new StartupReadiness();
    const muxFailure = successfulDependencies();
    muxFailure.startMuxReconciliationScheduler = () => false;
    const muxSnapshot = await withMutedStartupErrors(() =>
      startBackgroundServices(pilotRuntimeConfig(), muxReadiness, muxFailure)
    );
    expect(muxSnapshot.ok).to.equal(false);
    expect(muxSnapshot.services.muxReconciliation).to.equal("FAILED");
  });

  it("downgrades readiness when the running Indexer health monitor reports failure", async () => {
    const readiness = new StartupReadiness();
    const dependencies = successfulDependencies();
    let reportUnhealthy: (() => void) | undefined;
    let reportHealthy: (() => void) | undefined;
    dependencies.startIndexer = async (_rpcEndpoint, _programId, options) => {
      reportUnhealthy = options.onUnhealthy;
      reportHealthy = options.onHealthy;
      return {
        subscriptionId: 123,
        async probeNow() {
          return true;
        },
        async stop() {},
      };
    };

    const snapshot = await startBackgroundServices(
      pilotRuntimeConfig(),
      readiness,
      dependencies
    );
    expect(snapshot.services.indexer).to.equal("READY");

    reportUnhealthy?.();
    expect(readiness.snapshot().services.indexer).to.equal("FAILED");
    expect(readiness.snapshot().ok).to.equal(false);

    reportHealthy?.();
    expect(readiness.snapshot().services.indexer).to.equal("READY");
    expect(readiness.snapshot().ok).to.equal(true);
  });

  it("stays not ready when the database check fails without exposing its error", async () => {
    const readiness = new StartupReadiness();
    const databaseFailure = successfulDependencies();
    databaseFailure.checkDatabase = async () => {
      throw new Error("database failure containing private diagnostic details");
    };

    const snapshot = await withMutedStartupErrors(() =>
      startBackgroundServices(pilotRuntimeConfig(), readiness, databaseFailure)
    );
    expect(snapshot.ok).to.equal(false);
    expect(snapshot.services.database).to.equal("FAILED");
    expect(JSON.stringify(snapshot)).not.to.contain("postgresql");
    expect(JSON.stringify(snapshot)).not.to.contain("secret");
  });

  it("keeps health as liveness while ready reports structured 503/200 state", async () => {
    const readiness = new StartupReadiness();
    const runtimeConfig = pilotRuntimeConfig();
    readiness.begin(runtimeConfig);
    const server = createApp(readiness).listen(0);

    try {
      const { port } = server.address() as AddressInfo;
      const healthBefore = await fetch(`http://127.0.0.1:${port}/health`);
      const healthPayload = await healthBefore.json();
      expect(healthBefore.status).to.equal(200);
      expect(healthPayload.ok).to.equal(true);
      expect(healthPayload).not.to.have.property("services");
      expect(healthBefore.headers.get("cache-control")).to.equal("no-store");
      expect(healthBefore.headers.get("surrogate-control")).to.equal("no-store");
      expect(healthBefore.headers.get("x-powered-by")).to.equal(null);

      const readyBefore = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(readyBefore.status).to.equal(503);
      expect(await readyBefore.json()).to.deep.equal(readiness.snapshot());
      expect(readyBefore.headers.get("cache-control")).to.equal("no-store");
      expect(readyBefore.headers.get("surrogate-control")).to.equal("no-store");
      expect(readyBefore.headers.get("x-powered-by")).to.equal(null);

      const internalNotFound = await fetch(
        `http://127.0.0.1:${port}/api/v1/internal/not-mounted`
      );
      expect(internalNotFound.status).to.equal(404);
      expect(internalNotFound.headers.get("cache-control")).to.equal("no-store");
      expect(internalNotFound.headers.get("surrogate-control")).to.equal("no-store");
      expect(internalNotFound.headers.get("x-powered-by")).to.equal(null);

      await startBackgroundServices(runtimeConfig, readiness, successfulDependencies());
      const readyAfter = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(readyAfter.status).to.equal(200);
      expect(await readyAfter.json()).to.deep.equal(readiness.snapshot());
      expect(readyAfter.headers.get("cache-control")).to.equal("no-store");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

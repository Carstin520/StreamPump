import { type config } from "../../config/default";

type RuntimeConfig = typeof config;

export type StartupServiceName = "database" | "indexer" | "muxReconciliation";
export type StartupServiceState = "PENDING" | "READY" | "FAILED" | "DISABLED";

export type StartupReadinessSnapshot = {
  ok: boolean;
  status: "READY" | "NOT_READY";
  services: Record<StartupServiceName, StartupServiceState>;
};

export class StartupReadiness {
  private initializationComplete = false;
  private services: Record<StartupServiceName, StartupServiceState> = {
    database: "PENDING",
    indexer: "PENDING",
    muxReconciliation: "PENDING",
  };

  begin(runtimeConfig: RuntimeConfig): void {
    this.initializationComplete = false;
    this.services = {
      database: "PENDING",
      indexer: runtimeConfig.indexer.enabled ? "PENDING" : "DISABLED",
      muxReconciliation: runtimeConfig.mux.reconciliation.enabled ? "PENDING" : "DISABLED",
    };
  }

  markReady(service: StartupServiceName): void {
    if (this.services[service] !== "DISABLED") {
      this.services[service] = "READY";
    }
  }

  markFailed(service: StartupServiceName): void {
    if (this.services[service] !== "DISABLED") {
      this.services[service] = "FAILED";
    }
  }

  complete(): void {
    this.initializationComplete = true;
  }

  snapshot(): StartupReadinessSnapshot {
    const services = { ...this.services };
    const serviceStates = Object.values(services);
    const ok =
      this.initializationComplete &&
      serviceStates.every((state) => state === "READY" || state === "DISABLED");

    return {
      ok,
      status: ok ? "READY" : "NOT_READY",
      services,
    };
  }
}

export const appStartupReadiness = new StartupReadiness();

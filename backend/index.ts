/**
 * CN: Backend HTTP 入口，仅负责启动 HTTP 服务和后台任务。
 * EN: Backend HTTP entrypoint responsible only for starting HTTP and background services.
 */
import { config } from "./config/default";
import { createApp } from "./src/app";
import {
  assertProductionPilotChainSafety,
  defaultPilotChainSafetyDependencies,
  type PilotChainSafetyDependencies,
} from "./src/services/pilotChainSafety";
import { startBackgroundServices } from "./src/startup";

export const startBackend = async (
  runtimeConfig: typeof config = config,
  chainSafetyDependencies: PilotChainSafetyDependencies =
    defaultPilotChainSafetyDependencies
) => {
  await assertProductionPilotChainSafety(runtimeConfig, chainSafetyDependencies);

  const app = createApp();
  const port = Number(process.env.PORT ?? 4000);

  return app.listen(port, () => {
    console.log(`[backend] listening on :${port}`);
    void startBackgroundServices(runtimeConfig);
  });
};

if (require.main === module) {
  void startBackend().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown startup failure";
    console.error(`[backend] startup aborted: ${message}`);
    process.exitCode = 1;
  });
}

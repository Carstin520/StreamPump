/**
 * CN: Backend HTTP 入口，仅负责启动 HTTP 服务和后台任务。
 * EN: Backend HTTP entrypoint responsible only for starting HTTP and background services.
 */
import { config } from "./config/default";
import { createApp } from "./src/app";
import { startBackgroundServices } from "./src/startup";

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
  void startBackgroundServices(config);
});

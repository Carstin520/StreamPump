/**
 * CN: Backend HTTP 入口，负责挂载路由、启动 indexer 和 oracle scheduler。
 * EN: Backend HTTP entrypoint that mounts routes and starts the indexer and oracle scheduler.
 */
import cors from "cors";
import express from "express";

import { config } from "./config/default";
import routes from "./src/routes";
import { startIndexer } from "./src/services/indexer";
import { startMuxReconciliationScheduler } from "./src/schedulers/MuxReconciliationScheduler";
import { startOracleScheduler } from "./src/schedulers/OracleScheduler";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const programId = config.solana.programId;
const jsonParser = express.json();

app.use(cors());
app.use((req, res, next) => {
  // Mux webhook needs the raw body for signature verification, so JSON parsing is skipped here.
  if (req.originalUrl.startsWith("/api/webhooks/mux")) {
    next();
    return;
  }

  jsonParser(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", routes);

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
  void startIndexer(config.solana.rpcEndpoint, programId);
  startMuxReconciliationScheduler();
  startOracleScheduler();
});

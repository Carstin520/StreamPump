import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { config } from "./config/default";
import routes from "./src/routes";
import { startIndexer } from "./src/services/indexer";
import { startOracleScheduler } from "./src/schedulers/OracleScheduler";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const programId = config.solana.programId;
const jsonParser = express.json();

app.use(cors());
app.use((req, res, next) => {
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
  startOracleScheduler();
});

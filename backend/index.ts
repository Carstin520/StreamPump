import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { config } from "./config/default";
import routes from "./src/routes";
import { startIndexer } from "./src/services/indexer";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const programId = config.solana.programId;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", routes);

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
  void startIndexer(config.solana.rpcEndpoint, programId);
});

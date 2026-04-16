"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: Backend HTTP 入口，负责挂载路由、启动 indexer 和 oracle scheduler。
 * EN: Backend HTTP entrypoint that mounts routes and starts the indexer and oracle scheduler.
 */
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const default_1 = require("./config/default");
const routes_1 = __importDefault(require("./src/routes"));
const indexer_1 = require("./src/services/indexer");
const MuxReconciliationScheduler_1 = require("./src/schedulers/MuxReconciliationScheduler");
const OracleScheduler_1 = require("./src/schedulers/OracleScheduler");
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 4000);
const programId = default_1.config.solana.programId;
const jsonParser = express_1.default.json();
const allowedOrigins = default_1.config.app.corsAllowedOrigins;
app.use((0, cors_1.default)({
    origin(origin, callback) {
        // Allow same-origin server calls, curl/Postman, and webhook traffic without an Origin header.
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
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
app.use("/api", routes_1.default);
app.listen(port, () => {
    console.log(`[backend] listening on :${port}`);
    void (0, indexer_1.startIndexer)(default_1.config.solana.rpcEndpoint, programId);
    (0, MuxReconciliationScheduler_1.startMuxReconciliationScheduler)();
    (0, OracleScheduler_1.startOracleScheduler)();
});

import cors from "cors";
import express, { type Application, type RequestHandler } from "express";

import { config } from "../config/default";
import routes from "./routes";

const createCorsMiddleware = (): RequestHandler =>
  cors({
    origin(origin, callback) {
      const allowedOrigins = config.app.corsAllowedOrigins;

      // Allow same-origin server calls, curl/Postman, and webhook traffic without an Origin header.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  });

const createJsonMiddleware = (): RequestHandler => {
  const jsonParser = express.json();

  return (req, res, next) => {
    // Mux webhook needs the raw body for signature verification, so JSON parsing is skipped here.
    if (req.originalUrl.startsWith("/api/webhooks/mux")) {
      next();
      return;
    }

    jsonParser(req, res, next);
  };
};

export const createApp = (): Application => {
  const app = express();

  app.use(createCorsMiddleware());
  app.use(createJsonMiddleware());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", routes);

  return app;
};

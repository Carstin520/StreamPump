import cors from "cors";
import express, { type Application, type RequestHandler } from "express";

import { config } from "../config/default";
import routes from "./routes";

const normalizeLoopbackOrigin = (origin: string): string[] => {
  try {
    const url = new URL(origin);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return [origin];
    }

    return [
      origin,
      `${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`,
      `${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`,
    ];
  } catch (_error) {
    return [origin];
  }
};

const isCorsOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  const normalizedOrigins = normalizeLoopbackOrigin(origin);
  return allowedOrigins.some((allowedOrigin) => normalizedOrigins.includes(allowedOrigin));
};

const createCorsMiddleware = (): RequestHandler =>
  cors({
    origin(origin, callback) {
      const allowedOrigins = config.app.corsAllowedOrigins;

      // Allow same-origin server calls, curl/Postman, and webhook traffic without an Origin header.
      if (!origin || allowedOrigins.length === 0 || isCorsOriginAllowed(origin, allowedOrigins)) {
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
    res.json({
      ok: true,
      mode: process.env.NODE_ENV === "production" ? "INVITE_ONLY_PILOT" : "DEVELOPMENT",
      automatedSettlement: config.oracle.schedulerEnabled,
      publicFeatures: {
        s1: config.pilot.s1PublicApiEnabled,
        track2: config.pilot.track2Enabled,
        track3: config.pilot.track3Enabled,
        engagementRewards: config.pilot.engagementRewardsEnabled,
        managedWalletExecution: config.managedWallet.publicExecutionEnabled,
        ephemeralSessions: config.managedWallet.ephemeralSessionsEnabled,
      },
    });
  });

  app.use("/api", routes);

  return app;
};

import cors from "cors";
import express, { type Application, type RequestHandler } from "express";

import { config } from "../config/default";
import routes from "./routes";
import {
  appStartupReadiness,
  type StartupReadiness,
} from "./services/startupReadiness";

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

const isControlPlanePath = (path: string): boolean =>
  path === "/health" ||
  path === "/ready" ||
  path === "/api/v1/internal" ||
  path.startsWith("/api/v1/internal/");

const createControlPlaneHeadersMiddleware = (): RequestHandler =>
  (req, res, next) => {
    if (isControlPlanePath(req.path)) {
      res.set("Cache-Control", "no-store");
      res.set("Surrogate-Control", "no-store");
    }

    next();
  };

export const buildHealthPayload = () => {
  const invitePolicyConfigured =
    config.pilot.inviteOnly && config.pilot.inviteWallets.length > 0;

  return {
    ok: true,
    releaseSha: config.app.releaseSha || null,
    mode: invitePolicyConfigured
      ? "INVITE_ONLY_PILOT"
      : config.pilot.inviteOnly
        ? "INVITE_POLICY_MISCONFIGURED"
        : "OPEN_DEVELOPMENT",
    automatedSettlement: config.oracle.schedulerEnabled,
    accessPolicy: {
      configured: invitePolicyConfigured,
      type: config.pilot.inviteOnly ? "invite_only" : "open",
    },
  };
};

export const createApp = (readiness: StartupReadiness = appStartupReadiness): Application => {
  const app = express();

  app.disable("x-powered-by");

  // Render terminates public HTTP at one reverse-proxy hop. Trust exactly that
  // hop so Express derives req.ip from the right-most untrusted address; rate
  // limiting code must never parse X-Forwarded-For on its own.
  app.set("trust proxy", 1);

  app.use(createControlPlaneHeadersMiddleware());
  app.use(createCorsMiddleware());
  app.use(createJsonMiddleware());

  app.get("/health", (_req, res) => {
    res.json(buildHealthPayload());
  });

  app.get("/ready", (_req, res) => {
    const payload = readiness.snapshot();
    res.status(payload.ok ? 200 : 503).json(payload);
  });

  app.use("/api", routes);

  return app;
};

import { NextFunction, Request, Response } from "express";

import { handleControllerError } from "../controllers/http";
import {
  acquireApiIdempotency,
  buildIdempotencyRequestHash,
  completeApiIdempotency,
  failApiIdempotency,
  IDEMPOTENCY_RESPONSE_MAX_BYTES,
  renewApiIdempotencyLease,
} from "../services/apiIdempotency";

export type DurableIdempotencyOptions = {
  scope: string;
  resourceParams?: string[];
  responseTtlMs?: number;
};

export type DurableIdempotencyDependencies = {
  acquire: typeof acquireApiIdempotency;
  complete: typeof completeApiIdempotency;
  fail: typeof failApiIdempotency;
  renew: typeof renewApiIdempotencyLease;
};

const defaultDependencies: DurableIdempotencyDependencies = {
  acquire: acquireApiIdempotency,
  complete: completeApiIdempotency,
  fail: failApiIdempotency,
  renew: renewApiIdempotencyLease,
};

export const buildIdempotencyScope = (
  params: Record<string, unknown>,
  options: DurableIdempotencyOptions
): string => {
  const resource = (options.resourceParams ?? []).map((name) => {
    const value = String(params[name] ?? "").trim();
    return `${name}=${value}`;
  });
  return resource.length > 0 ? `${options.scope}:${resource.join(":")}` : options.scope;
};

const responseErrorCode = (body: unknown): string => {
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const code = (error as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) {
        return code.trim();
      }
    }
  }
  return "REQUEST_FAILED";
};

export const durableApiIdempotency = (
  options: DurableIdempotencyOptions,
  dependencies: DurableIdempotencyDependencies = defaultDependencies
) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wallet = req.auth?.source === "session" ? req.auth.wallet : null;
      if (!wallet) {
        throw new Error("durable idempotency requires session authentication first");
      }
      const key = String(req.header("x-idempotency-key") ?? "").trim();
      const scope = buildIdempotencyScope(req.params, options);
      const requestHash = buildIdempotencyRequestHash({
        method: req.method,
        scope,
        body: req.body,
      });
      const acquired = await dependencies.acquire({
        wallet,
        method: req.method,
        scope,
        key,
        requestHash,
      });

      if (acquired.kind === "REPLAY") {
        res.set("Idempotency-Replayed", "true");
        res.status(acquired.status).json(acquired.body);
        return;
      }

      req.idempotency = acquired.execution;
      const originalJson = res.json.bind(res);
      const heartbeat = setInterval(() => {
        void dependencies.renew(acquired.execution).catch(() => undefined);
      }, 30_000);
      heartbeat.unref();
      const stopHeartbeat = () => clearInterval(heartbeat);
      res.once("close", stopHeartbeat);
      res.once("finish", stopHeartbeat);
      let responseStarted = false;
      res.json = ((body: unknown) => {
        if (responseStarted) {
          return res;
        }
        responseStarted = true;
        const intendedStatus = res.statusCode;
        let serialized: string | null = null;
        try {
          serialized = body === undefined ? null : JSON.stringify(body);
        } catch (_error) {
          serialized = null;
        }
        const responseSizeBytes = serialized === null ? 0 : Buffer.byteLength(serialized);
        void (async () => {
          if (
            intendedStatus >= 200 &&
            intendedStatus < 300 &&
            serialized !== null &&
            responseSizeBytes <= IDEMPOTENCY_RESPONSE_MAX_BYTES
          ) {
            try {
              await dependencies.complete({
                execution: acquired.execution,
                responseStatus: intendedStatus,
                responseBody: JSON.parse(serialized),
                responseSizeBytes,
                responseTtlMs: options.responseTtlMs,
              });
              originalJson(body);
              return;
            } catch (_error) {
              await dependencies.fail({
                execution: acquired.execution,
                errorCode: "IDEMPOTENCY_COMMIT_FAILED",
              }).catch(() => undefined);
              res.status(503);
              originalJson({
                ok: false,
                error: {
                  code: "IDEMPOTENCY_COMMIT_FAILED",
                  message: "request completed but its replay record could not be committed; retry with the same key",
                  details: null,
                },
              });
              return;
            }
          }

          const errorCode =
            responseSizeBytes > IDEMPOTENCY_RESPONSE_MAX_BYTES
              ? "IDEMPOTENCY_RESPONSE_TOO_LARGE"
              : responseErrorCode(body);
          await dependencies.fail({
            execution: acquired.execution,
            errorCode,
          }).catch(() => undefined);
          if (intendedStatus >= 200 && intendedStatus < 300) {
            res.status(503);
            originalJson({
              ok: false,
              error: {
                code: errorCode,
                message: "response could not be stored safely for idempotent replay",
                details: null,
              },
            });
            return;
          }
          originalJson(body);
        })();
        return res;
      }) as Response["json"];

      next();
    } catch (error) {
      handleControllerError(res, error, "IDEMPOTENCY_ACQUIRE_FAILED");
    }
  };

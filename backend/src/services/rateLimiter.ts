import { HttpError } from "../controllers/http";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const assertRateLimit = (params: {
  key: string;
  limit: number;
  windowMs: number;
  code: string;
  message: string;
}): void => {
  if (params.limit <= 0 || params.windowMs <= 0) {
    return;
  }

  const now = Date.now();
  const existing = buckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, {
      count: 1,
      resetAt: now + params.windowMs,
    });
    return;
  }

  existing.count += 1;
  if (existing.count > params.limit) {
    throw new HttpError(429, params.code, params.message, {
      retryAfterMs: existing.resetAt - now,
    });
  }
};

export const getClientIp = (req: {
  ip?: string;
  header(name: string): string | undefined;
}): string => {
  const forwardedFor = String(req.header("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim();
  return forwardedFor || req.ip || "unknown";
};

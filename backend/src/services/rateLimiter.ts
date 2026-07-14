import { HttpError } from "../controllers/http";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

const removeExpiredBuckets = (now: number): void => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const makeRoomForBucket = (now: number): boolean => {
  if (buckets.size < MAX_BUCKETS) {
    return true;
  }

  removeExpiredBuckets(now);
  if (buckets.size < MAX_BUCKETS) {
    return true;
  }

  return false;
};

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
    if (!existing && !makeRoomForBucket(now)) {
      throw new HttpError(429, params.code, params.message, {
        retryAfterMs: params.windowMs,
      });
    }
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
}): string => {
  // Express computes req.ip according to the app's trust-proxy boundary. Reading
  // X-Forwarded-For directly here would let a caller choose its own rate-limit key.
  return String(req.ip ?? "").trim() || "unknown";
};

export const resetRateLimiterForTests = (): void => {
  buckets.clear();
};

export const getRateLimiterBucketCountForTests = (): number => buckets.size;

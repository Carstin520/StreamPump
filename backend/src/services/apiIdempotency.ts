import { ApiIdempotencyRecord, ApiIdempotencyStatus, Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { Request } from "express";

import { HttpError, isUniqueConstraintError } from "../controllers/http";
import { prisma } from "./prisma";

export const IDEMPOTENCY_LEASE_MS = 90_000;
export const IDEMPOTENCY_RESPONSE_MAX_BYTES = 512 * 1024;

type ExistingRecordDecision =
  | { kind: "CONFLICT" }
  | { kind: "IN_PROGRESS" }
  | { kind: "REPLAY" }
  | { kind: "REACQUIRE" };

export type IdempotencyExecution = {
  recordId: string;
  leaseToken: string;
  resourceType: string | null;
  resourceId: string | null;
};

export type IdempotencyAcquireResult =
  | { kind: "EXECUTE"; execution: IdempotencyExecution }
  | { kind: "REPLAY"; status: number; body: Prisma.JsonValue };

const stableValue = (value: unknown): unknown => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return String(value);
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const hashIdempotencyKey = (key: string): string => sha256(key);

export const buildIdempotencyRequestHash = (params: {
  method: string;
  scope: string;
  body: unknown;
}): string =>
  sha256(
    JSON.stringify(
      stableValue({
        method: params.method.toUpperCase(),
        scope: params.scope,
        body: params.body ?? null,
      })
    )
  );

export const decideExistingIdempotencyRecord = (params: {
  record: Pick<
    ApiIdempotencyRecord,
    "requestHash" | "status" | "leaseExpiresAt" | "responseExpiresAt" | "responseStatus" | "responseBody"
  >;
  requestHash: string;
  now: Date;
}): ExistingRecordDecision => {
  if (params.record.requestHash !== params.requestHash) {
    return { kind: "CONFLICT" };
  }
  if (params.record.status === ApiIdempotencyStatus.SUCCEEDED) {
    if (
      params.record.responseExpiresAt &&
      params.record.responseExpiresAt.getTime() <= params.now.getTime()
    ) {
      return { kind: "REACQUIRE" };
    }
    if (params.record.responseStatus !== null && params.record.responseBody !== null) {
      return { kind: "REPLAY" };
    }
    return { kind: "REACQUIRE" };
  }
  if (
    params.record.status === ApiIdempotencyStatus.IN_PROGRESS &&
    params.record.leaseExpiresAt &&
    params.record.leaseExpiresAt.getTime() > params.now.getTime()
  ) {
    return { kind: "IN_PROGRESS" };
  }
  return { kind: "REACQUIRE" };
};

export const shouldPreserveBoundResourceOnReacquire = (
  status: ApiIdempotencyStatus
): boolean => status !== ApiIdempotencyStatus.SUCCEEDED;

const executionFromRecord = (
  record: Pick<ApiIdempotencyRecord, "id" | "leaseToken" | "resourceType" | "resourceId">
): IdempotencyExecution => {
  if (!record.leaseToken) {
    throw new Error("idempotency lease token is missing");
  }
  return {
    recordId: record.id,
    leaseToken: record.leaseToken,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
  };
};

export const acquireApiIdempotency = async (params: {
  wallet: string;
  method: string;
  scope: string;
  key: string;
  requestHash: string;
  now?: Date;
}): Promise<IdempotencyAcquireResult> => {
  const now = params.now ?? new Date();
  const key = params.key.trim();
  if (!key || key.length > 200) {
    throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "x-idempotency-key must be 1-200 characters");
  }
  const identity = {
    wallet: params.wallet,
    method: params.method.toUpperCase(),
    scope: params.scope,
    keyHash: hashIdempotencyKey(key),
  };
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + IDEMPOTENCY_LEASE_MS);

  try {
    const created = await prisma.apiIdempotencyRecord.create({
      data: {
        ...identity,
        requestHash: params.requestHash,
        leaseToken,
        leaseExpiresAt,
      },
    });
    return { kind: "EXECUTE", execution: executionFromRecord(created) };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await prisma.apiIdempotencyRecord.findUnique({
      where: { wallet_method_scope_keyHash: identity },
    });
    if (!existing) {
      throw new HttpError(503, "IDEMPOTENCY_STATE_UNAVAILABLE", "idempotency state is unavailable");
    }
    const decision = decideExistingIdempotencyRecord({
      record: existing,
      requestHash: params.requestHash,
      now,
    });
    if (decision.kind === "CONFLICT") {
      throw new HttpError(
        409,
        "IDEMPOTENCY_PAYLOAD_CONFLICT",
        "x-idempotency-key was already used with a different request payload"
      );
    }
    if (decision.kind === "IN_PROGRESS") {
      throw new HttpError(409, "IDEMPOTENCY_IN_PROGRESS", "an identical request is still in progress");
    }
    if (decision.kind === "REPLAY") {
      return {
        kind: "REPLAY",
        status: existing.responseStatus as number,
        body: existing.responseBody as Prisma.JsonValue,
      };
    }

    const reacquired = await prisma.apiIdempotencyRecord.updateMany({
      where: {
        id: existing.id,
        requestHash: params.requestHash,
        OR: [
          { status: ApiIdempotencyStatus.FAILED },
          {
            status: ApiIdempotencyStatus.IN_PROGRESS,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          },
          {
            status: ApiIdempotencyStatus.SUCCEEDED,
            responseExpiresAt: { lte: now },
          },
        ],
      },
      data: {
        status: ApiIdempotencyStatus.IN_PROGRESS,
        leaseToken,
        leaseExpiresAt,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        responseSizeBytes: null,
        responseExpiresAt: null,
        lastErrorCode: null,
        completedAt: null,
        attemptCount: { increment: 1 },
        ...(!shouldPreserveBoundResourceOnReacquire(existing.status)
          ? { resourceType: null, resourceId: null }
          : {}),
      },
    });
    if (reacquired.count === 1) {
      const refreshed = await prisma.apiIdempotencyRecord.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return { kind: "EXECUTE", execution: executionFromRecord(refreshed) };
    }
  }

  throw new HttpError(409, "IDEMPOTENCY_IN_PROGRESS", "an identical request is still in progress");
};

export const renewApiIdempotencyLease = async (execution: IdempotencyExecution): Promise<void> => {
  await prisma.apiIdempotencyRecord.updateMany({
    where: {
      id: execution.recordId,
      leaseToken: execution.leaseToken,
      status: ApiIdempotencyStatus.IN_PROGRESS,
    },
    data: {
      leaseExpiresAt: new Date(Date.now() + IDEMPOTENCY_LEASE_MS),
    },
  });
};

export const completeApiIdempotency = async (params: {
  execution: IdempotencyExecution;
  responseStatus: number;
  responseBody: Prisma.InputJsonValue;
  responseSizeBytes: number;
  responseTtlMs?: number;
}): Promise<void> => {
  const now = new Date();
  const completed = await prisma.apiIdempotencyRecord.updateMany({
    where: {
      id: params.execution.recordId,
      leaseToken: params.execution.leaseToken,
      status: ApiIdempotencyStatus.IN_PROGRESS,
    },
    data: {
      status: ApiIdempotencyStatus.SUCCEEDED,
      leaseToken: null,
      leaseExpiresAt: null,
      responseStatus: params.responseStatus,
      responseBody: params.responseBody,
      responseSizeBytes: params.responseSizeBytes,
      responseExpiresAt: params.responseTtlMs
        ? new Date(now.getTime() + params.responseTtlMs)
        : null,
      completedAt: now,
      lastErrorCode: null,
    },
  });
  if (completed.count !== 1) {
    throw new Error("idempotency success record lost its active lease");
  }
};

export const failApiIdempotency = async (params: {
  execution: IdempotencyExecution;
  errorCode: string;
}): Promise<void> => {
  await prisma.apiIdempotencyRecord.updateMany({
    where: {
      id: params.execution.recordId,
      leaseToken: params.execution.leaseToken,
      status: ApiIdempotencyStatus.IN_PROGRESS,
    },
    data: {
      status: ApiIdempotencyStatus.FAILED,
      leaseToken: null,
      leaseExpiresAt: null,
      responseStatus: null,
      responseBody: Prisma.DbNull,
      responseSizeBytes: null,
      responseExpiresAt: null,
      completedAt: null,
      lastErrorCode: params.errorCode.slice(0, 120),
    },
  });
};

export const bindApiIdempotencyResource = async (
  tx: Prisma.TransactionClient,
  req: Request,
  resourceType: string,
  resourceId: string
): Promise<void> => {
  const execution = req.idempotency;
  if (!execution) {
    return;
  }
  const bound = await tx.apiIdempotencyRecord.updateMany({
    where: {
      id: execution.recordId,
      leaseToken: execution.leaseToken,
      status: ApiIdempotencyStatus.IN_PROGRESS,
    },
    data: { resourceType, resourceId },
  });
  if (bound.count !== 1) {
    throw new HttpError(409, "IDEMPOTENCY_LEASE_LOST", "idempotency lease was lost");
  }
  execution.resourceType = resourceType;
  execution.resourceId = resourceId;
};

export const getRecoveredIdempotencyResourceId = (
  req: Request,
  resourceType: string
): string | null =>
  req.idempotency?.resourceType === resourceType ? req.idempotency.resourceId : null;

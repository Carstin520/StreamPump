/**
 * CN: HTTP 控制器通用工具，统一解析参数、抛出业务错误并格式化响应。
 * EN: Shared HTTP controller helpers for parsing input, throwing business errors, and formatting responses.
 */
import { Prisma } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";
import { Request, Response } from "express";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const ok = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json({
    ok: true,
    data,
  });
};

export const fail = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): void => {
  res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      details: details ?? null,
    },
  });
};

export const handleControllerError = (res: Response, error: unknown, fallback: string): void => {
  if (error instanceof HttpError) {
    fail(res, error.status, error.code, error.message, error.details);
    return;
  }

  fail(res, 500, fallback, error instanceof Error ? error.message : fallback);
};

export const parseWallet = (value: unknown, fieldName: string): string => {
  const wallet = String(value ?? "").trim();
  if (!wallet) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
  }

  try {
    return new PublicKey(wallet).toBase58();
  } catch (_error) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} is not a valid Solana public key`);
  }
};

export const parseOptionalWallet = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return parseWallet(value, fieldName);
};

export const parseWalletFromRequest = (
  req: Request,
  headerName: string,
  bodyField: string
): string => {
  return parseWallet(req.header(headerName) ?? req.body[bodyField], bodyField);
};

export const parseNonEmptyString = (value: unknown, fieldName: string): string => {
  const parsed = String(value ?? "").trim();
  if (!parsed) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
  }

  return parsed;
};

export const parseOptionalString = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim();
  return parsed ? parsed : null;
};

export const parseSha256Hex = (value: unknown, fieldName: string): string => {
  const parsed = parseNonEmptyString(value, fieldName).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a 64-character SHA-256 hex`);
  }

  return parsed;
};

export const parseNonNegativeInt = (value: unknown, fieldName: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

export const parsePositiveInt = (value: unknown, fieldName: string): number => {
  const parsed = parseNonNegativeInt(value, fieldName);
  if (parsed <= 0) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be greater than 0`);
  }

  return parsed;
};

export const parseNonNegativeBigInt = (value: unknown, fieldName: string): bigint => {
  if (value === undefined || value === null || value === "") {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} is required`);
  }

  let parsed: bigint;
  try {
    parsed = BigInt(String(value));
  } catch (_error) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be an integer`);
  }

  if (parsed < 0n) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be non-negative`);
  }

  return parsed;
};

export const parseStringArray = (value: unknown, fieldName: string): string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be an array`);
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
};

export const parseOptionalJsonObject = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }

  throw new HttpError(400, "INVALID_INPUT", "metadata must be a JSON object");
};

export const ensureIdempotencyKey = (req: Request): string => {
  return parseNonEmptyString(req.header("x-idempotency-key"), "x-idempotency-key");
};

export const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

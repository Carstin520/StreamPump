CREATE TYPE "ApiIdempotencyStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED');

CREATE TABLE "ApiIdempotencyRecord" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "ApiIdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "resourceType" TEXT,
  "resourceId" TEXT,
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "responseSizeBytes" INTEGER,
  "responseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiIdempotencyRecord_wallet_method_scope_keyHash_key"
  ON "ApiIdempotencyRecord"("wallet", "method", "scope", "keyHash");
CREATE INDEX "ApiIdempotencyRecord_status_leaseExpiresAt_idx"
  ON "ApiIdempotencyRecord"("status", "leaseExpiresAt");
CREATE INDEX "ApiIdempotencyRecord_resourceType_resourceId_idx"
  ON "ApiIdempotencyRecord"("resourceType", "resourceId");

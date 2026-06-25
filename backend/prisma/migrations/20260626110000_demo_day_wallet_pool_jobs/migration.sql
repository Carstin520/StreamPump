-- Demo-day managed wallet pool and async execution queue.
CREATE TYPE "ManagedWalletPoolStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'USED');

CREATE TYPE "ManagedWalletJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "AccountWallet"
  ADD COLUMN "poolStatus" "ManagedWalletPoolStatus",
  ADD COLUMN "poolSubjectHash" TEXT,
  ADD COLUMN "poolAssignedAt" TIMESTAMP(3),
  ADD COLUMN "poolUsedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AccountWallet_poolSubjectHash_key"
  ON "AccountWallet"("poolSubjectHash");

CREATE INDEX "AccountWallet_walletType_poolStatus_idx"
  ON "AccountWallet"("walletType", "poolStatus");

CREATE TABLE "ManagedWalletExecutionJob" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "sessionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "params" JSONB,
  "status" "ManagedWalletJobStatus" NOT NULL DEFAULT 'QUEUED',
  "signature" TEXT,
  "projectionSync" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManagedWalletExecutionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedWalletExecutionJob_wallet_idempotencyKey_key"
  ON "ManagedWalletExecutionJob"("wallet", "idempotencyKey");

CREATE INDEX "ManagedWalletExecutionJob_status_queuedAt_idx"
  ON "ManagedWalletExecutionJob"("status", "queuedAt");

CREATE INDEX "ManagedWalletExecutionJob_wallet_createdAt_idx"
  ON "ManagedWalletExecutionJob"("wallet", "createdAt");

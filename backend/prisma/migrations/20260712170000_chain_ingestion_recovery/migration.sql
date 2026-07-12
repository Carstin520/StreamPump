CREATE TYPE "ChainIngestionStatus" AS ENUM (
  'PROCESSING',
  'NOT_FOUND',
  'PRUNED',
  'TRANSACTION_FAILED',
  'NO_PROGRAM_INSTRUCTIONS',
  'SYNCED',
  'ERROR'
);

CREATE TABLE "ChainIngestionAttempt" (
  "id" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "slot" BIGINT,
  "status" "ChainIngestionStatus" NOT NULL DEFAULT 'PROCESSING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "instructionCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChainIngestionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChainIngestionAttempt_signature_key"
  ON "ChainIngestionAttempt"("signature");
CREATE INDEX "ChainIngestionAttempt_status_updatedAt_idx"
  ON "ChainIngestionAttempt"("status", "updatedAt");
CREATE INDEX "ChainIngestionAttempt_slot_idx"
  ON "ChainIngestionAttempt"("slot");

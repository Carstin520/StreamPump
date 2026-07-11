-- Durable, single-operation audit record for operator-controlled Track 1 settlement.
CREATE TYPE "SettlementTrack" AS ENUM ('TRACK1');
CREATE TYPE "Track1SettlementOperationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

CREATE TABLE "Track1SettlementOperation" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "proposalPda" TEXT NOT NULL,
    "track" "SettlementTrack" NOT NULL DEFAULT 'TRACK1',
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "operatorIdentity" TEXT NOT NULL,
    "evidenceDigest" TEXT NOT NULL,
    "status" "Track1SettlementOperationStatus" NOT NULL DEFAULT 'PENDING',
    "txSignature" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track1SettlementOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Track1SettlementOperation_idempotencyKey_idx"
ON "Track1SettlementOperation"("idempotencyKey");

CREATE UNIQUE INDEX "Track1SettlementOperation_proposalPda_track_key"
ON "Track1SettlementOperation"("proposalPda", "track");

CREATE INDEX "Track1SettlementOperation_status_updatedAt_idx"
ON "Track1SettlementOperation"("status", "updatedAt");

CREATE INDEX "Track1SettlementOperation_proposalId_createdAt_idx"
ON "Track1SettlementOperation"("proposalId", "createdAt");

ALTER TABLE "Track1SettlementOperation"
ADD CONSTRAINT "Track1SettlementOperation_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('OPEN', 'FUNDED', 'RESOLVED_SUCCESS', 'RESOLVED_FAIL', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "Track2MetricType" AS ENUM ('VIEWS', 'CLICKS', 'SAVES');

-- CreateEnum
CREATE TYPE "OracleSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('ACCEPTED', 'REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "proposalPda" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "sponsorWallet" TEXT,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'OPEN',
    "track1BaseUsdc" BIGINT NOT NULL,
    "track1Claimed" BOOLEAN NOT NULL DEFAULT false,
    "track2MetricType" "Track2MetricType" NOT NULL,
    "track2TargetValue" BIGINT NOT NULL,
    "track2MinAchievementBps" INTEGER NOT NULL,
    "track2UsdcDeposited" BIGINT NOT NULL,
    "track2ActualValue" BIGINT,
    "track2SettledAt" TIMESTAMP(3),
    "track3UsdcDeposited" BIGINT NOT NULL,
    "track3CpsPayout" BIGINT,
    "track3DelayDays" INTEGER NOT NULL,
    "track3SettledAt" TIMESTAMP(3),
    "onChainTxSignature" TEXT,
    "oracleSyncStatus" "OracleSyncStatus" NOT NULL DEFAULT 'PENDING',
    "oracleLastError" TEXT,
    "contentPublishedVerifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoContent" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "proposalId" TEXT,
    "s3ObjectKey" TEXT NOT NULL,
    "videoUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "durationSeconds" INTEGER,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "onChainAnchorTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track2Event" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "eventType" "Track2MetricType" NOT NULL,
    "externalEventId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "fraudStatus" "FraudStatus" NOT NULL DEFAULT 'ACCEPTED',
    "fraudScore" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track2Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalPda_key" ON "Proposal"("proposalPda");

-- CreateIndex
CREATE INDEX "Proposal_status_track1Claimed_idx" ON "Proposal"("status", "track1Claimed");

-- CreateIndex
CREATE INDEX "Proposal_status_deadlineAt_track2SettledAt_idx" ON "Proposal"("status", "deadlineAt", "track2SettledAt");

-- CreateIndex
CREATE INDEX "Proposal_deadlineAt_track3DelayDays_track3SettledAt_idx" ON "Proposal"("deadlineAt", "track3DelayDays", "track3SettledAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoContent_proposalId_key" ON "VideoContent"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoContent_s3ObjectKey_key" ON "VideoContent"("s3ObjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "VideoContent_contentHash_key" ON "VideoContent"("contentHash");

-- CreateIndex
CREATE INDEX "VideoContent_creatorWallet_idx" ON "VideoContent"("creatorWallet");

-- CreateIndex
CREATE UNIQUE INDEX "Track2Event_dedupeKey_key" ON "Track2Event"("dedupeKey");

-- CreateIndex
CREATE INDEX "Track2Event_proposalId_eventType_fraudStatus_idx" ON "Track2Event"("proposalId", "eventType", "fraudStatus");

-- CreateIndex
CREATE INDEX "Track2Event_proposalId_occurredAt_idx" ON "Track2Event"("proposalId", "occurredAt");

-- AddForeignKey
ALTER TABLE "VideoContent" ADD CONSTRAINT "VideoContent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track2Event" ADD CONSTRAINT "Track2Event_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


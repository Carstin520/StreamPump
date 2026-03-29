-- CN: 为 Mux reconciliation 与链上 Phase A indexer 增加状态字段和持久化表。
-- EN: Adds state fields and persistence tables for Mux reconciliation and the Phase A chain indexer.

CREATE TYPE "AssetProcessingSource" AS ENUM ('CLIENT_COMPLETE', 'MUX_WEBHOOK', 'MUX_RECONCILIATION');

ALTER TABLE "ContentAsset"
ADD COLUMN "muxLastKnownStatus" TEXT,
ADD COLUMN "muxWebhookReceivedAt" TIMESTAMP(3),
ADD COLUMN "muxLastCheckedAt" TIMESTAMP(3),
ADD COLUMN "muxReconcileAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "muxReadyAt" TIMESTAMP(3),
ADD COLUMN "processingSource" "AssetProcessingSource";

CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "instructionIndex" INTEGER NOT NULL,
    "slot" BIGINT NOT NULL,
    "programId" TEXT NOT NULL,
    "instructionName" TEXT NOT NULL,
    "proposalPda" TEXT,
    "entityPda" TEXT,
    "payloadJson" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndexerCursor" (
    "consumerKey" TEXT NOT NULL,
    "lastSeenSlot" BIGINT NOT NULL DEFAULT 0,
    "lastSeenSignature" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("consumerKey")
);

CREATE UNIQUE INDEX "ChainEvent_signature_instructionIndex_key" ON "ChainEvent"("signature", "instructionIndex");
CREATE INDEX "ChainEvent_proposalPda_observedAt_idx" ON "ChainEvent"("proposalPda", "observedAt");
CREATE INDEX "ChainEvent_instructionName_observedAt_idx" ON "ChainEvent"("instructionName", "observedAt");

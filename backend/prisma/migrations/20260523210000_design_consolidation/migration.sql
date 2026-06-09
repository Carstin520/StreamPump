-- Design consolidation migration
-- Merges CampaignProofProjection into Proposal, adds extensibility fields,
-- and creates new audit/wallet models.

-- 1. Proposal: add merged proof fields + endorsement aggregation
ALTER TABLE "Proposal" ADD COLUMN "proofStatus" "CampaignProofStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Proposal" ADD COLUMN "fundingTxSignature" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "latestSettlementTxSignature" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "endorserCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Proposal" ADD COLUMN "totalSpumpStaked" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Proposal" ADD COLUMN "claimedEndorserCount" INTEGER NOT NULL DEFAULT 0;

-- 2. ProposalIntent: add nonce and maxEndorsementSpump
ALTER TABLE "ProposalIntent" ADD COLUMN "nonce" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ProposalIntent" ADD COLUMN "maxEndorsementSpump" BIGINT NOT NULL DEFAULT 0;

-- 3. S2EndorsementPositionProjection: add withdrawal/partial-unstake extensibility
ALTER TABLE "S2EndorsementPositionProjection" ADD COLUMN "withdrawnSpumpAmount" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "S2EndorsementPositionProjection" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "S2EndorsementPositionProjection" ADD COLUMN "penaltySpumpAmount" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "S2EndorsementPositionProjection" ADD COLUMN "partialUnstakeCount" INTEGER NOT NULL DEFAULT 0;

-- 4. Track2Event: add reviewer identity and audit trail
ALTER TABLE "Track2Event" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "Track2Event" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Track2Event" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Track2Event" ADD COLUMN "reviewSource" TEXT;

-- 5. SponsorReviewEvent: KYB audit trail model
CREATE TABLE "SponsorReviewEvent" (
    "id" TEXT NOT NULL,
    "sponsorProfileId" TEXT NOT NULL,
    "reviewerWallet" TEXT NOT NULL,
    "previousStatus" "SponsorVerificationStatus" NOT NULL,
    "newStatus" "SponsorVerificationStatus" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "documentSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SponsorReviewEvent_sponsorProfileId_createdAt_idx" ON "SponsorReviewEvent"("sponsorProfileId", "createdAt");
CREATE INDEX "SponsorReviewEvent_reviewerWallet_idx" ON "SponsorReviewEvent"("reviewerWallet");

ALTER TABLE "SponsorReviewEvent" ADD CONSTRAINT "SponsorReviewEvent_sponsorProfileId_fkey"
    FOREIGN KEY ("sponsorProfileId") REFERENCES "SponsorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. WalletType enum and AccountWallet model
CREATE TYPE "WalletType" AS ENUM ('MANAGED', 'EXTERNAL');

CREATE TABLE "AccountWallet" (
    "id" TEXT NOT NULL,
    "accountProfileId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletType" "WalletType" NOT NULL DEFAULT 'MANAGED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountWallet_walletAddress_key" ON "AccountWallet"("walletAddress");
CREATE INDEX "AccountWallet_accountProfileId_idx" ON "AccountWallet"("accountProfileId");

ALTER TABLE "AccountWallet" ADD CONSTRAINT "AccountWallet_accountProfileId_fkey"
    FOREIGN KEY ("accountProfileId") REFERENCES "AccountProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Migrate existing CampaignProofProjection data to Proposal before dropping
UPDATE "Proposal" p
SET
    "proofStatus" = cpp."proofStatus",
    "fundingTxSignature" = cpp."fundingTxSignature",
    "latestSettlementTxSignature" = cpp."latestSettlementTxSignature"
FROM "CampaignProofProjection" cpp
WHERE p."proposalPda" = cpp."proposalPda";

-- 8. Drop CampaignProofProjection table
DROP TABLE IF EXISTS "CampaignProofProjection";

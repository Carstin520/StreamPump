-- CreateEnum
CREATE TYPE "MarketCreatorStage" AS ENUM ('S1_DISCOVERY', 'S1_BUYOUT', 'S2_ACTIVE');

-- CreateEnum
CREATE TYPE "BuyoutOfferProjectionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'CANCELLED', 'RECLAIMED');

-- CreateEnum
CREATE TYPE "BuyoutProjectionStatus" AS ENUM ('NONE', 'AUCTION_OPEN', 'OFFER_ACCEPTED', 'RAGE_QUIT_OPEN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "CampaignProofStatus" AS ENUM ('DRAFT', 'FUNDED', 'ANCHORED', 'SETTLING', 'SETTLED', 'CANCELLED', 'VOIDED');

-- CreateTable
CREATE TABLE "CreatorMarketProjection" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "creatorProfilePda" TEXT NOT NULL,
    "handle" TEXT,
    "displayName" TEXT,
    "stage" "MarketCreatorStage" NOT NULL DEFAULT 'S1_DISCOVERY',
    "level" INTEGER NOT NULL DEFAULT 1,
    "s1Supply" BIGINT NOT NULL DEFAULT 0,
    "currentPriceSpump" BIGINT NOT NULL DEFAULT 0,
    "nextPriceSpump" BIGINT NOT NULL DEFAULT 0,
    "supporterPoolSpump" BIGINT NOT NULL DEFAULT 0,
    "holderCount" INTEGER NOT NULL DEFAULT 0,
    "graduationProgressBps" INTEGER NOT NULL DEFAULT 0,
    "activeCampaignCount" INTEGER NOT NULL DEFAULT 0,
    "latestBuyoutOfferUsdc" BIGINT,
    "acceptedBuyoutOfferUsdc" BIGINT,
    "buyoutStatePda" TEXT,
    "lastEventSignature" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorMarketProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "S1PositionProjection" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "creatorWallet" TEXT,
    "creatorProfilePda" TEXT NOT NULL,
    "positionPda" TEXT NOT NULL,
    "internalTokenBalance" BIGINT NOT NULL DEFAULT 0,
    "spumpCostBasis" BIGINT NOT NULL DEFAULT 0,
    "estimatedClaimableUsdc" BIGINT,
    "lastEventSignature" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "S1PositionProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "S1BuyoutOfferProjection" (
    "id" TEXT NOT NULL,
    "buyoutOfferPda" TEXT NOT NULL,
    "creatorWallet" TEXT,
    "creatorProfilePda" TEXT NOT NULL,
    "sponsorWallet" TEXT NOT NULL,
    "usdcAmount" BIGINT NOT NULL,
    "status" "BuyoutOfferProjectionStatus" NOT NULL DEFAULT 'OPEN',
    "createdOnChainAt" TIMESTAMP(3),
    "sponsorCancelAfterAt" TIMESTAMP(3),
    "lastEventSignature" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "S1BuyoutOfferProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "S1BuyoutProjection" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT,
    "creatorProfilePda" TEXT NOT NULL,
    "buyoutStatePda" TEXT,
    "status" "BuyoutProjectionStatus" NOT NULL DEFAULT 'NONE',
    "winningSponsorWallet" TEXT,
    "acceptedOfferPda" TEXT,
    "acceptedOfferUsdc" BIGINT,
    "latestOfferPda" TEXT,
    "latestOfferUsdc" BIGINT,
    "usdcDeposited" BIGINT NOT NULL DEFAULT 0,
    "claimableUsdcRemaining" BIGINT NOT NULL DEFAULT 0,
    "claimableS1SupplyRemaining" BIGINT NOT NULL DEFAULT 0,
    "rageQuitDeadlineAt" TIMESTAMP(3),
    "lastEventSignature" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "S1BuyoutProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignProofProjection" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT,
    "proposalPda" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "sponsorWallet" TEXT,
    "manifestId" TEXT,
    "intentId" TEXT,
    "status" "ProposalStatus" NOT NULL,
    "proofStatus" "CampaignProofStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHashHex" TEXT,
    "contentAnchorPda" TEXT,
    "contentAnchorTx" TEXT,
    "fundingTxSignature" TEXT,
    "latestSettlementTxSignature" TEXT,
    "track1BaseUsdc" BIGINT NOT NULL DEFAULT 0,
    "track2UsdcDeposited" BIGINT NOT NULL DEFAULT 0,
    "track3UsdcDeposited" BIGINT NOT NULL DEFAULT 0,
    "track2MetricType" "Track2MetricType" NOT NULL,
    "track2TargetValue" BIGINT NOT NULL DEFAULT 0,
    "track2ActualValue" BIGINT,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignProofProjection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorMarketProjection_creatorWallet_key" ON "CreatorMarketProjection"("creatorWallet");
CREATE UNIQUE INDEX "CreatorMarketProjection_creatorProfilePda_key" ON "CreatorMarketProjection"("creatorProfilePda");
CREATE INDEX "CreatorMarketProjection_stage_updatedAt_idx" ON "CreatorMarketProjection"("stage", "updatedAt");
CREATE INDEX "CreatorMarketProjection_creatorProfilePda_idx" ON "CreatorMarketProjection"("creatorProfilePda");

-- CreateIndex
CREATE UNIQUE INDEX "S1PositionProjection_positionPda_key" ON "S1PositionProjection"("positionPda");
CREATE UNIQUE INDEX "S1PositionProjection_userWallet_creatorProfilePda_key" ON "S1PositionProjection"("userWallet", "creatorProfilePda");
CREATE INDEX "S1PositionProjection_creatorWallet_idx" ON "S1PositionProjection"("creatorWallet");
CREATE INDEX "S1PositionProjection_userWallet_idx" ON "S1PositionProjection"("userWallet");

-- CreateIndex
CREATE UNIQUE INDEX "S1BuyoutOfferProjection_buyoutOfferPda_key" ON "S1BuyoutOfferProjection"("buyoutOfferPda");
CREATE INDEX "S1BuyoutOfferProjection_creatorProfilePda_status_idx" ON "S1BuyoutOfferProjection"("creatorProfilePda", "status");
CREATE INDEX "S1BuyoutOfferProjection_sponsorWallet_status_idx" ON "S1BuyoutOfferProjection"("sponsorWallet", "status");

-- CreateIndex
CREATE UNIQUE INDEX "S1BuyoutProjection_creatorProfilePda_key" ON "S1BuyoutProjection"("creatorProfilePda");
CREATE UNIQUE INDEX "S1BuyoutProjection_buyoutStatePda_key" ON "S1BuyoutProjection"("buyoutStatePda");
CREATE INDEX "S1BuyoutProjection_status_updatedAt_idx" ON "S1BuyoutProjection"("status", "updatedAt");
CREATE INDEX "S1BuyoutProjection_creatorWallet_idx" ON "S1BuyoutProjection"("creatorWallet");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignProofProjection_proposalId_key" ON "CampaignProofProjection"("proposalId");
CREATE UNIQUE INDEX "CampaignProofProjection_proposalPda_key" ON "CampaignProofProjection"("proposalPda");
CREATE INDEX "CampaignProofProjection_proofStatus_updatedAt_idx" ON "CampaignProofProjection"("proofStatus", "updatedAt");
CREATE INDEX "CampaignProofProjection_creatorWallet_updatedAt_idx" ON "CampaignProofProjection"("creatorWallet", "updatedAt");
CREATE INDEX "CampaignProofProjection_sponsorWallet_updatedAt_idx" ON "CampaignProofProjection"("sponsorWallet", "updatedAt");

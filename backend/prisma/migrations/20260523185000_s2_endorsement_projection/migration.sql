-- AlterTable
ALTER TABLE "Proposal"
ADD COLUMN "track2InitialFanPool" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "track2InitialSpumpStaked" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "S2EndorsementPositionProjection" (
    "id" TEXT NOT NULL,
    "positionPda" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "proposalPda" TEXT NOT NULL,
    "stakedSpumpAmount" BIGINT NOT NULL DEFAULT 0,
    "claimedStatus" BOOLEAN NOT NULL DEFAULT false,
    "estimatedUsdcReward" BIGINT NOT NULL DEFAULT 0,
    "lastEventSignature" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "S2EndorsementPositionProjection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "S2EndorsementPositionProjection_positionPda_key" ON "S2EndorsementPositionProjection"("positionPda");

-- CreateIndex
CREATE UNIQUE INDEX "S2EndorsementPositionProjection_userWallet_proposalPda_key" ON "S2EndorsementPositionProjection"("userWallet", "proposalPda");

-- CreateIndex
CREATE INDEX "S2EndorsementPositionProjection_proposalPda_claimedStatus_idx" ON "S2EndorsementPositionProjection"("proposalPda", "claimedStatus");

-- CreateIndex
CREATE INDEX "S2EndorsementPositionProjection_userWallet_updatedAt_idx" ON "S2EndorsementPositionProjection"("userWallet", "updatedAt");

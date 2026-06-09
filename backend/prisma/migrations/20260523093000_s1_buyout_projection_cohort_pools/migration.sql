-- AlterTable
ALTER TABLE "S1PositionProjection"
ADD COLUMN "earlyCohortBalance" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "S1BuyoutProjection"
ADD COLUMN "earlyClaimableUsdcRemaining" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "earlyClaimableS1SupplyRemaining" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "regularClaimableUsdcRemaining" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "regularClaimableS1SupplyRemaining" BIGINT NOT NULL DEFAULT 0;

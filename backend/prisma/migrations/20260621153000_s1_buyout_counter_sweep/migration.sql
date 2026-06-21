-- Adds projection fields for S1 on-chain holder counters and residual sweep
-- liveness. Production application requires explicit operator approval.

ALTER TABLE "CreatorMarketProjection"
  ADD COLUMN "s1EligibleHolderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "s1EarlyHolderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "s1RegularHolderCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "S1BuyoutProjection"
  ADD COLUMN "graduatedAt" TIMESTAMP(3),
  ADD COLUMN "residualSweptAt" TIMESTAMP(3),
  ADD COLUMN "residualSwept" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vaultClosed" BOOLEAN NOT NULL DEFAULT false;

-- Adds projection fields for capped, non-proportional S1 discovery rewards
-- and S2 Track2 endorsement rewards. Production application requires
-- explicit operator approval.

ALTER TABLE "Proposal"
  ADD COLUMN "track2RewardCapUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "track2ResidualTo" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "track2RewardModelSnapshot" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "S2EndorsementPositionProjection"
  ADD COLUMN "rewardCapUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "rewardCapped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fanPoolRemaining" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "residualTransferred" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "S1PositionProjection"
  ADD COLUMN "discoveryRewardClaimed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastDiscoveryRewardUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discoveryRewardCapped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "discoveryRewardEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "S1BuyoutProjection"
  ADD COLUMN "creatorPayoutUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discoveryPoolUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discoveryPoolRemaining" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "eligibleHolderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "earlyHolderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "regularHolderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rewardModelSnapshot" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "residualToSnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discoveryRewardCapUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "statusThankyouUsdc" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "creatorPaid" BOOLEAN NOT NULL DEFAULT false;

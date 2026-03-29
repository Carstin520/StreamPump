-- CN: Phase 1 launch bundle 增加 Track2 预算字段，供真实 sponsor_fund 交易组装使用。
-- EN: Add Track2 budget field for Phase 1 launch bundle assembly and real sponsor_fund execution.
ALTER TABLE "ProposalIntent"
ADD COLUMN "track2UsdcDeposited" BIGINT NOT NULL DEFAULT 0;

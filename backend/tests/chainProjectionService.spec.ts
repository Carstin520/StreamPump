import { CampaignProofStatus, ProposalStatus } from "@prisma/client";
import { expect } from "chai";

import {
  deriveProjectionTransactionSignatures,
  deriveProofStatus,
} from "../src/services/chainProjectionService";

describe("chainProjectionService Track 1 proof semantics", () => {
  it("marks a Track 1-only claimed proposal as settled", () => {
    expect(deriveProofStatus({
      status: ProposalStatus.FUNDED,
      track1Claimed: true,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
      track2SettledAt: null,
      track3SettledAt: null,
      contentAnchorPda: "anchor-pda",
    })).to.equal(CampaignProofStatus.SETTLED);
  });

  it("preserves funding truth while recording the latest settlement signature", () => {
    expect(deriveProjectionTransactionSignatures({
      instructionName: "settle_track1_base",
      signature: "settlement-signature",
      existingFundingTxSignature: "funding-signature",
      existingSettlementTxSignature: null,
    })).to.deep.equal({
      fundingTxSignature: "funding-signature",
      latestSettlementTxSignature: "settlement-signature",
    });
  });

  it("does not mislabel a funding event as a settlement", () => {
    expect(deriveProjectionTransactionSignatures({
      instructionName: "sponsor_fund",
      signature: "funding-signature",
      existingFundingTxSignature: null,
      existingSettlementTxSignature: "older-settlement-signature",
    })).to.deep.equal({
      fundingTxSignature: "funding-signature",
      latestSettlementTxSignature: "older-settlement-signature",
    });
  });
});

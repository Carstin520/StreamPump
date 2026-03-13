import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core S2 traffic market", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const upgraded = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(upgraded.level).to.equal(2);
    expect(ctx.enumKey(upgraded.status)).to.equal("s2Active");
  });

  it("settles track1 base + track2 success and allows fan claim", async () => {
    const track1Base = 100_000n;
    const track2Budget = 1_000_000n;
    const track3Budget = 300_000n;
    const track2Target = 1_000n;
    const stakeAmount = 200_000n;

    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target,
        track2MinAchievementBps: 5_000,
      });

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const creatorUsdcBeforeBase = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(stakeAmount) })
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.fanA])
      .rpc();

    await ctx.program.methods
      .settleTrack1Base()
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const creatorUsdcAfterBase = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    expect(creatorUsdcAfterBase - creatorUsdcBeforeBase).to.equal(track1Base);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack1Base()
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal,
            proposalUsdcVault,
            creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalAlreadySettled"
    );

    await ctx.waitUntilDeadline(deadline);

    const sponsorUsdcBeforeSettle = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    await ctx.program.methods
      .settleTrack2({ actualValue: ctx.bn(800) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const sponsorUsdcAfterSettle = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorUsdcAfterSettle - sponsorUsdcBeforeSettle).to.equal(200_000n);

    const proposalAfterSettle = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterSettle.status)).to.equal("resolvedSuccess");
    expect(proposalAfterSettle.track2UsdcDeposited.toString()).to.equal("160000");

    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .claimEndorsement()
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        userUsdcAta: ctx.fanAUsdcAta,
        proposalUsdcVault,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore);
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(160_000n);

    const positionAfterClaim = await ctx.program.account.endorsementPosition.fetch(
      endorsementPosition
    );
    expect(positionAfterClaim.claimed).to.equal(true);
  });

  it("settles track2 fail branch and returns 95% SPUMP on claim", async () => {
    const track1Base = 50_000n;
    const track2Budget = 500_000n;
    const track3Budget = 200_000n;
    const track2Target = 1_000n;
    const stakeAmount = 120_000n;

    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target,
        track2MinAchievementBps: 5_000,
      });

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(stakeAmount) })
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.fanA])
      .rpc();

    await ctx.waitUntilDeadline(deadline);

    await ctx.program.methods
      .settleTrack2({ actualValue: ctx.bn(300) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const proposalAfterSettle = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterSettle.status)).to.equal("resolvedFail");
    expect(proposalAfterSettle.track2UsdcDeposited.toNumber()).to.equal(0);

    await ctx.program.methods
      .claimEndorsement()
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        userUsdcAta: ctx.fanAUsdcAta,
        proposalUsdcVault,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    const expectedSlash = (stakeAmount * 500n) / 10_000n;
    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore - expectedSlash);
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(0n);
  });

  it("settles track3 CPS and splits approved payout/refund correctly", async () => {
    const track1Base = 30_000n;
    const track2Budget = 200_000n;
    const track3Budget = 600_000n;
    const approvedCpsPayout = 250_000n;

    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target: 1_000n,
        track2MinAchievementBps: 5_000,
        track3DelayDays: 0,
      });

    await ctx.waitUntilDeadline(deadline);

    const creatorUsdcBefore = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    const sponsorUsdcBefore = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .settleTrack3Cps({ approvedCpsPayout: ctx.bn(approvedCpsPayout) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const creatorUsdcAfter = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    const sponsorUsdcAfter = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    const expectedRefund = track3Budget - approvedCpsPayout;

    expect(creatorUsdcAfter - creatorUsdcBefore).to.equal(approvedCpsPayout);
    expect(sponsorUsdcAfter - sponsorUsdcBefore).to.equal(expectedRefund);

    const proposalAfter = await ctx.program.account.proposal.fetch(proposal);
    expect(proposalAfter.track3CpsPayout?.toString()).to.equal(approvedCpsPayout.toString());
    expect(proposalAfter.track3SettledAt.toNumber()).to.be.greaterThan(0);
  });

  it("emergency_void refunds vault and still allows 100% SPUMP claim", async () => {
    const track1Base = 70_000n;
    const track2Budget = 400_000n;
    const track3Budget = 500_000n;
    const track2Target = 1_000n;
    const stakeAmount = 90_000n;

    const { proposal, proposalUsdcVault, deadline } = await ctx.createFundedProposal({
      creator: ctx.creatorS2,
      sponsor: ctx.sponsorA,
      track1Base,
      track2Amount: track2Budget,
      track3Amount: track3Budget,
      track2Target,
      track2MinAchievementBps: 5_000,
      deadlineOffsetSeconds: 10,
    });

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(stakeAmount) })
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.fanA])
      .rpc();

    const sponsorUsdcBeforeVoid = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    const vaultBeforeVoid = await ctx.tokenAmount(proposalUsdcVault, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .emergencyVoid()
      .accounts({
        admin: ctx.payer.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const sponsorUsdcAfterVoid = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorUsdcAfterVoid - sponsorUsdcBeforeVoid).to.equal(vaultBeforeVoid);

    const proposalAfterVoid = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterVoid.status)).to.equal("voided");
    expect(proposalAfterVoid.track1Claimed).to.equal(true);
    expect(proposalAfterVoid.track2UsdcDeposited.toNumber()).to.equal(0);
    expect(proposalAfterVoid.track3UsdcDeposited.toNumber()).to.equal(0);

    await ctx.program.methods
      .claimEndorsement()
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        userUsdcAta: ctx.fanAUsdcAta,
        proposalUsdcVault,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore);
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(0n);

    await ctx.waitUntilDeadline(deadline);
  });
});

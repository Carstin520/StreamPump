import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core expired open proposal refunds", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
  });

  it("refunds burned SPUMP after an unfunded open proposal expires", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const deadline = ctx.bn(ctx.nowTs() + 3);
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);
    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);
    const contentHash = Array.from(Keypair.generate().publicKey.toBytes());
    const stakeAmount = 75_000n;

    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcBefore = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .createProposal({
        contentKind: { mixedMediaNote: {} },
        contentHash,
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(1_000),
        track2MinAchievementBps: 5_000,
        track3DelayDays: 45,
        deadline,
      })
      .accounts({
        creator: ctx.creatorS2.publicKey,
        payer: ctx.sponsorA.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        proposal,
        usdcVault: proposalUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.creatorS2, ctx.sponsorA])
      .rpc();

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
      .rpc();

    const fanSpumpAfter = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfter = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);
    const proposalAfter = await ctx.program.account.proposal.fetch(proposal);
    const positionAfter = await ctx.program.account.endorsementPosition.fetch(
      endorsementPosition
    );

    expect(fanSpumpAfter).to.equal(fanSpumpBefore);
    expect(fanUsdcAfter - fanUsdcBefore).to.equal(0n);
    expect(ctx.enumKey(proposalAfter.status)).to.equal("open");
    expect(positionAfter.claimed).to.equal(true);
  });
});

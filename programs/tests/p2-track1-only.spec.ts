import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";

import { getTestContext, type BN, type TestContext } from "./helpers/test_context";

describe("streampump-core P2 Track1-only corridor", function () {
  this.timeout(300_000);

  let ctx: TestContext;
  let nonce = 9_000;

  const nextTerms = (offsetSeconds: number) => {
    nonce += 1;
    const deadline = ctx.bn(ctx.nowTs() + offsetSeconds);
    const proposal = ctx.deriveProposal(ctx.creatorS2.publicKey, deadline, nonce);
    return {
      deadline,
      proposal,
      proposalUsdcVault: ctx.deriveProposalUsdcVault(proposal),
      creatorProfile: ctx.deriveCreatorProfile(ctx.creatorS2.publicKey),
      nonce: ctx.bn(nonce),
    };
  };

  const createProposal = async (params: {
    deadline: BN;
    proposal: ReturnType<TestContext["deriveProposal"]>;
    proposalUsdcVault: ReturnType<TestContext["deriveProposalUsdcVault"]>;
    nonce: BN;
    track2TargetValue?: bigint;
    track2MinAchievementBps?: number;
    maxEndorsementSpump?: bigint;
    track3DelayDays?: number;
  }) => {
    await ctx.program.methods
      .createProposal({
        contentKind: { mixedMediaNote: {} },
        contentHash: Array.from(Keypair.generate().publicKey.toBytes()),
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(params.track2TargetValue ?? 0n),
        track2MinAchievementBps: params.track2MinAchievementBps ?? 0,
        track3DelayDays: params.track3DelayDays ?? 0,
        deadline: params.deadline,
        nonce: params.nonce,
        maxEndorsementSpump: ctx.bn(params.maxEndorsementSpump ?? 0n),
      })
      .accounts({
        creator: ctx.creatorS2.publicKey,
        payer: ctx.sponsorA.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile: ctx.deriveCreatorProfile(ctx.creatorS2.publicKey),
        proposal: params.proposal,
        usdcVault: params.proposalUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.creatorS2, ctx.sponsorA])
      .rpc();
  };

  const fundProposal = async (
    terms: ReturnType<typeof nextTerms>,
    track2Amount = 0n,
    track3Amount = 0n
  ) => {
    await ctx.program.methods
      .sponsorFund({
        track1Amount: ctx.bn(100_000),
        track2Amount: ctx.bn(track2Amount),
        track3Amount: ctx.bn(track3Amount),
      })
      .accounts({
        sponsor: ctx.sponsorA.publicKey,
        proposal: terms.proposal,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        proposalUsdcVault: terms.proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.sponsorA])
      .rpc();
  };

  before(async () => {
    ctx = await getTestContext();
  });

  it("creates, funds, and settles a Track1-only proposal while closed tracks fail closed", async () => {
    const terms = nextTerms(6);
    await createProposal(terms);
    await fundProposal(terms);

    const funded = await ctx.program.account.proposal.fetch(terms.proposal);
    expect(ctx.enumKey(funded.status)).to.equal("funded");
    expect(funded.track2TargetValue.toString()).to.equal("0");
    expect(funded.track2UsdcDeposited.toString()).to.equal("0");
    expect(funded.track3UsdcDeposited.toString()).to.equal("0");

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, terms.proposal);
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .endorseProposal({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: terms.proposal,
            endorsementPosition,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.fanA])
          .rpc(),
      "ProposalTrackDisabled"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack2({ actualValue: ctx.bn(0) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: terms.proposal,
            proposalUsdcVault: terms.proposalUsdcVault,
            creatorProfile: terms.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalTrackDisabled"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack3Cps({ approvedCpsPayout: ctx.bn(0) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: terms.proposal,
            proposalUsdcVault: terms.proposalUsdcVault,
            creatorProfile: terms.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalTrackDisabled"
    );

    await ctx.waitUntilDeadline(terms.deadline);
    const creatorBefore = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    await ctx.program.methods
      .settleTrack1Base()
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal: terms.proposal,
        proposalUsdcVault: terms.proposalUsdcVault,
        creatorProfile: terms.creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const creatorAfter = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    expect(creatorAfter - creatorBefore).to.equal(100_000n);
    const settled = await ctx.program.account.proposal.fetch(terms.proposal);
    expect(settled.track1Claimed).to.equal(true);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack1Base()
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: terms.proposal,
            proposalUsdcVault: terms.proposalUsdcVault,
            creatorProfile: terms.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalAlreadySettled"
    );
  });

  it("rejects partially-zero Track2 terms and funding", async () => {
    const inconsistentTerms = nextTerms(90);
    await ctx.expectAnchorError(
      () =>
        createProposal({
          ...inconsistentTerms,
          track2TargetValue: 0n,
          track2MinAchievementBps: 1,
        }).then(() => "ok"),
      "InvalidTrackConfiguration"
    );

    const disabledTerms = nextTerms(90);
    await createProposal(disabledTerms);
    await ctx.expectAnchorError(
      () => fundProposal(disabledTerms, 1n, 0n).then(() => "ok"),
      "InvalidTrackConfiguration"
    );

    await ctx.expectAnchorError(
      () => fundProposal(disabledTerms, 0n, 1n).then(() => "ok"),
      "InvalidTrackConfiguration"
    );

    const enabledWithoutBudget = nextTerms(90);
    await createProposal({
      ...enabledWithoutBudget,
      track2TargetValue: 1_000n,
      track2MinAchievementBps: 5_000,
      maxEndorsementSpump: 1_000_000n,
    });
    await ctx.expectAnchorError(
      () => fundProposal(enabledWithoutBudget, 0n, 0n).then(() => "ok"),
      "InvalidTrackConfiguration"
    );

    const delayedWithoutBudget = nextTerms(90);
    await createProposal({ ...delayedWithoutBudget, track3DelayDays: 1 });
    await ctx.expectAnchorError(
      () => fundProposal(delayedWithoutBudget, 0n, 0n).then(() => "ok"),
      "InvalidTrackConfiguration"
    );
  });

  it("preserves fully configured nonzero Track2 and Track3 funding", async () => {
    const terms = nextTerms(90);
    await createProposal({
      ...terms,
      track2TargetValue: 1_000n,
      track2MinAchievementBps: 0,
      maxEndorsementSpump: 0n,
      track3DelayDays: 0,
    });
    await fundProposal(terms, 200_000n, 300_000n);

    const funded = await ctx.program.account.proposal.fetch(terms.proposal);
    expect(funded.track2UsdcDeposited.toString()).to.equal("200000");
    expect(funded.track3UsdcDeposited.toString()).to.equal("300000");
  });
});

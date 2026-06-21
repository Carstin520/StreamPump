import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";

import { getTestContext, type BN, type TestContext } from "./helpers/test_context";

describe("streampump-core S2 unhappy paths", function () {
  this.timeout(300_000);

  let ctx: TestContext;
  let nonce = 0;

  const nextDeadline = (offsetSeconds = 60): BN => {
    nonce += 1;
    return ctx.bn(ctx.nowTs() + offsetSeconds + nonce * 2);
  };

  const proposalAccounts = (creator: PublicKey, deadline: BN) => {
    const creatorProfile = ctx.deriveCreatorProfile(creator);
    const proposal = ctx.deriveProposal(creator, deadline);
    const proposalUsdcVault = ctx.deriveProposalUsdcVault(proposal);
    return { creatorProfile, proposal, proposalUsdcVault };
  };

  const createProposal = async (params: {
    creator?: Keypair;
    deadline?: BN;
    track1BaseUsdc?: number | bigint;
    track2TargetValue?: number | bigint;
    track2MinAchievementBps?: number;
    track3DelayDays?: number;
    contentHash?: number[] | null;
  }) => {
    const creator = params.creator ?? ctx.creatorS2;
    const deadline = params.deadline ?? nextDeadline();
    const { creatorProfile, proposal, proposalUsdcVault } = proposalAccounts(
      creator.publicKey,
      deadline
    );

    await ctx.program.methods
      .createProposal({
        contentKind: { mixedMediaNote: {} },
        contentHash:
          params.contentHash === undefined
            ? Array.from(Keypair.generate().publicKey.toBytes())
            : params.contentHash,
        contentAnchorPda: null,
        track1BaseUsdc: ctx.bn(params.track1BaseUsdc ?? 100_000),
        track2MetricType: { views: {} },
        track2TargetValue: ctx.bn(params.track2TargetValue ?? 1_000),
        track2MinAchievementBps: params.track2MinAchievementBps ?? 5_000,
        track3DelayDays: params.track3DelayDays ?? 0,
        deadline,
        nonce: ctx.bn(0),
      })
      .accounts({
        creator: creator.publicKey,
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
      .signers([creator, ctx.sponsorA])
      .rpc();

    return { creator, creatorProfile, proposal, proposalUsdcVault, deadline };
  };

  const fundProposal = async (
    proposal: PublicKey,
    proposalUsdcVault: PublicKey,
    track1Amount = 100_000n,
    track2Amount = 200_000n,
    track3Amount = 300_000n
  ) => {
    await ctx.program.methods
      .sponsorFund({
        track1Amount: ctx.bn(track1Amount),
        track2Amount: ctx.bn(track2Amount),
        track3Amount: ctx.bn(track3Amount),
      })
      .accounts({
        sponsor: ctx.sponsorA.publicKey,
        proposal,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        proposalUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.sponsorA])
      .rpc();
  };

  const endorse = async (proposal: PublicKey, amount: bigint) => {
    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);
    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(amount) })
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
    return endorsementPosition;
  };

  before(async () => {
    ctx = await getTestContext();
  });

  it("rejects invalid proposal creation inputs", async () => {
    await ctx.expectAnchorError(
      () =>
        createProposal({
          creator: ctx.creatorS1,
          deadline: nextDeadline(),
        }).then(() => "ok"),
      "InsufficientCreatorLevel"
    );

    await ctx.expectAnchorError(
      () =>
        createProposal({
          deadline: ctx.bn(ctx.nowTs() - 1),
        }).then(() => "ok"),
      "InvalidDeadline"
    );

    await ctx.expectAnchorError(
      () =>
        createProposal({
          deadline: ctx.bn(ctx.nowTs() + 8 * 24 * 3_600),
        }).then(() => "ok"),
      "InvalidDeadline"
    );

    await ctx.expectAnchorError(
      () =>
        createProposal({
          track2TargetValue: 0,
        }).then(() => "ok"),
      "InvalidAmount"
    );

    await ctx.expectAnchorError(
      () =>
        createProposal({
          contentHash: null,
        }).then(() => "ok"),
      "InvalidContentBinding"
    );
  });

  it("rejects invalid funding and endorsement transitions", async () => {
    const open = await createProposal({ deadline: nextDeadline(5) });

    await ctx.expectAnchorError(
      () => fundProposal(open.proposal, open.proposalUsdcVault, 99_999n).then(() => "ok"),
      "InvalidAmount"
    );

    await fundProposal(open.proposal, open.proposalUsdcVault);

    await ctx.expectAnchorError(
      () => fundProposal(open.proposal, open.proposalUsdcVault).then(() => "ok"),
      "ProposalNotOpen"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .endorseProposal({ amount: ctx.bn(0) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: open.proposal,
            endorsementPosition: ctx.deriveEndorsementPosition(ctx.fanA.publicKey, open.proposal),
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InvalidAmount"
    );

    await ctx.waitUntilDeadline(open.deadline);
    await ctx.expectAnchorError(
      () => endorse(open.proposal, 1_000n).then(() => "ok"),
      "ProposalExpired"
    );
  });

  it("rejects settlement, claim, cancel, and emergency void invalid states", async () => {
    const funded = await createProposal({
      deadline: nextDeadline(6),
      track3DelayDays: 1,
    });
    await fundProposal(funded.proposal, funded.proposalUsdcVault);
    const endorsementPosition = await endorse(funded.proposal, 1_000n);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack2({ actualValue: ctx.bn(800) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            proposalUsdcVault: funded.proposalUsdcVault,
            creatorProfile: funded.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalNotExpired"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .claimEndorsement()
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            creatorProfile: funded.creatorProfile,
            endorsementPosition,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            userUsdcAta: ctx.fanAUsdcAta,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            proposalUsdcVault: funded.proposalUsdcVault,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
      "ProposalNotClaimable"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .cancelProposal()
          .accounts({
            creator: ctx.sponsorA.publicKey,
            proposal: funded.proposal,
          })
          .signers([ctx.sponsorA])
          .rpc(),
      "Unauthorized"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .emergencyVoid()
          .accounts({
            admin: ctx.sponsorA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            proposalUsdcVault: funded.proposalUsdcVault,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.sponsorA])
          .rpc(),
      "Unauthorized"
    );

    await ctx.waitUntilDeadline(funded.deadline);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack3Cps({ approvedCpsPayout: ctx.bn(1) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            proposalUsdcVault: funded.proposalUsdcVault,
            creatorProfile: funded.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalNotExpired"
    );

    const noDelay = await createProposal({ deadline: nextDeadline(3), track3DelayDays: 0 });
    await fundProposal(noDelay.proposal, noDelay.proposalUsdcVault);
    await ctx.waitUntilDeadline(noDelay.deadline);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack3Cps({ approvedCpsPayout: ctx.bn(300_001) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: noDelay.proposal,
            proposalUsdcVault: noDelay.proposalUsdcVault,
            creatorProfile: noDelay.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "InvalidAmount"
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack3Cps({ approvedCpsPayout: ctx.bn(1) })
          .accounts({
            oracle: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: noDelay.proposal,
            proposalUsdcVault: noDelay.proposalUsdcVault,
            creatorProfile: noDelay.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "Unauthorized"
    );

    await ctx.program.methods
      .settleTrack2({ actualValue: ctx.bn(800) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal: funded.proposal,
        proposalUsdcVault: funded.proposalUsdcVault,
        creatorProfile: funded.creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack2({ actualValue: ctx.bn(800) })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            proposalUsdcVault: funded.proposalUsdcVault,
            creatorProfile: funded.creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalNotFunded"
    );

    await ctx.program.methods
      .claimEndorsement()
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal: funded.proposal,
        creatorProfile: funded.creatorProfile,
        endorsementPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        userUsdcAta: ctx.fanAUsdcAta,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        proposalUsdcVault: funded.proposalUsdcVault,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .claimEndorsement()
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal: funded.proposal,
            creatorProfile: funded.creatorProfile,
            endorsementPosition,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            userUsdcAta: ctx.fanAUsdcAta,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            proposalUsdcVault: funded.proposalUsdcVault,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
      "PositionAlreadyClaimed"
    );
  });
});

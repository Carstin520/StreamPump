import { expect } from "chai";
import {
  createAssociatedTokenAccount,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

const USER_ROLE_FAN = 1 << 0;
const NONZERO_REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 1);
const DEFAULT_REWARD_CAP_USDC = 100_000_000;

const defaultRewardConfigArgs = (ctx: TestContext) => ({
  s1BuyoutCreatorShareBps: 8_000,
  s1BuyoutRewardModel: 1,
  s1DiscoveryRewardCapUsdc: ctx.bn(DEFAULT_REWARD_CAP_USDC),
  s1StatusThankyouUsdc: ctx.bn(10_000_000),
  s1BuyoutResidualTo: 0,
  s1DiscoveryMinHoldSeconds: ctx.bn(0),
  s1DiscoveryClaimWindowSeconds: ctx.bn(30 * 24 * 3_600),
  track2RewardCapUsdc: ctx.bn(DEFAULT_REWARD_CAP_USDC),
  track2ResidualTo: 1,
});

const deriveUserProfile = (ctx: TestContext, user: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), user.toBuffer()],
    ctx.program.programId
  )[0];

const deriveS1Position = (
  ctx: TestContext,
  user: PublicKey,
  creatorProfile: PublicKey
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("s1_position"), user.toBuffer(), creatorProfile.toBuffer()],
    ctx.program.programId
  )[0];

const deriveOrganization = (
  ctx: TestContext,
  owner: PublicKey,
  organizationSeed: number[]
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("organization"), owner.toBuffer(), Buffer.from(organizationSeed)],
    ctx.program.programId
  )[0];

const deriveOrganizationMembership = (
  ctx: TestContext,
  organization: PublicKey,
  member: PublicKey
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("org_membership"), organization.toBuffer(), member.toBuffer()],
    ctx.program.programId
  )[0];

const deriveUserRewardReceipt = (
  ctx: TestContext,
  userProfile: PublicKey,
  reportId: number[]
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("user_reward_receipt"), userProfile.toBuffer(), Buffer.from(reportId)],
    ctx.program.programId
  )[0];

const fundSigner = async (ctx: TestContext, signer: Keypair): Promise<void> => {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: ctx.payer.publicKey,
      toPubkey: signer.publicKey,
      lamports: LAMPORTS_PER_SOL,
    })
  );
  await sendAndConfirmTransaction(ctx.connection, tx, [ctx.payer]);
};

const createS1Creator = async (ctx: TestContext, handle: string) => {
  const creator = Keypair.generate();
  await fundSigner(ctx, creator);
  const payoutUsdcAta = await createAssociatedTokenAccount(
    ctx.connection,
    ctx.payer,
    ctx.usdcMint,
    creator.publicKey
  );
  const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);

  await ctx.program.methods
    .registerCreator({
      handle,
      payoutUsdcAta,
    })
    .accounts({
      authority: creator.publicKey,
      protocolConfig: ctx.protocolConfig,
      creatorProfile,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ctx.creatorAuthPreInstruction(creator.publicKey, handle)])
    .signers([creator])
    .rpc();

  return { creator, creatorProfile };
};

const prepareFan = async (ctx: TestContext): Promise<PublicKey> => {
  const userProfile = deriveUserProfile(ctx, ctx.fanA.publicKey);
  await ctx.program.methods
    .registerUser({
      roleFlags: USER_ROLE_FAN,
    })
    .accounts({
      authority: ctx.fanA.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.fanA])
    .rpc();

  const reportId = Array.from(Keypair.generate().publicKey.toBytes());
  await ctx.program.methods
    .claimEngagementReward({
      missionType: { completeProfile: {} },
      rewardAmount: ctx.bn(0),
      xpGain: ctx.bn(10),
      newLevel: null,
      reportId,
      reportDigest: NONZERO_REPORT_DIGEST,
      observedAt: ctx.bn(ctx.nowTs() - 5),
    })
    .accounts({
      user: ctx.fanA.publicKey,
      oracle: ctx.oracle.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile,
      rewardReceipt: deriveUserRewardReceipt(ctx, userProfile, reportId),
      userSpumpAta: ctx.fanASpumpAta,
      spumpMint: ctx.spumpMint,
      spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.fanA, ctx.oracle])
    .rpc();

  return userProfile;
};

const prepareFreshFan = async (
  ctx: TestContext,
  rewardAmount = 20_000_000
): Promise<{ fan: Keypair; userProfile: PublicKey; spumpAta: PublicKey }> => {
  const fan = Keypair.generate();
  await fundSigner(ctx, fan);
  const userProfile = deriveUserProfile(ctx, fan.publicKey);
  const spumpAta = await createAssociatedTokenAccount(
    ctx.connection,
    ctx.payer,
    ctx.spumpMint,
    fan.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  await ctx.program.methods
    .registerUser({ roleFlags: USER_ROLE_FAN })
    .accounts({
      authority: fan.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile,
      systemProgram: SystemProgram.programId,
    })
    .signers([fan])
    .rpc();

  const reportId = Array.from(Keypair.generate().publicKey.toBytes());
  await ctx.program.methods
    .claimEngagementReward({
      missionType: { completeProfile: {} },
      rewardAmount: ctx.bn(rewardAmount),
      xpGain: ctx.bn(20),
      newLevel: null,
      reportId,
      reportDigest: NONZERO_REPORT_DIGEST,
      observedAt: ctx.bn(ctx.nowTs() - 5),
    })
    .accounts({
      user: fan.publicKey,
      oracle: ctx.oracle.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile,
      rewardReceipt: deriveUserRewardReceipt(ctx, userProfile, reportId),
      userSpumpAta: spumpAta,
      spumpMint: ctx.spumpMint,
      spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([fan, ctx.oracle])
    .rpc();

  return { fan, userProfile, spumpAta };
};

describe("streampump-core S1 guards", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
  });

  it("rejects S1 buys when the user profile is missing", async () => {
    const { creatorProfile } = await createS1Creator(ctx, "s1_no_profile_guard");
    const freshFan = Keypair.generate();
    await fundSigner(ctx, freshFan);
    const freshFanSpumpAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      freshFan.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: freshFan.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile: deriveUserProfile(ctx, freshFan.publicKey),
            creatorProfile,
            s1UserPosition: deriveS1Position(ctx, freshFan.publicKey, creatorProfile),
            userSpumpAta: freshFanSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([freshFan])
          .rpc(),
      "AccountNotInitialized"
    );
  });

  it("rejects S1 buys for non-fan profiles and low activity profiles", async () => {
    const { creatorProfile } = await createS1Creator(ctx, "s1_role_activity_guard");
    const userProfile = deriveUserProfile(ctx, ctx.fanA.publicKey);

    await ctx.program.methods
      .registerUser({
        roleFlags: 1 << 1,
      })
      .accounts({
        authority: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.fanA])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile,
            creatorProfile,
            s1UserPosition: deriveS1Position(ctx, ctx.fanA.publicKey, creatorProfile),
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InsufficientUserActivityScore"
    );
  });

  it("maintains S1 holder counters across first buy, repeat buy, bucket migration, and full sell", async () => {
    await ctx.program.methods
      .updateProtocolS1Emission({
        dailySpumpEmissionMultiplierBps: 50_000,
        newUserEmissionBps: 2_500,
        newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
        s1MinUserXp: ctx.bn(10),
        maxS1DailyBuySpump: ctx.bn(1_000_000_000),
        s1EarlyCohortSupplyThreshold: ctx.bn(500),
        s1EarlyCohortBuyoutCapBps: 2_000,
        s1RageQuitWindowSeconds: ctx.bn(48 * 3_600),
        ...defaultRewardConfigArgs(ctx),
      })
      .accounts({
        admin: ctx.payer.publicKey,
        protocolConfig: ctx.protocolConfig,
      })
      .rpc();

    const { creator, creatorProfile } = await createS1Creator(ctx, "s1_holder_counter_guard");
    const creatorSpumpAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      creator.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const { fan, userProfile, spumpAta } = await prepareFreshFan(ctx, 1_000_000_000);
    const s1UserPosition = deriveS1Position(ctx, fan.publicKey, creatorProfile);

    const buyAccounts = {
      user: fan.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile,
      creatorProfile,
      s1UserPosition,
      userSpumpAta: spumpAta,
      spumpMint: ctx.spumpMint,
      spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    };
    const sellAccounts = {
      user: fan.publicKey,
      protocolConfig: ctx.protocolConfig,
      creatorProfile,
      s1UserPosition,
      userSpumpAta: spumpAta,
      creatorRevenueSpumpAta: creatorSpumpAta,
      spumpMint: ctx.spumpMint,
      spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
    };

    await ctx.program.methods
      .buyS1Token({ amount: ctx.bn(600) })
      .accounts(buyAccounts)
      .signers([fan])
      .rpc();

    let creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.s1EligibleHolderCount).to.equal(1);
    expect(creatorAfter.s1EarlyHolderCount).to.equal(1);
    expect(creatorAfter.s1RegularHolderCount).to.equal(0);

    await ctx.program.methods
      .buyS1Token({ amount: ctx.bn(1) })
      .accounts(buyAccounts)
      .signers([fan])
      .rpc();

    creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.s1EligibleHolderCount).to.equal(1);
    expect(creatorAfter.s1EarlyHolderCount).to.equal(1);
    expect(creatorAfter.s1RegularHolderCount).to.equal(0);

    await ctx.program.methods
      .sellS1Token({ amount: ctx.bn(500) })
      .accounts(sellAccounts)
      .signers([fan])
      .rpc();

    creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.s1EligibleHolderCount).to.equal(1);
    expect(creatorAfter.s1EarlyHolderCount).to.equal(0);
    expect(creatorAfter.s1RegularHolderCount).to.equal(1);

    await ctx.program.methods
      .sellS1Token({ amount: ctx.bn(50) })
      .accounts(sellAccounts)
      .signers([fan])
      .rpc();

    creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.s1EligibleHolderCount).to.equal(1);
    expect(creatorAfter.s1EarlyHolderCount).to.equal(0);
    expect(creatorAfter.s1RegularHolderCount).to.equal(1);

    await ctx.program.methods
      .sellS1Token({ amount: ctx.bn(51) })
      .accounts(sellAccounts)
      .signers([fan])
      .rpc();

    creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.s1EligibleHolderCount).to.equal(0);
    expect(creatorAfter.s1EarlyHolderCount).to.equal(0);
    expect(creatorAfter.s1RegularHolderCount).to.equal(0);

    await ctx.program.methods
      .updateProtocolS1Emission({
        dailySpumpEmissionMultiplierBps: 50_000,
        newUserEmissionBps: 2_500,
        newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
        s1MinUserXp: ctx.bn(10),
        maxS1DailyBuySpump: ctx.bn(15_000_000),
        s1EarlyCohortSupplyThreshold: ctx.bn(500),
        s1EarlyCohortBuyoutCapBps: 2_000,
        s1RageQuitWindowSeconds: ctx.bn(48 * 3_600),
        ...defaultRewardConfigArgs(ctx),
      })
      .accounts({
        admin: ctx.payer.publicKey,
        protocolConfig: ctx.protocolConfig,
      })
      .rpc();
  });

  it("caps each user creator pair by daily SPUMP budget instead of share amount", async () => {
    const { creatorProfile } = await createS1Creator(ctx, "s1_spump_budget_guard");
    const userProfile = await prepareFan(ctx);
    const s1UserPosition = deriveS1Position(ctx, ctx.fanA.publicKey, creatorProfile);

    await ctx.program.methods
      .buyS1Token({ amount: ctx.bn(150) })
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile,
        creatorProfile,
        s1UserPosition,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.fanA])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(50) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile,
            creatorProfile,
            s1UserPosition,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.fanA])
          .rpc(),
      "S1DailyBuyLimitExceeded"
    );

    const position = await ctx.program.account.s1UserPosition.fetch(s1UserPosition);
    expect(position.dailyBoughtSpump.toString()).to.equal("11250000");
  });

  it("keeps init_if_needed account state stable across repeated calls", async () => {
    const creator = Keypair.generate();
    const fan = Keypair.generate();
    const owner = Keypair.generate();
    const member = Keypair.generate();

    await fundSigner(ctx, creator);
    await fundSigner(ctx, fan);
    await fundSigner(ctx, owner);
    await fundSigner(ctx, member);

    const creatorUsdcAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.usdcMint,
      creator.publicKey
    );
    const fanSpumpAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      fan.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);

    await ctx.program.methods
      .registerCreator({
        handle: "init_reentry_creator",
        payoutUsdcAta: creatorUsdcAta,
      })
      .accounts({
        authority: creator.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ctx.creatorAuthPreInstruction(creator.publicKey, "init_reentry_creator")])
      .signers([creator])
      .rpc();

    const creatorBefore = await ctx.program.account.creatorProfile.fetch(creatorProfile);

    await ctx.program.methods
      .registerCreator({
        handle: "init_reentry_creator_v2",
        payoutUsdcAta: ctx.creatorS1UsdcAta,
      })
      .accounts({
        authority: creator.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ctx.creatorAuthPreInstruction(creator.publicKey, "init_reentry_creator_v2")])
      .signers([creator])
      .rpc();

    const creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfter.authority.toBase58()).to.equal(creator.publicKey.toBase58());
    expect(creatorAfter.createdAt.toString()).to.equal(creatorBefore.createdAt.toString());
    expect(creatorAfter.s1Supply.toString()).to.equal("0");
    expect(creatorAfter.handle).to.equal("init_reentry_creator_v2");
    expect(creatorAfter.payoutUsdcAta.toBase58()).to.equal(ctx.creatorS1UsdcAta.toBase58());

    const fanUserProfile = deriveUserProfile(ctx, fan.publicKey);
    await ctx.program.methods
      .registerUser({ roleFlags: USER_ROLE_FAN })
      .accounts({
        authority: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: fanUserProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([fan])
      .rpc();

    const reportId = Array.from(Keypair.generate().publicKey.toBytes());
    await ctx.program.methods
      .claimEngagementReward({
        missionType: { completeProfile: {} },
        rewardAmount: ctx.bn(20_000_000),
        xpGain: ctx.bn(10),
        newLevel: null,
        reportId,
        reportDigest: NONZERO_REPORT_DIGEST,
        observedAt: ctx.bn(ctx.nowTs() - 5),
      })
      .accounts({
        user: fan.publicKey,
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: fanUserProfile,
        rewardReceipt: deriveUserRewardReceipt(ctx, fanUserProfile, reportId),
        userSpumpAta: fanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([fan, ctx.oracle])
      .rpc();

    const userBefore = await ctx.program.account.userProfile.fetch(fanUserProfile);
    await ctx.program.methods
      .registerUser({ roleFlags: 1 << 2 })
      .accounts({
        authority: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: fanUserProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([fan])
      .rpc();

    const userAfter = await ctx.program.account.userProfile.fetch(fanUserProfile);
    expect(userAfter.authority.toBase58()).to.equal(fan.publicKey.toBase58());
    expect(userAfter.createdAt.toString()).to.equal(userBefore.createdAt.toString());
    expect(userAfter.xp.toString()).to.equal(userBefore.xp.toString());
    expect(userAfter.roleFlags).to.equal(USER_ROLE_FAN | (1 << 2));

    const s1UserPosition = deriveS1Position(ctx, fan.publicKey, creatorProfile);
    await ctx.program.methods
      .buyS1Token({ amount: ctx.bn(1) })
      .accounts({
        user: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: fanUserProfile,
        creatorProfile,
        s1UserPosition,
        userSpumpAta: fanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([fan])
      .rpc();

    const positionBefore = await ctx.program.account.s1UserPosition.fetch(s1UserPosition);

    await ctx.program.methods
      .buyS1Token({ amount: ctx.bn(1) })
      .accounts({
        user: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: fanUserProfile,
        creatorProfile,
        s1UserPosition,
        userSpumpAta: fanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([fan])
      .rpc();

    const positionAfter = await ctx.program.account.s1UserPosition.fetch(s1UserPosition);
    expect(positionAfter.user.toBase58()).to.equal(fan.publicKey.toBase58());
    expect(positionAfter.creator.toBase58()).to.equal(creatorProfile.toBase58());
    expect(positionAfter.firstBoughtAt.toString()).to.equal(positionBefore.firstBoughtAt.toString());
    expect(positionAfter.internalTokenBalance.toString()).to.equal("2");

    const funded = await ctx.createFundedProposal({
      creator: ctx.creatorS2,
      sponsor: ctx.sponsorA,
      track1Base: 100_000n,
      track2Amount: 200_000n,
      track3Amount: 300_000n,
      track2Target: 1_000n,
      track2MinAchievementBps: 5_000,
      deadlineOffsetSeconds: 8,
    });
    const endorsementPosition = ctx.deriveEndorsementPosition(fan.publicKey, funded.proposal);

    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(1_000) })
      .accounts({
        user: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal: funded.proposal,
        endorsementPosition,
        userSpumpAta: fanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([fan])
      .rpc();

    const proposalBefore = await ctx.program.account.proposal.fetch(funded.proposal);

    await ctx.program.methods
      .endorseProposal({ amount: ctx.bn(500) })
      .accounts({
        user: fan.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal: funded.proposal,
        endorsementPosition,
        userSpumpAta: fanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([fan])
      .rpc();

    const endorsementAfter = await ctx.program.account.endorsementPosition.fetch(endorsementPosition);
    const proposalAfter = await ctx.program.account.proposal.fetch(funded.proposal);
    expect(endorsementAfter.user.toBase58()).to.equal(fan.publicKey.toBase58());
    expect(endorsementAfter.proposal.toBase58()).to.equal(funded.proposal.toBase58());
    expect(endorsementAfter.stakedAmount.toString()).to.equal("1500");
    expect(proposalAfter.track2EndorserCount).to.equal(proposalBefore.track2EndorserCount);

    const ownerUserProfile = deriveUserProfile(ctx, owner.publicKey);
    const memberUserProfile = deriveUserProfile(ctx, member.publicKey);
    await ctx.program.methods
      .registerUser({ roleFlags: 1 << 2 })
      .accounts({
        authority: owner.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: ownerUserProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    await ctx.program.methods
      .registerUser({ roleFlags: USER_ROLE_FAN })
      .accounts({
        authority: member.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile: memberUserProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([member])
      .rpc();

    const organizationSeed = Array.from(Keypair.generate().publicKey.toBytes());
    const organization = deriveOrganization(ctx, owner.publicKey, organizationSeed);
    const ownerMembership = deriveOrganizationMembership(ctx, organization, owner.publicKey);
    const memberMembership = deriveOrganizationMembership(ctx, organization, member.publicKey);

    await ctx.program.methods
      .createOrganization({
        organizationType: { sponsorBrand: {} },
        organizationSeed,
        displayName: "Init Reentry Brand",
        payoutUsdcAta: ctx.sponsorAUsdcAta,
        metadataDigest: NONZERO_REPORT_DIGEST,
      })
      .accounts({
        owner: owner.publicKey,
        ownerUserProfile,
        organization,
        ownerMembership,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    await ctx.program.methods
      .addOrganizationMember({ role: { campaignOperator: {} } })
      .accounts({
        authority: owner.publicKey,
        organization,
        member: member.publicKey,
        memberUserProfile,
        organizationMembership: memberMembership,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const organizationBefore = await ctx.program.account.organization.fetch(organization);

    await ctx.program.methods
      .addOrganizationMember({ role: { finance: {} } })
      .accounts({
        authority: owner.publicKey,
        organization,
        member: member.publicKey,
        memberUserProfile,
        organizationMembership: memberMembership,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const organizationAfter = await ctx.program.account.organization.fetch(organization);
    const memberMembershipAfter = await ctx.program.account.organizationMembership.fetch(memberMembership);
    expect(organizationAfter.memberCount).to.equal(organizationBefore.memberCount);
    expect(organizationAfter.memberCount).to.equal(2);
    expect(memberMembershipAfter.organization.toBase58()).to.equal(organization.toBase58());
    expect(memberMembershipAfter.user.toBase58()).to.equal(member.publicKey.toBase58());
    expect(ctx.enumKey(memberMembershipAfter.role)).to.equal("finance");
  });

  it("applies new-account emission discount and streak bonus on daily SPUMP claims", async () => {
    const freshFan = Keypair.generate();
    await fundSigner(ctx, freshFan);
    const userProfile = deriveUserProfile(ctx, freshFan.publicKey);
    const freshFanSpumpAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      freshFan.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await ctx.program.methods
      .registerUser({
        roleFlags: USER_ROLE_FAN,
      })
      .accounts({
        authority: freshFan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile,
        systemProgram: SystemProgram.programId,
      })
      .signers([freshFan])
      .rpc();

    await ctx.program.methods
      .claimDailySpump()
      .accounts({
        user: freshFan.publicKey,
        protocolConfig: ctx.protocolConfig,
        userProfile,
        userSpumpAta: freshFanSpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freshFan])
      .rpc();

    const tokenAccount = await getAccount(
      ctx.connection,
      freshFanSpumpAta,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    expect(tokenAccount.amount.toString()).to.equal("1275000");
  });

  it("schedules oracle rating updates and rate-limits repeat reports", async () => {
    const { creator, creatorProfile } = await createS1Creator(ctx, "s1_rating_guard");
    const reportId = Array.from(Keypair.generate().publicKey.toBytes());

    await ctx.program.methods
      .updateCreatorS1Rating({
        ratingBps: 11_000,
        graduationTargetSupply: ctx.bn(2_500),
        reportId,
        reportDigest: NONZERO_REPORT_DIGEST,
        observedAt: ctx.bn(ctx.nowTs() - 5),
      })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
      })
      .signers([ctx.oracle])
      .rpc();

    const profile = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(profile.authority.toBase58()).to.equal(creator.publicKey.toBase58());
    expect(profile.s1RatingBps).to.equal(10_000);
    expect(profile.pendingS1RatingBps).to.equal(11_000);
    expect(profile.pendingRatingEffectiveAt.toNumber()).to.be.greaterThan(ctx.nowTs());

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateCreatorS1Rating({
            ratingBps: 11_500,
            graduationTargetSupply: ctx.bn(2_500),
            reportId: Array.from(Keypair.generate().publicKey.toBytes()),
            reportDigest: NONZERO_REPORT_DIGEST,
            observedAt: ctx.bn(ctx.nowTs() - 5),
          })
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
          })
          .signers([ctx.oracle])
          .rpc(),
      "CreatorRatingUpdateTooSoon"
    );
  });

  it("lets only the protocol admin update S1 emission guard config", async () => {
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateProtocolS1Emission({
            dailySpumpEmissionMultiplierBps: 20_000,
            newUserEmissionBps: 2_500,
            newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
            s1MinUserXp: ctx.bn(10),
            maxS1DailyBuySpump: ctx.bn(15_000_000),
            s1EarlyCohortSupplyThreshold: ctx.bn(500),
            s1EarlyCohortBuyoutCapBps: 2_000,
            s1RageQuitWindowSeconds: ctx.bn(48 * 3_600),
            ...defaultRewardConfigArgs(ctx),
          })
          .accounts({
            admin: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
          })
          .signers([ctx.fanA])
          .rpc(),
      "Unauthorized"
    );

    await ctx.program.methods
      .updateProtocolS1Emission({
        dailySpumpEmissionMultiplierBps: 20_000,
        newUserEmissionBps: 2_500,
        newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
        s1MinUserXp: ctx.bn(10),
        maxS1DailyBuySpump: ctx.bn(15_000_000),
        s1EarlyCohortSupplyThreshold: ctx.bn(500),
        s1EarlyCohortBuyoutCapBps: 2_000,
        s1RageQuitWindowSeconds: ctx.bn(48 * 3_600),
        ...defaultRewardConfigArgs(ctx),
      })
      .accounts({
        admin: ctx.payer.publicKey,
        protocolConfig: ctx.protocolConfig,
      })
      .rpc();

    const config = await ctx.program.account.protocolConfig.fetch(ctx.protocolConfig);
    expect(config.dailySpumpEmissionMultiplierBps).to.equal(20_000);
    expect(config.maxS1DailyBuySpump.toString()).to.equal("15000000");
  });
});

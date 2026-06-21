import { expect } from "chai";
import {
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

const USER_ROLE_FAN = 1 << 0;
const REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 1);
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

const deriveUserRewardReceipt = (
  ctx: TestContext,
  userProfile: PublicKey,
  reportId: number[]
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("user_reward_receipt"), userProfile.toBuffer(), Buffer.from(reportId)],
    ctx.program.programId
  )[0];

const fundSigner = async (ctx: TestContext, signer: Keypair, sol = 2): Promise<void> => {
  await sendAndConfirmTransaction(
    ctx.connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: ctx.payer.publicKey,
        toPubkey: signer.publicKey,
        lamports: sol * LAMPORTS_PER_SOL,
      })
    ),
    [ctx.payer]
  );
};

const registerIsolatedCreator = async (
  ctx: TestContext,
  handlePrefix: string
): Promise<{
  creator: Keypair;
  creatorProfile: PublicKey;
  creatorUsdcAta: PublicKey;
  creatorSpumpAta: PublicKey;
}> => {
  const creator = Keypair.generate();
  await fundSigner(ctx, creator);
  const creatorUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.usdcMint,
      creator.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    )
  ).address;
  const creatorSpumpAta = (
    await getOrCreateAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      creator.publicKey,
      undefined,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
  ).address;
  const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);
  const handle = `${handlePrefix}_${creator.publicKey.toBase58().slice(0, 8)}`;

  await ctx.program.methods
    .registerCreator({
      handle,
      payoutUsdcAta: creatorUsdcAta,
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

  return { creator, creatorProfile, creatorUsdcAta, creatorSpumpAta };
};

const ensureFanProfile = async (ctx: TestContext): Promise<PublicKey> => {
  const userProfile = deriveUserProfile(ctx, ctx.fanA.publicKey);
  await ctx.program.methods
    .registerUser({ roleFlags: USER_ROLE_FAN })
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
      xpGain: ctx.bn(20),
      newLevel: null,
      reportId,
      reportDigest: REPORT_DIGEST,
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

const buyS1 = async (
  ctx: TestContext,
  creatorProfile: PublicKey,
  amount: number
): Promise<PublicKey> => {
  const position = deriveS1Position(ctx, ctx.fanA.publicKey, creatorProfile);
  await ctx.program.methods
    .buyS1Token({ amount: ctx.bn(amount) })
    .accounts({
      user: ctx.fanA.publicKey,
      protocolConfig: ctx.protocolConfig,
      userProfile: deriveUserProfile(ctx, ctx.fanA.publicKey),
      creatorProfile,
      s1UserPosition: position,
      userSpumpAta: ctx.fanASpumpAta,
      spumpMint: ctx.spumpMint,
      spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([ctx.fanA])
    .rpc();
  return position;
};

describe("streampump-core S1 unhappy paths", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
    await ensureFanProfile(ctx);
  });

  it("blocks normal S1 buy and sell once creator leaves S1 active", async () => {
    const { creator, creatorProfile, creatorSpumpAta } = await registerIsolatedCreator(
      ctx,
      "s1_lock"
    );
    const position = await buyS1(ctx, creatorProfile, 10);
    const buyoutOffer = ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile);
    const offerUsdcVault = ctx.deriveOfferUsdcVault(buyoutOffer);
    const s1BuyoutState = ctx.deriveS1BuyoutState(creatorProfile);

    await ctx.program.methods
      .initS1Buyout()
      .accounts({ creator: creator.publicKey, creatorProfile })
      .signers([creator])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile: deriveUserProfile(ctx, ctx.fanA.publicKey),
            creatorProfile,
            s1UserPosition: position,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InvalidCreatorStatus"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .sellS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            s1UserPosition: position,
            userSpumpAta: ctx.fanASpumpAta,
            creatorRevenueSpumpAta: creatorSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InvalidCreatorStatus"
    );

    await ctx.program.methods
      .submitBuyoutOffer({ usdcAmount: ctx.bn(1_000_000) })
      .accounts({
        sponsor: ctx.sponsorB.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        buyoutOffer,
        sponsorUsdcAta: ctx.sponsorBUsdcAta,
        offerUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.sponsorB])
      .rpc();
    await ctx.program.methods
      .acceptBuyoutOffer()
      .accounts({
        creator: creator.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        buyoutOffer,
        offerUsdcVault,
        s1BuyoutState,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    const positionAfter = await ctx.program.account.s1UserPosition.fetch(position);
    expect(ctx.enumKey(creatorAfter.status)).to.equal("s1ExecutionPending");
    expect(positionAfter.internalTokenBalance.toString()).to.equal("10");
  });

  it("rejects invalid buy/sell amounts, excess sell, and mismatched position accounts", async () => {
    const first = await registerIsolatedCreator(ctx, "s1_amounts");
    const second = await registerIsolatedCreator(ctx, "s1_other");
    const position = await buyS1(ctx, first.creatorProfile, 10);
    const wrongPosition = await buyS1(ctx, second.creatorProfile, 1);

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(0) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile: deriveUserProfile(ctx, ctx.fanA.publicKey),
            creatorProfile: first.creatorProfile,
            s1UserPosition: position,
            userSpumpAta: ctx.fanASpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InvalidAmount"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .sellS1Token({ amount: ctx.bn(0) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile: first.creatorProfile,
            s1UserPosition: position,
            userSpumpAta: ctx.fanASpumpAta,
            creatorRevenueSpumpAta: first.creatorSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InvalidAmount"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .sellS1Token({ amount: ctx.bn(11) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile: first.creatorProfile,
            s1UserPosition: position,
            userSpumpAta: ctx.fanASpumpAta,
            creatorRevenueSpumpAta: first.creatorSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "InsufficientInternalTokenBalance"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .sellS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile: first.creatorProfile,
            s1UserPosition: wrongPosition,
            userSpumpAta: ctx.fanASpumpAta,
            creatorRevenueSpumpAta: first.creatorSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "ConstraintSeeds"
    );

    const positionAfter = await ctx.program.account.s1UserPosition.fetch(position);
    expect(positionAfter.internalTokenBalance.toString()).to.equal("10");
  });

  it("rejects rating and S1 config updates outside oracle/admin guardrails", async () => {
    const { creatorProfile } = await registerIsolatedCreator(ctx, "s1_rating");
    const reportId = Array.from(Keypair.generate().publicKey.toBytes());

    const ratingAccounts = {
      protocolConfig: ctx.protocolConfig,
      creatorProfile,
    };

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateCreatorS1Rating({
            ratingBps: 10_500,
            graduationTargetSupply: ctx.bn(2_500),
            reportId,
            reportDigest: REPORT_DIGEST,
            observedAt: ctx.bn(ctx.nowTs() - 5),
          })
          .accounts({ oracle: ctx.fanA.publicKey, ...ratingAccounts })
          .signers([ctx.fanA])
          .rpc(),
      "Unauthorized"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateCreatorS1Rating({
            ratingBps: 10_500,
            graduationTargetSupply: ctx.bn(2_500),
            reportId: Array.from(Keypair.generate().publicKey.toBytes()),
            reportDigest: Array(32).fill(0),
            observedAt: ctx.bn(ctx.nowTs() - 5),
          })
          .accounts({ oracle: ctx.oracle.publicKey, ...ratingAccounts })
          .signers([ctx.oracle])
          .rpc(),
      "InvalidReportDigest"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateCreatorS1Rating({
            ratingBps: 10_500,
            graduationTargetSupply: ctx.bn(2_500),
            reportId: Array.from(Keypair.generate().publicKey.toBytes()),
            reportDigest: REPORT_DIGEST,
            observedAt: ctx.bn(ctx.nowTs() + 3_600),
          })
          .accounts({ oracle: ctx.oracle.publicKey, ...ratingAccounts })
          .signers([ctx.oracle])
          .rpc(),
      "InvalidObservedAt"
    );

    await ctx.program.methods
      .updateCreatorS1Rating({
        ratingBps: 10_500,
        graduationTargetSupply: ctx.bn(2_500),
        reportId: Array.from(Keypair.generate().publicKey.toBytes()),
        reportDigest: REPORT_DIGEST,
        observedAt: ctx.bn(ctx.nowTs() - 5),
      })
      .accounts({ oracle: ctx.oracle.publicKey, ...ratingAccounts })
      .signers([ctx.oracle])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateProtocolS1Emission({
            dailySpumpEmissionMultiplierBps: 0,
            newUserEmissionBps: 2_500,
            newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
            s1MinUserXp: ctx.bn(10),
            maxS1DailyBuySpump: ctx.bn(15_000_000),
            s1EarlyCohortSupplyThreshold: ctx.bn(500),
            s1EarlyCohortBuyoutCapBps: 2_000,
            s1RageQuitWindowSeconds: ctx.bn(48 * 3_600),
            ...defaultRewardConfigArgs(ctx),
          })
          .accounts({ admin: ctx.payer.publicKey, protocolConfig: ctx.protocolConfig })
          .rpc(),
      "InvalidEmissionConfig"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .updateProtocolS1Emission({
            dailySpumpEmissionMultiplierBps: 50_000,
            newUserEmissionBps: 2_500,
            newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
            s1MinUserXp: ctx.bn(10),
            maxS1DailyBuySpump: ctx.bn(15_000_000),
            s1EarlyCohortSupplyThreshold: ctx.bn(500),
            s1EarlyCohortBuyoutCapBps: 2_000,
            s1RageQuitWindowSeconds: ctx.bn(48 * 3_600 + 1),
            ...defaultRewardConfigArgs(ctx),
          })
          .accounts({ admin: ctx.payer.publicKey, protocolConfig: ctx.protocolConfig })
          .rpc(),
      "InvalidS1GuardConfig"
    );
  });

  it("rejects S1 buy with wrong SPUMP account owner", async () => {
    const { creatorProfile } = await registerIsolatedCreator(ctx, "s1_wrong_ata");
    const otherUser = Keypair.generate();
    await fundSigner(ctx, otherUser);
    const otherSpumpAta = await createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      ctx.spumpMint,
      otherUser.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .buyS1Token({ amount: ctx.bn(1) })
          .accounts({
            user: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile: deriveUserProfile(ctx, ctx.fanA.publicKey),
            creatorProfile,
            s1UserPosition: deriveS1Position(ctx, ctx.fanA.publicKey, creatorProfile),
            userSpumpAta: otherSpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.fanA])
          .rpc(),
      "Unauthorized"
    );
  });
});

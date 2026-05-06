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
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

const USER_ROLE_FAN = 1 << 0;
const NONZERO_REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 1);

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
      systemProgram: SystemProgram.programId,
    })
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

  it("applies new-account emission discount on daily SPUMP claims", async () => {
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
    expect(tokenAccount.amount.toString()).to.equal("1250000");
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

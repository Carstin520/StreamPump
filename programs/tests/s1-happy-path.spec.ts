import { expect } from "chai";
import {
  createAssociatedTokenAccount,
  getAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
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
const REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 1);
const PRODUCTION_RAGE_QUIT_SECONDS = 48 * 3_600;
const TEST_RAGE_QUIT_SECONDS = 2;
const S1_REWARD_MODEL_EARLINESS_TIERED = 1;
const RESIDUAL_TO_CREATOR = 0;
const RESIDUAL_TO_SPONSOR = 1;
const DEFAULT_REWARD_CAP_USDC = 100_000_000;
const CAPPED_DISCOVERY_REWARD_USDC = 50_000_000;
const DEFAULT_STATUS_THANKYOU_USDC = 10_000_000;

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

const setS1RageQuitWindow = async (
  ctx: TestContext,
  seconds: number,
  rewardCapUsdc = DEFAULT_REWARD_CAP_USDC
): Promise<void> => {
  await ctx.program.methods
    .updateProtocolS1Emission({
      dailySpumpEmissionMultiplierBps: 50_000,
      newUserEmissionBps: 2_500,
      newUserEmissionWindowSeconds: ctx.bn(7 * 24 * 3_600),
      s1MinUserXp: ctx.bn(10),
      maxS1DailyBuySpump: ctx.bn(15_000_000),
      s1EarlyCohortSupplyThreshold: ctx.bn(500),
      s1EarlyCohortBuyoutCapBps: 2_000,
      s1RageQuitWindowSeconds: ctx.bn(seconds),
      s1BuyoutCreatorShareBps: 8_000,
      s1BuyoutRewardModel: S1_REWARD_MODEL_EARLINESS_TIERED,
      s1DiscoveryRewardCapUsdc: ctx.bn(rewardCapUsdc),
      s1StatusThankyouUsdc: ctx.bn(DEFAULT_STATUS_THANKYOU_USDC),
      s1BuyoutResidualTo: RESIDUAL_TO_CREATOR,
      s1DiscoveryMinHoldSeconds: ctx.bn(0),
      s1DiscoveryClaimWindowSeconds: ctx.bn(30 * 24 * 3_600),
      track2RewardCapUsdc: ctx.bn(DEFAULT_REWARD_CAP_USDC),
      track2ResidualTo: RESIDUAL_TO_SPONSOR,
    })
    .accounts({
      admin: ctx.payer.publicKey,
      protocolConfig: ctx.protocolConfig,
    })
    .rpc();
};

describe("streampump-core S1 happy path", function () {
  this.timeout(420_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
  });

  it("graduates an S1 creator through buyout and pays capped non-proportional discovery rewards", async () => {
    await setS1RageQuitWindow(ctx, TEST_RAGE_QUIT_SECONDS, CAPPED_DISCOVERY_REWARD_USDC);

    try {
      const creator = Keypair.generate();
      const sponsor = Keypair.generate();
      await fundSigner(ctx, creator);
      await fundSigner(ctx, sponsor);

      const creatorUsdcAta = await createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        ctx.usdcMint,
        creator.publicKey
      );
      const creatorSpumpAta = await createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        ctx.spumpMint,
        creator.publicKey,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      const sponsorUsdcAta = await createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        ctx.usdcMint,
        sponsor.publicKey
      );

      await mintTo(
        ctx.connection,
        ctx.payer,
        ctx.usdcMint,
        sponsorUsdcAta,
        ctx.payer.publicKey,
        1_000_000_000n,
        [],
        undefined,
        TOKEN_PROGRAM_ID
      );

      const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);
      const creatorHandle = "s1_happy_creator";
      await ctx.program.methods
        .registerCreator({
          handle: creatorHandle,
          payoutUsdcAta: creatorUsdcAta,
        })
        .accounts({
          authority: creator.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ctx.creatorAuthPreInstruction(creator.publicKey, creatorHandle)])
        .signers([creator])
        .rpc();

      const fans = await Promise.all(
        Array.from({ length: 2 }, async () => {
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
          const usdcAta = await createAssociatedTokenAccount(
            ctx.connection,
            ctx.payer,
            ctx.usdcMint,
            fan.publicKey
          );
          const s1Position = deriveS1Position(ctx, fan.publicKey, creatorProfile);

          await ctx.program.methods
            .registerUser({
              roleFlags: USER_ROLE_FAN,
            })
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
              rewardAmount: ctx.bn(20_000_000),
              xpGain: ctx.bn(10),
              newLevel: null,
              reportId,
              reportDigest: REPORT_DIGEST,
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

          return { fan, userProfile, spumpAta, usdcAta, s1Position };
        })
      );

      const buyAmounts = [10, 40];
      for (let index = 0; index < fans.length; index += 1) {
        const fan = fans[index];
        await ctx.program.methods
          .buyS1Token({ amount: ctx.bn(buyAmounts[index]) })
          .accounts({
            user: fan.fan.publicKey,
            protocolConfig: ctx.protocolConfig,
            userProfile: fan.userProfile,
            creatorProfile,
            s1UserPosition: fan.s1Position,
            userSpumpAta: fan.spumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([fan.fan])
          .rpc();
      }

      let creatorAfterBuys = await ctx.program.account.creatorProfile.fetch(creatorProfile);
      expect(creatorAfterBuys.s1Supply.toString()).to.equal("50");
      expect(creatorAfterBuys.s1EarlyCohortSupply.toString()).to.equal("50");
      expect(creatorAfterBuys.s1EligibleHolderCount).to.equal(2);
      expect(creatorAfterBuys.s1EarlyHolderCount).to.equal(2);
      expect(creatorAfterBuys.s1RegularHolderCount).to.equal(0);

      await ctx.program.methods
        .initS1Buyout()
        .accounts({
          creator: creator.publicKey,
          creatorProfile,
        })
        .signers([creator])
        .rpc();

      const buyoutOffer = ctx.deriveBuyoutOffer(sponsor.publicKey, creatorProfile);
      const offerUsdcVault = ctx.deriveOfferUsdcVault(buyoutOffer);
      const s1BuyoutState = ctx.deriveS1BuyoutState(creatorProfile);

      await ctx.program.methods
        .submitBuyoutOffer({ usdcAmount: ctx.bn(1_000_000_000) })
        .accounts({
          sponsor: sponsor.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          buyoutOffer,
          sponsorUsdcAta,
          offerUsdcVault,
          usdcMint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([sponsor])
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

      const acceptedBuyout = await ctx.program.account.s1BuyoutState.fetch(s1BuyoutState);
      await ctx.waitUntilDeadline(acceptedBuyout.rageQuitDeadline);

      await ctx.program.methods
        .executeS1Graduation()
        .accounts({
          executor: ctx.oracle.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          buyoutOffer,
          offerUsdcVault,
          creatorUsdcAta,
          creatorRevenueSpumpAta: creatorSpumpAta,
          spumpMint: ctx.spumpMint,
          usdcMint: ctx.usdcMint,
          spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.oracle])
        .rpc();

      const graduatedCreator = await ctx.program.account.creatorProfile.fetch(creatorProfile);
      expect(ctx.enumKey(graduatedCreator.status)).to.equal("s2Active");
      expect(graduatedCreator.level).to.be.greaterThanOrEqual(2);

      const graduatedBuyout = await ctx.program.account.s1BuyoutState.fetch(s1BuyoutState);
      expect(graduatedBuyout.creatorPayoutUsdc.toString()).to.equal("800000000");
      expect(graduatedBuyout.discoveryPoolUsdc.toString()).to.equal("200000000");
      expect(graduatedBuyout.discoveryPoolRemaining.toString()).to.equal("200000000");
      expect(graduatedBuyout.eligibleHolderCount).to.equal(2);
      expect(graduatedBuyout.earlyHolderCount).to.equal(2);
      expect(graduatedBuyout.regularHolderCount).to.equal(0);
      const creatorUsdcAfterGraduation = await getAccount(ctx.connection, creatorUsdcAta);
      expect(creatorUsdcAfterGraduation.amount.toString()).to.equal("800000000");

      const earlyFan = fans[0];
      await ctx.program.methods
        .claimS1BuyoutUsdc()
        .accounts({
          user: earlyFan.fan.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          s1UserPosition: earlyFan.s1Position,
          buyoutOffer,
          offerUsdcVault,
          creatorUsdcAta,
          userUsdcAta: earlyFan.usdcAta,
          sponsorUsdcAta,
          sponsor: sponsor.publicKey,
          usdcMint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([earlyFan.fan])
        .rpc();

      const earlyFanUsdc = await getAccount(ctx.connection, earlyFan.usdcAta);
      expect(earlyFanUsdc.amount.toString()).to.equal("50000000");
      const earlyPosition = await ctx.program.account.s1UserPosition.fetch(earlyFan.s1Position);
      expect(earlyPosition.internalTokenBalance.toString()).to.equal("0");

      const secondEarlyFan = fans[1];
      await ctx.program.methods
        .claimS1BuyoutUsdc()
        .accounts({
          user: secondEarlyFan.fan.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          s1UserPosition: secondEarlyFan.s1Position,
          buyoutOffer,
          offerUsdcVault,
          creatorUsdcAta,
          userUsdcAta: secondEarlyFan.usdcAta,
          sponsorUsdcAta,
          sponsor: sponsor.publicKey,
          usdcMint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([secondEarlyFan.fan])
        .rpc();

      const secondEarlyFanUsdc = await getAccount(ctx.connection, secondEarlyFan.usdcAta);
      expect(secondEarlyFanUsdc.amount.toString()).to.equal(earlyFanUsdc.amount.toString());
      const secondEarlyPosition = await ctx.program.account.s1UserPosition.fetch(
        secondEarlyFan.s1Position
      );
      expect(secondEarlyPosition.internalTokenBalance.toString()).to.equal("0");
      const creatorUsdcAfterResidual = await getAccount(ctx.connection, creatorUsdcAta);
      expect(creatorUsdcAfterResidual.amount.toString()).to.equal("900000000");
      const buyoutAfterResidual = await ctx.program.account.s1BuyoutState.fetch(s1BuyoutState);
      expect(buyoutAfterResidual.discoveryPoolRemaining.toString()).to.equal("0");
      const closedVaultInfo = await ctx.connection.getAccountInfo(offerUsdcVault);
      expect(closedVaultInfo).to.equal(null);
    } finally {
      await setS1RageQuitWindow(ctx, PRODUCTION_RAGE_QUIT_SECONDS);
    }
  });
});

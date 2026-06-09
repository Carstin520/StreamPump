import { expect } from "chai";
import {
  createAssociatedTokenAccount,
  getAccount,
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
const REPORT_DIGEST = Array.from({ length: 32 }, (_, index) => index + 9);
const PRODUCTION_RAGE_QUIT_SECONDS = 48 * 3_600;
const TEST_RAGE_QUIT_SECONDS = 2;

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

const setS1RageQuitWindow = async (ctx: TestContext, seconds: number): Promise<void> => {
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
    })
    .accounts({ admin: ctx.payer.publicKey, protocolConfig: ctx.protocolConfig })
    .rpc();
};

const registerCreator = async (
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

const ensureFanProfile = async (ctx: TestContext): Promise<void> => {
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

const openAuction = async (
  ctx: TestContext,
  creator: Keypair,
  creatorProfile: PublicKey
): Promise<void> => {
  await ctx.program.methods
    .initS1Buyout()
    .accounts({ creator: creator.publicKey, creatorProfile })
    .signers([creator])
    .rpc();
};

const submitOffer = async (
  ctx: TestContext,
  creatorProfile: PublicKey,
  sponsor = ctx.sponsorB,
  sponsorUsdcAta = ctx.sponsorBUsdcAta,
  usdcAmount = 1_000_000
): Promise<{ buyoutOffer: PublicKey; offerUsdcVault: PublicKey }> => {
  const buyoutOffer = ctx.deriveBuyoutOffer(sponsor.publicKey, creatorProfile);
  const offerUsdcVault = ctx.deriveOfferUsdcVault(buyoutOffer);
  await ctx.program.methods
    .submitBuyoutOffer({ usdcAmount: ctx.bn(usdcAmount) })
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

  return { buyoutOffer, offerUsdcVault };
};

const acceptOffer = async (
  ctx: TestContext,
  creator: Keypair,
  creatorProfile: PublicKey,
  buyoutOffer: PublicKey,
  offerUsdcVault: PublicKey
): Promise<PublicKey> => {
  const s1BuyoutState = ctx.deriveS1BuyoutState(creatorProfile);
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
  return s1BuyoutState;
};

describe("streampump-core S1 buyout unhappy paths", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
    await ensureFanProfile(ctx);
  });

  it("rejects invalid auction and offer submissions without moving funds twice", async () => {
    const { creator, creatorProfile } = await registerCreator(ctx, "buyout_offer");

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .submitBuyoutOffer({ usdcAmount: ctx.bn(1_000_000) })
          .accounts({
            sponsor: ctx.sponsorB.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            buyoutOffer: ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile),
            sponsorUsdcAta: ctx.sponsorBUsdcAta,
            offerUsdcVault: ctx.deriveOfferUsdcVault(
              ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile)
            ),
            usdcMint: ctx.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.sponsorB])
          .rpc(),
      "InvalidCreatorStatus"
    );

    await openAuction(ctx, creator, creatorProfile);
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .initS1Buyout()
          .accounts({ creator: creator.publicKey, creatorProfile })
          .signers([creator])
          .rpc(),
      "InvalidCreatorStatus"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .submitBuyoutOffer({ usdcAmount: ctx.bn(0) })
          .accounts({
            sponsor: ctx.sponsorB.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            buyoutOffer: ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile),
            sponsorUsdcAta: ctx.sponsorBUsdcAta,
            offerUsdcVault: ctx.deriveOfferUsdcVault(
              ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile)
            ),
            usdcMint: ctx.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.sponsorB])
          .rpc(),
      "InvalidAmount"
    );
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .submitBuyoutOffer({ usdcAmount: ctx.bn(1_000_000) })
          .accounts({
            sponsor: ctx.sponsorB.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            buyoutOffer: ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile),
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            offerUsdcVault: ctx.deriveOfferUsdcVault(
              ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile)
            ),
            usdcMint: ctx.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.sponsorB])
          .rpc(),
      "Unauthorized"
    );

    const sponsorBefore = await ctx.tokenAmount(ctx.sponsorBUsdcAta, TOKEN_PROGRAM_ID);
    const { buyoutOffer, offerUsdcVault } = await submitOffer(ctx, creatorProfile);
    const vaultAfterFirst = await getAccount(ctx.connection, offerUsdcVault);
    expect(vaultAfterFirst.amount.toString()).to.equal("1000000");

    let duplicateError: unknown = null;
    try {
      await submitOffer(ctx, creatorProfile);
    } catch (error) {
      duplicateError = error;
    }
    expect(String(duplicateError)).to.match(/already in use|custom program error|0x0/i);
    const sponsorAfter = await ctx.tokenAmount(ctx.sponsorBUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorBefore - sponsorAfter).to.equal(1_000_000n);

    const offer = await ctx.program.account.s1BuyoutOffer.fetch(buyoutOffer);
    expect(offer.usdcAmount.toString()).to.equal("1000000");
  });

  it("rejects invalid accept, rage quit, graduation, claim, cancel, and reclaim states", async () => {
    await setS1RageQuitWindow(ctx, TEST_RAGE_QUIT_SECONDS);
    try {
      const { creator, creatorProfile, creatorSpumpAta } = await registerCreator(
        ctx,
        "buyout_state"
      );
      const position = await buyS1(ctx, creatorProfile, 25);

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .rageQuitS1({ amount: ctx.bn(1) })
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState: ctx.deriveS1BuyoutState(creatorProfile),
              s1UserPosition: position,
              userSpumpAta: ctx.fanASpumpAta,
              spumpMint: ctx.spumpMint,
              spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "AccountNotInitialized"
      );

      await openAuction(ctx, creator, creatorProfile);
      const loser = await submitOffer(ctx, creatorProfile, ctx.sponsorA, ctx.sponsorAUsdcAta, 500_000);
      const winner = await submitOffer(ctx, creatorProfile);

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .reclaimExpiredBuyoutOffer()
            .accounts({
              sponsor: ctx.sponsorA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              buyoutOffer: loser.buyoutOffer,
              sponsorUsdcAta: ctx.sponsorAUsdcAta,
              offerUsdcVault: loser.offerUsdcVault,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([ctx.sponsorA])
            .rpc(),
        "BuyoutOfferStillLocked"
      );

      const s1BuyoutState = await acceptOffer(
        ctx,
        creator,
        creatorProfile,
        winner.buyoutOffer,
        winner.offerUsdcVault
      );

      let repeatAcceptError: unknown = null;
      try {
        await ctx.program.methods
          .acceptBuyoutOffer()
          .accounts({
            creator: creator.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            buyoutOffer: loser.buyoutOffer,
            offerUsdcVault: loser.offerUsdcVault,
            s1BuyoutState,
            usdcMint: ctx.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
      } catch (error) {
        repeatAcceptError = error;
      }
      expect(String(repeatAcceptError)).to.match(/already in use|custom program error|0x0/i);

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .rageQuitS1({ amount: ctx.bn(0) })
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              userSpumpAta: ctx.fanASpumpAta,
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
            .rageQuitS1({ amount: ctx.bn(26) })
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              userSpumpAta: ctx.fanASpumpAta,
              spumpMint: ctx.spumpMint,
              spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "InsufficientInternalTokenBalance"
      );

      await ctx.program.methods
        .rageQuitS1({ amount: ctx.bn(5) })
        .accounts({
          user: ctx.fanA.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          s1UserPosition: position,
          userSpumpAta: ctx.fanASpumpAta,
          spumpMint: ctx.spumpMint,
          spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.fanA])
        .rpc();

      const creatorAfterRageQuit = await ctx.program.account.creatorProfile.fetch(creatorProfile);
      const positionAfterRageQuit = await ctx.program.account.s1UserPosition.fetch(position);
      expect(creatorAfterRageQuit.s1Supply.toString()).to.equal("20");
      expect(positionAfterRageQuit.internalTokenBalance.toString()).to.equal("20");

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .executeS1Graduation()
            .accounts({
              executor: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              creatorRevenueSpumpAta: creatorSpumpAta,
              spumpMint: ctx.spumpMint,
              spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "RageQuitWindowStillOpen"
      );
      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .claimS1BuyoutUsdc()
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              buyoutOffer: winner.buyoutOffer,
              offerUsdcVault: winner.offerUsdcVault,
              userUsdcAta: ctx.fanAUsdcAta,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "InvalidCreatorStatus"
      );

      const acceptedBuyout = await ctx.program.account.s1BuyoutState.fetch(s1BuyoutState);
      await ctx.waitUntilDeadline(acceptedBuyout.rageQuitDeadline);

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .rageQuitS1({ amount: ctx.bn(1) })
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              userSpumpAta: ctx.fanASpumpAta,
              spumpMint: ctx.spumpMint,
              spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "RageQuitWindowNotActive"
      );

      await ctx.program.methods
        .executeS1Graduation()
        .accounts({
          executor: ctx.fanA.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          creatorRevenueSpumpAta: creatorSpumpAta,
          spumpMint: ctx.spumpMint,
          spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.fanA])
        .rpc();

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .claimS1BuyoutUsdc()
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              buyoutOffer: loser.buyoutOffer,
              offerUsdcVault: loser.offerUsdcVault,
              userUsdcAta: ctx.fanAUsdcAta,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "BuyoutOfferMismatch"
      );
      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .cancelBuyoutOffer()
            .accounts({
              sponsor: ctx.sponsorB.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              buyoutOffer: winner.buyoutOffer,
              sponsorUsdcAta: ctx.sponsorBUsdcAta,
              offerUsdcVault: winner.offerUsdcVault,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([ctx.sponsorB])
            .rpc(),
        "WinningOfferCannotCancel"
      );

      await ctx.program.methods
        .claimS1BuyoutUsdc()
        .accounts({
          user: ctx.fanA.publicKey,
          protocolConfig: ctx.protocolConfig,
          creatorProfile,
          s1BuyoutState,
          s1UserPosition: position,
          buyoutOffer: winner.buyoutOffer,
          offerUsdcVault: winner.offerUsdcVault,
          userUsdcAta: ctx.fanAUsdcAta,
          usdcMint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.fanA])
        .rpc();

      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .claimS1BuyoutUsdc()
            .accounts({
              user: ctx.fanA.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: position,
              buyoutOffer: winner.buyoutOffer,
              offerUsdcVault: winner.offerUsdcVault,
              userUsdcAta: ctx.fanAUsdcAta,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([ctx.fanA])
            .rpc(),
        "InsufficientInternalTokenBalance"
      );

      const emptyUser = Keypair.generate();
      await fundSigner(ctx, emptyUser);
      const emptyUserUsdcAta = await createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        ctx.usdcMint,
        emptyUser.publicKey,
        undefined,
        TOKEN_PROGRAM_ID
      );
      const emptyPosition = deriveS1Position(ctx, emptyUser.publicKey, creatorProfile);
      await ctx.expectAnchorError(
        () =>
          ctx.program.methods
            .claimS1BuyoutUsdc()
            .accounts({
              user: emptyUser.publicKey,
              protocolConfig: ctx.protocolConfig,
              creatorProfile,
              s1BuyoutState,
              s1UserPosition: emptyPosition,
              buyoutOffer: winner.buyoutOffer,
              offerUsdcVault: winner.offerUsdcVault,
              userUsdcAta: emptyUserUsdcAta,
              usdcMint: ctx.usdcMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([emptyUser])
            .rpc(),
        "AccountNotInitialized"
      );
    } finally {
      await setS1RageQuitWindow(ctx, PRODUCTION_RAGE_QUIT_SECONDS);
    }
  });

  it("aborts an accepted buyout when all S1 holders rage quit", async () => {
    const { creator, creatorProfile } = await registerCreator(ctx, "buyout_abort");
    const position = await buyS1(ctx, creatorProfile, 25);

    await openAuction(ctx, creator, creatorProfile);
    const loser = await submitOffer(ctx, creatorProfile, ctx.sponsorA, ctx.sponsorAUsdcAta, 500_000);
    const winner = await submitOffer(ctx, creatorProfile, ctx.sponsorB, ctx.sponsorBUsdcAta, 1_000_000);
    const s1BuyoutState = await acceptOffer(
      ctx,
      creator,
      creatorProfile,
      winner.buyoutOffer,
      winner.offerUsdcVault
    );

    await ctx.program.methods
      .rageQuitS1({ amount: ctx.bn(25) })
      .accounts({
        user: ctx.fanA.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        s1BuyoutState,
        s1UserPosition: position,
        userSpumpAta: ctx.fanASpumpAta,
        spumpMint: ctx.spumpMint,
        spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([ctx.fanA])
      .rpc();

    const creatorAfterExit = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(creatorAfterExit.s1Supply.toString()).to.equal("0");

    await ctx.expectAnchorError(
      () =>
        (ctx.program.methods as any)
          .abortS1Buyout()
          .accounts({
            sponsor: ctx.sponsorA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            s1BuyoutState,
            buyoutOffer: loser.buyoutOffer,
            sponsorUsdcAta: ctx.sponsorAUsdcAta,
            offerUsdcVault: loser.offerUsdcVault,
            usdcMint: ctx.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.sponsorA])
          .rpc(),
      "Unauthorized"
    );

    const sponsorBeforeAbort = await ctx.tokenAmount(ctx.sponsorBUsdcAta, TOKEN_PROGRAM_ID);
    await (ctx.program.methods as any)
      .abortS1Buyout()
      .accounts({
        sponsor: ctx.sponsorB.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        s1BuyoutState,
        buyoutOffer: winner.buyoutOffer,
        sponsorUsdcAta: ctx.sponsorBUsdcAta,
        offerUsdcVault: winner.offerUsdcVault,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.sponsorB])
      .rpc();

    const sponsorAfterAbort = await ctx.tokenAmount(ctx.sponsorBUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorAfterAbort - sponsorBeforeAbort).to.equal(1_000_000n);

    const creatorAfterAbort = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(ctx.enumKey(creatorAfterAbort.status)).to.equal("s1Active");
    expect(await ctx.connection.getAccountInfo(s1BuyoutState)).to.equal(null);
    expect(await ctx.connection.getAccountInfo(winner.buyoutOffer)).to.equal(null);
    expect(await ctx.connection.getAccountInfo(winner.offerUsdcVault)).to.equal(null);
  });
});

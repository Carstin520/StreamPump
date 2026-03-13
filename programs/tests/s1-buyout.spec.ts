import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core S1 buyout", function () {
  this.timeout(300_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
  });

  it("rejects execute_s1_graduation while rage-quit window is still open", async () => {
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS1.publicKey);
    const buyoutOffer = ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile);
    const offerUsdcVault = ctx.deriveOfferUsdcVault(buyoutOffer);
    const s1BuyoutState = ctx.deriveS1BuyoutState(creatorProfile);

    await ctx.program.methods
      .initS1Buyout()
      .accounts({
        creator: ctx.creatorS1.publicKey,
        creatorProfile,
      })
      .signers([ctx.creatorS1])
      .rpc();

    await ctx.program.methods
      .submitBuyoutOffer({ usdcAmount: ctx.bn(250_000) })
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
        creator: ctx.creatorS1.publicKey,
        protocolConfig: ctx.protocolConfig,
        creatorProfile,
        buyoutOffer,
        offerUsdcVault,
        s1BuyoutState,
        usdcMint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.creatorS1])
      .rpc();

    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .executeS1Graduation()
          .accounts({
            executor: ctx.fanA.publicKey,
            protocolConfig: ctx.protocolConfig,
            creatorProfile,
            s1BuyoutState,
            creatorRevenueSpumpAta: ctx.creatorS1SpumpAta,
            spumpMint: ctx.spumpMint,
            spumpTokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.fanA])
          .rpc(),
      "RageQuitWindowStillOpen"
    );

    const creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(ctx.enumKey(creatorAfter.status)).to.equal("s1ExecutionPending");
  });
});

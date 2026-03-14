/**
 * =============================================================================
 * StreamPump — S1 Buyout Test Suite
 * StreamPump — S1 收购测试套件
 *
 * Tests the Season 1 buyout lifecycle, specifically verifying that:
 * 测试 Season 1 收购生命周期，特别验证：
 *
 *   - A sponsor can submit a USDC buyout offer for a creator
 *     赞助商可以为创作者提交 USDC 收购出价
 *   - The creator can accept the offer, opening a 48h rage-quit window
 *     创作者可以接受出价，开启 48 小时愤怒退出窗口
 *   - execute_s1_graduation is REJECTED while the rage-quit window is open
 *     在愤怒退出窗口开放期间，execute_s1_graduation 应被拒绝
 *   - The creator remains in `s1ExecutionPending` status
 *     创作者保持在 `s1ExecutionPending` 状态
 *
 * This test uses a shared TestContext (from helpers/test_context) that
 * pre-creates all mints, ATAs, protocol config, and role keypairs.
 * 此测试使用共享的 TestContext（来自 helpers/test_context），
 * 其中预先创建了所有铸币、ATA、协议配置和角色密钥对。
 * =============================================================================
 */

import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core S1 buyout", function () {
  // Allow up to 5 minutes for the full suite (includes one-time setup)
  // 整个套件最多允许 5 分钟（包括一次性设置）
  this.timeout(300_000);

  let ctx: TestContext;

  // Shared setup: initialize the full on-chain environment once
  // 共享设置：一次性初始化完整的链上环境
  before(async () => {
    ctx = await getTestContext();
  });

  // ---------------------------------------------------------------------------
  // Test: Rage-quit window must expire before graduation can execute
  // 测试：愤怒退出窗口必须过期后才能执行毕业
  //
  // Flow / 流程:
  //   1. init_s1_buyout — creator opens themselves to buyout offers
  //      init_s1_buyout — 创作者开放自己接受收购出价
  //   2. submit_buyout_offer — sponsor B escrows 250,000 USDC
  //      submit_buyout_offer — 赞助商 B 托管 250,000 USDC
  //   3. accept_buyout_offer — creator accepts; rage-quit window starts
  //      accept_buyout_offer — 创作者接受；愤怒退出窗口开始
  //   4. execute_s1_graduation — should FAIL with `RageQuitWindowStillOpen`
  //      execute_s1_graduation — 应失败，错误为 `RageQuitWindowStillOpen`
  //   5. Verify creator status remains `s1ExecutionPending`
  //      验证创作者状态保持为 `s1ExecutionPending`
  // ---------------------------------------------------------------------------
  it("rejects execute_s1_graduation while rage-quit window is still open", async () => {
    // Derive all necessary PDAs for the S1 buyout flow
    // 推导 S1 收购流程所需的所有 PDA
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS1.publicKey);
    const buyoutOffer = ctx.deriveBuyoutOffer(ctx.sponsorB.publicKey, creatorProfile);
    const offerUsdcVault = ctx.deriveOfferUsdcVault(buyoutOffer);
    const s1BuyoutState = ctx.deriveS1BuyoutState(creatorProfile);

    // Step 1: Creator opens for buyout offers
    // 步骤 1：创作者开放接受收购出价
    await ctx.program.methods
      .initS1Buyout()
      .accounts({
        creator: ctx.creatorS1.publicKey,
        creatorProfile,
      })
      .signers([ctx.creatorS1])
      .rpc();

    // Step 2: Sponsor B submits a 250,000 USDC buyout offer
    // 步骤 2：赞助商 B 提交 250,000 USDC 的收购出价
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

    // Step 3: Creator accepts the offer → 48h rage-quit window begins
    // 步骤 3：创作者接受出价 → 48 小时愤怒退出窗口开始
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

    // Step 4: Try to graduate immediately — should fail because the
    // rage-quit window is still open (48h hasn't elapsed)
    // 步骤 4：尝试立即毕业 — 应该失败，因为愤怒退出窗口仍然开放（48 小时未满）
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

    // Step 5: Confirm creator is still pending execution, not graduated
    // 步骤 5：确认创作者仍处于待执行状态，未毕业
    const creatorAfter = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(ctx.enumKey(creatorAfter.status)).to.equal("s1ExecutionPending");
  });
});

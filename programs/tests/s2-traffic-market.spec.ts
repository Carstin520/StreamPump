/**
 * =============================================================================
 * StreamPump — S2 Traffic Market Test Suite
 * StreamPump — S2 流量市场测试套件
 *
 * Tests the Season 2 tri-track settlement lifecycle:
 * 测试 Season 2 三轨结算生命周期：
 *
 *   Test 1: Track 1 base pay + Track 2 success → fan USDC + SPUMP claim
 *   测试 1：Track 1 基础报酬 + Track 2 成功 → 粉丝领取 USDC + SPUMP
 *
 *   Test 2: Track 2 failure → 95% SPUMP refund (5% slash)
 *   测试 2：Track 2 失败 → 95% SPUMP 退还（5% 罚没）
 *
 *   Test 3: Track 3 CPS settlement → correct creator/sponsor split
 *   测试 3：Track 3 CPS 结算 → 正确的创作者/赞助商分配
 *
 *   Test 4: Emergency void → full vault refund + 100% SPUMP return
 *   测试 4：紧急作废 → 完全退回资金库 + 100% SPUMP 退还
 *
 * Prerequisites handled by TestContext:
 * TestContext 已处理的前置条件：
 *   - creatorS2 is registered and pre-upgraded to level 2 (S2-eligible)
 *     creatorS2 已注册并预先升级到 2 级（具备 S2 资格）
 *   - sponsorA has USDC, fanA has SPUMP
 *     sponsorA 持有 USDC，fanA 持有 SPUMP
 *   - Protocol config and mint authorities are initialized
 *     协议配置和铸币权限已初始化
 * =============================================================================
 */

import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { getTestContext, type TestContext } from "./helpers/test_context";

describe("streampump-core S2 traffic market", function () {
  // Allow up to 5 minutes (tests involve waiting for deadlines)
  // 最多允许 5 分钟（测试涉及等待截止时间）
  this.timeout(300_000);

  let ctx: TestContext;

  // --------------------------------------------------------------------
  // Suite setup: get shared context and verify creatorS2 is S2-ready
  // 套件设置：获取共享上下文并验证 creatorS2 已具备 S2 资格
  // --------------------------------------------------------------------
  before(async () => {
    ctx = await getTestContext();
    const creatorProfile = ctx.deriveCreatorProfile(ctx.creatorS2.publicKey);
    const upgraded = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    // Ensure creator is at level 2 (graduated from S1)
    // 确保创作者处于 2 级（已从 S1 毕业）
    expect(upgraded.level).to.equal(2);
    // Ensure creator status is S2 active
    // 确保创作者状态为 S2 活跃
    expect(ctx.enumKey(upgraded.status)).to.equal("s2Active");
  });

  // =====================================================================
  // TEST 1: Track 1 base + Track 2 success → fan claim
  // 测试 1：Track 1 基础报酬 + Track 2 成功 → 粉丝领取
  //
  // Scenario / 场景:
  //   - Track 1 base: 100,000 USDC (fixed creator pay)
  //     Track 1 基础：100,000 USDC（固定创作者报酬）
  //   - Track 2 budget: 1,000,000 USDC, target: 1,000 views, cliff: 50%
  //     Track 2 预算：1,000,000 USDC，目标：1,000 次观看，悬崖：50%
  //   - Track 3 budget: 300,000 USDC (not settled in this test)
  //     Track 3 预算：300,000 USDC（本测试中不结算）
  //   - Fan stakes 200,000 SPUMP
  //     粉丝质押 200,000 SPUMP
  //   - Oracle reports actual_value = 800 (80% of target → passes cliff)
  //     预言机报告 actual_value = 800（目标的 80% → 通过悬崖）
  //
  // Expected outcomes / 预期结果:
  //   - Track 1: creator gets exactly 100,000 USDC
  //     Track 1：创作者获得恰好 100,000 USDC
  //   - Track 2: achieved_usdc = 1,000,000 × 800/1000 = 800,000
  //     Track 2：achieved_usdc = 1,000,000 × 800/1000 = 800,000
  //     - Unachieved 200,000 refunded to sponsor
  //       未达成的 200,000 退还给赞助商
  //     - Of 800,000: 80% (640,000) → creator, 20% (160,000) → fan pool
  //       800,000 中：80%（640,000）→ 创作者，20%（160,000）→ 粉丝池
  //   - Fan claims: 100% SPUMP principal minted back + 160,000 USDC share
  //     粉丝领取：100% SPUMP 本金铸回 + 160,000 USDC 份额
  // =====================================================================
  it("settles track1 base + track2 success and allows fan claim", async () => {
    // ----- Configuration / 配置 -----
    const track1Base = 100_000n;        // Fixed base pay / 固定基础报酬
    const track2Budget = 1_000_000n;    // Performance budget / 绩效预算
    const track3Budget = 300_000n;      // CPS budget / CPS 预算
    const track2Target = 1_000n;        // Target metric value / 目标指标值
    const stakeAmount = 200_000n;       // Fan's SPUMP endorsement / 粉丝的 SPUMP 背书量

    // Create a tri-track proposal and fund it in one call
    // 一次调用创建三轨提案并注资
    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target,
        track2MinAchievementBps: 5_000, // 50% cliff / 50% 悬崖门槛
      });

    // Derive the endorsement position PDA for fanA + this proposal
    // 推导 fanA 在此提案上的背书仓位 PDA
    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    // Snapshot balances before operations for later assertions
    // 在操作前快照余额，用于后续断言
    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const creatorUsdcBeforeBase = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);

    // ----- Fan endorses Track 2 by burning SPUMP -----
    // ----- 粉丝通过销毁 SPUMP 背书 Track 2 -----
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

    // ----- Oracle settles Track 1: fixed base pay to creator -----
    // ----- 预言机结算 Track 1：固定基础报酬支付给创作者 -----
    await ctx.program.methods
      .settleTrack1Base()
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    // Assert: creator received exactly track1Base USDC
    // 断言：创作者恰好收到了 track1Base USDC
    const creatorUsdcAfterBase = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    expect(creatorUsdcAfterBase - creatorUsdcBeforeBase).to.equal(track1Base);

    // ----- Verify Track 1 is one-time-only (replay protection) -----
    // ----- 验证 Track 1 是一次性的（防重放保护） -----
    await ctx.expectAnchorError(
      () =>
        ctx.program.methods
          .settleTrack1Base()
          .accounts({
            oracle: ctx.oracle.publicKey,
            protocolConfig: ctx.protocolConfig,
            proposal,
            proposalUsdcVault,
            creatorProfile,
            creatorUsdcAta: ctx.creatorS2UsdcAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.oracle])
          .rpc(),
      "ProposalAlreadySettled"
    );

    // Wait for the proposal deadline to pass before Track 2 settlement
    // 等待提案截止时间过去，然后进行 Track 2 结算
    await ctx.waitUntilDeadline(deadline);

    // ----- Oracle settles Track 2: actual_value = 800 / target = 1000 -----
    // ----- 预言机结算 Track 2：actual_value = 800 / target = 1000 -----
    //
    // Achievement = 800/1000 = 80% → above 50% cliff → SUCCESS
    // 达成率 = 800/1000 = 80% → 高于 50% 悬崖门槛 → 成功
    //
    // achieved_usdc = 1,000,000 × min(800,1000) / 1000 = 800,000
    // Unachieved = 1,000,000 - 800,000 = 200,000 → refunded to sponsor
    // 未达成 = 1,000,000 - 800,000 = 200,000 → 退还给赞助商
    // Creator gets: 800,000 × 80% = 640,000
    // 创作者获得：800,000 × 80% = 640,000
    // Fan pool gets: 800,000 × 20% = 160,000
    // 粉丝池获得：800,000 × 20% = 160,000
    const sponsorUsdcBeforeSettle = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    await ctx.program.methods
      .settleTrack2({ actualValue: ctx.bn(800) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    // Assert: sponsor received 200,000 USDC refund (unachieved portion)
    // 断言：赞助商收到 200,000 USDC 退款（未达成部分）
    const sponsorUsdcAfterSettle = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorUsdcAfterSettle - sponsorUsdcBeforeSettle).to.equal(200_000n);

    // Assert: proposal status is now `resolvedSuccess`
    // 断言：提案状态现在为 `resolvedSuccess`
    const proposalAfterSettle = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterSettle.status)).to.equal("resolvedSuccess");

    // Assert: track2UsdcDeposited reflects the fan pool share (160,000)
    // 断言：track2UsdcDeposited 反映粉丝池份额（160,000）
    expect(proposalAfterSettle.track2UsdcDeposited.toString()).to.equal("160000");

    // ----- Fan claims endorsement reward: SPUMP principal + USDC share -----
    // ----- 粉丝领取背书奖励：SPUMP 本金 + USDC 份额 -----
    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

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
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    // Assert: fan gets 100% SPUMP principal minted back (successful outcome)
    // 断言：粉丝获得 100% SPUMP 本金铸回（成功结果）
    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore);

    // Assert: fan gets 160,000 USDC (entire Track 2 fan pool, as sole endorser)
    // 断言：粉丝获得 160,000 USDC（整个 Track 2 粉丝池，作为唯一背书者）
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(160_000n);

    // Assert: endorsement position is marked as claimed (prevents double-claim)
    // 断言：背书仓位被标记为已领取（防止重复领取）
    const positionAfterClaim = await ctx.program.account.endorsementPosition.fetch(
      endorsementPosition
    );
    expect(positionAfterClaim.claimed).to.equal(true);
  });

  // =====================================================================
  // TEST 2: Track 2 failure → 95% SPUMP refund (5% slash)
  // 测试 2：Track 2 失败 → 95% SPUMP 退还（5% 罚没）
  //
  // Scenario / 场景:
  //   - Track 2: target = 1,000, cliff = 50% (5,000 bps)
  //     Track 2：目标 = 1,000，悬崖 = 50%（5,000 基点）
  //   - Oracle reports actual_value = 300 → 30% < 50% cliff → FAIL
  //     预言机报告 actual_value = 300 → 30% < 50% 悬崖 → 失败
  //   - Sponsor gets 100% Track 2 budget back
  //     赞助商获得 100% 的 Track 2 预算退还
  //   - Fan claims: only 95% SPUMP minted back, 5% permanently slashed
  //     粉丝领取：只有 95% SPUMP 铸回，5% 永久罚没
  //   - No USDC payout to fan on failure
  //     失败时粉丝不获得 USDC 支付
  // =====================================================================
  it("settles track2 fail branch and returns 95% SPUMP on claim", async () => {
    // ----- Configuration / 配置 -----
    const track1Base = 50_000n;
    const track2Budget = 500_000n;
    const track3Budget = 200_000n;
    const track2Target = 1_000n;
    const stakeAmount = 120_000n;    // Fan stakes 120,000 SPUMP / 粉丝质押 120,000 SPUMP

    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target,
        track2MinAchievementBps: 5_000, // 50% cliff / 50% 悬崖门槛
      });

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    // Snapshot balances before endorsement
    // 在背书前快照余额
    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    // Fan endorses Track 2 / 粉丝背书 Track 2
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

    // Wait for deadline to pass / 等待截止时间过去
    await ctx.waitUntilDeadline(deadline);

    // ----- Oracle settles Track 2: actual = 300, below 50% cliff → FAIL -----
    // ----- 预言机结算 Track 2：实际 = 300，低于 50% 悬崖 → 失败 -----
    //
    // 300 / 1000 = 30% achievement < 50% cliff → Resolved_Fail
    // 300 / 1000 = 30% 达成率 < 50% 悬崖 → 结算失败
    // Sponsor gets 100% of track2 budget refunded
    // 赞助商获得 100% 的 track2 预算退还
    await ctx.program.methods
      .settleTrack2({ actualValue: ctx.bn(300) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    // Assert: proposal status = `resolvedFail`
    // 断言：提案状态 = `resolvedFail`
    const proposalAfterSettle = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterSettle.status)).to.equal("resolvedFail");

    // Assert: track2UsdcDeposited reset to 0 (everything refunded to sponsor)
    // 断言：track2UsdcDeposited 重置为 0（全部退还给赞助商）
    expect(proposalAfterSettle.track2UsdcDeposited.toNumber()).to.equal(0);

    // ----- Fan claims: 95% SPUMP back, 0 USDC -----
    // ----- 粉丝领取：95% SPUMP 退还，0 USDC -----
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
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    // Calculate the 5% slash (500 bps penalty for failed endorsement)
    // 计算 5% 的罚没（失败背书的 500 基点惩罚）
    // expectedSlash = 120,000 × 500 / 10,000 = 6,000 SPUMP permanently lost
    // expectedSlash = 120,000 × 500 / 10,000 = 6,000 SPUMP 永久损失
    const expectedSlash = (stakeAmount * 500n) / 10_000n;

    // Assert: fan gets back original balance minus the slash
    // 断言：粉丝取回原始余额减去罚没部分
    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore - expectedSlash);

    // Assert: no USDC payout on failure
    // 断言：失败时无 USDC 支付
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(0n);
  });

  // =====================================================================
  // TEST 3: Track 3 CPS settlement → creator/sponsor split
  // 测试 3：Track 3 CPS 结算 → 创作者/赞助商分配
  //
  // Scenario / 场景:
  //   - Track 3 budget: 600,000 USDC, delay = 0 days (for fast tests)
  //     Track 3 预算：600,000 USDC，延迟 = 0 天（用于快速测试）
  //   - Oracle reports approved CPS payout = 250,000 USDC
  //     预言机报告批准的 CPS 支付 = 250,000 USDC
  //   - Creator receives 250,000, sponsor refunded 350,000
  //     创作者获得 250,000，赞助商退还 350,000
  //
  // Track 3 is independent of Track 2 — fans do not participate.
  // Track 3 独立于 Track 2 — 粉丝不参与。
  // Delayed by track3_delay_days after the proposal deadline.
  // 在提案截止后延迟 track3_delay_days 天。
  // =====================================================================
  it("settles track3 CPS and splits approved payout/refund correctly", async () => {
    const track1Base = 30_000n;
    const track2Budget = 200_000n;
    const track3Budget = 600_000n;         // Total CPS budget / 总 CPS 预算
    const approvedCpsPayout = 250_000n;    // Oracle-approved commission / 预言机批准的佣金

    const { creatorProfile, proposal, proposalUsdcVault, deadline } =
      await ctx.createFundedProposal({
        creator: ctx.creatorS2,
        sponsor: ctx.sponsorA,
        track1Base,
        track2Amount: track2Budget,
        track3Amount: track3Budget,
        track2Target: 1_000n,
        track2MinAchievementBps: 5_000,
        track3DelayDays: 0,               // No delay for test speed / 无延迟以加快测试
      });

    // Wait for deadline to pass (Track 3 settlement requires deadline + delay)
    // 等待截止时间过去（Track 3 结算需要截止时间 + 延迟）
    await ctx.waitUntilDeadline(deadline);

    // Snapshot balances before settlement
    // 在结算前快照余额
    const creatorUsdcBefore = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    const sponsorUsdcBefore = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);

    // ----- Oracle settles Track 3: approved CPS payout -----
    // ----- 预言机结算 Track 3：批准的 CPS 支付 -----
    //
    // Creator gets: 250,000 USDC (approved commission)
    // 创作者获得：250,000 USDC（批准的佣金）
    // Sponsor refund: 600,000 - 250,000 = 350,000 USDC
    // 赞助商退还：600,000 - 250,000 = 350,000 USDC
    await ctx.program.methods
      .settleTrack3Cps({ approvedCpsPayout: ctx.bn(approvedCpsPayout) })
      .accounts({
        oracle: ctx.oracle.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        creatorProfile,
        creatorUsdcAta: ctx.creatorS2UsdcAta,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.oracle])
      .rpc();

    const creatorUsdcAfter = await ctx.tokenAmount(ctx.creatorS2UsdcAta, TOKEN_PROGRAM_ID);
    const sponsorUsdcAfter = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    const expectedRefund = track3Budget - approvedCpsPayout; // 350,000

    // Assert: creator received exactly the approved CPS payout
    // 断言：创作者恰好收到了批准的 CPS 支付
    expect(creatorUsdcAfter - creatorUsdcBefore).to.equal(approvedCpsPayout);

    // Assert: sponsor received the unused budget back
    // 断言：赞助商收回了未使用的预算
    expect(sponsorUsdcAfter - sponsorUsdcBefore).to.equal(expectedRefund);

    // Assert: on-chain state records the CPS payout and settlement timestamp
    // 断言：链上状态记录了 CPS 支付和结算时间戳
    const proposalAfter = await ctx.program.account.proposal.fetch(proposal);
    expect(proposalAfter.track3CpsPayout?.toString()).to.equal(approvedCpsPayout.toString());
    expect(proposalAfter.track3SettledAt.toNumber()).to.be.greaterThan(0);
  });

  // =====================================================================
  // TEST 4: Emergency void → full vault refund + 100% SPUMP return
  // 测试 4：紧急作废 → 完全退回资金库 + 100% SPUMP 退还
  //
  // Scenario / 场景:
  //   - Admin triggers `emergency_void` on a funded proposal
  //     管理员对已注资的提案触发 `emergency_void`
  //   - ALL remaining USDC in the vault is returned to sponsor
  //     资金库中所有剩余 USDC 退还给赞助商
  //   - Proposal status → `Voided`, all tracks zeroed out
  //     提案状态 → `Voided`，所有轨道归零
  //   - Fan claims: 100% SPUMP minted back (no penalty for cancelled proposals)
  //     粉丝领取：100% SPUMP 铸回（取消的提案无惩罚）
  //   - No USDC payout to fan
  //     粉丝不获得 USDC 支付
  // =====================================================================
  it("emergency_void refunds vault and still allows 100% SPUMP claim", async () => {
    const track1Base = 70_000n;
    const track2Budget = 400_000n;
    const track3Budget = 500_000n;
    const track2Target = 1_000n;
    const stakeAmount = 90_000n;        // Fan stakes 90,000 SPUMP / 粉丝质押 90,000 SPUMP

    const { proposal, proposalUsdcVault, deadline } = await ctx.createFundedProposal({
      creator: ctx.creatorS2,
      sponsor: ctx.sponsorA,
      track1Base,
      track2Amount: track2Budget,
      track3Amount: track3Budget,
      track2Target,
      track2MinAchievementBps: 5_000,
      deadlineOffsetSeconds: 10,         // Longer deadline for void to happen before it / 更长截止时间以确保在到期前作废
    });

    const endorsementPosition = ctx.deriveEndorsementPosition(ctx.fanA.publicKey, proposal);

    // Snapshot balances before operations
    // 在操作前快照余额
    const fanSpumpBefore = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcBeforeClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    // Fan endorses the proposal before it gets voided
    // 粉丝在提案被作废前进行背书
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

    // ----- Admin triggers emergency void -----
    // ----- 管理员触发紧急作废 -----
    const sponsorUsdcBeforeVoid = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    const vaultBeforeVoid = await ctx.tokenAmount(proposalUsdcVault, TOKEN_PROGRAM_ID);

    await ctx.program.methods
      .emergencyVoid()
      .accounts({
        admin: ctx.payer.publicKey,
        protocolConfig: ctx.protocolConfig,
        proposal,
        proposalUsdcVault,
        sponsorUsdcAta: ctx.sponsorAUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Assert: sponsor received ALL USDC that was in the vault
    // 断言：赞助商收回了资金库中的所有 USDC
    const sponsorUsdcAfterVoid = await ctx.tokenAmount(ctx.sponsorAUsdcAta, TOKEN_PROGRAM_ID);
    expect(sponsorUsdcAfterVoid - sponsorUsdcBeforeVoid).to.equal(vaultBeforeVoid);

    // Assert: proposal is voided and all track deposits are zeroed out
    // 断言：提案已作废且所有轨道存款归零
    const proposalAfterVoid = await ctx.program.account.proposal.fetch(proposal);
    expect(ctx.enumKey(proposalAfterVoid.status)).to.equal("voided");
    expect(proposalAfterVoid.track1Claimed).to.equal(true);           // Blocked from re-claim / 阻止重复领取
    expect(proposalAfterVoid.track2UsdcDeposited.toNumber()).to.equal(0);
    expect(proposalAfterVoid.track3UsdcDeposited.toNumber()).to.equal(0);

    // ----- Fan claims after void: 100% SPUMP back, 0 USDC -----
    // ----- 粉丝在作废后领取：100% SPUMP 退还，0 USDC -----
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
      .signers([ctx.fanA])
      .rpc();

    const fanSpumpAfterClaim = await ctx.tokenAmount(ctx.fanASpumpAta, TOKEN_2022_PROGRAM_ID);
    const fanUsdcAfterClaim = await ctx.tokenAmount(ctx.fanAUsdcAta, TOKEN_PROGRAM_ID);

    // Assert: fan gets 100% SPUMP back (voided = no penalty)
    // 断言：粉丝取回 100% SPUMP（作废 = 无罚没）
    expect(fanSpumpAfterClaim).to.equal(fanSpumpBefore);

    // Assert: no USDC payout (voided, nothing to distribute)
    // 断言：无 USDC 支付（已作废，无可分配）
    expect(fanUsdcAfterClaim - fanUsdcBeforeClaim).to.equal(0n);

    // Wait for deadline to pass (cleanup for consistent test timing)
    // 等待截止时间过去（为测试计时一致性清理）
    await ctx.waitUntilDeadline(deadline);
  });
});

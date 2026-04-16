"use strict";
/**
 * =============================================================================
 * StreamPump — Test Context (Shared Test Scaffold)
 * StreamPump — 测试上下文（共享测试脚手架）
 *
 * This module bootstraps the entire on-chain test environment used by both
 * S1 buyout and S2 traffic-market test suites. It:
 * 本模块为 S1 收购和 S2 流量市场两个测试套件搭建完整的链上测试环境。它：
 *
 *  1. Deploys mints (USDC on Token Program, SPUMP on Token-2022)
 *     部署代币铸币账户（USDC 使用 Token Program，SPUMP 使用 Token-2022）
 *  2. Creates ATAs for every role (creator, sponsor, fan)
 *     为每个角色（创作者、赞助商、粉丝）创建关联代币账户 (ATA)
 *  3. Initializes the protocol config PDA and transfers SPUMP mint authority to it
 *     初始化协议配置 PDA 并将 SPUMP 铸币权限转移给它
 *  4. Registers two creators (one for S1 tests, one pre-upgraded to S2)
 *     注册两个创作者（一个用于 S1 测试，一个预升级为 S2）
 *  5. Exposes PDA derivation helpers, token read utilities, and a
 *     `createFundedProposal` convenience function.
 *     暴露 PDA 推导辅助函数、代币读取工具，以及 `createFundedProposal` 便捷函数。
 *
 * The context is lazily built once and shared across all test files via
 * `getTestContext()`.
 * 上下文通过 `getTestContext()` 懒加载构建一次后在所有测试文件间共享。
 * =============================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestContext = void 0;
const anchor = __importStar(require("@coral-xyz/anchor"));
const chai_1 = require("chai");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
// ---------------------------------------------------------------------------
// Singleton cache — ensures `buildContext()` only runs once per test process
// 单例缓存 — 确保 `buildContext()` 在每个测试进程中只运行一次
// ---------------------------------------------------------------------------
let contextPromise = null;
/**
 * Returns the shared TestContext, initializing it on first call.
 * All test suites should call this in their `before()` hook.
 * 返回共享的 TestContext，首次调用时初始化。
 * 所有测试套件应在各自的 `before()` 钩子中调用此函数。
 */
const getTestContext = async () => {
    if (!contextPromise) {
        contextPromise = buildContext();
    }
    return contextPromise;
};
exports.getTestContext = getTestContext;
// ===========================================================================
// buildContext — full one-time setup of the on-chain test environment
// buildContext — 完整的一次性链上测试环境搭建
// ===========================================================================
const buildContext = async () => {
    // --------------------------------------------------
    // 1. Provider & program handles
    //    提供者和程序句柄
    // --------------------------------------------------
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.StreampumpCore;
    const connection = provider.connection;
    const payer = provider.wallet.payer;
    if (!payer) {
        throw new Error("Provider wallet payer is required for test setup");
    }
    // --------------------------------------------------
    // 2. Generate keypairs for all test roles
    //    为所有测试角色生成密钥对
    // --------------------------------------------------
    const oracle = web3_js_1.Keypair.generate(); // Oracle / 预言机
    const creatorS2 = web3_js_1.Keypair.generate(); // S2 creator (will be upgraded) / S2 创作者（将被升级）
    const creatorS1 = web3_js_1.Keypair.generate(); // S1 creator (stays at level 1) / S1 创作者（保持等级 1）
    const sponsorA = web3_js_1.Keypair.generate(); // Primary sponsor / 主要赞助商
    const sponsorB = web3_js_1.Keypair.generate(); // Secondary sponsor / 次要赞助商
    const fanA = web3_js_1.Keypair.generate(); // Fan / endorser / 粉丝/背书者
    // --------------------------------------------------
    // 3. Derive the protocol config PDA
    //    推导协议配置 PDA
    // --------------------------------------------------
    const protocolConfig = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("protocol_config")], program.programId)[0];
    // --------------------------------------------------
    // 4. Internal nonce for deterministic unique deadlines
    //    用于生成确定性唯一截止时间的内部 nonce
    // --------------------------------------------------
    let deadlineNonce = 0;
    // --------------------------------------------------
    // Utility functions / 工具函数
    // --------------------------------------------------
    /** Convert to BN / 转换为 BN */
    const bn = (n) => new anchor.BN(n.toString());
    /** Current Unix timestamp in seconds / 当前 Unix 时间戳（秒） */
    const nowTs = () => Math.floor(Date.now() / 1000);
    /** Simple async sleep / 简单的异步休眠 */
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    /**
     * Generate a unique future deadline by combining a base offset with a
     * monotonically increasing nonce * 5 to avoid PDA collisions between proposals.
     * 通过将基础偏移量与单调递增的 nonce * 5 结合来生成唯一的未来截止时间，
     * 以避免提案之间的 PDA 冲突。
     */
    const nextDeadline = (offsetSeconds = 3) => {
        deadlineNonce += 1;
        return bn(nowTs() + offsetSeconds + deadlineNonce * 5);
    };
    /**
     * Extract the variant key from an Anchor-serialized enum.
     * Example: { resolvedSuccess: {} } → "resolvedSuccess"
     * 从 Anchor 序列化的枚举中提取变体键。
     * 示例：{ resolvedSuccess: {} } → "resolvedSuccess"
     */
    const enumKey = (variant) => Object.keys(variant)[0];
    // --------------------------------------------------
    // PDA derivation helpers
    // PDA 推导辅助函数
    //
    // Each function mirrors the `seeds` constraint in the on-chain Rust program.
    // 每个函数对应链上 Rust 程序中的 `seeds` 约束。
    // --------------------------------------------------
    /** Derive CreatorProfile PDA / 推导创作者资料 PDA */
    const deriveCreatorProfile = (authority) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("creator"), authority.toBuffer()], program.programId)[0];
    /** Derive Proposal PDA (unique per creator + deadline) / 推导提案 PDA（按创作者 + 截止时间唯一） */
    const deriveProposal = (creator, deadline) => web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from("proposal"),
        creator.toBuffer(),
        deadline.toArrayLike(Buffer, "le", 8),
    ], program.programId)[0];
    /** Derive the USDC vault PDA for a proposal / 推导提案的 USDC 资金库 PDA */
    const deriveProposalUsdcVault = (proposal) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal_usdc_vault"), proposal.toBuffer()], program.programId)[0];
    /** Derive the endorsement position PDA (unique per user + proposal) / 推导背书仓位 PDA（按用户 + 提案唯一） */
    const deriveEndorsementPosition = (user, proposal) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("endorsement"), user.toBuffer(), proposal.toBuffer()], program.programId)[0];
    /**
     * Derive the upgrade receipt PDA — ensures each oracle report can only
     * be used once per creator (replay protection).
     * 推导升级收据 PDA — 确保每份预言机报告对每个创作者只能使用一次（防重放）。
     */
    const deriveUpgradeReceipt = (creatorProfile, reportId) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), Buffer.from(reportId)], program.programId)[0];
    /** Derive buyout offer PDA (unique per sponsor + creator) / 推导收购出价 PDA（按赞助商 + 创作者唯一） */
    const deriveBuyoutOffer = (sponsor, creatorProfile) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("buyout_offer"), sponsor.toBuffer(), creatorProfile.toBuffer()], program.programId)[0];
    /** Derive the USDC vault for a buyout offer / 推导收购出价的 USDC 资金库 PDA */
    const deriveOfferUsdcVault = (buyoutOffer) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("offer_usdc_vault"), buyoutOffer.toBuffer()], program.programId)[0];
    /**
     * Derive S1 buyout state PDA — tracks the accepted offer and rage-quit window.
     * 推导 S1 收购状态 PDA — 追踪已接受的出价和愤怒退出窗口。
     */
    const deriveS1BuyoutState = (creatorProfile) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("s1_buyout_state"), creatorProfile.toBuffer()], program.programId)[0];
    /**
     * Fetch the raw token balance of an ATA.
     * 获取 ATA 的原始代币余额。
     */
    const tokenAmount = async (ata, tokenProgramId) => {
        const account = await (0, spl_token_1.getAccount)(connection, ata, undefined, tokenProgramId);
        return account.amount;
    };
    /**
     * Airdrop SOL to a pubkey (default 4 SOL). Used to fund transaction fees.
     * 向公钥空投 SOL（默认 4 SOL）。用于支付交易费用。
     */
    const airdropSol = async (pubkey, sol = 4) => {
        const sig = await connection.requestAirdrop(pubkey, sol * web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
    };
    /**
     * Poll-wait until the current timestamp exceeds the deadline + 1s buffer.
     * This ensures the on-chain Clock::unix_timestamp has also advanced past
     * the deadline before we attempt post-deadline operations.
     * 轮询等待直到当前时间戳超过截止时间 + 1 秒缓冲。
     * 这确保链上 Clock::unix_timestamp 也已超过截止时间，
     * 然后我们才尝试执行截止后操作。
     */
    const waitUntilDeadline = async (deadline) => {
        while (nowTs() <= deadline.toNumber() + 1) {
            await sleep(500);
        }
        await sleep(1_500);
    };
    /**
     * Assert that calling `fn` results in an Anchor error whose text
     * (error code, message, or logs) contains `expectedNeedle`.
     * 断言调用 `fn` 会产生一个 Anchor 错误，其文本
     * （错误代码、消息或日志）包含 `expectedNeedle`。
     */
    const expectAnchorError = async (fn, expectedNeedle) => {
        try {
            await fn();
            chai_1.assert.fail(`Expected error containing: ${expectedNeedle}`);
        }
        catch (err) {
            // Collect all possible error text sources
            // 收集所有可能的错误文本来源
            const text = [
                err?.error?.errorCode?.code,
                err?.error?.errorMessage,
                err?.toString?.(),
                Array.isArray(err?.logs) ? err.logs.join("\n") : "",
            ]
                .filter(Boolean)
                .join("\n");
            (0, chai_1.assert)(text.includes(expectedNeedle), `Expected error containing "${expectedNeedle}", got:\n${text}`);
        }
    };
    // ===========================================================================
    // SETUP PHASE 1: Fund all accounts with SOL for transaction fees
    // 设置阶段 1：为所有账户充值 SOL 以支付交易费用
    // ===========================================================================
    await airdropSol(payer.publicKey, 20);
    for (const kp of [oracle, creatorS2, creatorS1, sponsorA, sponsorB, fanA]) {
        await airdropSol(kp.publicKey, 5);
    }
    // ===========================================================================
    // SETUP PHASE 2: Create token mints
    // 设置阶段 2：创建代币铸币
    //
    //   - USDC: standard Token Program, 6 decimals
    //     USDC：标准 Token Program，6 位小数
    //   - SPUMP: Token-2022 program, 6 decimals, NonTransferable
    //     SPUMP：Token-2022 程序，6 位小数，不可转让
    // ===========================================================================
    const usdcMint = await (0, spl_token_1.createMint)(connection, payer, payer.publicKey, null, 6, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID);
    const spumpMintKeypair = web3_js_1.Keypair.generate();
    const spumpMintSpace = (0, spl_token_1.getMintLen)([spl_token_1.ExtensionType.NonTransferable]);
    const spumpMintLamports = await connection.getMinimumBalanceForRentExemption(spumpMintSpace);
    await anchor.web3.sendAndConfirmTransaction(connection, new anchor.web3.Transaction().add(web3_js_1.SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: spumpMintKeypair.publicKey,
        lamports: spumpMintLamports,
        space: spumpMintSpace,
        programId: spl_token_1.TOKEN_2022_PROGRAM_ID,
    }), (0, spl_token_1.createInitializeNonTransferableMintInstruction)(spumpMintKeypair.publicKey, spl_token_1.TOKEN_2022_PROGRAM_ID), (0, spl_token_1.createInitializeMintInstruction)(spumpMintKeypair.publicKey, 6, payer.publicKey, null, spl_token_1.TOKEN_2022_PROGRAM_ID)), [payer, spumpMintKeypair]);
    const spumpMint = spumpMintKeypair.publicKey;
    // ===========================================================================
    // SETUP PHASE 3: Create Associated Token Accounts (ATAs) for all roles
    // 设置阶段 3：为所有角色创建关联代币账户 (ATA)
    // ===========================================================================
    // --- USDC ATAs / USDC 关联代币账户 ---
    const creatorS2UsdcAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, usdcMint, creatorS2.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    const creatorS1UsdcAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, usdcMint, creatorS1.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    const sponsorAUsdcAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, usdcMint, sponsorA.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    const sponsorBUsdcAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, usdcMint, sponsorB.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    const fanAUsdcAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, usdcMint, fanA.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    // --- SPUMP ATAs (Token-2022) / SPUMP 关联代币账户 (Token-2022) ---
    const creatorS1SpumpAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, spumpMint, creatorS1.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    const fanASpumpAta = (await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, spumpMint, fanA.publicKey, undefined, undefined, undefined, spl_token_1.TOKEN_2022_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID)).address;
    // ===========================================================================
    // SETUP PHASE 4: Mint initial token balances
    // 设置阶段 4：铸造初始代币余额
    //
    //   - 5,000 USDC to each sponsor (5_000_000_000 = 5000 × 10^6)
    //     为每个赞助商铸造 5,000 USDC（5_000_000_000 = 5000 × 10^6）
    //   - 3,000 SPUMP to fanA
    //     为 fanA 铸造 3,000 SPUMP
    // ===========================================================================
    await (0, spl_token_1.mintTo)(connection, payer, usdcMint, sponsorAUsdcAta, payer.publicKey, 5000000000n, [], undefined, spl_token_1.TOKEN_PROGRAM_ID);
    await (0, spl_token_1.mintTo)(connection, payer, usdcMint, sponsorBUsdcAta, payer.publicKey, 5000000000n, [], undefined, spl_token_1.TOKEN_PROGRAM_ID);
    await (0, spl_token_1.mintTo)(connection, payer, spumpMint, fanASpumpAta, payer.publicKey, 3000000000n, [], undefined, spl_token_1.TOKEN_2022_PROGRAM_ID);
    // ===========================================================================
    // SETUP PHASE 5: Initialize the protocol and transfer SPUMP mint authority
    // 设置阶段 5：初始化协议并转移 SPUMP 铸币权限
    //
    // The protocol config PDA becomes the sole mint authority for SPUMP.
    // In production this means only verified smart contract paths can mint SPUMP.
    // 协议配置 PDA 成为 SPUMP 的唯一铸币权限。
    // 在生产环境中，这意味着只有经过验证的智能合约路径才能铸造 SPUMP。
    // ===========================================================================
    // Transfer SPUMP mint authority from payer → protocolConfig PDA before protocol init
    // 在协议初始化前，将 SPUMP 铸币权限从 payer 转移到 protocolConfig PDA
    await (0, spl_token_1.setAuthority)(connection, payer, spumpMint, payer.publicKey, spl_token_1.AuthorityType.MintTokens, protocolConfig, [], undefined, spl_token_1.TOKEN_2022_PROGRAM_ID);
    await program.methods
        .initializeProtocol({
        oracleAuthority: oracle.publicKey,
        usdcMint,
        spumpMint,
        maxProposalDurationSeconds: bn(7 * 24 * 3_600), // 7 days / 7 天
        maxExitTaxBps: 1_500, // 15% max exit tax / 最高 15% 退出税
        minExitTaxBps: 500, // 5% min exit tax / 最低 5% 退出税
        taxDecayThresholdSupply: bn(1_000_000), // Supply at which tax decays to min / 税率衰减至最低时的供应量
        s2MinFollowers: bn(100), // Min followers for S2 upgrade / S2 升级所需最低粉丝数
        s2MinValidViews: bn(1_000), // Min views for S2 upgrade / S2 升级所需最低有效观看数
    })
        .accounts({
        admin: payer.publicKey,
        protocolConfig,
        spumpMint,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    // ===========================================================================
    // SETUP PHASE 6: Register creators and upgrade creatorS2 to level 2
    // 设置阶段 6：注册创作者并将 creatorS2 升级为 2 级
    //
    // creatorS2 is pre-upgraded so S2 tests can create proposals immediately.
    // creatorS1 stays at level 1 for S1 buyout flow tests.
    // creatorS2 被预先升级，以便 S2 测试可以立即创建提案。
    // creatorS1 保持 1 级，用于 S1 收购流程测试。
    // ===========================================================================
    const creatorS2Profile = deriveCreatorProfile(creatorS2.publicKey);
    const creatorS1Profile = deriveCreatorProfile(creatorS1.publicKey);
    // Register S2 creator / 注册 S2 创作者
    await program.methods
        .registerCreator({
        handle: "creator_s2",
        payoutUsdcAta: creatorS2UsdcAta,
    })
        .accounts({
        authority: creatorS2.publicKey,
        protocolConfig,
        creatorProfile: creatorS2Profile,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .signers([creatorS2])
        .rpc();
    // Register S1 creator / 注册 S1 创作者
    await program.methods
        .registerCreator({
        handle: "creator_s1",
        payoutUsdcAta: creatorS1UsdcAta,
    })
        .accounts({
        authority: creatorS1.publicKey,
        protocolConfig,
        creatorProfile: creatorS1Profile,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .signers([creatorS1])
        .rpc();
    // Upgrade creatorS2 to level 2 via oracle report.
    // reportId and reportDigest are random bytes simulating an oracle report.
    // 通过预言机报告将 creatorS2 升级到 2 级。
    // reportId 和 reportDigest 是随机字节，模拟预言机报告。
    const reportId = Array.from(web3_js_1.Keypair.generate().publicKey.toBytes());
    const reportDigest = Array.from(web3_js_1.Keypair.generate().publicKey.toBytes());
    const upgradeReceipt = deriveUpgradeReceipt(creatorS2Profile, reportId);
    await program.methods
        .upgradeCreator({
        newLevel: 2,
        metricType: { followers: {} },
        metricValue: bn(500),
        reportId,
        reportDigest,
        observedAt: bn(nowTs() - 5),
    })
        .accounts({
        oracle: oracle.publicKey,
        protocolConfig,
        creatorProfile: creatorS2Profile,
        upgradeReceipt,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .signers([oracle])
        .rpc();
    // ===========================================================================
    // createFundedProposal — convenience wrapper used by test cases
    // createFundedProposal — 测试用例使用的便捷封装函数
    //
    // Performs two on-chain calls:
    // 执行两次链上调用：
    //   1. create_proposal — creator opens a tri-track proposal
    //      create_proposal — 创作者开启三轨提案
    //   2. sponsor_fund — sponsor deposits USDC across all three tracks
    //      sponsor_fund — 赞助商向三个轨道存入 USDC
    // ===========================================================================
    const createFundedProposal = async (params) => {
        const creatorProfile = deriveCreatorProfile(params.creator.publicKey);
        const deadline = nextDeadline(params.deadlineOffsetSeconds ?? 3);
        const proposal = deriveProposal(params.creator.publicKey, deadline);
        const proposalUsdcVault = deriveProposalUsdcVault(proposal);
        const contentHash = Array.from(web3_js_1.Keypair.generate().publicKey.toBytes());
        // Determine which sponsor's USDC ATA to use
        // 确定使用哪个赞助商的 USDC ATA
        const sponsorUsdcAta = params.sponsor.publicKey.equals(sponsorA.publicKey)
            ? sponsorAUsdcAta
            : sponsorBUsdcAta;
        // Step 1: Creator opens the proposal with tri-track parameters
        // 步骤 1：创作者使用三轨参数创建提案
        await program.methods
            .createProposal({
            contentKind: { mixedMediaNote: {} }, // Xiaohongshu-style mixed note / 小红书风格混合笔记
            contentHash, // Canonical content-package digest / 内容包摘要
            contentAnchorPda: null, // Tests use hash-only binding / 测试中使用仅哈希绑定
            track1BaseUsdc: bn(params.track1Base), // Fixed base pay / 固定基础报酬
            track2MetricType: { views: {} }, // Performance metric type / 绩效指标类型
            track2TargetValue: bn(params.track2Target), // Target value (e.g. views) / 目标值（如观看数）
            track2MinAchievementBps: params.track2MinAchievementBps, // Cliff threshold / 悬崖门槛
            track3DelayDays: params.track3DelayDays ?? 45, // CPS delay / CPS 延迟天数
            deadline, // Proposal deadline / 提案截止时间
        })
            .accounts({
            creator: params.creator.publicKey,
            payer: params.sponsor.publicKey,
            protocolConfig,
            creatorProfile,
            proposal,
            usdcVault: proposalUsdcVault,
            usdcMint,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
        })
            .signers([params.creator, params.sponsor])
            .rpc();
        // Step 2: Sponsor funds all three tracks in one call
        // 步骤 2：赞助商一次调用注资所有三个轨道
        await program.methods
            .sponsorFund({
            track1Amount: bn(params.track1Base), // Must match track1_base_usdc / 必须匹配 track1_base_usdc
            track2Amount: bn(params.track2Amount), // Performance budget / 绩效预算
            track3Amount: bn(params.track3Amount), // CPS budget / CPS 预算
        })
            .accounts({
            sponsor: params.sponsor.publicKey,
            proposal,
            sponsorUsdcAta,
            proposalUsdcVault,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([params.sponsor])
            .rpc();
        return { creatorProfile, proposal, proposalUsdcVault, deadline };
    };
    // ===========================================================================
    // Return the fully-initialized TestContext
    // 返回完全初始化的 TestContext
    // ===========================================================================
    return {
        provider,
        program,
        connection,
        payer,
        oracle,
        creatorS2,
        creatorS1,
        sponsorA,
        sponsorB,
        fanA,
        protocolConfig,
        usdcMint,
        spumpMint,
        creatorS2UsdcAta,
        creatorS1UsdcAta,
        sponsorAUsdcAta,
        sponsorBUsdcAta,
        fanAUsdcAta,
        creatorS1SpumpAta,
        fanASpumpAta,
        bn,
        nowTs,
        enumKey,
        tokenAmount,
        waitUntilDeadline,
        expectAnchorError,
        deriveCreatorProfile,
        deriveProposal,
        deriveProposalUsdcVault,
        deriveEndorsementPosition,
        deriveUpgradeReceipt,
        deriveBuyoutOffer,
        deriveOfferUsdcVault,
        deriveS1BuyoutState,
        createFundedProposal,
    };
};

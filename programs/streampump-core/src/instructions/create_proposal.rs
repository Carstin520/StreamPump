// ────────────────────────────────────────────────────────────────────────────────
// create_proposal.rs
// EN: Create a creator-owned proposal with tri-track S2 settlement configuration.
//     A proposal carries three independent settlement tracks:
//     - Track 1 (Fixed Base Pay): creator-only guaranteed payment.
//     - Track 2 (Performance + Fans): fan-endorsed, cliff-gated pro-rata settlement
//       against high-intent metrics (Views/Clicks/Saves).
//     - Track 3 (CPS Sales): creator-only delayed settlement after return window.
//     All tracks share a single USDC vault PDA.
//
// ZH: 创建带有 S2 三轨结算配置的创作者提案。
//     一个提案承载三条独立的结算轨道：
//     - Track1（固定基础保底）：仅创作者参与，固定 USDC。
//     - Track2（效果池+粉丝）：粉丝背书，高意向指标 + Cliff 门槛 + 按比例结算。
//     - Track3（CPS 销售池）：仅创作者参与，退换货窗口后延迟结算。
//     三条 Track 共享同一个 USDC 金库 PDA。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, Proposal, ProposalMetricType, ProposalStatus, ProtocolConfig,
        MIN_PROPOSAL_CREATOR_LEVEL,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateProposalArgs {
    /// EN: Track 1 guaranteed base payment (USDC units).
    /// ZH: Track1 固定基础保底金额（USDC 最小单位）。
    pub track1_base_usdc: u64,
    /// EN: Track 2 high-intent metric type (Views=0, Clicks=1, Saves=2).
    /// ZH: Track2 高意向指标类型（播放量=0, 点击量=1, 收藏量=2）。
    pub track2_metric_type: ProposalMetricType,
    /// EN: Track 2 target value for pro-rata settlement.
    /// ZH: Track2 按比例结算目标值。
    pub track2_target_value: u64,
    /// EN: Track 2 cliff in bps. Example 5000 = 50%.
    /// ZH: Track2 Cliff 门槛（基点），例如 5000 = 50%。
    pub track2_min_achievement_bps: u16,
    /// EN: Track 3 CPS settlement delay in days after deadline (e.g. 45).
    /// ZH: Track3 CPS 结算延迟天数（截止日之后，例如 45 天）。
    pub track3_delay_days: u16,
    /// EN: Unix timestamp after which Track 1 can be settled and no new endorsements accepted.
    /// ZH: Unix 时间戳，超过后 Track1 可开始结算且不再接受新背书。
    pub deadline: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateProposalArgs)]
pub struct CreateProposal<'info> {
    /// EN: Creator signing the transaction and paying rent for new accounts.
    /// ZH: 创作者签名并支付新账户租金。
    #[account(mut)]
    pub creator: Signer<'info>,

    /// EN: Global protocol configuration containing canonical SPUMP/USDC mint addresses.
    /// ZH: 全局协议配置，包含 SPUMP/USDC 的 mint 地址。
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    /// EN: Creator profile PDA. Must belong to `creator` and have level >= 2.
    /// ZH: Creator 档案 PDA，必须属于 `creator` 且等级 >= 2。
    #[account(
        seeds = [b"creator", creator.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ StreamPumpError::Unauthorized,
        constraint = creator_profile.authority != Pubkey::default() @ StreamPumpError::CreatorNotRegistered,
    )]
    pub creator_profile: Box<Account<'info, CreatorProfile>>,

    /// EN: Proposal state PDA, seeded by [creator, deadline].
    /// ZH: 提案状态 PDA，种子为 [创作者, 截止时间]。
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal", creator.key().as_ref(), &args.deadline.to_le_bytes()],
        bump,
        space = 8 + Proposal::INIT_SPACE
    )]
    pub proposal: Box<Account<'info, Proposal>>,

    /// EN: Proposal-owned USDC vault PDA. Holds Track 1/2/3 funds.
    /// ZH: 提案所有的 USDC 金库 PDA，存放 Track1/2/3 的全部资金。
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = proposal
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// EN: Initializes a proposal in `Open` status with zeroed tri-track settlement state.
/// ZH: 将提案初始化为 `Open` 状态，并将三轨结算状态归零。
pub(crate) fn handler(ctx: Context<CreateProposal>, args: CreateProposalArgs) -> Result<()> {
    require!(args.track2_target_value > 0, StreamPumpError::InvalidAmount);
    require!(
        args.track2_min_achievement_bps <= 10_000,
        StreamPumpError::InvalidAmount
    );
    require!(
        ctx.accounts.creator_profile.level >= MIN_PROPOSAL_CREATOR_LEVEL,
        StreamPumpError::InsufficientCreatorLevel
    );

    let now = Clock::get()?.unix_timestamp;
    require!(args.deadline > now, StreamPumpError::InvalidDeadline);
    require!(
        args.deadline
            .checked_sub(now)
            .ok_or(StreamPumpError::MathOverflow)?
            <= ctx.accounts.protocol_config.max_proposal_duration_seconds,
        StreamPumpError::InvalidDeadline
    );

    let proposal = &mut ctx.accounts.proposal;
    proposal.creator = ctx.accounts.creator.key();
    proposal.sponsor = None;

    // EN: Track 1 initialization — fixed creator base pay.
    // ZH: Track1 初始化——固定基础保底。
    proposal.track1_base_usdc = args.track1_base_usdc;
    proposal.track1_claimed = false;

    // EN: Track 2 initialization — performance pool with cliff.
    // ZH: Track2 初始化——带 Cliff 的效果池。
    proposal.track2_metric_type = args.track2_metric_type;
    proposal.track2_target_value = args.track2_target_value;
    proposal.track2_min_achievement_bps = args.track2_min_achievement_bps;
    proposal.track2_usdc_deposited = 0;
    proposal.track2_actual_value = None;
    proposal.track2_settled_at = 0;

    // EN: Track 3 initialization — delayed CPS settlement.
    // ZH: Track3 初始化——延迟 CPS 结算。
    proposal.track3_usdc_deposited = 0;
    proposal.track3_cps_payout = None;
    proposal.track3_delay_days = args.track3_delay_days;
    proposal.track3_settled_at = 0;

    // EN: General proposal fields.
    // ZH: 提案通用字段。
    proposal.deadline = args.deadline;
    proposal.status = ProposalStatus::Open;
    proposal.usdc_vault_bump = ctx.bumps.usdc_vault;
    proposal.total_spump_staked = 0;
    proposal.bump = ctx.bumps.proposal;

    Ok(())
}

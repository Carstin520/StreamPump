// ────────────────────────────────────────────────────────────────────────────────
// rage_quit_s1.rs
// EN: Fan exits during the S1 execution-pending window at ZERO exit tax.
//     After a creator accepts a buyout offer, there is a 48-hour rage-quit window.
//     During this window, any S1 token holder can sell their position at the
//     bonding curve price with no exit tax — they receive the full gross return
//     minted as fresh SPUMP.
//     This protects minority holders who disagree with the buyout terms.
//
// ZH: 粉丝在 S1 执行等待窗口内以 0 税率退出。
//     创作者接受买断报价后，有 48 小时 rage-quit 窗口。
//     在此窗口内，任何 S1 代币持有者可以按联合曲线价格卖出仓位，
//     无需支付退出税——获得全额毛回报（铸造为新 SPUMP）。
//     这保护了不认同买断条款的少数持有者。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutState, S1UserPosition},
    utils::{calculate_sell_return, checked_sub},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RageQuitS1Args {
    /// EN: S1 internal token amount to exit.
    /// ZH: 要退出的 S1 内部代币数量。
    pub amount: u64,
}

#[derive(Accounts)]
pub struct RageQuitS1<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Creator profile — must be in S1_Execution_Pending status.
    /// ZH: Creator 档案——必须处于 S1_Execution_Pending 状态。
    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// EN: S1 buyout state — rage-quit deadline must not have passed.
    /// ZH: S1 买断状态——rage-quit 截止时间必须尚未到达。
    #[account(
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Account<'info, S1BuyoutState>,

    /// EN: User's S1 virtual position PDA.
    /// ZH: 用户的 S1 虚拟仓位 PDA。
    #[account(
        mut,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump = s1_user_position.bump,
        constraint = s1_user_position.user == user.key() @ StreamPumpError::Unauthorized,
        constraint = s1_user_position.creator == creator_profile.key() @ StreamPumpError::S1PositionAccountMismatch
    )]
    pub s1_user_position: Account<'info, S1UserPosition>,

    /// EN: User SPUMP ATA — receives the full gross return (zero tax).
    /// ZH: 用户 SPUMP 关联代币账户——接收全额毛回报（零税率）。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<RageQuitS1>, args: RageQuitS1Args) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Execution_Pending,
        StreamPumpError::InvalidCreatorStatus
    );

    // EN: Rage-quit is only available BEFORE the deadline expires.
    // ZH: Rage-quit 只在截止时间到达之前可用。
    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.s1_buyout_state.rage_quit_deadline,
        StreamPumpError::RageQuitWindowNotActive
    );

    let creator_profile = &ctx.accounts.creator_profile;
    let position = &ctx.accounts.s1_user_position;
    require!(
        position.internal_token_balance >= args.amount,
        StreamPumpError::InsufficientInternalTokenBalance
    );

    // EN: Full bonding curve return — no exit tax during rage-quit.
    // ZH: 联合曲线全额回报——rage-quit 期间无退出税。
    let gross_return = calculate_sell_return(creator_profile.s1_supply, args.amount)?;

    // EN: Mint SPUMP back to the user (zero tax = full gross return).
    // ZH: 向用户铸回 SPUMP（零税率 = 全额毛回报）。
    let bump_bytes = [ctx.accounts.protocol_config.bump];
    let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.spump_token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.spump_mint.to_account_info(),
                to: ctx.accounts.user_spump_ata.to_account_info(),
                authority: ctx.accounts.protocol_config.to_account_info(),
            },
            signer,
        ),
        gross_return,
    )?;

    // EN: Update virtual position: release proportional cost basis.
    // ZH: 更新虚拟仓位：按比例释放成本基础。
    let position = &mut ctx.accounts.s1_user_position;
    let creator_profile = &mut ctx.accounts.creator_profile;

    let balance_before = position.internal_token_balance;
    let cost_basis_before = position.spump_cost_basis;
    let released_cost_basis = if args.amount == balance_before {
        cost_basis_before
    } else {
        let numerator = (cost_basis_before as u128)
            .checked_mul(args.amount as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        let quotient = numerator
            .checked_div(balance_before as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        u64::try_from(quotient).map_err(|_| error!(StreamPumpError::MathOverflow))?
    };

    position.internal_token_balance = checked_sub(position.internal_token_balance, args.amount)?;
    position.spump_cost_basis = checked_sub(position.spump_cost_basis, released_cost_basis)?;

    creator_profile.s1_supply = checked_sub(creator_profile.s1_supply, args.amount)?;
    creator_profile.updated_at = now;

    Ok(())
}

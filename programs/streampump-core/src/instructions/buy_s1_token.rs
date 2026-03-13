// ────────────────────────────────────────────────────────────────────────────────
// buy_s1_token.rs
// EN: Buy internal Season-1 creator tokens by burning non-transferable SPUMP.
//     The user's SPUMP is permanently burned via Token-2022 Burn CPI.
//     The cost follows a linear bonding curve: cost = k/2 × ((S+ΔS)² − S²),
//     where S = current virtual supply and ΔS = purchase amount.
//     The purchase is recorded as a virtual position — no on-chain token is minted
//     for the internal S1 token. Instead:
//     - `S1UserPosition.internal_token_balance` tracks the user's holdings.
//     - `S1UserPosition.spump_cost_basis` tracks how much SPUMP was burned.
//     - `CreatorProfile.s1_supply` tracks the aggregate virtual supply.
//
// ZH: 通过销毁不可转账 SPUMP，购买创作者 Season-1 内部代币。
//     用户的 SPUMP 通过 Token-2022 Burn CPI 永久销毁。
//     成本遵循线性联合曲线：cost = k/2 × ((S+ΔS)² − S²)，
//     其中 S = 当前虚拟供应量，ΔS = 购买数量。
//     购买以虚拟仓位记录——S1 内部代币不会铸造链上 Token。而是：
//     - `S1UserPosition.internal_token_balance` 追踪用户持仓。
//     - `S1UserPosition.spump_cost_basis` 追踪已销毁的 SPUMP 数量。
//     - `CreatorProfile.s1_supply` 追踪聚合虚拟供应量。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Burn, Mint, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1UserPosition},
    utils::{calculate_buy_cost, checked_add},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BuyS1TokenArgs {
    /// EN: Internal S1 token amount to buy.
    /// ZH: 要购买的 S1 内部代币数量。
    pub amount: u64,
}

#[derive(Accounts)]
pub struct BuyS1Token<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: Creator profile — must be in S1_Active status.
    /// ZH: Creator 档案——必须处于 S1_Active 状态。
    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// EN: Virtual S1 position PDA for this user × creator pair.
    /// ZH: 该用户×创作者的虚拟 S1 仓位 PDA。
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"s1_position", user.key().as_ref(), creator_profile.key().as_ref()],
        bump,
        space = 8 + S1UserPosition::INIT_SPACE
    )]
    pub s1_user_position: Account<'info, S1UserPosition>,

    /// EN: User's SPUMP Token-2022 ATA — tokens will be burned from here.
    /// ZH: 用户的 SPUMP Token-2022 关联代币账户——代币将从此处销毁。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    /// EN: Token-2022 SPUMP mint — must be mutable for burn to decrement supply.
    /// ZH: Token-2022 SPUMP mint——必须可变才能在销毁时减少供应。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub(crate) fn handler(ctx: Context<BuyS1Token>, args: BuyS1TokenArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );

    // EN: Calculate SPUMP cost using the linear bonding curve formula.
    // ZH: 通过线性联合曲线公式计算 SPUMP 成本。
    let current_supply = ctx.accounts.creator_profile.s1_supply;
    let spump_cost = calculate_buy_cost(current_supply, args.amount)?;

    // EN: Burn SPUMP from user — permanent supply reduction.
    // ZH: 从用户销毁 SPUMP——永久减少供应。
    token_interface::burn(
        CpiContext::new(
            ctx.accounts.spump_token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.spump_mint.to_account_info(),
                from: ctx.accounts.user_spump_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        spump_cost,
    )?;

    let creator_key = ctx.accounts.creator_profile.key();

    // EN: Initialize position on first buy, or validate ownership on subsequent buys.
    // ZH: 首次购买时初始化仓位，后续购买时校验所有权。
    let position = &mut ctx.accounts.s1_user_position;
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.creator = creator_key;
        position.internal_token_balance = 0;
        position.spump_cost_basis = 0;
        position.bump = ctx.bumps.s1_user_position;
    }

    require_keys_eq!(
        position.user,
        ctx.accounts.user.key(),
        StreamPumpError::Unauthorized
    );
    require_keys_eq!(
        position.creator,
        creator_key,
        StreamPumpError::S1PositionAccountMismatch
    );

    // EN: Update virtual position and creator supply.
    // ZH: 更新虚拟仓位和创作者供应量。
    position.internal_token_balance = checked_add(position.internal_token_balance, args.amount)?;
    position.spump_cost_basis = checked_add(position.spump_cost_basis, spump_cost)?;

    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.s1_supply = checked_add(creator_profile.s1_supply, args.amount)?;
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

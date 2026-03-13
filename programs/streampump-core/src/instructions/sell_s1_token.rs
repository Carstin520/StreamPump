// ────────────────────────────────────────────────────────────────────────────────
// sell_s1_token.rs
// EN: Sell internal Season-1 creator tokens for freshly minted SPUMP.
//     Because buy_s1_token burned the user's SPUMP, the sell path uses MintTo
//     to re-issue SPUMP from the protocol_config PDA (mint authority).
//     A dynamic exit tax is applied:
//     - Tax decays from `max_exit_tax_bps` to `min_exit_tax_bps` as supply grows
//       toward `tax_decay_threshold_supply`. This discourages early dumps while
//       rewarding patience as the community grows.
//     - Tax split: 50% minted to creator's revenue ATA, 50% permanently unissued
//       (neither minted nor burned — a net deflation effect).
//
// ZH: 卖出创作者 Season-1 内部代币换回新铸造的 SPUMP。
//     因为 buy_s1_token 销毁了用户的 SPUMP，卖出路径使用 MintTo
//     从 protocol_config PDA（铸造权限）重新发行 SPUMP。
//     动态退出税：
//     - 税率从 `max_exit_tax_bps` 到 `min_exit_tax_bps` 随供应量增长向
//       `tax_decay_threshold_supply` 衰减。这鼓励长期持有而非早期抛售。
//     - 税收分配：50% 铸造给创作者收入 ATA，50% 永久不铸造
//       （既不铸造也不销毁——净通缩效果）。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus, ProtocolConfig, S1UserPosition},
    utils::{amount_from_bps, calculate_sell_return, checked_sub},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellS1TokenArgs {
    /// EN: Internal S1 token amount to sell.
    /// ZH: 要卖出的 S1 内部代币数量。
    pub amount: u64,
}

#[derive(Accounts)]
pub struct SellS1Token<'info> {
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

    /// EN: User SPUMP ATA — receives the net minted SPUMP.
    /// ZH: 用户 SPUMP 关联代币账户——接收净铸造的 SPUMP。
    #[account(
        mut,
        constraint = user_spump_ata.owner == user.key() @ StreamPumpError::Unauthorized,
        constraint = user_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub user_spump_ata: InterfaceAccount<'info, TokenAccount>,

    /// EN: Creator SPUMP ATA — receives 50% of the exit tax as revenue.
    /// ZH: Creator SPUMP 关联代币账户——接收退出税的 50% 作为收入。
    #[account(
        mut,
        constraint = creator_revenue_spump_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_revenue_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_revenue_spump_ata: InterfaceAccount<'info, TokenAccount>,

    /// EN: Token-2022 SPUMP mint — protocol_config PDA is its mint authority.
    /// ZH: Token-2022 SPUMP mint——protocol_config PDA 是其铸造权限。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: InterfaceAccount<'info, Mint>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,
}

/// EN: Dynamic exit tax: high when supply is low (discourages early dumps),
///     decays linearly to min as supply approaches the threshold.
/// ZH: 动态退出税：供应量低时税率高（抑制早期抛售），
///     随供应量接近阈值线性衰减至最低值。
fn calculate_dynamic_tax_bps(
    current_supply: u64,
    max_exit_tax_bps: u16,
    min_exit_tax_bps: u16,
    tax_decay_threshold_supply: u64,
) -> Result<u16> {
    require!(
        max_exit_tax_bps <= 10_000
            && min_exit_tax_bps <= 10_000
            && max_exit_tax_bps >= min_exit_tax_bps,
        StreamPumpError::InvalidTaxConfig
    );

    // EN: If supply is at or above threshold, use minimum tax.
    // ZH: 如果供应量达到或超过阈值，使用最低税率。
    if tax_decay_threshold_supply == 0 || current_supply >= tax_decay_threshold_supply {
        return Ok(min_exit_tax_bps);
    }

    // EN: Linear interpolation: tax = min + (max - min) × (threshold - supply) / threshold
    // ZH: 线性插值：税率 = 最低 + (最高 - 最低) × (阈值 - 供应量) / 阈值
    let spread = (max_exit_tax_bps - min_exit_tax_bps) as u128;
    let remaining = (tax_decay_threshold_supply - current_supply) as u128;
    let threshold = tax_decay_threshold_supply as u128;

    let variable_component = spread
        .checked_mul(remaining)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(threshold)
        .ok_or(StreamPumpError::MathOverflow)?;

    let tax_bps_u128 = (min_exit_tax_bps as u128)
        .checked_add(variable_component)
        .ok_or(StreamPumpError::MathOverflow)?;

    u16::try_from(tax_bps_u128).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub(crate) fn handler(ctx: Context<SellS1Token>, args: SellS1TokenArgs) -> Result<()> {
    require!(args.amount > 0, StreamPumpError::InvalidAmount);
    require!(
        ctx.accounts.creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );

    let creator_profile = &ctx.accounts.creator_profile;
    let position = &ctx.accounts.s1_user_position;
    require!(
        position.internal_token_balance >= args.amount,
        StreamPumpError::InsufficientInternalTokenBalance
    );

    // EN: Calculate gross SPUMP return from the bonding curve (inverse of buy).
    // ZH: 从联合曲线计算 SPUMP 毛回报（买入的逆运算）。
    let gross_return = calculate_sell_return(creator_profile.s1_supply, args.amount)?;

    // EN: Apply dynamic exit tax.
    // ZH: 应用动态退出税。
    let tax_bps = calculate_dynamic_tax_bps(
        creator_profile.s1_supply,
        ctx.accounts.protocol_config.max_exit_tax_bps,
        ctx.accounts.protocol_config.min_exit_tax_bps,
        ctx.accounts.protocol_config.tax_decay_threshold_supply,
    )?;

    let tax_amount = amount_from_bps(gross_return, tax_bps)?;
    let net_return = checked_sub(gross_return, tax_amount)?;

    // EN: Tax split: 50% to protocol burn (never minted), 50% to creator revenue.
    // ZH: 税收拆分：50% 协议销毁（永不铸造），50% 给创作者收入。
    let protocol_burn_amount = tax_amount / 2;
    let creator_income_amount = checked_sub(tax_amount, protocol_burn_amount)?;

    // EN: Use protocol_config PDA as mint authority signer.
    // ZH: 使用 protocol_config PDA 作为铸造权限签名者。
    let bump_bytes = [ctx.accounts.protocol_config.bump];
    let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    // EN: Mint creator's 50% tax share.
    // ZH: 铸造创作者的 50% 税收份额。
    if creator_income_amount > 0 {
        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.spump_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.spump_mint.to_account_info(),
                    to: ctx.accounts.creator_revenue_spump_ata.to_account_info(),
                    authority: ctx.accounts.protocol_config.to_account_info(),
                },
                signer,
            ),
            creator_income_amount,
        )?;
    }

    // EN: Mint net return to the user. The protocol_burn_amount is never minted (deflation).
    // ZH: 向用户铸造净回报。protocol_burn_amount 永远不会被铸造（通缩）。
    if net_return > 0 {
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
            net_return,
        )?;
    }

    // EN: Update virtual position and creator supply.
    //     Cost basis is released proportionally to the sold fraction.
    // ZH: 更新虚拟仓位和创作者供应量。
    //     成本基础按卖出比例释放。
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
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

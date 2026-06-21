// ────────────────────────────────────────────────────────────────────────────────
// execute_s1_graduation.rs
// EN: Finalize S1 buyout after rage-quit window and graduate creator to S2.
//     Once the 48h rage-quit window has passed and a winning sponsor is selected:
//     1. Calculate the virtual SPUMP locked in the bonding curve by computing
//        `calculate_sell_return(total_supply, total_supply)` — i.e., the full
//        area under the curve from current supply down to zero.
//     2. Mint 50% of that virtual SPUMP to the creator as a graduation bonus.
//     3. The other 50% is NEVER minted — permanent supply deflation.
//     4. Set creator status to S2_Active and upgrade level if needed.
//
// ZH: Rage Quit 窗口结束后完成 S1 买断并让创作者毕业到 S2。
//     48 小时 rage-quit 窗口过后且已选定中标 Sponsor：
//     1. 通过 `calculate_sell_return(总供应量, 总供应量)` 计算联合曲线中锁定的
//        虚拟 SPUMP——即从当前供应量到零的曲线下面积。
//     2. 将该虚拟 SPUMP 的 50% 铸造给创作者作为毕业奖金。
//     3. 另外 50% 永不铸造——永久通缩。
//     4. 将创作者状态设为 S2_Active 并在需要时升级等级。
// ────────────────────────────────────────────────────────────────────────────────
use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint as SplMint, Token, TokenAccount as SplTokenAccount, Transfer},
    token_2022::ID as TOKEN_2022_PROGRAM_ID,
    token_interface::{
        self, Mint as InterfaceMint, MintTo, TokenAccount as InterfaceTokenAccount, TokenInterface,
    },
};

use crate::{
    errors::StreamPumpError,
    events::S1Graduated,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, S1BuyoutOffer, S1BuyoutState,
        MIN_PROPOSAL_CREATOR_LEVEL,
    },
    utils::{amount_from_bps, calculate_sell_return_with_rating, checked_sub},
};

#[derive(Accounts)]
pub struct ExecuteS1Graduation<'info> {
    /// EN: Temporarily restricted to oracle authority while holder counters are audited.
    /// ZH: 在持有人计数器审计前，毕业触发暂时限制为 oracle authority。
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    /// EN: Creator profile — must be in S1_Execution_Pending status.
    /// ZH: Creator 档案——必须处于 S1_Execution_Pending 状态。
    #[account(
        mut,
        seeds = [b"creator", creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Box<Account<'info, CreatorProfile>>,

    /// EN: S1 buyout state — must have a winning sponsor and expired rage-quit deadline.
    /// ZH: S1 买断状态——必须有中标 Sponsor 且 rage-quit 截止已过。
    #[account(
        mut,
        seeds = [b"s1_buyout_state", creator_profile.key().as_ref()],
        bump = s1_buyout_state.bump,
        constraint = s1_buyout_state.creator == creator_profile.key() @ StreamPumpError::BuyoutStateMismatch
    )]
    pub s1_buyout_state: Box<Account<'info, S1BuyoutState>>,

    #[account(
        seeds = [b"buyout_offer", buyout_offer.sponsor.as_ref(), creator_profile.key().as_ref()],
        bump = buyout_offer.bump,
        constraint = buyout_offer.creator == creator_profile.key() @ StreamPumpError::BuyoutOfferMismatch
    )]
    pub buyout_offer: Box<Account<'info, S1BuyoutOffer>>,

    #[account(
        mut,
        seeds = [b"offer_usdc_vault", buyout_offer.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = buyout_offer
    )]
    pub offer_usdc_vault: Box<Account<'info, SplTokenAccount>>,

    /// EN: Creator USDC ATA — receives the creator's direct buyout revenue.
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == usdc_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Box<Account<'info, SplTokenAccount>>,

    /// EN: Creator SPUMP ATA — receives 50% of the virtual pool as graduation bonus.
    /// ZH: Creator SPUMP 关联代币账户——接收虚拟池 50% 作为毕业奖金。
    #[account(
        mut,
        constraint = creator_revenue_spump_ata.owner == creator_profile.authority @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_revenue_spump_ata.mint == spump_mint.key() @ StreamPumpError::InvalidMint
    )]
    pub creator_revenue_spump_ata: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,

    /// EN: Token-2022 SPUMP mint — must be mutable for MintTo.
    /// ZH: Token-2022 SPUMP mint——MintTo 需要可变。
    #[account(mut, address = protocol_config.spump_mint @ StreamPumpError::InvalidMint)]
    pub spump_mint: Box<InterfaceAccount<'info, InterfaceMint>>,

    #[account(address = protocol_config.usdc_mint @ StreamPumpError::InvalidMint)]
    pub usdc_mint: Box<Account<'info, SplMint>>,

    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub spump_token_program: Interface<'info, TokenInterface>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<ExecuteS1Graduation>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let creator_profile = &ctx.accounts.creator_profile;
    require_keys_eq!(
        ctx.accounts.executor.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );
    require!(
        creator_profile.status == CreatorStatus::S1_Execution_Pending,
        StreamPumpError::InvalidCreatorStatus
    );
    // EN: Rage-quit window must have closed.
    // ZH: Rage-quit 窗口必须已关闭。
    require!(
        now >= ctx.accounts.s1_buyout_state.rage_quit_deadline,
        StreamPumpError::RageQuitWindowStillOpen
    );
    require!(
        ctx.accounts.s1_buyout_state.winning_sponsor.is_some(),
        StreamPumpError::WinningSponsorNotSelected
    );
    require!(
        !ctx.accounts.s1_buyout_state.creator_paid,
        StreamPumpError::CreatorAlreadyPaid
    );
    require!(
        creator_profile.s1_supply > 0,
        StreamPumpError::InvalidAmount
    );
    let eligible_holder_count = creator_profile.s1_eligible_holder_count;
    let early_holder_count = creator_profile.s1_early_holder_count;
    let regular_holder_count = creator_profile.s1_regular_holder_count;
    let holder_sum = early_holder_count
        .checked_add(regular_holder_count)
        .ok_or(StreamPumpError::MathOverflow)?;
    require!(
        eligible_holder_count > 0 && holder_sum == eligible_holder_count,
        StreamPumpError::InvalidHolderCountSnapshot
    );
    let winning_sponsor = ctx
        .accounts
        .s1_buyout_state
        .winning_sponsor
        .ok_or(error!(StreamPumpError::WinningSponsorNotSelected))?;
    require_keys_eq!(
        winning_sponsor,
        ctx.accounts.buyout_offer.sponsor,
        StreamPumpError::BuyoutOfferMismatch
    );
    require!(
        ctx.accounts.offer_usdc_vault.amount >= ctx.accounts.s1_buyout_state.usdc_deposited,
        StreamPumpError::InsufficientBuyoutUsdcLiquidity
    );
    let creator_profile_key = ctx.accounts.creator_profile.key();
    let s1_buyout_state_key = ctx.accounts.s1_buyout_state.key();

    // ────────────────────────────────────────────────────────────────────────
    // EN: Calculate virtual SPUMP: the full sell return from current supply to zero.
    //     This represents the total SPUMP "locked" in the bonding curve that was
    //     burned by all S1 buyers. Formula: k/2 × S² (where S = total supply).
    //
    // ZH: 计算虚拟 SPUMP：从当前供应量到零的完整卖出回报。
    //     这代表联合曲线中所有 S1 买家销毁的总 SPUMP。
    //     公式：k/2 × S²（S = 总供应量）。
    // ────────────────────────────────────────────────────────────────────────
    let remaining_virtual_spump = calculate_sell_return_with_rating(
        creator_profile.s1_supply,
        creator_profile.s1_supply,
        creator_profile.s1_rating_bps,
    )?;

    // EN: 50% to creator, 50% permanently unissued (deflation).
    // ZH: 50% 给创作者，50% 永久不铸造（通缩）。
    let creator_amount = remaining_virtual_spump / 2;

    if creator_amount > 0 {
        let bump_bytes = [ctx.accounts.protocol_config.bump];
        let signer_seeds: [&[u8]; 2] = [b"protocol_config", bump_bytes.as_ref()];
        let signer: &[&[&[u8]]] = &[&signer_seeds];

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
            creator_amount,
        )?;
    }

    // EN: Graduate creator to S2 and bump level if below minimum proposal level.
    // ZH: 将创作者毕业到 S2 并在等级低于最低提案等级时提升。
    let buyout_offer = &ctx.accounts.buyout_offer;
    let creator_payout_usdc = amount_from_bps(
        ctx.accounts.s1_buyout_state.usdc_deposited,
        ctx.accounts.protocol_config.s1_buyout_creator_share_bps,
    )?;
    let discovery_pool_usdc = checked_sub(
        ctx.accounts.s1_buyout_state.usdc_deposited,
        creator_payout_usdc,
    )?;
    if creator_payout_usdc > 0 {
        let bump_bytes = [buyout_offer.bump];
        let signer_seeds: [&[u8]; 4] = [
            b"buyout_offer",
            buyout_offer.sponsor.as_ref(),
            buyout_offer.creator.as_ref(),
            bump_bytes.as_ref(),
        ];
        let signer: &[&[&[u8]]] = &[&signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.offer_usdc_vault.to_account_info(),
                    to: ctx.accounts.creator_usdc_ata.to_account_info(),
                    authority: ctx.accounts.buyout_offer.to_account_info(),
                },
                signer,
            ),
            creator_payout_usdc,
        )?;
    }

    let creator_profile = &mut ctx.accounts.creator_profile;
    let s1_buyout_state = &mut ctx.accounts.s1_buyout_state;
    s1_buyout_state.creator_payout_usdc = creator_payout_usdc;
    s1_buyout_state.discovery_pool_usdc = discovery_pool_usdc;
    s1_buyout_state.discovery_pool_remaining = discovery_pool_usdc;
    s1_buyout_state.eligible_holder_count = eligible_holder_count;
    s1_buyout_state.early_holder_count = early_holder_count;
    s1_buyout_state.regular_holder_count = regular_holder_count;
    s1_buyout_state.creator_paid = true;
    s1_buyout_state.graduated_at = now;
    s1_buyout_state.claimable_usdc_remaining = discovery_pool_usdc;
    s1_buyout_state.claimable_s1_supply_remaining = eligible_holder_count as u64;
    s1_buyout_state.early_claimable_usdc_remaining = 0;
    s1_buyout_state.early_claimable_s1_supply_remaining = early_holder_count as u64;
    s1_buyout_state.regular_claimable_usdc_remaining = 0;
    s1_buyout_state.regular_claimable_s1_supply_remaining = regular_holder_count as u64;

    creator_profile.status = CreatorStatus::S2_Active;
    if creator_profile.level < MIN_PROPOSAL_CREATOR_LEVEL {
        creator_profile.level = MIN_PROPOSAL_CREATOR_LEVEL;
        creator_profile.last_upgrade_at = now;
    }
    creator_profile.updated_at = now;

    emit!(S1Graduated {
        creator_profile: creator_profile_key,
        creator: creator_profile.authority,
        s1_buyout_state: s1_buyout_state_key,
        winning_sponsor,
        creator_payout_usdc: s1_buyout_state.creator_payout_usdc,
        discovery_pool_usdc: s1_buyout_state.discovery_pool_usdc,
        discovery_pool_remaining: s1_buyout_state.discovery_pool_remaining,
        eligible_holder_count: s1_buyout_state.eligible_holder_count,
        early_holder_count: s1_buyout_state.early_holder_count,
        regular_holder_count: s1_buyout_state.regular_holder_count,
        reward_model_snapshot: s1_buyout_state.reward_model_snapshot,
        residual_to: s1_buyout_state.residual_to_snapshot,
        graduated_at: s1_buyout_state.graduated_at,
        claimable_usdc_remaining: s1_buyout_state.claimable_usdc_remaining,
        claimable_s1_supply_remaining: s1_buyout_state.claimable_s1_supply_remaining,
        early_claimable_usdc_remaining: s1_buyout_state.early_claimable_usdc_remaining,
        early_claimable_s1_supply_remaining: s1_buyout_state.early_claimable_s1_supply_remaining,
        regular_claimable_usdc_remaining: s1_buyout_state.regular_claimable_usdc_remaining,
        regular_claimable_s1_supply_remaining: s1_buyout_state.regular_claimable_s1_supply_remaining,
        creator_spump_bonus: creator_amount,
        status: creator_profile.status as u8,
    });

    Ok(())
}

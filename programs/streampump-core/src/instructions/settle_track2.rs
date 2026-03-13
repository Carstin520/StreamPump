// EN: Oracle-driven settlement for S2 Track 2 (Performance + Fans).
//     Track 2 uses a cliff + pro-rata model:
//     - If achievement < cliff: sponsor gets 100% refund, creator/fans get 0.
//     - If achievement >= cliff: unachieved budget refunded to sponsor,
//       achieved budget split 80% creator / 20% fan reward pool.
//     Fan reward pool remains in proposal vault for `claim_endorsement`.
//
// ZH: S2 Track2（效果池 + 粉丝）预言机结算。
//     Track2 使用 Cliff + 按比例模型：
//     - 达成率低于门槛：Sponsor 全额退款，Creator/粉丝本轨收益为 0。
//     - 达成率达到门槛：未达成预算退 Sponsor，达成预算按 80/20 分给
//       Creator 和粉丝奖励池。
//     粉丝奖励池留在提案金库，后续由 `claim_endorsement` 提取。
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, Proposal, ProposalStatus, ProtocolConfig},
    utils::{amount_from_bps, checked_sub},
};

/// EN: Creator payout ratio on achieved Track 2 budget (80%).
/// ZH: Track2 达成预算中 Creator 分成比例（80%）。
pub const TRACK2_CREATOR_PAYOUT_BPS: u16 = 8_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettleTrack2Args {
    /// EN: Oracle-validated actual metric value.
    /// ZH: 预言机确认的实际指标值。
    pub actual_value: u64,
}

#[derive(Accounts)]
pub struct SettleTrack2<'info> {
    /// EN: Oracle authority signer — must match `protocol_config.oracle_authority`.
    /// ZH: 预言机授权签名者——必须匹配 `protocol_config.oracle_authority`。
    pub oracle: Signer<'info>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EN: The proposal being settled. Must be funded and not yet resolved.
    /// ZH: 要结算的提案。必须为 Funded 且尚未完成 Track2 结算。
    #[account(
        mut,
        seeds = [b"proposal", proposal.creator.as_ref(), &proposal.deadline.to_le_bytes()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Funded @ StreamPumpError::ProposalNotFunded
    )]
    pub proposal: Account<'info, Proposal>,

    /// EN: Proposal-owned USDC vault PDA.
    /// ZH: 提案拥有的 USDC 金库 PDA。
    #[account(
        mut,
        seeds = [b"proposal_usdc_vault", proposal.key().as_ref()],
        bump = proposal.usdc_vault_bump,
        token::authority = proposal
    )]
    pub proposal_usdc_vault: Account<'info, TokenAccount>,

    /// EN: Creator profile used to validate payout destination.
    /// ZH: Creator 档案，用于校验收款地址。
    #[account(
        constraint = creator_profile.authority == proposal.creator @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    /// EN: Creator USDC ATA receiving Track2 creator payout.
    /// ZH: 接收 Track2 Creator 分成的 USDC ATA。
    #[account(
        mut,
        constraint = creator_usdc_ata.key() == creator_profile.payout_usdc_ata @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.owner == proposal.creator @ StreamPumpError::InvalidPayoutAccount,
        constraint = creator_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub creator_usdc_ata: Account<'info, TokenAccount>,

    /// EN: Sponsor USDC ATA receiving refunds.
    /// ZH: 接收退款的 Sponsor USDC ATA。
    #[account(
        mut,
        constraint = sponsor_usdc_ata.mint == proposal_usdc_vault.mint @ StreamPumpError::InvalidMint
    )]
    pub sponsor_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn handler(ctx: Context<SettleTrack2>, args: SettleTrack2Args) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let now = Clock::get()?.unix_timestamp;
    let proposal = &mut ctx.accounts.proposal;

    require!(
        now >= proposal.deadline,
        StreamPumpError::ProposalNotExpired
    );
    require!(
        proposal.track2_settled_at == 0,
        StreamPumpError::ProposalAlreadySettled
    );
    require!(
        proposal.track2_target_value > 0,
        StreamPumpError::InvalidAmount
    );

    let sponsor = proposal
        .sponsor
        .ok_or(error!(StreamPumpError::SponsorNotSet))?;
    require_keys_eq!(
        sponsor,
        ctx.accounts.sponsor_usdc_ata.owner,
        StreamPumpError::Unauthorized
    );

    let target = proposal.track2_target_value;
    let deposited = proposal.track2_usdc_deposited;

    let achieved_bps_u128 = (args.actual_value as u128)
        .checked_mul(10_000)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(target as u128)
        .ok_or(StreamPumpError::MathOverflow)?;
    let achieved_bps_u128 = std::cmp::min(achieved_bps_u128, 10_000);
    let achieved_bps =
        u16::try_from(achieved_bps_u128).map_err(|_| error!(StreamPumpError::MathOverflow))?;

    let deadline_bytes = proposal.deadline.to_le_bytes();
    let proposal_bump_bytes = [proposal.bump];
    let signer_seeds: [&[u8]; 4] = [
        b"proposal",
        proposal.creator.as_ref(),
        deadline_bytes.as_ref(),
        proposal_bump_bytes.as_ref(),
    ];
    let signer: &[&[&[u8]]] = &[&signer_seeds];

    if achieved_bps < proposal.track2_min_achievement_bps {
        if deposited > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                        to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                        authority: proposal.to_account_info(),
                    },
                    signer,
                ),
                deposited,
            )?;
        }

        proposal.track2_usdc_deposited = 0;
        proposal.status = ProposalStatus::Resolved_Fail;
    } else {
        let actual_capped = std::cmp::min(args.actual_value, target);
        let achieved_usdc_u128 = (deposited as u128)
            .checked_mul(actual_capped as u128)
            .ok_or(StreamPumpError::MathOverflow)?
            .checked_div(target as u128)
            .ok_or(StreamPumpError::MathOverflow)?;
        let achieved_usdc =
            u64::try_from(achieved_usdc_u128).map_err(|_| error!(StreamPumpError::MathOverflow))?;

        let unachieved_usdc = checked_sub(deposited, achieved_usdc)?;
        if unachieved_usdc > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                        to: ctx.accounts.sponsor_usdc_ata.to_account_info(),
                        authority: proposal.to_account_info(),
                    },
                    signer,
                ),
                unachieved_usdc,
            )?;
        }

        let creator_payout = amount_from_bps(achieved_usdc, TRACK2_CREATOR_PAYOUT_BPS)?;
        let fan_pool = checked_sub(achieved_usdc, creator_payout)?;

        if creator_payout > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.proposal_usdc_vault.to_account_info(),
                        to: ctx.accounts.creator_usdc_ata.to_account_info(),
                        authority: proposal.to_account_info(),
                    },
                    signer,
                ),
                creator_payout,
            )?;
        }

        proposal.track2_usdc_deposited = fan_pool;
        proposal.status = ProposalStatus::Resolved_Success;
    }

    proposal.track2_actual_value = Some(args.actual_value);
    proposal.track2_settled_at = now;

    Ok(())
}

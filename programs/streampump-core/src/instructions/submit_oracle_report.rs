// EN: Oracle authority submits the final cleaned view count and report digest for a campaign.
// ZH: 预言机权限账户为某个活动提交最终清洗后的观看量及报告摘要，用于结算。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{CampaignEscrow, CampaignStatus, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitOracleReportArgs {
    pub final_views: u64,
    pub request_id: [u8; 32],
    pub report_digest: [u8; 32],
}

#[derive(Accounts)]
pub struct SubmitOracleReport<'info> {
    pub oracle_authority: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ StreamPumpError::CampaignClosed
    )]
    pub campaign: Account<'info, CampaignEscrow>,
}

pub(crate) fn handler(
    ctx: Context<SubmitOracleReport>,
    args: SubmitOracleReportArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle_authority.key(),
        ctx.accounts.protocol_config.oracle_authority,
        StreamPumpError::Unauthorized
    );

    let campaign = &mut ctx.accounts.campaign;
    require!(
        !campaign.oracle_reported,
        StreamPumpError::OracleAlreadyReported
    );

    campaign.oracle_reported = true;
    campaign.oracle_final_views = args.final_views;
    campaign.oracle_outcome_yes = args.final_views >= campaign.target_view_count;
    campaign.oracle_request_id = args.request_id;
    campaign.oracle_report_digest = args.report_digest;
    campaign.oracle_reported_at = Clock::get()?.unix_timestamp;

    Ok(())
}

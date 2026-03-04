// EN: Creator pauses S1 curve trading and opens buyout auction.
// ZH: 创作者暂停 S1 曲线交易并开启买断竞价。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{CreatorProfile, CreatorStatus},
};

#[derive(Accounts)]
pub struct InitS1Buyout<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"creator", creator.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
}

pub(crate) fn handler(ctx: Context<InitS1Buyout>) -> Result<()> {
    let creator_profile = &mut ctx.accounts.creator_profile;
    require!(
        creator_profile.status == CreatorStatus::S1_Active,
        StreamPumpError::InvalidCreatorStatus
    );

    creator_profile.status = CreatorStatus::S1_Auction_Pending;
    creator_profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

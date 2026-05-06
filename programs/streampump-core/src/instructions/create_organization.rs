// EN: Create an organization shell for creator OPCs, sponsor brands, or MCNs.
// ZH: 为创作者 OPC、赞助品牌或 MCN 创建组织壳。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{
        Organization, OrganizationMemberRole, OrganizationMembership, OrganizationType,
        UserProfile, MAX_ORGANIZATION_NAME_LEN,
    },
    utils::role_flag_for_organization_type,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateOrganizationArgs {
    pub organization_type: OrganizationType,
    pub organization_seed: [u8; 32],
    pub display_name: String,
    pub payout_usdc_ata: Pubkey,
    pub metadata_digest: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: CreateOrganizationArgs)]
pub struct CreateOrganization<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = owner_user_profile.bump,
        constraint = owner_user_profile.authority == owner.key() @ StreamPumpError::Unauthorized
    )]
    pub owner_user_profile: Account<'info, UserProfile>,

    #[account(
        init,
        payer = owner,
        seeds = [b"organization", owner.key().as_ref(), args.organization_seed.as_ref()],
        bump,
        space = 8 + Organization::INIT_SPACE
    )]
    pub organization: Account<'info, Organization>,

    #[account(
        init,
        payer = owner,
        seeds = [b"org_membership", organization.key().as_ref(), owner.key().as_ref()],
        bump,
        space = 8 + OrganizationMembership::INIT_SPACE
    )]
    pub owner_membership: Account<'info, OrganizationMembership>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<CreateOrganization>,
    args: CreateOrganizationArgs,
) -> Result<()> {
    require!(
        !args.display_name.is_empty() && args.display_name.len() <= MAX_ORGANIZATION_NAME_LEN,
        StreamPumpError::InvalidOrganizationName
    );
    require!(
        args.organization_seed != [0_u8; 32],
        StreamPumpError::InvalidOrganizationSeed
    );

    let now = Clock::get()?.unix_timestamp;
    let role_flag = role_flag_for_organization_type(args.organization_type);

    let owner_user_profile = &mut ctx.accounts.owner_user_profile;
    owner_user_profile.role_flags |= role_flag;
    owner_user_profile.updated_at = now;

    let organization = &mut ctx.accounts.organization;
    organization.owner = ctx.accounts.owner.key();
    organization.organization_type = args.organization_type;
    organization.organization_seed = args.organization_seed;
    organization.display_name = args.display_name;
    organization.payout_usdc_ata = args.payout_usdc_ata;
    organization.metadata_digest = args.metadata_digest;
    organization.member_count = 1;
    organization.created_at = now;
    organization.updated_at = now;
    organization.bump = ctx.bumps.organization;

    let owner_membership = &mut ctx.accounts.owner_membership;
    owner_membership.organization = organization.key();
    owner_membership.user = ctx.accounts.owner.key();
    owner_membership.role = OrganizationMemberRole::Owner;
    owner_membership.active = true;
    owner_membership.created_at = now;
    owner_membership.updated_at = now;
    owner_membership.bump = ctx.bumps.owner_membership;

    Ok(())
}

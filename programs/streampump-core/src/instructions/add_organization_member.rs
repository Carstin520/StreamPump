// EN: Add or update a member inside an organization.
// ZH: 为组织添加或更新成员。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{Organization, OrganizationMemberRole, OrganizationMembership, UserProfile},
    utils::role_flag_for_organization_type,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AddOrganizationMemberArgs {
    pub role: OrganizationMemberRole,
}

#[derive(Accounts)]
pub struct AddOrganizationMember<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = organization.owner == authority.key() @ StreamPumpError::Unauthorized
    )]
    pub organization: Account<'info, Organization>,

    /// CHECK: Member pubkey is mirrored into `member_user_profile`.
    pub member: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"user_profile", member.key().as_ref()],
        bump = member_user_profile.bump,
        constraint = member_user_profile.authority == member.key() @ StreamPumpError::Unauthorized
    )]
    pub member_user_profile: Account<'info, UserProfile>,

    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"org_membership", organization.key().as_ref(), member.key().as_ref()],
        bump,
        space = 8 + OrganizationMembership::INIT_SPACE
    )]
    pub organization_membership: Account<'info, OrganizationMembership>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<AddOrganizationMember>,
    args: AddOrganizationMemberArgs,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let role_flag = role_flag_for_organization_type(ctx.accounts.organization.organization_type);

    let membership = &mut ctx.accounts.organization_membership;
    if membership.organization == Pubkey::default() {
        ctx.accounts.organization.member_count = ctx
            .accounts
            .organization
            .member_count
            .checked_add(1)
            .ok_or(StreamPumpError::MathOverflow)?;
        membership.organization = ctx.accounts.organization.key();
        membership.user = ctx.accounts.member.key();
        membership.created_at = now;
        membership.bump = ctx.bumps.organization_membership;
    } else {
        require_keys_eq!(
            membership.organization,
            ctx.accounts.organization.key(),
            StreamPumpError::ProposalAccountMismatch
        );
        require_keys_eq!(
            membership.user,
            ctx.accounts.member.key(),
            StreamPumpError::Unauthorized
        );
    }

    membership.role = args.role;
    membership.active = true;
    membership.updated_at = now;

    let member_user_profile = &mut ctx.accounts.member_user_profile;
    member_user_profile.role_flags |= role_flag;
    member_user_profile.updated_at = now;

    ctx.accounts.organization.updated_at = now;

    Ok(())
}

// EN: Anchor a creator's content (canonical URL + content hash) on-chain for oracle and proposal reference.
// ZH: 将创作者内容（规范化 URL 与内容哈希）锚定到链上，供预言机与提案引用使用。
use anchor_lang::prelude::*;

use crate::{
    errors::StreamPumpError,
    state::{ContentHashAnchor, CreatorProfile, MAX_CANONICAL_URL_LEN},
    utils::keccak_digest,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AnchorContentHashArgs {
    pub canonical_url: String,
    pub url_digest: [u8; 32],
    pub content_digest: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: AnchorContentHashArgs)]
pub struct AnchorContentHash<'info> {
    #[account(mut)]
    pub creator_authority: Signer<'info>,
    #[account(
        seeds = [b"creator", creator_authority.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator_authority.key() @ StreamPumpError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(
        init,
        payer = creator_authority,
        seeds = [
            b"content_anchor",
            creator_profile.key().as_ref(),
            args.url_digest.as_ref()
        ],
        bump,
        space = 8 + ContentHashAnchor::INIT_SPACE
    )]
    pub content_anchor: Account<'info, ContentHashAnchor>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<AnchorContentHash>, args: AnchorContentHashArgs) -> Result<()> {
    require!(
        !args.canonical_url.is_empty() && args.canonical_url.len() <= MAX_CANONICAL_URL_LEN,
        StreamPumpError::StringTooLong
    );

    let expected_digest = keccak_digest(args.canonical_url.as_bytes());
    require!(
        expected_digest == args.url_digest,
        StreamPumpError::UrlDigestMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    let content_anchor = &mut ctx.accounts.content_anchor;
    content_anchor.creator_profile = ctx.accounts.creator_profile.key();
    content_anchor.authority = ctx.accounts.creator_authority.key();
    content_anchor.canonical_url = args.canonical_url;
    content_anchor.url_digest = args.url_digest;
    content_anchor.content_digest = args.content_digest;
    content_anchor.anchored_at = now;
    content_anchor.bump = ctx.bumps.content_anchor;

    Ok(())
}

// EN: Register or update a creator profile, including handle and USDC payout account.
// ZH: 注册或更新创作者档案，包括展示昵称和 USDC 收款账户。
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, CreatorStatus, ProtocolConfig, DEFAULT_CREATOR_LEVEL,
        DEFAULT_S1_RATING_BPS, MAX_HANDLE_LEN,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterCreatorArgs {
    //创作者昵称
    pub handle: String,
    //创作者 USDC 收款账户
    pub payout_usdc_ata: Pubkey,
}

#[derive(Accounts)]
pub struct RegisterCreator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"creator", authority.key().as_ref()],
        bump,
        space = 8 + CreatorProfile::INIT_SPACE
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    /// CHECK: Solana instructions sysvar, used to verify the preceding Ed25519 auth instruction.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

const CREATOR_AUTH_DOMAIN: &[u8] = b"streampump:creator-register:v1";
const CREATOR_AUTH_NONCE_LEN: usize = 32;
const CREATOR_AUTH_MAX_AGE_SECONDS: i64 = 10 * 60;
const CREATOR_AUTH_MAX_CLOCK_SKEW_SECONDS: i64 = 60;
const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");
const ED25519_OFFSETS_START: usize = 2;
const ED25519_OFFSETS_LEN: usize = 14;
const ED25519_INSTRUCTION_INDEX_SELF: u16 = u16::MAX;

pub(crate) fn handler(ctx: Context<RegisterCreator>, args: RegisterCreatorArgs) -> Result<()> {
    require!(
        !args.handle.is_empty() && args.handle.len() <= MAX_HANDLE_LEN,
        StreamPumpError::InvalidHandle
    );
    verify_creator_authorization(&ctx, &args.handle)?;

    let profile = &mut ctx.accounts.creator_profile;
    if profile.authority == Pubkey::default() {
        profile.authority = ctx.accounts.authority.key();
        profile.level = DEFAULT_CREATOR_LEVEL;
        profile.status = CreatorStatus::S1_Active;
        profile.s1_supply = 0;
        profile.s1_early_cohort_supply = 0;
        profile.s1_rating_bps = DEFAULT_S1_RATING_BPS;
        profile.s1_graduation_target_supply = ctx
            .accounts
            .protocol_config
            .default_s1_graduation_target_supply;
        profile.pending_s1_rating_bps = 0;
        profile.pending_s1_graduation_target_supply = 0;
        profile.pending_rating_effective_at = 0;
        profile.pending_rating_report_digest = [0_u8; 32];
        profile.last_rating_update_at = 0;
        profile.last_rating_report_digest = [0_u8; 32];
        profile.last_upgrade_at = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.creator_profile;
    }

    require_keys_eq!(
        profile.authority,
        ctx.accounts.authority.key(),
        StreamPumpError::Unauthorized
    );

    profile.handle = args.handle;
    profile.payout_usdc_ata = args.payout_usdc_ata;
    profile.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

fn read_u16_le(data: &[u8], offset: usize) -> Result<u16> {
    let bytes = data
        .get(offset..offset + 2)
        .ok_or(error!(StreamPumpError::InvalidCreatorSignature))?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn verify_creator_authorization(ctx: &Context<RegisterCreator>, handle: &str) -> Result<()> {
    let instructions_account = ctx.accounts.instructions.to_account_info();
    let current_index = load_current_index_checked(&instructions_account)?;
    require!(current_index > 0, StreamPumpError::InvalidCreatorSignature);

    let previous_instruction =
        load_instruction_at_checked((current_index - 1) as usize, &instructions_account)?;
    require_keys_eq!(
        previous_instruction.program_id,
        ED25519_PROGRAM_ID,
        StreamPumpError::InvalidCreatorSignature
    );

    let data = previous_instruction.data;
    require!(
        data.len() >= ED25519_OFFSETS_START + ED25519_OFFSETS_LEN,
        StreamPumpError::InvalidCreatorSignature
    );
    require!(data[0] == 1, StreamPumpError::InvalidCreatorSignature);

    let signature_offset = read_u16_le(&data, ED25519_OFFSETS_START)? as usize;
    let signature_instruction_index = read_u16_le(&data, ED25519_OFFSETS_START + 2)?;
    let public_key_offset = read_u16_le(&data, ED25519_OFFSETS_START + 4)? as usize;
    let public_key_instruction_index = read_u16_le(&data, ED25519_OFFSETS_START + 6)?;
    let message_offset = read_u16_le(&data, ED25519_OFFSETS_START + 8)? as usize;
    let message_size = read_u16_le(&data, ED25519_OFFSETS_START + 10)? as usize;
    let message_instruction_index = read_u16_le(&data, ED25519_OFFSETS_START + 12)?;

    require!(
        signature_instruction_index == ED25519_INSTRUCTION_INDEX_SELF
            && public_key_instruction_index == ED25519_INSTRUCTION_INDEX_SELF
            && message_instruction_index == ED25519_INSTRUCTION_INDEX_SELF,
        StreamPumpError::InvalidCreatorSignature
    );
    require!(
        signature_offset
            .checked_add(64)
            .filter(|end| *end <= data.len())
            .is_some()
            && public_key_offset
                .checked_add(32)
                .filter(|end| *end <= data.len())
                .is_some()
            && message_offset
                .checked_add(message_size)
                .filter(|end| *end <= data.len())
                .is_some(),
        StreamPumpError::InvalidCreatorSignature
    );

    let signer = data
        .get(public_key_offset..public_key_offset + 32)
        .ok_or(error!(StreamPumpError::InvalidCreatorSignature))?;
    require!(
        signer == ctx.accounts.protocol_config.oracle_authority.as_ref(),
        StreamPumpError::InvalidCreatorSignature
    );

    let message = data
        .get(message_offset..message_offset + message_size)
        .ok_or(error!(StreamPumpError::InvalidCreatorSignature))?;
    verify_creator_auth_message(
        message,
        &ctx.accounts.authority.key(),
        handle,
        Clock::get()?.unix_timestamp,
    )
}

fn verify_creator_auth_message(
    message: &[u8],
    creator: &Pubkey,
    handle: &str,
    now: i64,
) -> Result<()> {
    let handle_bytes = handle.as_bytes();
    let expected_min_len =
        CREATOR_AUTH_DOMAIN.len() + 32 + 2 + handle_bytes.len() + CREATOR_AUTH_NONCE_LEN + 8;
    require!(
        message.len() == expected_min_len,
        StreamPumpError::InvalidCreatorSignature
    );

    let mut cursor = 0;
    require!(
        message.get(cursor..cursor + CREATOR_AUTH_DOMAIN.len()) == Some(CREATOR_AUTH_DOMAIN),
        StreamPumpError::InvalidCreatorSignature
    );
    cursor += CREATOR_AUTH_DOMAIN.len();

    require!(
        message.get(cursor..cursor + 32) == Some(creator.as_ref()),
        StreamPumpError::InvalidCreatorSignature
    );
    cursor += 32;

    let handle_len = read_u16_le(message, cursor)? as usize;
    cursor += 2;
    require!(
        handle_len == handle_bytes.len(),
        StreamPumpError::InvalidCreatorSignature
    );
    require!(
        message.get(cursor..cursor + handle_len) == Some(handle_bytes),
        StreamPumpError::InvalidCreatorSignature
    );
    cursor += handle_len;

    let nonce = message
        .get(cursor..cursor + CREATOR_AUTH_NONCE_LEN)
        .ok_or(error!(StreamPumpError::InvalidCreatorSignature))?;
    require!(
        nonce.iter().any(|byte| *byte != 0),
        StreamPumpError::InvalidCreatorSignature
    );
    cursor += CREATOR_AUTH_NONCE_LEN;

    let timestamp_bytes = message
        .get(cursor..cursor + 8)
        .ok_or(error!(StreamPumpError::InvalidCreatorSignature))?;
    let timestamp = i64::from_le_bytes(
        timestamp_bytes
            .try_into()
            .map_err(|_| error!(StreamPumpError::InvalidCreatorSignature))?,
    );

    require!(
        timestamp <= now + CREATOR_AUTH_MAX_CLOCK_SKEW_SECONDS,
        StreamPumpError::InvalidCreatorSignature
    );
    require!(
        now.saturating_sub(timestamp) <= CREATOR_AUTH_MAX_AGE_SECONDS,
        StreamPumpError::InvalidCreatorSignature
    );

    Ok(())
}

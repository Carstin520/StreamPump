use anchor_lang::prelude::*;
use solana_keccak_hasher::hash as keccak_hash;

use crate::{
    errors::StreamPumpError,
    state::{
        CreatorProfile, OrganizationType, DEFAULT_S1_RATING_BPS, USER_ROLE_CREATOR,
        USER_ROLE_MCN_OPERATOR, USER_ROLE_SPONSOR_OPERATOR, VALID_USER_ROLE_MASK,
    },
};

/// Linear bonding curve slope factor (k) for S1 internal token pricing.
pub const S1_BONDING_CURVE_K: u64 = 1_000;
/// Protocol-required SPUMP decimals.
pub const SPUMP_DECIMALS: u8 = 6;
/// One whole SPUMP in base units.
pub const ONE_SPUMP: u64 = 1_000_000;

/// Calculate the amount from a base amount and basis points (bps).
/// Formula: amount * bps / 10000
/// 根据基础金额和基点（bps）计算实际金额。公式：金额 * 基点 / 10000
pub fn amount_from_bps(amount: u64, bps: u16) -> Result<u64> {
    let numerator = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?;

    let scaled = numerator
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(scaled).map_err(|_| error!(StreamPumpError::MathOverflow))
}

/// Safe addition with overflow check. Returns error if overflow occurs.
/// 带溢出检查的安全加法。如果发生溢出则返回错误。
pub fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

/// Safe subtraction with underflow check. Returns error if underflow occurs.
/// 带下溢检查的安全减法。如果发生下溢则返回错误。
pub fn checked_sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

/// Compute Keccak-256 hash digest of input bytes, returning a 32-byte array.
/// Used for content/URL hashing in content anchoring.
/// 计算输入字节的 Keccak-256 哈希摘要，返回 32 字节数组。用于内容锚定中的内容/URL 哈希。
pub fn keccak_digest(input: &[u8]) -> [u8; 32] {
    keccak_hash(input).to_bytes()
}

fn effective_s1_curve_k(rating_bps: u16) -> Result<u128> {
    require!(rating_bps > 0, StreamPumpError::InvalidCreatorRatingConfig);
    let scaled = (S1_BONDING_CURVE_K as u128)
        .checked_mul(rating_bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    Ok(std::cmp::max(scaled, 1))
}

/// Calculates buy cost for S1 internal tokens using:
/// cost = effective_k/2 * ((S + dS)^2 - S^2)
pub fn calculate_buy_cost_with_rating(
    current_supply: u64,
    amount: u64,
    rating_bps: u16,
) -> Result<u64> {
    let start = current_supply as u128;
    let delta = amount as u128;
    let end = start
        .checked_add(delta)
        .ok_or(StreamPumpError::MathOverflow)?;

    let start_sq = start
        .checked_mul(start)
        .ok_or(StreamPumpError::MathOverflow)?;
    let end_sq = end.checked_mul(end).ok_or(StreamPumpError::MathOverflow)?;

    let diff = end_sq
        .checked_sub(start_sq)
        .ok_or(StreamPumpError::MathOverflow)?;
    let scaled = effective_s1_curve_k(rating_bps)?
        .checked_mul(diff)
        .ok_or(StreamPumpError::MathOverflow)?;
    let cost = scaled.checked_div(2).ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(cost).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn calculate_buy_cost(current_supply: u64, amount: u64) -> Result<u64> {
    calculate_buy_cost_with_rating(current_supply, amount, DEFAULT_S1_RATING_BPS)
}

/// Calculates gross sell return for S1 internal tokens using:
/// return = effective_k/2 * (S^2 - (S - dS)^2)
pub fn calculate_sell_return_with_rating(
    current_supply: u64,
    amount: u64,
    rating_bps: u16,
) -> Result<u64> {
    let start = current_supply as u128;
    let delta = amount as u128;
    let end = start
        .checked_sub(delta)
        .ok_or(StreamPumpError::InvalidAmount)?;

    let start_sq = start
        .checked_mul(start)
        .ok_or(StreamPumpError::MathOverflow)?;
    let end_sq = end.checked_mul(end).ok_or(StreamPumpError::MathOverflow)?;

    let diff = start_sq
        .checked_sub(end_sq)
        .ok_or(StreamPumpError::MathOverflow)?;
    let scaled = effective_s1_curve_k(rating_bps)?
        .checked_mul(diff)
        .ok_or(StreamPumpError::MathOverflow)?;
    let gross = scaled.checked_div(2).ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(gross).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn calculate_sell_return(current_supply: u64, amount: u64) -> Result<u64> {
    calculate_sell_return_with_rating(current_supply, amount, DEFAULT_S1_RATING_BPS)
}

pub fn validate_role_flags(role_flags: u16) -> Result<()> {
    require!(
        role_flags > 0 && role_flags & !VALID_USER_ROLE_MASK == 0,
        StreamPumpError::InvalidRoleFlags
    );
    Ok(())
}

pub fn daily_spump_amount_for_level(level: u8) -> Result<u64> {
    let multiplier: u64 = match level {
        0 | 1 => 1,
        2 => 2,
        3 => 3,
        4 => 5,
        _ => 8,
    };

    ONE_SPUMP
        .checked_mul(multiplier)
        .ok_or_else(|| error!(StreamPumpError::MathOverflow))
}

pub fn apply_emission_multiplier(amount: u64, multiplier_bps: u16) -> Result<u64> {
    require!(multiplier_bps > 0, StreamPumpError::InvalidEmissionConfig);
    let scaled = (amount as u128)
        .checked_mul(multiplier_bps as u128)
        .ok_or(StreamPumpError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(std::cmp::max(scaled, 1)).map_err(|_| error!(StreamPumpError::MathOverflow))
}

pub fn apply_new_user_emission_discount(
    amount: u64,
    user_created_at: i64,
    now: i64,
    window_seconds: i64,
    new_user_bps: u16,
) -> Result<u64> {
    require!(
        new_user_bps > 0 && new_user_bps <= 10_000 && window_seconds >= 0,
        StreamPumpError::InvalidEmissionConfig
    );

    let is_new_user = user_created_at > 0
        && window_seconds > 0
        && now
            < user_created_at
                .checked_add(window_seconds)
                .ok_or(StreamPumpError::MathOverflow)?;

    if is_new_user {
        return amount_from_bps(amount, new_user_bps);
    }

    Ok(amount)
}

pub fn activate_pending_s1_rating(creator_profile: &mut CreatorProfile, now: i64) {
    if creator_profile.pending_s1_rating_bps > 0
        && creator_profile.pending_rating_effective_at > 0
        && now >= creator_profile.pending_rating_effective_at
    {
        creator_profile.s1_rating_bps = creator_profile.pending_s1_rating_bps;
        creator_profile.s1_graduation_target_supply =
            creator_profile.pending_s1_graduation_target_supply;
        creator_profile.last_rating_report_digest = creator_profile.pending_rating_report_digest;
        creator_profile.pending_s1_rating_bps = 0;
        creator_profile.pending_s1_graduation_target_supply = 0;
        creator_profile.pending_rating_effective_at = 0;
        creator_profile.pending_rating_report_digest = [0_u8; 32];
    }
}

pub fn role_flag_for_organization_type(organization_type: OrganizationType) -> u16 {
    match organization_type {
        OrganizationType::CreatorOpc => USER_ROLE_CREATOR,
        OrganizationType::SponsorBrand => USER_ROLE_SPONSOR_OPERATOR,
        OrganizationType::McnAgency => USER_ROLE_MCN_OPERATOR,
    }
}

/// Calculates an exact pro-rata share against the remaining pool.
/// The final claimant sweeps the entire remainder to avoid stranded dust.
pub fn calculate_remaining_pro_rata_share(
    claimant_amount: u64,
    remaining_pool: u64,
    remaining_total: u64,
) -> Result<u64> {
    require!(
        claimant_amount > 0 && remaining_total > 0 && claimant_amount <= remaining_total,
        StreamPumpError::InvalidAmount
    );

    if claimant_amount == remaining_total {
        return Ok(remaining_pool);
    }

    let numerator = (claimant_amount as u128)
        .checked_mul(remaining_pool as u128)
        .ok_or(StreamPumpError::MathOverflow)?;
    let share = numerator
        .checked_div(remaining_total as u128)
        .ok_or(StreamPumpError::MathOverflow)?;

    u64::try_from(share).map_err(|_| error!(StreamPumpError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::calculate_remaining_pro_rata_share;

    #[test]
    fn pro_rata_share_rounds_down_before_final_claim() {
        let share = calculate_remaining_pro_rata_share(2, 100, 3).unwrap();
        assert_eq!(share, 66);
    }

    #[test]
    fn final_claimant_sweeps_remaining_dust() {
        let share = calculate_remaining_pro_rata_share(1, 34, 1).unwrap();
        assert_eq!(share, 34);
    }
}

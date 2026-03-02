use anchor_lang::{prelude::*, solana_program::keccak};

use crate::errors::StreamPumpError;

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
    keccak::hash(input).0
}

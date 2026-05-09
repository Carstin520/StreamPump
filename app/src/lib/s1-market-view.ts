import { PublicKey } from "@solana/web3.js";

import { DEMO_S1_CREATOR_WALLET, S1MarketProfileResponse, S1PortfolioResponse } from "@/lib/api/s1";
import { CreatorMarketRecord } from "@/lib/api/types";
import { findCreator } from "@/lib/public-data";

const DEMO_SLUGS = new Set(["demo", "s1-demo", "s1-buyout-demo", "luna-cai"]);

export const isSolanaWalletAddress = (value: string) => {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch (_error) {
    return false;
  }
};

export const resolveCreatorWalletForRoute = (creatorId: string): string | null => {
  if (isSolanaWalletAddress(creatorId)) {
    return creatorId;
  }

  if (DEMO_SLUGS.has(creatorId)) {
    return DEMO_S1_CREATOR_WALLET;
  }

  return null;
};

export const resolveFallbackCreator = (creatorId: string): CreatorMarketRecord => {
  if (DEMO_SLUGS.has(creatorId)) {
    return findCreator("luna-cai");
  }

  return findCreator(creatorId);
};

export const displayCreatorName = (
  profile: S1MarketProfileResponse | null,
  fallback: CreatorMarketRecord,
) => profile?.creator.displayName || profile?.creator.handle || fallback.name;

export const displayCreatorHandle = (
  profile: S1MarketProfileResponse | null,
  fallback: CreatorMarketRecord,
) => profile?.creator.handle || fallback.handle.replace(/^@/, "");

export const shortenWallet = (value: string | null | undefined) =>
  value ? `${value.slice(0, 4)}...${value.slice(-4)}` : "—";

const bigintFrom = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch (_error) {
    return 0n;
  }
};

const formatScaledAmount = (value: string | null | undefined, decimals: number, fractionDigits = 2) => {
  const raw = bigintFrom(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const fractionBase = 10n ** BigInt(Math.max(0, decimals - fractionDigits));
  const roundedFraction = fractionBase > 0n ? fraction / fractionBase : fraction;
  const fractionText = roundedFraction.toString().padStart(fractionDigits, "0").replace(/0+$/, "");
  const wholeText = new Intl.NumberFormat("en-US").format(Number(whole));

  return fractionText ? `${wholeText}.${fractionText}` : wholeText;
};

export const formatSpump = (value: string | null | undefined) =>
  `${formatScaledAmount(value, 9, 3)} SPUMP`;

export const formatUsdcAmount = (value: string | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(formatScaledAmount(value, 6, 2).replace(/,/g, "")) || 0);

export const formatS1Amount = (value: string | null | undefined) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(bigintFrom(value)));

export const findPortfolioPosition = (
  portfolio: S1PortfolioResponse | null,
  creatorWallet: string,
) =>
  portfolio?.positions.find(
    (position) => position.creatorWallet === creatorWallet || position.creator?.creatorWallet === creatorWallet,
  ) ?? null;

export const hasClaimableUsdc = (value: string | null | undefined) => bigintFrom(value) > 0n;

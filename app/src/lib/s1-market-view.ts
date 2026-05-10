import { PublicKey } from "@solana/web3.js";

import { DEMO_S1_CREATOR_WALLET, S1MarketProfileResponse, S1PortfolioResponse } from "@/lib/api/s1";
import { CreatorMarketRecord } from "@/lib/api/types";
import { findCreator } from "@/lib/public-data";

const DEMO_ROUTE_CREATORS: Record<string, string> = {
  demo: "mika-zhou",
  "s1-demo": "mika-zhou",
  "s1-buyout-demo": "luna-cai",
  "mika-zhou": "mika-zhou",
  "luna-cai": "luna-cai",
};

const DEMO_SLUGS = new Set(Object.keys(DEMO_ROUTE_CREATORS));

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
  const demoCreatorId = DEMO_ROUTE_CREATORS[creatorId];
  if (demoCreatorId) {
    return findCreator(demoCreatorId);
  }

  return findCreator(creatorId);
};

export const isDemoCreatorRoute = (creatorId: string) => DEMO_SLUGS.has(creatorId);

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

export const formatGraduationProgressPercent = (progressBps: number | null | undefined) => {
  if (typeof progressBps !== "number" || !Number.isFinite(progressBps)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(progressBps / 100)));
};

export const buildDemoS1MarketProfile = (creator: CreatorMarketRecord): S1MarketProfileResponse => {
  const now = new Date().toISOString();
  const isBuyoutDemo = creator.id === "luna-cai";
  const creatorProfilePda = `demo-profile-${creator.id}`;
  const buyoutStatePda = `demo-buyout-${creator.id}`;
  const graduationProgressBps = Math.round(Math.max(0, Math.min(100, creator.graduationProgress)) * 100);
  const currentPriceAtomic = String(Math.round(creator.tokenPrice * 1_000_000_000));
  const nextPriceAtomic = String(Math.round((creator.tokenPrice + 0.18) * 1_000_000_000));
  const latestOfferUsdc = isBuyoutDemo ? String((creator.buyoutOfferUsd ?? 850000) * 1_000_000) : null;

  return {
    creator: {
      creatorWallet: DEMO_S1_CREATOR_WALLET,
      creatorProfilePda,
      handle: creator.handle.replace(/^@/, ""),
      displayName: creator.name,
      stage: creator.state,
      level: 1,
      s1Supply: String(creator.supply),
      currentPriceSpump: currentPriceAtomic,
      nextPriceSpump: nextPriceAtomic,
      supporterPoolSpump: String(Math.round((creator.supporterDistributableUsd ?? 45000) * 1_000_000_000)),
      holderCount: creator.holderCount,
      graduationProgressBps,
      activeCampaignCount: creator.activeCampaignCount ?? 0,
      latestBuyoutOfferUsdc: latestOfferUsdc,
      acceptedBuyoutOfferUsdc: isBuyoutDemo ? latestOfferUsdc : null,
      buyoutStatePda: isBuyoutDemo ? buyoutStatePda : null,
      metadata: {
        demo: true,
        routeCreatorId: creator.id,
        niche: creator.niche,
      },
      updatedAt: now,
    },
    buyout: isBuyoutDemo
      ? {
          status: "EXECUTION_PENDING",
          buyoutStatePda,
          winningSponsorWallet: "Sponsor111111111111111111111111111111111",
          acceptedOfferPda: "demo-offer-apex-motion",
          acceptedOfferUsdc: latestOfferUsdc,
          latestOfferPda: "demo-offer-apex-motion",
          latestOfferUsdc,
          usdcDeposited: latestOfferUsdc,
          claimableUsdcRemaining: String(124000 * 1_000_000),
          claimableS1SupplyRemaining: String(Math.round(creator.supply * 0.34)),
          rageQuitDeadlineAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        }
      : null,
    offers: isBuyoutDemo
      ? [
          {
            buyoutOfferPda: "demo-offer-apex-motion",
            sponsorWallet: "Sponsor111111111111111111111111111111111",
            usdcAmount: latestOfferUsdc ?? "0",
            status: "ACCEPTED",
            sponsorCancelAfterAt: null,
          },
          {
            buyoutOfferPda: "demo-offer-gridline",
            sponsorWallet: "Gridline11111111111111111111111111111111",
            usdcAmount: String(720000 * 1_000_000),
            status: "OUTBID",
            sponsorCancelAfterAt: null,
          },
        ]
      : [],
    campaigns: [],
  };
};

export const buildDemoS1Portfolio = (
  creatorWallet: string,
  profile: S1MarketProfileResponse,
): S1PortfolioResponse => ({
  userWallet: "DemoWallet111111111111111111111111111111111",
  positions: [
    {
      positionPda: "demo-position-s1",
      creatorWallet,
      creatorProfilePda: profile.creator.creatorProfilePda,
      creator: profile.creator,
      internalTokenBalance: "120",
      spumpCostBasis: "288000000000",
      estimatedClaimableUsdc: profile.buyout?.claimableUsdcRemaining ?? null,
      updatedAt: profile.creator.updatedAt,
    },
  ],
});

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

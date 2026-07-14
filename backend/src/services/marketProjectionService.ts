import {
  BuyoutOfferProjectionStatus,
  BuyoutProjectionStatus,
  CampaignProofStatus,
  ContentManifest,
  ContentManifestStatus,
  ContentPublication,
  MarketCreatorStage,
  Prisma,
  Proposal,
  ProposalStatus,
} from "@prisma/client";
import { PublicKey } from "@solana/web3.js";

import {
  OnChainCreatorProfileState,
  getAnchorService,
} from "./AnchorService";
import { prisma } from "./prisma";
import { buildCampaignIntegrity } from "./campaignIntegrity";

const S1_BONDING_CURVE_K = 1_000n;
const DEFAULT_S1_RATING_BPS = 10_000n;
const DEFAULT_GRADUATION_SUPPLY_TARGET = 2_500n;
const S1_REWARD_MODEL_FLAT_EQUAL = 0;
const S1_REWARD_MODEL_EARLINESS_TIERED = 1;
const S1_REWARD_MODEL_STATUS_PRIMARY = 2;
const DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC = 100_000_000n;
const DEFAULT_S1_STATUS_THANKYOU_USDC = 10_000_000n;
const DEFAULT_TRACK2_REWARD_CAP_USDC = 100_000_000n;

type ChainProjectionEvent = {
  signature: string;
  instructionName: string;
  proposalPda: string | null;
  entityPda: string | null;
  payload: Record<string, unknown>;
};

type MarketProofManifest = ContentManifest & {
  assets: Array<{
    id: string;
    assetType: string;
    orderIndex: number;
    sha256Hex: string;
    mimeType: string;
    fileSizeBytes: bigint;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    cdnUrl: string | null;
    muxPlaybackId: string | null;
    uploadStatus: string;
    processingStatus: string;
    verifiedSha256Hex: string | null;
    verifiedSizeBytes: bigint | null;
    storageVerifiedAt: Date | null;
    updatedAt: Date;
  }>;
  publications: ContentPublication[];
};

type PublicCampaignProposal = Proposal & {
  manifest: MarketProofManifest | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const unwrapEventPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  if (isRecord(payload.eventData)) {
    return {
      ...(isRecord(payload.accounts) ? payload.accounts : {}),
      ...(isRecord(payload.args) ? payload.args : {}),
      ...payload.eventData,
    };
  }

  if (isRecord(payload.args)) {
    const nestedArgs = isRecord(payload.args.args) ? payload.args.args : {};
    return {
      ...(isRecord(payload.accounts) ? payload.accounts : {}),
      ...payload.args,
      ...nestedArgs,
    };
  }

  return payload;
};

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const readBigInt = (record: Record<string, unknown>, key: string): bigint | null => {
  const value = record[key];
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
};

const readBigIntAlias = (
  record: Record<string, unknown>,
  ...keys: string[]
): bigint | null => {
  for (const key of keys) {
    const value = readBigInt(record, key);
    if (value !== null) return value;
  }

  return null;
};

const readIntAlias = (record: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      return Number.parseInt(value.trim(), 10);
    }
  }

  return null;
};

const unixSecondsToDate = (value: bigint | null): Date | null => {
  if (value === null || value <= 0n) {
    return null;
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  return new Date(seconds * 1000);
};

const effectiveCurveK = (ratingBps: number): bigint =>
  (S1_BONDING_CURVE_K * BigInt(Math.max(1, ratingBps))) / DEFAULT_S1_RATING_BPS;

const calculateBuyCost = (
  currentSupply: bigint,
  amount: bigint,
  ratingBps: number
): bigint => {
  const end = currentSupply + amount;
  return (effectiveCurveK(ratingBps) * (end * end - currentSupply * currentSupply)) / 2n;
};

const calculateFullCurveValue = (supply: bigint, ratingBps: number): bigint =>
  (effectiveCurveK(ratingBps) * supply * supply) / 2n;

const calculateGraduationProgressBps = (supply: bigint, targetSupply: bigint): number => {
  if (supply <= 0n) {
    return 0;
  }

  const target = targetSupply > 0n ? targetSupply : DEFAULT_GRADUATION_SUPPLY_TARGET;
  const bps = (supply * 10_000n) / target;
  return Number(bps > 10_000n ? 10_000n : bps);
};

const mapCreatorStage = (
  creator: OnChainCreatorProfileState,
  hasAcceptedBuyout: boolean
): MarketCreatorStage => {
  if (creator.status === "S2_ACTIVE") {
    return MarketCreatorStage.S2_ACTIVE;
  }

  if (
    creator.status === "S1_AUCTION_PENDING" ||
    creator.status === "S1_EXECUTION_PENDING" ||
    hasAcceptedBuyout
  ) {
    return MarketCreatorStage.S1_BUYOUT;
  }

  return MarketCreatorStage.S1_DISCOVERY;
};

const mapProofStatus = (proposal: Proposal): CampaignProofStatus => {
  if (proposal.status === ProposalStatus.CANCELLED) return CampaignProofStatus.CANCELLED;
  if (proposal.status === ProposalStatus.VOIDED) return CampaignProofStatus.VOIDED;
  if (
    proposal.track1Claimed &&
    proposal.track2UsdcDeposited === 0n &&
    proposal.track3UsdcDeposited === 0n
  ) {
    return CampaignProofStatus.SETTLED;
  }
  if (proposal.track2SettledAt && proposal.track3SettledAt) return CampaignProofStatus.SETTLED;
  if (proposal.track2SettledAt || proposal.track3SettledAt || proposal.track1Claimed) {
    return CampaignProofStatus.SETTLING;
  }
  if (proposal.contentAnchorPda || proposal.contentAnchorTx) return CampaignProofStatus.ANCHORED;
  if (proposal.status === ProposalStatus.FUNDED) return CampaignProofStatus.FUNDED;
  return CampaignProofStatus.DRAFT;
};

const serializeBigInt = (value: bigint | null | undefined): string | null =>
  value === null || value === undefined ? null : value.toString();

type ProjectedPositionForClaim = {
  internalTokenBalance: bigint;
  earlyCohortBalance?: bigint | null;
};

type ProjectedBuyoutPools = {
  status: BuyoutProjectionStatus;
  claimableS1SupplyRemaining: bigint;
  discoveryPoolRemaining?: bigint | null;
  eligibleHolderCount?: number | null;
  earlyHolderCount?: number | null;
  regularHolderCount?: number | null;
  rewardModelSnapshot?: number | null;
  discoveryRewardCapUsdc?: bigint | null;
  statusThankyouUsdc?: bigint | null;
  earlyClaimableUsdcRemaining: bigint;
  earlyClaimableS1SupplyRemaining: bigint;
  regularClaimableUsdcRemaining: bigint;
  regularClaimableS1SupplyRemaining: bigint;
};

const calculateEstimatedClaimableUsdc = (
  position: ProjectedPositionForClaim,
  buyout: ProjectedBuyoutPools | null | undefined
): bigint | null => {
  if (!buyout || buyout.status !== BuyoutProjectionStatus.GRADUATED) {
    return null;
  }

  try {
    if (position.internalTokenBalance <= 0n) {
      return 0n;
    }

    const poolRemaining =
      buyout.discoveryPoolRemaining && buyout.discoveryPoolRemaining > 0n
        ? buyout.discoveryPoolRemaining
        : 0n;
    const eligibleHolderCount = Math.max(0, buyout.eligibleHolderCount ?? 0);
    if (poolRemaining <= 0n || eligibleHolderCount <= 0) {
      return 0n;
    }

    const rewardCap =
      buyout.discoveryRewardCapUsdc && buyout.discoveryRewardCapUsdc > 0n
        ? buyout.discoveryRewardCapUsdc
        : DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC;
    const statusThankyou =
      buyout.statusThankyouUsdc && buyout.statusThankyouUsdc > 0n
        ? buyout.statusThankyouUsdc
        : DEFAULT_S1_STATUS_THANKYOU_USDC;
    const rewardModel = buyout.rewardModelSnapshot ?? S1_REWARD_MODEL_EARLINESS_TIERED;
    const isEarlyHolder = Boolean(position.earlyCohortBalance && position.earlyCohortBalance > 0n);
    const earlyHolderCount = Math.max(0, buyout.earlyHolderCount ?? 0);
    const regularHolderCount = Math.max(0, buyout.regularHolderCount ?? 0);
    const rewardUnit = (() => {
      if (rewardModel === S1_REWARD_MODEL_STATUS_PRIMARY) {
        return statusThankyou;
      }
      if (rewardModel === S1_REWARD_MODEL_FLAT_EQUAL) {
        return poolRemaining / BigInt(eligibleHolderCount);
      }
      if (rewardModel !== S1_REWARD_MODEL_EARLINESS_TIERED) {
        return 0n;
      }

      const earlyWeight = 2n;
      const regularWeight = 1n;
      const weightedCount =
        BigInt(earlyHolderCount) * earlyWeight + BigInt(regularHolderCount) * regularWeight;
      if (weightedCount <= 0n) {
        return 0n;
      }
      const selectedCount = isEarlyHolder ? earlyHolderCount : regularHolderCount;
      if (selectedCount <= 0) {
        return 0n;
      }

      const claimantWeight = isEarlyHolder ? earlyWeight : regularWeight;
      return (poolRemaining * claimantWeight) / weightedCount;
    })();

    const cappedUnit = rewardUnit > rewardCap ? rewardCap : rewardUnit;
    return cappedUnit > poolRemaining ? poolRemaining : cappedUnit;
  } catch {
    return 0n;
  }
};

const calculateFlatCappedReward = (
  poolRemaining: bigint | null | undefined,
  unsettledCount: number | null | undefined,
  rewardCap: bigint | null | undefined
): { amount: bigint; capped: boolean } => {
  try {
    const pool = poolRemaining && poolRemaining > 0n ? poolRemaining : 0n;
    const count = unsettledCount && unsettledCount > 0 ? unsettledCount : 0;
    const cap = rewardCap && rewardCap > 0n ? rewardCap : DEFAULT_TRACK2_REWARD_CAP_USDC;
    if (pool <= 0n || count <= 0) {
      return { amount: 0n, capped: false };
    }

    const unit = pool / BigInt(count);
    const cappedUnit = unit > cap ? cap : unit;
    const amount = cappedUnit > pool ? pool : cappedUnit;
    return {
      amount,
      capped: unit > cap || cappedUnit > pool,
    };
  } catch {
    return { amount: 0n, capped: false };
  }
};

const updateS2EndorsementEstimatesForProposal = async (
  proposalPda: string,
  fanPoolRemaining: bigint,
  endorserCount: number,
  rewardCapUsdc: bigint,
  event: { signature?: string; observedAt?: Date } = {}
) => {
  const positions = await prisma.s2EndorsementPositionProjection.findMany({
    where: {
      proposalPda,
      claimedStatus: false,
    },
  });
  const unsettledCount = endorserCount > 0 ? endorserCount : positions.length;
  const reward = calculateFlatCappedReward(
    fanPoolRemaining,
    unsettledCount,
    rewardCapUsdc
  );

  await Promise.all(
    positions.map((position) =>
      prisma.s2EndorsementPositionProjection.update({
        where: { positionPda: position.positionPda },
        data: {
          estimatedUsdcReward: reward.amount,
          rewardCapUsdc,
          rewardCapped: reward.capped,
          fanPoolRemaining,
          lastEventSignature: event.signature ?? position.lastEventSignature,
          lastEventAt: event.observedAt ?? position.lastEventAt,
        },
      })
    )
  );
};

type S1GraduatedBuyoutProjectionPatch = {
  creatorWallet: string | null;
  buyoutStatePda: string | null;
  winningSponsorWallet: string | null;
  acceptedOfferPda: string | null;
  acceptedOfferUsdc: bigint | null;
  usdcDeposited: bigint | null;
  creatorPayoutUsdc: bigint | null;
  discoveryPoolUsdc: bigint | null;
  discoveryPoolRemaining: bigint | null;
  eligibleHolderCount: number | null;
  earlyHolderCount: number | null;
  regularHolderCount: number | null;
  rewardModelSnapshot: number | null;
  residualToSnapshot: number | null;
  discoveryRewardCapUsdc: bigint | null;
  statusThankyouUsdc: bigint | null;
  creatorPaid: boolean | null;
  graduatedAt: Date | null;
  claimableUsdcRemaining: bigint | null;
  claimableS1SupplyRemaining: bigint | null;
  earlyClaimableUsdcRemaining: bigint | null;
  earlyClaimableS1SupplyRemaining: bigint | null;
  regularClaimableUsdcRemaining: bigint | null;
  regularClaimableS1SupplyRemaining: bigint | null;
};

const compactNullablePatch = (data: Record<string, unknown>): Record<string, any> =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));

const resolveGraduatedBuyoutProjectionPatch = async (
  creatorProfilePda: string,
  eventData: Record<string, unknown>
): Promise<S1GraduatedBuyoutProjectionPatch> => {
  const existing = await prisma.s1BuyoutProjection.findUnique({
    where: { creatorProfilePda },
  });
  const buyoutStatePda = readString(eventData, "s1BuyoutState") ?? existing?.buyoutStatePda ?? null;
  const eventClaimableUsdcRemaining = readBigInt(eventData, "claimableUsdcRemaining");
  const eventClaimableS1SupplyRemaining = readBigInt(eventData, "claimableS1SupplyRemaining");
  const eventEarlyClaimableUsdcRemaining = readBigInt(eventData, "earlyClaimableUsdcRemaining");
  const eventEarlyClaimableS1SupplyRemaining = readBigInt(
    eventData,
    "earlyClaimableS1SupplyRemaining"
  );
  const eventRegularClaimableUsdcRemaining = readBigInt(eventData, "regularClaimableUsdcRemaining");
  const eventRegularClaimableS1SupplyRemaining = readBigInt(
    eventData,
    "regularClaimableS1SupplyRemaining"
  );
  const eventCreatorPayoutUsdc = readBigIntAlias(eventData, "creatorPayoutUsdc");
  const eventDiscoveryPoolUsdc = readBigIntAlias(eventData, "discoveryPoolUsdc");
  const eventDiscoveryPoolRemaining = readBigIntAlias(eventData, "discoveryPoolRemaining");
  const eventEligibleHolderCount = readIntAlias(eventData, "eligibleHolderCount");
  const eventEarlyHolderCount = readIntAlias(eventData, "earlyHolderCount");
  const eventRegularHolderCount = readIntAlias(eventData, "regularHolderCount");
  const eventRewardModelSnapshot = readIntAlias(eventData, "rewardModelSnapshot", "rewardModel");
  const eventResidualTo = readIntAlias(eventData, "residualTo", "residualToSnapshot");
  const eventGraduatedAt = readBigInt(eventData, "graduatedAt");
  const hasEventPoolSnapshot =
    eventClaimableUsdcRemaining !== null &&
    eventClaimableS1SupplyRemaining !== null &&
    eventEarlyClaimableUsdcRemaining !== null &&
    eventEarlyClaimableS1SupplyRemaining !== null &&
    eventRegularClaimableUsdcRemaining !== null &&
    eventRegularClaimableS1SupplyRemaining !== null;
  const onChain =
    buyoutStatePda && !hasEventPoolSnapshot
      ? await getAnchorService().fetchS1BuyoutStateByPda(new PublicKey(buyoutStatePda)).catch(() => null)
      : null;
  const offerPda = existing?.acceptedOfferPda ?? existing?.latestOfferPda ?? null;
  const fallbackOffer = await prisma.s1BuyoutOfferProjection.findFirst({
    where: {
      creatorProfilePda,
      ...(offerPda ? { buyoutOfferPda: offerPda } : {}),
    },
    orderBy: {
      usdcAmount: "desc",
    },
  });
  const acceptedOfferUsdc =
    existing?.acceptedOfferUsdc ??
    fallbackOffer?.usdcAmount ??
    existing?.latestOfferUsdc ??
    null;

  return {
    creatorWallet: readString(eventData, "creator") ?? existing?.creatorWallet ?? null,
    buyoutStatePda,
    winningSponsorWallet:
      readString(eventData, "winningSponsor") ??
      onChain?.winningSponsor?.toBase58() ??
      existing?.winningSponsorWallet ??
      fallbackOffer?.sponsorWallet ??
      null,
    acceptedOfferPda:
      existing?.acceptedOfferPda ??
      fallbackOffer?.buyoutOfferPda ??
      existing?.latestOfferPda ??
      null,
    acceptedOfferUsdc,
    usdcDeposited:
      onChain?.usdcDeposited ??
      existing?.usdcDeposited ??
      acceptedOfferUsdc ??
      null,
    creatorPayoutUsdc:
      eventCreatorPayoutUsdc ??
      onChain?.creatorPayoutUsdc ??
      existing?.creatorPayoutUsdc ??
      null,
    discoveryPoolUsdc:
      eventDiscoveryPoolUsdc ??
      onChain?.discoveryPoolUsdc ??
      existing?.discoveryPoolUsdc ??
      null,
    discoveryPoolRemaining:
      eventDiscoveryPoolRemaining ??
      onChain?.discoveryPoolRemaining ??
      existing?.discoveryPoolRemaining ??
      eventClaimableUsdcRemaining ??
      null,
    eligibleHolderCount:
      eventEligibleHolderCount ??
      onChain?.eligibleHolderCount ??
      existing?.eligibleHolderCount ??
      null,
    earlyHolderCount:
      eventEarlyHolderCount ??
      onChain?.earlyHolderCount ??
      existing?.earlyHolderCount ??
      null,
    regularHolderCount:
      eventRegularHolderCount ??
      onChain?.regularHolderCount ??
      existing?.regularHolderCount ??
      null,
    rewardModelSnapshot:
      eventRewardModelSnapshot ??
      onChain?.rewardModelSnapshot ??
      existing?.rewardModelSnapshot ??
      S1_REWARD_MODEL_EARLINESS_TIERED,
    residualToSnapshot:
      eventResidualTo ??
      onChain?.residualToSnapshot ??
      existing?.residualToSnapshot ??
      0,
    discoveryRewardCapUsdc:
      onChain?.discoveryRewardCapUsdc ??
      existing?.discoveryRewardCapUsdc ??
      DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
    statusThankyouUsdc:
      onChain?.statusThankyouUsdc ??
      existing?.statusThankyouUsdc ??
      DEFAULT_S1_STATUS_THANKYOU_USDC,
    creatorPaid:
      onChain?.creatorPaid ??
      existing?.creatorPaid ??
      (eventCreatorPayoutUsdc !== null ? true : null),
    graduatedAt:
      unixSecondsToDate(eventGraduatedAt ?? onChain?.graduatedAtUnix ?? null) ??
      existing?.graduatedAt ??
      null,
    claimableUsdcRemaining:
      eventClaimableUsdcRemaining ??
      onChain?.claimableUsdcRemaining ??
      existing?.claimableUsdcRemaining ??
      null,
    claimableS1SupplyRemaining:
      eventClaimableS1SupplyRemaining ??
      onChain?.claimableS1SupplyRemaining ??
      existing?.claimableS1SupplyRemaining ??
      null,
    earlyClaimableUsdcRemaining:
      eventEarlyClaimableUsdcRemaining ??
      onChain?.earlyClaimableUsdcRemaining ??
      existing?.earlyClaimableUsdcRemaining ??
      null,
    earlyClaimableS1SupplyRemaining:
      eventEarlyClaimableS1SupplyRemaining ??
      onChain?.earlyClaimableS1SupplyRemaining ??
      existing?.earlyClaimableS1SupplyRemaining ??
      null,
    regularClaimableUsdcRemaining:
      eventRegularClaimableUsdcRemaining ??
      onChain?.regularClaimableUsdcRemaining ??
      existing?.regularClaimableUsdcRemaining ??
      null,
    regularClaimableS1SupplyRemaining:
      eventRegularClaimableS1SupplyRemaining ??
      onChain?.regularClaimableS1SupplyRemaining ??
      existing?.regularClaimableS1SupplyRemaining ??
      null,
  };
};

export const refreshCreatorMarketProjectionByProfilePda = async (
  creatorProfilePda: string,
  event?: { signature?: string; observedAt?: Date }
) => {
  const anchorService = getAnchorService();
  const creator = await anchorService.fetchCreatorProfileByPda(new PublicKey(creatorProfilePda));
  if (!creator) {
    return null;
  }

  const creatorWallet = creator.authority.toBase58();
  const [projectedPositionHolderCount, activeCampaignCount, latestOffer, buyout, protocolS1Config] = await Promise.all([
    prisma.s1PositionProjection.count({
      where: {
        creatorProfilePda,
        internalTokenBalance: {
          gt: 0,
        },
      },
    }),
    prisma.proposal.count({
      where: {
        creatorWallet,
        status: {
          in: [ProposalStatus.OPEN, ProposalStatus.FUNDED],
        },
      },
    }),
    prisma.s1BuyoutOfferProjection.findFirst({
      where: {
        creatorProfilePda,
      },
      orderBy: {
        usdcAmount: "desc",
      },
    }),
    prisma.s1BuyoutProjection.findUnique({
      where: {
        creatorProfilePda,
      },
    }),
    anchorService.fetchProtocolS1Config(),
  ]);

  const stage = mapCreatorStage(
    creator,
    buyout?.status === BuyoutProjectionStatus.OFFER_ACCEPTED ||
      buyout?.status === BuyoutProjectionStatus.RAGE_QUIT_OPEN
  );
  const currentPriceSpump = calculateBuyCost(creator.s1Supply, 1n, creator.s1RatingBps);
  const supporterPoolSpump = calculateFullCurveValue(creator.s1Supply, creator.s1RatingBps);
  const holderCount = creator.s1EligibleHolderCount;
  const creatorMomentumMetadata = {
    s1RatingBps: creator.s1RatingBps,
    s1EarlyCohortSupply: creator.s1EarlyCohortSupply.toString(),
    s1EligibleHolderCount: creator.s1EligibleHolderCount,
    s1EarlyHolderCount: creator.s1EarlyHolderCount,
    s1RegularHolderCount: creator.s1RegularHolderCount,
    projectedPositionHolderCount,
    holderCountSource: "creator_profile_chain_counter",
    s1GraduationTargetSupply: creator.s1GraduationTargetSupply.toString(),
    pendingS1RatingBps: creator.pendingS1RatingBps,
    pendingS1GraduationTargetSupply: creator.pendingS1GraduationTargetSupply.toString(),
    pendingRatingEffectiveAtUnix: creator.pendingRatingEffectiveAtUnix.toString(),
    pendingRatingReportDigestHex: creator.pendingRatingReportDigestHex,
    lastRatingUpdateAtUnix: creator.lastRatingUpdateAtUnix.toString(),
    lastRatingReportDigestHex: creator.lastRatingReportDigestHex,
    maxS1DailyBuySpump: protocolS1Config.maxS1DailyBuySpump.toString(),
    dailySpumpEmissionMultiplierBps: protocolS1Config.dailySpumpEmissionMultiplierBps,
    newUserEmissionBps: protocolS1Config.newUserEmissionBps,
    s1MinUserXp: protocolS1Config.s1MinUserXp.toString(),
    s1EarlyCohortSupplyThreshold: protocolS1Config.s1EarlyCohortSupplyThreshold.toString(),
    s1EarlyCohortBuyoutCapBps: protocolS1Config.s1EarlyCohortBuyoutCapBps,
    s1RageQuitWindowSeconds: protocolS1Config.s1RageQuitWindowSeconds,
    s1BuyoutCreatorShareBps: protocolS1Config.s1BuyoutCreatorShareBps,
    s1BuyoutRewardModel: protocolS1Config.s1BuyoutRewardModel,
    s1DiscoveryRewardCapUsdc: protocolS1Config.s1DiscoveryRewardCapUsdc?.toString(),
    s1StatusThankyouUsdc: protocolS1Config.s1StatusThankyouUsdc?.toString(),
    s1BuyoutResidualTo: protocolS1Config.s1BuyoutResidualTo,
    s1DiscoveryMinHoldSeconds: protocolS1Config.s1DiscoveryMinHoldSeconds,
    track2RewardCapUsdc: protocolS1Config.track2RewardCapUsdc?.toString(),
    track2ResidualTo: protocolS1Config.track2ResidualTo,
  };

  return prisma.creatorMarketProjection.upsert({
    where: {
      creatorProfilePda,
    },
    update: {
      creatorWallet,
      handle: creator.handle,
      stage,
      level: creator.level,
      s1Supply: creator.s1Supply,
      currentPriceSpump,
      nextPriceSpump: currentPriceSpump,
      supporterPoolSpump,
      holderCount,
      s1EligibleHolderCount: creator.s1EligibleHolderCount,
      s1EarlyHolderCount: creator.s1EarlyHolderCount,
      s1RegularHolderCount: creator.s1RegularHolderCount,
      graduationProgressBps: calculateGraduationProgressBps(
        creator.s1Supply,
        creator.s1GraduationTargetSupply
      ),
      activeCampaignCount,
      latestBuyoutOfferUsdc: latestOffer?.usdcAmount ?? null,
      acceptedBuyoutOfferUsdc: buyout?.acceptedOfferUsdc ?? null,
      buyoutStatePda: buyout?.buyoutStatePda ?? null,
      metadataJson: creatorMomentumMetadata,
      lastEventSignature: event?.signature,
      lastEventAt: event?.observedAt,
    },
    create: {
      creatorWallet,
      creatorProfilePda,
      handle: creator.handle,
      stage,
      level: creator.level,
      s1Supply: creator.s1Supply,
      currentPriceSpump,
      nextPriceSpump: currentPriceSpump,
      supporterPoolSpump,
      holderCount,
      s1EligibleHolderCount: creator.s1EligibleHolderCount,
      s1EarlyHolderCount: creator.s1EarlyHolderCount,
      s1RegularHolderCount: creator.s1RegularHolderCount,
      graduationProgressBps: calculateGraduationProgressBps(
        creator.s1Supply,
        creator.s1GraduationTargetSupply
      ),
      activeCampaignCount,
      latestBuyoutOfferUsdc: latestOffer?.usdcAmount ?? null,
      acceptedBuyoutOfferUsdc: buyout?.acceptedOfferUsdc ?? null,
      buyoutStatePda: buyout?.buyoutStatePda ?? null,
      metadataJson: creatorMomentumMetadata,
      lastEventSignature: event?.signature,
      lastEventAt: event?.observedAt,
    },
  });
};

export const refreshS1PositionProjectionByPda = async (
  positionPda: string,
  event?: { signature?: string; observedAt?: Date }
) => {
  const position = await getAnchorService().fetchS1PositionByPda(new PublicKey(positionPda));
  if (!position) {
    return null;
  }

  const creatorProfilePda = position.creatorProfile.toBase58();
  const creator = await getAnchorService().fetchCreatorProfileByPda(position.creatorProfile);
  const buyout = await prisma.s1BuyoutProjection.findUnique({
    where: {
      creatorProfilePda,
    },
  });
  const estimatedClaimableUsdc = calculateEstimatedClaimableUsdc(
    {
      internalTokenBalance: position.internalTokenBalance,
      earlyCohortBalance: position.earlyCohortBalance,
    },
    buyout
  );

  const projected = await prisma.s1PositionProjection.upsert({
    where: {
      positionPda,
    },
    update: {
      userWallet: position.user.toBase58(),
      creatorWallet: creator?.authority.toBase58() ?? null,
      creatorProfilePda,
      internalTokenBalance: position.internalTokenBalance,
      earlyCohortBalance: position.earlyCohortBalance,
      spumpCostBasis: position.spumpCostBasis,
      estimatedClaimableUsdc,
      lastEventSignature: event?.signature,
      lastEventAt: event?.observedAt,
    },
    create: {
      userWallet: position.user.toBase58(),
      creatorWallet: creator?.authority.toBase58() ?? null,
      creatorProfilePda,
      positionPda,
      internalTokenBalance: position.internalTokenBalance,
      earlyCohortBalance: position.earlyCohortBalance,
      spumpCostBasis: position.spumpCostBasis,
      estimatedClaimableUsdc,
      lastEventSignature: event?.signature,
      lastEventAt: event?.observedAt,
    },
  });

  await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
  return projected;
};

export const refreshAllCreatorMarketProjections = async (
  event?: { signature?: string; observedAt?: Date }
) => {
  const creators = await prisma.creatorMarketProjection.findMany({
    select: {
      creatorProfilePda: true,
    },
  });

  return Promise.all(
    creators.map((creator) =>
      refreshCreatorMarketProjectionByProfilePda(creator.creatorProfilePda, event)
    )
  );
};

const refreshProposalProofStatus = async (proposalPda: string, signature?: string) => {
  const proposal = await prisma.proposal.findUnique({ where: { proposalPda } });
  if (!proposal) return;

  const proofStatus = mapProofStatus(proposal);
  const isSettlingOrSettled =
    proofStatus === CampaignProofStatus.SETTLING || proofStatus === CampaignProofStatus.SETTLED;

  await prisma.proposal.update({
    where: { proposalPda },
    data: {
      proofStatus,
      latestSettlementTxSignature: isSettlingOrSettled
        ? (signature ?? proposal.onChainTxSignature)
        : proposal.latestSettlementTxSignature,
    },
  });
};

export const syncMarketProjectionFromChainInstruction = async (params: ChainProjectionEvent) => {
  const eventData = unwrapEventPayload(params.payload);
  const observedAt = new Date();
  const event = { signature: params.signature, observedAt };

  if (params.instructionName === "anchor_content_hash") {
    const contentAnchorPda = readString(eventData, "contentAnchor") ?? params.entityPda;
    const urlDigestHex = readString(eventData, "urlDigest");
    const contentDigestHex = readString(eventData, "contentDigest");
    if (!contentAnchorPda || (!urlDigestHex && !contentDigestHex)) return;

    const manifestAnchorWhere = {
      OR: [
        ...(urlDigestHex ? [{ internalUrlDigestHex: urlDigestHex }] : []),
        ...(contentDigestHex ? [{ manifestHashHex: contentDigestHex }] : []),
        { currentAnchorPda: contentAnchorPda },
      ],
    };

    await prisma.contentManifest.updateMany({
      where: {
        AND: [
          manifestAnchorWhere,
          {
            status: {
              in: [
                ContentManifestStatus.READY,
                ContentManifestStatus.LOCKED,
                ContentManifestStatus.ANCHORED,
              ],
            },
          },
        ],
      },
      data: {
        status: ContentManifestStatus.ANCHORED,
        currentAnchorPda: contentAnchorPda,
        currentAnchorTx: params.signature,
      },
    });
    await prisma.contentManifest.updateMany({
      where: {
        AND: [manifestAnchorWhere, { status: ContentManifestStatus.PUBLISHED }],
      },
      data: {
        currentAnchorPda: contentAnchorPda,
        currentAnchorTx: params.signature,
      },
    });
    return;
  }

  if (params.instructionName === "init_s1_buyout") {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    if (!creatorProfilePda) return;

    const creator = await getAnchorService().fetchCreatorProfileByPda(new PublicKey(creatorProfilePda));
    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        creatorWallet: creator?.authority.toBase58() ?? readString(eventData, "creator"),
        status: BuyoutProjectionStatus.AUCTION_OPEN,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorWallet: creator?.authority.toBase58() ?? readString(eventData, "creator"),
        creatorProfilePda,
        status: BuyoutProjectionStatus.AUCTION_OPEN,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (params.instructionName === "update_creator_s1_rating") {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    if (creatorProfilePda) {
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
    return;
  }

  if (params.instructionName === "update_protocol_s1_emission") {
    await refreshAllCreatorMarketProjections(event);
    return;
  }

  if (params.instructionName === "submit_buyout_offer") {
    const creatorProfilePda = readString(eventData, "creatorProfile");
    const buyoutOfferPda = readString(eventData, "buyoutOffer");
    const sponsorWallet = readString(eventData, "sponsor");
    const usdcAmount = readBigInt(eventData, "usdcAmount");
    if (!creatorProfilePda || !buyoutOfferPda || !sponsorWallet || usdcAmount === null) return;

    const creator = await getAnchorService().fetchCreatorProfileByPda(new PublicKey(creatorProfilePda));
    await prisma.s1BuyoutOfferProjection.upsert({
      where: { buyoutOfferPda },
      update: {
        creatorWallet: creator?.authority.toBase58() ?? null,
        creatorProfilePda,
        sponsorWallet,
        usdcAmount,
        status: BuyoutOfferProjectionStatus.OPEN,
        createdOnChainAt: unixSecondsToDate(readBigInt(eventData, "createdAt")),
        sponsorCancelAfterAt: unixSecondsToDate(readBigInt(eventData, "sponsorCancelAfter")),
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        buyoutOfferPda,
        creatorWallet: creator?.authority.toBase58() ?? null,
        creatorProfilePda,
        sponsorWallet,
        usdcAmount,
        status: BuyoutOfferProjectionStatus.OPEN,
        createdOnChainAt: unixSecondsToDate(readBigInt(eventData, "createdAt")),
        sponsorCancelAfterAt: unixSecondsToDate(readBigInt(eventData, "sponsorCancelAfter")),
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        creatorWallet: creator?.authority.toBase58() ?? null,
        status: BuyoutProjectionStatus.AUCTION_OPEN,
        latestOfferPda: buyoutOfferPda,
        latestOfferUsdc: usdcAmount,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorWallet: creator?.authority.toBase58() ?? null,
        creatorProfilePda,
        status: BuyoutProjectionStatus.AUCTION_OPEN,
        latestOfferPda: buyoutOfferPda,
        latestOfferUsdc: usdcAmount,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (params.instructionName === "accept_buyout_offer") {
    const creatorProfilePda = readString(eventData, "creatorProfile");
    const buyoutOfferPda = readString(eventData, "buyoutOffer");
    const buyoutStatePda = readString(eventData, "s1BuyoutState");
    const sponsorWallet = readString(eventData, "sponsor");
    const usdcAmount = readBigInt(eventData, "usdcAmount");
    const rewardModelSnapshot =
      readIntAlias(eventData, "rewardModelSnapshot", "rewardModel") ??
      S1_REWARD_MODEL_EARLINESS_TIERED;
    if (!creatorProfilePda || !buyoutOfferPda || !buyoutStatePda || !sponsorWallet) return;

    await prisma.s1BuyoutOfferProjection.updateMany({
      where: { buyoutOfferPda },
      data: {
        status: BuyoutOfferProjectionStatus.ACCEPTED,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });

    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        creatorWallet: readString(eventData, "creator"),
        buyoutStatePda,
        status: BuyoutProjectionStatus.RAGE_QUIT_OPEN,
        winningSponsorWallet: sponsorWallet,
        acceptedOfferPda: buyoutOfferPda,
        acceptedOfferUsdc: usdcAmount,
        usdcDeposited: usdcAmount ?? 0n,
        rewardModelSnapshot,
        rageQuitDeadlineAt: unixSecondsToDate(readBigInt(eventData, "rageQuitDeadline")),
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorWallet: readString(eventData, "creator"),
        creatorProfilePda,
        buyoutStatePda,
        status: BuyoutProjectionStatus.RAGE_QUIT_OPEN,
        winningSponsorWallet: sponsorWallet,
        acceptedOfferPda: buyoutOfferPda,
        acceptedOfferUsdc: usdcAmount,
        usdcDeposited: usdcAmount ?? 0n,
        rewardModelSnapshot,
        rageQuitDeadlineAt: unixSecondsToDate(readBigInt(eventData, "rageQuitDeadline")),
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (
    params.instructionName === "cancel_buyout_offer" ||
    params.instructionName === "reclaim_expired_buyout_offer"
  ) {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    const buyoutOfferPda = readString(eventData, "buyoutOffer");
    if (!buyoutOfferPda) return;

    await prisma.s1BuyoutOfferProjection.updateMany({
      where: { buyoutOfferPda },
      data: {
        status:
          params.instructionName === "cancel_buyout_offer"
            ? BuyoutOfferProjectionStatus.CANCELLED
            : BuyoutOfferProjectionStatus.RECLAIMED,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });

    if (creatorProfilePda) {
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
    return;
  }

  if (params.instructionName === "abort_s1_buyout") {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    const sponsorWallet = readString(eventData, "sponsor");
    if (!creatorProfilePda) return;

    if (sponsorWallet) {
      await prisma.s1BuyoutOfferProjection.updateMany({
        where: {
          creatorProfilePda,
          sponsorWallet,
          status: BuyoutOfferProjectionStatus.ACCEPTED,
        },
        data: {
          status: BuyoutOfferProjectionStatus.ABORTED,
          lastEventSignature: params.signature,
          lastEventAt: observedAt,
        },
      });
    }

    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        buyoutStatePda: null,
        status: BuyoutProjectionStatus.NONE,
        winningSponsorWallet: null,
        acceptedOfferPda: null,
        acceptedOfferUsdc: null,
        usdcDeposited: 0n,
        claimableUsdcRemaining: 0n,
        claimableS1SupplyRemaining: 0n,
        creatorPayoutUsdc: 0n,
        discoveryPoolUsdc: 0n,
        discoveryPoolRemaining: 0n,
        eligibleHolderCount: 0,
        earlyHolderCount: 0,
        regularHolderCount: 0,
        rewardModelSnapshot: S1_REWARD_MODEL_EARLINESS_TIERED,
        residualToSnapshot: 0,
        discoveryRewardCapUsdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
        statusThankyouUsdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
        creatorPaid: false,
        earlyClaimableUsdcRemaining: 0n,
        earlyClaimableS1SupplyRemaining: 0n,
        regularClaimableUsdcRemaining: 0n,
        regularClaimableS1SupplyRemaining: 0n,
        rageQuitDeadlineAt: null,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorProfilePda,
        status: BuyoutProjectionStatus.NONE,
        usdcDeposited: 0n,
        claimableUsdcRemaining: 0n,
        claimableS1SupplyRemaining: 0n,
        creatorPayoutUsdc: 0n,
        discoveryPoolUsdc: 0n,
        discoveryPoolRemaining: 0n,
        eligibleHolderCount: 0,
        earlyHolderCount: 0,
        regularHolderCount: 0,
        rewardModelSnapshot: S1_REWARD_MODEL_EARLINESS_TIERED,
        residualToSnapshot: 0,
        discoveryRewardCapUsdc: DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
        statusThankyouUsdc: DEFAULT_S1_STATUS_THANKYOU_USDC,
        creatorPaid: false,
        earlyClaimableUsdcRemaining: 0n,
        earlyClaimableS1SupplyRemaining: 0n,
        regularClaimableUsdcRemaining: 0n,
        regularClaimableS1SupplyRemaining: 0n,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (
    params.instructionName === "buy_s1_token" ||
    params.instructionName === "sell_s1_token" ||
    params.instructionName === "rage_quit_s1"
  ) {
    const positionPda = readString(eventData, "s1UserPosition") ?? readString(eventData, "position");
    const creatorProfilePda = readString(eventData, "creatorProfile");
    if (positionPda) {
      await refreshS1PositionProjectionByPda(positionPda, event);
      return;
    }
    if (creatorProfilePda) {
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
    return;
  }

  if (params.instructionName === "execute_s1_graduation") {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    if (!creatorProfilePda) return;
    const graduatedPatch = await resolveGraduatedBuyoutProjectionPatch(creatorProfilePda, eventData);

    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        ...compactNullablePatch({
          creatorWallet: graduatedPatch.creatorWallet,
          buyoutStatePda: graduatedPatch.buyoutStatePda,
          winningSponsorWallet: graduatedPatch.winningSponsorWallet,
          acceptedOfferPda: graduatedPatch.acceptedOfferPda,
          acceptedOfferUsdc: graduatedPatch.acceptedOfferUsdc,
          usdcDeposited: graduatedPatch.usdcDeposited,
          creatorPayoutUsdc: graduatedPatch.creatorPayoutUsdc,
          discoveryPoolUsdc: graduatedPatch.discoveryPoolUsdc,
          discoveryPoolRemaining: graduatedPatch.discoveryPoolRemaining,
          eligibleHolderCount: graduatedPatch.eligibleHolderCount,
          earlyHolderCount: graduatedPatch.earlyHolderCount,
          regularHolderCount: graduatedPatch.regularHolderCount,
          rewardModelSnapshot: graduatedPatch.rewardModelSnapshot,
          residualToSnapshot: graduatedPatch.residualToSnapshot,
          discoveryRewardCapUsdc: graduatedPatch.discoveryRewardCapUsdc,
          statusThankyouUsdc: graduatedPatch.statusThankyouUsdc,
          creatorPaid: graduatedPatch.creatorPaid,
          graduatedAt: graduatedPatch.graduatedAt,
          claimableUsdcRemaining: graduatedPatch.claimableUsdcRemaining,
          claimableS1SupplyRemaining: graduatedPatch.claimableS1SupplyRemaining,
          earlyClaimableUsdcRemaining: graduatedPatch.earlyClaimableUsdcRemaining,
          earlyClaimableS1SupplyRemaining: graduatedPatch.earlyClaimableS1SupplyRemaining,
          regularClaimableUsdcRemaining: graduatedPatch.regularClaimableUsdcRemaining,
          regularClaimableS1SupplyRemaining: graduatedPatch.regularClaimableS1SupplyRemaining,
        }),
        status: BuyoutProjectionStatus.GRADUATED,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorWallet: graduatedPatch.creatorWallet,
        creatorProfilePda,
        buyoutStatePda: graduatedPatch.buyoutStatePda,
        status: BuyoutProjectionStatus.GRADUATED,
        winningSponsorWallet: graduatedPatch.winningSponsorWallet,
        acceptedOfferPda: graduatedPatch.acceptedOfferPda,
        acceptedOfferUsdc: graduatedPatch.acceptedOfferUsdc,
        usdcDeposited: graduatedPatch.usdcDeposited ?? 0n,
        creatorPayoutUsdc: graduatedPatch.creatorPayoutUsdc ?? 0n,
        discoveryPoolUsdc: graduatedPatch.discoveryPoolUsdc ?? 0n,
        discoveryPoolRemaining: graduatedPatch.discoveryPoolRemaining ?? 0n,
        eligibleHolderCount: graduatedPatch.eligibleHolderCount ?? 0,
        earlyHolderCount: graduatedPatch.earlyHolderCount ?? 0,
        regularHolderCount: graduatedPatch.regularHolderCount ?? 0,
        rewardModelSnapshot:
          graduatedPatch.rewardModelSnapshot ?? S1_REWARD_MODEL_EARLINESS_TIERED,
        residualToSnapshot: graduatedPatch.residualToSnapshot ?? 0,
        discoveryRewardCapUsdc:
          graduatedPatch.discoveryRewardCapUsdc ?? DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
        statusThankyouUsdc:
          graduatedPatch.statusThankyouUsdc ?? DEFAULT_S1_STATUS_THANKYOU_USDC,
        creatorPaid: graduatedPatch.creatorPaid ?? false,
        graduatedAt: graduatedPatch.graduatedAt,
        claimableUsdcRemaining: graduatedPatch.claimableUsdcRemaining ?? 0n,
        claimableS1SupplyRemaining: graduatedPatch.claimableS1SupplyRemaining ?? 0n,
        earlyClaimableUsdcRemaining: graduatedPatch.earlyClaimableUsdcRemaining ?? 0n,
        earlyClaimableS1SupplyRemaining: graduatedPatch.earlyClaimableS1SupplyRemaining ?? 0n,
        regularClaimableUsdcRemaining: graduatedPatch.regularClaimableUsdcRemaining ?? 0n,
        regularClaimableS1SupplyRemaining: graduatedPatch.regularClaimableS1SupplyRemaining ?? 0n,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (params.instructionName === "claim_s1_buyout_usdc") {
    const positionPda = readString(eventData, "s1UserPosition") ?? readString(eventData, "position");
    const creatorProfilePda = readString(eventData, "creatorProfile");
    if (positionPda) {
      await refreshS1PositionProjectionByPda(positionPda, event);
    }
    if (creatorProfilePda) {
      const buyout = await prisma.s1BuyoutProjection.findUnique({
        where: { creatorProfilePda },
      });
      const buyoutStatePda = readString(eventData, "s1BuyoutState") ?? buyout?.buyoutStatePda ?? null;
      const eventClaimableUsdcRemaining = readBigIntAlias(
        eventData,
        "claimableUsdcRemaining",
        "remainingUsdc"
      );
      const eventClaimableS1SupplyRemaining = readBigIntAlias(
        eventData,
        "claimableS1SupplyRemaining",
        "remainingSupply"
      );
      const eventEarlyClaimableUsdcRemaining = readBigInt(eventData, "earlyClaimableUsdcRemaining");
      const eventEarlyClaimableS1SupplyRemaining = readBigInt(
        eventData,
        "earlyClaimableS1SupplyRemaining"
      );
      const eventRegularClaimableUsdcRemaining = readBigInt(
        eventData,
        "regularClaimableUsdcRemaining"
      );
      const eventRegularClaimableS1SupplyRemaining = readBigInt(
        eventData,
        "regularClaimableS1SupplyRemaining"
      );
      const eventDiscoveryPoolRemaining = readBigIntAlias(
        eventData,
        "discoveryPoolRemaining",
        "poolRemaining"
      );
      const eventEligibleHolderCount = readIntAlias(eventData, "eligibleHolderCount");
      const eventEarlyHolderCount = readIntAlias(eventData, "earlyHolderCount");
      const eventRegularHolderCount = readIntAlias(eventData, "regularHolderCount");
      const eventRewardModel = readIntAlias(eventData, "rewardModel", "rewardModelSnapshot");
      const eventResidualTo = readIntAlias(eventData, "residualTo", "residualToSnapshot");
      const eventVaultClosed = Boolean(eventData.vaultClosed ?? false);
      const usdcAmount = readBigIntAlias(eventData, "usdcAmount", "rewardAmount") ?? 0n;
      const rewardCapped = Boolean(eventData.capped ?? false);
      const rewardEligible = Boolean(eventData.eligible ?? usdcAmount > 0n);
      const hasEventPoolSnapshot =
        eventClaimableUsdcRemaining !== null &&
        eventClaimableS1SupplyRemaining !== null &&
        eventEarlyClaimableUsdcRemaining !== null &&
        eventEarlyClaimableS1SupplyRemaining !== null &&
        eventRegularClaimableUsdcRemaining !== null &&
        eventRegularClaimableS1SupplyRemaining !== null;
      const onChain =
        buyoutStatePda && !hasEventPoolSnapshot
          ? await getAnchorService().fetchS1BuyoutStateByPda(new PublicKey(buyoutStatePda))
          : null;
      const poolPatch = compactNullablePatch({
        buyoutStatePda,
        claimableUsdcRemaining:
          eventClaimableUsdcRemaining ?? onChain?.claimableUsdcRemaining ?? null,
        claimableS1SupplyRemaining:
          eventClaimableS1SupplyRemaining ?? onChain?.claimableS1SupplyRemaining ?? null,
        discoveryPoolRemaining:
          eventDiscoveryPoolRemaining ?? onChain?.discoveryPoolRemaining ?? null,
        eligibleHolderCount:
          eventEligibleHolderCount ?? onChain?.eligibleHolderCount ?? null,
        earlyHolderCount:
          eventEarlyHolderCount ?? onChain?.earlyHolderCount ?? null,
        regularHolderCount:
          eventRegularHolderCount ?? onChain?.regularHolderCount ?? null,
        rewardModelSnapshot:
          eventRewardModel ?? onChain?.rewardModelSnapshot ?? null,
        residualToSnapshot:
          eventResidualTo ?? onChain?.residualToSnapshot ?? null,
        vaultClosed: eventVaultClosed ? true : null,
        earlyClaimableUsdcRemaining:
          eventEarlyClaimableUsdcRemaining ?? onChain?.earlyClaimableUsdcRemaining ?? null,
        earlyClaimableS1SupplyRemaining:
          eventEarlyClaimableS1SupplyRemaining ?? onChain?.earlyClaimableS1SupplyRemaining ?? null,
        regularClaimableUsdcRemaining:
          eventRegularClaimableUsdcRemaining ?? onChain?.regularClaimableUsdcRemaining ?? null,
        regularClaimableS1SupplyRemaining:
          eventRegularClaimableS1SupplyRemaining ??
          onChain?.regularClaimableS1SupplyRemaining ??
          null,
      });
      await prisma.s1BuyoutProjection.upsert({
        where: { creatorProfilePda },
        update: {
          ...poolPatch,
          lastEventSignature: params.signature,
          lastEventAt: observedAt,
        },
        create: {
          creatorProfilePda,
          buyoutStatePda,
          status: BuyoutProjectionStatus.GRADUATED,
          claimableUsdcRemaining:
            eventClaimableUsdcRemaining ?? onChain?.claimableUsdcRemaining ?? 0n,
          claimableS1SupplyRemaining:
            eventClaimableS1SupplyRemaining ?? onChain?.claimableS1SupplyRemaining ?? 0n,
          discoveryPoolRemaining:
            eventDiscoveryPoolRemaining ?? onChain?.discoveryPoolRemaining ?? 0n,
          eligibleHolderCount:
            eventEligibleHolderCount ?? onChain?.eligibleHolderCount ?? 0,
          earlyHolderCount:
            eventEarlyHolderCount ?? onChain?.earlyHolderCount ?? 0,
          regularHolderCount:
            eventRegularHolderCount ?? onChain?.regularHolderCount ?? 0,
          rewardModelSnapshot:
            eventRewardModel ?? onChain?.rewardModelSnapshot ?? S1_REWARD_MODEL_EARLINESS_TIERED,
          residualToSnapshot:
            eventResidualTo ?? onChain?.residualToSnapshot ?? 0,
          vaultClosed: eventVaultClosed,
          discoveryRewardCapUsdc:
            onChain?.discoveryRewardCapUsdc ?? DEFAULT_S1_DISCOVERY_REWARD_CAP_USDC,
          statusThankyouUsdc:
            onChain?.statusThankyouUsdc ?? DEFAULT_S1_STATUS_THANKYOU_USDC,
          earlyClaimableUsdcRemaining:
            eventEarlyClaimableUsdcRemaining ?? onChain?.earlyClaimableUsdcRemaining ?? 0n,
          earlyClaimableS1SupplyRemaining:
            eventEarlyClaimableS1SupplyRemaining ?? onChain?.earlyClaimableS1SupplyRemaining ?? 0n,
          regularClaimableUsdcRemaining:
            eventRegularClaimableUsdcRemaining ?? onChain?.regularClaimableUsdcRemaining ?? 0n,
          regularClaimableS1SupplyRemaining:
            eventRegularClaimableS1SupplyRemaining ??
            onChain?.regularClaimableS1SupplyRemaining ??
            0n,
          lastEventSignature: params.signature,
          lastEventAt: observedAt,
        },
      });
      if (positionPda) {
        await prisma.s1PositionProjection.updateMany({
          where: { positionPda },
          data: {
            discoveryRewardClaimed: true,
            lastDiscoveryRewardUsdc: usdcAmount,
            discoveryRewardCapped: rewardCapped,
            discoveryRewardEligible: rewardEligible,
            estimatedClaimableUsdc: 0n,
            lastEventSignature: params.signature,
            lastEventAt: observedAt,
          },
        });
      }
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
    return;
  }

  if (params.instructionName === "sweep_s1_buyout_residual") {
    const creatorProfilePda = readString(eventData, "creatorProfile") ?? params.entityPda;
    if (!creatorProfilePda) return;
    const buyoutStatePda = readString(eventData, "s1BuyoutState");
    const residualTo = readIntAlias(eventData, "residualTo", "residualToSnapshot");
    const closed = Boolean(eventData.closed ?? true);

    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        ...compactNullablePatch({
          buyoutStatePda,
          residualToSnapshot: residualTo,
        }),
        discoveryPoolRemaining: 0n,
        claimableUsdcRemaining: 0n,
        claimableS1SupplyRemaining: 0n,
        earlyClaimableUsdcRemaining: 0n,
        earlyClaimableS1SupplyRemaining: 0n,
        regularClaimableUsdcRemaining: 0n,
        regularClaimableS1SupplyRemaining: 0n,
        eligibleHolderCount: 0,
        earlyHolderCount: 0,
        regularHolderCount: 0,
        residualSwept: true,
        residualSweptAt: observedAt,
        vaultClosed: closed,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorProfilePda,
        buyoutStatePda,
        status: BuyoutProjectionStatus.GRADUATED,
        discoveryPoolRemaining: 0n,
        claimableUsdcRemaining: 0n,
        claimableS1SupplyRemaining: 0n,
        earlyClaimableUsdcRemaining: 0n,
        earlyClaimableS1SupplyRemaining: 0n,
        regularClaimableUsdcRemaining: 0n,
        regularClaimableS1SupplyRemaining: 0n,
        eligibleHolderCount: 0,
        earlyHolderCount: 0,
        regularHolderCount: 0,
        residualToSnapshot: residualTo ?? 0,
        residualSwept: true,
        residualSweptAt: observedAt,
        vaultClosed: closed,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await prisma.s1PositionProjection.updateMany({
      where: {
        creatorProfilePda,
        discoveryRewardClaimed: false,
      },
      data: {
        estimatedClaimableUsdc: 0n,
        discoveryRewardEligible: false,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });
    await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    return;
  }

  if (params.instructionName === "endorse_proposal") {
    const proposalPda = readString(eventData, "proposal") ?? params.proposalPda;
    const userWallet = readString(eventData, "user");
    const amount = readBigInt(eventData, "amount");
    let positionPda = readString(eventData, "endorsementPosition");
    if (!positionPda && userWallet && proposalPda) {
      positionPda = getAnchorService()
        .deriveEndorsementPositionPda(new PublicKey(userWallet), new PublicKey(proposalPda))
        .toBase58();
    }
    if (!proposalPda || !userWallet || !positionPda || amount === null) return;

    const existing = await prisma.s2EndorsementPositionProjection.findUnique({
      where: { positionPda },
    });
    const nextStakedAmount =
      existing?.lastEventSignature === params.signature
        ? existing.stakedSpumpAmount
        : (existing?.stakedSpumpAmount ?? 0n) + amount;
    const proposal = await prisma.proposal.findUnique({
      where: { proposalPda },
      select: {
        track2InitialFanPool: true,
        track2RewardCapUsdc: true,
        endorserCount: true,
      },
    });
    const estimatedReward = calculateFlatCappedReward(
      proposal?.track2InitialFanPool,
      proposal?.endorserCount,
      proposal?.track2RewardCapUsdc
    );

    await prisma.s2EndorsementPositionProjection.upsert({
      where: { positionPda },
      update: {
        userWallet,
        proposalPda,
        stakedSpumpAmount: nextStakedAmount,
        claimedStatus: false,
        estimatedUsdcReward: estimatedReward.amount,
        rewardCapUsdc:
          proposal?.track2RewardCapUsdc && proposal.track2RewardCapUsdc > 0n
            ? proposal.track2RewardCapUsdc
            : DEFAULT_TRACK2_REWARD_CAP_USDC,
        rewardCapped: estimatedReward.capped,
        fanPoolRemaining: proposal?.track2InitialFanPool ?? 0n,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        positionPda,
        userWallet,
        proposalPda,
        stakedSpumpAmount: amount,
        claimedStatus: false,
        estimatedUsdcReward: estimatedReward.amount,
        rewardCapUsdc:
          proposal?.track2RewardCapUsdc && proposal.track2RewardCapUsdc > 0n
            ? proposal.track2RewardCapUsdc
            : DEFAULT_TRACK2_REWARD_CAP_USDC,
        rewardCapped: estimatedReward.capped,
        fanPoolRemaining: proposal?.track2InitialFanPool ?? 0n,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });

    if (existing?.lastEventSignature !== params.signature) {
      const endorserIncrement = existing ? 0 : 1;
      await prisma.proposal.updateMany({
        where: { proposalPda },
        data: {
          endorserCount: { increment: endorserIncrement },
          totalSpumpStaked: { increment: amount },
        },
      });
    }

    return;
  }

  if (params.instructionName === "settle_track2") {
    const proposalPda = readString(eventData, "proposal") ?? params.proposalPda;
    if (!proposalPda) return;
    const initialFanPool = readBigIntAlias(
      eventData,
      "initialFanPool",
      "track2InitialFanPool",
      "fanPoolRemaining"
    ) ?? 0n;
    const fanPoolRemaining = readBigIntAlias(
      eventData,
      "fanPoolRemaining",
      "track2UsdcDeposited"
    ) ?? initialFanPool;
    const initialSpumpStaked = readBigIntAlias(
      eventData,
      "initialSpumpStaked",
      "track2InitialSpumpStaked"
    ) ?? 0n;
    const rewardCapUsdc =
      readBigIntAlias(eventData, "rewardCapUsdc", "track2RewardCapUsdc") ??
      DEFAULT_TRACK2_REWARD_CAP_USDC;
    const residualTo = readIntAlias(eventData, "residualTo", "track2ResidualTo") ?? 1;
    const rewardModel =
      readIntAlias(eventData, "rewardModel", "track2RewardModelSnapshot") ?? 0;
    const endorserCount = readIntAlias(eventData, "endorserCount", "track2EndorserCount") ?? 0;

    await prisma.proposal.updateMany({
      where: { proposalPda },
      data: {
        track2InitialFanPool: initialFanPool,
        track2InitialSpumpStaked: initialSpumpStaked,
        track2UsdcDeposited: fanPoolRemaining,
        track2RewardCapUsdc: rewardCapUsdc,
        track2ResidualTo: residualTo,
        track2RewardModelSnapshot: rewardModel,
      },
    });
    await updateS2EndorsementEstimatesForProposal(
      proposalPda,
      fanPoolRemaining,
      endorserCount,
      rewardCapUsdc,
      event
    );
    await refreshProposalProofStatus(proposalPda, params.signature);
    return;
  }

  if (params.instructionName === "claim_endorsement") {
    const proposalPda = readString(eventData, "proposal") ?? params.proposalPda;
    const userWallet = readString(eventData, "user");
    const stakedAmount = readBigInt(eventData, "stakedAmount");
    const usdcReward = readBigInt(eventData, "usdcReward") ?? 0n;
    const rewardCapUsdc =
      readBigIntAlias(eventData, "rewardCapUsdc", "track2RewardCapUsdc") ??
      DEFAULT_TRACK2_REWARD_CAP_USDC;
    const rewardCapped = Boolean(eventData.capped ?? false);
    const fanPoolRemaining = readBigIntAlias(eventData, "fanPoolRemaining") ?? 0n;
    const residualTransferred = readBigIntAlias(eventData, "residualTransferred") ?? 0n;
    let positionPda = readString(eventData, "endorsementPosition");
    if (!positionPda && userWallet && proposalPda) {
      positionPda = getAnchorService()
        .deriveEndorsementPositionPda(new PublicKey(userWallet), new PublicKey(proposalPda))
        .toBase58();
    }
    if (!proposalPda || !userWallet || !positionPda) return;

    await prisma.s2EndorsementPositionProjection.upsert({
      where: { positionPda },
      update: {
        userWallet,
        proposalPda,
        ...(stakedAmount === null ? {} : { stakedSpumpAmount: stakedAmount }),
        claimedStatus: true,
        estimatedUsdcReward: usdcReward,
        rewardCapUsdc,
        rewardCapped,
        fanPoolRemaining,
        residualTransferred,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        positionPda,
        userWallet,
        proposalPda,
        stakedSpumpAmount: stakedAmount ?? 0n,
        claimedStatus: true,
        estimatedUsdcReward: usdcReward,
        rewardCapUsdc,
        rewardCapped,
        fanPoolRemaining,
        residualTransferred,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });

    const claimedCount = await prisma.s2EndorsementPositionProjection.count({
      where: { proposalPda, claimedStatus: true },
    });
    await prisma.proposal.updateMany({
      where: { proposalPda },
      data: {
        claimedEndorserCount: claimedCount,
        track2UsdcDeposited: fanPoolRemaining,
      },
    });

    await refreshProposalProofStatus(proposalPda, params.signature);
    return;
  }

  if (params.proposalPda) {
    await refreshProposalProofStatus(params.proposalPda, params.signature);
  }
};

export const serializeCreatorMarketProjection = (
  creator: Prisma.CreatorMarketProjectionGetPayload<{}>
) => ({
  creatorWallet: creator.creatorWallet,
  creatorProfilePda: creator.creatorProfilePda,
  handle: creator.handle,
  displayName: creator.displayName,
  stage: creator.stage,
  level: creator.level,
  s1Supply: creator.s1Supply.toString(),
  currentPriceSpump: creator.currentPriceSpump.toString(),
  nextPriceSpump: creator.nextPriceSpump.toString(),
  supporterPoolSpump: creator.supporterPoolSpump.toString(),
  holderCount: creator.holderCount,
  s1EligibleHolderCount: creator.s1EligibleHolderCount,
  s1EarlyHolderCount: creator.s1EarlyHolderCount,
  s1RegularHolderCount: creator.s1RegularHolderCount,
  graduationProgressBps: creator.graduationProgressBps,
  metadata: creator.metadataJson,
  activeCampaignCount: creator.activeCampaignCount,
  latestBuyoutOfferUsdc: serializeBigInt(creator.latestBuyoutOfferUsdc),
  acceptedBuyoutOfferUsdc: serializeBigInt(creator.acceptedBuyoutOfferUsdc),
  buyoutStatePda: creator.buyoutStatePda,
  updatedAt: creator.updatedAt.toISOString(),
});

export const getMarketOverviewProjection = async () => {
  const [creatorCount, liveBuyouts, activeS2Campaigns, supporterPool, sponsorOffers] =
    await Promise.all([
      prisma.creatorMarketProjection.count(),
      prisma.s1BuyoutProjection.count({
        where: {
          status: {
            in: [BuyoutProjectionStatus.AUCTION_OPEN, BuyoutProjectionStatus.RAGE_QUIT_OPEN],
          },
        },
      }),
      prisma.proposal.count({
        where: {
          status: {
            in: [ProposalStatus.OPEN, ProposalStatus.FUNDED],
          },
        },
      }),
      prisma.creatorMarketProjection.aggregate({
        _sum: {
          supporterPoolSpump: true,
        },
      }),
      prisma.s1BuyoutOfferProjection.aggregate({
        where: {
          status: BuyoutOfferProjectionStatus.OPEN,
        },
        _count: true,
        _sum: {
          usdcAmount: true,
        },
      }),
    ]);

  return {
    creatorCount,
    liveBuyouts,
    activeS2Campaigns,
    supporterPoolSpump: (supporterPool._sum.supporterPoolSpump ?? 0n).toString(),
    openSponsorOffers: sponsorOffers._count,
    openSponsorOfferUsdc: (sponsorOffers._sum.usdcAmount ?? 0n).toString(),
  };
};

export const listTrendingCreatorProjections = async (limit = 24) => {
  const creators = await prisma.creatorMarketProjection.findMany({
    orderBy: [
      { latestBuyoutOfferUsdc: "desc" },
      { activeCampaignCount: "desc" },
      { supporterPoolSpump: "desc" },
      { updatedAt: "desc" },
    ],
    take: Math.min(Math.max(limit, 1), 60),
  });

  return creators.map(serializeCreatorMarketProjection);
};

export const getCreatorMarketProjection = async (creatorWalletOrProfilePda: string) => {
  const creator = await prisma.creatorMarketProjection.findFirst({
    where: {
      OR: [
        { creatorWallet: creatorWalletOrProfilePda },
        { creatorProfilePda: creatorWalletOrProfilePda },
      ],
    },
  });

  if (!creator) {
    return null;
  }

  const [buyout, offers, campaigns] = await Promise.all([
    prisma.s1BuyoutProjection.findUnique({
      where: {
        creatorProfilePda: creator.creatorProfilePda,
      },
    }),
    prisma.s1BuyoutOfferProjection.findMany({
      where: {
        creatorProfilePda: creator.creatorProfilePda,
      },
      orderBy: {
        usdcAmount: "desc",
      },
      take: 5,
    }),
    prisma.proposal.findMany({
      where: {
        creatorWallet: creator.creatorWallet,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    }),
  ]);

  return {
    creator: serializeCreatorMarketProjection(creator),
    buyout: buyout
      ? {
          status: buyout.status,
          buyoutStatePda: buyout.buyoutStatePda,
          winningSponsorWallet: buyout.winningSponsorWallet,
          acceptedOfferPda: buyout.acceptedOfferPda,
          acceptedOfferUsdc: serializeBigInt(buyout.acceptedOfferUsdc),
          latestOfferPda: buyout.latestOfferPda,
          latestOfferUsdc: serializeBigInt(buyout.latestOfferUsdc),
          usdcDeposited: buyout.usdcDeposited.toString(),
          creatorPayoutUsdc: buyout.creatorPayoutUsdc.toString(),
          discoveryPoolUsdc: buyout.discoveryPoolUsdc.toString(),
          discoveryPoolRemaining: buyout.discoveryPoolRemaining.toString(),
          eligibleHolderCount: buyout.eligibleHolderCount,
          earlyHolderCount: buyout.earlyHolderCount,
          regularHolderCount: buyout.regularHolderCount,
          rewardModelSnapshot: buyout.rewardModelSnapshot,
          residualToSnapshot: buyout.residualToSnapshot,
          discoveryRewardCapUsdc: buyout.discoveryRewardCapUsdc.toString(),
          statusThankyouUsdc: buyout.statusThankyouUsdc.toString(),
          creatorPaid: buyout.creatorPaid,
          graduatedAt: buyout.graduatedAt?.toISOString() ?? null,
          residualSweptAt: buyout.residualSweptAt?.toISOString() ?? null,
          residualSwept: buyout.residualSwept,
          vaultClosed: buyout.vaultClosed,
          claimableUsdcRemaining: buyout.claimableUsdcRemaining.toString(),
          claimableS1SupplyRemaining: buyout.claimableS1SupplyRemaining.toString(),
          earlyClaimableUsdcRemaining: buyout.earlyClaimableUsdcRemaining.toString(),
          earlyClaimableS1SupplyRemaining: buyout.earlyClaimableS1SupplyRemaining.toString(),
          regularClaimableUsdcRemaining: buyout.regularClaimableUsdcRemaining.toString(),
          regularClaimableS1SupplyRemaining: buyout.regularClaimableS1SupplyRemaining.toString(),
          rageQuitDeadlineAt: buyout.rageQuitDeadlineAt?.toISOString() ?? null,
        }
      : null,
    offers: offers.map((offer) => ({
      buyoutOfferPda: offer.buyoutOfferPda,
      sponsorWallet: offer.sponsorWallet,
      usdcAmount: offer.usdcAmount.toString(),
      status: offer.status,
      sponsorCancelAfterAt: offer.sponsorCancelAfterAt?.toISOString() ?? null,
    })),
    campaigns: campaigns.map((campaign) => ({
      proposalId: campaign.id,
      proposalPda: campaign.proposalPda,
      status: campaign.status,
      proofStatus: campaign.proofStatus,
      track1BaseUsdc: campaign.track1BaseUsdc.toString(),
      track2UsdcDeposited: campaign.track2UsdcDeposited.toString(),
      track3UsdcDeposited: campaign.track3UsdcDeposited.toString(),
      updatedAt: campaign.updatedAt.toISOString(),
    })),
  };
};

export const reconcileGraduatedS1BuyoutProjection = async (
  creatorWalletOrProfilePda: string,
  event: { signature?: string; observedAt?: Date } = {}
) => {
  const creator = await prisma.creatorMarketProjection.findFirst({
    where: {
      OR: [
        { creatorWallet: creatorWalletOrProfilePda },
        { creatorProfilePda: creatorWalletOrProfilePda },
      ],
    },
  });
  const creatorProfilePda = creator?.creatorProfilePda ?? creatorWalletOrProfilePda;
  const existing = await prisma.s1BuyoutProjection.findUnique({
    where: { creatorProfilePda },
  });
  if (!existing || existing.status !== BuyoutProjectionStatus.GRADUATED) {
    return null;
  }

  const patch = await resolveGraduatedBuyoutProjectionPatch(creatorProfilePda, {
    creatorProfile: creatorProfilePda,
    creator: creator?.creatorWallet ?? existing.creatorWallet ?? undefined,
    s1BuyoutState: existing.buyoutStatePda ?? undefined,
  });
  const updated = await prisma.s1BuyoutProjection.update({
    where: { creatorProfilePda },
    data: {
      ...compactNullablePatch({
        creatorWallet: patch.creatorWallet,
        buyoutStatePda: patch.buyoutStatePda,
        winningSponsorWallet: patch.winningSponsorWallet,
        acceptedOfferPda: patch.acceptedOfferPda,
        acceptedOfferUsdc: patch.acceptedOfferUsdc,
        usdcDeposited: patch.usdcDeposited,
        creatorPayoutUsdc: patch.creatorPayoutUsdc,
        discoveryPoolUsdc: patch.discoveryPoolUsdc,
        discoveryPoolRemaining: patch.discoveryPoolRemaining,
        eligibleHolderCount: patch.eligibleHolderCount,
        earlyHolderCount: patch.earlyHolderCount,
        regularHolderCount: patch.regularHolderCount,
        rewardModelSnapshot: patch.rewardModelSnapshot,
        residualToSnapshot: patch.residualToSnapshot,
        discoveryRewardCapUsdc: patch.discoveryRewardCapUsdc,
        statusThankyouUsdc: patch.statusThankyouUsdc,
        creatorPaid: patch.creatorPaid,
        graduatedAt: patch.graduatedAt,
        claimableUsdcRemaining: patch.claimableUsdcRemaining,
        claimableS1SupplyRemaining: patch.claimableS1SupplyRemaining,
        earlyClaimableUsdcRemaining: patch.earlyClaimableUsdcRemaining,
        earlyClaimableS1SupplyRemaining: patch.earlyClaimableS1SupplyRemaining,
        regularClaimableUsdcRemaining: patch.regularClaimableUsdcRemaining,
        regularClaimableS1SupplyRemaining: patch.regularClaimableS1SupplyRemaining,
      }),
      lastEventSignature: event.signature ?? existing.lastEventSignature,
      lastEventAt: event.observedAt ?? existing.lastEventAt,
    },
  });
  await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
  return updated;
};

export const getPortfolioProjection = async (userWallet: string) => {
  const [positions, s2Endorsements] = await Promise.all([
    prisma.s1PositionProjection.findMany({
      where: {
        userWallet,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.s2EndorsementPositionProjection.findMany({
      where: {
        userWallet,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);
  const creatorProfiles = await prisma.creatorMarketProjection.findMany({
    where: {
      creatorProfilePda: {
        in: positions.map((position) => position.creatorProfilePda),
      },
    },
  });
  const buyouts = await prisma.s1BuyoutProjection.findMany({
    where: {
      creatorProfilePda: {
        in: positions.map((position) => position.creatorProfilePda),
      },
    },
  });
  const s2Proposals = await prisma.proposal.findMany({
    where: {
      proposalPda: {
        in: s2Endorsements.map((position) => position.proposalPda),
      },
    },
  });
  const creatorMap = new Map(creatorProfiles.map((creator) => [creator.creatorProfilePda, creator]));
  const buyoutMap = new Map(buyouts.map((buyout) => [buyout.creatorProfilePda, buyout]));
  const proposalMap = new Map(s2Proposals.map((proposal) => [proposal.proposalPda, proposal]));

  return {
    userWallet,
    positions: positions.map((position) => {
      const creator = creatorMap.get(position.creatorProfilePda);
      const estimatedClaimableUsdc = calculateEstimatedClaimableUsdc(
        {
          internalTokenBalance: position.internalTokenBalance,
          earlyCohortBalance: position.earlyCohortBalance,
        },
        buyoutMap.get(position.creatorProfilePda)
      );
      return {
        positionPda: position.positionPda,
        creatorWallet: position.creatorWallet,
        creatorProfilePda: position.creatorProfilePda,
        creator: creator ? serializeCreatorMarketProjection(creator) : null,
        internalTokenBalance: position.internalTokenBalance.toString(),
        earlyCohortBalance: position.earlyCohortBalance.toString(),
        spumpCostBasis: position.spumpCostBasis.toString(),
        estimatedClaimableUsdc: serializeBigInt(estimatedClaimableUsdc),
        discoveryRewardClaimed: position.discoveryRewardClaimed,
        lastDiscoveryRewardUsdc: position.lastDiscoveryRewardUsdc.toString(),
        discoveryRewardCapped: position.discoveryRewardCapped,
        discoveryRewardEligible: position.discoveryRewardEligible,
        updatedAt: position.updatedAt.toISOString(),
      };
    }),
    s2Endorsements: s2Endorsements.map((position) => {
      const proposal = proposalMap.get(position.proposalPda);
      return {
        positionPda: position.positionPda,
        proposalPda: position.proposalPda,
        proposalId: proposal?.id ?? null,
        creatorWallet: proposal?.creatorWallet ?? null,
        sponsorWallet: proposal?.sponsorWallet ?? null,
        status: proposal?.status ?? null,
        stakedSpumpAmount: position.stakedSpumpAmount.toString(),
        claimedStatus: position.claimedStatus,
        estimatedUsdcReward: position.estimatedUsdcReward.toString(),
        rewardCapUsdc: position.rewardCapUsdc.toString(),
        rewardCapped: position.rewardCapped,
        fanPoolRemaining: position.fanPoolRemaining.toString(),
        residualTransferred: position.residualTransferred.toString(),
        updatedAt: position.updatedAt.toISOString(),
      };
    }),
  };
};

const serializeManifestProof = (manifest: MarketProofManifest | null) => {
  if (!manifest) {
    return null;
  }

  return {
    manifestId: manifest.id,
    title: manifest.title,
    contentType: manifest.contentType,
    status: manifest.status,
    version: manifest.version,
    manifestHashHex: manifest.manifestHashHex,
    internalUrlDigestHex: manifest.internalUrlDigestHex,
    currentAnchorPda: manifest.currentAnchorPda,
    currentAnchorTx: manifest.currentAnchorTx,
    publishedAt: manifest.publishedAt?.toISOString() ?? null,
    publicSlug: manifest.publicSlug,
    assets: manifest.assets.map((asset) => ({
      assetId: asset.id,
      assetType: asset.assetType,
      orderIndex: asset.orderIndex,
      sha256Hex: asset.sha256Hex,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes.toString(),
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
      cdnUrl: asset.cdnUrl,
      muxPlaybackId: asset.muxPlaybackId,
      uploadStatus: asset.uploadStatus,
      processingStatus: asset.processingStatus,
      verifiedSha256Hex: asset.verifiedSha256Hex,
      verifiedSizeBytes: asset.verifiedSizeBytes?.toString() ?? null,
      storageVerifiedAt: asset.storageVerifiedAt?.toISOString() ?? null,
      updatedAt: asset.updatedAt.toISOString(),
    })),
    publications: manifest.publications.map((publication) => ({
      publicationId: publication.id,
      platform: publication.platform,
      externalUrl: publication.externalUrl,
      externalUrlDigestHex: publication.externalUrlDigestHex,
      verificationStatus: publication.verificationStatus,
      verificationSource: publication.verificationSource,
      verificationReviewer: publication.verificationReviewer,
      verificationEvidenceDigestHex: publication.verificationEvidenceDigestHex,
      verifiedAt: publication.verifiedAt?.toISOString() ?? null,
      rejectedAt: publication.rejectedAt?.toISOString() ?? null,
    })),
  };
};

export const serializePublicCampaignProof = (
  proposal: PublicCampaignProposal,
) => {
  const integrity = buildCampaignIntegrity({
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    contentAnchorTx: proposal.contentAnchorTx,
    track1Claimed: proposal.track1Claimed,
    track2UsdcDeposited: proposal.track2UsdcDeposited,
    track3UsdcDeposited: proposal.track3UsdcDeposited,
    latestSettlementTxSignature: proposal.latestSettlementTxSignature,
    manifest: proposal.manifest,
  });

  return {
    proposalId: proposal.id,
    proposalPda: proposal.proposalPda,
    viewerRole: "PUBLIC",
    status: proposal.status,
    proofStatus: proposal.proofStatus ?? mapProofStatus(proposal),
    creatorWallet: proposal.creatorWallet,
    sponsorWallet: proposal.sponsorWallet,
    manifestId: proposal.manifestId,
    intentId: proposal.intentId,
    deadlineAt: proposal.deadlineAt.toISOString(),
    budgetTracks: {
      track1BaseUsdc: proposal.track1BaseUsdc.toString(),
      track1Claimed: proposal.track1Claimed,
      track2MetricType: proposal.track2MetricType,
      track2TargetValue: proposal.track2TargetValue.toString(),
      track2MinAchievementBps: proposal.track2MinAchievementBps,
      track2UsdcDeposited: proposal.track2UsdcDeposited.toString(),
      track2ActualValue: serializeBigInt(proposal.track2ActualValue),
      track2SettledAt: proposal.track2SettledAt?.toISOString() ?? null,
      track2InitialFanPool: (proposal.track2InitialFanPool ?? 0n).toString(),
      track2InitialSpumpStaked: (proposal.track2InitialSpumpStaked ?? 0n).toString(),
      track2RewardCapUsdc: (proposal.track2RewardCapUsdc ?? 0n).toString(),
      track2ResidualTo: proposal.track2ResidualTo ?? 1,
      track2RewardModelSnapshot: proposal.track2RewardModelSnapshot ?? 0,
      track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
      track3CpsPayout: serializeBigInt(proposal.track3CpsPayout),
      track3DelayDays: proposal.track3DelayDays,
      track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
    },
    proof: {
      contentHashHex: proposal.contentHashHex,
      contentAnchorPda: proposal.contentAnchorPda,
      contentAnchorTx: proposal.contentAnchorTx,
      fundingTxSignature: proposal.fundingTxSignature,
      latestSettlementTxSignature: proposal.latestSettlementTxSignature,
      latestChainTxSignature: proposal.onChainTxSignature,
      oracleSyncStatus: proposal.oracleSyncStatus,
      contentPublishedVerifiedAt: proposal.contentPublishedVerifiedAt?.toISOString() ?? null,
    },
    integrity,
    manifest: serializeManifestProof(proposal.manifest),
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  };
};

export const getPublicCampaignProof = async (id: string) => {
  const proposal = await prisma.proposal.findFirst({
    where: {
      OR: [{ id }, { proposalPda: id }],
    },
    include: {
      manifest: {
        include: {
          assets: {
            orderBy: {
              orderIndex: "asc",
            },
            select: {
              id: true,
              assetType: true,
              orderIndex: true,
              sha256Hex: true,
              mimeType: true,
              fileSizeBytes: true,
              width: true,
              height: true,
              durationMs: true,
              cdnUrl: true,
              muxPlaybackId: true,
              uploadStatus: true,
              processingStatus: true,
              verifiedSha256Hex: true,
              verifiedSizeBytes: true,
              storageVerifiedAt: true,
              updatedAt: true,
            },
          },
          publications: true,
        },
      },
    },
  });

  if (!proposal) {
    return null;
  }

  return {
    ...serializePublicCampaignProof(proposal),
    endorsementSummary: {
      endorserCount: proposal.endorserCount,
      totalStakedSpump: proposal.totalSpumpStaked.toString(),
      claimedEndorserCount: proposal.claimedEndorserCount,
    },
  };
};

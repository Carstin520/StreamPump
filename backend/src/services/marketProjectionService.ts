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

const S1_BONDING_CURVE_K = 1_000n;
const DEFAULT_S1_RATING_BPS = 10_000n;
const DEFAULT_GRADUATION_SUPPLY_TARGET = 2_500n;

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
    if (buyout.claimableS1SupplyRemaining <= 0n || position.internalTokenBalance <= 0n) {
      return 0n;
    }

    const safeShare = (balance: bigint, usdcRemaining: bigint, supplyRemaining: bigint) => {
      if (balance <= 0n || usdcRemaining <= 0n || supplyRemaining <= 0n) {
        return 0n;
      }
      return (balance * usdcRemaining) / supplyRemaining;
    };
    const earlyBalance =
      position.earlyCohortBalance && position.earlyCohortBalance > 0n
        ? position.earlyCohortBalance
        : 0n;
    const normalizedEarlyBalance =
      earlyBalance > position.internalTokenBalance ? position.internalTokenBalance : earlyBalance;
    const regularBalance = position.internalTokenBalance - normalizedEarlyBalance;
    const earlyShare = safeShare(
      normalizedEarlyBalance,
      buyout.earlyClaimableUsdcRemaining,
      buyout.earlyClaimableS1SupplyRemaining
    );
    const regularShare = safeShare(
      regularBalance,
      buyout.regularClaimableUsdcRemaining,
      buyout.regularClaimableS1SupplyRemaining
    );

    return earlyShare + regularShare;
  } catch {
    return 0n;
  }
};

const calculateEstimatedS2Reward = (
  stakedSpumpAmount: bigint,
  initialFanPool: bigint | null | undefined,
  initialSpumpStaked: bigint | null | undefined
): bigint => {
  try {
    const fanPool = initialFanPool && initialFanPool > 0n ? initialFanPool : 0n;
    const spumpStaked = initialSpumpStaked && initialSpumpStaked > 0n ? initialSpumpStaked : 0n;
    if (stakedSpumpAmount <= 0n || fanPool <= 0n || spumpStaked <= 0n) {
      return 0n;
    }

    return (stakedSpumpAmount * fanPool) / spumpStaked;
  } catch {
    return 0n;
  }
};

const updateS2EndorsementEstimatesForProposal = async (
  proposalPda: string,
  initialFanPool: bigint,
  initialSpumpStaked: bigint,
  event: { signature?: string; observedAt?: Date } = {}
) => {
  const positions = await prisma.s2EndorsementPositionProjection.findMany({
    where: {
      proposalPda,
      claimedStatus: false,
    },
  });

  await Promise.all(
    positions.map((position) =>
      prisma.s2EndorsementPositionProjection.update({
        where: { positionPda: position.positionPda },
        data: {
          estimatedUsdcReward: calculateEstimatedS2Reward(
            position.stakedSpumpAmount,
            initialFanPool,
            initialSpumpStaked
          ),
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
  const [holderCount, activeCampaignCount, latestOffer, buyout, protocolS1Config] = await Promise.all([
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
  const creatorMomentumMetadata = {
    s1RatingBps: creator.s1RatingBps,
    s1EarlyCohortSupply: creator.s1EarlyCohortSupply.toString(),
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
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
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
        track2InitialSpumpStaked: true,
      },
    });

    await prisma.s2EndorsementPositionProjection.upsert({
      where: { positionPda },
      update: {
        userWallet,
        proposalPda,
        stakedSpumpAmount: nextStakedAmount,
        claimedStatus: false,
        estimatedUsdcReward: calculateEstimatedS2Reward(
          nextStakedAmount,
          proposal?.track2InitialFanPool,
          proposal?.track2InitialSpumpStaked
        ),
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        positionPda,
        userWallet,
        proposalPda,
        stakedSpumpAmount: amount,
        claimedStatus: false,
        estimatedUsdcReward: calculateEstimatedS2Reward(
          amount,
          proposal?.track2InitialFanPool,
          proposal?.track2InitialSpumpStaked
        ),
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
    const initialSpumpStaked = readBigIntAlias(
      eventData,
      "initialSpumpStaked",
      "track2InitialSpumpStaked"
    ) ?? 0n;

    await prisma.proposal.updateMany({
      where: { proposalPda },
      data: {
        track2InitialFanPool: initialFanPool,
        track2InitialSpumpStaked: initialSpumpStaked,
      },
    });
    await updateS2EndorsementEstimatesForProposal(proposalPda, initialFanPool, initialSpumpStaked, event);
    await refreshProposalProofStatus(proposalPda, params.signature);
    return;
  }

  if (params.instructionName === "claim_endorsement") {
    const proposalPda = readString(eventData, "proposal") ?? params.proposalPda;
    const userWallet = readString(eventData, "user");
    const stakedAmount = readBigInt(eventData, "stakedAmount");
    const usdcReward = readBigInt(eventData, "usdcReward") ?? 0n;
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
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
    });

    const claimedCount = await prisma.s2EndorsementPositionProjection.count({
      where: { proposalPda, claimedStatus: true },
    });
    await prisma.proposal.updateMany({
      where: { proposalPda },
      data: { claimedEndorserCount: claimedCount },
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
      updatedAt: asset.updatedAt.toISOString(),
    })),
    publications: manifest.publications.map((publication) => ({
      publicationId: publication.id,
      platform: publication.platform,
      externalUrl: publication.externalUrl,
      externalUrlDigestHex: publication.externalUrlDigestHex,
      verificationStatus: publication.verificationStatus,
      verificationSource: publication.verificationSource,
      verifiedAt: publication.verifiedAt?.toISOString() ?? null,
    })),
  };
};

export const serializePublicCampaignProof = (
  proposal: PublicCampaignProposal,
) => ({
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
    track3UsdcDeposited: proposal.track3UsdcDeposited.toString(),
    track3CpsPayout: serializeBigInt(proposal.track3CpsPayout),
    track3DelayDays: proposal.track3DelayDays,
    track3SettledAt: proposal.track3SettledAt?.toISOString() ?? null,
  },
  proof: {
    contentHashHex: proposal.contentHashHex,
    contentAnchorPda: proposal.contentAnchorPda,
    contentAnchorTx: proposal.contentAnchorTx,
    latestChainTxSignature: proposal.onChainTxSignature,
    oracleSyncStatus: proposal.oracleSyncStatus,
    contentPublishedVerifiedAt: proposal.contentPublishedVerifiedAt?.toISOString() ?? null,
  },
  manifest: serializeManifestProof(proposal.manifest),
  createdAt: proposal.createdAt.toISOString(),
  updatedAt: proposal.updatedAt.toISOString(),
});

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

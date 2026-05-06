import {
  BuyoutOfferProjectionStatus,
  BuyoutProjectionStatus,
  CampaignProofStatus,
  ContentManifest,
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
    return payload.eventData;
  }

  if (isRecord(payload.args)) {
    return payload.args;
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
  const estimatedClaimableUsdc =
    buyout && buyout.claimableS1SupplyRemaining > 0n
      ? (position.internalTokenBalance * buyout.claimableUsdcRemaining) /
        buyout.claimableS1SupplyRemaining
      : null;

  const projected = await prisma.s1PositionProjection.upsert({
    where: {
      positionPda,
    },
    update: {
      userWallet: position.user.toBase58(),
      creatorWallet: creator?.authority.toBase58() ?? null,
      creatorProfilePda,
      internalTokenBalance: position.internalTokenBalance,
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
      spumpCostBasis: position.spumpCostBasis,
      estimatedClaimableUsdc,
      lastEventSignature: event?.signature,
      lastEventAt: event?.observedAt,
    },
  });

  await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
  return projected;
};

export const syncCampaignProofProjectionFromProposal = async (proposal: Proposal) => {
  const proofStatus = mapProofStatus(proposal);
  const settledAt =
    proposal.track3SettledAt ?? proposal.track2SettledAt ?? (proposal.track1Claimed ? proposal.updatedAt : null);
  const latestSettlementTxSignature =
    proofStatus === CampaignProofStatus.SETTLING || proofStatus === CampaignProofStatus.SETTLED
      ? proposal.onChainTxSignature
      : null;

  return prisma.campaignProofProjection.upsert({
    where: {
      proposalPda: proposal.proposalPda,
    },
    update: {
      proposalId: proposal.id,
      creatorWallet: proposal.creatorWallet,
      sponsorWallet: proposal.sponsorWallet,
      manifestId: proposal.manifestId,
      intentId: proposal.intentId,
      status: proposal.status,
      proofStatus,
      contentHashHex: proposal.contentHashHex,
      contentAnchorPda: proposal.contentAnchorPda,
      contentAnchorTx: proposal.contentAnchorTx,
      fundingTxSignature:
        proposal.status === ProposalStatus.FUNDED ? proposal.onChainTxSignature : undefined,
      latestSettlementTxSignature,
      track1BaseUsdc: proposal.track1BaseUsdc,
      track2UsdcDeposited: proposal.track2UsdcDeposited,
      track3UsdcDeposited: proposal.track3UsdcDeposited,
      track2MetricType: proposal.track2MetricType,
      track2TargetValue: proposal.track2TargetValue,
      track2ActualValue: proposal.track2ActualValue,
      deadlineAt: proposal.deadlineAt,
      settledAt,
    },
    create: {
      proposalId: proposal.id,
      proposalPda: proposal.proposalPda,
      creatorWallet: proposal.creatorWallet,
      sponsorWallet: proposal.sponsorWallet,
      manifestId: proposal.manifestId,
      intentId: proposal.intentId,
      status: proposal.status,
      proofStatus,
      contentHashHex: proposal.contentHashHex,
      contentAnchorPda: proposal.contentAnchorPda,
      contentAnchorTx: proposal.contentAnchorTx,
      fundingTxSignature:
        proposal.status === ProposalStatus.FUNDED ? proposal.onChainTxSignature : null,
      latestSettlementTxSignature,
      track1BaseUsdc: proposal.track1BaseUsdc,
      track2UsdcDeposited: proposal.track2UsdcDeposited,
      track3UsdcDeposited: proposal.track3UsdcDeposited,
      track2MetricType: proposal.track2MetricType,
      track2TargetValue: proposal.track2TargetValue,
      track2ActualValue: proposal.track2ActualValue,
      deadlineAt: proposal.deadlineAt,
      settledAt,
    },
  });
};

export const syncCampaignProofProjectionFromProposalPda = async (proposalPda: string) => {
  const proposal = await prisma.proposal.findUnique({
    where: {
      proposalPda,
    },
  });

  return proposal ? syncCampaignProofProjectionFromProposal(proposal) : null;
};

export const syncMarketProjectionFromChainInstruction = async (params: ChainProjectionEvent) => {
  const eventData = unwrapEventPayload(params.payload);
  const observedAt = new Date();
  const event = { signature: params.signature, observedAt };

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

  if (params.instructionName === "buy_s1_token" || params.instructionName === "sell_s1_token") {
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
    const buyoutStatePda = readString(eventData, "s1BuyoutState");
    const creatorWallet = readString(eventData, "creator");
    const winningSponsorWallet = readString(eventData, "winningSponsor");

    await prisma.s1BuyoutProjection.upsert({
      where: { creatorProfilePda },
      update: {
        creatorWallet,
        buyoutStatePda,
        status: BuyoutProjectionStatus.GRADUATED,
        winningSponsorWallet,
        claimableUsdcRemaining: readBigInt(eventData, "claimableUsdcRemaining") ?? undefined,
        claimableS1SupplyRemaining:
          readBigInt(eventData, "claimableS1SupplyRemaining") ?? undefined,
        lastEventSignature: params.signature,
        lastEventAt: observedAt,
      },
      create: {
        creatorWallet,
        creatorProfilePda,
        buyoutStatePda,
        status: BuyoutProjectionStatus.GRADUATED,
        winningSponsorWallet,
        claimableUsdcRemaining: readBigInt(eventData, "claimableUsdcRemaining") ?? 0n,
        claimableS1SupplyRemaining:
          readBigInt(eventData, "claimableS1SupplyRemaining") ?? 0n,
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
      if (buyout?.buyoutStatePda) {
        const onChain = await getAnchorService().fetchS1BuyoutStateByPda(
          new PublicKey(buyout.buyoutStatePda)
        );
        if (onChain) {
          await prisma.s1BuyoutProjection.update({
            where: { creatorProfilePda },
            data: {
              claimableUsdcRemaining: onChain.claimableUsdcRemaining,
              claimableS1SupplyRemaining: onChain.claimableS1SupplyRemaining,
              lastEventSignature: params.signature,
              lastEventAt: observedAt,
            },
          });
        }
      } else {
        const buyoutStatePda = readString(eventData, "s1BuyoutState");
        await prisma.s1BuyoutProjection.upsert({
          where: { creatorProfilePda },
          update: {
            buyoutStatePda,
            claimableUsdcRemaining: readBigInt(eventData, "remainingUsdc") ?? undefined,
            claimableS1SupplyRemaining: readBigInt(eventData, "remainingSupply") ?? undefined,
            lastEventSignature: params.signature,
            lastEventAt: observedAt,
          },
          create: {
            creatorProfilePda,
            buyoutStatePda,
            status: BuyoutProjectionStatus.GRADUATED,
            claimableUsdcRemaining: readBigInt(eventData, "remainingUsdc") ?? 0n,
            claimableS1SupplyRemaining: readBigInt(eventData, "remainingSupply") ?? 0n,
            lastEventSignature: params.signature,
            lastEventAt: observedAt,
          },
        });
      }
      await refreshCreatorMarketProjectionByProfilePda(creatorProfilePda, event);
    }
    return;
  }

  if (params.proposalPda) {
    await syncCampaignProofProjectionFromProposalPda(params.proposalPda);
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
    prisma.campaignProofProjection.findMany({
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
      proposalId: campaign.proposalId,
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

export const getPortfolioProjection = async (userWallet: string) => {
  const positions = await prisma.s1PositionProjection.findMany({
    where: {
      userWallet,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const creatorProfiles = await prisma.creatorMarketProjection.findMany({
    where: {
      creatorProfilePda: {
        in: positions.map((position) => position.creatorProfilePda),
      },
    },
  });
  const creatorMap = new Map(creatorProfiles.map((creator) => [creator.creatorProfilePda, creator]));

  return {
    userWallet,
    positions: positions.map((position) => {
      const creator = creatorMap.get(position.creatorProfilePda);
      return {
        positionPda: position.positionPda,
        creatorWallet: position.creatorWallet,
        creatorProfilePda: position.creatorProfilePda,
        creator: creator ? serializeCreatorMarketProjection(creator) : null,
        internalTokenBalance: position.internalTokenBalance.toString(),
        spumpCostBasis: position.spumpCostBasis.toString(),
        estimatedClaimableUsdc: serializeBigInt(position.estimatedClaimableUsdc),
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
  proof?: Awaited<ReturnType<typeof syncCampaignProofProjectionFromProposal>> | null
) => ({
  proposalId: proposal.id,
  proposalPda: proposal.proposalPda,
  viewerRole: "PUBLIC",
  status: proposal.status,
  proofStatus: proof?.proofStatus ?? mapProofStatus(proposal),
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

  const proof = await syncCampaignProofProjectionFromProposal(proposal);
  return serializePublicCampaignProof(proposal, proof);
};

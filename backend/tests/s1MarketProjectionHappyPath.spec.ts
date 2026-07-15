import { expect } from "chai";
import {
  BuyoutOfferProjectionStatus,
  BuyoutProjectionStatus,
  MarketCreatorStage,
} from "@prisma/client";
import { Keypair, PublicKey } from "@solana/web3.js";

import { AnchorService } from "../src/services/AnchorService";
import { prisma } from "../src/services/prisma";
import { syncMarketProjectionFromChainInstruction } from "../src/services/marketProjectionService";

type RecordMap<T> = Map<string, T & { id: string; createdAt: Date; updatedAt: Date }>;

const nowRecord = <T extends Record<string, unknown>>(id: string, data: T) => {
  const now = new Date("2026-05-07T00:00:00.000Z");
  return {
    id,
    createdAt: now,
    updatedAt: now,
    ...data,
  };
};

const upsertRecord = <T extends Record<string, unknown>>(
  map: RecordMap<T>,
  key: string,
  args: { create: T; update: Partial<T> }
) => {
  const existing = map.get(key);
  const updatedAt = new Date("2026-05-07T00:01:00.000Z");
  const next = existing
    ? { ...existing, ...args.update, updatedAt }
    : nowRecord(`${key}-id`, args.create);
  map.set(key, next as T & { id: string; createdAt: Date; updatedAt: Date });
  return next;
};

describe("S1 market projection happy path", () => {
  const creator = Keypair.generate().publicKey;
  const creatorProfilePda = Keypair.generate().publicKey.toBase58();
  const buyoutStatePda = Keypair.generate().publicKey.toBase58();
  const sponsor = Keypair.generate().publicKey;
  const buyoutOfferPda = Keypair.generate().publicKey.toBase58();
  const positionPdas = Array.from({ length: 21 }, () => Keypair.generate().publicKey.toBase58());
  const userWallets = Array.from({ length: 21 }, () => Keypair.generate().publicKey);

  let creatorMarketProjection: RecordMap<any>;
  let s1PositionProjection: RecordMap<any>;
  let s1BuyoutProjection: RecordMap<any>;
  let s1BuyoutOfferProjection: RecordMap<any>;
  let onChainCreator: any;
  let onChainPositions: Map<string, any>;
  let onChainBuyoutState: any;
  let buyoutStateFetchCount = 0;
  let restorePrisma: (() => void) | null = null;
  let restoreAnchor: (() => void) | null = null;

  beforeEach(() => {
    creatorMarketProjection = new Map();
    s1PositionProjection = new Map();
    s1BuyoutProjection = new Map();
    s1BuyoutOfferProjection = new Map();
    onChainPositions = new Map();
    buyoutStateFetchCount = 0;
    onChainCreator = {
      authority: creator,
      handle: "s1_projection_creator",
      payoutUsdcAta: Keypair.generate().publicKey,
      level: 1,
      status: "S1_ACTIVE",
      s1Supply: 0n,
      s1EarlyCohortSupply: 0n,
      s1EligibleHolderCount: 0,
      s1EarlyHolderCount: 0,
      s1RegularHolderCount: 0,
      s1RatingBps: 10_000,
      s1GraduationTargetSupply: 2_500n,
      pendingS1RatingBps: 0,
      pendingS1GraduationTargetSupply: 0n,
      pendingRatingEffectiveAtUnix: 0n,
      pendingRatingReportDigestHex: null,
      lastRatingUpdateAtUnix: 0n,
      lastRatingReportDigestHex: null,
      lastUpgradeAtUnix: 0n,
      createdAtUnix: 1_700_000_000n,
      updatedAtUnix: 1_700_000_000n,
      bump: 1,
    };
    onChainBuyoutState = {
      creatorProfile: new PublicKey(creatorProfilePda),
      winningSponsor: sponsor,
      usdcDeposited: 1_000_000_000n,
      claimableUsdcRemaining: 200_000_000n,
      claimableS1SupplyRemaining: 21n,
      creatorPayoutUsdc: 800_000_000n,
      discoveryPoolUsdc: 200_000_000n,
      discoveryPoolRemaining: 200_000_000n,
      eligibleHolderCount: 21,
      earlyHolderCount: 20,
      regularHolderCount: 1,
      rewardModelSnapshot: 1,
      residualToSnapshot: 0,
      discoveryRewardCapUsdc: 100_000_000n,
      statusThankyouUsdc: 10_000_000n,
      creatorPaid: true,
      earlyClaimableUsdcRemaining: 0n,
      earlyClaimableS1SupplyRemaining: 20n,
      regularClaimableUsdcRemaining: 0n,
      regularClaimableS1SupplyRemaining: 1n,
      rageQuitDeadlineUnix: 1_700_000_100n,
      bump: 1,
    };

    const anchorOriginal = AnchorService.getInstance;
    (AnchorService as any).getInstance = () => ({
      fetchCreatorProfileByPda: async () => onChainCreator,
      fetchS1PositionByPda: async (pda: PublicKey) => onChainPositions.get(pda.toBase58()) ?? null,
      fetchS1BuyoutStateByPda: async () => {
        buyoutStateFetchCount += 1;
        return onChainBuyoutState;
      },
      fetchProtocolS1Config: async () => ({
        admin: Keypair.generate().publicKey,
        dailySpumpEmissionMultiplierBps: 50_000,
        newUserEmissionBps: 2_500,
        newUserEmissionWindowSeconds: 604_800,
        s1MinUserXp: 10n,
        maxS1DailyBuySpump: 15_000_000n,
        s1EarlyCohortSupplyThreshold: 500n,
        s1EarlyCohortBuyoutCapBps: 2_000,
        s1RageQuitWindowSeconds: 172_800,
        s1BuyoutCreatorShareBps: 8_000,
        s1BuyoutRewardModel: 1,
        s1DiscoveryRewardCapUsdc: 100_000_000n,
        s1StatusThankyouUsdc: 10_000_000n,
        s1BuyoutResidualTo: 0,
        s1DiscoveryMinHoldSeconds: 0,
        track2RewardCapUsdc: 100_000_000n,
        track2ResidualTo: 1,
      }),
    });
    restoreAnchor = () => {
      (AnchorService as any).getInstance = anchorOriginal;
    };

    const prismaAny = prisma as any;
    const original = {
      creatorMarketProjection: prismaAny.creatorMarketProjection,
      s1PositionProjection: prismaAny.s1PositionProjection,
      s1BuyoutProjection: prismaAny.s1BuyoutProjection,
      s1BuyoutOfferProjection: prismaAny.s1BuyoutOfferProjection,
      proposal: prismaAny.proposal,
    };

    prismaAny.creatorMarketProjection = {
      upsert: async (args: any) =>
        upsertRecord(creatorMarketProjection, args.where.creatorProfilePda, args),
      findFirst: async (args: any) =>
        [...creatorMarketProjection.values()].find(
          (record) => record.creatorProfilePda === args.where.creatorProfilePda
        ) ?? null,
      count: async () => creatorMarketProjection.size,
    };
    prismaAny.s1PositionProjection = {
      count: async (args: any) =>
        [...s1PositionProjection.values()].filter(
          (record) =>
            record.creatorProfilePda === args.where.creatorProfilePda &&
            record.internalTokenBalance > 0n
        ).length,
      upsert: async (args: any) => upsertRecord(s1PositionProjection, args.where.positionPda, args),
      updateMany: async (args: any) => {
        let count = 0;
        for (const [key, record] of s1PositionProjection.entries()) {
          if (record.positionPda === args.where.positionPda) {
            s1PositionProjection.set(key, { ...record, ...args.data, updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
      findMany: async () => [...s1PositionProjection.values()],
    };
    prismaAny.s1BuyoutProjection = {
      findUnique: async (args: any) =>
        s1BuyoutProjection.get(args.where.creatorProfilePda) ?? null,
      upsert: async (args: any) =>
        upsertRecord(s1BuyoutProjection, args.where.creatorProfilePda, args),
      update: async (args: any) => {
        const existing = s1BuyoutProjection.get(args.where.creatorProfilePda);
        if (!existing) throw new Error("missing buyout projection");
        const next = { ...existing, ...args.data, updatedAt: new Date() };
        s1BuyoutProjection.set(args.where.creatorProfilePda, next);
        return next;
      },
      count: async () => s1BuyoutProjection.size,
    };
    prismaAny.s1BuyoutOfferProjection = {
      findFirst: async (args: any) =>
        [...s1BuyoutOfferProjection.values()]
          .filter((record) => record.creatorProfilePda === args.where.creatorProfilePda)
          .sort((a, b) => Number(b.usdcAmount - a.usdcAmount))[0] ?? null,
      upsert: async (args: any) =>
        upsertRecord(s1BuyoutOfferProjection, args.where.buyoutOfferPda, args),
      updateMany: async (args: any) => {
        for (const [key, record] of s1BuyoutOfferProjection.entries()) {
          if (record.buyoutOfferPda === args.where.buyoutOfferPda) {
            s1BuyoutOfferProjection.set(key, { ...record, ...args.data, updatedAt: new Date() });
          }
        }
        return { count: 1 };
      },
      findMany: async () => [...s1BuyoutOfferProjection.values()],
    };
    prismaAny.proposal = {
      count: async () => 0,
      findUnique: async () => null,
    };

    restorePrisma = () => {
      prismaAny.creatorMarketProjection = original.creatorMarketProjection;
      prismaAny.s1PositionProjection = original.s1PositionProjection;
      prismaAny.s1BuyoutProjection = original.s1BuyoutProjection;
      prismaAny.s1BuyoutOfferProjection = original.s1BuyoutOfferProjection;
      prismaAny.proposal = original.proposal;
    };
  });

  afterEach(() => {
    restorePrisma?.();
    restoreAnchor?.();
  });

  it("projects S1 discovery through buyout, graduation, and claim", async () => {
    await syncMarketProjectionFromChainInstruction({
      signature: "register",
      instructionName: "register_creator",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: { creatorProfile: creatorProfilePda },
    });
    const registered = creatorMarketProjection.get(creatorProfilePda);
    expect(registered.creatorWallet).to.equal(creator.toBase58());
    expect(registered.s1Supply).to.equal(0n);
    expect(registered.holderCount).to.equal(0);
    expect(registered.metadataJson.s1RatingBps).to.equal(10_000);

    onChainCreator.s1Supply = 525n;
    onChainCreator.s1EarlyCohortSupply = 500n;
    onChainCreator.s1EligibleHolderCount = 21;
    onChainCreator.s1EarlyHolderCount = 20;
    onChainCreator.s1RegularHolderCount = 1;
    for (let index = 0; index < positionPdas.length; index += 1) {
      onChainPositions.set(positionPdas[index], {
        user: userWallets[index],
        creatorProfile: new PublicKey(creatorProfilePda),
        internalTokenBalance: index === 1 ? 50n : 25n,
        earlyCohortBalance: index < 20 ? (index === 1 ? 50n : 25n) : 0n,
        spumpCostBasis: 1_000_000n,
        firstBoughtAtUnix: 1_700_000_000n,
        lastBuyDay: 19_675n,
        dailyBoughtSpump: 1_000_000n,
        bump: 1,
      });
      await syncMarketProjectionFromChainInstruction({
        signature: `buy-${index}`,
        instructionName: "buy_s1_token",
        proposalPda: null,
        entityPda: creatorProfilePda,
        payload: {
          creatorProfile: creatorProfilePda,
          s1UserPosition: positionPdas[index],
        },
      });
    }

    const discovery = creatorMarketProjection.get(creatorProfilePda);
    expect(discovery.stage).to.equal(MarketCreatorStage.S1_DISCOVERY);
    expect(discovery.s1Supply).to.equal(525n);
    expect(discovery.holderCount).to.equal(21);
    expect(discovery.s1EligibleHolderCount).to.equal(21);
    expect(discovery.s1EarlyHolderCount).to.equal(20);
    expect(discovery.s1RegularHolderCount).to.equal(1);
    expect(discovery.metadataJson.s1RatingBps).to.equal(10_000);
    expect(discovery.metadataJson.s1GraduationTargetSupply).to.equal("2500");
    expect(discovery.metadataJson.maxS1DailyBuySpump).to.equal("15000000");

    onChainCreator.pendingS1RatingBps = 11_000;
    onChainCreator.pendingS1GraduationTargetSupply = 3_000n;
    onChainCreator.pendingRatingEffectiveAtUnix = 1_700_086_400n;
    onChainCreator.pendingRatingReportDigestHex = "11".repeat(32);
    await syncMarketProjectionFromChainInstruction({
      signature: "rating",
      instructionName: "update_creator_s1_rating",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: { creatorProfile: creatorProfilePda },
    });
    expect(creatorMarketProjection.get(creatorProfilePda).metadataJson.pendingS1RatingBps).to.equal(
      11_000
    );

    await syncMarketProjectionFromChainInstruction({
      signature: "init",
      instructionName: "init_s1_buyout",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: { creatorProfile: creatorProfilePda, creator: creator.toBase58() },
    });
    expect(s1BuyoutProjection.get(creatorProfilePda).status).to.equal(
      BuyoutProjectionStatus.AUCTION_OPEN
    );

    await syncMarketProjectionFromChainInstruction({
      signature: "offer",
      instructionName: "submit_buyout_offer",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        buyoutOffer: buyoutOfferPda,
        sponsor: sponsor.toBase58(),
        usdcAmount: "1000000000",
      },
    });
    expect(s1BuyoutOfferProjection.get(buyoutOfferPda).status).to.equal(
      BuyoutOfferProjectionStatus.OPEN
    );

    onChainCreator.status = "S1_EXECUTION_PENDING";
    await syncMarketProjectionFromChainInstruction({
      signature: "accept",
      instructionName: "accept_buyout_offer",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        buyoutOffer: buyoutOfferPda,
        s1BuyoutState: buyoutStatePda,
        sponsor: sponsor.toBase58(),
        usdcAmount: "1000000000",
        rageQuitDeadline: "1700000100",
      },
    });
    expect(creatorMarketProjection.get(creatorProfilePda).stage).to.equal(
      MarketCreatorStage.S1_BUYOUT
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).status).to.equal(
      BuyoutProjectionStatus.RAGE_QUIT_OPEN
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).winningSponsorWallet).to.equal(
      sponsor.toBase58()
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).acceptedOfferPda).to.equal(
      buyoutOfferPda
    );

    onChainCreator.status = "S2_ACTIVE";
    onChainCreator.level = 2;
    await syncMarketProjectionFromChainInstruction({
      signature: "graduate",
      instructionName: "execute_s1_graduation",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        s1BuyoutState: buyoutStatePda,
        creator: creator.toBase58(),
        creatorPayoutUsdc: "800000000",
        discoveryPoolUsdc: "200000000",
        discoveryPoolRemaining: "200000000",
        eligibleHolderCount: 21,
        earlyHolderCount: 20,
        regularHolderCount: 1,
        rewardModelSnapshot: 1,
        residualTo: 0,
        claimableUsdcRemaining: "200000000",
        claimableS1SupplyRemaining: "21",
        earlyClaimableUsdcRemaining: "0",
        earlyClaimableS1SupplyRemaining: "20",
        regularClaimableUsdcRemaining: "0",
        regularClaimableS1SupplyRemaining: "1",
      },
    });
    expect(creatorMarketProjection.get(creatorProfilePda).stage).to.equal(
      MarketCreatorStage.S2_ACTIVE
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).status).to.equal(
      BuyoutProjectionStatus.GRADUATED
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).winningSponsorWallet).to.equal(
      sponsor.toBase58()
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).acceptedOfferPda).to.equal(
      buyoutOfferPda
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).acceptedOfferUsdc).to.equal(
      1_000_000_000n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).creatorPayoutUsdc).to.equal(
      800_000_000n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).discoveryPoolRemaining).to.equal(
      200_000_000n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).eligibleHolderCount).to.equal(21);
    expect(s1BuyoutProjection.get(creatorProfilePda).earlyHolderCount).to.equal(20);
    expect(s1BuyoutProjection.get(creatorProfilePda).regularClaimableS1SupplyRemaining).to.equal(
      1n
    );
    expect(buyoutStateFetchCount).to.equal(0);

    await syncMarketProjectionFromChainInstruction({
      signature: "refresh-position-0-after-graduation",
      instructionName: "buy_s1_token",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        s1UserPosition: positionPdas[0],
      },
    });
    await syncMarketProjectionFromChainInstruction({
      signature: "refresh-position-1-after-graduation",
      instructionName: "buy_s1_token",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        s1UserPosition: positionPdas[1],
      },
    });
    expect(s1PositionProjection.get(positionPdas[0]).internalTokenBalance).to.equal(25n);
    expect(s1PositionProjection.get(positionPdas[1]).internalTokenBalance).to.equal(50n);
    expect(s1PositionProjection.get(positionPdas[0]).estimatedClaimableUsdc).to.equal(
      9_756_097n
    );
    expect(s1PositionProjection.get(positionPdas[1]).estimatedClaimableUsdc).to.equal(
      9_756_097n
    );

    onChainBuyoutState.claimableUsdcRemaining = 190_243_903n;
    onChainBuyoutState.claimableS1SupplyRemaining = 20n;
    onChainBuyoutState.discoveryPoolRemaining = 190_243_903n;
    onChainBuyoutState.eligibleHolderCount = 20;
    onChainBuyoutState.earlyHolderCount = 19;
    onChainBuyoutState.regularHolderCount = 1;
    onChainBuyoutState.earlyClaimableUsdcRemaining = 0n;
    onChainBuyoutState.earlyClaimableS1SupplyRemaining = 19n;
    onChainBuyoutState.regularClaimableUsdcRemaining = 0n;
    onChainBuyoutState.regularClaimableS1SupplyRemaining = 1n;
    buyoutStateFetchCount = 0;
    const claimedPosition = onChainPositions.get(positionPdas[0]);
    claimedPosition.internalTokenBalance = 0n;
    claimedPosition.earlyCohortBalance = 0n;
    claimedPosition.spumpCostBasis = 0n;

    await syncMarketProjectionFromChainInstruction({
      signature: "claim",
      instructionName: "claim_s1_buyout_usdc",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        creatorProfile: creatorProfilePda,
        s1UserPosition: positionPdas[0],
        s1BuyoutState: buyoutStatePda,
        usdcAmount: "9756097",
        rewardModel: 1,
        capped: false,
        eligible: true,
        discoveryPoolRemaining: "190243903",
        eligibleHolderCount: 20,
        earlyHolderCount: 19,
        regularHolderCount: 1,
        residualTransferred: "0",
        residualTo: 0,
        remainingUsdc: "190243903",
        remainingSupply: "20",
        earlyClaimableUsdcRemaining: "0",
        earlyClaimableS1SupplyRemaining: "19",
        regularClaimableUsdcRemaining: "0",
        regularClaimableS1SupplyRemaining: "1",
      },
    });

    const claimedProjection = s1PositionProjection.get(positionPdas[0]);
    expect(claimedProjection.internalTokenBalance).to.equal(0n);
    expect(claimedProjection.estimatedClaimableUsdc).to.equal(0n);
    expect(claimedProjection.discoveryRewardClaimed).to.equal(true);
    expect(claimedProjection.lastDiscoveryRewardUsdc).to.equal(9_756_097n);
    expect(s1BuyoutProjection.get(creatorProfilePda).claimableUsdcRemaining).to.equal(
      190_243_903n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).discoveryPoolRemaining).to.equal(
      190_243_903n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).eligibleHolderCount).to.equal(20);
    expect(s1BuyoutProjection.get(creatorProfilePda).earlyClaimableS1SupplyRemaining).to.equal(
      19n
    );
    expect(buyoutStateFetchCount).to.equal(0);
  });
});

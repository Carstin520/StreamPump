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
      claimableUsdcRemaining: 1_000_000_000n,
      claimableS1SupplyRemaining: 525n,
      earlyClaimableUsdcRemaining: 200_000_000n,
      earlyClaimableS1SupplyRemaining: 500n,
      regularClaimableUsdcRemaining: 800_000_000n,
      regularClaimableS1SupplyRemaining: 25n,
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
    onChainCreator.s1Supply = 525n;
    onChainCreator.s1EarlyCohortSupply = 500n;
    for (let index = 0; index < positionPdas.length; index += 1) {
      onChainPositions.set(positionPdas[index], {
        user: userWallets[index],
        creatorProfile: new PublicKey(creatorProfilePda),
        internalTokenBalance: 25n,
        earlyCohortBalance: index < 20 ? 25n : 0n,
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
        claimableUsdcRemaining: "1000000000",
        claimableS1SupplyRemaining: "525",
        earlyClaimableUsdcRemaining: "200000000",
        earlyClaimableS1SupplyRemaining: "500",
        regularClaimableUsdcRemaining: "800000000",
        regularClaimableS1SupplyRemaining: "25",
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
    expect(s1BuyoutProjection.get(creatorProfilePda).earlyClaimableUsdcRemaining).to.equal(
      200_000_000n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).regularClaimableS1SupplyRemaining).to.equal(
      25n
    );
    expect(buyoutStateFetchCount).to.equal(0);

    onChainBuyoutState.claimableUsdcRemaining = 990_000_000n;
    onChainBuyoutState.claimableS1SupplyRemaining = 500n;
    onChainBuyoutState.earlyClaimableUsdcRemaining = 190_000_000n;
    onChainBuyoutState.earlyClaimableS1SupplyRemaining = 475n;
    onChainBuyoutState.regularClaimableUsdcRemaining = 800_000_000n;
    onChainBuyoutState.regularClaimableS1SupplyRemaining = 25n;
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
        remainingUsdc: "990000000",
        remainingSupply: "500",
        earlyClaimableUsdcRemaining: "190000000",
        earlyClaimableS1SupplyRemaining: "475",
        regularClaimableUsdcRemaining: "800000000",
        regularClaimableS1SupplyRemaining: "25",
      },
    });

    const claimedProjection = s1PositionProjection.get(positionPdas[0]);
    expect(claimedProjection.internalTokenBalance).to.equal(0n);
    expect(claimedProjection.estimatedClaimableUsdc).to.equal(0n);
    expect(s1BuyoutProjection.get(creatorProfilePda).claimableUsdcRemaining).to.equal(
      990_000_000n
    );
    expect(s1BuyoutProjection.get(creatorProfilePda).earlyClaimableS1SupplyRemaining).to.equal(
      475n
    );
    expect(buyoutStateFetchCount).to.equal(0);
  });
});

import { expect } from "chai";
import {
  BuyoutOfferProjectionStatus,
  ContentManifestStatus,
  MarketCreatorStage,
} from "@prisma/client";
import { Keypair, PublicKey } from "@solana/web3.js";

import { AnchorService } from "../src/services/AnchorService";
import { prisma } from "../src/services/prisma";
import { syncMarketProjectionFromChainInstruction } from "../src/services/marketProjectionService";

type OfferRecord = {
  buyoutOfferPda: string;
  creatorProfilePda: string;
  sponsorWallet: string;
  status: BuyoutOfferProjectionStatus;
  lastEventSignature: string | null;
  lastEventAt: Date | null;
};

describe("S1 market projection unhappy path events", () => {
  const buyoutOfferPda = Keypair.generate().publicKey.toBase58();
  const creator = Keypair.generate().publicKey;
  const creatorProfilePda = Keypair.generate().publicKey.toBase58();
  const positionPda = Keypair.generate().publicKey.toBase58();
  const sponsorWallet = Keypair.generate().publicKey.toBase58();
  const user = Keypair.generate().publicKey;
  let offers: Map<string, OfferRecord>;
  let creatorMarketProjection: Map<string, any>;
  let s1PositionProjection: Map<string, any>;
  let contentManifests: Map<string, any>;
  let onChainCreator: any;
  let onChainPosition: any;
  let restorePrisma: (() => void) | null = null;
  let restoreAnchor: (() => void) | null = null;

  beforeEach(() => {
    offers = new Map([
      [
        buyoutOfferPda,
        {
          buyoutOfferPda,
          creatorProfilePda,
          sponsorWallet,
          status: BuyoutOfferProjectionStatus.OPEN,
          lastEventSignature: null,
          lastEventAt: null,
        },
      ],
    ]);
    creatorMarketProjection = new Map();
    s1PositionProjection = new Map();
    contentManifests = new Map();
    contentManifests.set("manifest-1", {
      id: "manifest-1",
      internalUrlDigestHex: "aa".repeat(32),
      manifestHashHex: "bb".repeat(32),
      currentAnchorPda: null,
      currentAnchorTx: null,
      status: ContentManifestStatus.READY,
    });
    onChainCreator = {
      authority: creator,
      handle: "rage_quit_creator",
      payoutUsdcAta: Keypair.generate().publicKey,
      level: 1,
      status: "S1_EXECUTION_PENDING",
      s1Supply: 20n,
      s1EarlyCohortSupply: 20n,
      s1RatingBps: 10_000,
      s1GraduationTargetSupply: 2_500n,
      pendingS1RatingBps: 0,
      pendingS1GraduationTargetSupply: 0n,
      pendingRatingEffectiveAtUnix: 0n,
      pendingRatingReportDigestHex: null,
      lastRatingUpdateAtUnix: 0n,
      lastRatingReportDigestHex: null,
      bump: 1,
    };
    onChainPosition = {
      user,
      creatorProfile: new PublicKey(creatorProfilePda),
      internalTokenBalance: 20n,
      earlyCohortBalance: 20n,
      spumpCostBasis: 750_000n,
      firstBoughtAtUnix: 1_700_000_000n,
      lastBuyDay: 19_675n,
      dailyBoughtSpump: 1_000_000n,
      bump: 1,
    };

    const anchorOriginal = AnchorService.getInstance;
    (AnchorService as any).getInstance = () => ({
      fetchCreatorProfileByPda: async () => onChainCreator,
      fetchS1PositionByPda: async () => onChainPosition,
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
      contentManifest: prismaAny.contentManifest,
      proposal: prismaAny.proposal,
    };

    prismaAny.creatorMarketProjection = {
      findMany: async () =>
        [...creatorMarketProjection.values()].map((record) => ({
          creatorProfilePda: record.creatorProfilePda,
        })),
      upsert: async (args: any) => {
        const existing = creatorMarketProjection.get(args.where.creatorProfilePda);
        const next = existing
          ? { ...existing, ...args.update, updatedAt: new Date() }
          : { id: `${args.where.creatorProfilePda}-id`, ...args.create, createdAt: new Date(), updatedAt: new Date() };
        creatorMarketProjection.set(args.where.creatorProfilePda, next);
        return next;
      },
    };
    prismaAny.s1PositionProjection = {
      count: async (args: any) =>
        [...s1PositionProjection.values()].filter(
          (record) =>
            record.creatorProfilePda === args.where.creatorProfilePda &&
            record.internalTokenBalance > 0n
        ).length,
      upsert: async (args: any) => {
        const existing = s1PositionProjection.get(args.where.positionPda);
        const next = existing
          ? { ...existing, ...args.update, updatedAt: new Date() }
          : { id: `${args.where.positionPda}-id`, ...args.create, createdAt: new Date(), updatedAt: new Date() };
        s1PositionProjection.set(args.where.positionPda, next);
        return next;
      },
    };
    prismaAny.s1BuyoutProjection = {
      findUnique: async () => ({
        status: "RAGE_QUIT_OPEN",
        claimableUsdcRemaining: 1_000_000n,
        claimableS1SupplyRemaining: 20n,
        earlyClaimableUsdcRemaining: 1_000_000n,
        earlyClaimableS1SupplyRemaining: 20n,
        regularClaimableUsdcRemaining: 0n,
        regularClaimableS1SupplyRemaining: 0n,
      }),
      upsert: async (args: any) => ({
        id: `${args.where.creatorProfilePda}-buyout`,
        creatorProfilePda: args.where.creatorProfilePda,
        ...args.create,
        ...args.update,
      }),
    };
    prismaAny.s1BuyoutOfferProjection = {
      findFirst: async () => null,
      updateMany: async (args: any) => {
        let count = 0;
        for (const [key, record] of offers.entries()) {
          const where = args.where ?? {};
          const matches =
            (!where.buyoutOfferPda || record.buyoutOfferPda === where.buyoutOfferPda) &&
            (!where.creatorProfilePda || record.creatorProfilePda === where.creatorProfilePda) &&
            (!where.sponsorWallet || record.sponsorWallet === where.sponsorWallet) &&
            (!where.status || record.status === where.status);
          if (matches) {
            offers.set(key, {
              ...record,
              ...args.data,
            });
            count += 1;
          }
        }
        return { count };
      },
    };
    prismaAny.contentManifest = {
      updateMany: async (args: any) => {
        let count = 0;
        for (const [key, record] of contentManifests.entries()) {
          const matchConditions = args.where.OR ?? args.where.AND?.[0]?.OR ?? [];
          const statusFilter = args.where.AND?.[1]?.status;
          const statusMatches =
            !statusFilter ||
            (typeof statusFilter === "string"
              ? record.status === statusFilter
              : statusFilter.in.includes(record.status));
          const matches = statusMatches && matchConditions.some((condition: any) =>
            Object.entries(condition).every(([field, value]) => record[field] === value)
          );
          if (matches) {
            contentManifests.set(key, { ...record, ...args.data });
            count += 1;
          }
        }
        return { count };
      },
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
      prismaAny.contentManifest = original.contentManifest;
      prismaAny.proposal = original.proposal;
    };
  });

  afterEach(() => {
    restorePrisma?.();
    restoreAnchor?.();
  });

  it("marks cancelled and reclaimed offers without requiring a full creator refresh", async () => {
    await syncMarketProjectionFromChainInstruction({
      signature: "cancel-sig",
      instructionName: "cancel_buyout_offer",
      proposalPda: null,
      entityPda: null,
      payload: {
        buyoutOffer: buyoutOfferPda,
      },
    });

    expect(offers.get(buyoutOfferPda)?.status).to.equal(BuyoutOfferProjectionStatus.CANCELLED);
    expect(offers.get(buyoutOfferPda)?.lastEventSignature).to.equal("cancel-sig");

    await syncMarketProjectionFromChainInstruction({
      signature: "reclaim-sig",
      instructionName: "reclaim_expired_buyout_offer",
      proposalPda: null,
      entityPda: null,
      payload: {
        eventData: {
          buyoutOffer: buyoutOfferPda,
        },
      },
    });

    expect(offers.get(buyoutOfferPda)?.status).to.equal(BuyoutOfferProjectionStatus.RECLAIMED);
    expect(offers.get(buyoutOfferPda)?.lastEventSignature).to.equal("reclaim-sig");
  });

  it("marks accepted offers as aborted after an abort_s1_buyout event", async () => {
    offers.set(buyoutOfferPda, {
      ...offers.get(buyoutOfferPda)!,
      status: BuyoutOfferProjectionStatus.ACCEPTED,
    });

    await syncMarketProjectionFromChainInstruction({
      signature: "abort-sig",
      instructionName: "abort_s1_buyout",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        eventData: {
          creatorProfile: creatorProfilePda,
          sponsor: sponsorWallet,
        },
      },
    });

    expect(offers.get(buyoutOfferPda)?.status).to.equal(BuyoutOfferProjectionStatus.ABORTED);
    expect(offers.get(buyoutOfferPda)?.lastEventSignature).to.equal("abort-sig");
  });

  it("ignores malformed offer events instead of throwing", async () => {
    await syncMarketProjectionFromChainInstruction({
      signature: "malformed",
      instructionName: "cancel_buyout_offer",
      proposalPda: null,
      entityPda: null,
      payload: {
        buyoutOffer: "",
      },
    });

    expect(offers.get(buyoutOfferPda)?.status).to.equal(BuyoutOfferProjectionStatus.OPEN);
  });

  it("refreshes position and creator projections after a rage quit event", async () => {
    await syncMarketProjectionFromChainInstruction({
      signature: "rage-quit-sig",
      instructionName: "rage_quit_s1",
      proposalPda: null,
      entityPda: creatorProfilePda,
      payload: {
        eventData: {
          creatorProfile: creatorProfilePda,
          s1UserPosition: positionPda,
          amount: "5",
          newBalance: "20",
          newSupply: "20",
        },
      },
    });

    const position = s1PositionProjection.get(positionPda);
    expect(position.internalTokenBalance).to.equal(20n);
    expect(position.earlyCohortBalance).to.equal(20n);
    expect(position.estimatedClaimableUsdc).to.equal(null);
    expect(position.lastEventSignature).to.equal("rage-quit-sig");

    const creatorMarket = creatorMarketProjection.get(creatorProfilePda);
    expect(creatorMarket.stage).to.equal(MarketCreatorStage.S1_BUYOUT);
    expect(creatorMarket.s1Supply).to.equal(20n);
    expect(creatorMarket.holderCount).to.equal(1);
    expect(creatorMarket.lastEventSignature).to.equal("rage-quit-sig");
  });

  it("refreshes all creator market metadata after protocol S1 config updates", async () => {
    creatorMarketProjection.set(creatorProfilePda, {
      creatorProfilePda,
      creatorWallet: creator.toBase58(),
      metadataJson: { maxS1DailyBuySpump: "15000000" },
    });

    await syncMarketProjectionFromChainInstruction({
      signature: "s1-config-sig",
      instructionName: "update_protocol_s1_emission",
      proposalPda: null,
      entityPda: null,
      payload: {
        eventData: {
          maxS1DailyBuySpump: "25000000",
        },
      },
    });

    const creatorMarket = creatorMarketProjection.get(creatorProfilePda);
    expect(creatorMarket.metadataJson.maxS1DailyBuySpump).to.equal("15000000");
    expect(creatorMarket.lastEventSignature).to.equal("s1-config-sig");
  });

  it("anchors matching content manifests from ContentAnchored events", async () => {
    const contentAnchorPda = Keypair.generate().publicKey.toBase58();
    await syncMarketProjectionFromChainInstruction({
      signature: "anchor-sig",
      instructionName: "anchor_content_hash",
      proposalPda: null,
      entityPda: contentAnchorPda,
      payload: {
        eventData: {
          contentAnchor: contentAnchorPda,
          urlDigest: "aa".repeat(32),
          contentDigest: "bb".repeat(32),
        },
      },
    });

    const manifest = contentManifests.get("manifest-1");
    expect(manifest.status).to.equal(ContentManifestStatus.ANCHORED);
    expect(manifest.currentAnchorPda).to.equal(contentAnchorPda);
    expect(manifest.currentAnchorTx).to.equal("anchor-sig");
  });
});

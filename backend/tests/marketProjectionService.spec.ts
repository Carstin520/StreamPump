import { expect } from "chai";
import {
  CampaignProofStatus,
  ContentManifestStatus,
  ContentType,
  MarketCreatorStage,
  OracleSyncStatus,
  ProposalStatus,
  Track2MetricType,
} from "@prisma/client";

import {
  syncCampaignProofProjectionFromProposal,
  serializeCreatorMarketProjection,
  serializePublicCampaignProof,
} from "../src/services/marketProjectionService";
import { prisma } from "../src/services/prisma";

describe("marketProjectionService serializers", () => {
  it("serializes creator market projections without leaking BigInt values", () => {
    const now = new Date("2026-04-30T00:00:00.000Z");
    const serialized = serializeCreatorMarketProjection({
      id: "projection-id",
      creatorWallet: "creator-wallet",
      creatorProfilePda: "creator-profile",
      handle: "creator",
      displayName: null,
      stage: MarketCreatorStage.S1_DISCOVERY,
      level: 2,
      s1Supply: 12n,
      currentPriceSpump: 12_000n,
      nextPriceSpump: 13_000n,
      supporterPoolSpump: 72_000n,
      holderCount: 3,
      graduationProgressBps: 120,
      activeCampaignCount: 1,
      latestBuyoutOfferUsdc: 5_000_000n,
      acceptedBuyoutOfferUsdc: null,
      buyoutStatePda: null,
      lastEventSignature: null,
      lastEventAt: null,
      metadataJson: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(serialized.s1Supply).to.equal("12");
    expect(serialized.currentPriceSpump).to.equal("12000");
    expect(serialized.latestBuyoutOfferUsdc).to.equal("5000000");
    expect(serialized.updatedAt).to.equal(now.toISOString());
  });

  it("serializes public campaign proof with manifest, assets, and publication proof", () => {
    const now = new Date("2026-04-30T00:00:00.000Z");
    const serialized = serializePublicCampaignProof(
      {
        id: "proposal-id",
        proposalPda: "proposal-pda",
        creatorWallet: "creator-wallet",
        sponsorWallet: "sponsor-wallet",
        sponsorOrgId: null,
        creatorOrgId: null,
        manifestId: "manifest-id",
        intentId: "intent-id",
        contentHashHex: "a".repeat(64),
        contentAnchorPda: "anchor-pda",
        contentAnchorTx: "anchor-tx",
        deadlineAt: now,
        status: ProposalStatus.FUNDED,
        track1BaseUsdc: 100n,
        track1Claimed: false,
        track2MetricType: Track2MetricType.VIEWS,
        track2TargetValue: 1_000n,
        track2MinAchievementBps: 8_000,
        track2UsdcDeposited: 200n,
        track2ActualValue: null,
        track2SettledAt: null,
        track3UsdcDeposited: 300n,
        track3CpsPayout: null,
        track3DelayDays: 7,
        track3SettledAt: null,
        onChainTxSignature: "funding-tx",
        oracleSyncStatus: OracleSyncStatus.PENDING,
        oracleLastError: null,
        contentPublishedVerifiedAt: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
        manifest: {
          id: "manifest-id",
          creatorWallet: "creator-wallet",
          contentType: ContentType.SHORT_VIDEO,
          status: ContentManifestStatus.ANCHORED,
          isPublicFeedEligible: true,
          publishedAt: now,
          publicSlug: "public-post",
          creatorDisplayName: null,
          publicExcerpt: null,
          title: "Campaign proof",
          captionText: null,
          captionTextHash: null,
          manifestHashHex: "b".repeat(64),
          canonicalManifestJson: null,
          internalCanonicalUrl: null,
          internalUrlDigestHex: "c".repeat(64),
          currentAnchorPda: "anchor-pda",
          currentAnchorTx: "anchor-tx",
          coverAssetId: null,
          version: 1,
          parentManifestId: null,
          metadataJson: null,
          tagsJson: null,
          createdAt: now,
          updatedAt: now,
          assets: [
            {
              id: "asset-id",
              assetType: "VIDEO",
              orderIndex: 0,
              sha256Hex: "d".repeat(64),
              mimeType: "video/mp4",
              fileSizeBytes: 1024n,
              width: 1920,
              height: 1080,
              durationMs: 10_000,
              cdnUrl: "https://cdn.example/video.mp4",
              muxPlaybackId: "mux-playback",
              uploadStatus: "UPLOADED",
              processingStatus: "READY",
              updatedAt: now,
            },
          ],
          publications: [
            {
              id: "publication-id",
              manifestId: "manifest-id",
              platform: "x",
              externalPostIdHash: null,
              externalUrl: "https://x.example/post",
              externalUrlDigestHex: "e".repeat(64),
              verificationStatus: "VERIFIED",
              verificationSource: "manual",
              verifiedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
      {
        id: "proof-id",
        proposalId: "proposal-id",
        proposalPda: "proposal-pda",
        creatorWallet: "creator-wallet",
        sponsorWallet: "sponsor-wallet",
        manifestId: "manifest-id",
        intentId: "intent-id",
        status: ProposalStatus.FUNDED,
        proofStatus: CampaignProofStatus.ANCHORED,
        contentHashHex: "a".repeat(64),
        contentAnchorPda: "anchor-pda",
        contentAnchorTx: "anchor-tx",
        fundingTxSignature: "funding-tx",
        latestSettlementTxSignature: null,
        track1BaseUsdc: 100n,
        track2UsdcDeposited: 200n,
        track3UsdcDeposited: 300n,
        track2MetricType: Track2MetricType.VIEWS,
        track2TargetValue: 1_000n,
        track2ActualValue: null,
        deadlineAt: now,
        settledAt: null,
        metadataJson: null,
        createdAt: now,
        updatedAt: now,
      }
    );

    expect(serialized.proofStatus).to.equal(CampaignProofStatus.ANCHORED);
    expect(serialized.budgetTracks.track1BaseUsdc).to.equal("100");
    expect(serialized.manifest?.manifestHashHex).to.equal("b".repeat(64));
    expect(serialized.manifest?.assets[0].sha256Hex).to.equal("d".repeat(64));
    expect(serialized.manifest?.publications[0].externalUrlDigestHex).to.equal("e".repeat(64));
  });

  it("projects cancelled, voided, settling, and settled proof statuses", async () => {
    const prismaAny = prisma as any;
    const original = prismaAny.campaignProofProjection;
    const upserts: any[] = [];
    prismaAny.campaignProofProjection = {
      upsert: async (args: any) => {
        upserts.push(args);
        return { ...args.create, ...args.update };
      },
    };

    const baseProposal = {
      id: "proposal-id",
      proposalPda: "proposal-pda",
      creatorWallet: "creator-wallet",
      sponsorWallet: "sponsor-wallet",
      manifestId: null,
      intentId: null,
      contentHashHex: "a".repeat(64),
      contentAnchorPda: null,
      contentAnchorTx: null,
      status: ProposalStatus.FUNDED,
      track1BaseUsdc: 100n,
      track1Claimed: false,
      track2MetricType: Track2MetricType.VIEWS,
      track2TargetValue: 1_000n,
      track2ActualValue: null,
      track2UsdcDeposited: 200n,
      track2SettledAt: null,
      track3UsdcDeposited: 300n,
      track3SettledAt: null,
      onChainTxSignature: "tx",
      deadlineAt: new Date("2026-04-30T00:00:00.000Z"),
      updatedAt: new Date("2026-04-30T00:00:00.000Z"),
    } as any;

    try {
      await syncCampaignProofProjectionFromProposal({
        ...baseProposal,
        status: ProposalStatus.CANCELLED,
      });
      await syncCampaignProofProjectionFromProposal({
        ...baseProposal,
        status: ProposalStatus.VOIDED,
      });
      await syncCampaignProofProjectionFromProposal({
        ...baseProposal,
        track1Claimed: true,
      });
      await syncCampaignProofProjectionFromProposal({
        ...baseProposal,
        track2SettledAt: new Date("2026-04-30T00:01:00.000Z"),
        track3SettledAt: new Date("2026-04-30T00:02:00.000Z"),
      });
    } finally {
      prismaAny.campaignProofProjection = original;
    }

    expect(upserts[0].create.proofStatus).to.equal(CampaignProofStatus.CANCELLED);
    expect(upserts[1].create.proofStatus).to.equal(CampaignProofStatus.VOIDED);
    expect(upserts[2].create.proofStatus).to.equal(CampaignProofStatus.SETTLING);
    expect(upserts[3].create.proofStatus).to.equal(CampaignProofStatus.SETTLED);
  });
});

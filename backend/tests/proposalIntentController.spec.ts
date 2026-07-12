/**
 * CN: Proposal intent 控制器辅助逻辑测试，覆盖 bundle 复用判断和签名提取。
 * EN: Proposal intent controller helper tests covering bundle reuse rules and signature extraction.
 */
import { expect } from "chai";
import {
  ProposalIntentStatus,
  BundleStatus,
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  PublicationVerificationStatus,
  SponsorVerificationStatus,
  Track2MetricType,
} from "@prisma/client";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  buildProposalIntentSemantics,
  confirmedLaunchMismatchFields,
  extractTransactionSignature,
  isBundleReusable,
  resolveLaunchContentAnchorTx,
  serializeIntent,
} from "../src/controllers/proposalIntentShared";
import {
  assertManifestReadyForProposalIntent,
  assertSponsorApprovedForFinalSubmit,
  createProposalIntent,
} from "../src/controllers/proposalIntentController";
import { config } from "../config/default";
import { prisma } from "../src/services/prisma";

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

describe("proposalIntentController helpers", () => {
  it("requires feed eligibility, verified delivery, operator approval, and a positive Track 1 budget", () => {
    const readyManifest = {
      isPublicFeedEligible: true,
      assets: [{
        assetType: AssetType.IMAGE,
        uploadStatus: AssetUploadStatus.UPLOADED,
        processingStatus: AssetProcessingStatus.READY,
        sha256Hex: "a".repeat(64),
        fileSizeBytes: 42n,
        verifiedSha256Hex: "a".repeat(64),
        verifiedSizeBytes: 42n,
        storageVerifiedAt: new Date(),
        muxPlaybackId: null,
      }],
      publications: [{
        verificationStatus: PublicationVerificationStatus.VERIFIED,
        verificationSource: "OPERATOR_APPROVED",
        verificationReviewer: "operator-wallet",
        verificationEvidenceDigestHex: "b".repeat(64),
        verifiedAt: new Date(),
      }],
    };
    expect(() => assertManifestReadyForProposalIntent({
      manifest: readyManifest,
      track1BaseUsdc: 1n,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
    })).not.to.throw();
    expect(() => assertManifestReadyForProposalIntent({
      manifest: readyManifest,
      track1BaseUsdc: 0n,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
    })).to.throw().with.property("code", "TRACK1_BASE_USDC_REQUIRED");
    expect(() => assertManifestReadyForProposalIntent({
      manifest: { ...readyManifest, isPublicFeedEligible: false },
      track1BaseUsdc: 1n,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
    })).to.throw().with.property("code", "MANIFEST_NOT_PUBLIC_FEED_ELIGIBLE");
  });

  it("rechecks sponsor approval at final submission", () => {
    expect(() => assertSponsorApprovedForFinalSubmit({
      status: SponsorVerificationStatus.APPROVED,
    })).not.to.throw();
    expect(() => assertSponsorApprovedForFinalSubmit({
      status: SponsorVerificationStatus.PENDING,
    })).to.throw().with.property("code", "SPONSOR_KYB_NOT_APPROVED");
  });

  it("compares confirmed chain truth against every locked launch field", () => {
    const creator = Keypair.generate().publicKey;
    const sponsor = Keypair.generate().publicKey;
    const anchor = Keypair.generate().publicKey.toBase58();
    const intent: any = {
      creatorWallet: creator.toBase58(),
      sponsorWallet: sponsor.toBase58(),
      lockedManifestHashHex: "a".repeat(64),
      deadlineUnix: 1_900_000_000n,
      nonce: 7n,
      track1BaseUsdc: 100n,
      track2MetricType: "VIEWS",
      track2TargetValue: 0n,
      track2MinAchievementBps: 0,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
      maxEndorsementSpump: 0n,
    };
    const onChain: any = {
      creator,
      sponsor,
      contentHashHex: "a".repeat(64),
      contentAnchorPda: anchor,
      contentKind: "SHORT_VIDEO",
      deadlineUnix: 1_900_000_000n,
      nonce: 7n,
      track1BaseUsdc: 100n,
      track2MetricType: "VIEWS",
      track2TargetValue: 0n,
      track2MinAchievementBps: 0,
      track2UsdcDeposited: 0n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
      maxEndorsementSpump: 0n,
      status: "FUNDED",
    };
    expect(confirmedLaunchMismatchFields({
      intent,
      manifestContentType: "SHORT_VIDEO",
      expectedContentAnchorPda: anchor,
      onChain,
    })).to.deep.equal([]);
    expect(confirmedLaunchMismatchFields({
      intent,
      manifestContentType: "SHORT_VIDEO",
      expectedContentAnchorPda: anchor,
      onChain: { ...onChain, track3UsdcDeposited: 1n, status: "OPEN" },
    })).to.have.members(["track3UsdcDeposited", "status"]);
  });

  it("never relabels a funding transaction as an existing content anchor transaction", () => {
    expect(resolveLaunchContentAnchorTx({
      existingContentAnchorPda: "existing-anchor",
      existingContentAnchorTx: "original-anchor-signature",
      launchTxSignature: "funding-signature",
    })).to.equal("original-anchor-signature");
    expect(resolveLaunchContentAnchorTx({
      existingContentAnchorPda: "existing-anchor",
      existingContentAnchorTx: null,
      launchTxSignature: "funding-signature",
    })).to.equal(null);
    expect(resolveLaunchContentAnchorTx({
      existingContentAnchorPda: null,
      existingContentAnchorTx: null,
      launchTxSignature: "anchor-and-funding-signature",
    })).to.equal("anchor-and-funding-signature");
  });

  it("requires sponsor KYB even when S1 mock API is enabled", async () => {
    const creatorWallet = Keypair.generate().publicKey.toBase58();
    const sponsorWallet = Keypair.generate().publicKey.toBase58();
    const prismaAny = prisma as any;
    const originalS1MockApiEnabled = config.s1.mockApiEnabled;
    const originalSponsorFindUnique = prismaAny.sponsorProfile.findUnique;
    const originalManifestFindUnique = prismaAny.contentManifest.findUnique;
    let manifestLookupReached = false;

    prismaAny.sponsorProfile.findUnique = async () => null;
    prismaAny.contentManifest.findUnique = async () => {
      manifestLookupReached = true;
      throw new Error("manifest lookup should not run before sponsor KYB approval");
    };
    config.s1.mockApiEnabled = true;

    try {
      const response = createMockResponse();
      await createProposalIntent(
        {
          auth: {
            wallet: creatorWallet,
            source: "session",
          },
          header: (name: string) => (name.toLowerCase() === "x-idempotency-key" ? "idem-1" : undefined),
          body: {
            manifestId: "manifest-1",
            creatorWallet,
            sponsorWallet,
            deadlineUnix: "1900000000",
            track1BaseUsdc: "100",
            track2MetricType: Track2MetricType.VIEWS,
            track2TargetValue: "1000",
            track2MinAchievementBps: 5000,
            track2UsdcDeposited: "200",
            track3UsdcDeposited: "0",
            track3DelayDays: 0,
          },
        } as any,
        response as any
      );

      expect(response.statusCode).to.equal(403);
      expect(response.body.error.code).to.equal("SPONSOR_KYB_NOT_APPROVED");
      expect(manifestLookupReached).to.equal(false);
    } finally {
      config.s1.mockApiEnabled = originalS1MockApiEnabled;
      prismaAny.sponsorProfile.findUnique = originalSponsorFindUnique;
      prismaAny.contentManifest.findUnique = originalManifestFindUnique;
    }
  });

  it("reuses an active built bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.BUILT,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(reusable).to.equal(true);
  });

  it("does not reuse an expired partial bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.PARTIAL,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(false);
  });

  it("always reuses a confirmed bundle even after expiry", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.CONFIRMED,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(true);
  });

  it("extracts the canonical transaction signature from a fully signed v0 transaction", () => {
    const sponsor = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: Keypair.generate().publicKey.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: sponsor.publicKey,
            toPubkey: recipient,
            lamports: 1,
          }),
        ],
      }).compileToV0Message()
    );

    tx.sign([sponsor]);
    const extracted = extractTransactionSignature(Buffer.from(tx.serialize()).toString("base64"));

    expect(extracted).to.be.a("string");
    expect(extracted.length).to.be.greaterThan(20);
  });

  it("describes the next signer for intent list/detail serializers", () => {
    const now = new Date(Date.now() + 60_000);
    const semantics = buildProposalIntentSemantics(
      {
        id: "intent-id",
        status: ProposalIntentStatus.CREATOR_PARTIALLY_SIGNED,
        version: 2,
        creatorWallet: "creator-wallet",
        sponsorWallet: "sponsor-wallet",
        sponsorOrgId: null,
        creatorOrgId: null,
        manifestId: "manifest-id",
        lockedManifestHashHex: "a".repeat(64),
        lockedAnchorPda: "anchor-pda",
        deadlineUnix: 1_800_000_000n,
        nonce: 9n,
        track1BaseUsdc: 1n,
        track2MetricType: Track2MetricType.VIEWS,
        track2TargetValue: 1n,
        track2MinAchievementBps: 8_000,
        track2UsdcDeposited: 1n,
        track3UsdcDeposited: 1n,
        track3DelayDays: 7,
        maxEndorsementSpump: 10_000n,
        plannedProposalPda: "proposal-pda",
        plannedUsdcVaultPda: "vault-pda",
        creatorApprovedAt: now,
        sponsorApprovedAt: null,
        chainTxSignature: null,
        chainSubmittedAt: null,
        chainConfirmedAt: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      },
      "creator-wallet",
      null
    );

    expect(semantics.currentStep).to.equal("AWAITING_SPONSOR_SIGNATURE");
    expect(semantics.viewerRole).to.equal("CREATOR");
    expect(semantics.nextAction).to.equal("SPONSOR_SIGN_AND_SUBMIT");
    expect(semantics.requiredSigner).to.equal("SPONSOR");
    expect(semantics.disabledReason).to.equal("SPONSOR_REQUIRED");
  });

  it("serializes proposal nonce and endorsement cap explicitly", () => {
    const now = new Date("2026-05-24T00:00:00.000Z");
    const serialized = serializeIntent({
      id: "intent-id",
      status: ProposalIntentStatus.DRAFT,
      version: 1,
      creatorWallet: "creator-wallet",
      sponsorWallet: "sponsor-wallet",
      sponsorOrgId: null,
      creatorOrgId: null,
      manifestId: "manifest-id",
      lockedManifestHashHex: null,
      lockedAnchorPda: null,
      deadlineUnix: 1_800_000_000n,
      nonce: 123n,
      track1BaseUsdc: 100n,
      track2MetricType: Track2MetricType.VIEWS,
      track2TargetValue: 1_000n,
      track2MinAchievementBps: 7_000,
      track2UsdcDeposited: 200n,
      track3UsdcDeposited: 0n,
      track3DelayDays: 0,
      maxEndorsementSpump: 50_000n,
      plannedProposalPda: null,
      plannedUsdcVaultPda: null,
      creatorApprovedAt: null,
      sponsorApprovedAt: null,
      chainTxSignature: null,
      chainSubmittedAt: null,
      chainConfirmedAt: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(serialized.nonce).to.equal("123");
    expect(serialized.maxEndorsementSpump).to.equal("50000");
  });
});

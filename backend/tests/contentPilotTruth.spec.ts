import { AccountRole, AssetUploadStatus, PublicationVerificationStatus } from "@prisma/client";
import { expect } from "chai";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { HttpError } from "../src/controllers/http";
import { serializeAsset } from "../src/controllers/contentManifestShared";
import { config } from "../config/default";
import {
  acquirePresignLocks,
  assertR2MonthlyUploadBudget,
  assertUniqueAssetOrderIndexes,
} from "../src/controllers/contentManifestController";
import { isCreatorAccountProfile } from "../src/middleware/accountRole";
import {
  internalOperatorKeyIdentity,
  internalOperatorKeyMatches,
} from "../src/middleware/internalOperatorAuth";
import { trustedPublicationVerificationWhere } from "../src/services/contentPublicationEligibility";
import {
  assertCreatorPublicationVerificationAllowed,
  buildPublicationReviewData,
  normalizePublicationTarget,
} from "../src/services/contentPublicationReview";
import {
  assertPromotedObjectMatches,
  buildVerifiedStorageKey,
  isAssetStorageVerified,
  StorageObjectVerificationError,
  shouldCompleteMultipartUpload,
  verifiedAssetMatchesUploadDeclaration,
  verifyStoredContentAsset,
} from "../src/services/contentStorageVerification";
import { R2Service } from "../src/services/R2Service";

describe("invite-only Pilot content truth", () => {
  const expected = {
    storageKey: "content/manifest/v/1/0-declared.png",
    expectedSha256Hex: "a".repeat(64),
    expectedSizeBytes: 42n,
    expectedMimeType: "image/png",
  };

  it("compares internal operator keys by digest and derives a non-secret audit identity", () => {
    const key = "a-strong-internal-operator-key-value";
    expect(internalOperatorKeyMatches(key, key)).to.equal(true);
    expect(internalOperatorKeyMatches(key, `${key}-wrong`)).to.equal(false);
    expect(internalOperatorKeyMatches(key, "")).to.equal(false);
    const identity = internalOperatorKeyIdentity(key);
    expect(identity).to.match(/^INTERNAL_KEY:[0-9a-f]{12}$/);
    expect(identity).not.to.include(key);
  });

  it("accepts only a server-observed object matching size, MIME, and SHA-256", async () => {
    const verified = await verifyStoredContentAsset(expected, async () => ({
      contentType: "image/png",
      etag: "etag-1",
      headSizeBytes: 42n,
      sha256Hex: "a".repeat(64),
      sizeBytes: 42n,
    }));

    expect(verified).to.deep.equal({
      contentType: "image/png",
      etag: "etag-1",
      sha256Hex: "a".repeat(64),
      sizeBytes: 42n,
    });
    expect(
      isAssetStorageVerified({
        sha256Hex: expected.expectedSha256Hex,
        fileSizeBytes: 42n,
        verifiedSha256Hex: verified.sha256Hex,
        verifiedSizeBytes: verified.sizeBytes,
        storageVerifiedAt: new Date(),
      })
    ).to.equal(true);
  });

  for (const [label, patch] of [
    ["hash", { sha256Hex: "b".repeat(64) }],
    ["size", { sizeBytes: 41n, headSizeBytes: 41n }],
    ["MIME", { contentType: "image/jpeg" }],
    ["ETag", { etag: null }],
  ] as const) {
    it(`fails closed when observed ${label} does not match`, async () => {
      let thrown: unknown;
      try {
        await verifyStoredContentAsset(expected, async () => ({
          contentType: "image/png",
          etag: "etag-1",
          headSizeBytes: 42n,
          sha256Hex: "a".repeat(64),
          sizeBytes: 42n,
          ...patch,
        }));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).to.be.instanceOf(StorageObjectVerificationError);
    });
  }

  it("promotes verified bytes to a key never exposed by presign", () => {
    expect(buildVerifiedStorageKey(expected.storageKey, expected.expectedSha256Hex)).to.equal(
      `content/manifest/v/1/0-declared.verified-${"a".repeat(64)}.png`
    );
    expect(() =>
      assertPromotedObjectMatches(
        { contentType: "image/png", sizeBytes: 42n },
        { contentType: "image/png", etag: "final", sha256Hex: "a".repeat(64), sizeBytes: 42n }
      )
    ).not.to.throw();
  });

  it("recovers a failed video verification through a newly presigned multipart upload", () => {
    expect(
      shouldCompleteMultipartUpload({
        isVideo: true,
        uploadStatus: AssetUploadStatus.FAILED,
      })
    ).to.equal(true);
    expect(
      shouldCompleteMultipartUpload({
        isVideo: true,
        uploadStatus: AssetUploadStatus.UPLOADED,
      })
    ).to.equal(false);
  });

  it("returns a stable storage verification code without exposing provider error details", () => {
    const serialized = serializeAsset({
      id: "asset-1",
      assetType: "IMAGE",
      orderIndex: 0,
      storageKey: "verified/image.png",
      cdnUrl: null,
      uploadStatus: "FAILED",
      processingStatus: "ERRORED",
      muxAssetId: null,
      muxPlaybackId: null,
      muxLastKnownStatus: null,
      storageVerificationError: "HEAD https://secret-endpoint.example?token=secret failed",
      updatedAt: new Date("2026-07-12T00:00:00.000Z"),
    });
    expect(serialized).to.include({
      hasStorageVerificationError: true,
      storageVerificationErrorCode: "STORAGE_VERIFICATION_FAILED",
    });
    expect(JSON.stringify(serialized)).not.to.include("secret-endpoint");
    expect(JSON.stringify(serialized)).not.to.include("token=secret");
  });

  it("keeps an already verified asset only when a repeated presign declaration is identical", () => {
    const asset = {
      assetType: "IMAGE",
      orderIndex: 0,
      sha256Hex: "a".repeat(64),
      mimeType: "image/png",
      fileSizeBytes: 42n,
    };
    expect(
      verifiedAssetMatchesUploadDeclaration({
        asset,
        declaration: {
          assetType: "IMAGE",
          orderIndex: 0,
          sha256HexDigest: "a".repeat(64),
          mimeType: "image/png",
          fileSizeBytes: 42n,
        },
      })
    ).to.equal(true);
    expect(
      verifiedAssetMatchesUploadDeclaration({
        asset,
        declaration: {
          assetType: "IMAGE",
          orderIndex: 0,
          sha256HexDigest: "b".repeat(64),
          mimeType: "image/png",
          fileSizeBytes: 42n,
        },
      })
    ).to.equal(false);
  });

  it("rejects duplicate order indexes before issuing upload plans", () => {
    expect(() => assertUniqueAssetOrderIndexes([{ orderIndex: 0 }, { orderIndex: 0 }]))
      .to.throw(HttpError)
      .with.property("code", "INVALID_INPUT");
    expect(() => assertUniqueAssetOrderIndexes([{ orderIndex: 0 }, { orderIndex: 1 }])).not.to.throw();
  });

  it("serializes budget accounting and rejects a second same-manifest batch over the total", async () => {
    const order: string[] = [];
    await acquirePresignLocks({
      budgetEnabled: true,
      lockBudget: async () => order.push("budget"),
      lockManifest: async () => order.push("manifest"),
    });
    expect(order).to.deep.equal(["budget", "manifest"]);
    expect(() =>
      assertR2MonthlyUploadBudget({ totalBytes: 60n, limitBytes: 100n })
    ).not.to.throw();
    expect(() =>
      assertR2MonthlyUploadBudget({ totalBytes: 110n, limitBytes: 100n })
    ).to.throw(HttpError);
  });

  it("copies verified media from private origin to public delivery then deletes staging", async () => {
    const originalBuckets = {
      origin: config.storage.origin.bucket,
      delivery: config.storage.delivery.bucket,
      publicBaseUrl: config.storage.delivery.publicBaseUrl,
    };
    const originCommands: unknown[] = [];
    const deliveryCommands: unknown[] = [];
    try {
      config.storage.origin.bucket = "private-origin";
      config.storage.delivery.bucket = "public-delivery";
      config.storage.delivery.publicBaseUrl = "https://media.example.com";
      const service = new R2Service({
        originClient: {
          send: async (command: unknown) => {
            originCommands.push(command);
            return {};
          },
        } as never,
        deliveryClient: {
          send: async (command: unknown) => {
            deliveryCommands.push(command);
            return command instanceof HeadObjectCommand
              ? { ContentType: "image/png", ContentLength: 42, ETag: '"delivery-etag"' }
              : {};
          },
        } as never,
      });

      const promoted = await service.promoteVerifiedObject(
        "staging/source.png",
        "verified/final.png",
        "source-etag"
      );
      const copy = deliveryCommands.find(
        (command): command is CopyObjectCommand => command instanceof CopyObjectCommand
      );
      expect(copy?.input.Bucket).to.equal("public-delivery");
      expect(copy?.input.CopySource).to.equal("private-origin/staging/source.png");
      const deleted = originCommands.find(
        (command): command is DeleteObjectCommand => command instanceof DeleteObjectCommand
      );
      expect(deleted?.input).to.deep.include({
        Bucket: "private-origin",
        Key: "staging/source.png",
      });
      expect(promoted.etag).to.equal("delivery-etag");
      expect(service.buildCanonicalUrl("verified/final.png")).to.equal(
        "https://media.example.com/verified/final.png"
      );
    } finally {
      config.storage.origin.bucket = originalBuckets.origin;
      config.storage.delivery.bucket = originalBuckets.delivery;
      config.storage.delivery.publicBaseUrl = originalBuckets.publicBaseUrl;
    }
  });

  it("requires a creator account role for content writes", () => {
    expect(isCreatorAccountProfile({ role: AccountRole.CREATOR })).to.equal(true);
    expect(isCreatorAccountProfile({ role: AccountRole.SPONSOR })).to.equal(false);
    expect(isCreatorAccountProfile(null)).to.equal(false);
  });

  it("accepts platform-matching HTTPS URLs and rejects mismatched or local hosts", () => {
    expect(
      normalizePublicationTarget({
        platform: "x",
        externalUrl: "https://x.com/creator/status/123#proof",
        internalCanonicalUrl: "https://api.streampump.app/content/manifests/m1/v/1",
      })
    ).to.deep.equal({
      platform: "X",
      externalUrl: "https://x.com/creator/status/123",
    });
    expect(
      normalizePublicationTarget({
        platform: "XIAOHONGSHU",
        externalUrl: "https://www.xiaohongshu.com/explore/123",
        internalCanonicalUrl: "https://api.streampump.app/content/manifests/m1/v/1",
      }).platform
    ).to.equal("XIAOHONGSHU");
    for (const externalUrl of [
      "http://x.com/creator/status/123",
      "https://example.com/creator/status/123",
      "https://localhost/proof",
    ]) {
      expect(() =>
        normalizePublicationTarget({
          platform: "X",
          externalUrl,
          internalCanonicalUrl: "https://api.streampump.app/content/manifests/m1/v/1",
        })
      ).to.throw(HttpError);
    }
  });

  it("allows only the exact internal canonical URL for StreamPump publication", () => {
    const localCanonical = "http://127.0.0.1:4000/content/manifests/m1/v/1";
    expect(
      normalizePublicationTarget({
        platform: "STREAMPUMP",
        externalUrl: localCanonical,
        internalCanonicalUrl: localCanonical,
        allowInsecureInternalUrl: true,
      }).externalUrl
    ).to.equal(localCanonical);
    expect(() =>
      normalizePublicationTarget({
        platform: "STREAMPUMP",
        externalUrl: `${localCanonical}/other`,
        internalCanonicalUrl: localCanonical,
        allowInsecureInternalUrl: true,
      })
    ).to.throw(HttpError);
  });

  it("blocks creator self-verification in invite-only mode", () => {
    expect(() => assertCreatorPublicationVerificationAllowed(true))
      .to.throw(HttpError)
      .with.property("code", "OPERATOR_PUBLICATION_REVIEW_REQUIRED");
    expect(() => assertCreatorPublicationVerificationAllowed(false)).not.to.throw();
    expect(trustedPublicationVerificationWhere(true)).to.deep.equal({
      verificationStatus: PublicationVerificationStatus.VERIFIED,
      verificationSource: "OPERATOR_APPROVED",
    });
  });

  it("builds auditable operator approval and rejection updates", () => {
    const reviewedAt = new Date("2026-07-12T12:00:00.000Z");
    const approved = buildPublicationReviewData({
      decision: "APPROVE",
      reviewer: "operator-wallet",
      note: "proof checked",
      evidenceDigestHex: "c".repeat(64),
      reviewedAt,
    });
    expect(approved.verificationStatus).to.equal(PublicationVerificationStatus.VERIFIED);
    expect(approved.verificationSource).to.equal("OPERATOR_APPROVED");
    expect(approved.verifiedAt).to.equal(reviewedAt);

    const rejected = buildPublicationReviewData({
      decision: "REJECT",
      reviewer: "operator-wallet",
      note: "URL is not controlled by the creator",
      evidenceDigestHex: null,
      reviewedAt,
    });
    expect(rejected.verificationStatus).to.equal(PublicationVerificationStatus.REJECTED);
    expect(rejected.rejectedAt).to.equal(reviewedAt);
    expect(() =>
      buildPublicationReviewData({
        decision: "APPROVE",
        reviewer: "operator-wallet",
        note: null,
        evidenceDigestHex: null,
      })
    ).to.throw(HttpError);
  });
});

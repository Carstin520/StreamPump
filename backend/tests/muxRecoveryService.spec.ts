import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
} from "@prisma/client";
import { expect } from "chai";

import { HttpError } from "../src/controllers/http";
import {
  assertMuxDerivativeRequeueAllowed,
  MuxDerivativeRequeueDependencies,
  requeueMuxDerivative,
} from "../src/services/muxRecoveryService";

const verifiedVideo = () => ({
  id: "asset-1",
  manifestId: "manifest-1",
  assetType: AssetType.VIDEO,
  orderIndex: 0,
  sha256Hex: "a".repeat(64),
  mimeType: "video/mp4",
  fileSizeBytes: 42n,
  storageKey: "verified/video.mp4",
  cdnUrl: "https://media.example/video.mp4",
  uploadStatus: AssetUploadStatus.UPLOADED,
  processingStatus: AssetProcessingStatus.ERRORED,
  processingSource: "MUX_RECONCILIATION",
  processingError: "maximum attempts reached",
  muxAssetId: null,
  muxPlaybackId: null,
  muxLastKnownStatus: "errored",
  muxWebhookReceivedAt: null,
  muxLastCheckedAt: new Date("2026-07-12T10:00:00.000Z"),
  muxReadyAt: null,
  muxReconcileAttempts: 9,
  verifiedSha256Hex: "a".repeat(64),
  verifiedSizeBytes: 42n,
  objectEtag: "etag-1",
  storageVerifiedAt: new Date("2026-07-12T09:00:00.000Z"),
  storageVerificationError: null,
  createdAt: new Date("2026-07-12T08:00:00.000Z"),
  updatedAt: new Date("2026-07-12T10:00:00.000Z"),
  manifest: {
    id: "manifest-1",
    manifestHashHex: "b".repeat(64),
    status: "ANCHORED",
  },
});

describe("Mux derivative recovery", () => {
  it("requeues an errored/no-id derivative without changing verified delivery bytes or manifest truth", async () => {
    const asset = verifiedVideo();
    const events: Array<Record<string, unknown>> = [];
    const syncs: string[] = [];
    const tx = {
      contentAsset: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      pilotOperatorEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return data;
        },
      },
    };
    const dependencies = {
      prisma: {
        contentAsset: { findUnique: async () => asset },
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      },
      syncEligibility: async (manifestId: string) => {
        syncs.push(manifestId);
        return {
          manifestId,
          assetsReady: false,
          hasVerifiedPublication: true,
          publicFeedEligible: false,
          contentPublishedVerifiedAt: null,
        };
      },
    } as unknown as MuxDerivativeRequeueDependencies;

    const result = await requeueMuxDerivative(
      {
        assetId: asset.id,
        operatorIdentity: "operator-wallet",
        reason: "retry failed derivative",
      },
      dependencies
    );

    expect(asset.storageKey).to.equal("verified/video.mp4");
    expect(asset.sha256Hex).to.equal("a".repeat(64));
    expect(asset.verifiedSha256Hex).to.equal("a".repeat(64));
    expect(asset.fileSizeBytes).to.equal(42n);
    expect(asset.manifest.manifestHashHex).to.equal("b".repeat(64));
    expect(asset.processingStatus).to.equal(AssetProcessingStatus.NONE);
    expect(asset.muxReconcileAttempts).to.equal(0);
    expect(asset.processingError).to.equal(null);
    expect(result.publicFeedEligible).to.equal(false);
    expect(syncs).to.deep.equal(["manifest-1"]);
    expect(events).to.have.length(1);
    expect(events[0]).to.include({
      action: "MUX_DERIVATIVE_REQUEUED",
      operatorIdentity: "operator-wallet",
      resourceType: "CONTENT_ASSET",
      resourceId: "asset-1",
    });
  });

  it("fails closed for unverified, non-video, ready, and still-active assets", () => {
    const base = verifiedVideo();
    for (const patch of [
      { storageVerifiedAt: null },
      { assetType: AssetType.IMAGE },
      { processingStatus: AssetProcessingStatus.READY, muxPlaybackId: "playback-1" },
      { processingStatus: AssetProcessingStatus.PROCESSING, muxReconcileAttempts: 1 },
    ]) {
      expect(() => assertMuxDerivativeRequeueAllowed({ ...base, ...patch })).to.throw(HttpError);
    }
  });

  it("allows a non-ready derivative only after it reaches the reconciliation attempt ceiling", () => {
    expect(() =>
      assertMuxDerivativeRequeueAllowed(
        {
          ...verifiedVideo(),
          processingStatus: AssetProcessingStatus.PROCESSING,
          muxReconcileAttempts: 3,
        },
        3
      )
    ).not.to.throw();
  });
});

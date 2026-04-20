import { expect } from "chai";
import {
  AssetProcessingSource,
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
} from "@prisma/client";

import {
  buildMuxReconciliationUpdate,
  shouldAttemptMuxIngest,
  shouldAttemptMuxReconciliation,
} from "../src/services/muxReconciliationService";

describe("muxReconciliationService", () => {
  it("queues uploaded video assets that do not yet have a mux asset", () => {
    const eligible = shouldAttemptMuxIngest({
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.NONE,
      muxAssetId: null,
      muxPlaybackId: null,
      muxReconcileAttempts: 0,
    });

    expect(eligible).to.equal(true);
  });

  it("does not queue mux ingest for images or assets that already have mux metadata", () => {
    const image = shouldAttemptMuxIngest({
      assetType: AssetType.IMAGE,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.NONE,
      muxAssetId: null,
      muxPlaybackId: null,
      muxReconcileAttempts: 0,
    });
    const alreadyQueued = shouldAttemptMuxIngest({
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.PREPARING,
      muxAssetId: "asset_123",
      muxPlaybackId: null,
      muxReconcileAttempts: 0,
    });

    expect(image).to.equal(false);
    expect(alreadyQueued).to.equal(false);
  });

  it("reconciles eligible preparing video assets", () => {
    const eligible = shouldAttemptMuxReconciliation({
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.PREPARING,
      muxAssetId: "asset_123",
      muxPlaybackId: null,
      muxReconcileAttempts: 0,
    });

    expect(eligible).to.equal(true);
  });

  it("skips non-video or already-ready assets", () => {
    const notVideo = shouldAttemptMuxReconciliation({
      assetType: AssetType.IMAGE,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.PREPARING,
      muxAssetId: "asset_123",
      muxPlaybackId: null,
      muxReconcileAttempts: 0,
    });
    const alreadyPlayable = shouldAttemptMuxReconciliation({
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: AssetProcessingStatus.READY,
      muxAssetId: "asset_123",
      muxPlaybackId: "playback_123",
      muxReconcileAttempts: 0,
    });

    expect(notVideo).to.equal(false);
    expect(alreadyPlayable).to.equal(false);
  });

  it("builds a READY patch when Mux reports playback", () => {
    const update = buildMuxReconciliationUpdate({
      muxAssetId: "asset_123",
      status: "ready",
      playbackId: "playback_123",
      errorMessage: null,
    });

    expect(update?.processingStatus).to.equal(AssetProcessingStatus.READY);
    expect(update?.processingSource).to.equal(AssetProcessingSource.MUX_RECONCILIATION);
    expect(update?.muxPlaybackId).to.equal("playback_123");
    expect(update?.processingError).to.equal(null);
  });

  it("builds an ERRORED patch when Mux reports a failure", () => {
    const update = buildMuxReconciliationUpdate({
      muxAssetId: "asset_123",
      status: "errored",
      playbackId: null,
      errorMessage: "transcode failed",
    });

    expect(update?.processingStatus).to.equal(AssetProcessingStatus.ERRORED);
    expect(update?.processingSource).to.equal(AssetProcessingSource.MUX_RECONCILIATION);
    expect(update?.processingError).to.equal("transcode failed");
  });
});

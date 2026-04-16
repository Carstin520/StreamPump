"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const client_1 = require("@prisma/client");
const muxReconciliationService_1 = require("../src/services/muxReconciliationService");
describe("muxReconciliationService", () => {
    it("reconciles eligible preparing video assets", () => {
        const eligible = (0, muxReconciliationService_1.shouldAttemptMuxReconciliation)({
            assetType: client_1.AssetType.VIDEO,
            uploadStatus: client_1.AssetUploadStatus.UPLOADED,
            processingStatus: client_1.AssetProcessingStatus.PREPARING,
            muxAssetId: "asset_123",
            muxPlaybackId: null,
            muxReconcileAttempts: 0,
        });
        (0, chai_1.expect)(eligible).to.equal(true);
    });
    it("skips non-video or already-ready assets", () => {
        const notVideo = (0, muxReconciliationService_1.shouldAttemptMuxReconciliation)({
            assetType: client_1.AssetType.IMAGE,
            uploadStatus: client_1.AssetUploadStatus.UPLOADED,
            processingStatus: client_1.AssetProcessingStatus.PREPARING,
            muxAssetId: "asset_123",
            muxPlaybackId: null,
            muxReconcileAttempts: 0,
        });
        const alreadyPlayable = (0, muxReconciliationService_1.shouldAttemptMuxReconciliation)({
            assetType: client_1.AssetType.VIDEO,
            uploadStatus: client_1.AssetUploadStatus.UPLOADED,
            processingStatus: client_1.AssetProcessingStatus.READY,
            muxAssetId: "asset_123",
            muxPlaybackId: "playback_123",
            muxReconcileAttempts: 0,
        });
        (0, chai_1.expect)(notVideo).to.equal(false);
        (0, chai_1.expect)(alreadyPlayable).to.equal(false);
    });
    it("builds a READY patch when Mux reports playback", () => {
        const update = (0, muxReconciliationService_1.buildMuxReconciliationUpdate)({
            muxAssetId: "asset_123",
            status: "ready",
            playbackId: "playback_123",
            errorMessage: null,
        });
        (0, chai_1.expect)(update?.processingStatus).to.equal(client_1.AssetProcessingStatus.READY);
        (0, chai_1.expect)(update?.processingSource).to.equal(client_1.AssetProcessingSource.MUX_RECONCILIATION);
        (0, chai_1.expect)(update?.muxPlaybackId).to.equal("playback_123");
        (0, chai_1.expect)(update?.processingError).to.equal(null);
    });
    it("builds an ERRORED patch when Mux reports a failure", () => {
        const update = (0, muxReconciliationService_1.buildMuxReconciliationUpdate)({
            muxAssetId: "asset_123",
            status: "errored",
            playbackId: null,
            errorMessage: "transcode failed",
        });
        (0, chai_1.expect)(update?.processingStatus).to.equal(client_1.AssetProcessingStatus.ERRORED);
        (0, chai_1.expect)(update?.processingSource).to.equal(client_1.AssetProcessingSource.MUX_RECONCILIATION);
        (0, chai_1.expect)(update?.processingError).to.equal("transcode failed");
    });
});

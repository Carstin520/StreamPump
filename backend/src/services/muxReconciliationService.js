"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileStaleMuxAssets = exports.reconcileMuxAssetById = exports.buildMuxReconciliationUpdate = exports.shouldAttemptMuxReconciliation = void 0;
/**
 * CN: Mux 补偿服务，主动轮询仍停留在 PREPARING 的视频资产并回写最终状态。
 * EN: Mux reconciliation service that actively polls video assets stuck in PREPARING and writes back the final state.
 */
const client_1 = require("@prisma/client");
const default_1 = require("../../config/default");
const MuxService_1 = require("./MuxService");
const prisma_1 = require("./prisma");
const now = () => new Date();
const resolveErrorMessage = (assetStatus) => assetStatus.errorMessage?.trim() || "Mux asset processing failed";
const shouldAttemptMuxReconciliation = (asset) => {
    if (asset.assetType !== client_1.AssetType.VIDEO) {
        return false;
    }
    if (asset.uploadStatus !== client_1.AssetUploadStatus.UPLOADED) {
        return false;
    }
    if (!asset.muxAssetId) {
        return false;
    }
    if (asset.muxPlaybackId) {
        return false;
    }
    if (asset.processingStatus !== client_1.AssetProcessingStatus.PREPARING &&
        asset.processingStatus !== client_1.AssetProcessingStatus.NONE) {
        return false;
    }
    return asset.muxReconcileAttempts < default_1.config.mux.reconciliation.maxAttempts;
};
exports.shouldAttemptMuxReconciliation = shouldAttemptMuxReconciliation;
const buildMuxReconciliationUpdate = (assetStatus) => {
    const checkedAt = now();
    if (assetStatus.status === "ready") {
        if (!assetStatus.playbackId) {
            return {
                muxLastKnownStatus: assetStatus.status,
                muxLastCheckedAt: checkedAt,
                muxReconcileAttempts: {
                    increment: 1,
                },
                processingStatus: client_1.AssetProcessingStatus.ERRORED,
                processingSource: client_1.AssetProcessingSource.MUX_RECONCILIATION,
                processingError: "Mux ready asset is missing playback_id",
            };
        }
        return {
            muxLastKnownStatus: assetStatus.status,
            muxLastCheckedAt: checkedAt,
            muxReconcileAttempts: {
                increment: 1,
            },
            muxReadyAt: checkedAt,
            muxPlaybackId: assetStatus.playbackId,
            processingStatus: client_1.AssetProcessingStatus.READY,
            processingSource: client_1.AssetProcessingSource.MUX_RECONCILIATION,
            processingError: null,
        };
    }
    if (assetStatus.status === "errored") {
        return {
            muxLastKnownStatus: assetStatus.status,
            muxLastCheckedAt: checkedAt,
            muxReconcileAttempts: {
                increment: 1,
            },
            processingStatus: client_1.AssetProcessingStatus.ERRORED,
            processingSource: client_1.AssetProcessingSource.MUX_RECONCILIATION,
            processingError: resolveErrorMessage(assetStatus),
        };
    }
    return {
        muxLastKnownStatus: assetStatus.status,
        muxLastCheckedAt: checkedAt,
        muxReconcileAttempts: {
            increment: 1,
        },
    };
};
exports.buildMuxReconciliationUpdate = buildMuxReconciliationUpdate;
const reconcileMuxAssetById = async (assetId) => {
    const asset = await prisma_1.prisma.contentAsset.findUnique({
        where: { id: assetId },
    });
    if (!asset) {
        return {
            status: "SKIPPED",
            reason: "asset-not-found",
        };
    }
    if (!(0, exports.shouldAttemptMuxReconciliation)(asset)) {
        return {
            status: "SKIPPED",
            reason: "asset-not-eligible",
        };
    }
    const muxAssetStatus = await MuxService_1.muxService.getAssetStatus(asset.muxAssetId);
    const update = (0, exports.buildMuxReconciliationUpdate)(muxAssetStatus);
    if (!update) {
        return {
            status: "SKIPPED",
            reason: "no-op",
        };
    }
    const updated = await prisma_1.prisma.contentAsset.update({
        where: { id: asset.id },
        data: update,
    });
    if (updated.processingStatus === client_1.AssetProcessingStatus.READY) {
        return {
            status: "READY",
            muxAssetId: updated.muxAssetId,
            playbackId: updated.muxPlaybackId,
            errorMessage: null,
        };
    }
    if (updated.processingStatus === client_1.AssetProcessingStatus.ERRORED) {
        return {
            status: "ERRORED",
            muxAssetId: updated.muxAssetId,
            playbackId: updated.muxPlaybackId,
            errorMessage: updated.processingError,
        };
    }
    return {
        status: "PENDING",
        muxAssetId: updated.muxAssetId,
        playbackId: updated.muxPlaybackId,
        errorMessage: updated.processingError,
    };
};
exports.reconcileMuxAssetById = reconcileMuxAssetById;
const reconcileStaleMuxAssets = async () => {
    const staleBefore = new Date(Date.now() - default_1.config.mux.reconciliation.staleMinutes * 60 * 1000);
    const candidates = await prisma_1.prisma.contentAsset.findMany({
        where: {
            assetType: client_1.AssetType.VIDEO,
            uploadStatus: client_1.AssetUploadStatus.UPLOADED,
            processingStatus: {
                in: [client_1.AssetProcessingStatus.NONE, client_1.AssetProcessingStatus.PREPARING],
            },
            muxAssetId: {
                not: null,
            },
            muxPlaybackId: null,
            muxReconcileAttempts: {
                lt: default_1.config.mux.reconciliation.maxAttempts,
            },
            OR: [
                {
                    muxLastCheckedAt: null,
                },
                {
                    muxLastCheckedAt: {
                        lte: staleBefore,
                    },
                },
            ],
        },
        orderBy: [
            {
                muxLastCheckedAt: "asc",
            },
            {
                updatedAt: "asc",
            },
        ],
        take: default_1.config.mux.reconciliation.batchSize,
    });
    let readyCount = 0;
    let erroredCount = 0;
    let pendingCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    for (const asset of candidates) {
        try {
            const result = await (0, exports.reconcileMuxAssetById)(asset.id);
            if (result.status === "READY") {
                readyCount += 1;
            }
            else if (result.status === "ERRORED") {
                erroredCount += 1;
            }
            else if (result.status === "PENDING") {
                pendingCount += 1;
            }
            else {
                skippedCount += 1;
            }
        }
        catch (error) {
            failureCount += 1;
            await prisma_1.prisma.contentAsset.update({
                where: { id: asset.id },
                data: {
                    muxLastCheckedAt: now(),
                    muxReconcileAttempts: {
                        increment: 1,
                    },
                    processingError: error instanceof Error ? error.message : "Mux reconciliation failed unexpectedly",
                },
            });
        }
    }
    return {
        scanned: candidates.length,
        readyCount,
        erroredCount,
        pendingCount,
        skippedCount,
        failureCount,
    };
};
exports.reconcileStaleMuxAssets = reconcileStaleMuxAssets;

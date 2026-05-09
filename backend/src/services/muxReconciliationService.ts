/**
 * CN: Mux 补偿服务，主动轮询仍停留在 PREPARING 的视频资产并回写最终状态。
 * EN: Mux reconciliation service that actively polls video assets stuck in PREPARING and writes back the final state.
 */
import {
  AssetProcessingSource,
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentAsset,
  Prisma,
} from "@prisma/client";

import { config } from "../../config/default";
import { muxService, NormalizedMuxAssetStatus } from "./MuxService";
import { prisma } from "./prisma";
import { r2Service } from "./R2Service";

type ReconciliationUpdate = Prisma.ContentAssetUpdateInput | null;

export type ReconcileMuxAssetResult =
  | {
      status: "SKIPPED";
      reason: string;
    }
  | {
      status: "READY" | "ERRORED" | "PENDING";
      muxAssetId: string;
      playbackId: string | null;
      errorMessage: string | null;
    };

export type QueueMuxIngestResult =
  | {
      status: "SKIPPED";
      reason: string;
    }
  | {
      status: "PREPARING" | "ERRORED";
      muxAssetId: string | null;
      playbackId: string | null;
      errorMessage: string | null;
    };

const now = (): Date => new Date();

const resolveErrorMessage = (assetStatus: NormalizedMuxAssetStatus): string =>
  assetStatus.errorMessage?.trim() || "Mux asset processing failed";

export const shouldAttemptMuxIngest = (
  asset: Pick<
    ContentAsset,
    | "assetType"
    | "uploadStatus"
    | "processingStatus"
    | "muxAssetId"
    | "muxPlaybackId"
    | "muxReconcileAttempts"
  >
): boolean => {
  if (asset.assetType !== AssetType.VIDEO) {
    return false;
  }

  if (asset.uploadStatus !== AssetUploadStatus.UPLOADED) {
    return false;
  }

  if (asset.muxAssetId || asset.muxPlaybackId) {
    return false;
  }

  if (
    asset.processingStatus !== AssetProcessingStatus.NONE &&
    asset.processingStatus !== AssetProcessingStatus.ERRORED
  ) {
    return false;
  }

  return asset.muxReconcileAttempts < config.mux.reconciliation.maxAttempts;
};

export const shouldAttemptMuxReconciliation = (asset: Pick<
  ContentAsset,
  | "assetType"
  | "uploadStatus"
  | "processingStatus"
  | "muxAssetId"
  | "muxPlaybackId"
  | "muxReconcileAttempts"
>): boolean => {
  if (asset.assetType !== AssetType.VIDEO) {
    return false;
  }

  if (asset.uploadStatus !== AssetUploadStatus.UPLOADED) {
    return false;
  }

  if (!asset.muxAssetId) {
    return false;
  }

  if (asset.muxPlaybackId) {
    return false;
  }

  if (
    asset.processingStatus !== AssetProcessingStatus.PREPARING &&
    asset.processingStatus !== AssetProcessingStatus.NONE
  ) {
    return false;
  }

  return asset.muxReconcileAttempts < config.mux.reconciliation.maxAttempts;
};

export const buildMuxReconciliationUpdate = (
  assetStatus: NormalizedMuxAssetStatus
): ReconciliationUpdate => {
  const checkedAt = now();

  if (assetStatus.status === "ready") {
    if (!assetStatus.playbackId) {
      return {
        muxLastKnownStatus: assetStatus.status,
        muxLastCheckedAt: checkedAt,
        muxReconcileAttempts: {
          increment: 1,
        },
        processingStatus: AssetProcessingStatus.ERRORED,
        processingSource: AssetProcessingSource.MUX_RECONCILIATION,
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
      processingStatus: AssetProcessingStatus.READY,
      processingSource: AssetProcessingSource.MUX_RECONCILIATION,
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
      processingStatus: AssetProcessingStatus.ERRORED,
      processingSource: AssetProcessingSource.MUX_RECONCILIATION,
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

export const reconcileMuxAssetById = async (assetId: string): Promise<ReconcileMuxAssetResult> => {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    return {
      status: "SKIPPED",
      reason: "asset-not-found",
    };
  }

  if (!shouldAttemptMuxReconciliation(asset)) {
    return {
      status: "SKIPPED",
      reason: "asset-not-eligible",
    };
  }

  const muxAssetStatus = await muxService.getAssetStatus(asset.muxAssetId as string);
  const update = buildMuxReconciliationUpdate(muxAssetStatus);

  if (!update) {
    return {
      status: "SKIPPED",
      reason: "no-op",
    };
  }

  const updated = await prisma.contentAsset.update({
    where: { id: asset.id },
    data: update,
  });

  if (updated.processingStatus === AssetProcessingStatus.READY) {
    return {
      status: "READY",
      muxAssetId: updated.muxAssetId as string,
      playbackId: updated.muxPlaybackId,
      errorMessage: null,
    };
  }

  if (updated.processingStatus === AssetProcessingStatus.ERRORED) {
    return {
      status: "ERRORED",
      muxAssetId: updated.muxAssetId as string,
      playbackId: updated.muxPlaybackId,
      errorMessage: updated.processingError,
    };
  }

  return {
    status: "PENDING",
    muxAssetId: updated.muxAssetId as string,
    playbackId: updated.muxPlaybackId,
    errorMessage: updated.processingError,
  };
};

export const ingestUploadedVideoAssetById = async (
  assetId: string
): Promise<QueueMuxIngestResult> => {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    return {
      status: "SKIPPED",
      reason: "asset-not-found",
    };
  }

  if (!shouldAttemptMuxIngest(asset)) {
    return {
      status: "SKIPPED",
      reason: "asset-not-eligible",
    };
  }

  try {
    const downloadUrl = await r2Service.generateDownloadUrl(asset.storageKey, 3600);
    const muxAssetId = await muxService.createAsset(downloadUrl);
    const updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        processingStatus: AssetProcessingStatus.PREPARING,
        processingSource: AssetProcessingSource.MUX_RECONCILIATION,
        muxAssetId,
        muxLastKnownStatus: "created",
        muxLastCheckedAt: null,
        muxReadyAt: null,
        processingError: null,
        muxReconcileAttempts: 0,
      },
    });

    return {
      status: "PREPARING",
      muxAssetId: updated.muxAssetId,
      playbackId: updated.muxPlaybackId,
      errorMessage: null,
    };
  } catch (error) {
    const updated = await prisma.contentAsset.update({
      where: { id: asset.id },
      data: {
        processingStatus: AssetProcessingStatus.ERRORED,
        processingSource: AssetProcessingSource.MUX_RECONCILIATION,
        muxLastKnownStatus: "errored",
        muxLastCheckedAt: now(),
        muxReconcileAttempts: {
          increment: 1,
        },
        processingError:
          error instanceof Error ? error.message : "failed to create mux asset",
      },
    });

    return {
      status: "ERRORED",
      muxAssetId: updated.muxAssetId,
      playbackId: updated.muxPlaybackId,
      errorMessage: updated.processingError,
    };
  }
};

export const ingestQueuedMuxAssets = async () => {
  const candidates = await prisma.contentAsset.findMany({
    where: {
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: {
        in: [AssetProcessingStatus.NONE, AssetProcessingStatus.ERRORED],
      },
      muxAssetId: null,
      muxPlaybackId: null,
      muxReconcileAttempts: {
        lt: config.mux.reconciliation.maxAttempts,
      },
    },
    orderBy: [
      {
        updatedAt: "asc",
      },
    ],
    take: config.mux.reconciliation.batchSize,
  });

  let preparingCount = 0;
  let erroredCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (const asset of candidates) {
    try {
      const result = await ingestUploadedVideoAssetById(asset.id);
      if (result.status === "PREPARING") {
        preparingCount += 1;
      } else if (result.status === "ERRORED") {
        erroredCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failureCount += 1;
      await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          processingStatus: AssetProcessingStatus.ERRORED,
          processingSource: AssetProcessingSource.MUX_RECONCILIATION,
          muxLastKnownStatus: "errored",
          muxLastCheckedAt: now(),
          muxReconcileAttempts: {
            increment: 1,
          },
          processingError:
            error instanceof Error ? error.message : "Mux ingest failed unexpectedly",
        },
      });
    }
  }

  return {
    scanned: candidates.length,
    preparingCount,
    erroredCount,
    skippedCount,
    failureCount,
  };
};

export const reconcileStaleMuxAssets = async () => {
  const staleBefore = new Date(
    Date.now() - config.mux.reconciliation.staleMinutes * 60 * 1000
  );
  const candidates = await prisma.contentAsset.findMany({
    where: {
      assetType: AssetType.VIDEO,
      uploadStatus: AssetUploadStatus.UPLOADED,
      processingStatus: {
        in: [AssetProcessingStatus.NONE, AssetProcessingStatus.PREPARING],
      },
      muxAssetId: {
        not: null,
      },
      muxPlaybackId: null,
      muxReconcileAttempts: {
        lt: config.mux.reconciliation.maxAttempts,
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
    take: config.mux.reconciliation.batchSize,
  });

  let readyCount = 0;
  let erroredCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (const asset of candidates) {
    try {
      const result = await reconcileMuxAssetById(asset.id);
      if (result.status === "READY") {
        readyCount += 1;
      } else if (result.status === "ERRORED") {
        erroredCount += 1;
      } else if (result.status === "PENDING") {
        pendingCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failureCount += 1;
      await prisma.contentAsset.update({
        where: { id: asset.id },
        data: {
          muxLastCheckedAt: now(),
          muxReconcileAttempts: {
            increment: 1,
          },
          processingError:
            error instanceof Error ? error.message : "Mux reconciliation failed unexpectedly",
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

import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { HttpError } from "../controllers/http";
import { config } from "../../config/default";
import { isAssetStorageVerified } from "./contentStorageVerification";
import { syncManifestPublicationEligibility } from "./contentPublicationEligibility";
import { recordPilotOperatorEvent } from "./pilotOperatorAudit";
import { prisma } from "./prisma";

type MuxRecoveryPrisma = Pick<PrismaClient, "contentAsset" | "$transaction">;

export type MuxDerivativeRequeueDependencies = {
  prisma: MuxRecoveryPrisma;
  syncEligibility: typeof syncManifestPublicationEligibility;
};

const defaultDependencies: MuxDerivativeRequeueDependencies = {
  prisma,
  syncEligibility: syncManifestPublicationEligibility,
};

export const assertMuxDerivativeRequeueAllowed = (asset: {
  assetType: AssetType;
  uploadStatus: AssetUploadStatus;
  processingStatus: AssetProcessingStatus;
  muxPlaybackId: string | null;
  muxReconcileAttempts: number;
  sha256Hex: string;
  fileSizeBytes: bigint;
  verifiedSha256Hex: string | null;
  verifiedSizeBytes: bigint | null;
  storageVerifiedAt: Date | null;
}, maxAttempts = config.mux.reconciliation.maxAttempts): void => {
  if (asset.assetType !== AssetType.VIDEO) {
    throw new HttpError(409, "MUX_REQUEUE_VIDEO_REQUIRED", "only video derivatives can be requeued");
  }
  if (asset.uploadStatus !== AssetUploadStatus.UPLOADED) {
    throw new HttpError(409, "MUX_REQUEUE_UPLOAD_INCOMPLETE", "asset upload must be complete before requeue");
  }
  if (!isAssetStorageVerified(asset)) {
    throw new HttpError(
      409,
      "MUX_REQUEUE_STORAGE_UNVERIFIED",
      "asset bytes must pass backend storage verification before requeue"
    );
  }
  if (
    asset.processingStatus === AssetProcessingStatus.READY ||
    Boolean(asset.muxPlaybackId)
  ) {
    throw new HttpError(409, "MUX_REQUEUE_ALREADY_READY", "a ready Mux derivative cannot be requeued");
  }
  if (
    asset.processingStatus !== AssetProcessingStatus.ERRORED &&
    asset.muxReconcileAttempts < maxAttempts
  ) {
    throw new HttpError(
      409,
      "MUX_REQUEUE_STILL_ACTIVE",
      "asset is still eligible for normal Mux reconciliation and cannot be requeued"
    );
  }
};

export const requeueMuxDerivative = async (
  params: {
    assetId: string;
    operatorIdentity: string;
    reason: string;
  },
  dependencies: MuxDerivativeRequeueDependencies = defaultDependencies
) => {
  const operatorIdentity = params.operatorIdentity.trim();
  const reason = params.reason.trim();
  if (!operatorIdentity) {
    throw new HttpError(500, "OPERATOR_IDENTITY_MISSING", "operator identity is required");
  }
  if (!reason) {
    throw new HttpError(400, "INVALID_INPUT", "reason is required");
  }
  if (reason.length > 1000) {
    throw new HttpError(400, "INVALID_INPUT", "reason must not exceed 1000 characters");
  }

  const asset = await dependencies.prisma.contentAsset.findUnique({
    where: { id: params.assetId },
    include: {
      manifest: {
        select: {
          id: true,
          manifestHashHex: true,
          status: true,
        },
      },
    },
  });
  if (!asset) {
    throw new HttpError(404, "ASSET_NOT_FOUND", "content asset not found");
  }
  assertMuxDerivativeRequeueAllowed(asset);

  const immutableSnapshot = {
    manifestId: asset.manifestId,
    manifestHashHex: asset.manifest.manifestHashHex,
    manifestStatus: asset.manifest.status,
    storageKey: asset.storageKey,
    sha256Hex: asset.sha256Hex,
    fileSizeBytes: asset.fileSizeBytes.toString(),
    verifiedSha256Hex: asset.verifiedSha256Hex,
    verifiedSizeBytes: asset.verifiedSizeBytes?.toString() ?? null,
    storageVerifiedAt: asset.storageVerifiedAt?.toISOString() ?? null,
  };
  const before = {
    processingStatus: asset.processingStatus,
    processingSource: asset.processingSource,
    muxAssetId: asset.muxAssetId,
    muxPlaybackId: asset.muxPlaybackId,
    muxLastKnownStatus: asset.muxLastKnownStatus,
    muxReconcileAttempts: asset.muxReconcileAttempts,
    processingError: asset.processingError,
  };

  await dependencies.prisma.$transaction(async (tx) => {
    const write = await tx.contentAsset.updateMany({
      where: {
        id: asset.id,
        assetType: AssetType.VIDEO,
        uploadStatus: AssetUploadStatus.UPLOADED,
        processingStatus: { not: AssetProcessingStatus.READY },
        OR: [
          { processingStatus: AssetProcessingStatus.ERRORED },
          { muxReconcileAttempts: { gte: config.mux.reconciliation.maxAttempts } },
        ],
        muxPlaybackId: null,
        storageKey: asset.storageKey,
        sha256Hex: asset.sha256Hex,
        fileSizeBytes: asset.fileSizeBytes,
        verifiedSha256Hex: asset.verifiedSha256Hex,
        verifiedSizeBytes: asset.verifiedSizeBytes,
        storageVerifiedAt: asset.storageVerifiedAt,
      },
      data: {
        processingStatus: AssetProcessingStatus.NONE,
        processingSource: null,
        muxAssetId: null,
        muxPlaybackId: null,
        muxLastKnownStatus: "requeued",
        muxWebhookReceivedAt: null,
        muxLastCheckedAt: null,
        muxReadyAt: null,
        muxReconcileAttempts: 0,
        processingError: null,
      },
    });
    if (write.count !== 1) {
      throw new HttpError(409, "MUX_REQUEUE_CONFLICT", "asset changed while it was being requeued");
    }

    await recordPilotOperatorEvent(tx, {
      action: "MUX_DERIVATIVE_REQUEUED",
      operatorIdentity,
      resourceType: "CONTENT_ASSET",
      resourceId: asset.id,
      reason,
      payload: {
        immutable: immutableSnapshot,
        before,
        after: {
          processingStatus: AssetProcessingStatus.NONE,
          muxAssetId: null,
          muxPlaybackId: null,
          muxLastKnownStatus: "requeued",
          muxReconcileAttempts: 0,
        },
      } as Prisma.InputJsonValue,
    });
  });

  const eligibility = await dependencies.syncEligibility(asset.manifestId);
  return {
    assetId: asset.id,
    manifestId: asset.manifestId,
    immutable: immutableSnapshot,
    processingStatus: AssetProcessingStatus.NONE,
    muxAssetId: null,
    muxPlaybackId: null,
    muxLastKnownStatus: "requeued",
    muxReconcileAttempts: 0,
    publicFeedEligible: eligibility.publicFeedEligible,
  };
};

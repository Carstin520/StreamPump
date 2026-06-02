import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  PublicationVerificationStatus,
} from "@prisma/client";

import { prisma } from "./prisma";

export const isAssetPublicDeliveryReady = (asset: {
  assetType: AssetType;
  uploadStatus: AssetUploadStatus;
  processingStatus: AssetProcessingStatus;
  muxPlaybackId: string | null;
}): boolean => {
  if (asset.uploadStatus !== AssetUploadStatus.UPLOADED) {
    return false;
  }

  if (asset.assetType === AssetType.VIDEO) {
    return asset.processingStatus === AssetProcessingStatus.READY && Boolean(asset.muxPlaybackId);
  }

  return asset.processingStatus === AssetProcessingStatus.READY;
};

const nextManifestStatusAfterPublication = (
  currentStatus: ContentManifestStatus
): ContentManifestStatus =>
  currentStatus === ContentManifestStatus.READY ? ContentManifestStatus.PUBLISHED : currentStatus;

export const syncManifestPublicationEligibility = async (
  manifestId: string
): Promise<{
  manifestId: string;
  assetsReady: boolean;
  hasVerifiedPublication: boolean;
  publicFeedEligible: boolean;
  contentPublishedVerifiedAt: Date | null;
}> => {
  const manifest = await prisma.contentManifest.findUnique({
    where: { id: manifestId },
    include: {
      assets: true,
      publications: {
        where: {
          verificationStatus: PublicationVerificationStatus.VERIFIED,
        },
        orderBy: [
          {
            verifiedAt: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
        take: 1,
      },
    },
  });

  if (!manifest) {
    return {
      manifestId,
      assetsReady: false,
      hasVerifiedPublication: false,
      publicFeedEligible: false,
      contentPublishedVerifiedAt: null,
    };
  }

  const verifiedPublication = manifest.publications[0] ?? null;
  const assetsReady =
    manifest.assets.length > 0 && manifest.assets.every(isAssetPublicDeliveryReady);
  const contentPublishedVerifiedAt = verifiedPublication
    ? (verifiedPublication.verifiedAt ?? verifiedPublication.updatedAt)
    : null;
  const publicFeedEligible = Boolean(assetsReady && contentPublishedVerifiedAt);

  if (!publicFeedEligible) {
    return {
      manifestId,
      assetsReady,
      hasVerifiedPublication: Boolean(verifiedPublication),
      publicFeedEligible: false,
      contentPublishedVerifiedAt,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contentManifest.update({
      where: { id: manifest.id },
      data: {
        isPublicFeedEligible: true,
        publishedAt: manifest.publishedAt ?? contentPublishedVerifiedAt,
        status: nextManifestStatusAfterPublication(manifest.status),
      },
    });

    await tx.proposal.updateMany({
      where: {
        manifestId: manifest.id,
        contentPublishedVerifiedAt: null,
      },
      data: {
        contentPublishedVerifiedAt,
      },
    });
  });

  return {
    manifestId,
    assetsReady,
    hasVerifiedPublication: true,
    publicFeedEligible: true,
    contentPublishedVerifiedAt,
  };
};

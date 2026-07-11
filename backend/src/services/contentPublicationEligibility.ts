import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  Prisma,
  ProposalStatus,
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

export const manifestStatusAfterEligibilitySync = (params: {
  currentStatus: ContentManifestStatus;
  publicFeedEligible: boolean;
  currentAnchorPda: string | null;
}): ContentManifestStatus => {
  if (params.publicFeedEligible && params.currentStatus === ContentManifestStatus.READY) {
    return ContentManifestStatus.PUBLISHED;
  }

  if (!params.publicFeedEligible && params.currentStatus === ContentManifestStatus.PUBLISHED) {
    return params.currentAnchorPda
      ? ContentManifestStatus.ANCHORED
      : ContentManifestStatus.READY;
  }

  return params.currentStatus;
};

export const proposalPublicationEligibilityWhere = (
  manifestId: string,
  publicFeedEligible: boolean
): Prisma.ProposalWhereInput => {
  if (publicFeedEligible) {
    return {
      manifestId,
      contentPublishedVerifiedAt: null,
    };
  }

  return {
    manifestId,
    status: {
      in: [ProposalStatus.OPEN, ProposalStatus.FUNDED],
    },
    track1Claimed: false,
  };
};

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
  const manifestIsFinalized =
    Boolean(
      manifest.manifestHashHex &&
        manifest.internalCanonicalUrl &&
        manifest.internalUrlDigestHex
    ) &&
    manifest.status !== ContentManifestStatus.DRAFT &&
    manifest.status !== ContentManifestStatus.UPLOADING &&
    manifest.status !== ContentManifestStatus.ARCHIVED;
  const publicFeedEligible = Boolean(
    manifestIsFinalized && assetsReady && contentPublishedVerifiedAt
  );

  await prisma.$transaction(async (tx) => {
    await tx.contentManifest.update({
      where: { id: manifest.id },
      data: {
        isPublicFeedEligible: publicFeedEligible,
        publishedAt: publicFeedEligible
          ? (manifest.publishedAt ?? contentPublishedVerifiedAt)
          : manifest.publishedAt,
        status: manifestStatusAfterEligibilitySync({
          currentStatus: manifest.status,
          publicFeedEligible,
          currentAnchorPda: manifest.currentAnchorPda,
        }),
      },
    });

    await tx.proposal.updateMany({
      where: proposalPublicationEligibilityWhere(manifest.id, publicFeedEligible),
      data: {
        contentPublishedVerifiedAt: publicFeedEligible ? contentPublishedVerifiedAt : null,
      },
    });
  });

  return {
    manifestId,
    assetsReady,
    hasVerifiedPublication: Boolean(verifiedPublication),
    publicFeedEligible,
    contentPublishedVerifiedAt,
  };
};

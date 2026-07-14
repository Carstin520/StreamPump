import {
  AssetProcessingStatus,
  AssetType,
  AssetUploadStatus,
  ContentManifestStatus,
  PublicationVerificationStatus,
} from "@prisma/client";

type IntegrityAsset = {
  assetType: AssetType | string;
  uploadStatus: AssetUploadStatus | string;
  processingStatus: AssetProcessingStatus | string;
  sha256Hex: string;
  fileSizeBytes: bigint;
  verifiedSha256Hex?: string | null;
  verifiedSizeBytes?: bigint | null;
  storageVerifiedAt?: Date | null;
  muxPlaybackId?: string | null;
};

type IntegrityPublication = {
  verificationStatus: PublicationVerificationStatus | string;
  verificationSource?: string | null;
  verificationReviewer?: string | null;
  verificationEvidenceDigestHex?: string | null;
  verifiedAt?: Date | null;
};

export type CampaignIntegrityManifest = {
  status: ContentManifestStatus | string;
  manifestHashHex?: string | null;
  internalCanonicalUrl?: string | null;
  internalUrlDigestHex?: string | null;
  currentAnchorPda?: string | null;
  currentAnchorTx?: string | null;
  assets: IntegrityAsset[];
  publications: IntegrityPublication[];
};

export const isOperatorApprovedPublication = (
  publication: IntegrityPublication
): boolean =>
  publication.verificationStatus === PublicationVerificationStatus.VERIFIED &&
  publication.verificationSource === "OPERATOR_APPROVED" &&
  Boolean(
    publication.verificationReviewer &&
      publication.verificationEvidenceDigestHex &&
      publication.verifiedAt
  );

export const isSettlementAssetReady = (asset: IntegrityAsset): boolean => {
  if (
    asset.uploadStatus !== AssetUploadStatus.UPLOADED ||
    asset.processingStatus !== AssetProcessingStatus.READY ||
    !asset.storageVerifiedAt ||
    !asset.verifiedSha256Hex ||
    asset.verifiedSha256Hex.toLowerCase() !== asset.sha256Hex.toLowerCase() ||
    asset.verifiedSizeBytes !== asset.fileSizeBytes
  ) {
    return false;
  }

  return asset.assetType !== AssetType.VIDEO || Boolean(asset.muxPlaybackId);
};

export const buildCampaignIntegrity = (params: {
  contentHashHex: string | null;
  contentAnchorPda: string | null;
  contentAnchorTx: string | null;
  track1Claimed: boolean;
  track2UsdcDeposited: bigint;
  track3UsdcDeposited: bigint;
  latestSettlementTxSignature: string | null;
  manifest: CampaignIntegrityManifest | null;
}) => {
  const manifest = params.manifest;
  const manifestFinalized = Boolean(
    manifest &&
      manifest.manifestHashHex &&
      manifest.internalCanonicalUrl &&
      manifest.internalUrlDigestHex &&
      manifest.status !== ContentManifestStatus.DRAFT &&
      manifest.status !== ContentManifestStatus.UPLOADING &&
      manifest.status !== ContentManifestStatus.ARCHIVED
  );
  const assetsReady = Boolean(
    manifest && manifest.assets.length > 0 && manifest.assets.every(isSettlementAssetReady)
  );
  const operatorApprovedPublication = Boolean(
    manifest && manifest.publications.some(isOperatorApprovedPublication)
  );
  const contentHashMatchesManifest = Boolean(
    manifest?.manifestHashHex &&
      params.contentHashHex &&
      manifest.manifestHashHex.toLowerCase() === params.contentHashHex.toLowerCase()
  );
  const contentAnchorMatchesManifest = Boolean(
    manifest?.currentAnchorPda &&
      params.contentAnchorPda &&
      manifest.currentAnchorPda === params.contentAnchorPda
  );
  const contentAnchorTransactionPresent = Boolean(
    params.contentAnchorTx &&
      manifest?.currentAnchorTx &&
      params.contentAnchorTx === manifest.currentAnchorTx
  );
  const track1OnlyBudget =
    params.track2UsdcDeposited === 0n && params.track3UsdcDeposited === 0n;

  return {
    manifestFinalized,
    assetsReady,
    operatorApprovedPublication,
    contentHashMatchesManifest,
    contentAnchorMatchesManifest,
    contentAnchorTransactionPresent,
    track1OnlyBudget,
    track1SettlementConfirmed: Boolean(
      params.track1Claimed && params.latestSettlementTxSignature
    ),
  };
};

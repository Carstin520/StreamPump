-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('SHORT_VIDEO', 'IMAGE_CAROUSEL', 'MIXED_MEDIA_NOTE');

-- CreateEnum
CREATE TYPE "ContentManifestStatus" AS ENUM ('DRAFT', 'UPLOADING', 'READY', 'LOCKED', 'ANCHORED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO', 'COVER');

-- CreateEnum
CREATE TYPE "AssetUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetProcessingStatus" AS ENUM ('NONE', 'PREPARING', 'READY', 'ERRORED');

-- CreateEnum
CREATE TYPE "PublicationVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProposalIntentStatus" AS ENUM ('DRAFT', 'TERMS_LOCKED', 'BUNDLE_BUILT', 'CREATOR_PARTIALLY_SIGNED', 'SPONSOR_SIGNED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('BUILT', 'PARTIAL', 'FULLY_SIGNED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BundleSubmitMode" AS ENUM ('SERVER_RELAY', 'CLIENT_RELAY');

-- AlterTable
ALTER TABLE "Proposal"
ADD COLUMN "sponsorOrgId" TEXT,
ADD COLUMN "creatorOrgId" TEXT,
ADD COLUMN "manifestId" TEXT,
ADD COLUMN "intentId" TEXT,
ADD COLUMN "contentHashHex" TEXT,
ADD COLUMN "contentAnchorPda" TEXT,
ADD COLUMN "contentAnchorTx" TEXT;

-- CreateTable
CREATE TABLE "ContentManifest" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "status" "ContentManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "captionText" TEXT,
    "captionTextHash" TEXT,
    "tagsJson" JSONB,
    "metadataJson" JSONB,
    "canonicalManifestJson" JSONB,
    "manifestHashHex" TEXT,
    "internalCanonicalUrl" TEXT,
    "internalUrlDigestHex" TEXT,
    "currentAnchorPda" TEXT,
    "currentAnchorTx" TEXT,
    "coverAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "sha256Hex" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "storageKey" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "uploadStatus" "AssetUploadStatus" NOT NULL DEFAULT 'PENDING',
    "processingStatus" "AssetProcessingStatus" NOT NULL DEFAULT 'NONE',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPublication" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalPostIdHash" TEXT,
    "externalUrl" TEXT NOT NULL,
    "externalUrlDigestHex" TEXT NOT NULL,
    "verificationStatus" "PublicationVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationSource" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalIntent" (
    "id" TEXT NOT NULL,
    "status" "ProposalIntentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creatorWallet" TEXT NOT NULL,
    "sponsorWallet" TEXT NOT NULL,
    "sponsorOrgId" TEXT,
    "creatorOrgId" TEXT,
    "manifestId" TEXT NOT NULL,
    "lockedManifestHashHex" TEXT,
    "lockedAnchorPda" TEXT,
    "deadlineUnix" BIGINT NOT NULL,
    "track1BaseUsdc" BIGINT NOT NULL,
    "track2MetricType" "Track2MetricType" NOT NULL,
    "track2TargetValue" BIGINT NOT NULL,
    "track2MinAchievementBps" INTEGER NOT NULL,
    "track3UsdcDeposited" BIGINT NOT NULL,
    "track3DelayDays" INTEGER NOT NULL,
    "plannedProposalPda" TEXT,
    "plannedUsdcVaultPda" TEXT,
    "creatorApprovedAt" TIMESTAMP(3),
    "sponsorApprovedAt" TIMESTAMP(3),
    "chainTxSignature" TEXT,
    "chainSubmittedAt" TIMESTAMP(3),
    "chainConfirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxBundle" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "bundleType" TEXT NOT NULL,
    "instructionPlanJson" JSONB NOT NULL,
    "messageBase64" TEXT,
    "partiallySignedBase64" TEXT,
    "fullySignedBase64" TEXT,
    "recentBlockhash" TEXT,
    "lastValidBlockHeight" BIGINT,
    "requiredSignersJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submitMode" "BundleSubmitMode" NOT NULL,
    "status" "BundleStatus" NOT NULL DEFAULT 'BUILT',
    "chainTxSignature" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_intentId_key" ON "Proposal"("intentId");

-- CreateIndex
CREATE INDEX "Proposal_manifestId_idx" ON "Proposal"("manifestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentManifest_manifestHashHex_key" ON "ContentManifest"("manifestHashHex");

-- CreateIndex
CREATE UNIQUE INDEX "ContentManifest_internalCanonicalUrl_key" ON "ContentManifest"("internalCanonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ContentManifest_currentAnchorPda_key" ON "ContentManifest"("currentAnchorPda");

-- CreateIndex
CREATE INDEX "ContentManifest_creatorWallet_status_idx" ON "ContentManifest"("creatorWallet", "status");

-- CreateIndex
CREATE INDEX "ContentManifest_creatorWallet_version_idx" ON "ContentManifest"("creatorWallet", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_storageKey_key" ON "ContentAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_muxAssetId_key" ON "ContentAsset"("muxAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_muxPlaybackId_key" ON "ContentAsset"("muxPlaybackId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_manifestId_orderIndex_key" ON "ContentAsset"("manifestId", "orderIndex");

-- CreateIndex
CREATE INDEX "ContentAsset_manifestId_assetType_idx" ON "ContentAsset"("manifestId", "assetType");

-- CreateIndex
CREATE INDEX "ContentAsset_uploadStatus_processingStatus_idx" ON "ContentAsset"("uploadStatus", "processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPublication_platform_externalUrl_key" ON "ContentPublication"("platform", "externalUrl");

-- CreateIndex
CREATE INDEX "ContentPublication_manifestId_platform_verificationStatus_idx" ON "ContentPublication"("manifestId", "platform", "verificationStatus");

-- CreateIndex
CREATE INDEX "ProposalIntent_creatorWallet_status_idx" ON "ProposalIntent"("creatorWallet", "status");

-- CreateIndex
CREATE INDEX "ProposalIntent_sponsorWallet_status_idx" ON "ProposalIntent"("sponsorWallet", "status");

-- CreateIndex
CREATE INDEX "ProposalIntent_manifestId_status_idx" ON "ProposalIntent"("manifestId", "status");

-- CreateIndex
CREATE INDEX "TxBundle_intentId_status_idx" ON "TxBundle"("intentId", "status");

-- CreateIndex
CREATE INDEX "TxBundle_expiresAt_status_idx" ON "TxBundle"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ContentManifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ProposalIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ContentManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ContentManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIntent" ADD CONSTRAINT "ProposalIntent_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ContentManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxBundle" ADD CONSTRAINT "TxBundle_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ProposalIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill legacy single-video content into ContentManifest / ContentAsset before dropping VideoContent.
INSERT INTO "ContentManifest" (
    "id",
    "creatorWallet",
    "contentType",
    "status",
    "version",
    "canonicalManifestJson",
    "manifestHashHex",
    "internalCanonicalUrl",
    "currentAnchorTx",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('cm_legacy_', "id"),
    "creatorWallet",
    'SHORT_VIDEO'::"ContentType",
    CASE
        WHEN "uploadStatus" = 'UPLOADED'::"UploadStatus" THEN 'READY'::"ContentManifestStatus"
        ELSE 'UPLOADING'::"ContentManifestStatus"
    END,
    1,
    jsonb_build_object('legacyVideoContentId', "id"),
    "contentHash",
    COALESCE("videoUrl", CONCAT('legacy://video-content/', "id")),
    "onChainAnchorTx",
    "createdAt",
    "updatedAt"
FROM "VideoContent";

INSERT INTO "ContentAsset" (
    "id",
    "manifestId",
    "assetType",
    "orderIndex",
    "sha256Hex",
    "mimeType",
    "fileSizeBytes",
    "durationMs",
    "storageKey",
    "cdnUrl",
    "uploadStatus",
    "processingStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('ca_legacy_', "id"),
    CONCAT('cm_legacy_', "id"),
    'VIDEO'::"AssetType",
    0,
    "contentHash",
    "mimeType",
    "fileSizeBytes",
    CASE
        WHEN "durationSeconds" IS NULL THEN NULL
        ELSE "durationSeconds" * 1000
    END,
    "s3ObjectKey",
    "videoUrl",
    CASE
        WHEN "uploadStatus" = 'UPLOADED'::"UploadStatus" THEN 'UPLOADED'::"AssetUploadStatus"
        WHEN "uploadStatus" = 'FAILED'::"UploadStatus" THEN 'FAILED'::"AssetUploadStatus"
        ELSE 'PENDING'::"AssetUploadStatus"
    END,
    CASE
        WHEN "uploadStatus" = 'UPLOADED'::"UploadStatus" THEN 'READY'::"AssetProcessingStatus"
        ELSE 'NONE'::"AssetProcessingStatus"
    END,
    "createdAt",
    "updatedAt"
FROM "VideoContent";

UPDATE "Proposal" AS p
SET
    "manifestId" = CONCAT('cm_legacy_', v."id"),
    "contentHashHex" = v."contentHash",
    "contentAnchorTx" = v."onChainAnchorTx"
FROM "VideoContent" AS v
WHERE v."proposalId" = p."id";

-- Drop legacy single-video table after backfill.
ALTER TABLE "VideoContent" DROP CONSTRAINT "VideoContent_proposalId_fkey";
DROP TABLE "VideoContent";

-- Drop legacy enum after the table is removed.
DROP TYPE "UploadStatus";

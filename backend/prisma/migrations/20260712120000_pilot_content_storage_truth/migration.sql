-- Pilot content truth: persist server-observed object verification and operator publication review.
ALTER TABLE "ContentAsset"
  ADD COLUMN "verifiedSha256Hex" TEXT,
  ADD COLUMN "verifiedSizeBytes" BIGINT,
  ADD COLUMN "objectEtag" TEXT,
  ADD COLUMN "storageVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "storageVerificationError" TEXT;

ALTER TABLE "ContentPublication"
  ADD COLUMN "verificationReviewer" TEXT,
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "verificationEvidenceDigestHex" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Existing rows were creator self-verifications or had no durable operator evidence.
-- Revoke them fail-closed; an operator must review them again under the Pilot contract.
UPDATE "ContentPublication"
SET
  "verificationStatus" = 'PENDING',
  "verificationSource" = NULL,
  "verifiedAt" = NULL
WHERE "verificationStatus" = 'VERIFIED';

UPDATE "ContentManifest"
SET
  "isPublicFeedEligible" = false,
  "status" = CASE
    WHEN "status" = 'PUBLISHED' AND "currentAnchorPda" IS NOT NULL THEN 'ANCHORED'::"ContentManifestStatus"
    WHEN "status" = 'PUBLISHED' THEN 'READY'::"ContentManifestStatus"
    ELSE "status"
  END
WHERE "isPublicFeedEligible" = true;

UPDATE "Proposal"
SET "contentPublishedVerifiedAt" = NULL
WHERE "status" IN ('OPEN', 'FUNDED')
  AND "track1Claimed" = false;

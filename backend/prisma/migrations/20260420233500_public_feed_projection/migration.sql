ALTER TABLE "ContentManifest"
ADD COLUMN "isPublicFeedEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publicSlug" TEXT,
ADD COLUMN "creatorDisplayName" TEXT,
ADD COLUMN "publicExcerpt" TEXT;

CREATE INDEX "ContentManifest_isPublicFeedEligible_publishedAt_createdAt_idx"
ON "ContentManifest"("isPublicFeedEligible", "publishedAt", "createdAt");

UPDATE "ContentManifest"
SET
  "isPublicFeedEligible" = true,
  "publishedAt" = COALESCE("publishedAt", "updatedAt"),
  "publicSlug" = COALESCE(NULLIF("metadataJson"->'importSource'->>'slug', ''), "publicSlug", "id"),
  "creatorDisplayName" = COALESCE(NULLIF("metadataJson"->>'creatorName', ''), "creatorDisplayName"),
  "publicExcerpt" = COALESCE(NULLIF("metadataJson"->>'excerpt', ''), "publicExcerpt")
WHERE
  "metadataJson"->'importSource'->>'kind' = 'local-post-assets'
  AND "status" IN ('READY', 'ANCHORED', 'PUBLISHED');

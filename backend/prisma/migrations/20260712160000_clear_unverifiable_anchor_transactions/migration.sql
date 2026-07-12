-- Fail closed on historical anchor transaction claims.
--
-- Older launch finalization could copy the funding transaction into currentAnchorTx/contentAnchorTx
-- even when the launch bundle skipped anchor_content_hash for an already-anchored manifest. A
-- transaction signature is retained only when the durable ChainEvent ledger independently proves
-- that the same signature executed anchor_content_hash for the same content-anchor PDA.
--
-- Operational impact: rows without that durable proof lose only the transaction-signature claim.
-- Rebuild inputs (anchor PDA, manifest/content hashes, canonical URL digest, and chain events) remain
-- untouched so an operator/indexer backfill can restore a verified signature later.

UPDATE "ContentManifest" AS manifest
SET "currentAnchorTx" = NULL
WHERE manifest."currentAnchorTx" IS NOT NULL
  AND (
    manifest."currentAnchorPda" IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM "ChainEvent" AS event
      WHERE event."signature" = manifest."currentAnchorTx"
        AND event."instructionName" = 'anchor_content_hash'
        AND event."entityPda" = manifest."currentAnchorPda"
    )
  );

UPDATE "Proposal" AS proposal
SET "contentAnchorTx" = NULL
WHERE proposal."contentAnchorTx" IS NOT NULL
  AND (
    proposal."contentAnchorPda" IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM "ChainEvent" AS event
      WHERE event."signature" = proposal."contentAnchorTx"
        AND event."instructionName" = 'anchor_content_hash'
        AND event."entityPda" = proposal."contentAnchorPda"
    )
  );

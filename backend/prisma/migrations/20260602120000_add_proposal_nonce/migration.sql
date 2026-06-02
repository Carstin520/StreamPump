-- Add Proposal nonce so PDA derivation remains possible after intent cleanup.
ALTER TABLE "Proposal" ADD COLUMN "nonce" BIGINT;

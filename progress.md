# StreamPump Progress Review - 2026-05-23

## Scope
- This review covers the current repository state on `codex/post-deadline-phase-0`.
- `progress.md` did not previously exist, so `docs/progress-review-2026-04.md` was used as the format reference.
- The material current change is the S2 endorsement projection and transaction path reflected by local diffs and the existing roadmap progress ledger.
- Uncommitted changes are treated as user-owned. No protected files were edited.

## Completed Work
- Added a seeded S2 endorsement path that moves `/campaigns/[proposalId]/endorse` beyond local-only preview when a campaign projection is available.
  - The page loads campaign proof data, shows `SEEDED_DEMO` readiness for the live path, builds `endorse_proposal` wallet transactions, and keeps unavailable campaign routes on the labeled `MOCK_PREVIEW` simulator.
- Added backend S2 endorsement transaction builders and relay support.
  - `POST /api/v1/proposals/:id/endorse/build`
  - `POST /api/v1/proposals/:id/endorsement/claim/build`
  - `POST /api/v1/proposals/transactions/submit`
- Added S2 endorsement projection storage and indexing.
  - `S2EndorsementPositionProjection`
  - Track 2 initial fan-pool and initial SPUMP stake snapshot fields on `Proposal`
  - endorse, Track 2 settle, and claim event projection handling
- Added portfolio visibility for S2 endorsements and claim actions where the projection reports a claimable state.
- Updated Anchor Track 2 accounting to snapshot fan-pool and SPUMP stake values at settlement time, reducing claim-order reward drift and preserving last-claimer protection.

## Not Completed Or Blocked
- S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`, not production-ready.
- Promotion still requires applying the new Prisma migration in the target database and deploying/upgrading the Anchor program.
- A wallet-backed devnet endorsement smoke has not been recorded in this progress entry.
- Claim/reward UX is only partially surfaced through portfolio endorsement rows; rewards and broader claim-ledger views remain unfinished.
- Local fallback behavior remains present and must stay clearly labeled as `MOCK_PREVIEW`.

## Backend Alignment
- Backend routes now require session auth for S2 endorse, claim, and submit actions.
- The controller verifies the authenticated wallet is a required signer before relaying a signed transaction.
- Projection sync ingests confirmed transactions after relay and stores endorsement stake, claim status, and estimated USDC reward.
- Public campaign proof includes an endorsement summary derived from indexed projections.

## Frontend Alignment
- `/campaigns/[proposalId]/endorse` distinguishes live seeded campaign projections from local simulator fallback.
- Wallet/provider support is enabled for the endorse page.
- `/portfolio` adds an `S2 Endorsements` tab with staked SPUMP, estimated reward, claim status, and claim action states.

## Chain Alignment
- `Proposal` state now stores Track 2 settlement snapshots for initial fan pool and initial SPUMP stake.
- `Track2Settled` emits those snapshot values.
- `claim_endorsement` uses the locked settlement snapshots for pro-rata reward estimates and caps rewards to remaining Track 2 USDC.

## Documentation Alignment
- `docs/streamPump-long-term-roadmap.md` already contains the matching S2 endorsement readiness and progress ledger updates in the current worktree.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in local diffs:
  - `backend/src/controllers/proposalActionController.ts`
  - `backend/src/routes/v1/proposalRoutes.ts`
  - `backend/src/services/AnchorService.ts`
  - `backend/src/services/marketProjectionService.ts`
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260523185000_s2_endorsement_projection/migration.sql`
  - `programs/streampump-core/src/events.rs`
  - `programs/streampump-core/src/instructions/claim_endorsement.rs`
  - `programs/streampump-core/src/instructions/settle_track2.rs`
  - `programs/streampump-core/src/state.rs`
  - `app/src/pages/campaigns/[proposalId]/endorse.tsx`
  - `app/src/pages/portfolio.tsx`
- Verification already recorded in the roadmap ledger:
  - `npm run prisma:generate --prefix backend`
  - `./node_modules/.bin/prisma format --schema prisma/schema.prisma` from `backend`
  - `npm run build --prefix backend`
  - `npm run test:backend`
  - `npm run build --prefix app`
  - `npm run build:anchor`
  - `scripts/test-anchor-local.sh programs/tests/s2-traffic-market.spec.ts`
  - Playwright/Chrome smoke on `/campaigns/s2-seeded-proof/endorse` with mocked public proof
  - `git diff --check`

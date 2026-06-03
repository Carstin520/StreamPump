# StreamPump Progress Review - 2026-06-03

## Scope
- This review covers material repository changes after the latest existing `progress.md` entry for 2026-05-24 pilot hardening.
- Comparison evidence is local commit range `3ef9b65..7cbd66b`.
- The material current change is P0/P1 hardening across S2 settlement/publication ordering, auth/reward behavior, and managed-wallet custodial signing.
- The working tree already had uncommitted `progress.md` additions before this recorder pass; that content was preserved.
- Untracked prompt/reference docs were observed and treated as user-owned, not as product readiness changes.
- No protected files were edited.

## Completed Work
- Hardened S2 chain and backend settlement behavior.
  - Creator upgrades no longer overwrite active S1 buyout statuses.
  - `emergency_void` rejects already resolved or already voided proposals.
  - Suspended creators get an explicit proposal creation error.
  - Track 1 settlement now waits for the campaign deadline.
  - Endorsement creation emits an event, and uncapped proposals have a protocol-level hard ceiling unless explicitly disabled.
- Improved publication eligibility ordering.
  - A shared backend sync promotes public-feed eligibility only when both requirements are met: all assets are delivery-ready and at least one publication is verified.
  - The sync runs from publication verification, image upload completion, Mux webhook ready events, and Mux reconciliation ready events.
  - Proposal proof publication verification is backfilled from the same eligibility state.
- Tightened operator/internal and projection behavior.
  - Internal Mux routes are operator-auth gated.
  - Proposal intent status reads are participant-gated.
  - Settlement signatures are preserved during non-settlement projection syncs.
  - Proposal nonce and endorsement aggregate data are stored/synced in backend projections.
- Hardened auth, rewards, and managed-wallet flows.
  - Multi-wallet sessions resolve profile data through `AccountWallet`.
  - External wallet binding preserves the existing managed account identity.
  - Daily SPUMP claims apply the on-chain streak bonus.
  - Engagement reward receipt rent and transaction fees are paid by the oracle/backend signer.
  - Managed wallet secret material is encrypted on `AccountWallet`, loadable by backend signing services, and surfaced through a backend-signed `/api/v1/s1/managed/execute` path.
- Updated frontend behavior for the hardened flows.
  - `/rewards` exposes managed daily claim behavior without requiring a wallet adapter for managed accounts.
  - S1 transaction flow supports managed execution for supported actions.
  - Endorsement and portfolio surfaces retain truth-preserving display fixes from the latest hardening pass.

## Not Completed Or Blocked
- No readiness promotion was made.
- S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`.
- Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`.
- Migration `20260602120000_add_proposal_nonce` and the managed-wallet encrypted-secret migration still require approval/application in target databases.
- The upgraded Anchor program still needs deployment before the new chain guards and reward behavior can be promoted.
- Full media promotion still needs deployed R2/Mux smoke and operator visibility for failed/retried assets.
- Managed wallet production readiness still requires KMS/Vault migration, managed wallet recovery/export, SOL budget monitoring, and wallet-backed devnet smoke for daily claim, engagement reward, and endorsement.

## Backend Alignment
- `contentPublicationEligibility` centralizes publication/feed eligibility and proposal publication verification sync.
- Internal Mux routes use shared operator auth middleware.
- S1 managed execution can build, backend-sign, and relay supported managed-wallet reward actions.
- `auth`, `accountProfile`, `managedWalletService`, and `walletEncryption` now preserve managed identity while linking external wallets and encrypting managed wallet secrets.
- Controller and service tests cover wallet encryption, managed wallet loading, S1 managed execution, auth identity linking, and account profile resolution.

## Frontend Alignment
- `/rewards` can call managed daily claim through the S1 API client for managed-wallet users.
- `useS1TransactionFlow` supports managed execution while preserving external-wallet signing behavior.
- `/campaigns/[proposalId]/endorse` keeps endorsement display bounded to seeded/live proof state and corrected USDC formatting.
- `/portfolio` no longer shows mock hero/snapshot panels in the signed-out live branch.

## Chain Alignment
- `ProtocolConfig` includes the endorsement hard-ceiling field.
- `endorse_proposal` enforces the hard ceiling and emits `EndorsementCreated`.
- `settle_track1_base`, `emergency_void`, `upgrade_creator`, and `create_proposal` now enforce the new guardrails.
- Daily SPUMP and engagement reward instructions align with backend/oracle payer behavior.

## Documentation Alignment
- `docs/streamPump-long-term-roadmap.md` already contains matching progress ledger entries for 2026-06-02 and 2026-06-03 in current `HEAD`.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, sponsors remain marketing spenders, DB workflow state remains product truth, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in local commit range `3ef9b65..7cbd66b` include:
  - `app/src/hooks/useManagedWallet.ts`
  - `app/src/hooks/useS1TransactionFlow.ts`
  - `app/src/lib/api/s1.ts`
  - `app/src/pages/campaigns/[proposalId]/endorse.tsx`
  - `app/src/pages/portfolio.tsx`
  - `app/src/pages/rewards.tsx`
  - `backend/src/controllers/contentManifestController.ts`
  - `backend/src/controllers/muxWebhookController.ts`
  - `backend/src/controllers/proposalIntentController.ts`
  - `backend/src/controllers/s1ActionController.ts`
  - `backend/src/middleware/internalOperatorAuth.ts`
  - `backend/src/services/accountProfile.ts`
  - `backend/src/services/auth.ts`
  - `backend/src/services/contentPublicationEligibility.ts`
  - `backend/src/services/managedWalletService.ts`
  - `backend/src/services/walletEncryption.ts`
  - `backend/tests/accountProfileService.spec.ts`
  - `backend/tests/authService.spec.ts`
  - `backend/tests/managedWalletService.spec.ts`
  - `backend/tests/s1ActionController.spec.ts`
  - `backend/tests/walletEncryption.spec.ts`
  - `programs/streampump-core/src/events.rs`
  - `programs/streampump-core/src/instructions/claim_daily_spump.rs`
  - `programs/streampump-core/src/instructions/claim_engagement_reward.rs`
  - `programs/streampump-core/src/instructions/create_proposal.rs`
  - `programs/streampump-core/src/instructions/emergency_void.rs`
  - `programs/streampump-core/src/instructions/endorse_proposal.rs`
  - `programs/streampump-core/src/instructions/settle_track1_base.rs`
  - `programs/streampump-core/src/instructions/upgrade_creator.rs`
  - `programs/streampump-core/src/state.rs`
- Verification recorded in the roadmap ledger:
  - `cargo check`
  - `npx prisma generate`
  - `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/walletEncryption.spec.ts backend/tests/managedWalletService.spec.ts backend/tests/s1ActionController.spec.ts backend/tests/authService.spec.ts backend/tests/accountProfileService.spec.ts`
  - `npm run build --prefix backend`
  - `npm run build --prefix app`
  - Browser smoke on `/campaigns/prop-neo-park-2026q2/endorse` and `/portfolio`
  - `git diff --check`
  - protected-file grep returned no files.
- Recorder verification:
  - `git status --short` showed `progress.md` modified and two untracked docs before this entry was added.
  - `git diff 3ef9b65..HEAD --stat --find-renames` identified 48 changed files after the previous progress entry.

# StreamPump Progress Review - 2026-05-24

## Scope
- This review covers material repository changes after the latest existing `progress.md` entry for S2 design consolidation.
- The working tree already had an uncommitted `progress.md` update before this recorder pass; that content was preserved.
- Comparison evidence is local commit range `5187aab..3ef9b65`.
- The material current change is pilot hardening for S2 proposal intent nonce usage, media/publication eligibility, feed truth, and endorsement settlement copy.
- Uncommitted changes are treated as user-owned. No protected files were edited.

## Completed Work
- Hardened normal proposal intent creation for nonce-based Proposal PDAs.
  - New proposal intents allocate a non-zero nonce before lock/build.
  - Intent serialization now exposes `nonce` and `maxEndorsementSpump`.
  - Lock/build address derivation uses the stored nonce.
- Tightened public-feed eligibility for published content.
  - Publication creation now requires uploaded/ready assets and a verified publication before setting `isPublicFeedEligible`.
  - Pending publication records no longer automatically promote a manifest into the public feed.
- Removed synthesized product/financial signals from public feed-derived creator surfaces.
  - API-mapped posts no longer fabricate likes, saves, or comments.
  - Feed-derived creator records no longer fabricate S1 price, supply, holders, buyout, supporter pool, active campaigns, activity score, or valuation.
  - Creator/trending UI now shows pending/content-only states when market projections are unavailable.
- Aligned S2 endorsement UI with chain settlement semantics.
  - Failed Track 2 campaigns now show 100% SPUMP principal returned and zero fail slash.
  - The 5% SPUMP slash is reserved in copy for cancelled or voided campaigns.
  - Live endorsement action is blocked when the campaign is not `FUNDED` or the deadline has passed.
- Kept Track 3 CPS operator-gated for ordinary proposal creation.
  - Workspace proposal creation submits Track 3 as 0 USDC / 0 days.
  - UI copy states CPS requires merchant reconciliation and controlled operator workflows.

## Not Completed Or Blocked
- No readiness promotion was made.
- S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`.
- Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`.
- Production feed verification still requires backend/R2/Mux configured data and a verified publication flow.
- Devnet wallet-backed S2 endorsement smoke after nonce/cap changes is still not recorded here.
- Applied migrations and deployed/upgraded program state are still required for the latest S2 design changes.

## Backend Alignment
- `createProposalIntent` now allocates and stores nonce and optional max endorsement cap values.
- `lockProposalIntent` derives planned Proposal/vault PDAs with creator, deadline, and nonce.
- Content publication state now respects media readiness and publication verification before feed eligibility.
- Controller tests cover nonce/cap serialization and nonce-aware address derivation.

## Frontend Alignment
- `/workspace/content/[manifestId]` no longer exposes ordinary Track 3 CPS input and labels CPS as operator-gated.
- `/campaigns/[proposalId]/endorse` now displays fail refund/slash semantics consistent with the chain model and blocks closed live endorsement states.
- `/explore`, `/trending`, `/posts/[postId]`, and creator-derived surfaces no longer present fabricated engagement or S1 market numbers as product truth.

## Chain Alignment
- No new Anchor program change is part of commit `3ef9b65`.
- This pass wires the backend/frontend normal path to the nonce-based Proposal PDA semantics introduced by the previous S2 design consolidation work.

## Documentation Alignment
- `docs/streamPump-long-term-roadmap.md` already contains the matching 2026-05-24 progress ledger entry in the current `HEAD`.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, sponsors remain marketing spenders, DB workflow state remains product truth, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in local commit range `5187aab..3ef9b65`:
  - `app/src/components/user/CreatorStageView.tsx`
  - `app/src/components/user/PostCard.tsx`
  - `app/src/components/user/TrendingTabs.tsx`
  - `app/src/hooks/usePublicFeedViewModel.ts`
  - `app/src/lib/api/feed.ts`
  - `app/src/lib/api/workspace.ts`
  - `app/src/lib/i18n.tsx`
  - `app/src/pages/campaigns/[proposalId]/endorse.tsx`
  - `app/src/pages/workspace/content/[manifestId].tsx`
  - `backend/src/controllers/contentManifestController.ts`
  - `backend/src/controllers/proposalIntentController.ts`
  - `backend/src/controllers/proposalIntentShared.ts`
  - `backend/tests/proposalIntentController.spec.ts`
  - `backend/tests/proposalLaunchService.spec.ts`
  - `docs/streamPump-long-term-roadmap.md`
- Verification recorded in the roadmap ledger:
  - `npm run build --prefix backend`
  - `npm run build --prefix app`
  - `npx ts-mocha -p backend/tsconfig.test.json backend/tests/proposalIntentController.spec.ts backend/tests/proposalLaunchService.spec.ts backend/tests/s2EndorsementProjection.spec.ts`
  - `git diff --check`
  - Playwright fallback smoke on `/campaigns/prop-neo-park-2026q2/endorse` confirmed the fail path shows 100% SPUMP returned and 0 fail slash.
- Recorder verification:
  - `git status --short` showed only `progress.md` modified before this entry was added.
  - `git diff 5187aab..HEAD --stat --find-renames` identified 15 changed files after the previous progress entry.

# StreamPump Progress Review - 2026-05-24

## Scope
- This review covers material repository changes after the latest recorded 2026-05-23 S2 endorsement entry.
- The working tree was clean on `codex/post-deadline-phase-0`.
- Comparison evidence is local commit range `aa31bcd..5187aab`.
- The material current change is S2 design consolidation across Anchor proposal identity, endorsement caps, content anchor versioning, and backend projection schema.
- Uncommitted changes are treated as user-owned. No protected files were edited.

## Completed Work
- Consolidated Proposal PDA identity around a nonce.
  - Anchor proposal, vault signer, claim, cancel, settlement, funding, and emergency paths now derive proposal accounts with creator, deadline, and nonce.
  - Backend proposal intent address derivation and launch bundle creation now carry the proposal nonce.
- Added S2 endorsement guardrails without changing `SPUMP` transferability.
  - Endorsements are restricted to funded proposals.
  - Per-proposal and per-user endorsement caps are enforced before burning SPUMP.
  - Protocol config stores `max_endorsement_per_user_bps`; proposals store `max_endorsement_spump`.
- Refined endorsement settlement semantics.
  - `Resolved_Fail` refunds 100% of endorsed SPUMP principal.
  - Cancelled or voided proposals apply the 5% SPUMP slash instead of punishing failed campaign performance.
- Added content anchor versioning.
  - `anchor_content_hash` can update an existing content anchor for the same creator/url digest and increments a version counter.
  - `ContentAnchored` emits the anchor version.
- Added design/schema support for operational hardening.
  - `CreatorStatus::Suspended`
  - campaign proof fields consolidated onto `Proposal`
  - endorsement aggregate fields on `Proposal`
  - `SponsorReviewEvent` KYB audit trail
  - `AccountWallet` multi-wallet model
  - withdrawal/audit fields on `S2EndorsementPositionProjection`
  - reviewer/fraud audit fields on `Track2Event`

## Not Completed Or Blocked
- S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`; this entry does not promote it to production.
- Promotion still requires applying migration `20260523210000_design_consolidation` in the target database and deploying/upgrading the Anchor program.
- Existing seeded proposal state and DB projections may need regeneration or reconciliation because Proposal PDA seeds now include nonce.
- A wallet-backed devnet endorsement smoke for the nonce/cap path has not been recorded in this progress entry.
- Withdrawal fields on endorsement projections are schema/read-model preparation only unless a real chain/API withdrawal flow is implemented separately.
- Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`; no merchant/reconciliation integration was added.

## Backend Alignment
- Proposal intent lock/build flow now stores and uses nonce plus max endorsement SPUMP cap when deriving the planned proposal PDA.
- Public campaign proof reads proof and endorsement aggregate fields from `Proposal` instead of a separate campaign proof projection record.
- Chain projection and market projection services now track proposal proof status, funding/settlement signatures, endorsement totals, claimed endorsers, and expanded endorsement position state.
- Prisma schema and migration capture the new proposal, wallet, KYB review, endorsement, and Track2 reviewer audit fields.

## Frontend Alignment
- No direct frontend route change was part of the material commit range after the previous progress entry.
- Existing `/campaigns/[proposalId]/endorse` and `/portfolio` S2 endorsement UI remain bounded by the prior `SEEDED_DEMO` + labeled fallback behavior.

## Chain Alignment
- Proposal account seeds now include nonce across creation, funding, cancellation, settlement, claim, and void paths.
- Endorsement burn happens only after amount/cap validation.
- `CreatorStatus::Suspended` gives the program an explicit creator-disabled state for future operator enforcement.
- Content anchors now support versioned updates while preserving creator/url binding.

## Documentation Alignment
- `docs/streamPump-long-term-roadmap.md` was updated with a matching progress ledger entry.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, sponsors remain marketing spenders, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in local commit range `aa31bcd..5187aab`:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260523210000_design_consolidation/migration.sql`
  - `backend/src/controllers/proposalIntentShared.ts`
  - `backend/src/services/AnchorService.ts`
  - `backend/src/services/chainProjectionService.ts`
  - `backend/src/services/marketProjectionService.ts`
  - `backend/src/services/proposalLaunchService.ts`
  - `backend/tests/marketProjectionService.spec.ts`
  - `backend/tests/s2EndorsementProjection.spec.ts`
  - `programs/streampump-core/src/errors.rs`
  - `programs/streampump-core/src/events.rs`
  - `programs/streampump-core/src/instructions/anchor_content_hash.rs`
  - `programs/streampump-core/src/instructions/create_proposal.rs`
  - `programs/streampump-core/src/instructions/endorse_proposal.rs`
  - `programs/streampump-core/src/instructions/claim_endorsement.rs`
  - `programs/streampump-core/src/instructions/settle_track1_base.rs`
  - `programs/streampump-core/src/instructions/settle_track2.rs`
  - `programs/streampump-core/src/instructions/settle_track3_cps.rs`
  - `programs/streampump-core/src/state.rs`
- Recorder verification:
  - `git status --short` showed a clean working tree before edits.
  - `git diff aa31bcd..HEAD --stat --find-renames` identified 24 changed files after the previous progress entry.
  - `git diff --check` passed after documentation edits.
  - App, backend, and Anchor builds/tests were not rerun by this recorder; this was a documentation recording pass.

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

# StreamPump Progress Review - 2026-06-09 Local Startup And Test Harness Follow-Up

## Scope
- This review covers material working-tree changes after the latest existing `progress.md` entry for 2026-06-09 frontend closed-loop actions.
- Comparison evidence is the current uncommitted diff against `894d182`, plus file modification times showing several app/backend changes after the prior progress/roadmap edit.
- The material current change is local operations hardening: backend background-service startup isolation, Mux reconciliation background error logging, local Anchor build/test command adjustments, S2 Anchor test expectation updates, and Next local build/dev configuration tweaks.
- No protected files were edited.

## Completed Work
- Made backend background service startup more failure-isolated.
  - Indexer startup, Mux reconciliation scheduler startup, and oracle scheduler startup now log their own startup failures instead of one failure aborting the full background-service bootstrap.
  - Mux reconciliation cron and run-on-boot calls now route through a background wrapper that logs rejected runs.
- Adjusted local Anchor build/test harness behavior.
  - `npm run test:anchor` now routes through `scripts/test-anchor-local.sh`.
  - The fast Anchor build path defaults to `--no-idl` unless IDL generation is explicitly requested.
  - The local Anchor test wrapper now defaults to all Anchor specs instead of only `s1-guards`.
- Updated S2 Anchor tests and helpers to match current proposal nonce and settlement semantics.
  - Test proposal PDA derivation accepts the nonce seed.
  - Proposal creation calls pass `nonce: 0` where needed.
  - S2 endorsement/refund expectations now distinguish unfunded proposals, failed Track 2 claims, and voided-claim SPUMP return policy.
- Adjusted local Next app execution behavior.
  - App scripts disable Next telemetry.
  - The custom development `distDir` override was removed.
  - An inert middleware matcher was added as a local Next runtime compatibility shim.

## Not Completed Or Blocked
- No production readiness promotion was made.
- Local app, backend, and Anchor builds/tests have been rerun and passed in this follow-up.
- Production readiness is still blocked on deployed Vercel/Render/Neon/R2/Mux smoke, operator visibility, and Track3 merchant/reconciliation integration.

## Backend Alignment
- `backend/src/startup.ts` now treats indexer, Mux reconciliation, and oracle scheduler startup failures independently.
- `backend/src/schedulers/MuxReconciliationScheduler.ts` now catches asynchronous reconciliation run failures from cron and run-on-boot triggers.

## Frontend Alignment
- `app/package.json`, `app/next.config.js`, and `app/middleware.ts` were adjusted for local Next execution only.
- No user-facing frontend route, readiness label, or production claim was changed in this follow-up.

## Chain Alignment
- No Anchor program source change is part of this follow-up.
- Anchor tests and helpers were adjusted around proposal nonce PDA usage and current S2 settlement/claim semantics.

## Documentation Alignment
- `docs/streamPump-long-term-roadmap.md` was updated with a matching progress ledger row.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, sponsors remain marketing spenders, DB workflow state remains product truth, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in the current working-tree diff include:
  - `app/next.config.js`
  - `app/package.json`
  - `app/middleware.ts`
  - `backend/src/schedulers/MuxReconciliationScheduler.ts`
  - `backend/src/startup.ts`
  - `package.json`
  - `programs/tests/helpers/test_context.ts`
  - `programs/tests/phase1-launch-flow.spec.ts`
  - `programs/tests/s2-expired-open-proposal.spec.ts`
  - `programs/tests/s2-traffic-market.spec.ts`
  - `programs/tests/s2-unhappy-path.spec.ts`
  - `scripts/anchor-build-fast.sh`
  - `scripts/test-anchor-local.sh`
- Recorder verification:
  - `git branch --show-current` returned `codex/post-deadline-phase-0`.
  - `git status --short` showed uncommitted app/backend/Anchor/script/docs changes and no protected files.
  - `git diff --stat --find-renames` identified 16 changed tracked files plus untracked `app/middleware.ts`.
  - `git diff --check` passed.
  - `npm run build --prefix app` passed.
  - `npm run build --prefix backend` passed.
  - `npm run test:backend` passed.
  - `cargo check` passed.
  - `npm run build:anchor` passed.
  - `npm run test:anchor` passed.
  - Local runtime smoke confirmed Next dev served `/login`, `/trending`, and `/activity` without framework errors or broken feed media, and backend `/health` plus `/api/v1/feed/posts` responded when the database was reachable.

# StreamPump Progress Review - 2026-06-09

## Scope
- This review covers material repository changes after the latest existing `progress.md` entry for 2026-06-03 managed-wallet custodial signing.
- Comparison evidence is local commit range `7cbd66b..894d182`.
- The material current change is frontend closed-loop wiring for content publication verification, S2 endorsement/claim state, settlement proof display, daily SPUMP claim, and feed media preview stability.
- Uncommitted Anchor/test helper and script changes were observed and treated as user-owned work in progress, not recorded here as completed product progress.
- Stale prompt/reference document cleanup and README refresh commits were noted as documentation alignment, not readiness promotion.
- No protected files were edited.

## Completed Work
- Added normal UI hooks for publication verification and public-feed eligibility visibility.
  - `ContentManifestDetailResponse` now carries `isPublicFeedEligible`.
  - The workspace content detail page can call the publication verification API and refresh manifest state.
  - Content detail now separates verified-publication and asset-delivery readiness before showing public-feed eligibility.
- Extended S2 endorsement UI from submit-only toward closed-loop state.
  - `/campaigns/[proposalId]/endorse` refreshes campaign proof after endorsement actions.
  - The page loads the signed-in user's S2 endorsement projection from portfolio data when available.
  - Managed-wallet endorsement can use backend execution, while external wallets continue through wallet-signed transaction flow.
  - Claimable endorsement rows can build and submit claim transactions after resolved/cancelled/voided states.
- Wired settlement display to campaign proof data when available.
  - `/campaigns/[proposalId]/settlement` attempts to load public campaign proof and maps proof budgets/track markers into the tri-track view.
  - The page keeps local fallback explicitly labeled as `MOCK_PREVIEW`; proof-backed display is labeled `SEEDED_DEMO`.
  - Track3 remains gated by real merchant reconciliation.
- Updated rewards UI around the transaction-wired daily claim path.
  - Daily SPUMP claim now uses the live S1 transaction builder for external-wallet signing and the managed action path for managed wallets.
  - Mission cards, streak progress, and broader rewards ledger remain preview-only.
- Stabilized feed media preview behavior.
  - Fill-mode `ProgressiveImage` instances are eager-loaded to avoid blank media tiles.
  - Activity no longer preserves initial SSR feed errors after client state takes over.
- Cleaned stale duplicate/prompt documentation artifacts and refreshed README status snapshots.

## Not Completed Or Blocked
- No production readiness promotion was made.
- S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` until migration/application, upgraded program deployment, seeded balances/ATAs, and wallet-backed devnet endorsement plus claim smoke are verified.
- Settlement remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED` overall; proof-backed display improves visibility but does not add operator triggers, evidence digests, fraud review, or Track3 merchant reconciliation.
- Rewards are mixed readiness: daily claim is transaction-wired for seeded flows, while missions and the durable reward ledger remain `MOCK_PREVIEW`.
- Full media promotion still requires deployed R2/Mux smoke, webhook/reconciliation visibility, failed-asset recovery controls, and proof that no production claim depends on local fallback.
- Uncommitted Anchor/test helper changes around nonce-based proposal tests and local Anchor script behavior still need their own verification before being recorded.

## Backend Alignment
- No new backend route implementation was added in this commit range.
- Frontend now consumes the existing content publication verification API and S1/proposal transaction APIs more directly.
- The settlement page now derives display state from the public campaign proof API when that projection is available.

## Frontend Alignment
- `/workspace/content/[manifestId]` shows publication verification status, media delivery readiness, and public-feed eligibility blockers.
- `/campaigns/[proposalId]/endorse` supports managed endorsement submission, external-wallet endorsement submission, endorsement projection refresh, and claim transaction submission.
- `/campaigns/[proposalId]/settlement` distinguishes campaign-proof-backed display from mock fallback.
- `/rewards` no longer presents daily claim as browser-local state only; it uses transaction flow while keeping missions preview-labeled.
- `ProgressiveImage` and `ActivitySurface` were adjusted to reduce blank feed media and stale initial error display.

## Chain Alignment
- No Anchor program change is part of the recorded commit range.
- S2 endorsement, claim, settlement, and daily claim UI continue to depend on existing Anchor instructions and upgraded program deployment before promotion.

## Documentation Alignment
- `README.md` and `README.zh-CN.md` were refreshed before this recorder pass to describe the verified corridor and current seeded/operator-gated boundaries.
- Stale duplicate roadmap/prompt/youtube-description artifacts were removed.
- `docs/streamPump-long-term-roadmap.md` was updated with a matching progress ledger row and rewards gap wording.
- Product boundaries are unchanged: `SPUMP` remains non-transferable, S1 positions remain internal virtual positions, sponsors remain marketing spenders, DB workflow state remains product truth, and financial settlement remains Solana/Anchor truth.

## Implemented And Verified
- Implemented paths observed in local commit range `7cbd66b..894d182` include:
  - `app/src/components/auth/AuthOptionsPanel.tsx`
  - `app/src/components/shared/ProgressiveImage.tsx`
  - `app/src/components/user/ActivitySurface.tsx`
  - `app/src/lib/api/workspace.ts`
  - `app/src/pages/campaigns/[proposalId]/endorse.tsx`
  - `app/src/pages/campaigns/[proposalId]/settlement.tsx`
  - `app/src/pages/rewards.tsx`
  - `app/src/pages/workspace/content/[manifestId].tsx`
  - `README.md`
  - `README.zh-CN.md`
- Recorder verification:
  - `git branch --show-current` returned `codex/post-deadline-phase-0`.
  - `git status --short` showed uncommitted Anchor/test helper and script changes before documentation edits; protected files were not present.
  - `git diff 7cbd66b..HEAD --stat --find-renames` identified 15 changed files after the previous progress entry, including documentation cleanup and README refresh.
  - `git diff --check` passed before documentation edits.
  - App, backend, and Anchor builds/tests were not rerun by this recorder; this was a documentation recording pass.

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

# StreamPump Progress Review - 2026-04

## Scope
- This review only covers Git-tracked code as of April 15, 2026.
- Untracked UI work under `app/src` is intentionally excluded from both progress claims and cleanup scope.
- `/explore` is the canonical discovery entry. `/` and `/discover` are now redirect aliases.

## Frontend Completed
- Discovery surface is implemented as a tracked visual prototype.
  - `/explore`
  - `/trending`
  - `/creators/[creatorId]`
  - `/posts/[postId]`
- User profile and portfolio surfaces are implemented as tracked visual shells.
  - `/me`
  - `/portfolio`
- Login and wallet provider scaffolding exist as tracked product entry points.
  - `/login`
  - wallet context and Web3Auth provider shell in `app/src/components/Wallet/*`
- Workspace and campaign detail tracked pages now read real v1 backend endpoints.
  - `/workspace`
  - `/workspace/content/new`
  - `/workspace/content/[manifestId]`
  - `/workspace/intents/[intentId]`
  - `/campaigns/[proposalId]`
  - login preview now creates a real provider-backed Bearer session for tracked frontend testing
- Frontend mock layer has been split by domain and aligned to backend enum names.
  - `app/src/lib/api/types.ts`
  - `app/src/lib/api/client.ts`
  - `app/src/lib/mocks/{discover,workspace,profile,portfolio,auth,activity}.ts`
- Tracked frontend cleanup completed in this round.
  - removed unused prototype files: `Dashboard`, `VideoPlayer`, `useCreatorUpgradePayload`, `useProposalOracleReport`
  - reduced duplicate route maintenance by redirecting `/` and `/discover` to `/explore`
  - lazy-loaded tracked post detail entry points on `/me` and `/posts/[postId]`
  - split large tracked page files by extracting portfolio/profile surface components

## Frontend Not Completed
- Authentication is still a prototype UX, not a production-connected session flow.
  - `/login` now calls `provider-exchange`, but it still uses preview identities instead of real provider token verification
  - wallet login is still preview behavior rather than a real session bootstrap
- Workspace write flows are still incomplete.
  - manifest upload is not connected to presigned upload APIs
  - manifest finalize and publication actions are placeholder buttons
  - intent detail actions are placeholder buttons
- Campaign and proposal surfaces are now backed by the live proposal read endpoint, but public mode still exposes only the restricted projection.
  - creator/sponsor sessions get richer proposal data than public viewers
  - settlement actions are still read-only in tracked frontend
- S1 market product is still prototype-only.
  - real-time creator token pricing is missing
  - holdings, buy, sell, and claim are not connected to backend or chain
  - portfolio remains a mock-driven scenario page
- Mobile shell and refreshed activity/feed surfaces are not in the tracked baseline.
  - tracked `UserShell` still centers on desktop layout
  - tracked activity surface has no tracked route entry
- Production media behavior is unfinished.
  - tracked frontend still uses image/video placeholders and mock playback metadata
  - Mux-backed playback is not surfaced in tracked pages
- One major post detail component exists only in untracked code and was intentionally not modified in this round.
  - `app/src/components/post/PostDetailExperience.tsx`

## Backend And Contract Changes Required

### Must Change
- Keep auth session as the primary v1 gate.
  - v1 mainline should use Bearer session auth, not `x-wallet-address` fallback
  - social provider exchange must resolve into the same StreamPump session shape as wallet login
  - user identity must not be keyed only by wallet address
- Finish the S2 read path and connect frontend to it.
  - `GET /api/v1/content/manifests`
  - `GET /api/v1/content/manifests/:manifestId`
  - `GET /api/v1/proposal-intents`
  - `GET /api/v1/proposal-intents/:intentId`
  - `GET /api/v1/workspace`
  - existing `GET /api/v1/proposal-intents/:intentId/status`
  - existing `GET /api/v1/proposals/:id`
- Keep prototype endpoints out of the mainline contract.
  - legacy `/api/videos`, `/api/users`, `/api/events` now belong under `/api/prototype/*`
  - placeholder oracle settlement endpoints must not remain mounted as pseudo-capabilities
- Keep backend tests local and reproducible.
  - auth tests must not depend on remote Neon
  - v1 read endpoints need dedicated controller coverage

### Recommended
- Indexer and read models should stay explicit about product tiering.
  - current read model is centered on `Proposal` and S2 launch flow
  - S1 market data should be indexed as a separate read model when that product is promoted out of prototype
- Frontend should migrate from mock modules to API adapters incrementally.
  - add per-domain API functions under `app/src/lib/api/*`
  - workspace, manifest detail, intent detail, campaign detail, and preview auth are now on API adapters
  - remaining page-local mock imports should be migrated after the S2 launch path
- Tighten workspace copy and action mapping by session role.
  - creator and sponsor should see the same underlying object with role-specific next actions
  - button availability should follow real `ProposalIntentStatus` instead of static labels

### Deferred
- Contract Tier 2 instructions should remain out of frontend scope until they have tests and projections.
  - `register_user`
  - `claim_daily_spump`
  - `claim_engagement_reward`
  - `create_organization`
  - `add_organization_member`
  - `buy_s1_token`
  - `sell_s1_token`
  - `claim_s1_buyout_usdc`
  - `upgrade_creator`
- Anchor cfg warnings are technical debt, not a release blocker for this round.
- Untracked frontend experiments should be reviewed separately before they are counted as progress.

## Chain Surface Alignment
- Tier 1 contract surface currently validated enough to support backend/mainline planning.
  - `anchor_content_hash`
  - `create_proposal`
  - `sponsor_fund`
  - `settle_track1_base`
  - `settle_track2`
  - `settle_track3_cps`
  - `cancel_proposal`
  - `emergency_void`
  - S1 buyout lifecycle tests
- Tier 2 contract surface exists but is not ready for tracked frontend exposure.
  - missing backend projection support
  - missing frontend entry points
  - missing broad smoke coverage

## Implemented In This Round
- Added provider identity mapping and unified session exchange on backend.
  - `AuthIdentity` Prisma model
  - `POST /api/v1/auth/provider-exchange`
  - session detail now returns linked identity metadata when present
- Added tracked backend read endpoints for S2 workspace flow.
  - content manifest list/detail
  - proposal intent list/detail
  - workspace aggregate
- Moved legacy prototype routes under `/prototype` and removed mounted oracle placeholders.
- Reworked auth tests to use local in-memory Prisma mocks instead of a remote DB.
- Deleted dead tracked frontend and backend files that were no longer part of the active product path.

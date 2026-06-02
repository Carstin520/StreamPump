# StreamPump Product Roadmap

Last updated: 2026-06-02
Post-deadline branch: `codex/post-deadline-phase-0`

This is the compact execution roadmap for moving StreamPump from a hackathon controlled demo to the product promised in `pitch/script.md`: a Web2.5 creator sponsorship market where content, sponsor budgets, fan participation, and Solana settlement form one verifiable loop.

Read with:

- `pitch/script.md`
- `docs/product-readiness-phase-0.md`
- `README.md`
- `DEMO.md`
- `docs/streamPump-page-readiness-goal.md`

## North Star

StreamPump is a creator sponsorship trust layer.

- **Creator**: publishes content, builds momentum, and earns structured sponsorship payouts.
- **Fan / Backer**: supports creators with non-transferable utility `SPUMP`, receives internal S1 positions, and can claim USDC from sponsor-funded outcomes.
- **Sponsor**: spends USDC as marketing budget and receives verifiable campaign proof.

Core flow:

```text
content -> creator momentum -> fan participation -> sponsor USDC budget -> Solana settlement
```

Product boundaries:

- Do not make `SPUMP` transferable.
- Do not list `SPUMP` on DEX/CEX.
- Do not present mock or local preview flows as production integrations.
- Keep workflow state DB-first and financial truth chain-first.

## Implemented Baseline

The following capabilities already exist in the current code on `codex/post-deadline-phase-0`. Future planning should not restate these as new work unless the task is explicitly about hardening, replacing mocks, or production verification.

| Area | Implemented baseline |
| --- | --- |
| Public product shell | Social-first routes exist for explore, trending, post detail, creator profile, activity, profile, onboarding, workspace, campaigns, market, buyout, portfolio, and rewards. |
| Auth entry | `/login` attempts email OTP and wallet challenge APIs; preview social/local fallback is labeled in dev/demo mode. |
| Account profile spine | `/api/v1/account/me` persists a current-session `AccountProfile` for role, display name, handle, and onboarding completion once the Prisma migration is applied. `/onboarding` and `/me` now prefer this session-backed profile over local-only identity fixtures. |
| Content workflow | Workspace content pages call manifest create, R2 presign, browser upload, asset complete, finalize, publication record, and proposal intent APIs. |
| Workspace overview | `/workspace` calls the workspace overview API when authenticated and uses labeled preview fallback when the API/session is unavailable. |
| Proposal intent flow | Intent detail can lock terms, build bundles, collect creator partial signature, collect sponsor signature, and submit via existing APIs and wallet signing. |
| Campaign detail | Campaign detail can load public/auth proposal API data and has known demo fallback records. |
| S1 market and portfolio | Market and portfolio pages read creator profile/portfolio state, build buy/sell/rage-quit/claim transactions, request wallet signatures, submit, and sync projections for seeded paths. |
| Preview labeling | `/login`, `/workspace/buyout`, `/workspace/sponsorships`, demo intent signing, `/campaigns/*/endorse`, `/campaigns/*/settlement`, `/rewards`, and `/portfolio` have readiness labels where needed. |

## Remaining Product Gaps

Status values come from `docs/product-readiness-phase-0.md`.

| Area | Status | Remaining gap |
| --- | --- | --- |
| Auth and managed wallet | `SEEDED_DEMO` + `MOCK_PREVIEW` | AccountProfile API exists for the first production corridor. Remaining work: apply/operate the migration in production, replace preview provider exchange with production OAuth/passkey/Web3Auth verification, and harden stable `AuthIdentity -> managedWalletAddress -> WalletSession` mapping. |
| Media reliability | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Add deployed R2/Mux smoke, webhook/reconciliation visibility, retry/resume UX, publish eligibility rules, and failed-asset recovery. |
| Public feed truth | `LIVE` + `SEEDED_DEMO` | Prevent silent local media fallback in production claims and expose creator market truth on profile/detail surfaces. |
| Workspace truth | `SEEDED_DEMO` | Reduce mock persona fallback and make each panel show live, preview, empty, blocked, or operator-required state explicitly. |
| S1 self-serve | `SEEDED_DEMO` | Add non-seeded creator onboarding, rating provenance, cap usage, projection coverage, and devnet smoke from registration to claim. |
| S1 buyout lifecycle | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Productize offer creation, creator acceptance, graduation, reclaim, post-rage-quit accounting, and re-entry. |
| S2 campaign proof | `SEEDED_DEMO` | Harden role switching, projection reconciliation after Solana confirmation, fallback labeling, and full campaign proof read models. |
| S2 endorsement | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Seeded proposal paths now have chain SPUMP burn/virtual stake, backend builders, endorsement projections, and claim-state projection. Remaining work: apply the migration, deploy the upgraded program, productize claim/reward UI, broaden portfolio views, and keep local fallback labeled. |
| Settlement | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Add operator trigger UI, evidence digests, fraud/review state, guarded schedulers, and real merchant reconciliation for Track3. |
| Rewards | `MOCK_PREVIEW` | Implement real daily SPUMP claim before missions; add anti-abuse gates. |
| Operator/deployment | `OPERATOR_REQUIRED` + `BACKEND_READY_UI_GAP` | Add dashboards for indexer/oracle/media/settlement/retry/fraud plus Vercel/Render/Neon/R2/Mux smoke checks. |

## Next Behavior

The page-readiness audit is complete. The next product behavior should not be another mock cleanup pass. The next step is to make one narrow production corridor real and repeatedly verified:

```text
authenticated creator
-> create/upload/finalize/publish content through R2/Mux/backend
-> post appears in public feed and post detail from backend projection
-> creator can open a real proposal intent from that content
-> campaign detail shows verifiable proof state without local fallback claims
```

This corridor is the correct first landing target because it sits before every money-flow promise:

- Sponsors cannot buy credible campaigns until content publication and campaign proof are reliable.
- S1 creator markets should not open self-serve before identity, creator profile, content eligibility, and projection rules are stable.
- S2 endorsement, settlement, and rewards should not become live until campaign proof and account-specific state exist.
- Operator dashboards need real media/proposal/settlement events to observe.

Immediate engineering behavior:

1. Stop expanding preview surfaces unless they unblock this corridor.
2. Stabilize production auth/session enough for one creator and one sponsor account.
3. Turn media publication from "API exists" into an end-to-end smoke-tested workflow.
4. Make public feed/post/detail consume only backend-projected records for this corridor.
5. Make proposal intent and campaign detail reconcile DB state with Solana confirmation state.
6. Keep readiness labels on every non-corridor mock until its own production gate is met.

## Demo To Production Plan

This is the execution plan for moving from the current controlled demo to a limited production pilot, then to the full StreamPump product. Each milestone must remove a real mock/seed/operator dependency and add verification. Do not promote a milestone by changing copy alone.

### Stage 1: Production Identity And Session Spine

Goal: one user identity model works across creator, fan/backer, and sponsor surfaces.

Current state:

- `/login` can attempt email OTP and wallet auth.
- Preview social/local fallback is labeled but still useful for demos.
- Current product surfaces can still rely on local session/persona assumptions.

Required backend work:

- Define `AuthIdentity`, `ManagedWallet`, and `WalletSession` as the canonical session subject.
- Add provider verification for the chosen first provider path:
  - Recommended first landing path: email OTP + wallet signature.
  - Next providers: Google, Apple, passkey, Web3Auth/embedded wallet.
- Add explicit role/profile records:
  - creator profile;
  - fan/backer profile;
  - sponsor organization/member profile.
- Disable preview provider exchange in production by environment guard.
- Remove production dependence on legacy wallet headers.
- Add audit events for sign-in, wallet binding, session refresh, role switch, and failed auth.

Required frontend work:

- `/login`: show production provider state, preview fallback only in dev/demo mode.
- `/onboarding`: replace local preview with real profile creation and wallet/session binding.
- `/me`: read current-session profile, wallets, saved posts, holdings summary, and rewards summary from APIs.
- Add wallet mismatch states wherever a transaction builder requires a specific wallet.

Third-party requirements:

- Email delivery provider or console-only local mode for development.
- OAuth/Web3Auth/passkey provider when expanding beyond email/wallet.
- Production session secret and secure cookie/session settings.

Verification gate:

- A new user can sign in, bind or confirm a wallet, complete onboarding, reload the app, and keep the same identity.
- Preview social auth is unavailable in production unless explicitly enabled for a demo environment.
- Backend auth build and targeted auth tests pass.
- Browser smoke covers `/login`, `/onboarding`, `/me`, and one wallet-required route.

### Stage 2: Media Publication And Public Feed Reliability

Goal: creator content becomes a reliable product asset instead of a seeded/local fixture.

Current state:

- Workspace content pages call manifest create, R2 presign, browser upload, asset complete, finalize, publication record, and proposal intent APIs.
- Explore/trending/post detail can consume public feed records.
- R2/Mux plumbing exists, but recovery, eligibility, and deployed smoke are incomplete.

Required backend work:

- Add manifest list/detail APIs with stable statuses:
  - draft;
  - uploading;
  - processing;
  - ready;
  - published;
  - failed;
  - archived.
- Add idempotent retry endpoints for failed upload completion, finalize, Mux ingest, and publication record creation.
- Add publication eligibility rules:
  - creator is verified enough;
  - asset upload complete;
  - Mux processing or image variant ready;
  - required metadata present;
  - content is not blocked by review.
- Add media event projection:
  - R2 object key;
  - public/signed URL strategy;
  - Mux asset/playback id;
  - webhook status;
  - last reconciliation attempt;
  - failure reason.
- Add public feed read model that never silently swaps in local seeded content for production claims.

Required frontend work:

- `/workspace/content/new`: make upload retry/resume first-class.
- `/workspace/content/[manifestId]`: show per-asset status, failed asset recovery, finalize/publish eligibility, and proposal blockers.
- `/explore`, `/trending`, `/posts/[postId]`: distinguish backend feed, empty feed, API failure, and demo fallback.
- Creator profile pages should show whether media is live backend content or seeded/demo content.

Third-party requirements:

- Cloudflare R2 bucket, CORS, public base URL or signed URL strategy.
- Mux token, webhook secret, and webhook endpoint.
- Production backend URL reachable by Mux.

Verification gate:

- A real creator account uploads an image and/or short video.
- R2 object is readable through the chosen delivery path.
- Mux webhook or reconciliation moves video to a usable playback state.
- The post appears in `/explore` and `/posts/[postId]` from backend feed APIs.
- No local feed fallback is used in the production smoke.

### Stage 3: Workspace And Proposal Intent Production Corridor

Goal: creator and sponsor can move from real content to a proposal intent and verifiable campaign detail.

Current state:

- Proposal intent detail can lock terms, build bundles, collect signatures, and submit.
- Campaign detail can load API data or seeded fallback.
- Workspace overview has live API wiring but still has preview fallback paths.

Required backend work:

- Make proposal intent state machine explicit:
  - draft;
  - terms_locked;
  - creator_signed;
  - sponsor_signed;
  - submitted;
  - confirmed;
  - failed;
  - expired;
  - cancelled.
- Add role-aware errors:
  - wrong wallet;
  - wrong role;
  - stale bundle;
  - expired intent;
  - missing creator readiness;
  - missing content anchor;
  - relay failure.
- Store Solana transaction signatures, confirmation slot, proposal PDA, vault, manifest hash, and content anchor.
- Add reconciliation job from submitted transaction to confirmed campaign projection.
- Add campaign proof read model for public and authenticated views.

Required frontend work:

- `/workspace`: replace broad preview panels with live empty, blocked, ready, or operator-required panels.
- `/workspace/intents/[intentId]`: remove pasted-signature fallback from normal UX; keep it as dev/operator debug only.
- `/campaigns/[proposalId]`: show proposal PDA, vault, manifest, content anchor, funding, and confirmation state from projection.
- `/workspace/sponsorships`: connect to real proposal/campaign list APIs or keep it explicitly preview-only.

Third-party requirements:

- Reliable Solana RPC provider.
- Wallet adapters for creator/sponsor signature collection.
- Backend relay configuration and key management where required.

Verification gate:

- With two real sessions, creator locks/signs and sponsor final-signs/submits one proposal.
- Campaign detail updates from pending to confirmed through backend projection.
- Wrong-wallet and expired-bundle states are visible and recoverable.
- No mock campaign cards link into fake live intent ids.

### Stage 4: S1 Self-Serve Market

Goal: S1 moves from seeded demo to controlled self-serve creator market.

Current state:

- Market and portfolio pages can read creator/portfolio state and build buy/sell/claim transactions for seeded paths.
- Creator onboarding, rating provenance, cap usage, and full lifecycle projection coverage remain incomplete.

Required backend work:

- Add creator registration/readiness API:
  - creator profile;
  - wallet;
  - content eligibility;
  - S1 status;
  - rating source;
  - cap configuration.
- Add market read API:
  - current price;
  - supply;
  - curve parameters;
  - daily SPUMP cap used/remaining;
  - pending rating and effective time;
  - buyout status;
  - user position state.
- Add projection coverage for:
  - buy;
  - sell;
  - rating update;
  - paused/cancelled market;
  - buyout started;
  - rage quit;
  - graduated;
  - claimed;
  - re-entry rules.
- Add anti-abuse gates for daily utility SPUMP issuance and S1 buying.

Required frontend work:

- `/market/[creatorId]`: show rating provenance, pending rating, cap usage, transaction readiness, and wallet mismatch.
- `/portfolio`: show live holdings, claim windows, rage quit history, claim status, and re-entry eligibility.
- `/creators/[creatorId]`: show real market truth without projection-only labels when live.
- `/rewards`: implement real daily SPUMP claim before mission expansion.

Chain/indexer requirements:

- Confirm S1 events fully cover projection states.
- Add devnet smoke from user registration to S1 buy/sell/portfolio projection.
- Add unhappy-path tests for caps, role guards, insufficient balances, paused markets, and stale ratings.

Verification gate:

- A non-seeded creator can become S1-ready through operator-approved or self-serve flow.
- A user can claim daily SPUMP, buy S1, sell S1, and see portfolio projection update.
- Projection balances match chain events after refresh.

### Stage 5: S1 Buyout Lifecycle Productization

Goal: sponsor buyout is created and completed through product UI, not prepared state.

Current state:

- Protocol/backend builder paths exist.
- UI can show prepared buyout state and demo rage quit/claim flows.
- Offer creation, creator acceptance, graduation, and reclaim are not productized.

Required backend work:

- Add buyout lifecycle APIs:
  - sponsor init offer;
  - sponsor submit/fund offer;
  - creator list/review offers;
  - creator accept offer;
  - open rage quit window;
  - execute graduation;
  - reclaim rejected/expired offers;
  - claim USDC.
- Add operator guardrails:
  - offer validation;
  - minimum/maximum offer;
  - creator eligibility;
  - deadline enforcement;
  - idempotency keys.
- Complete projection for offer, rage quit, graduation, claim, and reclaim states.

Required frontend work:

- `/workspace/buyout`: replace static mock sponsor desk with live offer creation/review.
- `/buyout/[creatorId]`: separate live buyout, local demo, and unavailable states.
- `/portfolio`: make rage quit, claim, and re-entry state consistent after every action.

Chain/indexer requirements:

- Devnet smoke: sponsor offer -> creator accept -> fan rage quit -> graduation -> holder claim -> sponsor/creator final state.
- Unhappy-path tests for expired offer, rejected offer, double claim, late rage quit, insufficient vault, and unauthorized actions.

Verification gate:

- No operator script is required for a happy-path S1 buyout on devnet except initial environment setup.
- The two values that should match after rage quit/claim are derived from one backend projection formula and chain source.

### Stage 6: S2 Endorsement And Fan Rewards

Goal: fan endorsement becomes a real chain/backend flow, not a local simulator.

Current state:

- `/campaigns/[proposalId]/endorse` is `MOCK_PREVIEW`.
- `/rewards` is a local preview.

Required backend work:

- Add endorsement builder:
  - SPUMP burn or lock payload;
  - endorsement PDA;
  - campaign/fan relation;
  - reward pool share.
- Add endorsement projection:
  - pending;
  - confirmed;
  - failed;
  - claimable;
  - claimed.
- Add reward ledger:
  - daily SPUMP issuance;
  - campaign endorsement reward;
  - anti-abuse risk;
  - claim history.

Required frontend work:

- `/campaigns/[proposalId]/endorse`: replace local slider confirmation with wallet-signed transaction flow.
- `/rewards`: show real daily claim, reward ledger, campaign claim state, and abuse/blocked states.
- `/me`: replace preview reward cards with account-specific reward data.

Verification gate:

- Fan endorses a confirmed campaign with SPUMP.
- Endorsement appears in campaign proof and reward ledger.
- Rewards become claimable only after settlement/projection conditions are met.

### Stage 7: Settlement, Oracle, And Reconciliation

Goal: settlement moves from operator/mock dashboard to guarded production operations.

Current state:

- Track1/2 settlement can be smoked with controlled data.
- Track3 remains mock/operator-required.
- Oracle and Mux jobs exist but need observable control surfaces.

Required backend work:

- Track1:
  - operator/manual trigger;
  - publication evidence check;
  - idempotent payout settlement.
- Track2:
  - metric ingestion API;
  - fraud/review status;
  - oracle-signed evidence digest;
  - cliff calculation;
  - creator/endorser split projection.
- Track3:
  - merchant/reconciliation provider abstraction;
  - approved order import;
  - refund/return window;
  - settlement evidence;
  - sponsor refund projection.
- Add settlement job dashboard data:
  - queued;
  - running;
  - succeeded;
  - failed;
  - retryable;
  - blocked by review.

Required frontend work:

- `/campaigns/[proposalId]/settlement`: render only projection-backed track state in production.
- Add operator-only settlement trigger/retry UI.
- Add evidence digest display and fraud/review status.
- Keep Track3 clearly disabled until a real merchant provider exists.

Third-party requirements:

- First metric source for Track2.
- First merchant/reconciliation provider for Track3.
- Optional oracle network integration after operator/manual payloads are stable.

Verification gate:

- Track1 and Track2 settle from projection/evidence without editing local mock data.
- Failed settlement can be retried idempotently.
- Track3 remains gated unless real provider evidence exists.

### Stage 8: Operator, Observability, And Deployment Hardening

Goal: production demos and pilot users are observable and recoverable.

Required work:

- Add operator dashboard or admin routes for:
  - auth/session failures;
  - media upload/Mux/R2 failures;
  - feed publication status;
  - proposal intent state;
  - Solana relay/reconciliation state;
  - S1/S2 projection lag;
  - oracle/settlement jobs;
  - fraud/review queues.
- Add health checks:
  - backend `/health`;
  - DB connection;
  - R2 presign smoke;
  - Mux API/webhook smoke;
  - Solana RPC health;
  - Vercel frontend health;
  - Render backend health.
- Add runbooks:
  - failed media upload;
  - stale proposal intent;
  - failed Solana relay;
  - stuck settlement;
  - incorrect projection;
  - compromised/rotated key.

Verification gate:

- A fresh environment can be deployed and smoke-tested from README/DEMO instructions.
- Operator can identify and resolve at least the top five expected pilot failures without database spelunking.

### Stage 9: Security, Audit, And Pilot Launch

Goal: freeze financial semantics, reduce abuse risk, and prepare controlled users.

Required work:

- Freeze Anchor instruction interface before audit.
- Expand tests:
  - S1 happy/unhappy;
  - S1 buyout lifecycle;
  - S2 proposal launch;
  - S2 endorsement;
  - settlement edge cases;
  - role guards;
  - expired bundles;
  - double claim/refund/reclaim;
  - cap/rate limits.
- Add abuse controls:
  - daily SPUMP claim limits;
  - endorsement spam limits;
  - content upload quotas;
  - sponsor offer throttles;
  - fraud review gates.
- Run pilot acceptance:
  - one creator;
  - one sponsor;
  - three fan/backer accounts;
  - one complete content/proposal/campaign proof path;
  - one S1 market path;
  - one S1 buyout path;
  - one Track1/Track2 settlement path.

Verification gate:

- Two consecutive clean full verification passes:
  - app build;
  - backend build;
  - backend tests;
  - relevant Anchor tests;
  - media smoke;
  - S1 devnet smoke;
  - S2 devnet smoke;
  - deployment health checks.

## Mock Retirement Order

Retire mocks in this order. Each row should end with code, verification, and documentation updates.

| Order | Mock/seeded area | Replace with | Why this order |
| --- | --- | --- | --- |
| 1 | Preview auth/onboarding/profile | Production session spine and account profile APIs | Every production flow needs current-user truth. |
| 2 | Media/feed fallback | R2/Mux-backed publication and public feed projection | Content is the product entry point and sponsor proof base. |
| 3 | Workspace persona fallback | Live workspace overview/list/detail APIs | Creators and sponsors need honest work queues. |
| 4 | Proposal/campaign fallback | Projection-backed proposal and campaign proof | S2 money flows depend on this state. |
| 5 | Rewards mock | Real daily SPUMP and reward ledger | Fan utility must be accountable before endorsement. |
| 6 | S1 seeded market assumptions | Self-serve creator readiness, rating, cap, projection reads | S1 must be fair and explainable before public use. |
| 7 | Prepared buyout state | Live buyout offer/accept/rage quit/graduation/claim lifecycle | This is the highest-stakes S1 financial path. |
| 8 | Endorsement simulator | SPUMP burn/lock, endorsement PDA, reward projection | Depends on campaign proof and reward ledger. |
| 9 | Settlement mock/operator data | Evidence-backed Track1/2 and gated Track3 reconciliation | Final financial truth needs operator-grade auditability. |
| 10 | Prototype/legacy routes | Remove, hide, or relabel as internal | Avoid accidental public claims. |

## Blocker Policy

Stop and report instead of inventing fake production behavior when a task requires:

- OAuth/Web3Auth/passkey dashboard setup;
- production secrets or key rotation;
- Cloudflare R2 bucket/CORS changes;
- Mux webhook configuration;
- paid RPC provider setup;
- Neon production migration approval;
- Vercel/Render dashboard changes;
- real metric provider contract;
- real merchant/reconciliation provider;
- legal/business rules for sponsor offers, creator eligibility, or fraud review.

When blocked, continue only with adjacent safe work:

- improve state visibility;
- add idempotent backend transitions;
- add tests;
- add operator runbook text;
- add dev-only smoke scripts;
- remove misleading copy;
- isolate prototype routes.

## Route Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Current page is labeled; promote only after production provider verification and managed-wallet mapping. |
| `/demo`, `/pitch` | `SEEDED_DEMO` | `/demo` is audited as a boundary-first demo map. `/pitch` is a support/presentation route and must not be used to imply missing financial flows are live. |
| `/workspace` | `SEEDED_DEMO` | Remove or narrow mock persona fallback and improve panel-level readiness. |
| `/workspace/content/new` | `SEEDED_DEMO` | Add retry/resume, deployed R2/Mux smoke documentation, and production media error recovery. |
| `/workspace/content/[manifestId]` | `SEEDED_DEMO` | Add failed asset recovery, clearer S2 readiness blockers, and remaining i18n cleanup. |
| `/workspace/intents/[intentId]` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live route is already API/wallet-wired; next work is role-state polish, fallback labeling, and projection reconciliation. |
| `/workspace/sponsor-onboarding` | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Multi-step Sponsor KYB UI submits backend SponsorProfile records. Promotion requires R2 document upload smoke, operator approval UI, notification delivery, and production migration approval. |
| `/workspace/sponsorships`, `/workspace/buyout`, `/workspace/overview-v2` | `MOCK_PREVIEW` | Sponsorships and buyout are labeled local previews. `overview-v2` is a legacy/experimental workspace entry; remove, hide, or relabel before public product claims. |
| `/campaigns/[proposalId]` | `SEEDED_DEMO` | Can load proposal API or local fallback; add fallback readiness clarity and fuller campaign proof projection. |
| `/campaigns/[proposalId]/endorse` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live campaign proof paths can build/sign/submit `endorse_proposal`; unavailable campaigns still fall back to the labeled local simulator. Remaining work: claim UI, reward-ledger UX, deployed migration/program smoke, and broader portfolio projection display. |
| `/campaigns/[proposalId]/settlement` | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Track data must come from projection and permitted operator/oracle flows. |
| `/rewards` | `MOCK_PREVIEW` | Real daily SPUMP claim before missions. |
| `/portfolio` | `SEEDED_DEMO` | Live portfolio/claim builder exists for seeded state; needs full rage quit/re-entry/projection consistency. |
| `/market/[creatorId]` | `SEEDED_DEMO` | Live buy/sell builders exist; needs non-seeded onboarding, rating provenance, and cap usage. |
| `/buyout/[creatorId]` | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Prepared buyout/rage quit/claim path exists; productize offer, acceptance, graduation, and reclaim. |
| `/creators/[creatorId]`, `/explore`, `/trending`, `/posts/[postId]`, `/activity` | `LIVE` + `SEEDED_DEMO` | Keep social-first; expose real media and creator market states without silent local fallbacks. |
| `/me`, `/onboarding` | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | These routes now read/write AccountProfile for the current session when migrated. Portfolio, rewards, saved content, and activity still use preview/derived records; production DB migration and account-specific ledgers remain required. |

## API / Service Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| Auth/session/account services | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Email/wallet sessions and AccountProfile read/write APIs exist. Remaining work is production provider exchange, managed-wallet mapping hardening, migration rollout, audit events, and preview fallback gating. |
| Sponsor KYB services | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | SponsorProfile schema/API and internal operator review endpoints exist. Remaining work is production R2 credentials/CORS smoke, operator UI, admin auth policy, notification delivery, and migration approval. |
| Feed and media services | `LIVE` + `BACKEND_READY_UI_GAP` | Remaining work is deployed smoke, publication eligibility, and recovery states. |
| Content manifests | `SEEDED_DEMO` | Remaining work is retry/resume, review/eligibility, and Mux reconciliation UX. |
| Proposal intents and bundles | `SEEDED_DEMO` | Remaining work is role-aware errors and Solana confirmation reconciliation hardening. |
| Creator auth signature service | `BACKEND_READY_UI_GAP` | `/api/v1/content/creator-auth-signature` can issue oracle Ed25519 authorization messages for chain `register_creator`. Production promotion requires real Twitter/X OAuth setup, nonce replay persistence, and deployed program upgrade. |
| Campaign projections | `SEEDED_DEMO` | Proposal detail API is used; need complete launch/funding/content-anchor/settlement read models. |
| S2 endorsement routes and projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | `/api/v1/proposals/:id/endorse/build`, `/api/v1/proposals/:id/endorsement/claim/build`, transaction submit, and `S2EndorsementPositionProjection` exist for seeded proposals. Production promotion requires applying the migration, deploying the upgraded program, running a wallet-backed devnet smoke, and exposing claim/reward state in user-facing UI. |
| S1 routes and market projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Buy/sell/rage-quit/claim builders and portfolio/profile reads exist; need full self-serve and lifecycle projection coverage. |
| Oracle/indexer/settlement jobs | `OPERATOR_REQUIRED` | Services exist; need queue/status views, idempotent manual triggers, evidence digests, and scheduler guards. |
| Prototype routes | `MOCK_PREVIEW` | Keep isolated; do not mount as v1 product capability. |

## Roadmap

| Phase | Goal | Primary work |
| --- | --- | --- |
| 1. Production corridor bootstrap | Move the first creator/sponsor path from preview to verifiable product behavior. | Account profile APIs, session-backed onboarding/profile, media/feed smoke, proposal proof reconciliation, and readiness labels for non-corridor mocks. |
| 2. Auth/session | Make identity usable without wallet-first UX. | Production provider verification, passkey/OAuth hardening, managed-wallet mapping, preview fallback gating. |
| 3. Media/feed | Make content a reliable product asset. | Retry/recovery, publish eligibility, Mux reconciliation UX, deployed media smoke, feed proof. |
| 4. S1 lifecycle | Move S1 from seeded demo to self-serve market. | Creator onboarding, rating/cap reads, buyout offer/accept/graduation/reclaim, projection-complete claim/re-entry. |
| 5. S2 lifecycle | Productize sponsorship launch, endorsement, and settlement. | Proposal reconciliation, endorsement PDA/burn, fan claim, Track1/2 operator settlement, Track3 gated reconciliation. |
| 6. Operations/deployment | Make demos and test users observable. | Indexer/oracle/media/settlement dashboards, retry controls, Vercel/Render/Neon/R2/Mux smoke. |
| 7. Audit/growth | Prepare for broader users. | Anchor unhappy-path tests, abuse controls, audit freeze, mobile-critical surfaces, non-speculative growth loops. |

## Execution Rules

Use `docs/streamPump-page-readiness-goal.md` for ongoing page-level work.

- Required branch: `codex/post-deadline-phase-0`.
- Do not modify `main`; it is the frozen hackathon submission branch.
- Protected files: `backend/package-lock.json`, `pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`.
- Use explicit `git add` paths only.
- Pick one page, route, or API surface per pass.
- Do not invent fake integrations or relabel mocks as production.
- Record verification and blockers in the Progress Ledger.

Page order:

```text
/login (audited)
/demo (audited)
/workspace/sponsorships (audited)
/workspace/intents/[intentId] (audited)
/workspace/content/new (audited)
/workspace/content/[manifestId] (audited)
/workspace (audited)
/campaigns/[proposalId] (audited)
/campaigns/[proposalId]/endorse (audited)
/campaigns/[proposalId]/settlement (audited)
/rewards (audited)
/portfolio (audited)
/market/[creatorId] (audited)
/buyout/[creatorId] (audited)
/creators/[creatorId] (audited)
/explore and /trending (audited)
/posts/[postId] (audited)
/activity (audited)
/me and /onboarding (audited)
/pitch (support route)
/workspace/overview-v2 (legacy/experimental route: remove, hide, or relabel)
```

## Verification

| Change type | Minimum checks |
| --- | --- |
| Docs only | `git diff --check`; confirm protected files are not staged. |
| Frontend UI | `npm run build --prefix app`; browser smoke for changed pages when practical. |
| Backend API/service | `npm run build --prefix backend`; targeted tests; broader backend tests when practical. |
| Prisma/schema | Migration review, backend build, affected tests. |
| Chain program | `npm run build:anchor` or `cargo check`; targeted Anchor tests. |
| S1 milestone | S1 local/devnet smoke plus projection/chain consistency check. |
| S2 milestone | S2 launch smoke plus campaign proof/settlement projection check. |
| Media milestone | R2 upload smoke plus Mux webhook/reconciliation smoke. |
| Deployment milestone | Vercel app health, Render `/health`, CORS/API smoke. |

Full acceptance requires two clean passes of app build, backend build, backend tests, relevant Anchor tests, and available devnet smoke checks.

## Progress Ledger

| Date | Scope | Result | Verification | Blockers / next |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Roadmap setup | Created long-term roadmap and page-level `/goal` operating model; deleted the recurring automation. | Docs-only checks before commit. | Continue with page-level audits instead of timed automation. |
| 2026-05-16 | Route/API inventory | Added readiness inventory and linked roadmap from README/DEMO. | Docs-only checks before commit. | Use inventory as the source for future `/goal` passes. |
| 2026-05-16 | `/workspace/buyout` | Labeled static sponsor offer data as `MOCK_PREVIEW`. | `npm run build --prefix app`; local HTTP smoke. | Real buyout offer lifecycle still needs backend/UI productization. |
| 2026-05-16 | `/workspace/sponsorships` and `/workspace/intents/[intentId]?demo=1` | Added readiness banners for mock campaign desk and mock signing states. | `npm run build --prefix app`. | Audit live workspace intent/content routes next. |
| 2026-05-16 | `/login` | Added readiness banner for mixed live wallet/email auth plus preview social/local fallback; moved remaining login hardcoded Chinese copy into i18n. | `npm run build --prefix app`; browser smoke on `/login` with English locale; `git diff --check`. | Production OAuth/Web3Auth verification and managed-wallet mapping remain Phase 2 work. Next page: `/demo`. |
| 2026-05-16 | Roadmap refresh | Recalibrated the roadmap so already implemented baseline work is not repeated as future work, while preserving the long-term product target and remaining gaps. | `git diff --check` passed for updated docs. | Phase 0 readiness remains frozen separately; continue `/goal` with `/demo`. |
| 2026-05-16 | `/demo` | Audited the demo hub and changed it from navigation-only cards into a boundary-first demo map. The page now separates seeded S1/S2 demo paths, operator-prepared buyout/settlement dependencies, and preview-only endorsement/rewards/Track3 surfaces without changing route behavior. | `npm run build --prefix app`; browser smoke on `/demo` confirmed readiness and boundary copy, and confirmed the old navigation-only copy is gone. | `/demo` still depends on seeded/devnet/operator setup for live paths. Next page: `/workspace/sponsorships`. |
| 2026-05-16 | `/workspace/sponsorships` | Tightened the mock sponsorship desk so local fixture data cannot be mistaken for a live proposal console. Header actions are disabled/labeled, mock PDA/proof labels are explicit, and fixture rows no longer link into live intent routes with mock IDs. | `npm run build --prefix app`; browser smoke on `/workspace/sponsorships` confirmed local fixture copy, blocked/preview actions, mock chain labels, and no `/workspace/intents/*` fixture links. | Real sponsorship desk still needs live proposal import/list APIs, operator queue permissions, oracle controls, and settlement actions. Next page: `/workspace/intents/[intentId]`. |
| 2026-05-16 | `/workspace/intents/[intentId]` | Added a live-route readiness banner that distinguishes the API/wallet-wired proposal intent path from the local demo signing route, and relabeled pasted-signature controls as operator/debug fallback for controlled demos and bundle verification. | `npm run build --prefix app`; browser smoke on `/workspace/intents/test-intent` confirmed the `SEEDED_DEMO` live readiness copy, auth gate, and absence of the mock signing banner. | Full happy-path verification still requires an authenticated seeded S2 intent, correct creator/sponsor wallets, backend relay/RPC, and projection reconciliation after confirmation. Next page: `/workspace/content/new`. |
| 2026-05-16 | `/workspace/content/new` | Added readiness labeling for the API/R2-wired content creation path and improved recoverability when manifest creation succeeds but upload, asset completion, or finalize fails. The page now surfaces a recoverable draft link instead of treating post-manifest failures as a total loss. | `npm run build --prefix app`; browser smoke on `/workspace/content/new` confirmed `SEEDED_DEMO` readiness copy, R2 dependency text, auth gate, and no mock-preview label. | Full media milestone still needs authenticated R2/Mux smoke, deployed storage config verification, retry/resume UX beyond content detail recovery, webhook/reconciliation visibility, and failed-asset cleanup. Next page: `/workspace/content/[manifestId]`. |
| 2026-05-16 | `/workspace/content/[manifestId]` | Added readiness labeling for the live content detail/recovery surface, added asset issue/processing recovery visibility, and refreshed manifest state after partial upload failures so successfully completed assets are not hidden by a later failed upload. | `npm run build --prefix app`; browser smoke on `/workspace/content/demo-manifest` confirmed `SEEDED_DEMO` readiness copy, R2/Mux/backend dependency text, auth gate, and no mock-preview label. | Full recovery verification still needs an authenticated manifest with real R2/Mux assets, failed asset fixtures, webhook/reconciliation visibility, and cleanup/delete controls. Next page: `/workspace`. |
| 2026-05-16 | `/workspace` | Added page-level readiness labeling and narrowed live overview behavior so authenticated API responses no longer silently borrow demo content pipeline data when the workspace has no manifests. Live overview claimable balances now defer to detail pages instead of showing seeded demo claim values. | `npm run build --prefix app`; browser smoke on `/workspace` confirmed readiness copy, login-required state, no framework overlay, clean console, and Sign in routing to `/login`. | Workspace still needs production auth/session hardening, operator state visibility, and live claim/settlement projections in the overview API. Next page: `/campaigns/[proposalId]`. |
| 2026-05-16 | `/campaigns/[proposalId]` | Added page-level readiness labeling and explicit data-source messaging for live proposal API reads versus the seeded Colosseum demo fallback. Settlement navigation now says preview, documents the remaining operator/oracle/reconciliation gap, and the English demo heading no longer leaks the Chinese mock creator name. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2` confirmed readiness copy, seeded data-source copy, settlement preview labeling, English heading, no Chinese heading leak in EN mode, no framework overlay, and clean console. | Full campaign proof still needs complete launch/funding/content-anchor/settlement read models and production settlement projections. Next page: `/campaigns/[proposalId]/endorse`. |
| 2026-05-16 | `/campaigns/[proposalId]/endorse` | Clarified the endorsement page as a local simulator: route proposal id is shown only as context, core action labels now say preview/simulating, confirmation copy states no wallet signature, SPUMP burn, endorsement PDA, or backend write occurs, and the English creator name no longer leaks the Chinese fixture label. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2/endorse` confirmed readiness copy, local simulator copy, proposal-id context, preview action labels, English creator name, no Chinese creator leak in EN mode, no framework overlay, clean console, and local confirm/success state. | Real promotion requires SPUMP burn, endorsement PDA creation, reward pool projection, and claim state from backend/indexer. Next page: `/campaigns/[proposalId]/settlement`. |
| 2026-05-17 | `/campaigns/[proposalId]/settlement` | Clarified the settlement page as an operator/mock preview: page title and subtitle no longer claim oracle-resolved live data, route proposal id is shown only as context, Track values are labeled as local mock data, and English mode no longer leaks the Chinese creator fixture name. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2/settlement` confirmed preview title, readiness copy, operator preview copy, proposal-id context, English creator name, no Chinese creator leak in EN mode, no framework overlay, and clean console. | Production promotion needs proposal settlement read models, oracle permission checks, idempotent operator triggers, evidence digests, and Track 3 merchant reconciliation. Next page: `/rewards`. |
| 2026-05-17 | `/rewards` | Clarified the rewards page as a local preview: the daily claim button now uses preview language, fixture mission states are labeled, and a persistent page notice explains that no SPUMP mint, reward ledger, backend claim API, or account balance update occurs. | `npm run build --prefix app`; browser smoke on `/rewards` confirmed readiness copy, persistent mock ledger notice, preview claim interaction, final English title after locale hydration, no framework overlay, and clean console. | Real daily SPUMP claim still needs signed-in account state, anti-abuse controls, backend claim records, and verifiable balance/projection updates. Next page: `/portfolio`. |
| 2026-05-17 | `/portfolio` | Clarified portfolio data-source states across signed-out, backend projection, local demo session, and API fallback modes. Demo portfolio sessions now state that they do not call portfolio APIs, build claim transactions, request wallet signatures, or update balances; claim controls are disabled for non-live sessions, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/portfolio` confirmed signed-out source notice, local demo `MOCK_PREVIEW` source notice, demo portfolio label, claim queue tab interaction, English demo creator label, no framework overlay, and clean console. | Full production readiness still needs non-seeded creator onboarding, complete buyout lifecycle projections after rage quit/graduation/re-entry, and live devnet smoke for claim consistency. Next page: `/market/[creatorId]`. |
| 2026-05-17 | `/market/[creatorId]` | Clarified S1 market data-source states for demo slugs versus backend wallet routes. Demo buy/sell labels now say preview and state that no S1 builder, wallet signature, SPUMP burn, or Solana transaction occurs; live routes no longer treat a local mock portfolio token as a valid trading session, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/market/mika-zhou` confirmed readiness copy, local `MOCK_PREVIEW` source notice, preview buy confirmation copy, local preview interaction updating only page state, English demo creator label, no framework overlay, and clean console. | Full production readiness still needs non-seeded creator onboarding, rating provenance, daily cap usage, projection coverage, and devnet buy/sell smoke beyond demo slug interaction. Next page: `/buyout/[creatorId]`. |
| 2026-05-17 | `/buyout/[creatorId]` | Clarified S1 buyout data-source and action states for demo slugs versus backend wallet routes. Demo rage quit and claim labels now say preview and state that no S1 builder, claim builder, wallet signature, USDC transfer, or Solana transaction occurs; live routes no longer treat a local mock portfolio token as a valid rage quit/claim session, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/buyout/luna-cai` confirmed readiness copy, local `MOCK_PREVIEW` source notice, preview rage quit confirmation copy, local-only position/claimable update, English demo creator label, no framework overlay, and clean console. | Production buyout readiness still needs self-serve offer creation, creator acceptance, graduation execution, reclaim, complete post-rage-quit projections, and devnet smoke beyond local preview interaction. Next page: `/creators/[creatorId]`. |
| 2026-05-17 | `/creators/[creatorId]` | Clarified creator profile data-source states for seeded creator slugs, public-feed-derived profiles, and API fallback. Market-facing labels now use projection/seeded language instead of claiming live on-chain lifecycle, fan token trading, or live buyout offers; the page explains that posts/media can be live while price history, holders, sponsors, and lifecycle remain derived or seeded UI projections. | `npm run build --prefix app`; browser smoke on `/creators/mika-zhou` confirmed readiness copy, seeded creator source notice, seeded market/buyout labels, projection price/lifecycle labels, removal of old live/fan-token/on-chain copy, no framework overlay, and clean console. | Production creator profile readiness still needs creator market read models, rating provenance, daily cap usage, real holder data, R2/Mux media smoke, and projection-backed S1/S2 lifecycle state. Next page: `/explore` and `/trending`. |
| 2026-05-17 | Remaining page audit: `/explore`, `/trending`, `/posts/[postId]`, `/activity`, `/me`, `/onboarding` | Completed the remaining page-level readiness pass. Explore/trending now show public-feed versus fallback source state and label market/ranking numbers as projected. Post detail now has readiness/source notices for both successful public post records and API unavailable/not-found states. Activity now labels feed-derived activity, unread, share, highlight, and video-count projections. Profile now keeps readiness visible even when feed API fails and labels portfolio/reward/watchlist data as local preview fixtures. Onboarding now states that wallet/auth/profile/reward steps are local preview only. | `npm run build --prefix app`; browser smoke covered `/explore`, `/trending`, `/posts/post-f1-aesthetics`, `/activity`, `/me`, and `/onboarding`; `/onboarding` `Preview Wallet Setup` advanced to role selection; no framework overlay. Console showed only Next dev HMR ISR-manifest warnings during local dev navigation. | Page-readiness audit inventory is complete. Remaining product work moves from labeling to real integrations: deployed feed/media smoke, account-specific activity/profile APIs, production onboarding/auth mapping, reward ledger, and S1/S2 projection hardening. |
| 2026-05-17 | Demo-to-production roadmap | Added the next concrete product behavior and a staged landing plan from demo to production pilot. The plan prioritizes one real corridor first: authenticated creator -> R2/Mux/backend publication -> public feed/post detail -> proposal intent -> campaign proof. It also defines nine production stages, mock retirement order, third-party blocker policy, and clarifies `/workspace/overview-v2` as legacy/experimental. | `git diff --check` passed for the docs-only update. | Next execution should start with Stage 1 identity/session hardening, then Stage 2 media/feed smoke. Keep existing readiness labels until each mock retirement gate is actually verified. |
| 2026-05-17 | Production corridor bootstrap: AccountProfile | Added `AccountProfile` schema/migration, `/api/v1/account/me` read/write APIs, account profile service tests, and frontend account client wiring. `/onboarding` now requires a real stored auth session and writes role/display name/handle when AccountProfile storage is migrated. `/me` now uses current-session profile data for the profile header while keeping portfolio, rewards, watchlist, and activity labeled as preview/derived records. Added a small FOUC recovery guard so Next dev previews do not remain hidden behind `data-next-hide-fouc`. | `npm run prisma:generate --prefix backend`; `npm run build --prefix backend`; `npm run build --prefix app`; `npx ts-mocha --exit --timeout 10000 -p backend/tsconfig.test.json backend/tests/accountProfileService.spec.ts`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/authService.spec.ts backend/tests/proposalIntentController.spec.ts`; `npm run test:backend`; `curl -H 'Authorization: Bearer mock-s1-demo' http://localhost:4000/api/v1/account/me`; browser smoke on `/onboarding` and `/me` confirmed `display:block`, no FOUC style, no console errors; `git diff --check`. | Production DB migration was not applied automatically because Neon/production migration approval is a blocker. Next safe task: run approved migration in the target environment, then smoke `/login -> /onboarding -> /me`, followed by Stage 2 media/feed R2/Mux smoke. |
| 2026-05-17 | Production corridor smoke tool | Added `npm run smoke:production-corridor`, a real-session smoke that exercises AccountProfile readiness, R2 presign/upload, optional Mux reconciliation/readiness, manifest finalize/publication, backend feed/detail projection, proposal intent creation, optional creator/sponsor signing, server relay, and campaign proof reads. The script exits with expected blockers instead of marking missing integrations as complete. | `npm run smoke:production-corridor` returned `STREAM_PUMP_SMOKE_CREATOR_TOKEN_REQUIRED`; `STREAM_PUMP_SMOKE_CREATOR_TOKEN=mock-s1-demo npm run smoke:production-corridor` returned `ACCOUNT_PROFILE_MIGRATION_REQUIRED`; `npm run build --prefix backend`; `git diff --check`. Root `tsc --noEmit -p tsconfig.json` was started but did not finish promptly because the root script test project is broad; the smoke script runtime paths above were used for validation. | Current live corridor is still blocked before content upload by the unapplied AccountProfile migration on the configured Neon database. After approved migration, run the smoke with a real creator session token; next blockers will likely be creator onboarding role, S2_ACTIVE creator readiness, sponsor session/signing, and chain relay funding/config. |
| 2026-05-18 | Production corridor verified | Applied the AccountProfile migration to the configured Neon database, generated real wallet challenge sessions for the seeded devnet S2 creator and sponsor, and completed the first real corridor. The smoke published a real video through backend R2 presign and Mux reconciliation, confirmed backend feed/post detail projection, created and locked a proposal intent from that content, collected creator and sponsor signatures, relayed the launch transaction, and read the campaign proof projection. The smoke deadline default was reduced from 14 days to 6 days so it stays within the seeded protocol `max_proposal_duration_seconds` of 7 days. | `npx prisma migrate deploy` applied `20260517143000_account_profile`; `npx prisma migrate status` returned database up to date; `curl /health`; `curl -H 'Authorization: Bearer mock-s1-demo' /api/v1/account/me` returned `storageStatus: LIVE`; real-session `npm run smoke:production-corridor` returned `ok: true` with manifest `cmpau99ki000cqtjhyc6d3t3l`, post detail projection, proposal PDA `9uATJ4cGDW5Q2NyNqLkMyyhyEZRUaywrxzaUBPUje7C9`, relay `CONFIRMED`, and campaign detail proof `FUNDED`; browser smoke verified `/explore`, `/posts/cmpau99ki000cqtjhyc6d3t3l`, and `/campaigns/9uATJ4cGDW5Q2NyNqLkMyyhyEZRUaywrxzaUBPUje7C9`; direct video element inspection confirmed Mux HLS playback ready with no media error. | The first production corridor is verified on the seeded devnet S2 creator/sponsor setup. Next product work should move from corridor proof to pilot hardening: expose this route through normal UI without local keypair scripts, add clear campaign proof fields for public/auth views, improve creator/sponsor account management, and retire remaining preview-only endorsement/rewards/settlement flows only after their own chain/API projections are verified. |
| 2026-05-20 | `/posts/[postId]` real API presentation | Removed the old demo readiness banner and post data-source notice from the successful post detail render now that the page loads backend public post records directly. Simplified the API unavailable/not-found state and replaced the comment composer's mock current user fixture with a neutral anonymous `You` identity for local-only interaction. | `npm run build --prefix app`; browser smoke on `/posts/cmpbdjcei000jqt94urkde9jf` confirmed real post content, no `SEEDED_DEMO` or source notice text, clean console, and anonymous comment publish behavior. | Engagement counts remain hash-derived display values until a backend engagement API exists; persisted comments, follow/like/save/share, and creator-profile links still need production APIs. |
| 2026-05-21 | `/activity` | Removed `ProductReadinessBanner` and `ActivitySourceNotice` success-state banner from activity surface. Simplified error display to error-only notice. Added empty state for when feed returns zero posts. No mock data injection occurs after previous `usePublicFeedViewModel` cleanup. | `npm run build --prefix app`; browser smoke on `/activity`. | Activity items, engagement counts, unread dots, and sidebar highlights are still feed-derived projections. Production activity needs account-specific notification/follow/engagement APIs. |
| 2026-05-21 | `/creators/[creatorId]` | Removed mock creator seed fallbacks (`fallbackCreators`, `findCreatorStrict`, `fallbackPosts`) from creator detail page. Creator resolution now only uses API-derived creators from `usePublicFeedViewModel`. Removed `ProductReadinessBanner` and simplified `CreatorProfileReadinessNotice` to error-only. Simplified `getStaticProps` to always use `loadPublicFeedPageProps()`. | `npm run build --prefix app`; browser smoke on `/creators/<known-api-creator-id>`. | Creator market fields (price, holders, graduation, top holders, buyout offer, price history) are still derived projections from `CreatorStageView`. Real creator profile read model, S1 market state, and buyout state need backend API support. If no API creators match the URL, the page correctly shows not-found. |
| 2026-05-21 | `/me` page wrapper | Removed `ProductReadinessBanner` and simplified `MeReadinessNotice` to error-only display. Removed redundant inline feed error message. Profile header remains session-backed via AccountProfile when signed in. | `npm run build --prefix app`; browser smoke on `/me` signed-in and signed-out. | `MeSurface` tabs (Holdings, Watchlist, Rewards, Activity, Saved) remain fully mock-driven via `lib/public-data` fixtures. These need dedicated backend APIs (portfolio, engagement ledger, watchlist, rewards) before they can be migrated. All mock sections already carry "Preview" labels. |
| 2026-05-21 | `/login` | Removed `ProductReadinessBanner` and dev-facing `?preview=` hint pill from login page. Wallet challenge and email OTP auth flows are unaffected. Social auth preview gating via `NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH` remains handled internally by `AuthOptionsPanel`. | `npm run build --prefix app`; browser smoke on `/login`. | Social auth (Google/Apple) still uses preview provider exchange when enabled. Production social auth requires real OAuth dashboard setup (blocker). |
| 2026-05-22 | Role onboarding and access gates | Added two-step login wallet choice for social/email identities, AccountProfile creation for managed/external wallet sessions, creator register Ed25519 oracle authorization gate, SponsorProfile KYB schema/API/operator routes, `/workspace/sponsor-onboarding`, and login guards for public interaction triggers. | `npm run prisma:generate --prefix backend`; `npm run build --prefix backend`; `npm run test:backend`; `npm run build --prefix app`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/creator-auth-signature.spec.ts`. Browser smoke covered `/login` wallet-choice handoff and `/workspace/sponsor-onboarding` wizard render in local dev; console only showed the existing Next dev HMR ISR-manifest warning. | Production blockers remain: real Google/Apple/Twitter OAuth dashboard setup, production managed-wallet custody/KMS/MPC, R2 document upload smoke, operator approval UI/notification delivery, production migration approval, deployed program upgrade, and persistent nonce replay storage. Broad root `npx tsc --noEmit -p tsconfig.json` still fails on existing monorepo-wide Express request augmentation and Anchor typed-client test/script issues, so targeted workspace builds remain the accepted checks. |
| 2026-05-23 | KYB/auth security hardening | Closed the Sponsor KYB production bypass by requiring an approved SponsorProfile when S1 mock APIs are disabled, added signed review URLs instead of returning private R2 KYB keys from the internal pending-sponsor route, blocked external wallet binding after managed-account onboarding, rejected already-bound external wallets with a 409, prevented Creator accounts from being overwritten as Sponsor accounts, and normalized creator handles to lowercase before chain auth verification and storage. | `npm run build --prefix backend`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/authService.spec.ts backend/tests/sponsorProfileService.spec.ts`; `npm run test:backend`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/creator-auth-signature.spec.ts`; `npm run test:chain:local`; `git diff --check`. | Production promotion still requires deployed program upgrade, production SponsorProfile migration approval, configured R2 credentials for signed KYB download URLs, operator UI consumption of `businessLicenseUrl`/`powerOfAttorneyUrl`, and persistent nonce replay storage for creator auth signatures. |
| 2026-05-23 | S1 buyout abort and cohort reconciliation | Added `abort_s1_buyout` for all-holder rage-quit abort/refund, blocked zero-supply graduation, emitted early/regular buyout pool snapshots, added Prisma cohort/pool projection fields, changed portfolio claimable USDC to dynamic early/regular pro-rata reconciliation, skipped buyout-state RPC when events contain pool snapshots, and added sponsor lock/countdown plus rage-quit-vs-graduation calculator UI. | `npm run prisma:generate --prefix backend`; `./node_modules/.bin/prisma format --schema prisma/schema.prisma` from `backend`; `npm run build --prefix backend`; `npm run build --prefix app`; `npm run build:anchor`; `npm run test:backend`; `scripts/test-anchor-local.sh programs/tests/s1-buyout-unhappy-path.spec.ts`; `npm run test:chain:local`; `git diff --check`. | Production promotion still requires applying the new Prisma migration in the target DB and deploying/upgrading the Anchor program. `/workspace/buyout` remains `MOCK_PREVIEW`; the abort builder exists, but full self-serve buyout UI productization is still pending. |
| 2026-05-23 | S2 endorsement projection and transaction path | Added static Track2 fan-pool/SPUMP snapshots to eliminate claim-order reward drift, switched Track2 claim estimates to the locked settlement pool with last-claimer dust protection inside Track2 accounting, added `S2EndorsementPositionProjection`, indexed endorse/settle/claim events, exposed S2 endorse/claim transaction builders, and wired `/campaigns/[proposalId]/endorse` to real API/wallet flow for live campaign proofs while preserving labeled local fallback. | `npm run prisma:generate --prefix backend`; `./node_modules/.bin/prisma format --schema prisma/schema.prisma` from `backend`; `npm run build --prefix backend`; `npm run test:backend`; `npm run build --prefix app`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/s2-traffic-market.spec.ts`; Playwright/Chrome smoke on `/campaigns/s2-seeded-proof/endorse` with mocked public proof; `git diff --check`. | Production promotion still requires applying the new Prisma migration, deploying/upgrading the Anchor program, running a wallet-backed devnet endorsement smoke, and productizing claim/reward display beyond the endorse page. |
| 2026-05-23 | S2 design consolidation | Added nonce-based Proposal PDA derivation to avoid creator/deadline collisions, restricted endorsements to funded proposals, added per-proposal and per-user SPUMP endorsement caps, moved failed-campaign endorsement refunds to 100% SPUMP principal, reserved the 5% slash for cancelled/voided proposals, added content anchor versioning, added `CreatorStatus::Suspended`, and consolidated campaign proof/endorsement aggregate fields onto `Proposal` with KYB, wallet, endorsement withdrawal, and Track2 reviewer audit schema support. | Recorder evidence: clean branch on `codex/post-deadline-phase-0`; `git diff aa31bcd..HEAD --stat --find-renames` showed 24 changed files; `git diff --check` passed after documentation recording. App, backend, and Anchor builds/tests were not rerun by the recorder. | No readiness promotion: S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`. Promotion requires applying migration `20260523210000_design_consolidation`, deploying/upgrading the Anchor program, regenerating or reconciling seeded nonce-based proposal state/projections, and running a wallet-backed devnet endorsement smoke. |
| 2026-05-24 | Pilot hardening: S2 intent/media/feed truth | New proposal intents now allocate and serialize non-zero nonce values before lock/build so nonce-based Proposal PDAs are actually used by the normal API path. Endorsement UI now matches chain settlement semantics: failed campaigns refund 100% SPUMP, while 5% slash is shown only for cancelled/voided cases. Publication creation no longer marks pending publications as public-feed eligible; public feed/API-derived creator surfaces no longer synthesize likes, holders, S1 price, supply, buyout, or valuation values. Ordinary creator proposal creation now submits Track 3 as 0 USDC / 0 days and labels CPS as operator-gated. | `npm run build --prefix backend`; `npm run build --prefix app`; `npx ts-mocha -p backend/tsconfig.test.json backend/tests/proposalIntentController.spec.ts backend/tests/proposalLaunchService.spec.ts backend/tests/s2EndorsementProjection.spec.ts`; `git diff --check`; Playwright fallback smoke on `/campaigns/prop-neo-park-2026q2/endorse` confirmed the fail path shows 100% SPUMP returned and 0 fail slash. | No readiness promotion. Browser plugin `iab` was unavailable, so Playwright CLI was used for smoke after installing Chromium into the user cache. `/trending` still shows API unavailable when the backend is not running; production feed verification still requires backend/R2/Mux configured data, verified publication flow, applied migrations, and devnet wallet-backed S2 endorsement smoke. |
| 2026-06-02 | P0/P1 hardening pass | Guarded creator upgrades from overwriting S1 buyout statuses, added emergency void settlement-state guards, enforced suspended creator proposal errors, added a protocol hard ceiling for uncapped endorsements, gated Track1 settlement by deadline, emitted endorsement creation events, auth-gated internal Mux routes, preserved proposal settlement signatures, stored Proposal nonce, synced endorsement aggregates from chain, added publication verification, fixed endorsement USDC atomic formatting and program id, and removed mock portfolio hero/snapshot panels from live portfolio data. | `cargo check`; `npx prisma generate` in `backend/`; `npm run build --prefix backend`; `npm run build --prefix app`; Browser smoke on `/campaigns/prop-neo-park-2026q2/endorse` and `/portfolio` confirmed render, clean console, slider state update, no atomic-USDC overformat, and no portfolio mock hero/snapshot in the signed-out live branch. | No readiness promotion. Migration `20260602120000_add_proposal_nonce` still needs approval/application in target DB, and the upgraded Anchor program still needs deployment plus wallet-backed devnet endorsement/projection smoke before promotion. |
| 2026-06-02 | Publication eligibility ordering fix | Added a shared backend sync that promotes a manifest to public-feed eligible and backfills `Proposal.contentPublishedVerifiedAt` once both conditions are true: at least one verified publication and all assets delivery-ready. The sync now runs from publication verification, image upload completion, Mux webhook ready events, and Mux reconciliation ready events. | `npm run build --prefix backend`; `git diff --check`. | No readiness promotion. Full media promotion still needs deployed R2/Mux smoke and operator visibility for failed/retried assets. |

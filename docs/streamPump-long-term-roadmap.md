# StreamPump Long-Term Product Roadmap

Last updated: 2026-05-16  
Branch for post-deadline work: `codex/post-deadline-phase-0`

This document is the long-term execution map for moving StreamPump from a hackathon controlled demo into the product promised in `pitch/script.md`: a Web2.5 creator sponsorship market where content, sponsor budgets, fan participation, and Solana settlement form one verifiable product loop.

It should be read together with:

- `pitch/script.md`
- `docs/product-readiness-phase-0.md`
- `README.md`
- `DEMO.md`

## Product North Star

StreamPump is a creator sponsorship trust layer. It is not a freely tradable fan-token market, not a traditional influencer CRM, and not a view-to-earn reward farm.

The target product connects three roles:

- **Creator**: publishes content, builds momentum, receives cold-start support, and later earns structured sponsorship payouts.
- **Fan / Backer**: supports creators early with non-transferable utility `SPUMP`, receives internal S1 positions, can rage quit during buyout execution, and can claim real USDC from sponsor-funded buyouts or endorsement pools.
- **Sponsor**: spends USDC as marketing budget, not as speculative investment, and receives verifiable campaign proof and settlement transparency.

The core value flow is:

```text
content -> creator momentum -> fan participation -> sponsor USDC budget -> Solana settlement
```

Technical principles:

- **DB-first for product workflow**: drafts, media uploads, proposal intents, retry state, publication review, operator notes, and third-party reconciliation belong in Postgres and backend services.
- **Chain-first for financial truth**: SPUMP mint/burn, S1 positions, sponsor funding, USDC vaults, proposal creation, settlement, refunds, rage quit, and claims must be verifiable on Solana.

Explicit non-goals:

- Do not make SPUMP transferable.
- Do not list SPUMP on a DEX or CEX.
- Do not present local mock previews as production integrations.
- Do not make the user experience read like a trading terminal before it reads like a content product.
- Do not bypass Solana as the source of truth for financial settlement.

## Current State

Status legend inherited from `docs/product-readiness-phase-0.md`:

| Status | Meaning |
| --- | --- |
| `LIVE` | Product UI and backend path are usable against the intended devnet/runtime flow. |
| `SEEDED_DEMO` | Works for the hackathon demo after seed scripts or prepared devnet state. |
| `MOCK_PREVIEW` | Frontend-only or local simulated behavior; not a real product workflow. |
| `BACKEND_READY_UI_GAP` | Backend/API/chain builder exists, but user-facing UI is incomplete. |
| `OPERATOR_REQUIRED` | Requires scripts, manual operator action, or controlled data setup. |
| `NOT_STARTED` | No reliable product implementation yet. |

| Product area | Current status | Gap to target |
| --- | --- | --- |
| Public discovery and post detail | `LIVE` + `SEEDED_DEMO` | Social-first shell exists, but creator market truth and production media states still need deeper wiring. |
| S1 market buy/sell | `SEEDED_DEMO` | Needs self-serve creator onboarding, rating provenance, daily cap visibility, production read APIs, and stronger end-to-end smoke coverage. |
| S1 buyout formation | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Sponsor offer creation, creator acceptance, rage quit, graduation, reclaim, and claim must become product flows, not seed-script state. |
| S1 portfolio claim | `SEEDED_DEMO` | Claim path works for seeded holders; needs projection completeness and robust post-rage-quit accounting. |
| S2 proposal launch | `SEEDED_DEMO` | DB-first intent and chain bundle path exist; needs production auth, complete workspace list/detail flows, and clearer role-specific actions. |
| S2 endorsement | `MOCK_PREVIEW` | Must migrate from local SPUMP simulation to real endorsement PDA, SPUMP burn, reward pool projection, and claim state. |
| Settlement Track 1 | `SEEDED_DEMO` | Can be controlled manually; needs operator/manual trigger surface, idempotent scheduler, and observability. |
| Settlement Track 2 | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Needs metric ingestion, fraud/review state, oracle evidence digest, and automated settlement payload generation. |
| Settlement Track 3 | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Needs a real merchant/reconciliation source before production claims are allowed. |
| Media publication | `BACKEND_READY_UI_GAP` | R2/Mux plumbing exists; needs publish eligibility, review/retry UX, failure recovery, and feed proof. |
| Auth and wallet sessions | `SEEDED_DEMO` + `MOCK_PREVIEW` | Needs production-grade Google/Apple/email/passkey exchange and managed wallet mapping. |
| Operator tooling | `OPERATOR_REQUIRED` | Needs dashboards/log views for oracle, indexer, Mux reconciliation, settlement retry, fraud review, and deployment health. |
| Deployment | `BACKEND_READY_UI_GAP` | Vercel/Render/Neon/R2/Mux path is documented; needs continuously verified environments and smoke checks. |

## Route And API Readiness Inventory

This inventory is the working boundary for automation. It is not a promise that every listed surface is production-ready; it tells future runs where mock, seeded, or operator-driven behavior must be preserved until promoted by code and verification.

### Frontend Routes

| Surface | Current readiness | Promotion gate |
| --- | --- | --- |
| `/explore`, `/trending`, `/posts/[postId]`, `/creators/[creatorId]`, `/activity` | `LIVE` + `SEEDED_DEMO` | Keep R2/Mux-backed feed reliable, expose creator market truth where relevant, and avoid local media fallbacks in production claims. |
| `/market/[creatorId]` | `SEEDED_DEMO` | Add non-seeded creator onboarding, rating provenance, cap usage, and projection-backed buy/sell state. |
| `/buyout/[creatorId]` | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Replace prepared buyout state with productized sponsor offer, creator acceptance, rage quit, graduation, and reclaim flows. |
| `/portfolio` | `SEEDED_DEMO` | Remove scenario assumptions once holdings, rage quit, buyout claim, and re-entry all read from projections. |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Replace preview provider exchange with production provider verification and managed wallet mapping. |
| `/workspace`, `/workspace/content/new`, `/workspace/content/[manifestId]`, `/workspace/intents/[intentId]` | `SEEDED_DEMO` | Complete publication state, upload failure recovery, list/detail APIs, and role-specific intent actions. |
| `/campaigns/[proposalId]` | `SEEDED_DEMO` | Require campaign proof projection for proposal PDA, vault, manifest hash, content anchor, and settlement signatures. |
| `/campaigns/[proposalId]/endorse` | `MOCK_PREVIEW` | Connect to real SPUMP burn, endorsement PDA, reward pool projection, and claim state. |
| `/campaigns/[proposalId]/settlement` | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Only remove readiness marking after Track1/2/3 data comes from projection and permitted operator/oracle flows. |
| `/rewards` | `MOCK_PREVIEW` | Start with real daily SPUMP claim before expanding missions or engagement rewards. |
| `/workspace/buyout` | `MOCK_PREVIEW` | Connect to real S1 buyout offer creation/review lifecycle before presenting as productized. |
| `/demo`, `/pitch`, `/me`, `/onboarding` | `SEEDED_DEMO` | Keep as support or identity/profile surfaces; do not use them to imply missing financial flows are live. |

### Backend API And Service Areas

| Surface | Current readiness | Promotion gate |
| --- | --- | --- |
| `authRoutes` / session services | `SEEDED_DEMO` + `MOCK_PREVIEW` | Production provider verification, managed wallet mapping, and production-disabled preview fallbacks. |
| `publicFeedRoutes` / R2/Mux feed services | `LIVE` + `BACKEND_READY_UI_GAP` | Publication eligibility, recovery states, and deployed R2/Mux smoke coverage. |
| `contentManifestRoutes` | `SEEDED_DEMO` | Full manifest list/detail, upload retry, finalize, publish eligibility, and Mux reconciliation verification. |
| `proposalIntentRoutes` / launch bundle service | `SEEDED_DEMO` | Idempotent state transitions, role-aware errors, and proposal proof reconciliation after Solana confirmation. |
| `proposalRoutes`, `campaignRoutes`, campaign proof projection | `SEEDED_DEMO` | Complete campaign proof projection for launch, funding, content anchor, and all settlement signatures. |
| `s1Routes`, `marketRoutes`, S1 action controllers | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Self-serve S1 registration, market reads, buy/sell, buyout lifecycle, rage quit, graduation, and claim projections. |
| `OracleScheduler`, settlement services | `OPERATOR_REQUIRED` | Operator-visible queue/status, idempotent manual triggers, evidence digests, and guarded schedulers. |
| `indexer`, `chainProjectionService`, `marketProjectionService` | `SEEDED_DEMO` | Projection lag observability and event coverage for S1/S2 lifecycle states. |
| `MuxReconciliationScheduler`, R2/Mux services | `BACKEND_READY_UI_GAP` | Deployed webhook/reconciliation smoke and operator-visible failed media recovery. |
| prototype routes | `MOCK_PREVIEW` | Keep under prototype namespace; do not mount as v1 product capability. |

## Roadmap

### Phase 1: Roadmap Truth And Product Boundary Hardening

Goal: make the product boundary durable enough that future automation cannot confuse mock previews with production capability.

Key work:

- Keep this document updated as the roadmap source of truth.
- Keep `docs/product-readiness-phase-0.md` as the frozen hackathon readiness boundary.
- Add or maintain demo/readiness labels on preview-only pages.
- Ensure README/DEMO do not overclaim productized flows.
- Add Progress Ledger entries after every automation run.

Acceptance criteria:

- Every major route or API surface has a readiness status.
- No mock flow is described as production-ready.
- Automation can choose the next task from this document without product interpretation.

### Phase 2: Auth, Session, And Managed Wallet Production Path

Goal: make StreamPump usable by normal creators, fans, and sponsors without requiring them to understand wallets first.

Backend/API work:

- Implement production-grade provider exchange for Google, Apple, email, and passkey paths.
- Keep `AuthIdentity -> managedWalletAddress -> WalletSession` as the unified session subject.
- Require Bearer session auth for v1 write APIs.
- Keep external wallet login as an advanced path using challenge/signature.
- Disable preview provider exchange and legacy wallet header in production.

Frontend work:

- Make `/login` prioritize social/email/passkey entry.
- Keep external wallet login clearly marked as advanced.
- Persist and restore session reliably after refresh.
- Show account and wallet state without making wallet concepts the first user decision.

Acceptance criteria:

- Social/email session and external wallet session both resolve to the same backend session shape.
- Workspace and proposal flows can identify the current user role from session state.
- Preview auth cannot be accidentally enabled in production.

### Phase 3: Media Publication And Public Feed Reliability

Goal: make content a reliable product asset, not just a demo image/video shell.

Backend/API work:

- Complete content manifest list/detail and publication state APIs.
- Ensure R2 presign, complete, finalize, and canonical manifest hashing are idempotent.
- Use Mux webhook and reconciliation to move video assets to `READY` or `ERRORED`.
- Add feed eligibility rules that distinguish draft, processing, published, rejected, and archived media.

Frontend work:

- Finish upload UX for image, video, and mixed media.
- Surface upload, processing, retry, and finalize states.
- Ensure public feed uses imported R2/Mux media and does not silently fall back to local mocks when live data fails.
- Keep post detail and video playback social-first.

Acceptance criteria:

- A creator can create a manifest, upload assets, finalize, and produce a public-feed-eligible content record.
- R2/Mux failures are visible and recoverable.
- Public feed can be verified against backend records and media URLs.

### Phase 4: S1 Self-Serve Market And Buyout Lifecycle

Goal: move S1 from seeded demo into a self-serve creator discovery market with real projections.

Backend/API work:

- Add creator market read APIs with:
  - current price and next price
  - rating provenance
  - pending rating and effective time
  - daily SPUMP cap usage
  - user position state
  - buyout state
- Productize transaction builders for:
  - register user
  - register creator
  - claim daily SPUMP
  - buy S1
  - sell S1
  - init buyout
  - submit buyout offer
  - accept buyout offer
  - rage quit
  - execute graduation
  - claim buyout USDC
  - cancel/reclaim offer
- Extend projections to cover cancelled, reclaimed, rage quit, graduated, claimed, and exhausted claim states.

Frontend work:

- Creator detail must show S1 price, rating, graduation progress, pending rating, daily cap, and buyout state.
- Portfolio must show real S1 positions, rage quit availability, buyout claim queue, and re-entry context.
- Buyout pages must separate sponsor/creator/backer actions clearly.
- S1 copy must state that creator positions are internal virtual positions, not transferable SPL tokens.

Chain/indexer work:

- Verify event completeness for `buy_s1_token`, `sell_s1_token`, rating updates, buyout lifecycle, rage quit, and claims.
- Add devnet smoke from user/creator registration through buyout claim.

Acceptance criteria:

- A non-seeded user can complete the S1 happy path on devnet with backend projections matching chain state.
- Rage quit and claim accounting are consistent across chain, backend, and UI.
- Frontend no longer needs seed JSON to determine S1 state.

### Phase 5: S2 Proposal, Endorsement, And Settlement Productionization

Goal: make S2 the real sponsorship market with verifiable content, campaign funding, fan endorsement, and settlement.

Backend/API work:

- Keep proposal launch as one creator partial signature plus one sponsor final signature.
- Ensure ProposalIntent and TxBundle state machines are idempotent and observable.
- Add campaign read models exposing proposal PDA, vault, manifest hash, content anchor, budgets, and settlement signatures.
- Add endorsement APIs backed by real SPUMP burn and endorsement PDA state.
- Add endorsement claim projection and claim APIs.

Frontend work:

- Workspace intent detail shows role-specific next actions without splitting creator/sponsor portals.
- Campaign detail and settlement pages use real projection data; mock settlement remains readiness-labeled.
- Endorsement page migrates from local simulation to live chain/API flow.
- Rewards page starts with real daily SPUMP claim before adding missions.

Settlement work:

- Track1: add manual/operator trigger first, then scheduler.
- Track2: add metric ingestion, fraud/review status, oracle-signed evidence digest, and settlement payload generation.
- Track3: keep operator-gated until a real merchant/reconciliation source is integrated.

Acceptance criteria:

- Creator and sponsor can launch a campaign with one creator partial signature and one sponsor final signature.
- Campaign proof is visible from both DB projection and Solana proof.
- Fan endorsement and claim flow is live, not local simulation.

### Phase 6: Oracle, Indexer, Operator Tooling, And Deployment Hardening

Goal: make backend operations reliable enough for real demos, test users, and eventual production traffic.

Operator tooling:

- Build admin/operator views for:
  - indexer cursor and projection lag
  - oracle scheduler status
  - settlement queue
  - Mux reconciliation status
  - R2 media failures
  - fraud/review decisions
  - failed transaction retry
- Add clear stop/resume controls for scheduler jobs.

Infrastructure:

- Verify Vercel frontend deployment.
- Verify Render backend deployment.
- Verify Neon migrations.
- Verify R2 public/signed URL strategy.
- Verify Mux webhook and reconciliation in deployed backend.
- Add Redis/queue only when background job reliability requires it.

Acceptance criteria:

- Operators can see why a campaign or media item is stuck.
- Deployment smoke checks cover auth, feed, upload, proposal launch, and settlement readiness.
- Background jobs are idempotent and safe to rerun.

### Phase 7: Audit, Abuse Resistance, Mobile/App Readiness, And Growth Loop

Goal: prepare StreamPump for broader users without weakening the financial model.

Security and abuse work:

- Freeze core instruction interfaces before audit.
- Expand Anchor unhappy-path tests around caps, roles, expiration, refund, void, and cancel.
- Add anti-abuse controls for account farming, fake engagement, repeated rewards claims, and suspicious sponsor/creator loops.
- Add fraud review and evidence retention for Track2/Track3.

Mobile/app readiness:

- Keep web and app information architecture aligned.
- Prioritize mobile for feed, portfolio, creator profile, post detail, and notifications.
- Keep workspace-heavy flows web-first until mobile signing and media upload are reliable.

Growth loop:

- Add missions only after real SPUMP claim and anti-abuse are solid.
- Keep SPUMP utility-only and non-transferable in all copy.
- Tie fan rewards to sponsor-funded pools or protocol-defined utility, not secondary market speculation.

Acceptance criteria:

- Core financial flows pass repeatable verification.
- Audit blockers are documented and resolved.
- User acquisition loops do not depend on token speculation.

## Backend / API Priorities

Highest-priority backend order:

1. Stabilize session and identity model.
2. Complete content publication and feed reliability.
3. Complete S1 read APIs and projection coverage.
4. Productize S1 transaction builders and buyout lifecycle APIs.
5. Complete S2 endorsement and claim APIs.
6. Add Track1/Track2 operator settlement APIs.
7. Keep Track3 gated until a real merchant/reconciliation source exists.

API design defaults:

- All writes require Bearer session auth.
- Financial transaction builders must return exact signer requirements, expected accounts, and idempotency keys.
- API read models should show readiness status instead of hiding missing product capability.
- Chain confirmation must be reconciled back into DB projections before UI claims success.

## Frontend Priorities

Highest-priority frontend order:

1. Keep social-first discovery and detail surfaces polished.
2. Replace remaining page-local mock data with domain API adapters.
3. Make Creator detail the S1 market truth surface.
4. Make Portfolio the S1 position, rage quit, and claim surface.
5. Make Workspace the unified content/proposal/action surface.
6. Move endorsement and rewards from preview to real SPUMP/USDC flows.
7. Keep readiness banners on any page that still uses mock or operator-driven behavior.

UX defaults:

- Users should understand creator momentum before seeing protocol mechanics.
- Protocol language belongs in tooltips, proof panels, and advanced disclosures.
- Buttons must reflect real action availability from API/chain state.
- Production UI must never silently fall back to mock financial state.

## Chain, Indexer, And Oracle Priorities

Chain program direction:

- Avoid broad refactors until product read models and frontend needs are clear.
- Add tests and events before changing instruction semantics.
- Preserve Token-2022 non-transferable SPUMP.
- Preserve internal S1 positions as PDA state, not transferable SPL tokens.

Indexer direction:

- Projections must be explicit by product area:
  - creator market
  - S1 position
  - S1 buyout offer
  - S1 buyout state
  - proposal/campaign proof
  - endorsement/claim
- Projection lag and failed events must be visible to operators.

Oracle direction:

- Rating and settlement reports should include digest/evidence metadata.
- Track2 and Track3 must not be automated without auditable evidence and fraud/review gates.
- Scheduler jobs must be idempotent and safe to rerun.

## Third-Party And Infrastructure Priorities

Required services:

- Neon/Postgres for production database and migrations.
- Cloudflare R2 for content object storage.
- Mux for video processing, webhook, and reconciliation.
- Reliable Solana RPC for devnet and later production networks.
- Vercel for frontend.
- Render for the initial backend web service.

Replaceable services:

- Web3Auth or another embedded wallet provider.
- Redis/queue provider.
- Observability provider such as Sentry, Logtail, or Datadog.
- RPC provider such as Helius, QuickNode, or another reliable Solana endpoint.

Blocked until external decision/input:

- Track3 merchant reconciliation provider.
- Chainlink Functions or equivalent oracle network.
- Full fraud review vendor.
- Production domain, production secrets, paid plan upgrades, or dashboard-only setup.

## Automation Rules

The recurring automation must operate under these rules:

- Automation name: `StreamPump Long-Term Roadmap Optimizer`
- Schedule: every 4 hours.
- Model: `gpt-5.5`
- Reasoning effort: `high`
- Workspace: `/Users/jamesli/Desktop/Sol Projects/StreamPump`
- Required branch: `codex/post-deadline-phase-0`
- Remote branch: `origin/codex/post-deadline-phase-0`

Preflight for every run:

```bash
git branch --show-current
git status --short
```

If the branch is not `codex/post-deadline-phase-0`, the automation must stop and report the branch mismatch.

Protected local files:

- `backend/package-lock.json`
- `pitch/colosseum-submission.md`
- `pitch/demo-youtube-description.md`

The automation must not stage, commit, delete, or rewrite protected files unless a later explicit instruction changes this document.

Work loop:

1. Read this document, `pitch/script.md`, `docs/product-readiness-phase-0.md`, `README.md`, and `DEMO.md`.
2. Select the highest-priority incomplete roadmap item that is not blocked by missing secrets, paid third-party upgrades, dashboard actions, production DB access, or human business decisions.
3. Implement exactly one coherent increment.
4. Run the smallest relevant tests first, then broader checks when appropriate.
5. Update the Progress Ledger in this document with the work done, tests run, blockers, and next safe task.
6. Stage files explicitly. Do not use `git add .`.
7. If checks pass, commit and push to `origin/codex/post-deadline-phase-0`.
8. If blocked, do not fake integrations and do not convert mock previews into production claims. Report the exact blocker and choose the next safe unblocked task if one exists.

Completion rule:

- When all roadmap items are marked complete, run full verification twice:
  - `npm run build --prefix app`
  - `npm run build --prefix backend`
  - `npm run test:backend`
  - relevant Anchor tests
  - documented devnet smoke where credentials and funded accounts are available
- Only after repeated verification can the automation mark the roadmap target ready for human acceptance.

## Verification Matrix

| Change type | Minimum checks |
| --- | --- |
| Documentation only | `git diff --check`; confirm protected files are not staged. |
| Frontend UI | `npm run build --prefix app`; browser smoke for changed pages. |
| Backend API/service | `npm run build --prefix backend`; targeted tests; `npm run test:backend` when practical. |
| Prisma/schema | migration review; backend build; affected service/controller tests. |
| Chain program | `npm run build:anchor` or `cargo check`; targeted Anchor tests. |
| S1 lifecycle milestone | S1 local/devnet smoke; projection/chain consistency checks. |
| S2 lifecycle milestone | S2 launch smoke; campaign proof and settlement projection checks. |
| Media pipeline | R2 upload smoke; Mux webhook/reconciliation smoke. |
| Deployment | Vercel app health; Render `/health`; CORS/API smoke. |

## Progress Ledger

| Date | Run type | Completed | Verification | Blockers | Next safe task |
| --- | --- | --- | --- | --- | --- |
| 2026-05-16 | Manual setup | Created long-term roadmap source of truth and automation operating rules. | Documentation creation only; no product code behavior changed. | Existing local protected files remain dirty/untracked and must not be staged by automation. | Create recurring automation and start with Phase 1 boundary-hardening tasks. |
| 2026-05-16 | Manual optimization | Added route/API readiness inventory and linked the long-term roadmap from README/DEMO so future work has a product boundary entry point. | Documentation-only change; run `git diff --check` before commit. | Protected local files remain dirty/untracked and are intentionally excluded. | Continue Phase 1 by auditing preview surfaces and README/DEMO claims against the new inventory. |
| 2026-05-16 | Automation | Hardened `/workspace/buyout` boundary copy so static offer data is labeled `MOCK_PREVIEW` and no longer reads like a live sponsor auction. | `npm run build --prefix app` passed. Local HTTP smoke on `http://127.0.0.1:3000/workspace/buyout` confirmed `MOCK_PREVIEW`, static offer, and preview action copy rendered; Browser plugin tools were not exposed, so no interactive browser screenshot was captured. | Protected local files remain dirty/untracked and are intentionally excluded. | Continue Phase 1 by auditing `/workspace/intents/[intentId]` and `/workspace/sponsorships` for any remaining preview copy that could be mistaken for live chain/API capability. |

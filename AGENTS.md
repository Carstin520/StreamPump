# CLAUDE.md — StreamPump

## What Is StreamPump

StreamPump is a Web2.5 creator sponsorship trust layer built on Solana. It is **not** a freely tradable fan-token project, **not** an influencer CRM, and **not** a view-to-earn reward farm.

It places content creation, creator momentum, sponsor budgets, fan participation, and on-chain settlement into one product loop. Three roles interact: **Creator** (publishes content, earns sponsorship payouts), **Fan/Backer** (supports creators with non-transferable SPUMP, earns USDC from sponsor-funded outcomes), and **Sponsor** (spends USDC marketing budget as marketing spenders not investors, receives verifiable campaign proof).

Core product flow:

```
content -> creator momentum -> fan participation -> sponsor USDC budget -> Solana settlement
```

Design principle: **DB-first for product workflow, chain-first for financial truth.** Drafts, uploads, content manifests, proposal intents, retry state, and workspace state live in the backend database. Funding, token movement, content anchoring, settlement, refunds, and claimable value must be treated as Solana/Anchor truth.

SPUMP is a non-transferable Token-2022 utility token. It is never listed on DEX/CEX. S1 creator positions are internal virtual positions stored in protocol state, not creator SPL tokens. Users earn USDC through in-platform participation, not token speculation.

## Required Context Before Substantive Work

Read these first when doing product, architecture, roadmap, or implementation work:

1. `docs/streamPump-long-term-roadmap.md` — canonical roadmap, current status, route/API inventory, progress ledger, verification policy.
2. `pitch/script.md` — product promise and narrative boundary.
3. `docs/product-readiness-phase-0.md` — frozen post-hackathon readiness status legend and demo boundary.
4. `README.md` and `README.zh-CN.md` — repo overview, setup, commands, demo paths.
5. `DEMO.md` — controlled S1/S2 demo runbook, environment flags, smoke paths, and known devnet state.
6. `docs/streamPump-page-readiness-goal.md` — page-level optimization rules when working one surface at a time.

`docs/streamPump-long-term-roadmap.md` is the canonical roadmap. Treat `docs/streamPump-long-term-roadmap 2.md` as a non-canonical duplicate. The roadmap progress ledger may be newer than the README status snapshot — when they conflict, prefer the roadmap ledger, then verify against code.

## Repository Structure

```
StreamPump/
├── programs/streampump-core/   # Anchor/Rust program (S1, S1 buyout, S2, settlement, content anchoring)
│   └── src/
│       ├── lib.rs              # Program entry with all instruction handlers
│       ├── instructions/       # One file per instruction module
│       ├── state/              # On-chain account definitions (PDA structs)
│       └── errors.rs           # Custom program errors
├── programs/tests/             # Anchor TypeScript tests (Mocha/Chai)
├── backend/                    # Express.js API server
│   ├── index.ts                # Entry point, route mounts, middleware
│   ├── src/
│   │   ├── routes/             # Express route handlers
│   │   ├── services/           # Business logic services
│   │   ├── controllers/        # Request/response controllers
│   │   ├── middleware/         # Auth, CORS, error handling
│   │   └── config/            # Environment and vendor config
│   ├── prisma/schema.prisma   # Database schema (Postgres)
│   ├── scripts/               # Backend utility scripts
│   └── tests/                 # Backend service tests (ts-mocha)
├── app/                       # Next.js 15 frontend
│   └── src/
│       ├── pages/             # File-based routing (Pages Router)
│       ├── components/        # React components
│       ├── lib/               # API clients, utilities, constants
│       │   └── api/           # Backend API client modules
│       ├── contexts/          # React context providers
│       └── styles/            # Global CSS, Tailwind
├── scripts/                   # Root-level scripts (devnet seed, demo, deploy, smoke)
├── docs/                      # Protocol design, frontend specs, backend contracts, deployment
├── local-post-assets/         # Seed media for dev feeds
├── third_party/               # Vendored Rust crates (proc-macro2, blake3)
├── pitch/                     # Pitch deck script and submission docs
├── Anchor.toml                # Anchor workspace config
├── Cargo.toml                 # Rust workspace root
├── package.json               # Root workspace (test/demo scripts)
├── DEMO.md                    # Controlled demo runbook
└── CLAUDE.md                  # This file
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Solana program | Rust + Anchor 0.32, Solana CLI 2.3.0, Token-2022 (NonTransferable mint) |
| Backend | Express 4, TypeScript 5, Prisma 6 ORM, PostgreSQL |
| Frontend | Next.js 15 (Pages Router), React 18, Tailwind CSS 3, TypeScript 5 |
| Object storage | Cloudflare R2 (via AWS SDK S3 client) |
| Video processing | Mux (upload, webhook, reconciliation, HLS playback) |
| Auth | Wallet adapters (Phantom, Solflare), Web3Auth, email OTP, wallet challenge |
| Database | PostgreSQL (Neon for production, local Postgres for dev) |
| Deployment | Vercel (frontend), Render (backend), Neon (DB), Cloudflare R2, Mux |
| Testing | ts-mocha + Chai (backend + Anchor tests) |
| Program ID | `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp` |

## Branch Model

- **`main`**: Frozen hackathon submission branch. **Never modify `main`.**
- **`codex/post-deadline-phase-0`**: Active development branch. All work happens here.

## Build, Test, and Run

### Install

```bash
npm install                      # Root workspace (Anchor tests, scripts)
npm install --prefix app         # Frontend
npm install --prefix backend     # Backend
```

### Build

```bash
npm run build --prefix app       # Next.js production build
npm run build --prefix backend   # TypeScript compilation
npm run build:anchor             # Anchor program (uses /private/tmp/streampump-anchor-target)
cargo check                      # Quick Rust type check
```

### Dev Servers

```bash
npm run dev --prefix app         # Next.js dev on :3000
npm run dev --prefix backend     # Express dev on :4000
```

### Test

```bash
npm run test:backend             # All backend service tests
npm run test:anchor              # All Anchor tests (requires local validator)

# Focused test suites
npm run test:s1:happy            # S1 market happy path
npm run test:s1:unhappy          # S1 market unhappy path
npm run test:s1:buyout           # S1 buyout lifecycle
npm run test:s1:buyout:unhappy   # S1 buyout edge cases
npm run test:s2:unhappy          # S2 proposal unhappy path
npm run test:s1:guards           # S1 anti-abuse guards
npm run test:unhappy:backend     # Backend unhappy path tests
npm run test:chain:local         # All Anchor tests with auto local validator
```

### Demo and Smoke

```bash
npm run demo:s1:devnet           # Seed S1 market + buyout on devnet
npm run demo:s2:devnet           # Seed S2 happy path on devnet
npm run demo:s1:full-corridor    # Full S1 corridor on devnet
npm run demo:s2:full-corridor    # Full S2 corridor on devnet
npm run smoke:production-corridor # End-to-end production corridor smoke
npm run demo:seed:localnet       # Seed actors on local validator
```

### Prisma

```bash
cd backend
npm run prisma:generate          # Generate Prisma client
npm run prisma:migrate           # Run dev migration
npm run prisma:migrate:deploy    # Apply production migrations
```

## Anchor Program (On-Chain)

### Instruction Set (32 instructions)

**Protocol admin:**
`initialize_protocol`, `migrate_legacy_protocol_config`, `update_protocol_s1_emission`, `emergency_void`

**Creator lifecycle:**
`register_creator`, `upgrade_creator`, `anchor_content_hash`, `update_creator_s1_rating`

**S1 token market and buyout:**
`buy_s1_token`, `sell_s1_token`, `init_s1_buyout`, `submit_buyout_offer`, `accept_buyout_offer`, `cancel_buyout_offer`, `reclaim_expired_buyout_offer`, `rage_quit_s1`, `execute_s1_graduation`, `claim_s1_buyout_usdc`

**S2 campaigns (3-track settlement):**
`create_proposal`, `sponsor_fund`, `endorse_proposal`, `settle_track1_base`, `settle_track2`, `settle_track3_cps`, `claim_endorsement`, `cancel_proposal`

**Users, rewards, and organizations:**
`register_user`, `claim_daily_spump`, `claim_engagement_reward`, `create_organization`, `add_organization_member`

**Archived (not in active routing):** `submit_oracle_report`, `settle_proposal` — superseded by per-track settlement.

### On-Chain Accounts (PDA State)

| Account | Purpose |
| --- | --- |
| `ProtocolConfig` | Global admin, oracle, mints, tax/emission/S1/S2 params |
| `CreatorProfile` | Creator handle, level, S1 status/supply/rating, payout ATA |
| `UserProfile` | User level, roles, XP, activity score, daily claim state |
| `ContentHashAnchor` | Canonical URL + content digest anchor per post |
| `Proposal` | S2 campaign: Track 1/2/3 terms, funding, settlement state |
| `EndorsementPosition` | Fan Track 2 stake per user/proposal |
| `S1UserPosition` | Per-user S1 holdings, cost basis, daily buy limits |
| `S1BuyoutState` | Buyout vault, claimable USDC/supply, rage-quit deadline |
| `S1BuyoutOffer` | Individual sponsor buyout bid |
| `UpgradeReceipt` | Immutable creator level-upgrade audit record |
| `UserRewardReceipt` | Immutable engagement/mission reward audit record |
| `Organization` | Org profile (creator OPC, sponsor brand, MCN) |
| `OrganizationMembership` | User-org role mapping |

### Error Enum

`StreamPumpError` has 65 variants covering: general (math, auth), creator (handle, status, rating), S1 market (balance, caps, tax), S1 buyout (offer state, rage-quit window), proposals (funding, settlement, claim), content (digest mismatch, anchor), users/orgs, SPUMP mint validation, and migration.

## Product Layers

### Season 1 (S1): Creator Discovery Market

Fans burn non-transferable SPUMP to back creators early. Positions are internal PDAs on a rating-adjusted quadratic bonding curve. An oracle evaluates creator momentum and adjusts ratings. Anti-speculation guardrails include: non-transferable token, daily buy caps, dynamic exit tax, delayed rating activation, and early-cohort buyout caps.

When a creator reaches critical mass, sponsors submit buyout offers. After creator acceptance and a rage-quit window, graduation executes. Remaining backers claim their share of buyout USDC proportional to position size.

### Season 2 (S2): Sponsored Campaign Market

Sponsors fund creator campaigns through three budget tracks:

| Track | Model | Settlement |
| --- | --- | --- |
| Track 1 | Fixed base pay | Unconditional creator payout |
| Track 2 | Performance budget | Cliff threshold; 80% creator / 20% fan endorsement pool |
| Track 3 | CPS (cost per sale) | Delayed settlement after refund window |

Campaign lifecycle: content manifest -> proposal intent -> creator signs -> sponsor signs/funds -> Solana vault -> track settlement.

## Database Schema (Prisma)

Key models and their purpose:

| Model | Purpose |
| --- | --- |
| `Proposal` | On-chain proposal projection with track budgets and settlement state |
| `ContentManifest` | Content version with assets, status, publication eligibility |
| `ContentAsset` | Individual media files with R2 storage keys and Mux processing state |
| `ContentPublication` | External platform publication records with verification |
| `ProposalIntent` | Business-draft intent before on-chain proposal exists |
| `TxBundle` | Serialized transaction bundles for multi-signer flows |
| `ChainEvent` | Indexed on-chain events from the Anchor program |
| `CreatorMarketProjection` | S1 market state projection (price, supply, stage) |
| `S1PositionProjection` | Per-user S1 position balances and cost basis |
| `S1BuyoutOfferProjection` | Buyout offer state projection |
| `S1BuyoutProjection` | Creator buyout lifecycle projection |
| `CampaignProofProjection` | Campaign proof state for public/auth views |
| `WalletAuthChallenge` | Wallet signature auth challenges |
| `EmailAuthChallenge` | Email OTP challenges |
| `WalletSession` | Active wallet sessions |
| `AuthIdentity` | Social/email identity to managed wallet mapping |
| `AccountProfile` | User profile with role, display name, handle |
| `Track2Event` | Performance metric events with fraud scoring |

## Backend Architecture

### Entry and Bootstrapping

- `backend/index.ts` — starts Express on PORT (default 4000)
- `backend/src/app.ts` — CORS, JSON parser, `GET /health`, mounts `/api`
- `backend/src/startup.ts` — starts background services: indexer, Mux reconciliation, oracle scheduler

### API Route Tree

```
/health                           Health check
/api/v1/auth/*                    Wallet challenge/verify, email OTP, provider exchange, session
/api/v1/account/me                Account profile read/write (session required)
/api/v1/feed/posts                Public content feed
/api/v1/market/*                  Market overview, trending, creator profile, portfolio
/api/v1/content/*                 Manifest CRUD, presign uploads, finalize, publications (session required)
/api/v1/proposal-intents/*        Intent lifecycle: create, lock, build-bundle, sign, submit (session required)
/api/v1/proposals/:id             Read confirmed proposals
/api/v1/campaigns/:id/public      Public campaign proof
/api/v1/s1/*/build                S1 transaction builders (register, buy, sell, rage-quit, buyout lifecycle)
/api/v1/s1/transactions/*         Submit signed txs + poll status
/api/v1/workspace                 Creator workspace overview (session required)
/api/v1/internal/mux/*            Manual Mux reconciliation triggers
/api/prototype/*                  Legacy: view events, user profiles, video feed
/api/webhooks/clicks              Click ingestion
/api/webhooks/mux                 Mux webhook (raw body for signature verify)
```

### Key Services

| Service | Responsibility |
| --- | --- |
| `auth.ts` | Wallet challenge/verify, email OTP, provider identity, session tokens |
| `accountProfile.ts` | Account profile CRUD |
| `AnchorService.ts` | On-chain program interactions (settlements, state fetch) |
| `proposalLaunchService.ts` | Launch bundle building, PDA derivation, tx encoding |
| `contentManifestService.ts` | Canonical manifest hashing, finalize state |
| `chainProjectionService.ts` | Sync proposal projection from chain state |
| `marketProjectionService.ts` | S1/creator market read models, portfolio, campaign proof |
| `indexer.ts` | Solana program log indexer -> DB projections |
| `MuxService.ts` | Mux API wrapper (upload, asset status) |
| `R2Service.ts` | Cloudflare R2 presign/multipart upload |
| `muxReconciliationService.ts` | Mux ingest queue + stale asset reconciliation |
| `solanaSettlement.ts` | PDA derivation + oracle/creator upgrade submission |
| `viewOracleAggregator.ts` | In-memory view signals and settlement reports (prototype) |
| `antiCheat.ts` | View event fraud evaluation |

### Auth Middleware

`walletAuth.ts` provides: `requireSessionAuth` (Bearer wallet session, used by most v1 write routes), `optionalSessionAuth` (enriched reads), `optionalWalletAuth` (legacy header fallback in dev). S1 mock token support for demos when `s1.mockApiEnabled`.

### Background Jobs

| Job | Trigger | Purpose |
| --- | --- | --- |
| Indexer | Boot (continuous) | Subscribes to Solana program logs, ingests events into DB projections |
| Mux reconciliation | node-cron | Ingest queued Mux assets + reconcile stale processing |
| Oracle scheduler | node-cron per track | Settle funded proposals on-chain (Track 1/2/3) |

## Frontend Architecture

### Layout Pattern

Consumer pages use `UserShell` (sidebar nav). Workspace pages use `WorkspaceShell` (creator sidebar). Optional `PageShell` wraps content with title/tabs. Wallet providers are **opt-in** per page via `Component.requiresWalletProviders = true`.

### Component Directories

| Directory | Purpose |
| --- | --- |
| `components/layout/` | `PageShell`, `AppBootGate` (first-visit splash) |
| `components/user/` | `UserShell`, `UserTopbar`, `DiscoverSurface`, `PostCard`, `CommentPanel` |
| `components/workspace/` | `WorkspaceShell`, `OverviewConsole`, `CreationCenter`, `SponsorshipDesk` |
| `components/auth/` | `AuthOptionsPanel` |
| `components/portfolio/` | `PortfolioSections` |
| `components/s1/` | `S1TransactionDrawer` |
| `components/shared/` | Charts, `MediaVideoPlayer`, `LanguageSwitch`, glass-style building blocks |
| `components/Wallet/` | `ClientProviders`, `WalletContextProvider`, `Web3AuthContext` |

### Hooks

| Hook | Purpose |
| --- | --- |
| `usePublicFeedPosts` | Client fetch/merge for public posts |
| `usePublicFeedViewModel` | Feed/activity view models (API + mock fallbacks) |
| `useProgram` | Anchor `Program` from wallet + IDL |
| `useBondingCurve` | S1 bonding curve state |
| `useS1TransactionFlow` | Build -> sign -> submit S1 txs |

### API Client

`lib/api/client.ts` — shared fetch wrapper with base URL from `NEXT_PUBLIC_BACKEND_BASE_URL/api/v1`, timeout, Bearer token, `{ ok, data }` envelope. Modules: `feed.ts`, `workspace.ts`, `s1.ts`, `auth.ts`, `account.ts`.

### i18n

Custom in-app i18n (not next-intl). `I18nProvider` + `useI18n()` with `zh` | `en` locales (default `zh`). ~400 keys each. Persisted in `localStorage` key `streampump.locale`.

### Styling

Tailwind CSS 3 utilities + custom glass/liquid design system in `globals.css` (CSS variables, `liquid-glass-shell`, `glass-button-primary`, gradient backgrounds, CJK-friendly font stack). Not a component library.

## Frontend Routes

```
/explore                              Public content feed
/trending                             Trending content
/posts/[postId]                       Post detail
/creators/[creatorId]                 Creator profile
/market/[creatorId]                   S1 market buy/sell
/buyout/[creatorId]                   S1 buyout claim/rage-quit
/portfolio                            User S1 holdings and claims
/activity                             Activity feed
/rewards                              Daily SPUMP claim and missions
/me                                   User profile
/login                                Auth entry (wallet/email/social)
/onboarding                           Role selection and profile setup
/workspace                            Creator/sponsor workspace overview
/workspace/content/new                Content creation wizard
/workspace/content/[manifestId]       Content detail and recovery
/workspace/intents/[intentId]         Proposal intent signing flow
/workspace/buyout                     Sponsor buyout desk (preview)
/workspace/sponsorships               Sponsorship management (preview)
/campaigns/[proposalId]               Campaign detail with chain proof
/campaigns/[proposalId]/endorse       Fan endorsement (preview)
/campaigns/[proposalId]/settlement    Settlement status (preview)
/demo                                 Demo hub with boundary labeling
/pitch                                Presentation support route
```

## Environment Variables

### Frontend (`app/.env.local`)

```
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:4000
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_IMAGE_REMOTE_HOSTS=pub-b0acd300bcec4dc5ba5ea36628dd809f.r2.dev
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=...
NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH=false
```

### Backend (`backend/.env.local`)

```
DATABASE_URL=...                       # Postgres connection (pooled)
DIRECT_URL=...                         # Postgres direct connection
PORT=4000
API_BASE_URL=http://localhost:4000
CORS_ALLOWED_ORIGINS=http://localhost:3000
AUTH_SESSION_SECRET=...
SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
STREAMPUMP_PROGRAM_ID=FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp
R2_REGION=auto
R2_BUCKET=...
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BASE_URL=...
R2_MAX_ASSET_SIZE_BYTES=104857600      # 100 MiB per asset
R2_MONTHLY_UPLOAD_LIMIT_BYTES=10737418240  # 10 GiB monthly
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
```

### Demo Backend Defaults (conservative)

These should stay off for public demos. Enable preview social auth only for explicitly labeled local/demo recordings.

```
AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE=false
AUTH_ALLOW_LEGACY_WALLET_HEADER=false
INDEXER_ENABLED=true
MUX_RECONCILIATION_ENABLED=false
MUX_RECONCILIATION_RUN_ON_BOOT=false
ORACLE_SCHEDULER_ENABLED=false
ORACLE_RUN_ON_BOOT=false
ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED=false
```

## Current Development Status (2026-05-18)

### What Is Verified and Working

The first production corridor is verified end-to-end on devnet:

```
authenticated creator (wallet challenge session)
-> create/upload/finalize content through R2/Mux/backend
-> post appears in public feed and post detail from backend projection
-> creator opens a real proposal intent from that content
-> creator and sponsor sign the launch bundle
-> backend relays the transaction to Solana
-> campaign detail shows verifiable proof state (PDA, tx sig, manifest hash)
```

AccountProfile migration is applied to Neon. Page-readiness audit is complete for all routes with readiness labels. Current priority is pilot hardening: expose the verified corridor through normal UI, strengthen account management, improve campaign proof fields, add operator visibility, and retire preview-only flows only after real chain/API projections exist.

### Readiness Status by Area

| Area | Status |
| --- | --- |
| S1 market buy/sell | `SEEDED_DEMO` — works with seeded devnet state |
| S1 portfolio/claim | `SEEDED_DEMO` — claim from graduated buyout |
| S1 buyout formation | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` — not productized in UI |
| S2 proposal launch | `SEEDED_DEMO` — full corridor verified |
| S2 endorsement | `MOCK_PREVIEW` — local simulator only |
| Settlement Track 1/2 | `SEEDED_DEMO` — works with controlled data |
| Settlement Track 3 | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` — no merchant integration |
| Media publication | `BACKEND_READY_UI_GAP` — R2/Mux plumbing exists, recovery incomplete |
| Auth/wallet sessions | `SEEDED_DEMO` + `MOCK_PREVIEW` — AccountProfile exists, provider verification pending |
| Rewards | `MOCK_PREVIEW` — local preview only |
| Operator tooling | `OPERATOR_REQUIRED` — no dashboards yet |

### Remaining Major Gaps

- Production auth and managed-wallet mapping still need hardening beyond preview/provider exchange paths.
- Media needs stronger retry/resume UX, deployed smoke checks, reconciliation visibility, and recovery controls.
- Workspace still has preview/persona fallbacks that should be narrowed as live APIs mature.
- S1 self-serve creator onboarding, rating provenance, daily cap usage, and full projection coverage are incomplete.
- S1 buyout offer creation, creator acceptance, graduation, reclaim, and re-entry are not fully productized through UI.
- S2 endorsement and rewards are still preview/local unless a task explicitly implements the real SPUMP burn/endorsement/reward ledger flow.
- Settlement Track1/Track2 can be operated against controlled data, but production oracle/operator dashboards are missing.
- Track3 CPS still uses a stub and must remain gated until a real merchant/reconciliation provider exists.
- Operator dashboards, deployment health checks, abuse controls, and audit hardening remain future work.

### Roadmap Priority Order

Use this order when no narrower user instruction overrides it:

1. Harden the verified production corridor (authenticated creator -> media -> feed/post -> proposal -> campaign proof)
2. Production auth/session/account profile (stable identity, wallet binding, role/profile records, provider verification)
3. Media/feed reliability (retry/resume, Mux/R2 smoke, publication eligibility, no silent local fallback)
4. Workspace/proposal/campaign truth (role-aware errors, projection reconciliation, campaign proof fields)
5. S1 self-serve and buyout lifecycle (creator readiness, rating/cap, buyout offer/accept/graduation/reclaim)
6. S2 endorsement and fan rewards (SPUMP burn/lock, endorsement PDA, reward ledger, claim state)
7. Settlement/oracle/operator tooling (evidence digests, idempotent triggers, Track3 provider gating)
8. Deployment, observability, audit, abuse controls, and pilot launch readiness

## Key Conventions and Rules

### Git

- **Never modify `main`.** It is the frozen hackathon submission branch.
- Work on `codex/post-deadline-phase-0` only.
- Treat uncommitted changes as user-owned. Do not revert, delete, or overwrite them unless the user explicitly asks.
- **Protected files** — do not stage, commit, delete, or rewrite:
  - `backend/package-lock.json`
  - `pitch/colosseum-submission.md`
  - `pitch/demo-youtube-description.md`
- Use explicit `git add <path>` only. Never `git add .` or `git add -A`.
- Do not commit secrets, `.env.local`, local keypairs, demo private keys, generated ledgers, local DB dumps, or node/build artifacts.
- Before any commit, run `git status --short` and confirm protected files are not staged.
- Install git hooks: `./scripts/install-git-hooks.sh` (blocks secret patterns).

### Product Boundaries

Do not overstate readiness. A route can be visually polished and still be `SEEDED_DEMO`, `MOCK_PREVIEW`, `BACKEND_READY_UI_GAP`, or `OPERATOR_REQUIRED`.

Non-negotiable boundaries:

- `SPUMP` is utility-only and non-transferable. Do not make it transferable or list it on DEX/CEX.
- S1 creator positions are internal virtual positions in protocol state, not creator SPL tokens.
- Fans/backers earn potential USDC from sponsor-funded outcomes, not from secondary-market speculation.
- Sponsors are marketing spenders, not financial investors.
- Do not present local fixtures, seeded data, preview auth, mock settlement, or operator-prepared state as production behavior.
- Keep readiness labels and source notices on any fallback/demo/preview surface.
- Do not invent fake integrations for OAuth, Web3Auth, R2, Mux, RPC, merchant reconciliation, metric providers, or oracle networks.
- Financial values shown from DB must be traceable to chain state or clearly labeled as projection/preview/seeded.
- Keep workflow state DB-first and financial truth chain-first.

### Anchor Build

`npm run build:anchor` stores Cargo/Anchor artifacts in `/private/tmp/streampump-anchor-target` to avoid macOS Desktop/iCloud file-provider stalls. Override with `CARGO_TARGET_DIR` if needed.

### Verification Checklist

| Change type | Minimum checks |
| --- | --- |
| Docs only | `git diff --check`; confirm protected files not staged |
| Frontend UI | `npm run build --prefix app`; browser smoke |
| Backend API/service | `npm run build --prefix backend`; targeted tests |
| Prisma/schema | Migration review, backend build, affected tests |
| Chain program | `npm run build:anchor` or `cargo check`; targeted Anchor tests |
| S1 milestone | S1 devnet smoke + projection/chain consistency |
| S2 milestone | S2 launch smoke + campaign proof/settlement check |
| Media milestone | R2 upload smoke + Mux webhook/reconciliation smoke |
| Deployment milestone | Vercel app health, Render `/health`, CORS/API smoke |

### Blocker Policy

Stop and report instead of inventing fake behavior when a task requires:

- OAuth/Web3Auth/passkey dashboard setup
- Production secrets or key rotation
- Cloudflare R2 bucket/CORS changes
- Mux webhook configuration
- Paid RPC provider setup
- Neon production migration approval
- Vercel/Render dashboard changes
- Real metric provider contract
- Real merchant/reconciliation provider
- Legal/business rules for sponsor offers, creator eligibility, or fraud review

When blocked, continue with adjacent safe work: improve state visibility, add idempotent backend transitions, add tests, add operator runbook text, add dev-only smoke scripts, remove misleading copy, or isolate prototype routes.

### Coding Rules

**General:**

- Prefer existing patterns and helpers over new abstractions.
- Keep changes narrowly scoped to the requested surface.
- Preserve strict TypeScript behavior in `app` and `backend`.
- Use structured parsers/APIs where available instead of ad hoc string parsing.
- Add comments only for non-obvious logic.
- Keep generated artifacts out of commits unless explicitly required.

**Backend:**

- Keep v1 routes under `backend/src/routes/v1`.
- Keep legacy/prototype behavior isolated from the v1 product contract.
- Use `requireSessionAuth` for authenticated write/read routes that need current-user state.
- Require idempotency keys for mutating proposal/content flows where existing controllers already enforce them.
- Return the existing API envelope style through controller helpers (`ok`, `fail`, `withController`).
- Treat Prisma migrations as contract changes. Review them with affected service/controller tests.
- Production migration/deployment actions require explicit approval and environment ownership.

**Frontend:**

- Use API adapters in `app/src/lib/api/*`; do not scatter raw fetch calls through pages.
- Keep live, empty, blocked, unauthenticated, wallet mismatch, API failure, seeded demo, and mock preview states visually distinct.
- Keep `ProductReadinessBanner` or equivalent source notices on mixed-readiness surfaces.
- Do not silently substitute local mock data for production claims.
- Use existing layout/shared components before adding one-off component systems.
- After significant UI work, run a browser smoke and inspect for loading overlays, console errors, text overflow, and incorrect readiness claims.

**On-chain:**

- Keep program changes inside `programs/streampump-core` aligned with existing instruction/state/event structure.
- Update tests when changing account constraints, PDAs, status transitions, economics, or settlement math.
- Never weaken S1 anti-speculation rules or SPUMP non-transferability.
- Do not change program IDs, PDA seeds, or financial semantics casually — treat those as audit-sensitive.

**Media and storage:**

- Use `R2_*` environment variables for object storage. AWS SDK is only the transport.
- Avoid long-term public feed dependence on signed read URLs where a public/cacheable R2 delivery path is intended.
- Keep Mux webhook and reconciliation behavior observable and recoverable.

**Oracle and settlement:**

- Keep Track3 automatic settlement disabled unless explicitly testing controlled data.
- Do not replace the Track3 stub with pretend data — a real merchant/reconciliation source is required before promotion.
- Settlement actions must be idempotent and observable.

### Documentation Rules

- Update `docs/streamPump-long-term-roadmap.md` progress ledger when a task changes product readiness, route/API behavior, smoke status, or known blockers.
- Keep README/DEMO claims aligned with the actual code and smoke results.
- Document blockers instead of hiding them behind optimistic copy.
- Use readiness status names consistently: `LIVE`, `SEEDED_DEMO`, `MOCK_PREVIEW`, `BACKEND_READY_UI_GAP`, `OPERATOR_REQUIRED`, `NOT_STARTED`.
- Retire mocks in the order defined in `docs/streamPump-long-term-roadmap.md`. Each retirement must include code, verification, and documentation updates. Do not promote a surface by changing copy alone.

### Agent Work Loop

1. Confirm branch and working tree: `git branch --show-current` and `git status --short`.
2. Read the required context documents for the target surface.
3. Inspect actual code paths: frontend page, API client, backend route/controller/service, Prisma model, chain instruction, tests, and docs as relevant.
4. State the current real behavior before making a claim.
5. Implement one coherent improvement at a time.
6. Verify with the smallest meaningful command set.
7. Record readiness/blockers in docs when the product boundary changes.
8. Report what changed, what was verified, and what remains blocked.

## Test Inventory

### Anchor Tests (`programs/tests/`)

| File | Focus |
| --- | --- |
| `s1-happy-path.spec.ts` | S1 market happy path |
| `s1-unhappy-path.spec.ts` | S1 failure cases |
| `s1-guards.spec.ts` | S1 anti-abuse guardrails |
| `s1-buyout.spec.ts` | S1 buyout lifecycle |
| `s1-buyout-unhappy-path.spec.ts` | S1 buyout edge cases |
| `s2-unhappy-path.spec.ts` | S2 proposal failures |
| `s2-traffic-market.spec.ts` | S2 traffic/campaign market |
| `s2-expired-open-proposal.spec.ts` | Expired proposal handling |
| `phase1-launch-flow.spec.ts` | End-to-end launch flow |
| `helpers/test_context.ts` | Shared test setup |

### Backend Tests (`backend/tests/`)

| File | Focus |
| --- | --- |
| `authService.spec.ts` | Wallet challenge/verify, provider session |
| `accountProfileService.spec.ts` | Profile create/update |
| `indexer.spec.ts` | Event parsing, account mapping |
| `marketProjectionService.spec.ts` | Serializers, campaign proof projection |
| `s1MarketProjectionHappyPath.spec.ts` | S1 discovery -> buyout -> graduation |
| `s1MarketProjectionUnhappyPath.spec.ts` | Cancelled offers, rage quit, config updates |
| `s1ActionController.spec.ts` | Tx signer validation, projection sync |
| `s1Policy.spec.ts` | Creator rating + emission policy math |
| `proposalLaunchService.spec.ts` | Bundle building, PDAs, signing |
| `proposalIntentController.spec.ts` | Bundle reuse, signature extraction |
| `muxReconciliationService.spec.ts` | Mux ingest/reconcile eligibility |

## Local Infrastructure

- `docker-compose.local-db.yml` — Postgres 16 on port 5433 for local dev
- `.githooks/pre-commit` — runs `scripts/git-hooks/secret-guard.sh` on staged files
- `.local/` — local Solana backups, devnet seed outputs, demo reports. Treat as machine-local output unless a task explicitly says otherwise.
- `test-ledger*/` — local validator state for Anchor tests
- macOS iCloud/Desktop path workaround: builds can stall under Desktop. `npm run build:anchor` uses `/private/tmp` target dir. See `DEMO.md` for Node build workarounds if file-provider issues arise.

## Known Caveats

- **Stale program ID in frontend**: `app/src/hooks/useProgram.ts` and `app/src/utils/solana.ts` reference `EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre` — the canonical program ID is `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp` (used by backend, Anchor.toml, and all on-chain tests).
- **No monorepo workspace tool** — three separate `npm install` targets (root, app, backend); not using Turborepo, Nx, or pnpm workspaces.
- **macOS iCloud/Desktop path** — building under Desktop can trigger file-provider `ECANCELED` errors. Anchor build uses `/private/tmp` target dir as workaround. For serious dev, consider cloning to `~/Projects/`.
- **Program not audited** — stated in README. Anchor instruction interface should be frozen before audit.
- **No CI pipeline** — no GitHub Actions workflows in the main project (only in `third_party/`).

## Prisma Migrations

| Migration | Scope |
| --- | --- |
| `20260315014000_init_with_media` | Initial schema + media models |
| `20260325103000_content_manifest_v1` | Content manifests |
| `20260329120000_phase1_launch_bundle` | Launch bundles |
| `20260329143000_wallet_auth_sessions` | Wallet auth |
| `20260329183000_mux_reconciliation_indexer_phase_a` | Mux + indexer |
| `20260415170000_add_auth_identity_mapping` | Auth identities |
| `20260420233500_public_feed_projection` | Public feed |
| `20260430120000_market_read_models` | Market read models |
| `20260509120000_email_otp_auth` | Email OTP |
| `20260517143000_account_profile` | Account profiles (latest) |

## Documentation Index

| Document | Purpose |
| --- | --- |
| `README.md` / `README.zh-CN.md` | Project overview, setup, demo path (EN/ZH) |
| `DEMO.md` | Controlled S1/S2 demo runbook |
| `docs/streamPump-long-term-roadmap.md` | Full roadmap, progress ledger, mock retirement order |
| `docs/product-readiness-phase-0.md` | Post-hackathon readiness boundary |
| `docs/streamPump-page-readiness-goal.md` | Page-level optimization prompt |
| `docs/protocol/s1-market-design.md` | S1 economics and guardrails |
| `docs/backend/proposal-launch-api-contract.md` | DB-first launch API contract |
| `docs/backend/env-and-vendor-guide.md` | Backend environment and vendor setup |
| `docs/backend/aws-media-access-runbook.md` | Media storage operations |
| `docs/backend/vercel-render-deployment.md` | Deployment notes |
| `docs/backend/account-wallet-model.md` | Account and wallet data model |
| `docs/backend/prisma-migration-content-manifest.md` | Content manifest migration notes |
| `docs/frontend/design.md` | Frontend design system |
| `docs/frontend/user-surface-ui-spec.md` | UI specification |
| `docs/frontend/phase1-frontend-development-plan.md` | Frontend development plan |
| `docs/progress-review-2026-04.md` | Previous progress review |
| `pitch/script.md` | Pitch deck script |

## License

- On-chain programs (`programs/`): Apache License 2.0
- Backend, frontend, scripts, docs: Business Source License 1.1 (converts to Apache 2.0 on 2030-04-20)

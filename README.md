# StreamPump

StreamPump is a Web2.5 creator sponsorship market. Creators package content and campaign terms, sponsors fund real budgets, fans participate in creator momentum, and final financial settlement happens on Solana.

简单说：StreamPump 不是单纯的 fan token，也不是传统 influencer CRM。它把“内容创作、赞助预算、粉丝参与、链上结算”放进同一个产品流程里，让创作者增长可以被资助、被验证、被结算。

## Product Model

StreamPump has two connected product layers:

- **Season 1 / Creator Discovery Market**  
  Fans use non-transferable `SPUMP` to back creators early. `SPUMP` is burned into creator-specific virtual S1 positions priced by a rating-adjusted bonding curve. Creator momentum is tracked by the protocol, and sponsors can make buyout-style offers before a creator graduates into the sponsorship market.

- **Season 2 / Sponsored Campaign Market**  
  Sponsors fund campaigns with three budget tracks: fixed creator base pay, performance-based budget, and delayed CPS-style payout after the return window closes.

`SPUMP` is designed as a non-transferable Token-2022 participation asset. It is product fuel and reputation-linked participation, not a DEX-first speculative token.

### Season 1 Mechanics

S1 is not a freely transferable fan-token market. Users burn `SPUMP` to receive an internal creator position recorded in `S1UserPosition`; no creator SPL token is minted.

The S1 bonding curve is now parameterized by an oracle-updated creator momentum rating:

```text
effective_k = base_k * creator_rating_bps / 10_000
buy cost = effective_k / 2 * ((S + dS)^2 - S^2)
sell return = effective_k / 2 * (S^2 - (S - dS)^2)
```

Default rating is `10_000` (1.0x), bounded between `5_000` and `20_000` (0.5x-2.0x), with a daily change cap and one-epoch delayed effectiveness. The initial graduation target is `2,500` virtual S1 supply so that the earliest supporters can matter in a small buyout, while later creator cohorts can use higher targets.

Daily `SPUMP` emission is also configurable through the protocol config. The intended launch setting is `10x` below 1,000 active users, then deterministic decay toward `2x` and finally `1x` as the platform matures. New accounts receive reduced emission during the new-user window.

S1 participation now requires a registered user profile with fan role and minimum activity score. The protocol also enforces a `15 SPUMP / user / creator / day` buy budget cap and separates early-cohort buyout claims into a capped pool, so the first supporters can have meaningful upside without being able to absorb an unlimited share of a sponsor buyout.

See [docs/protocol/s1-market-design.md](docs/protocol/s1-market-design.md) for the current parameter rationale and anti-arbitrage guardrails.

## Architecture

The repo is intentionally hybrid:

- **DB-first for product workflow**: drafts, content manifests, uploads, media processing, proposal intents, retries, and workspace state.
- **Chain-first for financial truth**: sponsor funding, proposal creation, final settlement, refunds, and protocol token mint/burn paths.

This keeps common product actions fast while preserving on-chain settlement guarantees for high-value financial actions.

## Current Status

This is a serious prototype moving toward a usable product, not a polished production app.

Already in place:

- Anchor program for core S1/S2 protocol state and settlement paths.
- Non-transferable `SPUMP` checks and core protocol account model.
- S2 proposal funding and settlement primitives.
- Content anchoring support on-chain.
- Backend data model for `ContentManifest`, `ProposalIntent`, `TxBundle`, and confirmed `Proposal` projections.
- v1 backend routes for wallet/session auth, content manifests, proposal intents, workspace overview, public feed, and proposal reads.
- Mux, S3-compatible storage, Neon/Postgres, reconciliation, and chain indexing support.
- Next.js frontend surfaces for discover, activity, trending creators, portfolio, profile, login, post detail, and workspace flows.

Known gaps:

- The frontend still has prototype-driven public/social surfaces.
- Workspace and campaign flows are only partially wired to production-grade user actions.
- Daily rewards, quests, dispute/review workflows, and operator dashboards are unfinished.
- Production media playback, mobile polish, and deployment hardening still need work.
- Vercel deployment status is currently unverified from this repo because there is no local `.vercel/project.json` or `vercel.json`.

## Monorepo Layout

```text
programs/streampump-core     Anchor program (Rust)
programs/tests               Anchor TypeScript tests
backend/                     Express API, Prisma, storage, Mux, indexer, schedulers
app/                         Next.js frontend
docs/                        Architecture notes, API contracts, deployment notes
scripts/                     Local helper scripts and Git hooks
local-post-assets/           Local seed content for development
third_party/                 Vendored Rust dependencies used by the Anchor workspace
```

## Local Setup

Install dependencies per package as needed:

```bash
npm install
cd app && npm install
cd ../backend && npm install
```

Recommended local env files:

```bash
cp app/.env.example app/.env.local
cp backend/.env.example backend/.env.local
```

Fill real secrets only in `.env.local`. Env files are ignored by Git.

### Frontend

```bash
cd app
npm run dev
```

Important frontend env vars:

- `NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:4000`
- `NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com`
- `NEXT_IMAGE_REMOTE_HOSTS=dhtrwpa2mlguo.cloudfront.net` for remote media optimized through `next/image`
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=...` only if Web3Auth social login is enabled

The frontend prefers `NEXT_PUBLIC_BACKEND_BASE_URL` and derives `/api/v1` automatically. `NEXT_PUBLIC_API_BASE_URL` is still accepted as a backward-compatible fallback.

### Backend

```bash
cd backend
npm run prisma:generate
npm run build
npm run dev
```

Common backend env vars:

- `DATABASE_URL`
- `DIRECT_URL`
- `PORT`
- `API_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `AUTH_SESSION_SECRET`
- `SOLANA_RPC_ENDPOINT`
- `STREAMPUMP_PROGRAM_ID`
- `S3_*` or compatible storage settings
- `MUX_*`

Local media smoke test:

```bash
cd backend
node scripts/muxVideoSmokeTest.js ../test_files/test_mux.mp4
```

Direct Mux asset inspection:

```bash
cd backend
node scripts/muxAssetStatus.js <muxAssetId>
```

For local Mux webhook testing, run the backend on `:4000`, expose it with Cloudflare Tunnel, register the tunnel URL in Mux, and use that endpoint secret as `MUX_WEBHOOK_SECRET`.

```bash
cloudflared tunnel --url http://127.0.0.1:4000
```

### On-chain Program

```bash
npm run build:anchor
anchor test
```

`npm run build:anchor` keeps Cargo/Anchor artifacts in `/private/tmp/streampump-anchor-target`
by default. This avoids macOS Desktop/iCloud file-provider stalls that can leave
`anchor build` hanging in the repository `target/` directory. Override
`CARGO_TARGET_DIR` if you need a different local cache path.

For a lighter Rust check:

```bash
cargo check
```

## Test Commands

```bash
cd app && npm run build
cd backend && npm run build
cargo check
```

Backend tests:

```bash
npm run test:backend
```

Anchor tests:

```bash
npm run test:anchor
```

## Colosseum Demo Readiness

For the hackathon build, the live demo path is intentionally scoped to S2:

```text
wallet sign-in -> content manifest -> proposal intent -> creator sign -> sponsor sign -> confirmed Solana campaign
```

S1 discovery, portfolio, buyout, and claim screens are read-model/product-vision previews unless explicitly promoted later. The current S1 work is protocol/backend readiness, not a public trading UI launch. Use [DEMO.md](DEMO.md) for the exact runbook, required env toggles, and acceptance checklist.

## Deployment Notes

The current recommended first deployment path is:

- `app/` to **Vercel**
- `backend/` to **Render**
- Neon for Postgres
- AWS S3 or compatible storage for object storage
- Mux for video

For Vercel, the project must use:

- Root Directory: `app`
- Build Command: `next build`
- Required env vars:
  - `NEXT_PUBLIC_BACKEND_BASE_URL`
  - `NEXT_PUBLIC_RPC_ENDPOINT`
  - `NEXT_IMAGE_REMOTE_HOSTS`
- Optional env var:
  - `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`

Do not deploy from the repository root unless the Vercel project settings or a checked-in config explicitly route the build to `app/`.

For the backend, Render should use `backend` as the root directory. A practical first build command is:

```bash
npm ci --include=dev && npm run prisma:generate && npm run build
```

Start command:

```bash
npm run start
```

Run production migrations against the production database:

```bash
cd backend
npm run prisma:migrate:deploy
```

More details live in [docs/backend/vercel-render-deployment.md](docs/backend/vercel-render-deployment.md).

## Git Safety

Install local hooks:

```bash
./scripts/install-git-hooks.sh
```

The hooks block common secret files and obvious credential patterns before commit/push. The shared logic lives in `scripts/git-hooks/secret-guard.sh`.

## Recommended Reading

- [docs/backend/proposal-launch-api-contract.md](docs/backend/proposal-launch-api-contract.md)
- [docs/backend/prisma-migration-content-manifest.md](docs/backend/prisma-migration-content-manifest.md)
- [docs/backend/vercel-render-deployment.md](docs/backend/vercel-render-deployment.md)
- [docs/progress-review-2026-04.md](docs/progress-review-2026-04.md)

## License

This repository uses a dual-license structure:

- On-chain programs under `programs/` are licensed under the [Apache License 2.0](programs/LICENSE).
- Backend, frontend, scripts, and documentation are licensed under the [Business Source License 1.1](LICENSE).

The BSL allows personal learning, testnet experimentation, academic research, and contributions back to this project. Commercial use requires a separate license from the Licensor. On April 20, 2030, all BSL-covered code automatically converts to Apache License 2.0.

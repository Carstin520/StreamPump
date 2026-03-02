# StreamPump v2.0

StreamPump v2.0 is a Web 2.5 creator incubation and traffic betting protocol on Solana.

## Product Model

- Sponsors deposit USDC into a campaign escrow.
- Fans stake SPUMP on a binary outcome (`YES` / `NO`) for a creator's target view count.
- Oracle-verified outcomes settle the campaign and market.
- No AMMs or DEX liquidity pools are used.
- SPUMP is utility-only with sink mechanics: staking and sponsor burn-to-unlock inventory.

## Monorepo Layout

- `/Users/carstin/Desktop/Sol Projects/StreamPump/programs/streampump-core`: Anchor smart contracts.
- `/Users/carstin/Desktop/Sol Projects/StreamPump/programs/tests`: Anchor TypeScript test scaffold.
- `/Users/carstin/Desktop/Sol Projects/StreamPump/app`: Next.js client scaffold.
- `/Users/carstin/Desktop/Sol Projects/StreamPump/backend`: API, storage, anti-cheat, and oracle prep.
- `/Users/carstin/Desktop/Sol Projects/StreamPump/scripts`: local deployment helpers.

## On-Chain Components (Anchor)

Implemented in `/Users/carstin/Desktop/Sol Projects/StreamPump/programs/streampump-core/src`.

### Protocol & Identity

- `initialize_protocol`: sets admin/oracle authority, USDC mint, SPUMP mint, burn policy.
- `register_creator`: creator profile + payout USDC account.

### Content Hash Anchoring

- `anchor_content_hash`: deterministic PDA mapping from URL digest to a permanent on-chain hash record.
- PDA seed pattern: `content_anchor + creator_profile + url_digest`.

### CPA Escrow + Market

- `create_campaign`: creates campaign escrow vault and market vaults.
- `sponsor_deposit`: sponsor USDC deposit into campaign vault.
- `burn_spump_for_inventory`: sponsor burns SPUMP proportional to declared ad spend.
- `place_bet`: user stakes SPUMP on `YES`/`NO`.
- `submit_oracle_report`: oracle authority writes final view count report digest.
- `settle_campaign`: atomic payout routing:
  - predictor reward pool -> market USDC rewards vault
  - creator success payout (if outcome `YES`)
  - sponsor refund remainder
  - losing SPUMP side burned from stake vault
- `claim_market_reward`: winners reclaim SPUMP stake + pro-rata USDC rewards; voided markets return principal.

## Backend Components

Implemented in `/Users/carstin/Desktop/Sol Projects/StreamPump/backend/src`.

### Hybrid Storage (S3 + R2)

- `/Users/carstin/Desktop/Sol Projects/StreamPump/backend/src/services/storage.ts`
- Uploads to S3 origin and mirrors to R2 edge.
- Computes SHA-256 content digest for on-chain anchor flow.

### Anti-Cheat Pipeline

- `/Users/carstin/Desktop/Sol Projects/StreamPump/backend/src/services/antiCheat.ts`
- Scores events using IP dedupe windows, session burst checks, weak fingerprint detection, and interaction-sequence anomalies.
- Emits `ACCEPT/REVIEW/REJECT` verdicts.

### Oracle Reporting Preparation

- `/Users/carstin/Desktop/Sol Projects/StreamPump/backend/src/services/viewOracleAggregator.ts`
- Builds conservative final views from anti-cheat accepted events.
- Produces settlement report digest payloads.

### Chainlink Functions Script

- `/Users/carstin/Desktop/Sol Projects/StreamPump/backend/src/oracle/chainlink/functions/functions-source.js`
- Fetches YouTube/TikTok views and encodes uint256 output for DON execution.

## Security Constraints Applied

- PDA-seeded vault authorities for all token movement.
- Restricted oracle submission (`oracle_authority` only).
- Basis-point and time-bound validations on campaign creation and settlement.
- Atomic settlement path and explicit expiry refund path.
- Explicitly no AMM/DEX logic in contract or backend.

## Quick Start

### Program

```bash
anchor build
anchor test
```

### Frontend

```bash
cd app
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Environment Variables (Backend)

- `PORT`
- `SOLANA_RPC_ENDPOINT`
- `STREAMPUMP_PROGRAM_ID`
- `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
- `R2_REGION`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`
- `ANTICHEAT_MAX_RISK_SCORE`, `ANTICHEAT_IP_WINDOW_MS`, `ANTICHEAT_MIN_INTERACTIONS`
- `CHAINLINK_SOURCE_API_BASE_URL`, `CHAINLINK_GATEWAY_URL`

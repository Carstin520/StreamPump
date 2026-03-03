# StreamPump v2

StreamPump is a Solana creator-growth protocol with oracle-settled sponsor incentives.

## Product Model

- S1: newly registered creators (`level=1`) cannot create proposals.
- S2: oracle/backend can call `upgrade_creator` to unlock proposal creation (`level>=2`).
- Creators create a `proposal` with a target views milestone and deadline.
- Endorsers stake SPUMP to support the proposal.
- Sponsors fund the proposal in USDC.
- Oracle submits final views after deadline and resolves success/fail.
- Settlement routes USDC and SPUMP according to resolved outcome.

## Monorepo Layout

- `programs/streampump-core`: Anchor smart contracts.
- `programs/tests`: Anchor TypeScript test scaffold.
- `app`: Next.js client scaffold.
- `backend`: API, storage, anti-cheat, and oracle prep.
- `scripts`: local deployment helpers.

## On-Chain Components (Anchor)

Implemented in `programs/streampump-core/src`.

### Protocol & Identity

- `initialize_protocol`: sets admin/oracle authority, USDC mint, SPUMP mint, max proposal duration, and S2 thresholds.
- `register_creator`: creator profile + payout USDC account.
- `upgrade_creator`: oracle-authorized creator level upgrade with replay-safe `upgrade_receipt`.
- `anchor_content_hash`: anchor canonical URL digest and content digest on-chain.

### Proposal Lifecycle

- `create_proposal`: creator opens proposal and initializes USDC/SPUMP proposal vaults.
- `endorse_proposal`: endorsers stake SPUMP into the proposal vault.
- `sponsor_fund`: sponsor deposits USDC and moves proposal to `Funded`.
- `submit_oracle_report`: oracle submits `actual_views`, resolving success/fail.
- `settle_proposal`: macro settlement.
  - success: creator gets 80% USDC; remainder becomes endorsers USDC reward pool.
  - fail/void: sponsor USDC is refunded.
- `claim_endorsement`: endorser claims by outcome.
  - success: 100% SPUMP principal + pro-rata USDC reward.
  - fail: 95% SPUMP refund; 5% SPUMP slash to protocol burn/treasury ATA.
  - cancelled/voided: 100% SPUMP principal refund.
- `cancel_proposal`: creator cancels open, unfunded proposal.
- `emergency_void`: admin force-voids proposal.

## Backend Components

Implemented in `backend/src`.

### Hybrid Storage (S3 + R2)

- `backend/src/services/storage.ts`
- Uploads to S3 origin and mirrors to R2 edge.
- Computes SHA-256 content digest for on-chain anchor flow.

### Anti-Cheat Pipeline

- `backend/src/services/antiCheat.ts`
- Scores events using IP dedupe windows, session burst checks, weak fingerprint detection, and interaction-sequence anomalies.
- Emits `ACCEPT/REVIEW/REJECT` verdicts.

### Oracle Reporting Preparation

- `backend/src/services/viewOracleAggregator.ts`
- Builds conservative final views from anti-cheat accepted events.
- Produces settlement report digest payloads.

### Chainlink Functions Script

- `backend/src/oracle/chainlink/functions/functions-source.js`
- Fetches YouTube/TikTok views and encodes uint256 output for DON execution.

## Security Constraints Applied

- PDA-seeded vault authorities for all token movement.
- Restricted oracle submission (`oracle_authority` only).
- Time-bound validations on proposal creation and oracle resolution.
- Macro settlement before user pull-claims.
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

Frontend env:

- `NEXT_PUBLIC_RPC_ENDPOINT`
- `NEXT_PUBLIC_BACKEND_BASE_URL`
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` (optional, for social login)

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

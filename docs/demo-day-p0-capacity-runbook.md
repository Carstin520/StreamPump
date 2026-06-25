# Demo Day P0 Capacity Runbook

This runbook is for the devnet-only managed-wallet demo path:

- `POST /api/v1/auth/ephemeral-session`
- `POST /api/v1/s1/managed/execute`
- `GET /api/v1/s1/managed/jobs/:jobId`

Do not commit `.env*`, keypairs, treasury keys, generated dumps, or funded wallet secrets.

## Required Deploy Settings

Render backend must use paid compute for the live demo and run migrations before startup.

Production startup fails fast for security/runtime prerequisites and warns for capacity tuning gaps:

- `SOLANA_TX_RPC_ENDPOINT` is a dedicated devnet RPC, not `https://api.devnet.solana.com`.
- If `INDEXER_ENABLED=true`, `SOLANA_INDEXER_RPC_ENDPOINT` is set to a separate RPC from `SOLANA_TX_RPC_ENDPOINT`.
- `DATABASE_URL` uses the Neon `-pooler` host and includes `connection_limit=5-10` plus `pool_timeout=5-10` for demo-day load readiness. The backend warns rather than exits when these tuning params are missing so an existing Render service can still boot; `npm run demo:managed-wallet:check` should remain the operator gate before a capacity run.
- `MANAGED_WALLET_ENCRYPTION_KEY` is a 64-char hex secret in Render.

Recommended demo env:

```bash
INDEXER_ENABLED=false
MANAGED_WALLET_JOB_CONCURRENCY=5
MANAGED_WALLET_JOB_SYNC_PROJECTION=false
MANAGED_WALLET_MAX_JOBS_PER_DAY=4
EPHEMERAL_SESSION_IP_LIMIT=30
MANAGED_WALLET_EXECUTE_IP_LIMIT=60
MANAGED_WALLET_EXECUTE_WALLET_LIMIT=10
```

## Wallet Pool

Generate encrypted managed wallets in the database:

```bash
MANAGED_WALLET_POOL_SIZE=200 npm run demo:managed-wallet:pool
```

The script writes `AccountProfile`, `AccountWallet`, and placeholder `AuthIdentity` rows, then prints only public wallet addresses. Fund those addresses from the demo treasury before the event. Do not generate or fund wallets during the scan window.

Before the event, also preseed the demo wallets with the assets required by the selected actions:

- SOL for rent/ATA where needed.
- SPUMP ATA and balance for `buy_s1_token`.
- Seeded creator/S1 state for `buy_s1_token`.
- Seeded S1 buyout/demo-USDC state for `claim-demo-usdc` / `claim-s1-buyout-usdc`.

## Load Test

Run k6 against the deployed backend:

```bash
BASE_URL=https://streampump.onrender.com \
ACTIONS_PER_USER=1 \
EXECUTE_ACTION=claim-daily-spump \
npm run loadtest:demo-day
```

For S1 buy:

```bash
BASE_URL=https://streampump.onrender.com \
EXECUTE_ACTION=buy_s1_token \
CREATOR_WALLET=<seeded_creator_wallet> \
S1_AMOUNT=1 \
npm run loadtest:demo-day
```

Pass gates:

- `/auth/ephemeral-session` p95 `<800ms`, failed rate `<0.5%`, no duplicate wallet assignment.
- `/s1/managed/execute` p95 `<500ms`, failed rate `<0.5%`.
- Job completion p95 `<15s`, p99 `<30s`, success rate `>=98%`.
- RPC `429=0`, Neon connections `<100`, Render CPU `<70%`.

# StreamPump Colosseum Demo Runbook

This runbook keeps the hackathon demo focused on two controlled web3 paths:

1. Seed a devnet S1 creator market with a graduated buyout and claimable holder positions.
2. Open the live S1 market, buy/sell S1, inspect buyout state, claim USDC, and verify portfolio.
3. Creator creates and finalizes S2 content.
4. Creator creates a sponsor proposal intent.
5. Creator signs the launch bundle once.
6. Sponsor signs once and submits.
7. Campaign detail and settlement pages show Solana proof: proposal PDA, transaction signature, manifest hash, content anchor, and track state.

S1 buyout formation is still prepared by seed/operator scripts. The productized live S1 demo path starts from a seeded creator market and graduated/claimable buyout state.

## Environment

Use a non-iCloud/non-Desktop path before final verification. The current Desktop path can trigger macOS file-provider `ECANCELED` reads during Node/TypeScript builds.

```bash
mkdir -p ~/Projects
rsync -a --exclude node_modules --exclude app/node_modules --exclude backend/node_modules \
  "/Users/carstin/Desktop/Sol Projects/StreamPump/" ~/Projects/StreamPump/
cd ~/Projects/StreamPump
npm install
npm install --prefix app
npm install --prefix backend
```

If the repo must stay under the current Desktop path, keep dependency folders out of the file-provider managed tree. The current local workaround is:

```bash
# root deps
mv node_modules node_modules.fileprovider-broken-root
ln -s /tmp/streampump-root-deps/node_modules node_modules

# app deps
mv app/node_modules app/node_modules.fileprovider-broken
ln -s /tmp/streampump-app-build/node_modules app/node_modules

# backend deps
mv backend/node_modules backend/node_modules.fileprovider-broken
ln -s /tmp/streampump-backend-deps/node_modules backend/node_modules
```

After moving backend dependencies, regenerate Prisma Client from the real backend schema:

```bash
cd /tmp/streampump-backend-deps
npx prisma generate --schema prisma/schema.prisma
```

Backend demo defaults should be conservative:

```bash
AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE=false
AUTH_ALLOW_LEGACY_WALLET_HEADER=false
INDEXER_ENABLED=true
MUX_RECONCILIATION_ENABLED=false
MUX_RECONCILIATION_RUN_ON_BOOT=false
ORACLE_SCHEDULER_ENABLED=false
ORACLE_RUN_ON_BOOT=false
ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED=false
```

Only set `AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE=true` and `NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH=true` for local screen recordings where the preview social identities are explicitly part of the script.

## Required Checks

```bash
cargo check
npm run build --prefix backend
npm run build --prefix app
npm run test:backend
```

Run Anchor tests when local validator/tooling is stable:

```bash
npm run test:anchor
```

## S1 Demo Preconditions

The live S1 frontend expects a seeded devnet creator with market, buyout, and portfolio projections:

```bash
# Only needed when the legacy devnet protocol config has not been migrated.
npm run demo:protocol:migrate

npm run demo:s1:devnet
```

The seed writes `.local/devnet-s1-buyout-claim-seed.json` with the creator wallet, sponsor, early/regular holders, buyout state PDA, offer PDA, and key signatures. Use the emitted creator wallet for:

```text
/market/:creatorWallet
/buyout/:creatorWallet
/portfolio
```

The S1 buy/sell/claim UI is live against backend transaction builders and devnet transactions. The buyout offer/accept/graduation sequence is not a product UI yet; it is prepared by the seed script so the demo can start from a graduated, claimable state.

## S2 Demo Preconditions

Before creating a proposal intent, the creator wallet must already have an on-chain creator profile with:

- `status = S2_ACTIVE`
- `level >= 2`
- valid payout USDC ATA

The frontend and backend now fail early if this readiness state is missing. For local validation, the existing Anchor test context provisions S2-ready creators; reuse that setup logic or seed equivalent accounts before the live demo.

For a disposable local validator, seed the same S2-ready actors used by tests:

```bash
solana-test-validator --reset
npm run build:anchor
anchor deploy
npm run demo:seed:localnet
```

The seed script writes `.local/colosseum-demo-seed.json` with generated local demo wallets, mints, ATAs, protocol config, and the S2 creator profile PDA.

## Devnet Backend/Chain Smoke

The backend/chain happy path can be run without frontend review:

```bash
npm run demo:s1:devnet
npm run demo:s2:devnet
```

The script writes reusable devnet actors and the last result to `.local/devnet-s2-happy-path.json`. It uses a disposable SPL token as the protocol USDC mint on devnet. The current script covers launch plus all three settlement tracks:

```text
wallet auth -> manifest -> intent -> creator sign -> sponsor sign -> backend relay
-> Track1 base pay -> Track2 mocked performance settlement -> Track3 mocked CPS settlement
```

Latest verified run:

- Program: `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`
- Protocol config: `GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g`
- Test USDC mint: `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ`
- Proposal PDA: `4GCvzE8u6A557RCTr3sAdPZrs3Kw3aKXvmVNx5oQoRQm`
- Proposal vault: `AcmfUSfS9ZV2a74HZRDCVa2MGMq8mWEKGnt4DbuHD3X7`
- Launch signature: `5YpxYExgwvPUm3eL4QB8TniPyABReCxPCTKd7sy93mhQeK4hBWPWQ1hpmqAQHgBCWLLzCu9hRGyVkLERu5pYv2rx`
- Track1 signature: `5NbgjLRB284h6VfEm9bdrxKTrk1sY2rnAEseGJf9dYJxYxYaXXMh4CawmzGJ2CiZMy4gBhUsJfxLezDSdeee7wg2`
- Track2 signature: `LdaL9ced2Jj7biT3zTntKL2LmUqMjAeKBzwTnj1PgpRv23jZTLHEzcRT9dazbTtWM77EDBEv4GbhG8sp2dP7eB2`
- Track3 signature: `34DCU3FbTVhCm9TJQcArSffX5T1GYS6bJMcfwVtrPmhwJyZEgqpGuaUayKMsb8CVCy1BttGH3i7TV9kRbUuf1NGB`

Latest track setup:

- Track1 fixed base pay: `10` test USDC to creator.
- Track2 performance budget: `20` test USDC, target `1000` views, cliff `50%`, mocked actual value `800`.
- Track2 settlement outcome: achieved `80%`; `16` test USDC achieved budget splits into `12.8` to creator and `3.2` fan pool. Because this smoke has no fan endorsement positions, the `3.2` fan pool refunds to sponsor, and `4` unachieved test USDC also refunds to sponsor.
- Track3 CPS budget: `5` test USDC, `track3DelayDays = 0` for smoke, mocked approved CPS payout `3` test USDC to creator and `2` refund to sponsor.
- Proposal vault after settlement: `0` test USDC.

Role responsibilities in the devnet smoke:

- Admin/deploy payer: owns protocol setup, creates the test USDC mint, creates the Token-2022 SPUMP mint, initializes protocol config, creates creator/sponsor USDC ATAs, and mints test USDC to sponsor.
- Oracle: signs the creator S2 upgrade and Track1/Track2/Track3 settlement transactions.
- Creator: signs wallet auth, registers the creator profile, and signs the proposal launch bundle.
- Sponsor: signs wallet auth, signs the final bundle, pays proposal/vault rent, and transfers test USDC into the proposal vault.
- Backend relay: does not own the proposal terms; it relays the fully signed transaction and finalizes the database projection after confirmation.

Current devnet balances after the latest run:

| Role | Address | Current SOL | Main recurring spend |
| --- | --- | ---: | --- |
| Admin | `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw` | 2.938361760 | setup/idempotent ATA/mint tx fees; protocol setup is already done |
| Oracle | `8ryLHyFQmbx2z28X9B8a7x1Peusaet3Axbe1YA1aSYrk` | 2.497927680 | Track settlement tx fees |
| Creator | `6hZXggy4DhjZTatdqZao55NcghyaFVm3b2RRuPFLXWAL` | 2.498113840 | already registered/S2; signing bundle is off-chain |
| Sponsor | `eZkrM2k1kHyXoVNSLiaebCLSVMfurQjkSjcJu55JCcc` | 3.183498720 | new proposal/vault rent and launch tx fee |

No new SOL is needed for another smoke run at these balances. The sponsor is the role that will drain fastest because each run creates a new proposal and proposal vault.

The earlier program deployment used the admin/deploy payer. That account had 10 SOL after faucet funding and about 2.948 SOL before the smoke run, so deployment consumed roughly 7.052 SOL. Treat that mostly as upgradeable program storage/rent and deployment overhead, not as the recurring cost of launching each proposal.

## Happy Path

1. Start backend and frontend.

```bash
npm run dev --prefix backend
npm run dev --prefix app
```

2. Open `http://localhost:3000/login` and use wallet sign-in.
3. Go to `/workspace/content/new`.
4. Fill details, select media, and create the draft. The wizard uploads selected files, completes the manifest asset records, and finalizes the manifest before redirecting.
5. In content detail, open `赞助合作`, enter the sponsor wallet, budgets, metric, and deadline.
6. Create the proposal intent. If the creator is not S2-ready, seed/upgrade the creator first.
7. On the intent page:
   - creator wallet locks/builds/signs,
   - sponsor wallet signs/submits,
   - backend relays the transaction in `SERVER_RELAY` mode.
8. Open the campaign detail page and verify:
   - `Proposal PDA`
   - `Tx Signature`
   - `Manifest Hash`
   - `Content Anchor`
   - Track 1/2/3 budgets

## Demo Boundaries

See [docs/product-readiness-phase-0.md](docs/product-readiness-phase-0.md) for the frozen post-hackathon readiness matrix.
See [docs/streamPump-long-term-roadmap.md](docs/streamPump-long-term-roadmap.md) for the long-term product target and gap-closing roadmap.

- Do not claim S1 buyout formation is productized in this build; offers, acceptance, and graduation are seeded/operator-driven.
- Do not enable Track3 automatic settlement. Track3 CPS still needs a real merchant/reconciliation source.
- Do not present S2 endorsement or third-party Track3 reconciliation as live integrations.
- Keep oracle scheduler off for the public demo unless manually testing Track1/Track2 with known seeded data.

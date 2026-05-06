# StreamPump Colosseum Demo Runbook

This runbook keeps the hackathon demo focused on one credible web3 path:

1. Wallet sign-in.
2. Creator creates and finalizes content.
3. Creator creates a sponsor proposal intent.
4. Creator signs the launch bundle once.
5. Sponsor signs once and submits.
6. Campaign detail shows Solana proof: proposal PDA, transaction signature, manifest hash, and content anchor.

S1 discovery, portfolio, buyout, and claim screens are product vision/read-model previews for the hackathon build. They are intentionally not presented as live trading surfaces.

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
INDEXER_ENABLED=false
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
npm run demo:s2:devnet
```

The script writes reusable devnet actors and the last result to `.local/devnet-s2-happy-path.json`. It uses a disposable SPL token as the protocol USDC mint on devnet.

Latest verified run:

- Program: `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`
- Protocol config: `GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g`
- Test USDC mint: `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ`
- Proposal PDA: `EiBQG5JgFGsNqGWzZwL8LcPDmDeethty234nYWwCsAzA`
- Proposal vault: `C4QsLYRVfkghoHybQNzWMEDw7hysvh8Jonpc9YR8XX73`
- Signature: `3zjbGTF1DLTJnsh8tH4oD1XkqxPVegsdKT5nHysJqShRGhmAx2JNzdr7cnrozqwDRD7x39m6XSfKFav39Ttc1KJT`

Role responsibilities in the devnet smoke:

- Admin/deploy payer: owns protocol setup, creates the test USDC mint, creates the Token-2022 SPUMP mint, initializes protocol config, creates creator/sponsor USDC ATAs, and mints test USDC to sponsor.
- Oracle: signs the creator S2 upgrade.
- Creator: signs wallet auth, registers the creator profile, and signs the proposal launch bundle.
- Sponsor: signs wallet auth, signs the final bundle, pays proposal/vault rent, and transfers test USDC into the proposal vault.
- Backend relay: does not own the proposal terms; it relays the fully signed transaction and finalizes the database projection after confirmation.

Observed SOL usage for the latest run:

| Role | Address | Before smoke | After smoke | Approx. SOL used | Main reason |
| --- | --- | ---: | ---: | ---: | --- |
| Admin | `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw` | 2.948 SOL | 2.938406760 SOL | ~0.009593240 | test mint rent, SPUMP mint rent, protocol init, ATAs, mint/setup fees |
| Oracle | `8ryLHyFQmbx2z28X9B8a7x1Peusaet3Axbe1YA1aSYrk` | 2.500 SOL | 2.497942680 SOL | ~0.002057320 | S2 upgrade receipt rent and tx fee |
| Creator | `6hZXggy4DhjZTatdqZao55NcghyaFVm3b2RRuPFLXWAL` | 2.500 SOL | 2.498113840 SOL | ~0.001886160 | creator profile rent and tx fee |
| Sponsor | `eZkrM2k1kHyXoVNSLiaebCLSVMfurQjkSjcJu55JCcc` | 3.200 SOL | 3.191749360 SOL | ~0.008250640 | proposal/vault rent, final tx fee, sponsor funding transaction |

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

- Do not claim S1 buy/sell/claim is live in this build.
- Do not enable Track3 automatic settlement. Track3 CPS still needs a real merchant/reconciliation source.
- Keep oracle scheduler off for the public demo unless manually testing Track1/Track2 with known seeded data.

# P4 M6 — Disposable Allowlisted Corridor and Manual Track 1 Replay Runbook

Date authored: 2026-07-13 (Asia/Shanghai)

## Boundary (non-negotiable)

This runbook is for an **invite-only, external-wallet-first, Solana devnet, test-USDC, Track 1‑only, manual/operator-settled controlled technical Pilot**. It is **not** a formal production launch and involves **no real funds**. Every dollar figure below is devnet test-USDC. Do not describe any output as production readiness, real metrics, or a real-funds settlement.

Closed and forbidden for this run: S1 lifecycle, Track 2, Track 3/CPS, endorsement, rewards, managed/email/social auth, public managed execution, and **every** automatic settlement scheduler. Track 1 settlement is manual, operator-authenticated, and oracle-signed only.

M6 is a **separate human gate that has now been explicitly approved for execution.** M2–M5 completed earlier (see [`p4-pre-mutation-checklist.md`](./p4-pre-mutation-checklist.md) and [`p4-rollback-bundle.md`](./p4-rollback-bundle.md)). This document is the approved execution procedure for M6 only. Each mutation group still requires operator confirmation of its own preconditions, and completing M6 only assembles evidence for **H4** — it does not authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed lane.

## Secret handling (applies to every step)

- Never print, paste, commit, or read the value of any private key, seed, RPC URL, database URL, operator key, Mux/R2 secret, session token, or `PILOT_INVITE_WALLETS` mutation payload.
- All keypairs and the RPC env file must be canonical, non-symlink, mode `0600` regular files. The RPC file contains only `PILOT_TX_RPC_URL=<https devnet, credential-free>` plus comments.
- Source secrets from a repository-external mode-`0600` dotenv (`set -a; source <file>; set +a`) — never inline them in argv or in this document.
- Evidence files are mode `0600` and must not be blindly overwritten; a pre-existing evidence file is a stop-and-reconcile condition, not a replay signal.

## Frozen identities and approved amounts

| Item | Value |
| --- | --- |
| Cluster genesis (devnet) | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` |
| Program ID | `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp` |
| ProgramData / capacity / sha256 | `58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs` / 1,328,344 / `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732` |
| ProtocolConfig | `GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g` |
| Approved test-USDC mint (this run only) | `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ` (legacy SPL Token, 6 decimals, no freeze authority) |
| Fee payer | `Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9` |
| Admin / mint authority | `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw` |
| Oracle / settlement authority | `HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC` |
| Disposable creator (fixed for this run) | `EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7` — external wallet; never the fee payer, admin, oracle, or any long-lived wallet |
| Disposable sponsor (fixed for this run) | `BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW` — external wallet; never the fee payer, admin, oracle, or any long-lived wallet |
| Track 1 budget for this run | **1,000,000 raw** test-USDC = 1.0 test-USDC (6 decimals) |

**Signer role separation (enforced):** fee payer, admin/mint authority, oracle, the fixed disposable creator, and the fixed disposable sponsor must be five distinct public keys. The prepare/corridor tooling fails closed on any collision. Settlement is authorized only by the exact frozen oracle key through the operator-authenticated internal route; automatic settlement stays disabled.

Fixed safety caps enforced by the tooling: actor SOL target ≤ 50,000,000 lamports per actor; test-USDC amount ≤ **25,000,000 raw** (`M6_CONSTANTS.hardTestUsdcRawCap`; the Track 1 base cap in `pilot-corridor-config.ts` is the same 25,000,000 raw). This run uses the exact **1,000,000 raw** Track 1 budget and equal mint/sponsor-transfer amounts so the fee-payer ATA nets to zero. Record actual amounts and final balances in the evidence bundle.

---

## Step 0 — Fixed-candidate release gate and rollback readiness (pre-corridor)

M6 mutates a hosted runtime, so the corridor and Track 1 smokes both refuse to run unless the deployed backend release identity matches a fixed candidate commit. Complete this stage before any actor preparation.

> **Current blocking state (as of this revision): M6 is approved but not mutated.** The live backend is still the old M5 commit `73df4e2c7a6367b5b28871510d8ced095e59be6c`; no fixed M6 candidate has been deployed. That live backend returns `/health` HTTP 200 but `/ready` HTTP 503 — `database: READY`, **`indexer: FAILED`**, `muxReconciliation: READY`. A non-`READY` service is a hard stop, so **all deploy and chain mutations remain stopped**. The Fable 5 review of the earlier candidate commit `80be8eb` returned FAIL with 0 blocker, 1 major, and 1 minor finding; those findings are now **closed in the follow-up worktree**, where full backend tests pass (225 passing) alongside the M6 actor-helper, deployment-verifier, and backend build. The newly frozen follow-up HEAD, however, still requires **push, CI, and a fresh Fable 5 PASS before any deploy**. Do not begin actor preparation until that frozen candidate is pushed, CI-green, freshly Fable-reviewed PASS, deployed, and serving a stable `/ready` HTTP 200.

1. **Commit and push the fixed M6 candidate.** Commit the exact M6 corridor/settlement/indexer code on `codex/p4-pilot-deployment` and push it so a complete 40-hex commit SHA is remote-reachable. Auto-deploy stays disabled; nothing deploys from an unpinned branch head. The M6 changes (release-identity gating, `SOLANA_INDEXER_WS_ENDPOINT`, indexer health monitor recovery) and the closed `80be8eb` review findings are now committed on a **frozen follow-up worktree HEAD**; that HEAD still needs to be **pushed** (then CI-green and freshly Fable-reviewed) before this step is satisfied.
2. **One Fable 5 release-review gate — fresh PASS still required.** Run a single Fable 5 review of the pushed candidate diff as the release gate and record its verdict in the evidence bundle. Do not proceed on an unreviewed candidate. **The Fable 5 review of commit `80be8eb` returned FAIL with 0 blocker, 1 major, and 1 minor finding.** Those findings are now **closed in the follow-up worktree**, where full backend tests pass (225 passing) along with the M6 actor-helper, deployment-verifier, and backend build. The follow-up HEAD is frozen but **not yet pushed, CI-checked, or re-reviewed**. **Do not claim PASS.** The frozen candidate must be pushed, pass CI, and clear a fresh Fable 5 re-review before this gate is satisfied.
3. **Verify the dedicated indexer RPC + WS endpoints before deployment.** The hosted Pilot now requires a separate `SOLANA_INDEXER_WS_ENDPOINT` value **in addition to** the separate `SOLANA_INDEXER_RPC_ENDPOINT`. Hosted validation requires the WS endpoint to **correspond exactly** to the RPC endpoint — identical host, port, path, and query string — differing **only** in scheme, and only the `https://` → `wss://` upgrade is allowed. The provider dashboard must supply a matching `https`/`wss` pair for the same app; **any non-matching pair (a difference in host, port, path, query, or a scheme change other than `https`→`wss`) is a hard stop** — this is not merely "use a non-local `wss://`". Before deploying, verify `getSlot`, `slotSubscribe`, and `logsSubscribe` against the **exact** configured endpoints, without printing any credential-bearing URL. The indexer only becomes `READY` once it receives a live slot heartbeat over the WS PubSub subscription, so a WS endpoint that does not support `slotSubscribe`/`logsSubscribe` leaves `/ready` at 503. (See the Alchemy note below: the current key/derived WS path returned JSON-RPC `-32601` for `slotSubscribe`/`logsSubscribe`.)
4. **Pin and deploy the exact commit on Render.** Set the Render env `PILOT_EXPECTED_RELEASE_SHA` to the fixed candidate SHA (the backend fails startup unless it exactly equals `RENDER_GIT_COMMIT`) and deploy that exact commit to service `srv-d79rs0450q8c73fp2lmg`. Also set `SOLANA_INDEXER_WS_ENDPOINT` to the official dashboard WS URL (see the Alchemy note). **Vercel Production stays unchanged** at frontend commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19` (M6 is backend-only).
5. **Verify the live release before any mutation.** Confirm `/health` HTTP 200 with mode `INVITE_ONLY_PILOT`, `automatedSettlement: false`, invite-only access configured, and `health.releaseSha` equal to the candidate SHA (the health payload now **requires** a full 40-character `releaseSha`; missing/null/mismatch fails closed); `/ready` HTTP 200 `READY` with database/indexer/muxReconciliation all `READY`. Because the indexer readiness depends on a live WS slot heartbeat, require `/ready` to hold `READY` across **more than the 90-second stale window — preferably a full 5 minutes** — so a WS subscription that silently stops delivering slots is caught before the corridor runs. `npm run verify:p4:deployment` performs these `/health`+`/ready`+release checks; pass matching `--expected-release-sha` and `--deployed-release-sha` (both the candidate SHA).
6. **Hold the rollback path ready.** The application rollback target is backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` (the current live M5 deploy). Rolling back means redeploying that exact commit **and** resetting `PILOT_EXPECTED_RELEASE_SHA` to match it so the env SHA and deployed SHA stay identical; Vercel is not touched. An honest 73df4e2c rollback restores the prior backend behavior only — note that 73df4e2c is the very commit currently serving `/ready` 503, so a rollback does not by itself restore indexer readiness.

**Indexer health monitor and WS endpoint (why `/ready` is 503):** the indexer marks itself `READY` only after an initial live slot heartbeat, and the health monitor may restore a `FAILED` indexer to `READY` **only** after both a fresh slot heartbeat and a successful HTTP `getSlot`. It must **not** mask an unsupported PubSub endpoint: if `slotSubscribe`/`logsSubscribe` are unsupported, no slot heartbeat arrives and the indexer stays `FAILED`. This is the current live cause — the old `73df4e2c` deploy has no working WS slot subscription.

**Alchemy WS endpoint note (operator action, no secrets in chat):** the current Alchemy key / derived WS path returned JSON-RPC error `-32601` (method not found) for `slotSubscribe` and `logsSubscribe`. Alchemy's documentation states that the app dashboard provides an official WebSocket URL. **Operator:** copy that exact WS URL from the Alchemy app dashboard into the Render (and local secure) config as `SOLANA_INDEXER_WS_ENDPOINT` — **do not paste the URL into chat, commits, or command output.** Confirm the dashboard-provided WS URL forms an **exact** pair with `SOLANA_INDEXER_RPC_ENDPOINT` (identical host, port, path, and query; only the scheme differs, `https`→`wss`); a non-matching pair is a hard stop.

- **Expected:** the live backend serves the fixed candidate SHA on `/health`, `/ready` holds `READY` for >90s (target 5 minutes) with database/indexer/muxReconciliation all `READY`, and the rollback commit + matching env SHA are staged.
- **Fail-closed stop:** any release-SHA mismatch or missing/null `health.releaseSha`, a non-`READY` service (the current 503 indexer-`FAILED` state qualifies), a WS endpoint that does not exactly match the RPC endpoint or that does not support `slotSubscribe`/`logsSubscribe`, a Vercel change, or a candidate that is unpushed, un-CI'd, or not freshly Fable-reviewed PASS. Do not start actor preparation.

## Step 1 — Read-only actor preflight (no mutation)

Verifies genesis/program/ProgramData/ProtocolConfig/mint invariants, signer public keys, role separation, absence of the disposable creator profile/upgrade receipt, and funding/rent math. Prints an evidence preview and sends **no** transaction (omit `--execute`). The creator/sponsor keypairs must resolve to the two fixed disposable addresses above.

```bash
set -a; source <mode-0600 dotenv with PILOT_TX_RPC_URL>; set +a   # never echo the URL
npm run prepare:p4:m6:actors -- \
  --rpc-env-path <mode-0600 rpc env file> \
  --fee-payer-path <mode-0600 fee payer keypair> \
  --admin-mint-authority-path <mode-0600 admin keypair> \
  --oracle-authority-path <mode-0600 oracle bundle> \
  --creator-path <mode-0600 keypair for EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7> \
  --sponsor-path <mode-0600 keypair for BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW> \
  --evidence-path <mode-0600, non-existent evidence json> \
  --run-id <stable-lowercase-run-id> \
  --creator-target-lamports <minimum ≥ CreatorProfile rent, ≤ 50000000> \
  --sponsor-target-lamports <minimum, ≤ 50000000> \
  --max-creator-starting-lamports 0 \
  --max-sponsor-starting-lamports 0 \
  --max-actor-starting-test-usdc-raw 0 \
  --mint-test-usdc-raw 1000000 \
  --sponsor-test-usdc-raw 1000000
```

- **Expected:** `phase: "read_only_preflight_passed"`, all invariant hashes equal to the frozen table, `roleSeparationVerified: true`, `creatorProfileAbsent: true`, `upgradeReceiptAbsent: true`, and a `plannedMutations` list. No signatures. `--mint-test-usdc-raw` and `--sponsor-test-usdc-raw` must be equal and are hard-capped at 25,000,000 raw.
- **Irreversible state:** none.
- **Reconciliation:** none needed; re-run freely with a fresh evidence path.
- **Fail-closed stop:** any genesis/hash/capacity/authority/signer/role/balance/mint/account mismatch, or if the evidence path already exists. Do not proceed.

## Step 2 — Exact irreversible acknowledgement execution

Same command as Step 1 **plus** `--execute` and the exact literal acknowledgement `PILOT_TEST_ONLY_DEVNET`. Funds the two disposable wallets with minimum SOL, creates ATAs, mints the approved test-USDC to the fee-payer ATA, transfers it to the sponsor, registers the disposable creator (oracle-authorized), and writes the synthetic **PILOT TEST ONLY** level-2 S2 upgrade receipt.

```bash
npm run prepare:p4:m6:actors -- \
  <all flags from Step 1> \
  --execute --acknowledge-irreversible PILOT_TEST_ONLY_DEVNET
```

- **Expected:** `phase: "actor_chain_preparation_complete"`; every transaction `state: "finalized"`; test-USDC supply delta exactly +1,000,000; fee-payer ATA ends at 0; sponsor ATA +1,000,000; creator ends level 2 / `S2_ACTIVE`; on-chain receipt digest and report id match saved evidence. This evidence file is later consumed verbatim by the corridor smoke (`STREAM_PUMP_SMOKE_ACTOR_PREP_EVIDENCE_PATH`) and must bind this exact run id, both fixed actor keys, the frozen authorities/mint, and the 1,000,000 raw budget.
- **Irreversible state:** minting raises the devnet test-USDC supply (no auto-reversal); creator registration and the upgrade receipt are durable accounts with **no** downgrade instruction; rent/fees are not fully reversible even though disposable-wallet lamports can later be reclaimed.
- **Reconciliation:** each transaction is recorded with its local signature **before** send and sent exactly once. On an ambiguous RPC response, query the recorded signature — **never blind-resend**. A later run refuses to overwrite the mode-`0600` evidence file and forces operator reconciliation.
- **Fail-closed stop:** the first failed/unconfirmed/non-finalized transaction, any postflight delta mismatch, any forbidden-lane requirement, or evidence unable to stay mode `0600`. Stop; do not repair by opening a closed lane, substituting fixtures, changing the mint, or rewriting projection truth.

## Step 3 — Add the two fixed disposable wallets to the invite allowlist (operator dashboard)

The allowlist is the Render env var `PILOT_INVITE_WALLETS` (CSV), read into `config.pilot.inviteWallets`. Add **only** the two fixed disposable wallet addresses for the smoke window; keep `PILOT_INVITE_ONLY=true`. The allowlist is a hard gate on the PILOT TEST ONLY sponsor approval check (Step 4), so both wallets must be listed before the corridor runs.

```text
Render dashboard → service srv-d79rs0450q8c73fp2lmg → Environment →
  PILOT_INVITE_WALLETS = <existing baseline wallets>,EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7,BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW
  (apply and let the controlled deploy/restart pick it up)
```

- **Expected:** after restart, `/health` still reports `INVITE_ONLY_PILOT` with `automatedSettlement: false` and the same fixed `releaseSha`; the two disposable wallets can authenticate; non-listed wallets still receive `403 PILOT_INVITE_REQUIRED`.
- **Irreversible state:** none (env edit).
- **Fail-closed stop:** if the edit would disable invite-only, enable any closed flag, change the release SHA, or leave zero wallets (production config requires `inviteOnly=true` and ≥1 invited wallet). Do not broaden beyond the two fixed disposable wallets.

## Step 4 — Disposable Track 1‑only corridor (M6 mode)

Runs external-wallet challenge/verify → content upload → operator publication approval → feed/post proof → Track1‑only intent → creator+sponsor dual signature → backend relay → public campaign proof, using a **stable run id** and a **fixed future deadline** (reused verbatim on retry). In M6 mode every safety flag below is mandatory; the smoke fails closed if any is missing.

```bash
set -a; source <mode-0600 dotenv: PILOT_TX_RPC_URL, STREAM_PUMP_SMOKE_OPERATOR_KEY>; set +a
export STREAM_PUMP_SMOKE_API_BASE_URL=https://api.stream-pump.com/api/v1
export STREAM_PUMP_SMOKE_M6_MODE=1
export STREAM_PUMP_SMOKE_ALLOW_CHAIN_SUBMIT=1
export STREAM_PUMP_SMOKE_ALLOW_PROFILE_UPDATE=1
export STREAM_PUMP_SMOKE_ALLOW_TEST_SPONSOR_PREP=1
export STREAM_PUMP_SMOKE_RUN_ID=<same stable run id as the actor-prep evidence>
export STREAM_PUMP_SMOKE_ACTOR_PREP_EVIDENCE_PATH=<mode-0600 evidence json from Step 2>
export STREAM_PUMP_SMOKE_PROPOSAL_DEADLINE_UNIX=<one stable future unix; reuse on retry>
export STREAM_PUMP_SMOKE_TRACK1_BASE_RAW=1000000
export STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS=<positive integer, 1..1800>
export STREAM_PUMP_SMOKE_EXPECTED_RELEASE_SHA=<fixed M6 candidate 40-hex SHA>
export STREAM_PUMP_SMOKE_DEPLOYED_RELEASE_SHA=<same fixed M6 candidate 40-hex SHA>
export PILOT_TX_RPC_URL=<dedicated devnet https RPC; credential-free>   # from the sourced dotenv
export PILOT_EXPECTED_USDC_MINT=5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ
export STREAM_PUMP_SMOKE_CREATOR_KEYPAIR_PATH=<mode-0600 keypair for EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7>
export STREAM_PUMP_SMOKE_SPONSOR_KEYPAIR_PATH=<mode-0600 keypair for BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW>
export STREAM_PUMP_SMOKE_MEDIA_PATH=<real PILOT TEST ONLY mp4/mov video file>
export STREAM_PUMP_SMOKE_SPONSOR_DOCUMENT_IMAGE_PATH=<separate PILOT TEST ONLY png/jpg/webp image, ≤12 MiB>
npm run smoke:production-corridor
```

Notes on the required envs (all enforced by the smoke in M6 mode):
- `STREAM_PUMP_SMOKE_M6_MODE=1` turns on every M6 assertion. It forces `STREAM_PUMP_SMOKE_ALLOW_PROFILE_UPDATE=1` and `STREAM_PUMP_SMOKE_ALLOW_TEST_SPONSOR_PREP=1`, an exact `STREAM_PUMP_SMOKE_TRACK1_BASE_RAW=1000000`, a positive bounded `STREAM_PUMP_SMOKE_WAIT_FOR_MUX_READY_SECONDS`, a real **video** `STREAM_PUMP_SMOKE_MEDIA_PATH`, an HTTPS credential-free API base URL, and **keypair PATH only** (`_KEYPAIR_JSON` env forms are rejected in M6).
- `STREAM_PUMP_SMOKE_EXPECTED_RELEASE_SHA` and `STREAM_PUMP_SMOKE_DEPLOYED_RELEASE_SHA` are now **required in M6 mode** and must both equal the fixed candidate SHA from Step 0. The corridor smoke probes `/health` and verifies the live release identity **before any auth/DB/R2 mutation**, and **again immediately before the final chain submit**. A missing, null, or mismatched `health.releaseSha`, or a health probe that is unavailable at either checkpoint, is a **hard stop** — the corridor refuses to authenticate, upload, or submit against a runtime whose release identity is not the fixed candidate.
- `STREAM_PUMP_SMOKE_ACTOR_PREP_EVIDENCE_PATH` is re-validated against this run id, both fixed actor keys, the frozen authority set, the `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ` mint, and the 1,000,000 raw budget; `PILOT_TX_RPC_URL` (dedicated devnet) and `PILOT_EXPECTED_USDC_MINT` back a read-only sponsor-ATA budget preflight.
- `STREAM_PUMP_SMOKE_ALLOW_TEST_SPONSOR_PREP=1` requires a separate `STREAM_PUMP_SMOKE_SPONSOR_DOCUMENT_IMAGE_PATH` (independent from the creator media). The readiness lookup sends `x-pilot-run-id: <run id>`; see the sponsor-approval note below.

**Sponsor approval is a persistent PILOT TEST ONLY classification, never real KYB.** The smoke registers the disposable sponsor with `PILOT TEST ONLY`-prefixed company/registration fields and has the operator approve it with an immutable `SponsorReviewEvent` note classified `PILOT_TEST_ONLY_NOT_REAL_KYB` (`realKyb: false`, `reusableOutsideRun: false`). Because those fields start with `PILOT TEST ONLY`/`PILOT-TEST-ONLY`, `assessSponsorApprovalForUse` never treats the sponsor as `KYB_APPROVED`; it counts as approved-for-use only when the **latest** review event is that immutable marker, its wallet matches, the request's `x-pilot-run-id` equals the marker's run id, **and** the wallet is in the `PILOT_INVITE_WALLETS` allowlist. Approval therefore evaporates for any other run id or once the wallet leaves the allowlist — it is a per-run, allowlist-scoped test classification, not durable KYB.

- **Expected:** dedicated devnet RPC + genesis verified; both fixed wallets pass wallet-challenge auth; read-only readiness confirms on-chain `S2_ACTIVE` creator and DB-approved (PILOT TEST ONLY) sponsor; publication operator-approved; a Track1‑only proposal is relayed; public campaign proof returns with PDA, tx signature, and manifest hash. **Record the proposal PDA** for Steps 6–7.
- **Irreversible state:** the on-chain proposal and its sponsor funding (1,000,000 raw test-USDC) are durable; the deadline is fixed and not advanced.
- **Reconciliation:** reuse the identical run id, deadline, and idempotency keys on retry so an interrupted run replays without duplicating the proposal or funding.
- **Fail-closed stop:** any readiness/auth/publication/relay/proof failure. Do not substitute fixtures, change the mint, or weaken auth; stop and reconcile.

## Step 5 — Natural deadline wait

Wait in wall-clock time until `STREAM_PUMP_SMOKE_PROPOSAL_DEADLINE_UNIX` has genuinely passed. **Never** advance the validator clock, warp time, or use any mock/automatic settlement path — Track 1 must settle only after the real deadline.

- **Expected:** current unix time > the fixed deadline before Step 6; the proposal is naturally due.
- **Fail-closed stop:** if settlement appears possible before the natural deadline, or any automatic scheduler is enabled. Stop and investigate.

## Step 6 — Read-only Track 1 diagnostic

Confirms the due proposal, creator wallet, and Track 1 amount before any settlement mutation. Operator-authenticated `GET`; no state change. (The Step 7 smoke also runs this diagnostic internally before mutating.)

```bash
curl -sS \
  -H "x-internal-operator-key: $STREAM_PUMP_SMOKE_OPERATOR_KEY" \
  "https://api.stream-pump.com/api/v1/internal/settlements/<proposal PDA>/track1"
```

- **Expected:** diagnostic shows the correct creator wallet (`EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7`) and a Track 1 amount of 1,000,000 raw, `track1Claimed: false`, and no prior settlement operation.
- **Irreversible state:** none.
- **Fail-closed stop:** wrong creator wallet/amount, already-claimed state, or a missing/mismatched proposal. Do not settle.

## Step 7 — Manual Track 1 settlement + idempotent replay smoke

Submits the manual Track 1 settlement (oracle-signed), polls the creator's test-USDC payout, then **replays the identical operation** and requires an idempotent no-resend result with the original signature; finally asserts the public campaign proof reaches settled Track 1. The smoke also verifies the Pilot `/health`, `/ready`, and release identity **before and after** the mutation, so the expected/deployed release SHA must equal the fixed M6 candidate SHA from Step 0.

```bash
set -a; source <mode-0600 dotenv: PILOT_TX_RPC_URL, STREAM_PUMP_SMOKE_OPERATOR_KEY>; set +a
export STREAM_PUMP_SMOKE_API_BASE_URL=https://api.stream-pump.com/api/v1
export PILOT_EXPECTED_USDC_MINT=5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ
export STREAM_PUMP_SMOKE_PROPOSAL_PDA=<proposal PDA from Step 4>
export STREAM_PUMP_SMOKE_EXPECTED_CREATOR_WALLET=EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7
export STREAM_PUMP_SMOKE_EXPECTED_SPONSOR_WALLET=BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW
export STREAM_PUMP_SMOKE_EXPECTED_RELEASE_SHA=<fixed M6 candidate 40-hex SHA>
export STREAM_PUMP_SMOKE_DEPLOYED_RELEASE_SHA=<same fixed M6 candidate 40-hex SHA>
export STREAM_PUMP_SMOKE_IDEMPOTENCY_KEY=<stable key; reuse on replay>
npm run smoke:pilot-track1
```

- **Expected:** `ok: true`, `payoutAppliedExactlyOnce: true`; creator balance increases by exactly 1,000,000 raw once; the replay returns `CONFIRMED` with the **same** tx signature and no second payout; post-replay diagnostic binds confirmed chain + projection truth to that signature; campaign proof is `SETTLED` with `track1Claimed`; and the Pilot health/readiness/release boundary is verified before and after (expected == deployed == the fixed candidate SHA and matching `health.releaseSha`).
- **Irreversible state:** the single Track 1 payout to the creator is durable; the replay must not produce a second transfer.
- **Reconciliation:** reuse the same idempotency key; if the RPC/signature confirmation is ambiguous, treat the recorded signature as the reconciliation key rather than resubmitting.
- **Fail-closed stop:** a second payout, replay producing a new signature, a release-identity mismatch, missing operation evidence, unverified confirmed/settled state, or any Track 2/Track 3/automatic-settlement activity. Track 2 and Track 3 must remain zero.

## Step 8 — Allowlist restoration (operator dashboard)

Remove the two fixed disposable wallets from `PILOT_INVITE_WALLETS`, restoring the pre-run baseline **before H4 handoff**. Keep `PILOT_INVITE_ONLY=true` and at least one baseline wallet (production config forbids zero). Restoring the baseline also revokes the sponsor's allowlist-scoped PILOT TEST ONLY approval-for-use.

```text
Render dashboard → service srv-d79rs0450q8c73fp2lmg → Environment →
  PILOT_INVITE_WALLETS = <original baseline wallets only>
  (apply and let the controlled deploy/restart pick it up)
```

- **Expected:** after restart, the two disposable wallets receive `403 PILOT_INVITE_REQUIRED`; `/health` still `INVITE_ONLY_PILOT`, `automatedSettlement: false`, same fixed `releaseSha`.
- **Fail-closed stop:** if removal would empty the allowlist or disable invite-only. Never leave the disposable wallets invited after the window.

## Step 9 — H4 stop and handoff

Stop here. Assemble the M6 evidence (per the retention list in the rollback bundle: UTC/local timestamps, run id, the two fixed disposable actor public keys, the fixed candidate release SHA + Fable 5 gate verdict, minimal funding amounts and final balances, proposal PDA, manifest id/hash, Track 1 original and replay signatures/results, campaign proof status) **without secrets**, and hand off for H4 review.

- H4 is human review only. Completing M6 does **not** authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed lane.
- **Fail-closed:** if any step above stopped, do not proceed to H4 as a pass — report the stop condition and the reconciliation state instead. If a runtime rollback was required, redeploy backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` with a matching `PILOT_EXPECTED_RELEASE_SHA`, leave Vercel unchanged, and record it.

## Evidence to retain (no secrets)

Run id and timestamps; fixed candidate release SHA and Fable 5 release-gate verdict; disposable creator (`EbsRjCPR6xxFAKsuYN1umb48qhKh1uQ4ngBAzaEqdBF7`) and sponsor (`BfjyjZNmExiApbWTehBPojJvXpHmYk7RpVZxeyQ9kaKW`) public keys and their ATAs; approved SOL/test-USDC amounts and before/after balances; test-USDC supply before/after; proposal PDA, manifest id + hash, publication evidence; Track 1 amount (1,000,000 raw); sponsor `PILOT_TEST_ONLY_NOT_REAL_KYB` classification and run-id/allowlist scope; original and replay settlement signatures and confirmed/settled status; campaign proof status; allowlist-restoration confirmation. **Never** retain private-key bytes, seeds, database/RPC URLs, operator keys, Mux/R2 secrets, auth tokens, or session cookies.

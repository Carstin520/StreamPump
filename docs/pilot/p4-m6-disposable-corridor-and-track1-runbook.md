# P4 M6 — Historical Disposable Corridor and Manual Track 1 Replay Runbook

Date authored: 2026-07-13 (Asia/Shanghai)

## Boundary (non-negotiable)

This is the audited run sequence for the **historical invite-only, external-wallet-first M6 execution**. Current registration is public through Google/Apple or optional wallet login; the old allowlist is retired. The run remains relevant only for its **Solana devnet, test-USDC, Track 1-only, manual/operator-settled** evidence. It is **not** a formal production launch and involves **no real funds**.

Closed and forbidden for the current product boundary: S1 lifecycle, Track 2, Track 3/CPS, endorsement, rewards, withdrawal/transfer, unrestricted public managed execution, and **every** automatic settlement scheduler. Public Google/Apple identity is the only former lane reopened; Track 1 settlement remains manual, operator-authenticated, and oracle-signed only.

M6 is a **separate human gate that has now been explicitly approved for execution.** M2–M5 completed earlier (see [`p4-pre-mutation-checklist.md`](./p4-pre-mutation-checklist.md) and [`p4-rollback-bundle.md`](./p4-rollback-bundle.md)). This document is the approved execution procedure for M6 only. Each mutation group still requires operator confirmation of its own preconditions, and completing M6 only assembles evidence for **H4** — it does not authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed lane.

## Execution record (2026-07-14)

M6 settled and replayed on runtime `67ec60c7679aca2d7adad24780ae043370c426e3` (`dep-d9at6enavr4c73b0rc20`). The H4 cleanup now runs on `88c0debad6ecb7eacfe9e24793951f3794353f4c` (`dep-d9auio7lk1mc73c4r18g`), whose Neon pre-deploy gate separates the historical M3 zero-value baseline from steady-state Pilot data. GitHub checks and `pilot-chain` passed for the M6 runtime. Fable covered the three non-overlapping M6 ranges through `67ec60c`; the runtime-gate fix received a fix-only closure review ending at `88c0deb` with 0 blocker/major/minor. Do not repeat those reviews.

Actor preparation completed at `2026-07-14T06:00:01Z` with ten finalized devnet transactions and zero forbidden-lane instructions. The corridor then completed external-wallet authentication, real R2/Mux media handling, operator publication approval, feed/post proof, Track1-only proposal launch and funding. Evidence: run `p4m6-20260713-a`; manifest `cmrk8utz6000ohw2d7cqnata4`, hash `70d1afea7d30d40ddaa2bf80335e382c5a466c75ef5073e613bee954b81c7c47`; proposal `FPV64F3YL2uCnU1PLfMzUH34WAAvbPFV5ERcJRKGen29`; funding signature `WiWRVEi1n2EGvNzfsP7nccwBfhcRCezQ3CgGbwUuVLUhb7DczrN7uDz8JzdwAyft6ay3MWGHzdy8gggrnte7dEZ`.

After the fixed deadline elapsed naturally, the operator-only Track 1 smoke settled **1,000,000 raw test-USDC** and replayed the same idempotency key. Both responses were `CONFIRMED` with signature `5hjVwnw5QAvApWbNda2okCkN7mkQHcTZfyN6GaPbn4fGzhtU4x5GfVqzqG42F4V8SzEdR1KXQkhTtC3MBVUKrdFV`; `attemptCount=1`; creator balance changed `0 -> 1,000,000 -> 1,000,000`; proof is `SETTLED`; chain/projection mismatches are empty; Track 2 and Track 3 remain zero; automatic settlement remains disabled. Runtime health/readiness/release identity passed before and after.

**Historical cleanup result:** Step 8 completed under the former invite-only policy. That access policy is now superseded: current runtime ignores the old invite variables and reports open access. The H4 evidence below remains a point-in-time record; all financial lanes it kept closed remain closed.

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

> **Historical executed M6 state:** the fixed candidate was `67ec60c7679aca2d7adad24780ae043370c426e3`; it was pushed, CI-green, incrementally Fable-reviewed with no blocker/major, deployed as `dep-d9at6enavr4c73b0rc20`, and served stable `READY` database/indexer/Mux checks. The numbered procedure below is retained as the audited run sequence; the execution record above is authoritative for current status.

1. **Commit and push the fixed M6 candidate.** Completed for `67ec60c7679aca2d7adad24780ae043370c426e3`; auto-deploy remains disabled.
2. **Fable release-review gate.** Completed as the three contiguous exact incremental reviews recorded above. Do not repeat a full-repository review for this frozen candidate.
3. **Verify the dedicated indexer RPC + WS endpoints before deployment.** Completed with the matching provider-supported pair; `getSlot`, `slotSubscribe`, and `logsSubscribe` passed without printing credential-bearing endpoints.
4. **Pin and deploy the exact commit on Render.** Completed as `dep-d9at6enavr4c73b0rc20` at `67ec60c`; Vercel remained unchanged at frontend commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19`.
5. **Verify the live release before any mutation.** Completed: matching full release SHA, `INVITE_ONLY_PILOT`, automated settlement off, and database/indexer/Mux `READY` held beyond the 90-second stale window.
6. **Hold the rollback path ready.** Before M6, `73df4e2c7a6367b5b28871510d8ced095e59be6c` was the historical M5 application target, but it restores a known `/ready` 503 state. The immediately preceding M6 deploy, `5d07748b792addee2385a77cfba0c83db5f25d99`, restores a known production presign failure. Neither is an automatic healthy rollback target. After the finalized settlement, any runtime regression must stop traffic and obtain an explicit application rollback decision; the selected commit and `PILOT_EXPECTED_RELEASE_SHA` must match, Vercel stays unchanged, and no code rollback can reverse the payout or other durable devnet state.

**Historical indexer incident:** the indexer marks itself `READY` only after an initial live slot heartbeat, and the health monitor may restore a `FAILED` indexer to `READY` **only** after both a fresh slot heartbeat and a successful HTTP `getSlot`. The old `73df4e2c` deploy had no working WS slot subscription and served `/ready` 503; current `88c0deb` includes the `67ec60c` readiness fix and is `READY`.

**Historical Alchemy WS incident:** an initially derived path returned `-32601` for PubSub methods. The operator supplied the provider-supported matching WS endpoint, after which the fixed candidate passed the readiness hold. Do not paste either endpoint into chat, commits, or command output.

- **Expected:** the live backend serves the fixed candidate SHA on `/health`, `/ready` holds `READY` for >90s (target 5 minutes) with database/indexer/muxReconciliation all `READY`, and the rollback commit + matching env SHA are staged.
- **Fail-closed condition used:** any release-SHA mismatch, non-`READY` service, unsupported/mismatched WS endpoint, Vercel change, or candidate lacking CI/Fable clearance would have stopped actor preparation. None remained when execution began.

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

## Step 3 — Confirm public access and operator publication review

The former wallet allowlist step is retired. `PILOT_INVITE_ONLY` and `PILOT_INVITE_WALLETS` are ignored by the backend and must not be used to control registration. Before the corridor runs, confirm public access and the independent content-truth gate.

```text
Render dashboard → service srv-d79rs0450q8c73fp2lmg → Environment →
  remove PILOT_INVITE_ONLY and PILOT_INVITE_WALLETS (optional cleanup; stale values are ignored)
  PILOT_OPERATOR_PUBLICATION_REVIEW_REQUIRED = true
  (apply and let the controlled deploy/restart pick it up)
```

- **Expected:** after restart, `/health` reports `PUBLIC_SOCIAL_PILOT` with open access, `automatedSettlement: false`, and the same fixed `releaseSha`; Google/Apple and valid wallet-signature login are available without enrollment approval; creator self-verification still returns `OPERATOR_PUBLICATION_REVIEW_REQUIRED`.
- **Irreversible state:** none (env edit).
- **Fail-closed stop:** if the edit would disable operator publication review, enable any closed financial flag, or change the release SHA. Public registration is not a financial-lane approval.

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

**Sponsor approval is a persistent PILOT TEST ONLY classification, never real KYB.** The smoke registers the disposable sponsor with `PILOT TEST ONLY`-prefixed company/registration fields and has the operator approve it with an immutable `SponsorReviewEvent` note classified `PILOT_TEST_ONLY_NOT_REAL_KYB` (`realKyb: false`, `reusableOutsideRun: false`). Because those fields start with `PILOT TEST ONLY`/`PILOT-TEST-ONLY`, `assessSponsorApprovalForUse` never treats the sponsor as `KYB_APPROVED`; it counts as approved-for-use only when the **latest** review event is that immutable marker, its wallet matches, and the request's `x-pilot-run-id` equals the marker's run id. Approval therefore evaporates for any other run id — it is a per-run operator-reviewed test classification, not durable KYB or a registration allowlist.

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

## Step 8 — Historical allowlist restoration — SUPERSEDED

This completed H4-era allowlist step is retained only as historical evidence. The access allowlist is now formally removed; its environment variables are ignored, and no user wallet address should be requested for registration or onboarding.

The human supplied `GYjkMEZEFHuY4uRZVwE79eeXAGtoneh53gb49X4HqCMH`; it is distinct from fee payer/admin/oracle/disposable roles and is now the only entry. No private key was requested or read.

```text
No current operator action. Personal wallet collection belongs only to the future withdrawal flow.
```

- **Historical observation:** both disposable wallets produced locally verified signatures and received `401 AUTH_CHALLENGE_INVALID`; `/health` was `INVITE_ONLY_PILOT` at release `88c0deb`. This is evidence of the former policy, not the current login contract.
- **Current rule:** do not restore or maintain an access allowlist. Keep operator review and all closed financial lanes enforced.

## Step 9 — H4 stop and handoff — READY FOR HUMAN REVIEW

Stop here. Settlement/replay and allowlist cleanup evidence are assembled. H4 is ready for human review but is not self-approved.

- H4 is human review only. Completing M6 does **not** authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed lane.
- **Fail-closed:** if any step above stopped, do not proceed to H4 as a pass — report the stop condition and reconciliation state. Do not automatically redeploy `5d07748…` or `73df4e2c…`; both have known failures documented above. Any application rollback now requires an explicit human choice with a matching `PILOT_EXPECTED_RELEASE_SHA`; leave Vercel unchanged and never describe a code rollback as reversing the finalized payout.

## Evidence to retain (no secrets)

Run id and timestamps; exact release/deploy and non-overlapping review coverage; disposable actor public keys and ATAs; approved test amounts and balances; proposal/manifest/publication evidence; exactly-once Track 1 settlement/replay evidence; the sole non-disposable baseline public key; and concealed-denial auth results. **Never** retain private-key bytes, seeds, database/RPC URLs, operator keys, Mux/R2 secrets, auth tokens, or session cookies.

# P4 Pilot Pre-Mutation Checklist

Date: 2026-07-13 (Asia/Shanghai)

Gate status: **M2 completed and passed dedicated-RPC plus independent public-devnet verification. The live devnet program is the fixed candidate at capacity 1,328,344 with full padded SHA256 `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732`. M3 local/read-only preparation is complete, but M3 remains blocked on its own human approval, a write-quiesced old Render backend, and a verified Neon recovery branch.**

M2 completion evidence: the human approved the revised exact 10,240-byte extension; candidate buffer writes completed with 1,249 signed/confirmed ledger pairs and a byte-identical finalized dump; extend signature `y5nHSXckht6d6iEKATcBejYYdH5UVPxqN5DJS8iXCg8Za2TSyrX7zZztxoAd7yS8Fm3zwveTjyioRkBrg9BxHQR`; upgrade signature `A2xT2qeH6sX3bfUsvPcqmtDU1F8QNsykv8AnKqvvcXwX8ySsKHUZjaVdm86c3gs1ydXSV66HDvu6PR8c7Hri5v1`; finalized deploy slot 475933115; candidate buffer closed; authority/config/oracle/mint invariants unchanged. Independent public-devnet verification returned GO. Exact candidate rebuild/hash, generated-versus-packaged IDL, and local Track1-only tests passed (3/3). Real manual Track1 settlement/replay remains M6-only.

The following RPC/buffer paragraphs are retained as historical M2 incident evidence, not current chain or credential state. The authoritative current state is the successful M2 completion evidence above and the finalized evidence bundle.

Dedicated-RPC preflight attempt: failed with HTTP 401 before chain verification. The CLI exposed the credential-bearing provider URL in its error output, so that API key must be rotated. The local P4 RPC file was immediately reset to an empty mode-`0600` placeholder. No transaction or chain mutation occurred.

Credential rotation follow-up: a replacement dedicated Helius devnet RPC was configured locally and the hardened preflight passed. Genesis, Program/ProgramData/authority/capacity, fresh program dump, fee payer balance, candidate/rollback hashes, ProtocolConfig bytes, and test-USDC bytes all matched the frozen M1 truth. Raw credential-bearing stderr was suppressed. M2 was subsequently approved as recorded below.

M2 execution update after approval: the buffer account was created with the correct authority and 1,321,192-byte allocation, but Helius repeatedly returned HTTP 429 during payload writes. Two CLI resume attempts and one explicitly throttled sequential writer were stopped before ProgramData extension. The final post-stop observation supersedes the earlier partial counts: 25,200 matching prefix bytes and 1,249 mismatched 900-byte chunks remain. ProgramData is still 1,318,104 bytes; deployed program SHA256 is still the pre-upgrade `96b114...`; authority is unchanged. Fee payer balance is 5.7976796 devnet SOL because approximately 9.1967 SOL is currently locked as recoverable buffer rent. Do not extend until a dedicated transaction RPC with sufficient write quota completes and verifies this buffer.

Incident correction: a CLI `write-buffer --use-rpc` child process survived its parent session and continued sending in the background, which caused the sustained 429s and exposed the credential-bearing URL through the local process list. The orphan was terminated and all writer processes were rechecked absent. The local RPC file was reset; that key must be rotated again. After termination, the buffer matching prefix is 25,200 bytes with 1,249 mismatched chunks remaining; deployed program hash/capacity/authority remain unchanged. The replacement writer uses explicit JSON-RPC pacing and completed a one-chunk write+readback successfully, but it must not resume until the second credential rotation is complete.

M2 recovery hardening: read-only runtime smoke through a local proxy to public devnet verified the frozen Program/ProgramData/ProtocolConfig/oracle/test-USDC baseline, retained buffer header/authority, 1,249 pending chunks, signer public keys, and extension rent without sending a transaction. Devnet simulation rejected 3,088 bytes because the loader requires a minimum 10,240-byte increment; the revised target is therefore 1,328,344 bytes with a `0.0712704` devnet SOL rent top-up. Devnet currently reports `Enable ExtendProgramChecked` inactive, so the extension helper is feature-aware: legacy variant 6 while inactive, checked variant 9 with separate authority+payer signers if activated. Both paths pin the pre/padded hashes and resolve a send only from finalized ProgramData state. Candidate and rollback buffer writers are role/hash/address bound, use an ownership-checked atomic lock, and have separate single-transaction buffer creation plus finalized byte verification.

This checklist governs the StreamPump technical Pilot deployment validation. It is **not** a production-launch checklist. The only permitted product lane is invite-only, external-wallet-first, Solana devnet, test-USDC, and manual/operator-only Track 1. S1, Track 2, Track 3, rewards, managed/email/social auth, public managed execution, and every automatic settlement scheduler remain closed.

No mutation is authorized by this document. Each mutation group requires its own explicit human approval.

## Frozen baseline

- Clean worktree: `/private/tmp/streampump-p4-codex`
- Branch: `codex/p4-pilot-deployment`
- Baseline/integration SHA: `dd49e433880462a9499036e7620a8436d7c770c3`
- PR #8: merged into `codex/post-deadline-phase-0`
- Latest included CI fix: `a4f3a22161f923941c6d06cdb1631ba00b7396e9`
- Protected files remain untouched: `backend/package-lock.json`, `pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`
- Render live baseline: deploy `dep-d8upmol7vvec73ejb8gg`, commit `b362910c7ca204f8724af7a1a74411757e2abce1`
- Vercel Production baseline: deployment `dpl_DmwV2BsLVjmS2ifqCDat9hQpAETV`, commit `cbdf76a5df896adbe88a9e07586ac3478e45f720`, ref `main`
- Integration merge produced Preview only; neither production baseline changed.

## Read-only evidence complete

- [x] Original dirty workspace was left untouched.
- [x] Clean P4 worktree created from the verified remote integration SHA.
- [x] Render `/health` returns 200; `/ready` returns 404 on the old live commit, as expected before P3.
- [x] Neon reports PostgreSQL 17.10, 26 repository migrations, 20 applied, 6 pending, and no failed or rolled-back migration.
- [x] All 20 applied migration checksums match the integration tree.
- [x] The six pending migration checksums are recorded in the rollback bundle document.
- [x] Migration impact was previewed inside a read-only transaction and rolled back.
- [x] Current devnet program bytes were freshly dumped to a durable, permission-restricted path and hashed.
- [x] Local candidate bytes were copied beside the rollback binary and hashed.
- [x] P4 fee payer exists at `/Users/jamesli/.config/solana/streampump-p4-devnet-fee-payer.json`, resolves to `Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9`, is mode `0600`, and held `14.9106046` devnet SOL after the completed M2 buffer close.
- [x] A dedicated Solana devnet transaction RPC was selected, rotated after the credential incidents, and passed genesis plus fixed-account cross-checks for M2. M4 must separately inventory deployed read/indexer endpoints.
- [x] A mode-`0600` devnet admin signer is locally available and resolves to the on-chain upgrade authority/admin `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw`; use still requires M1/M2 approval.
- [x] A mode-`0600` local authority bundle contains the oracle signer `HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC`; it must be extracted/loaded through an approved mode-`0600` mechanism before M6.
- [ ] Tighten or retire the original workspace `backend/.env.local` authority-secret copy (currently mode `0644`) under explicit user approval. It must not be used as the P4 signing source.
- [x] Dedicated devnet transaction RPC final read-only preflight passed after credential rotation.

## M1 — freeze chain truth, signers, backup, and rollback

Human must explicitly approve all of the following before M2:

- [x] Freeze `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ` as the **Pilot test-USDC mint for this run only**.
- [x] Confirm the RPC endpoints are dedicated Solana devnet endpoints. Do not paste credential-bearing URLs into chat or commit them.
- [x] Confirm the program upgrade-authority signing mechanism for the exact on-chain authority. The P4 fee payer must not be assumed to be the authority.
- [x] Confirm the manual Track 1 oracle/operator signing mechanism for the exact on-chain oracle authority. The fee payer, upgrade authority, creator, and sponsor are distinct roles unless chain truth proves otherwise.
- [x] Confirm the rollback directory remains available and permission-restricted: `/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation`.
- [x] Confirm no mainnet endpoint, mainnet asset, real USDC, long-lived user wallet, or production custody wallet is in scope.

M1 approval does not authorize `write-buffer`, `extend`, `upgrade`, migration, deployment, webhook, or smoke mutations.

Frozen chain observations:

- Devnet genesis: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- ProgramData: `58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs`; upgrade authority/admin: `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw`.
- ProtocolConfig: `GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g`; oracle: `HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC`.
- Test-USDC candidate: `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ`, legacy SPL Token, 6 decimals, mint authority `BNQPL5...`, no freeze authority. It is not approved until the human checks the M1 box above.
- Required loader-compatible extension: 10,240 bytes; expected rent top-up: `0.0712704` devnet SOL.

M1 stop conditions:

- Any active RPC is not devnet, is unreachable, or returns inconsistent chain truth.
- Program ID, ProgramData address, upgrade authority, ProtocolConfig, oracle authority, or test-USDC mint differs from the frozen values.
- The upgrade-authority or oracle signer cannot be proven by deriving its public key without exposing secret bytes.
- The pre-upgrade `.so` cannot be freshly dumped, is not 1,318,104 bytes, or does not hash to the recorded SHA256.
- Candidate `.so` is not 1,321,192 bytes or does not hash to the recorded SHA256.

## M2 — write buffer, verify, extend, controlled upgrade

Approval scope: devnet program bytes only. ProgramData expansion is irreversible; program bytes are rollback-capable.

- [x] Renewed human approval received and executed for the simulated loader-compatible extension: exactly 10,240 bytes, capacity 1,318,104 -> 1,328,344, rent top-up 0.0712704 devnet SOL. This superseded only the rejected 3,088-byte extension detail and did not broaden M2 beyond devnet program bytes.

M2 result: **complete; no rollback required.** The finalized program hash is the padded candidate `a6008d9c...a720732`; the ProgramData address and upgrade authority are unchanged; ProtocolConfig/oracle/test-USDC bytes are unchanged; the candidate buffer is closed. Do not reinterpret the successful local Track1 test as a devnet settlement replay. M6 retains the disposable real Track1-only corridor and replay requirement.

Required order:

1. Re-read program metadata and signer public keys.
2. Write the candidate to a new buffer with the verified upgrade authority and P4 fee payer.
3. Dump/read the buffer payload and prove its SHA256 equals the candidate SHA256.
4. After renewed human approval, extend ProgramData by exactly 10,240 bytes (the devnet loader minimum).
5. Re-read ProgramData length and authority.
6. Upgrade from the verified buffer.
7. Freshly dump the post-upgrade program and prove it equals the candidate hash.
8. Run chain/config/mint/oracle read-only preflight before any application deployment.

Never use `--skip-preflight`. Never use an implicit CLI default keypair. Record every transaction signature without recording secrets or credential-bearing RPC URLs.

Immediate rollback trigger: any unexpected program/config/mint/oracle value, failed post-upgrade dump/hash, or failed Track1-only chain preflight. After extension, roll back from `streampump_core-rollback-padded-1328344.so`, require the restored dump to hash to `8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247`, and stop. Do not continue to M3. The original `streampump_core-pre.so` remains immutable pre-mutation evidence, while the 10,240-byte capacity increase remains non-reversible.

## M3 — Neon restore point and six migrations

Canonical execution and recovery procedure: [`p4-m3-neon-migration.md`](./p4-m3-neon-migration.md). The verifier is `backend/scripts/p4-verify-neon-migration.ts` and uses a read-only transaction.

Frozen live target: project `jolly-recipe-31299801`, source/default branch `production` (`br-orange-bar-ancofkw5`), database `neondb`, PostgreSQL `17.10`; current history retention is 21,600 seconds (6 hours). The source branch is currently unprotected.

Human/dashboard prerequisite:

- [ ] Explicit M3 approval covers temporary old-Render write quiescence, recovery-branch creation/verification, and exactly six production migrations; it does not cover an M4 deployment.
- [ ] Confirm no Render deploy or other Prisma migration runner is active; make the old Render backend write-inert before the final preflight and keep it write-inert until the M4 candidate passes readiness.
- [ ] Create a Neon restore branch or PITR restore point from the production branch immediately before migration.
- [ ] Record the Neon project, source branch, restore branch/point identifier, source timestamp/LSN if exposed, and verification timestamp outside Git. Do not record connection strings.
- [ ] Verify the restore branch is connectable and contains the same 20 applied migrations and the expected pre-migration row counts.

Pending migrations, in order:

1. `20260712120000_pilot_content_storage_truth`
2. `20260712130000_api_idempotency`
3. `20260712150000_track1_settlement_audit`
4. `20260712160000_clear_unverifiable_anchor_transactions`
5. `20260712170000_chain_ingestion_recovery`
6. `20260712180000_pilot_operator_events`

Expected impact from the read-only preview:

- 0 `VERIFIED` publications are revoked.
- 10 feed-eligible manifests become ineligible (1 `ANCHORED`, 9 `READY`; no current `PUBLISHED` status downgrade).
- 13 OPEN/FUNDED unclaimed Track 1 proposals already have `contentPublishedVerifiedAt = NULL`; the update is currently a semantic no-op.
- 8 manifest `currentAnchorTx` claims are cleared because 0/8 have durable matching chain-event proof.
- 0 proposal `contentAnchorTx` claims are currently present.

The final migration command, target fingerprint guard, unconditional post-state resolution, and evidence paths are frozen in the canonical M3 runbook. Database URLs must come from a repository-external mode-`0600` dotenv file and must never be pasted into chat or stored in Git.

M3 stop conditions:

- Restore branch/point is absent, cannot be connected to, or does not reproduce the pre-migration state.
- The old Render backend is still writable, a Render deployment is running, or another migration runner may race this operation.
- Any applied checksum differs from the integration tree or any migration is failed/rolled back.
- Pending list/order differs from the six frozen migrations.
- Migration execution returns an error, applies a different count, or post-migration row/schema checks differ from the preview.

On failure, stop application deployment. Preserve logs without URLs/secrets, keep the original Neon branch unchanged when possible, validate the restore branch, and either restore/repoint under a new explicit approval. Do not hand-edit `_prisma_migrations`.

## M4 — Render/Vercel inventory and controlled deployment

Observed production isolation:

- Render service `srv-d79rs0450q8c73fp2lmg` tracks `main` with auto-deploy enabled. Its configured pre-deploy command is `npm run prisma:migrate:deploy`; therefore M4 must not begin before M3 succeeds, and an unreviewed deploy could mutate Neon.
- Render current build command is `npm ci && npm run prisma:generate && npm run build`, which differs from the runbook's `npm ci --include=dev ...`; resolve that inventory drift before candidate deployment.
- Vercel has no local CLI/project link in this worktree. The production deployment remains the frozen baseline; `dd49e433` has a successful Preview only. Dashboard/API ownership is required for an intentional production promotion and rollback.

Before approval, inventory values by presence/type only; never print secret values. Binding Pilot values include:

- Invite-only: `PILOT_INVITE_ONLY=true`, disposable creator+sponsor in `PILOT_INVITE_WALLETS`, frozen `PILOT_EXPECTED_USDC_MINT`.
- External-wallet-only closures: email/provider/managed execution, S1, Track2, Track3, rewards, prototype routes all false.
- Manual settlement only: `ORACLE_SCHEDULER_ENABLED=false`, `ORACLE_RUN_ON_BOOT=false`, Track2/Track3 automatic settlement false.
- Chain: devnet-only dedicated RPCs, canonical Program ID, packaged IDL path, oracle signer matching chain state.
- Media: distinct private origin and public delivery R2 buckets; real Mux credentials; reconciliation enabled only after configuration is verified.
- Vercel: production frontend points only to the approved Render backend and devnet RPC.

Controlled order: Render deploy by exact approved commit -> `/health` 200 -> `/ready` 200 and remains healthy through the indexer heartbeat window -> API/CORS/auth fail-closed checks -> Vercel deploy by exact approved commit -> browser/API smoke. Do not auto-deploy from an integration push.

M4 stop conditions include: deployed commit mismatch; unexpected pre-deploy migration; any closed flag enabled; chain/oracle/mint preflight failure; `/health` missing the invite-only/manual-settlement runtime truth; `/ready` returning 503 or becoming unstable after the indexer heartbeat window; Mux/indexer readiness failure; CORS/API failure; or Vercel alias/commit mismatch.

Rollback targets are frozen above. If Render fails, restore deploy `dep-d8upmol7vvec73ejb8gg` and do not deploy Vercel. If Vercel fails, restore Production deployment `dpl_DmwV2BsLVjmS2ifqCDat9hQpAETV`. A rollback to the old backend may require repointing to the pre-migration Neon restore branch because the old code predates P2/P3 schema; this compatibility decision requires a separate human check.

## M5 — Mux webhook and media verification

Required dashboard fields (do not paste the secret):

- Environment: the intended Mux test/Pilot environment.
- Endpoint URL: the approved Render public backend plus `/api/webhooks/mux`.
- Signing secret: endpoint-specific secret stored only in Render as `MUX_WEBHOOK_SECRET`.
- Event scope: only events consumed by the current controller/reconciliation path.

Read-only evidence currently proves Mux environment `lnv5m1` is a development environment and older assets/playback are healthy. It does **not** prove the current Dashboard webhook endpoint, enabled state, delivery history, or Render secret match; those remain mandatory M5 dashboard checks. The approved candidate route is `POST https://api.stream-pump.com/api/webhooks/mux`.

Prefer creating/verifying a new Pilot endpoint before disabling any prior endpoint. Verify signed webhook delivery, server-observed R2 object truth, Mux asset/playback readiness, promotion to the distinct delivery bucket, and operator feed approval. On signature failures, repeated delivery failures, wrong environment, or missing reconciliation visibility, disable the new endpoint or restore the old endpoint/secret and stop before M6.

## M6 — disposable allowlisted corridor and manual Track 1 replay

- Generate new disposable creator and sponsor external-wallet keypairs in the permission-restricted P4 bundle; never use fee payer, upgrade authority, oracle, or a long-lived wallet as either actor.
- Add only those two wallet addresses to the invite allowlist for the smoke window.
- Fund them from the P4 devnet fee payer with the minimum devnet SOL/test-USDC needed by the scripted corridor; record amounts and final balances.
- Use a stable run ID and fixed deadline; reuse idempotency keys on retry.
- Run external-wallet challenge/verify, content upload, operator publication approval, feed/post proof, Track1-only intent, creator+sponsor dual signature, backend relay, and public campaign proof.
- Run manual Track 1 settlement with the verified oracle signer. Replay the same operation and require no-resend/idempotent replay with the original signature.
- Confirm Track2/Track3 are zero, automatic settlement is off, and no real funds were used.

Any failure stops the corridor. Do not repair by opening a closed lane, substituting fixtures, changing the mint, weakening auth, or manually rewriting projection truth.

## H4 handoff

P4 completion means evidence is assembled for human H4 review. It does not authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed Pilot lane.

# P4 Pilot Pre-Mutation Checklist

Date: 2026-07-13 (Asia/Shanghai)

Gate status: **M2–M6 completed within the controlled technical Pilot boundary. Render deploy `dep-d9auio7lk1mc73c4r18g` is live at backend commit `88c0debad6ecb7eacfe9e24793951f3794353f4c`; Vercel Production remains unchanged at frontend commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19`. The human-approved external wallet `GYjkMEZEFHuY4uRZVwE79eeXAGtoneh53gb49X4HqCMH` is the sole invite entry and both disposable actors are removed. This remains invite-only, external-wallet-first, Solana devnet/test-USDC, Track1-only, manual/operator-only, no real funds, and not a formal production launch. H4 is ready for human review, not approved.**

**Current live readiness:** `/health` is HTTP 200 with `INVITE_ONLY_PILOT`, `automatedSettlement=false`, and release `88c0deb`; `/ready` is `READY`; 17 closed-lane/managed-auth/automatic-settlement flags remain false. The three M6 Fable ranges through `67ec60c` plus the fix-only runtime-gate closure ending at `88c0deb` are complete; do not repeat them.

M2 completion evidence: the human approved the revised exact 10,240-byte extension; candidate buffer writes completed with 1,249 signed/confirmed ledger pairs and a byte-identical finalized dump; extend signature `y5nHSXckht6d6iEKATcBejYYdH5UVPxqN5DJS8iXCg8Za2TSyrX7zZztxoAd7yS8Fm3zwveTjyioRkBrg9BxHQR`; upgrade signature `A2xT2qeH6sX3bfUsvPcqmtDU1F8QNsykv8AnKqvvcXwX8ySsKHUZjaVdm86c3gs1ydXSV66HDvu6PR8c7Hri5v1`; finalized deploy slot 475933115; candidate buffer closed; authority/config/oracle/mint invariants unchanged. Independent public-devnet verification returned GO. Exact candidate rebuild/hash, generated-versus-packaged IDL, and local Track1-only tests passed (3/3). The real manual Track1 settlement/replay later completed under M6 as recorded below.

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

Completed M3 controls:

- [x] Explicit M3 approval covered temporary old-Render write quiescence, recovery-branch creation/verification, and exactly six production migrations; it did not cover an M4 deployment.
- [x] Render service `srv-d79rs0450q8c73fp2lmg` was suspended at `2026-07-13T09:18:34Z`; no deploy/runner was active and repeated public write-shaped probes returned `503`.
- [x] Current-point recovery branch `p4-m3-pre-20260713T093116Z` (`br-frosty-fire-an0lsiq2`) was created from `br-orange-bar-ancofkw5`; compute `ep-tiny-mouse-an4mgy4d` was created at `2026-07-13T09:31:25Z`.
- [x] The recovery branch was connectable, contained the exact 20-migration pre-state, matched the production final-pre `{migrations,data}` snapshot, and remained unchanged after production migration.
- [x] Exactly six migrations applied once; final production verification reports 26 applied, 0 failed, 0 rolled back, all frozen schema objects present, Prisma status current, and fail-closed cleanup counts at zero. That point-in-time M3 evidence corresponds to `npm run verify:p4:neon:baseline` (`migration-baseline` mode).

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

M4 and M5 were human-approved in sequence and both passed as controlled technical Pilot verification. M6 was subsequently approved and completed through settlement/replay and allowlist cleanup.

**Execution result (2026-07-13): PASS.** The frozen application candidate is commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19` on `codex/p4-pilot-deployment`. The M4 Render deploy `dep-d9ac42daeets73djf58g` reached `live` at that exact commit after the read-only exact-26 Neon verifier passed; a 95.8-second production verifier recorded 16/16 passing observations covering release identity, health/readiness stability, CORS, and closed Pilot lanes. Render auto-deploy remains disabled and its deploy hook plus Neon owner credential were rotated without recording replacement values. The M4 Vercel Production deployment `dpl_26s2wP8KGqGJQbVeJH5VvXo2GmK2` rebuilt the same commit under Node 22 and owns `app.stream-pump.com` plus `stream-pump.vercel.app`. The promoted `/explore` returned 200 without the prior suspended-backend error, and the backend health/readiness/CORS probes passed immediately after alias assignment. M5 therefore opened; it has since completed.

**Current deployed state:** Render deployment `dep-d9auio7lk1mc73c4r18g` on service `srv-d79rs0450q8c73fp2lmg` is live at backend commit `88c0debad6ecb7eacfe9e24793951f3794353f4c`. Vercel Production remains `dpl_6f9LBgHRqB8hCywV5DimXfV9YqUK` (Ready) at frontend commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19`; H4 cleanup did not redeploy Vercel. Earlier deployment identifiers remain historical evidence in the rollback bundle.

Candidate SHA history: the prior pre-doc candidate `aa59485902194af6132e430ab1c53f2c0c931038` is not remote-reachable and was not deployed. M4 deployed `097e9805b197398ae1c04cf5bf84f1044b3b2f19` to Render and Vercel; M5 advanced only Render to `73df4e2c…`; M6 settlement ran on `67ec60c…`; H4 cleanup advanced Render only to current `88c0deb…`. Vercel remains at `097e9805b197398ae1c04cf5bf84f1044b3b2f19`. Auto-deploy remains disabled/controlled so neither `main` nor an unpinned branch head is deployed.

Historical pre-M4 isolation snapshot and completed actions:

- After M3, Render service `srv-d79rs0450q8c73fp2lmg` was suspended and tracked `main`. M4 changed the branch to `codex/p4-pilot-deployment`, disabled auto-deploy, and deployed only the exact frozen candidate.
- Render now builds with `npm ci --include=dev && npm run prisma:generate && npm run build`; its steady-state pre-deploy command is `npm run verify:p4:neon:post`, the read-only runtime gate that proves exactly 26 applied migrations, checksums, schema, numeric counts, and the scoped truth relationship while permitting legitimate post-M3 Pilot data. Evidence records `postDataMode`. The stricter `npm run verify:p4:neon:baseline` (`migration-baseline` mode) preserves the original zero-count cleanup assertions for M3 baseline/recovery evidence and is not run on every redeploy. Any future attempt to apply a migration remains a STOP condition.
- Vercel was previously on Node 24.x with the old production baseline. M4 pinned the project to Node 22, rebuilt the exact candidate with current environment values, verified the Preview, and intentionally promoted it.

Credential rotation completed before the backend resumed (never paste replacement values into chat or command output):

- The Neon `neondb_owner` password was rotated and Render `DATABASE_URL` plus `DIRECT_URL` were updated atomically before the successful candidate deployment. Replacement values were not committed or written to durable evidence.
- The Render deploy hook was regenerated. Its replacement value was not committed or written to durable evidence.

Render environment contract (verify by presence/type only; never print secret values):

- Production mode; HTTPS API base URL; exact CORS allowed origins; non-default auth/operator secrets.
- Read-only Neon gate inputs: `P4_EXPECTED_NEON_DATABASE=neondb`, `P4_EXPECTED_NEON_HOST_SHA256=a6c67cc9e5f1f9b94812efdeb7bbba5c558e475d183fa35d0f740f6ef4a2a678`, and `P4_EXPECTED_NEON_ROLE_SHA256=6f198191100386e1f0c093fc1c902c0520c6382059d75fb4743ec1ec75cc7842`.
- Release identity: full `PILOT_EXPECTED_RELEASE_SHA` set to the final frozen candidate and required at runtime to equal Render's injected `RENDER_GIT_COMMIT` exactly.
- Dedicated devnet transaction RPC and a separate indexer RPC; canonical Program ID, mint, and oracle matching frozen chain truth.
- A separate `SOLANA_INDEXER_WS_ENDPOINT` is required when `INDEXER_ENABLED=true` and must exactly correspond to `SOLANA_INDEXER_RPC_ENDPOINT` except for `https://` → `wss://`; production fails closed otherwise. The earlier derived Alchemy WS path returned `-32601`, but that incident was resolved with the provider-supported endpoint before M6. Current `67ec60c` passed `getSlot`/PubSub checks and held database/indexer/Mux readiness beyond the stale window. Never print credential-bearing URLs.
- Distinct private-origin and public-delivery R2 buckets; real Mux credentials; reconciliation enabled but run-on-boot false.
- Explicitly false: `AUTH_ALLOW_LEGACY_WALLET_HEADER`, `AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE`, `CREATOR_AUTH_ALLOW_PREVIEW_TWITTER`, `EPHEMERAL_SESSIONS_ENABLED`, `PUBLIC_MANAGED_WALLET_EXECUTION_ENABLED`, `ENGAGEMENT_REWARDS_ENABLED`, `S1_PUBLIC_API_ENABLED`, `TRACK2_ENABLED`, `TRACK3_ENABLED`, `EMAIL_AUTH_ENABLED`, `TRACK2_METRIC_INGESTION_ENABLED`, `PROTOTYPE_ROUTES_ENABLED`, `S1_MOCK_API_ENABLED`, `ORACLE_SCHEDULER_ENABLED`, `ORACLE_RUN_ON_BOOT`, `ORACLE_TRACK2_AUTO_SETTLEMENT_ENABLED`, `ORACLE_TRACK3_AUTO_SETTLEMENT_ENABLED`.

Vercel environment contract:

- Frontend backend base is `https://api.stream-pump.com`; `NEXT_PUBLIC_API_BASE_URL` is unset.
- Browser-safe devnet read RPC only; public demo/social/demo hints off; Web3Auth unset; R2 delivery host only.

Controlled order:

1. Confirm Render auto-deploy is disabled and the exact refrozen candidate is on `codex/p4-pilot-deployment` only.
2. Deploy Render by that exact commit; the read-only pre-deploy verifier must prove exactly 26 applied migrations and all frozen post-M3 invariants without applying any migration.
3. `/health` returns 200 with exact invite-only/manual-settlement truth.
4. `/ready` returns READY with DB, indexer, and Mux ready, and remains stable for more than 90 seconds.
5. CORS allow-and-deny checks pass; provider exchange returns 403; prototype/S1 read+write/email/ephemeral/Track2 routes are closed; operator endpoints return 403 unauthenticated.
6. Only after Render passes, pin Vercel to Node 22 and promote Vercel Production by the exact approved commit; run browser/API smoke.

M4 stop conditions include: deployed commit is not the exact refrozen `codex/p4-pilot-deployment` candidate; `main` or an unpinned branch head would deploy; the read-only pre-deploy verifier fails or any migration command attempts a write; any closed flag enabled; chain/oracle/mint preflight failure; `/health` missing the invite-only/manual-settlement runtime truth; `/ready` returning 503 or becoming unstable within the 90-second window; DB/indexer/Mux readiness failure; CORS/provider-exchange/operator fail-closed check failure; Vercel not pinned to Node 22; or Vercel alias/commit mismatch.

On Render failure, keep the service suspended. Do not automatically restore the old deploy against migrated Neon; the old backend predates P2/P3 schema, so an old rollback may require a separately approved repoint to the pre-migration recovery branch `br-frosty-fire-an0lsiq2`, and Vercel must not be deployed. Only after Render passes may the exact Vercel Production promotion occur; the Vercel rollback target is `dpl_DmwV2BsLVjmS2ifqCDat9hQpAETV`.

## M5 — Mux webhook and media verification

M5 was human-approved conditional on M4 success; M4 passed first, then M5 executed. M6 was subsequently approved and executed through settlement/replay.

**Execution result (2026-07-13): PASS as controlled technical Pilot verification.** In Mux environment `lnv5m1`, only the approved endpoint `https://api.stream-pump.com/api/webhooks/mux` is enabled; the older `onrender` and `trycloudflare` endpoints remain disabled. An endpoint-specific signed probe returned 202. A provider-backed disposable Mux test asset `vbmHviLSWRCMAPSoTk6zQG02l2BscN01Nhl79sL9v5wh8` generated `video.asset.ready` event `8e29cc91-fd05-d0f0-f453-9f5067c05d90`; its single production-endpoint attempt returned 200 and its playback `R77Hmre1a1aeUiDMPv7LiJBS01IVMe02clh018igc4k1PQ` returned HLS 200. R2 delivery is bucket `streampump-delivery-dev` at `https://media.stream-pump.com`; the 241,514-byte disposable object public GET matched SHA256 `1fc5800b7e1365de2e959c37ee47e5dd07fbb1023ded7f53279639ef485b1582`.

Scoped disposable cleanup (not global bucket truth) is proven: the exact Mux asset GET returned 404, the exact R2 object HEAD returned 404 and its public URL returned 404, with deleted event `1a4b2f34-3cf8-f837-2423-cfc818a1d410`. This proves only that the single disposable asset/object was removed; it makes no claim about other objects in the bucket.

Signature-handling M5 evidence: backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` first deployed the Mux missing-signature 401 hardening; current backend `88c0debad6ecb7eacfe9e24793951f3794353f4c` includes it. The live backend remains `INVITE_ONLY_PILOT`, `automatedSettlement=false`, `/ready` READY; the prior endpoint-specific signed probe and provider-backed disposable Mux event evidence remain intact. The signed probe alone is not DB reconciliation proof; M6 later verified the full media/DB/feed corridor.

Historical scope note: the M5 PASS covered deployment and webhook signature handling only. Operator feed approval and full media/DB/auth/corridor reconciliation were not part of M5; they subsequently completed under the separately approved M6 run recorded below.

Required dashboard fields (do not paste the secret):

- Environment: Mux `lnv5m1` (the intended Pilot environment).
- Endpoint URL: the approved Render public backend plus `/api/webhooks/mux`.
- Signing secret: endpoint-specific secret stored only in Render as `MUX_WEBHOOK_SECRET`.
- Event scope: only events consumed by the current controller/reconciliation path.

When rotating, switch the enabled Mux endpoint and its matching signing secret as a pair; a new endpoint must be enabled and its Render `MUX_WEBHOOK_SECRET` updated together before the prior endpoint is disabled. On signature failures, repeated delivery failures, wrong environment, or missing reconciliation visibility, disable the new endpoint, stop media activity, and keep H4 pending — never restore an exposed old endpoint secret.

## M6 — disposable allowlisted corridor and manual Track 1 replay

**Execution result through settlement/replay: PASS.** See [`p4-m6-disposable-corridor-and-track1-runbook.md`](./p4-m6-disposable-corridor-and-track1-runbook.md).

- [x] Prepared role-separated disposable creator and sponsor; ten actor-prep transactions finalized, supply delta exactly 1,000,000 raw test-USDC, zero forbidden-lane instructions.
- [x] Completed real R2/Mux media, operator publication approval, feed/post proof, Track1-only intent, creator+sponsor dual signature, backend relay, and public campaign proof.
- [x] Funded proposal `FPV64F3YL2uCnU1PLfMzUH34WAAvbPFV5ERcJRKGen29` with Track 1 exactly 1,000,000 raw; Track 2 and Track 3 zero.
- [x] Let the fixed deadline elapse naturally; automatic settlement remained off.
- [x] Ran operator-only manual settlement and same-idempotency-key replay. Both returned signature `5hjVwnw5QAvApWbNda2okCkN7mkQHcTZfyN6GaPbn4fGzhtU4x5GfVqzqG42F4V8SzEdR1KXQkhTtC3MBVUKrdFV`; operation attempt count is 1; creator balance is `0 -> 1,000,000 -> 1,000,000`; proof is `SETTLED`; payout applied exactly once.
- [x] Replaced both disposable entries with the sole human-approved baseline `GYjkMEZEFHuY4uRZVwE79eeXAGtoneh53gb49X4HqCMH`. Both disposable actors used locally verified signatures and received the intentional concealed denial `401 AUTH_CHALLENGE_INVALID`; Render config contains neither actor.

Any failure stops the corridor. Do not repair by opening a closed lane, substituting fixtures, changing the mint, weakening auth, or manually rewriting projection truth.

## H4 handoff

H4 is **ready for human review** and must stop here. It is not self-approved. P4 evidence does not authorize P5/P6, public launch, real funds, readiness promotion, external-wallet expansion, or any closed Pilot lane.

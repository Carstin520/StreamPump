# P4 M3 Neon Restore and Migration Runbook

Date: 2026-07-13 (Asia/Shanghai)

Status: **prepared only; M3 is not approved and Neon production is unchanged.** This is an invite-only technical Pilot on Solana devnet/test-USDC, not a production launch or real-funds release.

## Frozen target and scope

- Neon project: `StreamPump`, project ID `jolly-recipe-31299801`, AWS `us-east-1`, PostgreSQL 17.
- Production source: default/root branch `production`, branch ID `br-orange-bar-ancofkw5`, database `neondb`.
- Live read-only observation at `2026-07-13T08:31:07Z`: PostgreSQL `17.10`, 20 applied migrations, 0 failed, 0 rolled back, and the six frozen migrations below pending.
- Current project history-retention window: 21,600 seconds (6 hours). The durable M3 recovery object will be a named current-point child branch created immediately after write quiescence; it must remain undeleted through H4.
- The production branch is currently unprotected. M3 does not authorize changing project protection or retention settings.

M3 approval covers only:

1. Suspend or otherwise make the existing Render backend write-inert and keep it write-inert until the M4 candidate passes readiness.
2. Create and verify one current-point Neon child branch from `br-orange-bar-ancofkw5`.
3. Apply exactly the six frozen Prisma migrations to production branch `br-orange-bar-ancofkw5`.
4. Run the frozen post-migration read-only verification.

M3 does not authorize a Render code deployment, Vercel deployment, Mux change, corridor transaction, settlement, branch reset, production restore, credential rotation, or deletion of the recovery branch.

## Why the backend must be write-inert

The current Render baseline `b362910c7ca204f8724af7a1a74411757e2abce1` can still accept creator self-verification and mark content feed-eligible. Its launch finalization can also recreate the historical unverifiable anchor-transaction claim that migration `20260712160000` clears. The data cleanup is one-time, so leaving that backend writable between M3 and M4 would allow the old truth model to repopulate invalid rows.

Required condition: enter a planned write-quiesced window before the final production preflight, keep the old backend suspended/write-inert through migration, and do not resume it. M4 either promotes the new candidate after readiness succeeds or follows a separately approved recovery path. A health check returning 200 is not proof of write quiescence.

## Frozen migrations

| Order | Migration | SHA256 |
| --- | --- | --- |
| 21 | `20260712120000_pilot_content_storage_truth` | `e17c50e0c3fd244ce0e475e33c28376f9f8deaf7b840aa4b264f4125f7e57033` |
| 22 | `20260712130000_api_idempotency` | `5ae3b523428a9d0614bb5ccde15d42c6bf2e8f6913fdfc3369088bc288f5d9ec` |
| 23 | `20260712150000_track1_settlement_audit` | `2ec0a4c26e2338ee5ef7f3c9659b816b383d5d7231dfd814278adf1585df4fce` |
| 24 | `20260712160000_clear_unverifiable_anchor_transactions` | `ce29f29ce3a0ad4a25542febfc9bc865e0d98c871308eda915f2f1d60a86d670` |
| 25 | `20260712170000_chain_ingestion_recovery` | `56c75a158c9695b02a392deb647f64043e20ffd4d10b2d80ce7ff99a2c8d00ae` |
| 26 | `20260712180000_pilot_operator_events` | `8537e8d57b565d1b7d4215854c9a7c9023482faca1f204d76e7acb5e9337408d` |

The migration `20260712170000` must include enum state `PRUNED`; the checksum above is the corrected candidate. Do not use or resolve an older copy.

## Provisional read-only impact baseline

Observed at `2026-07-13T08:33:36Z`, before write quiescence:

- `VERIFIED` publications: 0; empty-set digest `d41d8cd98f00b204e9800998ecf8427e`.
- Feed-eligible manifests: 10; digest `4952cd95394ec95e1dea10f5b73d7242`; projected result 1 `ANCHORED` and 9 `READY`.
- OPEN/FUNDED unclaimed proposals: 13; digest `2f9c67f4b19f2efddf1e32925c8432d6`; 0 have non-null publication truth.
- Unverifiable manifest anchor transaction claims: 8; digest `3a04d81e5aae785070dca9c504af11db`.
- Proposal anchor transaction claims: 0.

These values are evidence, not an eternal assumption. After write quiescence, rerun the verifier on production, create the child branch, run it on the child, and require the two sanitized data snapshots to match exactly. Any drift before quiescence must be reviewed; any drift after quiescence is a stop condition.

## Credential and target binding

Do not paste database URLs into chat or place them in Git. Use a repository-external, mode-`0600` dotenv file containing only `DATABASE_URL` and `DIRECT_URL`, for example:

```text
/Users/jamesli/.config/streampump/p4-neon.env
```

`DATABASE_URL` may use the pooled endpoint; `DIRECT_URL` must use the direct endpoint. Both must resolve in the Neon dashboard to project `jolly-recipe-31299801`, branch `br-orange-bar-ancofkw5`, and database `neondb`. Record only:

- project and branch IDs;
- branch name and parent ID;
- endpoint ID and SHA256 of the direct hostname;
- database name and SHA256 of the role name;
- creation point time/LSN if Neon exposes it;
- created and verified UTC timestamps.

The verifier requires approved host and role fingerprints. It requires both URLs, normalizes Neon's `-pooler` hostname marker, and refuses pooled/direct endpoint, database, host-fingerprint, or role-fingerprint mismatches. It opens `BEGIN TRANSACTION READ ONLY`, applies timeouts, and prints no URL, hostname, username, or row identifier.

## Exact controlled order

### 1. Enter write quiescence

Human approval is required before changing Render state. Confirm there is no active Render deploy or separate migration runner, then suspend/make the current backend write-inert. Record the service/deploy ID and UTC time. Verify repeated write attempts cannot reach the old application, then wait for old application database sessions to drain. The final verifier requires zero other PostgreSQL client backends in `neondb`; do not treat `/health` alone as evidence.

Stop if the backend cannot be made write-inert without an unapproved deployment or credential change.

### 2. Freeze the final production preflight

From the clean worktree:

```bash
set -euo pipefail
umask 077
cd /private/tmp/streampump-p4-codex

export P4_PRODUCTION_NEON_ENV_FILE=/Users/jamesli/.config/streampump/p4-neon.env
test "$(stat -f '%Lp' "$P4_PRODUCTION_NEON_ENV_FILE")" = 600
test -x ./backend/node_modules/.bin/ts-node
test -x ./backend/node_modules/.bin/prisma

set -a
. "$P4_PRODUCTION_NEON_ENV_FILE"
set +a

export P4_EXPECTED_NEON_DATABASE=neondb
export P4_EXPECTED_NEON_HOST_SHA256='<sha256 of the approved normalized direct endpoint hostname>'
export P4_EXPECTED_NEON_ROLE_SHA256='<sha256 of the approved production role name>'
export P4_M3_EXPECTED_PHASE=pre
export P4_M3_REQUIRE_QUIESCED=true

set +e
./backend/node_modules/.bin/ts-node --transpile-only backend/scripts/p4-verify-neon-migration.ts \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-pre.json \
  2> /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-pre.err
VERIFY_EXIT=$?
set -e
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-pre.{json,err}
test "$VERIFY_EXIT" = 0
```

Expected: `ok=true`, phase `pre`, 26 local migrations, the exact 20-name applied set with matching checksums, no failed/rolled-back migration, and `otherClientBackends=0`.

### 3. Create and verify the recovery branch

Create one named current-point child branch from production immediately after the production preflight. Suggested name:

```text
p4-m3-pre-<UTC timestamp>
```

Do not set automatic expiration. Verify from Neon metadata that its parent is `br-orange-bar-ancofkw5`, state is ready, and its creation time is after write quiescence. Create a compute endpoint only as needed for verification. Put that branch's pooled/direct connections in a separate mode-`0600` file such as `/Users/jamesli/.config/streampump/p4-neon-recovery.env`, freeze its normalized host and role fingerprints, run the same verifier in `pre` mode, and save `neon-m3-restore-pre.json`.

Compare the `migrations` and `data` objects from production and recovery evidence. They must match exactly. Do not compare target host/role fingerprints or timestamps.

Stop if the branch is missing, expired, not a child of the frozen source, not connectable, has different migration history/data digests, or was created before quiescence.

### 4. Final mutation command

Only after M3 approval and steps 1–3 pass:

```bash
cd /private/tmp/streampump-p4-codex
set -a
. "$P4_PRODUCTION_NEON_ENV_FILE"
set +a
export P4_EXPECTED_NEON_DATABASE=neondb
export P4_EXPECTED_NEON_HOST_SHA256='<sha256 of the approved normalized production direct endpoint hostname>'
export P4_EXPECTED_NEON_ROLE_SHA256='<sha256 of the approved production role name>'
export P4_M3_EXPECTED_PHASE=pre
export P4_M3_REQUIRE_QUIESCED=true

# Re-prove the production target after leaving the recovery-branch check.
set +e
./backend/node_modules/.bin/ts-node --transpile-only backend/scripts/p4-verify-neon-migration.ts \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.json \
  2> /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.err
FINAL_VERIFY_EXIT=$?
set -e
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.{json,err}
test "$FINAL_VERIFY_EXIT" = 0

# Prove the recovery branch contains the exact final quiesced production state.
jq -S '{migrations,data}' \
  /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.json \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.compare.json
jq -S '{migrations,data}' \
  /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-restore-pre.json \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-restore-pre.compare.json
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-*.compare.json
cmp \
  /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-final-pre.compare.json \
  /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-restore-pre.compare.json

test -n "${DIRECT_URL:-}"
test -n "${DATABASE_URL:-}"
set +e
cd /private/tmp/streampump-p4-codex/backend
npm run prisma:migrate:deploy \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-migrate.log 2>&1
MIGRATE_EXIT=$?
set -e
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-migrate.log
```

Do not rerun on a non-zero exit. A timeout, disconnected client, or partial output is ambiguous until database state is re-read.

### 5. Unconditional post-state resolution

Whether the deploy exit is zero or non-zero, keep Render write-inert and run:

```bash
cd /private/tmp/streampump-p4-codex
export P4_M3_EXPECTED_PHASE=post
set +e
./backend/node_modules/.bin/ts-node --transpile-only backend/scripts/p4-verify-neon-migration.ts \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-post.json \
  2> /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-post.err
POST_VERIFY_EXIT=$?
set -e
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-production-post.{json,err}
test "$POST_VERIFY_EXIT" = 0

cd backend
set +e
npx prisma migrate status \
  > /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-status.log 2>&1
STATUS_EXIT=$?
set -e
chmod 600 /Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/neon-m3-status.log
```

M3 passes only when all of these are true:

- `MIGRATE_EXIT=0` and `STATUS_EXIT=0`; a non-zero deploy exit remains ambiguous even if later reads look complete;
- the exact 26-name migration set is applied once; no failed or rolled-back row exists; every checksum matches;
- all nine new columns, four tables, four enums, thirteen indexes, and the Track1-to-Proposal foreign key exist;
- `ChainIngestionStatus` includes `PRUNED` in the frozen order;
- `VERIFIED` publications, feed-eligible manifests, scoped proposals with publication truth, unverifiable manifest anchor claims, and proposal anchor claims are all zero;
- `prisma migrate status` exits 0;
- the recovery branch is still ready and unchanged;
- the old Render backend remains write-inert.

### 6. Handoff to M4

Do not resume the old backend. M4 begins from a planned maintenance state, inventories exact environment truth, deploys the fixed candidate, and requires `/health`, `/ready`, chain/config/mint/oracle, CORS, and fail-closed API checks before Vercel promotion.

## Failure and rollback boundary

Any mismatch is a stop. Preserve logs/evidence without publishing credentials. Do not run `prisma migrate resolve`, hand-edit `_prisma_migrations`, delete/recreate migrations, blindly rerun deploy, reset the production branch, or repoint Render.

The recovery child branch is the frozen rollback source, not an automatic rollback action. Because production is the root branch, recovery requires a separate human decision:

- **Restore production to the frozen point:** planned outage and explicit approval; verify all 20 pre-migration checksums and frozen data digests after restore.
- **Repoint Render to the recovery branch:** separate M4/recovery approval; first prove the application role/credentials and both pooled/direct bindings belong to that child branch, then update both URLs atomically and re-run backend readiness.

In either case, keep the service write-inert until the selected recovery is proven. Never delete the recovery branch before H4.

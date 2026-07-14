# P4 Rollback Bundle Manifest

This file documents rollback artifacts and immutable pre-mutation identifiers. Binary backups and provider secrets are machine-local and must never be committed.

Gate status: **M2–M5 completed successfully and M6 completed through the disposable corridor plus manual Track 1 settlement/replay. The live full padded program hash is `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732`; chain rollback was not required. Neon has 26 applied migrations and recovery branch `br-frosty-fire-an0lsiq2` is retained. Render deploy `dep-d9at6enavr4c73b0rc20` is live at backend commit `67ec60c7679aca2d7adad24780ae043370c426e3`; Vercel Production remains `dpl_6f9LBgHRqB8hCywV5DimXfV9YqUK` at frontend commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19`. `/health` and `/ready` are healthy with automated settlement off. M6's on-chain payout is irreversible and cannot be undone by an application rollback. Allowlist restoration remains blocked pending an approved non-disposable external Pilot wallet; H4 is pending.**

**Current live readiness:** release `67ec60c…` returns `/health` HTTP 200 with `INVITE_ONLY_PILOT` and `automatedSettlement=false`; `/ready` is HTTP 200 with database/indexer/Mux reconciliation all `READY`. Three contiguous exact Fable reviews (`80be8eb..a1de424`, `a1de424..5d07748`, `5d07748..67ec60c`) cover the frozen candidate and passed with zero blocker/major; do not repeat a full-repository review.

**Historical stopped M2 attempt (superseded by the final state below):** buffer creation succeeded, but payload writing initially stopped on sustained provider 429 responses before ProgramData extension. At that observation point the program was still at the pre-upgrade hash/capacity and buffer `BEwVgZ3MnBuLaMNKYiUg6NVDDLnnija7i4adFzaJ6Kof` was retained for resume.

**Historical incident in that stopped attempt:** an orphaned Agave CLI writer was terminated; its credential was revoked and later rotated. The post-stop snapshot had a 25,200-byte matching prefix, 1,249 pending chunks, deployed SHA `96b114...`, and capacity 1,318,104. This is incident evidence, not current program, buffer, wallet, or credential state.

Final M2 superseding state: the dedicated RPC credential was rotated and fixed to devnet; all 1,249 pending chunks were written and finalized with paired signature-ledger records; the buffer dump matched the candidate. Extend signature `y5nHSXckht6d6iEKATcBejYYdH5UVPxqN5DJS8iXCg8Za2TSyrX7zZztxoAd7yS8Fm3zwveTjyioRkBrg9BxHQR` produced capacity 1,328,344 and padded rollback hash `8f3679...`. Upgrade signature `A2xT2qeH6sX3bfUsvPcqmtDU1F8QNsykv8AnKqvvcXwX8ySsKHUZjaVdm86c3gs1ydXSV66HDvu6PR8c7Hri5v1` produced the padded candidate hash `a6008d9c...` at finalized slot 475933115. The candidate buffer is closed and independent public-devnet verification returned GO. Retain all rollback artifacts because the capacity increase is permanent even though program bytes remain rollback-capable.

## Local secure bundle

Path: `/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation`

Directory mode must be `0700`; files must be `0600`.

| Artifact | Size | SHA256 / value |
| --- | ---: | --- |
| `streampump_core-pre.so` | 1,318,104 bytes | `96b114bb1b130695b7a7cccc1ce9a41bf953c4acd6179120acc4a2a87e591457` |
| `streampump_core-candidate.so` | 1,321,192 bytes | `5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4` |
| `streampump_core-candidate-padded-1328344.so` | 1,328,344 bytes | `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732` |
| `streampump_core-rollback-padded-1328344.so` | 1,328,344 bytes | `8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247` |
| `program-show-pre.json` | metadata only | ProgramData `58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs`; capacity 1,318,104 |
| `candidate-buffer-dump.so` | 1,321,192 bytes | `5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4` |
| `streampump_core-m2-post.so` | 1,328,344 bytes | `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732` |
| `program-extend-m2-result.json` | transaction evidence | finalized extend signature recorded above |
| `program-deploy-m2-result.json` | transaction evidence | finalized upgrade signature recorded above |

Frozen account-data checks:

- ProtocolConfig data SHA256: `9b31d5bddff4f8b4828ed4baf695d9514ca180de6c126b54cc7b22bf710fcc8d` (297 bytes; owner is the StreamPump program).
- Pilot test-USDC mint data SHA256: `c422c88798c152d9eaf5c4f7329b9f0c1642093dfd021b69a47a9b49c393ee04` (82 bytes; legacy SPL Token owner).

Program ID: `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`

Observed upgrade authority: `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw`

Required loader-compatible extension: 10,240 bytes, from 1,318,104 to 1,328,344. ProgramData capacity cannot be shrunk by rollback; only program bytes are restored. The earlier 3,088-byte padded artifact is retained only as superseded local evidence and must not be used by the revised runbook.

## Migration checksums

| Migration | SHA256 |
| --- | --- |
| `20260712120000_pilot_content_storage_truth` | `e17c50e0c3fd244ce0e475e33c28376f9f8deaf7b840aa4b264f4125f7e57033` |
| `20260712130000_api_idempotency` | `5ae3b523428a9d0614bb5ccde15d42c6bf2e8f6913fdfc3369088bc288f5d9ec` |
| `20260712150000_track1_settlement_audit` | `2ec0a4c26e2338ee5ef7f3c9659b816b383d5d7231dfd814278adf1585df4fce` |
| `20260712160000_clear_unverifiable_anchor_transactions` | `ce29f29ce3a0ad4a25542febfc9bc865e0d98c871308eda915f2f1d60a86d670` |
| `20260712170000_chain_ingestion_recovery` | `56c75a158c9695b02a392deb647f64043e20ffd4d10b2d80ce7ff99a2c8d00ae` |
| `20260712180000_pilot_operator_events` | `8537e8d57b565d1b7d4215854c9a7c9023482faca1f204d76e7acb5e9337408d` |

The `20260712170000` checksum is the merged P3 fix containing the `PRUNED` enum state; do not use its earlier pre-fix checksum.

## Provider rollback identifiers

| Surface | Pre-mutation rollback target | Status |
| --- | --- | --- |
| Git integration | `dd49e433880462a9499036e7620a8436d7c770c3` | frozen |
| Render production | deploy `dep-d8upmol7vvec73ejb8gg`, commit `b362910c7ca204f8724af7a1a74411757e2abce1` | frozen |
| Vercel Production | `dpl_DmwV2BsLVjmS2ifqCDat9hQpAETV`, commit `cbdf76a5df896adbe88a9e07586ac3478e45f720`, ref `main` | frozen |
| Neon | project `jolly-recipe-31299801`; source `production` / `br-orange-bar-ancofkw5`; recovery `p4-m3-pre-20260713T093116Z` / `br-frosty-fire-an0lsiq2` | verified pre-migration snapshot; unchanged after M3; retain through H4 |
| Mux | previously enabled endpoint IDs (`onrender`, `trycloudflare`) — kept disabled — and the endpoint-specific secret version | M5 complete: environment `lnv5m1` has only `https://api.stream-pump.com/api/webhooks/mux` enabled; the disposable test asset/object is deleted (proven). Never restore an exposed old endpoint secret; the secret value must stay in dashboard/secret manager. |

M4 and M5 completed on 2026-07-13; their deployment identifiers remain historical evidence. M6 advanced only the backend: current Render deployment `dep-d9at6enavr4c73b0rc20` on service `srv-d79rs0450q8c73fp2lmg` is live at `67ec60c7679aca2d7adad24780ae043370c426e3`; current Vercel Production remains `dpl_6f9LBgHRqB8hCywV5DimXfV9YqUK` at `097e9805b197398ae1c04cf5bf84f1044b3b2f19`. Auto-deploy is disabled and pre-deploy remains the read-only exact-26 Neon gate. The immediately preceding backend candidate is `5d07748b792addee2385a77cfba0c83db5f25d99` (`dep-d9ass0uq1p3s73da5sj0`), but it contains the production presign advisory-lock deserialization failure; redeploy it only as an explicitly accepted application-behavior rollback with matching `PILOT_EXPECTED_RELEASE_SHA`. Older `73df4e2c…` also restores a known `/ready` 503 state. No application rollback reverses Neon migrations, the program upgrade, the creator registration/upgrade receipt, the test-USDC mint, proposal funding, or the finalized Track 1 payout.

M3 execution and recovery authority are defined in [`p4-m3-neon-migration.md`](./p4-m3-neon-migration.md). The old Render backend must be write-inert before the final Neon preflight and remain so until M4 readiness succeeds. The named current-point child branch is a recovery source, not authorization to reset production or repoint Render; either action requires a separate human decision.

Credential containment: the inherited `neondb_owner` connection string was echoed once into the local operator tool transcript during recovery verification, and the Render deploy hook also entered a local operator inspection transcript. Neither secret is stored in Git or the durable evidence bundle. Under M4, treat the role password as exposed and rotate it, atomically updating Render `DATABASE_URL` and `DIRECT_URL` before resuming any backend; also regenerate the Render deploy hook. Never paste replacement values into chat or command output.

## Mux webhook and media rollback procedure

This covers the M5 surface. It is dashboard/secret-manager work, not a scripted
mutation, and it must never print or restore a secret value.

- **Switch endpoint and signing secret as a pair.** The enabled Mux endpoint and the Render `MUX_WEBHOOK_SECRET` are a matched pair. To change endpoints, enable the new endpoint and set its endpoint-specific secret in Render first, then disable the prior one. Current M5 state: environment `lnv5m1` has only `https://api.stream-pump.com/api/webhooks/mux` enabled; the older `onrender` and `trycloudflare` endpoints stay disabled.
- **Never restore an exposed old endpoint secret.** A rollback rotates forward to a fresh endpoint-specific secret; it does not reinstate a previously exposed one.
- **Stop media/reconciliation before mutating the endpoint.** Quiesce the Mux reconciliation path (and any in-flight media corridor) before disabling/replacing an endpoint so no delivery is silently dropped mid-flight.
- **Keep infrastructure intact — do not delete.** Preserve the distinct private-origin and public-delivery R2 buckets (`streampump-delivery-dev` at `https://media.stream-pump.com`) and the custom domain. Rollback disables/repoints; it does not tear down buckets or domains.
- **The disposable asset/object needs no rollback.** The M5 disposable Mux asset `vbmHviLSWRCMAPSoTk6zQG02l2BscN01Nhl79sL9v5wh8` and its R2 object are already deleted with proof (Mux asset GET 404, R2 object HEAD 404 and public URL 404, deleted event `1a4b2f34-3cf8-f837-2423-cfc818a1d410`). This is scoped disposable cleanup, not global bucket truth.
- **Historical application rollback behavior.** M5 backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` returned 401 for both missing and invalid `mux-signature`; older commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19` returns 500 for a missing signature. Neither is the current runtime or an automatic healthy rollback target. Any explicit rollback must describe the restored behavior honestly and cannot reverse later M6 devnet state.

## Program byte rollback procedure

This is a mutation covered only by the approved M2 failure path. It requires
the same dedicated devnet RPC environment and temporary mode-`0600` CLI config
from the M2 runbook; never pass the credential-bearing URL in argv and never
rely on CLI defaults. Do not use Agave's parallel payload writer.

```bash
set -euo pipefail
umask 077

PROGRAM_ID=FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp
PRE_SO=/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/streampump_core-rollback-padded-1328344.so
FEE_PAYER=/Users/jamesli/.config/solana/streampump-p4-devnet-fee-payer.json
UPGRADE_AUTHORITY_KEYPAIR=/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/devnet-upgrade-authority.json
SOLANA_CONFIG=/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/.solana-cli-p4.yml
BUNDLE_DIR=/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation
ROLLBACK_BUFFER_KEYPAIR='/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/rollback-buffer-keypair.json'
ROLLBACK_BUFFER_DUMP='/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/rollback-buffer-dump.so'
POST_ROLLBACK_DUMP='/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation/streampump_core-m2-post-rollback.so'
CREATE_BUFFER='/private/tmp/streampump-p4-codex/scripts/p4-create-program-buffer.ts'
WRITE_BUFFER='/private/tmp/streampump-p4-codex/scripts/p4-resume-buffer-write.ts'

unset PILOT_TX_RPC_URL
source /Users/jamesli/.config/streampump/p4-rpc.env
test -n "${PILOT_TX_RPC_URL:-}"
cleanup_p4_cli_config() { rm -f "$SOLANA_CONFIG"; }
cleanup_p4_cli_config
SOLANA_CONFIG="$SOLANA_CONFIG" node <<'NODE'
const fs = require("fs");
const path = process.env.SOLANA_CONFIG;
const url = process.env.PILOT_TX_RPC_URL;
if (!path || !url) throw new Error("P4 rollback CLI config inputs are missing");
const keypairPath = "/Users/jamesli/.config/solana/streampump-p4-devnet-fee-payer.json";
const yaml = [
  "---",
  `json_rpc_url: ${JSON.stringify(url)}`,
  "websocket_url: ''",
  `keypair_path: ${JSON.stringify(keypairPath)}`,
  "address_labels:",
  "  system: System Program",
  "commitment: confirmed",
  "",
].join("\n");
fs.writeFileSync(path, yaml, { mode: 0o600 });
NODE
chmod 600 "$SOLANA_CONFIG"
trap cleanup_p4_cli_config EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

run_p4_ts() {
  NODE_PATH='/Users/jamesli/Developer/Sol Projects/StreamPump/node_modules' \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","esModuleInterop":true}' \
    node -r '/Users/jamesli/Developer/Sol Projects/StreamPump/node_modules/ts-node/register/transpile-only' "$@"
}

safe_rpc() {
  local stdout_file stderr_file exit_code
  stdout_file="$(mktemp "$BUNDLE_DIR/.rpc-stdout.XXXXXX")"
  stderr_file="$(mktemp "$BUNDLE_DIR/.rpc-stderr.XXXXXX")"
  if "$@" >"$stdout_file" 2>"$stderr_file"; then
    cat "$stdout_file"
    rm -f "$stdout_file" "$stderr_file"
    return 0
  else
    exit_code=$?
    rm -f "$stdout_file" "$stderr_file"
    echo 'RPC command failed; credential-bearing provider details suppressed' >&2
    return "$exit_code"
  fi
}

test "$(stat -f %z "$PRE_SO")" = 1328344
test "$(shasum -a 256 "$PRE_SO" | awk '{print $1}')" = 8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247
test "$(stat -f %Lp "$UPGRADE_AUTHORITY_KEYPAIR")" = 600
test "$(solana-keygen pubkey "$UPGRADE_AUTHORITY_KEYPAIR")" = BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw
test "$(stat -f %Lp "$SOLANA_CONFIG")" = 600

# Reuse durable rollback inventory after interruption. Never delete or replace
# an existing keypair/buffer: the same account may already contain finalized
# chunks whose signatures and rent must remain attributable.
if test -e "$ROLLBACK_BUFFER_KEYPAIR"; then
  test "$(stat -f %Lp "$ROLLBACK_BUFFER_KEYPAIR")" = 600
else
  solana-keygen new --no-bip39-passphrase --silent --outfile "$ROLLBACK_BUFFER_KEYPAIR"
  chmod 600 "$ROLLBACK_BUFFER_KEYPAIR"
fi
ROLLBACK_BUFFER_ADDRESS="$(solana-keygen pubkey "$ROLLBACK_BUFFER_KEYPAIR")"

export P4_BUFFER_KEYPAIR="$ROLLBACK_BUFFER_KEYPAIR"
export P4_EXPECTED_BUFFER="$ROLLBACK_BUFFER_ADDRESS"
export P4_BUFFER_AUTHORITY_KEYPAIR="$UPGRADE_AUTHORITY_KEYPAIR"
export P4_FEE_PAYER_KEYPAIR="$FEE_PAYER"
export P4_PROGRAM_SO="$PRE_SO"
export P4_EXPECTED_SHA256='8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247'
export P4_ARTIFACT_ROLE=rollback
export P4_WRITE_DELAY_MS=3000

# Read-only inventory first. If the account already exists, CREATE_BUFFER
# validates and reuses it without sending a creation transaction. If only the
# durable keypair exists, creation is one preflighted transaction; a lost
# response is resolved only from finalized account state. Never delete/rebuild.
P4_DRY_RUN=true run_p4_ts "$CREATE_BUFFER"
P4_CREATE_BUFFER=true run_p4_ts "$CREATE_BUFFER" \
  > "$BUNDLE_DIR/rollback-buffer-create-result.json"
chmod 600 "$BUNDLE_DIR/rollback-buffer-create-result.json"
cat "$BUNDLE_DIR/rollback-buffer-create-result.json"

# Write one finalized canary, re-inventory, then continue in operator-observed
# batches no larger than 25 until pendingChunks reaches zero.
P4_DRY_RUN=true run_p4_ts "$WRITE_BUFFER"
P4_MAX_CHUNKS=1 run_p4_ts "$WRITE_BUFFER"
while true; do
  inventory="$(P4_DRY_RUN=true run_p4_ts "$WRITE_BUFFER")"
  printf '%s\n' "$inventory"
  pending="$(printf '%s\n' "$inventory" | jq -r 'select(.phase == "inventory") | .pendingChunks')"
  test "$pending" -ge 0
  if test "$pending" -eq 0; then break; fi
  printf 'Type CONTINUE to write the next capped rollback batch: '
  IFS= read -r reply
  test "$reply" = CONTINUE
  P4_MAX_CHUNKS=25 run_p4_ts "$WRITE_BUFFER"
done

# The writer appends every signed and confirmed/finalized transaction to the
# mode-0600 rollback-buffer-write-signatures.jsonl ledger in BUNDLE_DIR.

safe_rpc solana program dump "$ROLLBACK_BUFFER_ADDRESS" "$ROLLBACK_BUFFER_DUMP" \
  --config "$SOLANA_CONFIG" --keypair "$FEE_PAYER" --commitment finalized
chmod 600 "$ROLLBACK_BUFFER_DUMP"
test "$(stat -f %z "$ROLLBACK_BUFFER_DUMP")" = 1328344
test "$(shasum -a 256 "$ROLLBACK_BUFFER_DUMP" | awk '{print $1}')" = 8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247
cmp "$PRE_SO" "$ROLLBACK_BUFFER_DUMP"

# Capture the rollback deploy exit code, but always resolve the result from a
# finalized program dump. Never resend solely because the CLI returned nonzero.
set +e
safe_rpc solana program deploy \
  --config "$SOLANA_CONFIG" \
  --program-id "$PROGRAM_ID" \
  --buffer "$ROLLBACK_BUFFER_KEYPAIR" \
  --upgrade-authority "$UPGRADE_AUTHORITY_KEYPAIR" \
  --fee-payer "$FEE_PAYER" \
  --keypair "$FEE_PAYER" \
  --no-auto-extend \
  --use-rpc \
  --max-sign-attempts 1 \
  --commitment finalized \
  --output json > "$BUNDLE_DIR/program-deploy-m2-rollback-result.json"
ROLLBACK_DEPLOY_EXIT_CODE=$?
set -e
chmod 600 "$BUNDLE_DIR/program-deploy-m2-rollback-result.json"
cat "$BUNDLE_DIR/program-deploy-m2-rollback-result.json"
printf 'rollback deploy CLI exit code: %s\n' "$ROLLBACK_DEPLOY_EXIT_CODE"

# This finalized dump is unconditional after the rollback deploy attempt.
safe_rpc solana program dump "$PROGRAM_ID" "$POST_ROLLBACK_DUMP" \
  --config "$SOLANA_CONFIG" --keypair "$FEE_PAYER" --commitment finalized
chmod 600 "$POST_ROLLBACK_DUMP"
test "$(stat -f %z "$POST_ROLLBACK_DUMP")" = 1328344
ROLLBACK_POST_SHA256="$(shasum -a 256 "$POST_ROLLBACK_DUMP" | awk '{print $1}')"
if test "$ROLLBACK_POST_SHA256" != 8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247; then
  printf 'Rollback is not proven; finalized program hash is %s. Stop without blind resend and preserve the existing rollback keypair/buffer inventory.\n' "$ROLLBACK_POST_SHA256" >&2
  exit 22
fi
cmp "$PRE_SO" "$POST_ROLLBACK_DUMP"

P4_EXPECTED_PROGRAM_SHA256='8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247' \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-verify-chain-baseline.ts
```

After ProgramData has been extended, the final dump/hash must match the 1,328,344-byte padded rollback artifact: `8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247`. The original unpadded artifact remains the pre-mutation evidence with SHA256 `96b114...`. If the post-rollback dump does not match the padded artifact byte-for-byte, stop and do not attempt database or platform mutation.

## M6 irreversible and reconciliation state

Proposal `FPV64F3YL2uCnU1PLfMzUH34WAAvbPFV5ERcJRKGen29` is funded with Track 1 exactly 1,000,000 raw test-USDC and Track 2/3 zero. Manual settlement finalized at signature `5hjVwnw5QAvApWbNda2okCkN7mkQHcTZfyN6GaPbn4fGzhtU4x5GfVqzqG42F4V8SzEdR1KXQkhTtC3MBVUKrdFV`; the same-idempotency-key replay returned the same signature, `attemptCount=1`, and creator balance remained `0 -> 1,000,000 -> 1,000,000`. Treat that signature as the reconciliation key; never submit under a different idempotency key. The payout, creator profile/receipt, proposal funding, fees/rent, and test-USDC supply increase are durable devnet state and are not application-roll-backable.

Allowlist cleanup is not executed: no non-disposable pre-M6 baseline exists, and deleting both current actors would empty the fail-closed allowlist. Keep invite-only and automated settlement off. A human must approve at least one legitimate non-disposable external Pilot wallet before replacing the two actors; then prove both disposable wallets receive `403 PILOT_INVITE_REQUIRED`. Until then H4 remains pending.

## Evidence retention

Retain without secrets:

- UTC and local timestamps.
- Exact git SHA and migration hashes.
- Program/buffer/ProgramData addresses, transaction signatures, byte sizes, and SHA256 hashes.
- Neon restore identifier and schema/count verification output.
- Render/Vercel deployment identifiers and health results.
- Mux endpoint identifier, event IDs, delivery result, and asset/playback IDs.
- Disposable actor public keys, minimal funding amounts, proposal PDA, manifest ID/hash, exact Track 1 settlement/replay signature, exactly-once balance result, and allowlist cleanup blocker/status.

Never retain private-key bytes, seed phrases, database URLs, credential-bearing RPC URLs, Mux signing secrets, R2 keys, operator keys, auth tokens, or session cookies.

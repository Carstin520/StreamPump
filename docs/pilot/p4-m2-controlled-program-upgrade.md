# P4 M2 Controlled Devnet Program Upgrade

Gate status: **M1 and the original M2 approved. Buffer resume is paused until the rotated dedicated RPC is configured. Read-only simulation proved Solana rejects 3,088 bytes and requires a minimum 10,240-byte extension; renewed human approval is required before this revised irreversible step. No ProgramData extend/upgrade has occurred.**

Preflight history: the first dedicated-RPC attempt returned HTTP 401 before any chain read completed, and the CLI included the credential-bearing URL in its error. No transaction or chain mutation occurred. That credential must be rotated before retry. The wrapper below suppresses raw RPC stderr so a future provider error cannot repeat the disclosure.

Retry result: replacement dedicated Helius devnet RPC passed the full preflight. Observed capacity remained 1,318,104; last deploy slot remained 471831090; fee payer balance was 15 devnet SOL; pre/candidate/padded-rollback hashes matched; and dedicated RPC ProtocolConfig/test-USDC bytes matched public devnet exactly. No mutation was executed.

Execution update: after human M2 approval, buffer `BEwVgZ3MnBuLaMNKYiUg6NVDDLnnija7i4adFzaJ6Kof` was created with authority `BNQPL...` and the correct allocation. Helius then repeatedly returned HTTP 429 while writing payload chunks. All write processes were stopped before `extend`; deployed program bytes/capacity/authority remain unchanged. The partial buffer is retained for resumable writes and its rent remains recoverable. Resume requires a dedicated devnet transaction RPC with sufficient sustained send/confirm quota, followed by full buffer dump/hash/cmp before any extension.

Process audit correction: the initial Agave CLI writer had orphaned and was still issuing parallel RPC sends. It was explicitly terminated and no writer/deploy process remains. Because its command line exposed the credential-bearing URL through `ps`, the RPC key must be rotated again. A replacement raw JSON-RPC writer now enforces method-level backoff and explicit pacing; its one-chunk write/readback test passed. Resume is blocked until the new credential is installed.

Scope: Solana devnet program buffer write, loader-compatible exact 10,240-byte ProgramData extension, controlled upgrade, post-upgrade byte/config verification, and immediate byte rollback if any invariant fails. No Neon, Render, Vercel, Mux, corridor, or settlement mutation is included.

## Fixed inputs

```bash
export PROGRAM_ID='FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp'
export PROGRAMDATA_ID='58F5kifyMnkjNkKUpGULaxUHe4kLqcrr37fhLVAwmrbs'
export PROTOCOL_CONFIG='GqQ2wE39EskRYAsy1PV11XRWJTrSQ8ebR6o2J7NbSN2g'
export TEST_USDC_MINT='5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ'
export DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

export BUNDLE_DIR='/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation'
export CANDIDATE_SO="$BUNDLE_DIR/streampump_core-candidate.so"
export CANDIDATE_PADDED_SO="$BUNDLE_DIR/streampump_core-candidate-padded-1328344.so"
export ROLLBACK_SO="$BUNDLE_DIR/streampump_core-rollback-padded-1328344.so"
export FEE_PAYER='/Users/jamesli/.config/solana/streampump-p4-devnet-fee-payer.json'
export UPGRADE_AUTHORITY="$BUNDLE_DIR/devnet-upgrade-authority.json"
export BUFFER_KEYPAIR="$BUNDLE_DIR/candidate-buffer-keypair.json"
export BUFFER_ADDRESS='BEwVgZ3MnBuLaMNKYiUg6NVDDLnnija7i4adFzaJ6Kof'
export P4_SOLANA_CONFIG="$BUNDLE_DIR/.solana-cli-p4.yml"

# The local operator fills this mode-0600 file outside the repository. Never
# paste its URL into chat, a committed file, command output, or screenshots.
set -euo pipefail
umask 077
unset PILOT_TX_RPC_URL
source /Users/jamesli/.config/streampump/p4-rpc.env
test -n "${PILOT_TX_RPC_URL:-}"
cleanup_p4_cli_config() { rm -f "$P4_SOLANA_CONFIG"; }
cleanup_p4_cli_config

# Materialize a temporary mode-0600 CLI config without putting the
# credential-bearing URL in a process argument. Remove it automatically when
# this operator shell exits. The TypeScript resume writer continues to read the
# URL only from the environment.
P4_SOLANA_CONFIG="$P4_SOLANA_CONFIG" node <<'NODE'
const fs = require("fs");
const path = process.env.P4_SOLANA_CONFIG;
const url = process.env.PILOT_TX_RPC_URL;
if (!path || !url) throw new Error("P4 Solana CLI config inputs are missing");
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
chmod 600 "$P4_SOLANA_CONFIG"
trap cleanup_p4_cli_config EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

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

run_p4_ts() {
  NODE_PATH='/Users/jamesli/Developer/Sol Projects/StreamPump/node_modules' \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","esModuleInterop":true}' \
    node -r '/Users/jamesli/Developer/Sol Projects/StreamPump/node_modules/ts-node/register/transpile-only' "$@"
}
```

Expected public keys:

- fee payer: `Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9`
- upgrade authority: `BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw`
- manual Track 1 oracle (not used to sign M2): `HnGFioZidhFVUsXT1ecJSLNsmzniMGCcKA1bfuv6sUvC`

## A. Final read-only preflight

These commands do not send transactions. M2 cannot open unless all assertions pass.

```bash
set -euo pipefail
umask 077

test -n "${PILOT_TX_RPC_URL:-}"
test "$(node -e 'const u=new URL(process.env.PILOT_TX_RPC_URL); process.stdout.write(u.hostname)')" != 'api.devnet.solana.com'
test "$(safe_rpc solana genesis-hash --config "$P4_SOLANA_CONFIG")" = "$DEVNET_GENESIS"

test "$(solana-keygen pubkey "$FEE_PAYER")" = 'Aq93mJjs8Ed6VumxjQD4n3zPPf6CUvmJSqMTW14WPFf9'
test "$(solana-keygen pubkey "$UPGRADE_AUTHORITY")" = 'BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw'
test "$(safe_rpc solana balance "$(solana-keygen pubkey "$FEE_PAYER")" --config "$P4_SOLANA_CONFIG" | awk '{print $1}')" != '0'

test "$(stat -f %z "$CANDIDATE_SO")" = '1321192'
test "$(shasum -a 256 "$CANDIDATE_SO" | awk '{print $1}')" = '5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4'
test "$(stat -f %z "$CANDIDATE_PADDED_SO")" = '1328344'
test "$(shasum -a 256 "$CANDIDATE_PADDED_SO" | awk '{print $1}')" = 'a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732'
test "$(stat -f %z "$ROLLBACK_SO")" = '1328344'
test "$(shasum -a 256 "$ROLLBACK_SO" | awk '{print $1}')" = '8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247'

P4_EXPECTED_PROGRAM_SHA256='96b114bb1b130695b7a7cccc1ce9a41bf953c4acd6179120acc4a2a87e591457' \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-verify-chain-baseline.ts

safe_rpc solana program show "$PROGRAM_ID" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER" \
  --output json > "$BUNDLE_DIR/program-show-m2-pre.json"

test "$(jq -r '.programId' "$BUNDLE_DIR/program-show-m2-pre.json")" = "$PROGRAM_ID"
test "$(jq -r '.programdataAddress' "$BUNDLE_DIR/program-show-m2-pre.json")" = "$PROGRAMDATA_ID"
test "$(jq -r '.authority' "$BUNDLE_DIR/program-show-m2-pre.json")" = 'BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw'
test "$(jq -r '.dataLen' "$BUNDLE_DIR/program-show-m2-pre.json")" = '1318104'

safe_rpc solana program dump "$PROGRAM_ID" "$BUNDLE_DIR/streampump_core-m2-pre-redump.so" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER"
chmod 600 "$BUNDLE_DIR/streampump_core-m2-pre-redump.so"
test "$(shasum -a 256 "$BUNDLE_DIR/streampump_core-m2-pre-redump.so" | awk '{print $1}')" = '96b114bb1b130695b7a7cccc1ce9a41bf953c4acd6179120acc4a2a87e591457'

safe_rpc solana account "$PROTOCOL_CONFIG" --config "$P4_SOLANA_CONFIG" --keypair "$FEE_PAYER" --output json \
  > "$BUNDLE_DIR/protocol-config-m2-pre.json"
safe_rpc solana account "$TEST_USDC_MINT" --config "$P4_SOLANA_CONFIG" --keypair "$FEE_PAYER" --output json \
  > "$BUNDLE_DIR/test-usdc-m2-pre.json"
chmod 600 "$BUNDLE_DIR"/*-m2-pre.json
```

Expected result: every `test` exits zero; current program dump hash remains `96b114...`; ProgramData length remains 1,318,104; program/config/mint accounts are captured before mutation.

## B. Resume the existing candidate buffer — mutation 1

The buffer account and keypair already exist. Do **not** run `program
write-buffer` again and do not create a replacement buffer while this retained
account remains valid. The historical creation command is intentionally omitted
because Agave 2.3.0 parallelized its writes and exceeded the provider limit.

First prove that no other writer exists, then inventory through the hardened
single-threaded writer. The URL is read from the environment only; it must never
be passed as a command argument.

```bash
test "$(solana-keygen pubkey "$BUFFER_KEYPAIR")" = "$BUFFER_ADDRESS"
test -z "$(pgrep -f 'solana.*program.*write-buffer|p4-resume-buffer-write' || true)"

export P4_BUFFER_KEYPAIR="$BUFFER_KEYPAIR"
export P4_EXPECTED_BUFFER="$BUFFER_ADDRESS"
export P4_BUFFER_AUTHORITY_KEYPAIR="$UPGRADE_AUTHORITY"
export P4_FEE_PAYER_KEYPAIR="$FEE_PAYER"
export P4_PROGRAM_SO="$CANDIDATE_SO"
export P4_EXPECTED_SHA256='5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4'
export P4_ARTIFACT_ROLE=candidate
export P4_WRITE_DELAY_MS=3000

P4_DRY_RUN=true \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-resume-buffer-write.ts

# Canary: exactly one pending 900-byte chunk. Stop on any error or if the next
# dry-run inventory does not show a lower pending count.
P4_MAX_CHUNKS=1 \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-resume-buffer-write.ts

P4_DRY_RUN=true \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-resume-buffer-write.ts

# Only after the canary is finalized and its byte is visible, continue one
# operator-observed batch at a time. Re-run dry-run inventory after every batch.
P4_MAX_CHUNKS=25 \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-resume-buffer-write.ts
```

Expected result: the canary reduces the pending count, and each later finalized
batch reduces it by no more than 25 until it reaches zero. Do not close the
buffer manually; the successful upgrade instruction will drain/close it to the
fee-payer spill recipient. Every locally signed and confirmed/finalized chunk
signature is appended to the mode-`0600`
`candidate-buffer-write-signatures.jsonl` ledger in the secure bundle.

If the command times out or returns an ambiguous result, query the buffer; do not blindly re-run it.

## C. Verify buffer bytes before extension

```bash
safe_rpc solana program dump "$BUFFER_ADDRESS" "$BUNDLE_DIR/candidate-buffer-dump.so" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER"
chmod 600 "$BUNDLE_DIR/candidate-buffer-dump.so"

test "$(stat -f %z "$BUNDLE_DIR/candidate-buffer-dump.so")" = '1321192'
test "$(shasum -a 256 "$BUNDLE_DIR/candidate-buffer-dump.so" | awk '{print $1}')" = '5e881250cf64a5000ac81e66a5d90f9e25c19983280e8f8b8d6cc0ef34ac2dc4'
cmp "$CANDIDATE_SO" "$BUNDLE_DIR/candidate-buffer-dump.so"
```

Expected result: size, SHA256, and `cmp` all prove the buffer payload is byte-identical to the candidate. Any mismatch stops M2 before the irreversible extension.

## D. Extend ProgramData by exactly 10,240 bytes — revised mutation 2

This revised irreversible mutation is blocked until renewed human approval. A
read-only devnet simulation rejected 3,088 bytes with `InvalidArgument` because
the loader requires at least 10,240 additional bytes.

```bash
export P4_BUFFER_AUTHORITY_KEYPAIR="$UPGRADE_AUTHORITY"
export P4_FEE_PAYER_KEYPAIR="$FEE_PAYER"

P4_DRY_RUN=true \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-extend-program-checked.ts

P4_SIMULATE_ONLY=true \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-extend-program-checked.ts

# The helper pins Program/ProgramData, fee payer, authority, the feature account,
# current/padded hashes, and exactly 10,240 bytes. Devnet currently reports the
# checked-extend feature inactive, so it uses legacy variant 6; if the feature
# activates, it switches to variant 9 with both authority and payer signers. It
# sends one preflighted transaction and resolves ambiguity only from finalized
# state. There is no CLI or unchecked fallback outside this feature gate.
P4_EXTEND_PROGRAM=true \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-extend-program-checked.ts \
  > "$BUNDLE_DIR/program-extend-m2-result.json"
chmod 600 "$BUNDLE_DIR/program-extend-m2-result.json"
cat "$BUNDLE_DIR/program-extend-m2-result.json"

safe_rpc solana program show "$PROGRAM_ID" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER" \
  --output json > "$BUNDLE_DIR/program-show-m2-extended.json"

test "$(jq -r '.programdataAddress' "$BUNDLE_DIR/program-show-m2-extended.json")" = "$PROGRAMDATA_ID"
test "$(jq -r '.authority' "$BUNDLE_DIR/program-show-m2-extended.json")" = 'BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw'
test "$(jq -r '.dataLen' "$BUNDLE_DIR/program-show-m2-extended.json")" = '1328344'

P4_EXPECTED_PROGRAM_SHA256='8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247' \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-verify-chain-baseline.ts
```

Expected result: finalized extend transaction, exact capacity 1,328,344, unchanged ProgramData address and authority, and padded pre-upgrade hash `8f3679...`. The capacity increase cannot be rolled back.

## E. Upgrade from the verified buffer — mutation 3

```bash
safe_rpc solana program deploy \
  --config "$P4_SOLANA_CONFIG" \
  --program-id "$PROGRAM_ID" \
  --buffer "$BUFFER_KEYPAIR" \
  --upgrade-authority "$UPGRADE_AUTHORITY" \
  --fee-payer "$FEE_PAYER" \
  --keypair "$FEE_PAYER" \
  --no-auto-extend \
  --use-rpc \
  --max-sign-attempts 1 \
  --commitment finalized \
  --output json > "$BUNDLE_DIR/program-deploy-m2-result.json"
chmod 600 "$BUNDLE_DIR/program-deploy-m2-result.json"
cat "$BUNDLE_DIR/program-deploy-m2-result.json"
```

Expected result: finalized upgrade transaction for the existing Program ID. An ambiguous CLI result must be resolved by post-state reads, never by blind resend.

## F. Immediate post-upgrade verification

```bash
safe_rpc solana program show "$PROGRAM_ID" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER" \
  --output json > "$BUNDLE_DIR/program-show-m2-post.json"

test "$(jq -r '.programdataAddress' "$BUNDLE_DIR/program-show-m2-post.json")" = "$PROGRAMDATA_ID"
test "$(jq -r '.authority' "$BUNDLE_DIR/program-show-m2-post.json")" = 'BNQPL5p13QnCVUq9S8mMjgGNDHSAxLtSVctQs85Wkfiw'
test "$(jq -r '.dataLen' "$BUNDLE_DIR/program-show-m2-post.json")" = '1328344'

safe_rpc solana program dump "$PROGRAM_ID" "$BUNDLE_DIR/streampump_core-m2-post.so" \
  --config "$P4_SOLANA_CONFIG" \
  --keypair "$FEE_PAYER"
chmod 600 "$BUNDLE_DIR/streampump_core-m2-post.so"
test "$(stat -f %z "$BUNDLE_DIR/streampump_core-m2-post.so")" = '1328344'
test "$(shasum -a 256 "$BUNDLE_DIR/streampump_core-m2-post.so" | awk '{print $1}')" = 'a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732'
cmp "$CANDIDATE_PADDED_SO" "$BUNDLE_DIR/streampump_core-m2-post.so"

safe_rpc solana account "$PROTOCOL_CONFIG" --config "$P4_SOLANA_CONFIG" --keypair "$FEE_PAYER" --output json \
  > "$BUNDLE_DIR/protocol-config-m2-post.json"
safe_rpc solana account "$TEST_USDC_MINT" --config "$P4_SOLANA_CONFIG" --keypair "$FEE_PAYER" --output json \
  > "$BUNDLE_DIR/test-usdc-m2-post.json"

test "$(jq -r '.account.owner' "$BUNDLE_DIR/protocol-config-m2-post.json")" = "$PROGRAM_ID"
test "$(jq -r '.account.data[0]' "$BUNDLE_DIR/protocol-config-m2-pre.json")" = "$(jq -r '.account.data[0]' "$BUNDLE_DIR/protocol-config-m2-post.json")"
test "$(jq -r '.account.owner' "$BUNDLE_DIR/test-usdc-m2-pre.json")" = "$(jq -r '.account.owner' "$BUNDLE_DIR/test-usdc-m2-post.json")"
test "$(jq -r '.account.data[0]' "$BUNDLE_DIR/test-usdc-m2-pre.json")" = "$(jq -r '.account.data[0]' "$BUNDLE_DIR/test-usdc-m2-post.json")"

P4_EXPECTED_PROGRAM_SHA256='a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732' \
  run_p4_ts /private/tmp/streampump-p4-codex/scripts/p4-verify-chain-baseline.ts
```

Expected result: post-upgrade program bytes equal the candidate exactly; ProgramData address/authority/capacity are correct; ProtocolConfig and test-USDC account bytes are unchanged.

The 1,321,192-byte candidate buffer is valid for the larger ProgramData account:
Agave's upgrade processor copies the buffer payload and explicitly zero-fills
the remaining ProgramData capacity. The post-upgrade proof therefore compares
the full dump to `streampump_core-candidate-padded-1328344.so`, not to the
smaller source buffer.

## G. Immediate rollback

Trigger rollback on any failed post-upgrade assertion, authority/config/mint anomaly, or candidate-attributable Track1-only preflight failure. Use a new rollback buffer and the same write-buffer -> hash -> deploy -> dump/hash sequence from [the rollback bundle manifest](p4-rollback-bundle.md), with `ROLLBACK_SO` as input.

After extension, the expected restored dump is 1,328,344 bytes with SHA256:

```text
8f3679660d72daa6b6672b92abe3d6e2d76db690d13329121c3b466476c6b247
```

The ProgramData capacity remains 1,328,344 after rollback. Stop all later gates after rollback; do not continue to M3.

## Hard stop conditions

- Dedicated transaction RPC is unavailable, public, non-devnet, or inconsistent.
- Any fixed program, ProgramData, authority, ProtocolConfig, oracle, or mint value differs.
- Any backup/candidate/rollback hash differs.
- Buffer dump is not byte-identical to the candidate.
- Extend result is ambiguous or capacity is not exactly 1,328,344.
- Upgrade is not finalized; query chain state rather than resending blindly.
- Post-upgrade dump is not byte-identical to the candidate.
- ProtocolConfig or test-USDC bytes change.
- A command would require `--skip-preflight`, an implicit default signer, mainnet, real funds, or a closed Pilot lane.

Do not manually close the candidate buffer before deploy. A successful upgrade
drains/closes that loader buffer into the CLI spill recipient; retain the
pre-deploy dump/hash, buffer address/keypair, transaction signature, and rent
delta as evidence instead of claiming the live buffer survives through H4.

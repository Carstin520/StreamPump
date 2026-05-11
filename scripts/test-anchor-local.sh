#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_ID="${STREAMPUMP_PROGRAM_ID:-FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp}"
RPC_URL="${ANCHOR_PROVIDER_URL:-http://127.0.0.1:8899}"
LEDGER_DIR="${STREAMPUMP_TEST_LEDGER_DIR:-/private/tmp/streampump-test-validator-ledger}"
WALLET="${ANCHOR_WALLET:-/private/tmp/streampump-anchor-test-wallet.json}"
LOG_FILE="${STREAMPUMP_TEST_VALIDATOR_LOG:-/private/tmp/streampump-test-validator.log}"
TIMEOUT_MS="${ANCHOR_TEST_TIMEOUT_MS:-1000000}"

cd "$ROOT_DIR"

export NO_DNA="${NO_DNA:-1}"
export ANCHOR_PROVIDER_URL="$RPC_URL"
export ANCHOR_WALLET="$WALLET"

if ! command -v solana-test-validator >/dev/null 2>&1; then
  echo "solana-test-validator is required but was not found in PATH." >&2
  exit 1
fi

if [ ! -f "$WALLET" ]; then
  mkdir -p "$(dirname "$WALLET")"
  solana-keygen new --no-bip39-passphrase --force --silent -o "$WALLET" >/dev/null
fi

npm run build:anchor

if [ ! -f target/deploy/streampump_core.so ]; then
  echo "Missing target/deploy/streampump_core.so after build." >&2
  exit 1
fi

cleanup() {
  if [ -n "${VALIDATOR_PID:-}" ] && kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
    wait "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

rm -rf "$LEDGER_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

solana-test-validator \
  --reset \
  --quiet \
  --ledger "$LEDGER_DIR" \
  --bpf-program "$PROGRAM_ID" target/deploy/streampump_core.so \
  >"$LOG_FILE" 2>&1 &
VALIDATOR_PID=$!

for _ in $(seq 1 60); do
  if solana --url "$RPC_URL" cluster-version >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    echo "solana-test-validator exited before RPC became healthy." >&2
    tail -n 80 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 1
done

if ! solana --url "$RPC_URL" cluster-version >/dev/null 2>&1; then
  echo "Timed out waiting for Solana RPC at $RPC_URL." >&2
  tail -n 80 "$LOG_FILE" >&2 || true
  exit 1
fi

WALLET_ADDRESS="$(solana address -k "$WALLET")"
solana --url "$RPC_URL" airdrop 100 "$WALLET_ADDRESS" >/dev/null

if [ "$#" -eq 0 ]; then
  set -- programs/tests/s1-guards.spec.ts
fi

./node_modules/.bin/ts-mocha -p ./tsconfig.json -t "$TIMEOUT_MS" "$@"

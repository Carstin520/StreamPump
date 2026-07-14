#!/usr/bin/env sh
set -eu

# Keep Anchor/Cargo build output out of Desktop/iCloud-synced folders, where
# file-provider caching can stall rustc/cargo-build-sbf on macOS.
export NO_DNA="${NO_DNA:-1}"
export CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/private/tmp/streampump-anchor-target}"

if [ "$#" -eq 0 ]; then
  # The default IDL generation path can hang on local macOS toolchains after a
  # successful SBF compile. Keep the standard verification build focused on the
  # deployable program artifact; pass --idl/--idl-ts explicitly when regenerating IDL.
  set -- --no-idl
fi

anchor build "$@"

ARTIFACT_PATH="$CARGO_TARGET_DIR/deploy/streampump_core.so"
if [ -f "$ARTIFACT_PATH" ]; then
  mkdir -p target/deploy
  ARTIFACT_DIR="$(cd "$(dirname "$ARTIFACT_PATH")" && pwd)"
  DEPLOY_DIR="$(cd target/deploy && pwd)"
  if [ "$ARTIFACT_DIR/streampump_core.so" != "$DEPLOY_DIR/streampump_core.so" ]; then
    cp "$ARTIFACT_PATH" target/deploy/streampump_core.so
  fi
fi

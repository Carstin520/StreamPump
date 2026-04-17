#!/bin/sh
set -eu

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

MODULE_CACHE_ROOT="${TMPDIR:-/tmp}/streampump-swift-module-cache"
mkdir -p "$MODULE_CACHE_ROOT"
BIN_PATH="${TMPDIR:-/tmp}/streampump-generate-video-cover"
STDERR_PATH="${TMPDIR:-/tmp}/streampump-generate-video-cover.stderr"

export CLANG_MODULE_CACHE_PATH="$MODULE_CACHE_ROOT"
export SWIFT_MODULECACHE_PATH="$MODULE_CACHE_ROOT"

swiftc -parse-as-library scripts/generate-video-cover.swift -o "$BIN_PATH"
"$BIN_PATH" "$@" 2>"$STDERR_PATH"
STATUS=$?

if [ -f "$STDERR_PATH" ]; then
  grep -v '^sysctlbyname for kern\.hv_vmm_present failed with status -1$' "$STDERR_PATH" >&2 || true
  rm -f "$STDERR_PATH"
fi

exit "$STATUS"

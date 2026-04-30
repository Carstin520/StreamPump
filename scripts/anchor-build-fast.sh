#!/usr/bin/env sh
set -eu

# Keep Anchor/Cargo build output out of Desktop/iCloud-synced folders, where
# file-provider caching can stall rustc/cargo-build-sbf on macOS.
export NO_DNA="${NO_DNA:-1}"
export CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/private/tmp/streampump-anchor-target}"

anchor build "$@"

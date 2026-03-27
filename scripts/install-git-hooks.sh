#!/bin/sh
set -eu

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

chmod +x .githooks/pre-commit .githooks/pre-push scripts/git-hooks/secret-guard.sh
git config core.hooksPath .githooks

echo "Git hooks installed."
echo "core.hooksPath -> .githooks"

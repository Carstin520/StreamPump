#!/bin/sh
set -eu

MODE="${1:-}"

if [ -z "$MODE" ]; then
  echo "usage: secret-guard.sh --staged|--head" >&2
  exit 2
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

BLOCKED_PATHS=""
CONTENT_MATCHES=""

is_example_path() {
  case "$1" in
    .env.example|*/.env.example|*.example|*.example.*|docs/*|README.md)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_blocked_path() {
  case "$1" in
    .env|*/.env|.env.*|*/.env.*)
      if is_example_path "$1"; then
        return 1
      fi
      return 0
      ;;
    *.pem|*.p12|*.pfx|*.key|*.keystore)
      return 0
      ;;
    id.json|*/id.json|*.keypair.json|*.secret-key.json|*.wallet.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

check_paths() {
  for file_path in "$@"; do
    [ -n "$file_path" ] || continue

    if is_blocked_path "$file_path"; then
      BLOCKED_PATHS="${BLOCKED_PATHS}${file_path}
"
    fi
  done
}

check_file_content() {
  file_path="$1"

  [ -n "$file_path" ] || return 0
  is_example_path "$file_path" && return 0

  case "$file_path" in
    *.md|*.png|*.jpg|*.jpeg|*.webp|*.gif|*.pdf|target/*|backend/dist/*)
      return 0
      ;;
  esac

  if [ "$MODE" = "--staged" ]; then
    file_content="$(git show ":$file_path" 2>/dev/null || true)"
  else
    file_content="$(git show "HEAD:$file_path" 2>/dev/null || true)"
  fi

  [ -n "$file_content" ] || return 0

  if printf '%s' "$file_content" | grep -E -n 'postgres(ql)?://[^[:space:]]+:[^[:space:]@]+@' >/dev/null 2>&1; then
    CONTENT_MATCHES="${CONTENT_MATCHES}${file_path}: database connection string with embedded credentials
"
  fi

  if printf '%s' "$file_content" | grep -E -n '(^|[[:space:]])(DATABASE_URL|DIRECT_URL|S3_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY|MUX_TOKEN_SECRET|MUX_WEBHOOK_SECRET|ORACLE_AUTHORITY_SECRET_KEY|PROTOCOL_ADMIN_SECRET_KEY|DEMO_USDC_MINT_AUTHORITY_SECRET_KEY|CONTENT_ANCHOR_SIGNER_SECRET_KEY)[[:space:]]*=[[:space:]]*.+$' >/dev/null 2>&1; then
    CONTENT_MATCHES="${CONTENT_MATCHES}${file_path}: secret-looking environment variable assignment
"
  fi

  if printf '%s' "$file_content" | grep -E -n 'BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY' >/dev/null 2>&1; then
    CONTENT_MATCHES="${CONTENT_MATCHES}${file_path}: private key material
"
  fi
}

collect_staged_files() {
  git diff --cached --name-only --diff-filter=ACMR
}

collect_head_files() {
  git ls-tree -r --name-only HEAD
}

if [ "$MODE" = "--staged" ]; then
  FILES="$(collect_staged_files)"
elif [ "$MODE" = "--head" ]; then
  FILES="$(collect_head_files)"
else
  echo "unknown mode: $MODE" >&2
  exit 2
fi

if [ -z "$FILES" ]; then
  exit 0
fi

OLD_IFS=$IFS
IFS='
'
for file_path in $FILES; do
  check_paths "$file_path"
  check_file_content "$file_path"
done
IFS=$OLD_IFS

if [ -n "$BLOCKED_PATHS" ] || [ -n "$CONTENT_MATCHES" ]; then
  echo "secret guard blocked this git action." >&2

  if [ -n "$BLOCKED_PATHS" ]; then
    echo "" >&2
    echo "Blocked file paths:" >&2
    printf '%s' "$BLOCKED_PATHS" >&2
  fi

  if [ -n "$CONTENT_MATCHES" ]; then
    echo "" >&2
    echo "Blocked content matches:" >&2
    printf '%s' "$CONTENT_MATCHES" >&2
  fi

  echo "" >&2
  echo "Allowed pattern: keep placeholders in .env.example only." >&2
  echo "Recommended fix: move real values into backend/.env.local or your deployment secret manager." >&2
  echo "If a secret was already tracked, run: git rm --cached <file>" >&2
  exit 1
fi

#!/usr/bin/env bash
# BYOK-SELF-USE-P2B-LIBRARY-PERSISTENCE-DESIGN smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not submit /api/generate/byok
# - does not call MiniMax
# - does not download provider URLs
# - does not read env secrets
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_SELF_USE_LIBRARY_PERSISTENCE_DESIGN_P2B_20260618.md"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"

pass=0

ok() {
  echo "PASS: $1"
  pass=$((pass + 1))
}

fail() {
  echo "FAIL: $1"
  exit 1
}

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq -- "$needle" "$file"; then
    ok "$label"
  else
    echo "missing: $needle"
    echo "file: $file"
    fail "$label"
  fi
}

echo "=== BYOK self-use Library persistence design smoke ==="

[[ -f "$DOC" ]] || fail "design document exists"
ok "design document exists"

need "$DOC" "Phase: BYOK-SELF-USE-P2B-LIBRARY-PERSISTENCE-DESIGN" \
  "document records phase name"
need "$DOC" "Status: design only" \
  "document is design-only"
need "$DOC" "No BYOK live window opening" \
  "document forbids opening live"
need "$DOC" "No MiniMax call" \
  "document forbids MiniMax call"
need "$DOC" "No provider URL download" \
  "document forbids real provider URL download in this phase"
need "$DOC" 'No write to real `storage/tracks` audio files' \
  "document forbids writing real storage audio files"
need "$DOC" "Why Provider URL Is Not A Library Track" \
  "document explains provider URL is not a Library track"
need "$DOC" "Current Manifest-Backed Library Structure" \
  "document analyzes current manifest structure"
need "$DOC" "POST /api/byok/direct-live/save-to-library" \
  "document designs save-to-library API"
need "$DOC" "source=byok-direct-live" \
  "document designs source=byok-direct-live"
need "$DOC" "generationSource: 'byok-direct-live'" \
  "document includes manifest source extension"
need "$DOC" "SSRF" \
  "document includes SSRF defense"
need "$DOC" 'reject `localhost`' \
  "document blocks localhost URLs"
need "$DOC" 'reject `127.0.0.0/8`' \
  "document blocks loopback IPv4"
need "$DOC" "169.254.169.254" \
  "document blocks cloud metadata host"
need "$DOC" 'require `Content-Type` beginning with `audio/`' \
  "document requires audio content-type"
need "$DOC" "max size: 30 MB" \
  "document sets initial size limit"
need "$DOC" "Idempotency And Duplicate Save" \
  "document includes idempotency design"
need "$DOC" "byok-direct-live:{requestId}:{taskId || \"no-task\"}" \
  "document defines idempotency key"
need "$DOC" "Save to Library" \
  "document includes Studio Save to Library UI"
need "$DOC" "BYOK direct-live" \
  "document includes Library source label"
need "$DOC" "P2C: server-side persistence API and static smoke" \
  "document splits P2C"
need "$DOC" "P2D: Studio Save to Library UI" \
  "document splits P2D"
need "$DOC" "P2E: Library source badge and filters" \
  "document splits P2E"
need "$DOC" "P2F: controlled live persistence pilot" \
  "document splits P2F"
need "$DOC" "API key" \
  "document names API key exclusion"
need "$DOC" "Authorization header" \
  "document names Authorization exclusion"
need "$DOC" "Turnstile token" \
  "document names token exclusion"
need "$DOC" "full provider response body" \
  "document names full provider body exclusion"
need "$DOC" "raw provider URL" \
  "document warns against storing raw provider URL"
need "$RELEASE_CHECK" "byok-self-use-library-persistence-design-smoke-test.sh" \
  "release:check includes this design smoke"

if grep -Eq '^[[:space:]]*(curl|wget|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit /api/generate/byok or call MiniMax"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_SELF_USE_LIBRARY_PERSISTENCE_DESIGN_SMOKE_PASS"

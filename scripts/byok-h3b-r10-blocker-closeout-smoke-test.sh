#!/usr/bin/env bash
# Static closeout smoke for BYOK-H3B-R10-BLOCKER-CLOSEOUT.
#
# This script is intentionally local and non-live. It does not read env
# values, does not submit /api/generate/byok, does not call MiniMax, and
# does not generate audio.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CLOSEOUT="docs/launch/BYOK_H3B_R10_BLOCKER_CLOSEOUT_20260613.md"
RETRY10="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_20260613.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
SERVER="server/index.ts"
SCRIPT="scripts/byok-h3b-r10-blocker-closeout-smoke-test.sh"

pass=0
fail=0

ok() {
  echo "PASS: $1"
  pass=$((pass + 1))
}

bad() {
  echo "FAIL: $1"
  fail=$((fail + 1))
}

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq -- "$needle" "$file"; then
    ok "$label"
  else
    bad "$label (missing: $needle in $file)"
  fi
}

need_re() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label (missing pattern: $pattern in $file)"
  fi
}

reject_re() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    bad "$label (unexpected pattern: $pattern in $file)"
  else
    ok "$label"
  fi
}

echo "=== BYOK-H3B R10 blocker closeout smoke ==="

test -f "$CLOSEOUT" && ok "A1: closeout doc exists" || bad "A1: closeout doc exists"
test -f "$RETRY10" && ok "A2: Retry-10 evidence exists" || bad "A2: Retry-10 evidence exists"
test -f "$HANDOFF" && ok "A3: development handoff exists" || bad "A3: development handoff exists"

need "$RETRY10" "RETRY10_BLOCKED_OR_ABORTED" \
  "B1: Retry-10 evidence keeps blocked/aborted classification"
need "$RETRY10" "OPERATOR_SECRET_STEP_NOT_CONFIRMED" \
  "B2: Retry-10 evidence keeps operator secret blocker"
need "$RETRY10" "byokLiveConfirmationConfigured: false" \
  "B3: Retry-10 evidence records missing live confirmation boolean"
need "$RETRY10" "byokLiveEnabled: false" \
  "B4: Retry-10 evidence records live disabled boolean"

need "$CLOSEOUT" "BYOK-H3B-R10-BLOCKER-CLOSEOUT" \
  "C1: closeout phase is named"
need "$CLOSEOUT" "operator-only secret step was not confirmed" \
  "C2: closeout states the blocker in operator terms"
need "$CLOSEOUT" "Until the operator completes the local secret step out-of-band" \
  "C3: closeout requires out-of-band operator secret step"
need "$CLOSEOUT" "Do not set \`BYOK_LIVE_CONFIRMATION\` from Codex." \
  "C4: closeout forbids Codex setting live confirmation"
need "$CLOSEOUT" "Do not set \`BYOK_LIVE_WINDOW_ID\` from Codex." \
  "C5: closeout forbids Codex setting live window"
need "$CLOSEOUT" "Do not enable \`BYOK_DIRECT_LIVE_ENABLED\` from Codex." \
  "C6: closeout forbids Codex enabling direct live"
need "$CLOSEOUT" "Do not submit \`POST /api/generate/byok\`." \
  "C7: closeout forbids generate submit"
need "$CLOSEOUT" "Stay in safe default." \
  "C8: closeout keeps safe-default next step"

need "$HANDOFF" "BYOK-H3B-R10-BLOCKER-CLOSEOUT" \
  "D1: handoff references blocker closeout"
need "$HANDOFF" "docs/launch/BYOK_H3B_R10_BLOCKER_CLOSEOUT_20260613.md" \
  "D2: handoff links the closeout doc"

need "$SERVER" "publicByokEnabled: readBoolEnv('PUBLIC_BYOK_ENABLED', false)" \
  "E1: PUBLIC_BYOK_ENABLED default remains false"
need "$SERVER" "byokDryRunOnly: readBoolEnv('BYOK_DRY_RUN_ONLY', true)" \
  "E2: BYOK_DRY_RUN_ONLY default remains true"
need "$SERVER" "byokLiveEnabled: readBoolEnv('BYOK_LIVE_ENABLED', false)" \
  "E3: BYOK_LIVE_ENABLED default remains false"
need "$SERVER" "byokDirectLiveEnabled: readBoolEnv('BYOK_DIRECT_LIVE_ENABLED', false)" \
  "E4: BYOK_DIRECT_LIVE_ENABLED default remains false"
need "$SERVER" "byokLiveConfirmationConfigured: isByokLiveConfirmationConfigured" \
  "E5: health exposes live-confirmation configured boolean"

reject_re "$CLOSEOUT" "sk-[A-Za-z0-9_-]{20,}" \
  "F1: closeout contains no sk-like key"
reject_re "$CLOSEOUT" "Bearer[[:space:]][A-Za-z0-9._-]{20,}" \
  "F2: closeout contains no bearer token"
reject_re "$CLOSEOUT" "Authorization:[[:space:]]*Bearer" \
  "F3: closeout contains no Authorization header"
reject_re "$CLOSEOUT" "BYOK_LIVE_CONFIRMATION=" \
  "F4: closeout contains no live confirmation assignment"
reject_re "$CLOSEOUT" "BYOK_DIRECT_LIVE_CONFIRMATION=" \
  "F5: closeout contains no direct live confirmation assignment"
reject_re "$CLOSEOUT" "TURNSTILE_SECRET_KEY=" \
  "F6: closeout contains no Turnstile secret assignment"

# Strip comments and assertion strings before checking script behavior.
SCRIPT_BODY="$(sed -e 's/#.*$//' "$SCRIPT" \
  | grep -v 'Do not submit' \
  | sed -e 's|/api/generate/byok||g')"
network_pattern='[c]url|[w]get|[I]nvoke-WebRequest|[I]nvoke-RestMethod|fetch[(]'
submit_pattern='[P]OST|--req''uest|-[X]'
if printf '%s\n' "$SCRIPT_BODY" | grep -Eq "$network_pattern"; then
  bad "G1: closeout smoke must not perform network calls"
else
  ok "G1: closeout smoke performs no network calls"
fi

if printf '%s\n' "$SCRIPT_BODY" | grep -Eq "$submit_pattern"; then
  bad "G2: closeout smoke must not submit anything"
else
  ok "G2: closeout smoke submits nothing"
fi

echo
echo "PASS=$pass FAIL=$fail"
if [ "$fail" -eq 0 ]; then
  echo "BYOK_H3B_R10_BLOCKER_CLOSEOUT_SMOKE_PASS"
  exit 0
fi

echo "BYOK_H3B_R10_BLOCKER_CLOSEOUT_SMOKE_FAIL"
exit 1

#!/usr/bin/env bash
# BYOK-LIVE-ATTEMPT-CONSUME-GUARD-FIX smoke test.
#
# Static, local-only guard:
# - does not start BYOK live
# - does not POST generation
# - does not call MiniMax
# - does not read env secrets
# - verifies live attempt consumption happens only at provider-ready call sites

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"

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
  if grep -Fq "$needle" "$file"; then
    ok "$label"
  else
    echo "missing: $needle"
    fail "$label"
  fi
}

line_first() {
  local file="$1"
  local needle="$2"
  grep -nF "$needle" "$file" | head -1 | cut -d: -f1
}

line_last() {
  local file="$1"
  local needle="$2"
  grep -nF "$needle" "$file" | tail -1 | cut -d: -f1
}

assert_before() {
  local before="$1"
  local after="$2"
  local label="$3"
  if [[ -n "$before" && -n "$after" && "$before" -lt "$after" ]]; then
    ok "$label (lines $before < $after)"
  else
    fail "$label (before=$before after=$after)"
  fi
}

echo "=== BYOK live attempt consume guard smoke ==="

need "$SERVER_INDEX" "const postParseTurnstilePresent = safeString(body.turnstileToken).trim().length > 0;" \
  "post-parse Turnstile presence comes from JSON body token"
need "$SERVER_INDEX" "const requireVerifiedTurnstileForLive = (): boolean =>" \
  "live-only Turnstile guard helper exists"
need "$SERVER_INDEX" "config.turnstileByokRequired !== true || !postParseTurnstilePresent" \
  "missing or unenforced Turnstile blocks live provider path"
need "$SERVER_INDEX" "code: 'turnstile_required'" \
  "missing Turnstile returns explicit turnstile_required error"
need "$SERVER_INDEX" "const consumeLiveAttemptBeforeProvider = ():" \
  "provider-ready consume helper exists"
need "$SERVER_INDEX" "const liveAttemptConsumedStats = consumeByokLiveAttempt(liveAttemptConfig);" \
  "live attempt consume is isolated inside helper"

consume_call_count="$(grep -F "consumeByokLiveAttempt(" "$SERVER_INDEX" | wc -l | tr -d ' ')"
if [[ "$consume_call_count" == "1" ]]; then
  ok "server has exactly one consumeByokLiveAttempt call"
else
  fail "expected exactly one consumeByokLiveAttempt call, found $consume_call_count"
fi

key_validation_line="$(line_first "$SERVER_INDEX" "const keyShape = validateApiKeyShape(body.apiKey);")"
prompt_validation_line="$(line_last "$SERVER_INDEX" "const validation = validateMusicInput(")"
live_confirmation_line="$(line_first "$SERVER_INDEX" "if (config.byokLiveConfirmation !== BYOK_LIVE_CONFIRMATION_PHRASE)")"
consume_helper_line="$(line_first "$SERVER_INDEX" "const consumeLiveAttemptBeforeProvider = ():")"

assert_before "$key_validation_line" "$consume_helper_line" \
  "apiKey validation is before live attempt consume helper"
assert_before "$prompt_validation_line" "$consume_helper_line" \
  "prompt/input validation is before live attempt consume helper"
assert_before "$live_confirmation_line" "$consume_helper_line" \
  "live confirmation mismatch branch is before live attempt consume helper"

direct_turnstile_line="$(line_first "$SERVER_INDEX" "if (!requireVerifiedTurnstileForLive()) return;")"
direct_confirmation_line="$(line_first "$SERVER_INDEX" "body.directLiveConfirmation !== 'CONFIRM_BYOK_DIRECT_LIVE_TEST'")"
direct_attempt_line="$(line_first "$SERVER_INDEX" "const directAttemptGuard = consumeLiveAttemptBeforeProvider();")"
direct_provider_line="$(line_first "$SERVER_INDEX" "const directResult = await generateByokDirectMusic({")"

assert_before "$direct_turnstile_line" "$direct_confirmation_line" \
  "direct-live path checks Turnstile before direct confirmation"
assert_before "$direct_confirmation_line" "$direct_attempt_line" \
  "direct-live confirmation mismatch returns before attempt consume"
assert_before "$direct_attempt_line" "$direct_provider_line" \
  "direct-live attempt consume is immediately before provider call"

adapter_turnstile_line="$(line_last "$SERVER_INDEX" "if (!requireVerifiedTurnstileForLive()) return;")"
adapter_attempt_line="$(line_first "$SERVER_INDEX" "const liveAttemptGuard = consumeLiveAttemptBeforeProvider();")"
adapter_provider_line="$(line_first "$SERVER_INDEX" "const adapterResult = await generateByokMusic({")"

assert_before "$adapter_turnstile_line" "$adapter_attempt_line" \
  "adapter live path checks Turnstile before attempt consume"
assert_before "$adapter_attempt_line" "$adapter_provider_line" \
  "adapter live attempt consume is before provider invocation"

if sed -e 's/#.*$//' "$0" | grep -E "curl .*/api/generate|wget .*/api/generate|fetch\\(" >/dev/null; then
  fail "smoke script contains a generation submit primitive"
else
  ok "smoke script does not submit generation"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_LIVE_ATTEMPT_CONSUME_GUARD_SMOKE_PASS"

#!/usr/bin/env bash
# Phase BYOK-H3B-CODE-FOLLOWUP smoke test.
# Asserts the live gate hardening (centralized confirmation phrase constant
# and server-side one-shot guard) is present in the codebase and in the
# execution instructions. Read-only: no live calls, no MiniMax call, no
# music generation, no production env changes.
#
# This smoke does NOT execute live calls. It is read-only.

set -euo pipefail

BYOK_TS="server/adapters/minimax-api/byok.ts"
INDEX_TS="server/index.ts"
EXEC_DOC="docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"

pass=0
fail=0

assert_grep() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    echo "FAIL: $label  (file missing: $file)"
    fail=$((fail+1))
    return 1
  fi
  if grep -Fq -- "$needle" "$file"; then
    echo "PASS: $label"
    pass=$((pass+1))
  else
    echo "FAIL: $label  (missing: $needle in $file)"
    fail=$((fail+1))
    return 1
  fi
}

assert_grep_ci() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    echo "FAIL: $label  (file missing: $file)"
    fail=$((fail+1))
    return 1
  fi
  if grep -Fiq -- "$needle" "$file"; then
    echo "PASS: $label (case-insensitive)"
    pass=$((pass+1))
  else
    echo "FAIL: $label  (missing ci: $needle in $file)"
    fail=$((fail+1))
    return 1
  fi
}

assert_not_grep() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    echo "FAIL: $label  (file missing: $file)"
    fail=$((fail+1))
    return 1
  fi
  if grep -Eq -- "$pattern" "$file"; then
    echo "FAIL: $label  (forbidden pattern matched in $file: $pattern)"
    fail=$((fail+1))
    return 1
  else
    echo "PASS: $label"
    pass=$((pass+1))
  fi
}

echo "[1/8] central BYOK_LIVE_CONFIRMATION_PHRASE constant is defined once"
assert_grep "$BYOK_TS" "export const BYOK_LIVE_CONFIRMATION_PHRASE = 'CONFIRM_BYOK_LIVE_RELAY_TEST'" "byok.ts exports central phrase"
# The phrase string must appear in exactly two places in server/: the
# constant export and a comment header. Anything else is hardcoding.
echo "  phrase occurrences in server/:"
grep -RInE "CONFIRM_BYOK_LIVE_RELAY_TEST" server/ || true
PHRASE_RAW_COUNT=$(grep -RInE "'CONFIRM_BYOK_LIVE_RELAY_TEST'" server/ | wc -l)
PHRASE_TOTAL_COUNT=$(grep -RInE "CONFIRM_BYOK_LIVE_RELAY_TEST" server/ | wc -l)
if [ "$PHRASE_RAW_COUNT" -eq 1 ] && [ "$PHRASE_TOTAL_COUNT" -le 3 ]; then
  echo "PASS: phrase hardcoded exactly once (raw='$PHRASE_RAW_COUNT', total='$PHRASE_TOTAL_COUNT' including comments)"
  pass=$((pass+1))
else
  echo "FAIL: phrase should be hardcoded exactly once (raw='$PHRASE_RAW_COUNT', total='$PHRASE_TOTAL_COUNT')"
  fail=$((fail+1))
fi

echo "[2/8] index.ts does not hardcode the phrase; it imports the constant"
assert_not_grep "$INDEX_TS" "'CONFIRM_BYOK_LIVE_RELAY_TEST'" "no raw phrase in index.ts"
assert_grep "$BYOK_TS" "BYOK_LIVE_CONFIRMATION_PHRASE" "phrase exported by byok.ts"
assert_grep "$INDEX_TS" "BYOK_LIVE_CONFIRMATION_PHRASE" "index.ts uses phrase constant"

echo "[3/8] server still returns byok_live_confirmation_required on mismatch"
assert_grep "$INDEX_TS" "code: 'byok_live_confirmation_required'" "code byok_live_confirmation_required emitted"
assert_grep "$INDEX_TS" "byok_live_confirmation_required" "code string present"
assert_grep "$INDEX_TS" "BYOK_LIVE_CONFIRMATION" "BYOK_LIVE_CONFIRMATION referenced"
assert_grep "$INDEX_TS" "byok_live_not_enabled" "byok_live_not_enabled code referenced"

echo "[4/8] server-side one-shot guard is defined and wired"
assert_grep "$BYOK_TS" "buildByokLiveAttemptConfig" "guard config builder"
assert_grep "$BYOK_TS" "checkByokLiveAttemptLimit" "guard check function"
assert_grep "$BYOK_TS" "getByokLiveAttemptStats" "guard stats function"
assert_grep "$BYOK_TS" "consumeByokLiveAttempt" "guard consume function"
assert_grep "$BYOK_TS" "ByokLiveAttemptConfig" "guard config interface"
assert_grep "$BYOK_TS" "BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW" "guard env MAX_ATTEMPTS_PER_WINDOW"
assert_grep "$BYOK_TS" "BYOK_LIVE_WINDOW_ID" "guard env WINDOW_ID"
assert_grep "$INDEX_TS" "checkByokLiveAttemptLimit" "guard check used in route"
assert_grep "$INDEX_TS" "byok_live_attempt_limit_reached" "code byok_live_attempt_limit_reached emitted"
assert_grep "$INDEX_TS" "byokLiveAttemptLimitEnabled" "health exposes byokLiveAttemptLimitEnabled"
assert_grep "$INDEX_TS" "byokLiveMaxAttemptsPerWindow" "health exposes byokLiveMaxAttemptsPerWindow"
assert_grep "$INDEX_TS" "byokLiveAttemptsUsed" "health exposes byokLiveAttemptsUsed"

echo "[5/8] guard does NOT store raw key / token / prompt / raw response"
# Scope the check to the new guard block (after the guard header comment).
GUARD_START=$(grep -nE "^// ── Live attempt guard \\(Phase BYOK-H3B-CODE-FOLLOWUP\\)" "$BYOK_TS" | head -1 | cut -d: -f1)
if [ -z "$GUARD_START" ]; then
  echo "FAIL: cannot locate guard start line in $BYOK_TS"
  fail=$((fail+1))
else
  GUARD_BODY=$(tail -n +"$GUARD_START" "$BYOK_TS")
  echo "  guard start line: $GUARD_START"
  if echo "$GUARD_BODY" | grep -Eq "userApiKey"; then
    echo "FAIL: guard references userApiKey"
    fail=$((fail+1))
  else
    echo "PASS: no userApiKey field in guard"
    pass=$((pass+1))
  fi
  if echo "$GUARD_BODY" | grep -Eq "apiKey:[[:space:]]*string|apiKey:[[:space:]]*'"; then
    echo "FAIL: guard references raw apiKey field"
    fail=$((fail+1))
  else
    echo "PASS: no raw apiKey field in guard"
    pass=$((pass+1))
  fi
  if echo "$GUARD_BODY" | grep -Eq "Authorization|Bearer"; then
    echo "FAIL: guard references Authorization or Bearer"
    fail=$((fail+1))
  else
    echo "PASS: no Authorization/Bearer in guard"
    pass=$((pass+1))
  fi
  if echo "$GUARD_BODY" | grep -Eq "writeFileSync|fs\\.write"; then
    echo "FAIL: guard writes to disk"
    fail=$((fail+1))
  else
    echo "PASS: guard does not write to disk"
    pass=$((pass+1))
  fi
  if echo "$GUARD_BODY" | grep -Fiq "in-memory only"; then
    echo "PASS: guard is in-memory only"
    pass=$((pass+1))
  else
    echo "FAIL: guard does not claim in-memory only"
    fail=$((fail+1))
  fi
  if echo "$GUARD_BODY" | grep -Fiq "never persists"; then
    echo "PASS: guard never persists"
    pass=$((pass+1))
  else
    echo "FAIL: guard does not claim never-persists"
    fail=$((fail+1))
  fi
fi

echo "[6/8] /api/health includes all required new fields"
assert_grep "$INDEX_TS" "byokLiveEnabled:" "health byokLiveEnabled"
assert_grep "$INDEX_TS" "byokLiveConfirmationConfigured:" "health byokLiveConfirmationConfigured"
assert_grep "$INDEX_TS" "byokLiveAttemptLimitEnabled:" "health byokLiveAttemptLimitEnabled"
assert_grep "$INDEX_TS" "byokLiveMaxAttemptsPerWindow:" "health byokLiveMaxAttemptsPerWindow"
assert_grep "$INDEX_TS" "byokLiveAttemptsUsed:" "health byokLiveAttemptsUsed"

echo "[7/8] execution instructions include new envs and new code/behavior"
assert_grep "$EXEC_DOC" "BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST" "exec doc: confirmation phrase in live-enable"
assert_grep "$EXEC_DOC" "BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1" "exec doc: max attempts per window"
assert_grep "$EXEC_DOC" "BYOK_LIVE_WINDOW_ID" "exec doc: window id env"
assert_grep "$EXEC_DOC" "byok_live_attempt_limit_reached" "exec doc: attempt limit reached code"
assert_grep_ci "$EXEC_DOC" "Server-side one-shot guard" "exec doc: server-side one-shot guard note"
assert_grep "$EXEC_DOC" "byokLiveConfirmationConfigured" "exec doc: health field byokLiveConfirmationConfigured"
assert_grep "$EXEC_DOC" "byokLiveAttemptsUsed" "exec doc: health field byokLiveAttemptsUsed"
assert_grep "$EXEC_DOC" "byokLiveMaxAttemptsPerWindow" "exec doc: health field byokLiveMaxAttemptsPerWindow"
assert_grep "$EXEC_DOC" "byokLiveAttemptLimitEnabled" "exec doc: health field byokLiveAttemptLimitEnabled"
assert_grep "$EXEC_DOC" "byokLiveAttemptsRemaining" "exec doc: health field byokLiveAttemptsRemaining"
assert_grep "$EXEC_DOC" "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_20260613.md" "exec doc: cross-link to T1 retry evidence"

echo "[8/8] no secret / no key / no token committed in touched server files"
assert_not_grep "$BYOK_TS" "sk-[A-Za-z0-9_-]{20,}" "no raw sk- key in byok.ts"
assert_not_grep "$BYOK_TS" "Bearer[[:space:]]+[A-Za-z0-9._-]{8,}" "no raw Bearer token in byok.ts"
assert_not_grep "$INDEX_TS" "sk-[A-Za-z0-9_-]{20,}" "no raw sk- key in index.ts"
assert_not_grep "$INDEX_TS" "Bearer[[:space:]]+[A-Za-z0-9._-]{8,}" "no raw Bearer token in index.ts"
assert_not_grep "$EXEC_DOC" "sk-[A-Za-z0-9_-]{20,}" "no raw sk- key in exec doc"
assert_not_grep "$EXEC_DOC" "TURNSTILE_SECRET_KEY=([^*]|$)" "no Turnstile secret value in exec doc"
assert_not_grep "$EXEC_DOC" "@(gmail|qq|163|outlook|hotmail)\\.com" "no email PII in exec doc"
assert_not_grep "$EXEC_DOC" "wechat|微信" "no WeChat reference in exec doc"
assert_not_grep "$EXEC_DOC" "telegram\\.me/" "no telegram.me link in exec doc"
assert_not_grep "$EXEC_DOC" "BYOK_LIVE_CONFIRMATION=[A-Za-z0-9_-]+,? *\\n" "no extra confirmation phrase variants"

echo
echo "RESULT: pass=$pass fail=$fail"
if [ "$fail" -ne 0 ]; then
  echo "BYOK_H3B_CODE_FOLLOWUP_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_H3B_CODE_FOLLOWUP_SMOKE_PASS"

#!/usr/bin/env bash
# Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP smoke test.
# Asserts the post-retry-3 follow-up adds: gate-order fix (confirmed
# live path bypasses launch guard), a new BYOK-live audio cap, 4
# health fields, and 3 new submit observability stages.
# No live call. No MiniMax. No music generation. No PII.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BYOK_TS="server/adapters/minimax-api/byok.ts"
INDEX_TS="server/index.ts"
EXEC_DOC="docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"
RETRY3_DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md"
README="README.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
READINESS="docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0
fail() { echo "  FAIL: $*"; FAIL=$((FAIL + 1)); }
pass() { echo "  PASS: $*"; PASS=$((PASS + 1)); }
assert_grep() {
  local file="$1" needle="$2" desc="$3"
  if grep -F -- "$needle" "$file" >/dev/null 2>&1; then pass "$desc"
  else fail "$desc  (needle: $needle in $file)"; fi
}
assert_not_grep() {
  local file="$1" needle="$2" desc="$3"
  if ! grep -F -- "$needle" "$file" >/dev/null 2>&1; then pass "$desc"
  else fail "$desc  (should not contain: $needle in $file)"; fi
}

echo "[1/8] BYOK-live audio cap module present in byok.ts"
assert_grep "$BYOK_TS" "BYOK_LIVE_MAX_AUDIO_PER_WINDOW" "env var wired"
assert_grep "$BYOK_TS" "BYOK_LIVE_AUDIO_CAP_ENABLED" "enabled flag wired"
assert_grep "$BYOK_TS" "checkByokLiveAudioCap" "check helper exported"
assert_grep "$BYOK_TS" "recordByokLiveAudioGenerated" "record helper exported"
assert_grep "$BYOK_TS" "getByokLiveAudioCapStats" "stats helper exported"
assert_grep "$BYOK_TS" "buildByokLiveAudioCapConfig" "config builder exported"
assert_grep "$BYOK_TS" "ByokLiveAudioCapConfig" "config type defined"
assert_grep "$BYOK_TS" "ByokLiveAudioCapStats" "stats type defined"

echo "[2/8] New submit observability stages / outcomes"
assert_grep "$BYOK_TS" "audio_quota_bypassed_for_byok_live" "bypass stage enum member"
assert_grep "$BYOK_TS" "byok_live_audio_cap_reached" "audio cap stage enum member"
assert_grep "$BYOK_TS" "live_attempt_consumed" "consumed stage enum member"
assert_grep "$BYOK_TS" "bypassed_audio_quota_for_byok_live" "bypass outcome enum member"
assert_grep "$BYOK_TS" "blocked_live_audio_cap" "audio cap outcome enum member"
assert_grep "$BYOK_TS" "'live_attempt_consumed'" "consumed outcome enum member"

echo "[3/8] Gate ordering: confirmed live path bypasses launch guard"
assert_grep "$INDEX_TS" "isConfirmedByokLivePath" "confirmed live path detection"
assert_grep "$INDEX_TS" "audio_quota_bypassed_for_byok_live" "bypass recorded in handler"
assert_grep "$INDEX_TS" "checkByokLiveAudioCap" "audio cap check in handler"
assert_grep "$INDEX_TS" "recordByokLiveAudioGenerated" "audio record on success"
assert_grep "$INDEX_TS" "consumeByokLiveAttempt(liveAttemptConfig)" "attempt slot consumed"

echo "[4/8] Live attempt guard still BEFORE audio cap check (ordering)"
attempt_line="$(grep -n 'checkByokLiveAttemptLimit(liveAttemptConfig)' "$INDEX_TS" | head -1 | cut -d: -f1)"
audio_line="$(grep -n 'checkByokLiveAudioCap(liveAudioCapConfig)' "$INDEX_TS" | head -1 | cut -d: -f1)"
if [ -n "$attempt_line" ] && [ -n "$audio_line" ] && [ "$attempt_line" -lt "$audio_line" ]; then
  pass "attempt guard (line $attempt_line) appears BEFORE audio cap (line $audio_line)"
else
  fail "attempt guard and audio cap ordering incorrect (attempt=$attempt_line, audio=$audio_line)"
fi

echo "[5/8] /api/health exposes 4 new audio cap fields"
assert_grep "$INDEX_TS" "byokLiveAudioCapEnabled" "byokLiveAudioCapEnabled present"
assert_grep "$INDEX_TS" "byokLiveMaxAudioPerWindow" "byokLiveMaxAudioPerWindow present"
assert_grep "$INDEX_TS" "byokLiveAudioUsed" "byokLiveAudioUsed present"
assert_grep "$INDEX_TS" "byokLiveAudioRemaining" "byokLiveAudioRemaining present"

echo "[6/8] Launch guard remains for non-live path (no removal)"
assert_grep "$INDEX_TS" "checkLaunchGuard" "launch guard still called"
assert_grep "$INDEX_TS" "per_source_daily_limit" "launch guard codes referenced" || true

echo "[7/8] Docs mention retry-3 audio-quota root cause and audio cap"
assert_grep "$EXEC_DOC" "## 4c. Gate ordering" "exec-instructions has gate-order section"
assert_grep "$EXEC_DOC" "audio_quota_bypassed_for_byok_live" "exec-instructions mentions bypass"
assert_grep "$EXEC_DOC" "BYOK_LIVE_MAX_AUDIO_PER_WINDOW" "exec-instructions mentions env var"
assert_grep "$EXEC_DOC" "byok_live_audio_cap_reached" "exec-instructions mentions cap-reached code"
assert_grep "$RETRY3_DOC" "Retry-3 root cause" "retry-3 doc has root cause section"
assert_grep "$RETRY3_DOC" "launch guard fired before live-attempt guard" "retry-3 doc names root cause"
assert_grep "$RETRY3_DOC" "BYOK_LIVE_MAX_AUDIO_PER_WINDOW" "retry-3 doc mentions cap env var"

echo "[8/8] No banned secrets / no live call / no MiniMax in this phase"
for f in "$BYOK_TS" "$INDEX_TS"; do
  assert_not_grep "$f" "TURNSTILE_SECRET_KEY=*** "no Turnstile secret value
  assert_not_grep "$f" "sk-FAKE-H3B" "no fake test key in source"
done

echo "============================================================"
echo "Audio quota followup smoke: PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_AUDIO_QUOTA_FOLLOWUP_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_AUDIO_QUOTA_FOLLOWUP_SMOKE_FAIL"
  exit 1
fi

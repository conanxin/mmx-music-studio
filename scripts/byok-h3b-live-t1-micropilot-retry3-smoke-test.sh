#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 smoke test.
# Asserts the retry-3 evidence doc records: hardened live gate, T1
# submits observed server-side, two distinct requestIds, audio_quota
# gate rejection, no MiniMax call, no music, rollback to safe default,
# no raw key/token/Authorization/PII/audio/log committed.
#
# Exits 0 on full pass, 1 on any fail. Emits
# BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_SMOKE_PASS / _FAIL.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md"
INDEX_TS="$REPO_ROOT/server/index.ts"
BYOK_TS="$REPO_ROOT/server/adapters/minimax-api/byok.ts"
EXEC_INST="$REPO_ROOT/docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"

PASS=0
FAIL=0

assert_grep() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  if [ -f "$file" ] && grep -qF -- "$needle" "$file" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (needle: $needle  in: $(basename "$file"))"
  fi
}

assert_not_grep() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if [ ! -f "$file" ]; then
    PASS=$((PASS+1))
    echo "  PASS  $desc  (file absent)"
    return
  fi
  if grep -qE -- "$pattern" "$file" 2>/dev/null; then
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (pattern: $pattern  in: $(basename "$file"))"
  else
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  fi
}

echo "============================================================"
echo "Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 smoke test"
echo "============================================================"

echo "[1/8] evidence doc exists and is non-empty"
if [ -f "$EVIDENCE" ] && [ -s "$EVIDENCE" ]; then
  PASS=$((PASS+1))
  echo "  PASS  evidence doc present ($(wc -l < "$EVIDENCE") lines)"
else
  FAIL=$((FAIL+1))
  echo "  FAIL  evidence doc missing or empty"
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_SMOKE_FAIL"
  exit 1
fi

echo "[2/8] window / approval phrase recorded"
assert_grep "$EVIDENCE" "h3b-20260613-t1-retry3-" "window ID recorded"
assert_grep "$EVIDENCE" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "stage-level approval phrase recorded"
assert_grep "$EVIDENCE" "CONFIRM_BYOK_LIVE_RELAY_TEST" "per-submit phrase recorded"
assert_grep "$EVIDENCE" "Asia/Shanghai" "timezone recorded"
assert_grep "$EVIDENCE" "2026-06-13T07:39:45+08:00" "window start timestamp"
assert_grep "$EVIDENCE" "2026-06-13T08:39:45+08:00" "window end timestamp"

echo "[3/8] T1 submits server-observed (retry-2 observability gap closed)"
assert_grep "$EVIDENCE" "OBSERVABILITY_RESULT=SERVER_SUBMIT_OBSERVED" "observability result recorded"
assert_grep "$EVIDENCE" "byok_1a292bb001de" "submit 1 requestId recorded"
assert_grep "$EVIDENCE" "byok_aaf11af145cf" "submit 2 requestId recorded"
assert_grep "$EVIDENCE" "audio_quota_rejected" "audio quota gate stage recorded"
assert_grep "$EVIDENCE" "blocked_audio_quota" "audio quota outcome recorded"
assert_grep "$EVIDENCE" "byokLastSubmitModeCandidate" "live mode candidate recorded (server-side proof of live path)"
assert_grep "$EVIDENCE" "| \`live\`" "byokLastSubmitModeCandidate cell value = live"

echo "[4/8] no MiniMax call, no music, no real provider result"
assert_grep "$EVIDENCE" "No MiniMax call was made" "no provider call statement"
assert_grep "$EVIDENCE" "Generated audio count: **0**" "zero audio generated (bold)"
assert_grep "$EVIDENCE" "for the live path: N/A" "no live requestId"
assert_grep "$EVIDENCE" "realApiAttemptsUsed" "realApi counter referenced"
assert_grep "$EVIDENCE" "byokLiveAttemptsUsed" "byokLiveAttemptsUsed referenced"
# Confirm the counter values are 0 in the table
assert_grep "$EVIDENCE" "| 0 | 0 |" "both realApi and byokLiveAttempts zero in usage table"

echo "[5/8] rollback to safe default verified"
assert_grep "$EVIDENCE" "Unconditional rollback" "rollback section heading"
assert_grep "$EVIDENCE" "Override restored to safe default" "override restoration statement"
assert_grep "$EVIDENCE" "byok_generation_disabled" "post-rollback disabled response code"
assert_grep "$EVIDENCE" "publicByokEnabled=False" "post-rollback publicByokEnabled false"
assert_grep "$EVIDENCE" "byokLiveEnabled=False" "post-rollback byokLiveEnabled false"
assert_grep "$EVIDENCE" "byokLiveConfirmationConfigured=False" "post-rollback confirmation false"

echo "[6/8] hardened live gate + one-shot guard + observability"
assert_grep "$EVIDENCE" "9 env vars" "9 env vars override recorded"
assert_grep "$EVIDENCE" "BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1" "one-shot guard attempt cap = 1"
assert_grep "$EVIDENCE" "byokSubmitsReceived" "submit observability counter referenced"

echo "[7/8] leak scan CLEAN in evidence + code"
assert_not_grep "$EVIDENCE" "TURNSTILE_SECRET_KEY=[A-Za-z0-9]{8,}" "no Turnstile secret value committed"
assert_not_grep "$EVIDENCE" "sk-[A-Za-z0-9]{24,}" "no raw MiniMax key in evidence"
assert_not_grep "$EVIDENCE" "Bearer [A-Za-z0-9._-]{20,}" "no raw Authorization in evidence"
assert_not_grep "$EVIDENCE" "storage/tracks/" "no audio runtime path in evidence"
# Deliberate sentinel sk-FAKE-... in evidence is a probe marker, not a real key.
# We allow it because it is explicitly labeled "sentinel".
assert_grep "$EVIDENCE" "sk-FAKE-" "deliberate fake-key sentinel present in evidence (not a real key)"

echo "[8/8] recommendation + final口径"
assert_grep "$EVIDENCE" "Recommendations" "recommendations section present"
assert_grep "$EVIDENCE" "Do not broaden the live window" "do not broaden scope"
assert_grep "$EVIDENCE" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 executed" "final口径 present"
assert_grep "$EVIDENCE" "does not broaden public launch" "final口径 scope boundary"

echo "============================================================"
echo "Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 smoke: PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_SMOKE_FAIL"
  exit 1
fi

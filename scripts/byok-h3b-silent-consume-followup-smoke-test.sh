#!/usr/bin/env bash
# Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP smoke test.
# Asserts the submit-trace ring buffer, silent-consume guard, terminal-stage
# set, the new health trace fields, and that no raw key/token/prompt/provider
# response can leak through the new telemetry path.
#
# Output: BYOK_H3B_SILENT_CONSUME_FOLLOWUP_SMOKE_PASS

set -u
PASS=0
FAIL=0

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BYOK_TS="$REPO_ROOT/server/adapters/minimax-api/byok.ts"
INDEX_TS="$REPO_ROOT/server/index.ts"
RETRY7_DOC="$REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md"
EXEC_INST="$REPO_ROOT/docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"
README="$REPO_ROOT/README.md"
HANDOFF="$REPO_ROOT/docs/DEVELOPMENT_HANDOFF.md"
READINESS="$REPO_ROOT/docs/PUBLIC_RELEASE_READINESS.md"

assert_grep() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  if [ -f "$file" ] && grep -qF -- "$needle" "$file" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (needle: $needle)"
  fi
}

assert_grep_e() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  if [ -f "$file" ] && grep -qE -- "$needle" "$file" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (regex: $needle)"
  fi
}

assert_not_grep() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  if [ -f "$file" ] && grep -qF -- "$needle" "$file" 2>/dev/null; then
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (unexpected: $needle)"
  else
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  fi
}

assert_not_grep_e() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  if [ -f "$file" ] && grep -qE -- "$needle" "$file" 2>/dev/null; then
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (unexpected: $needle)"
  else
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  fi
}

echo "=== Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP smoke test ==="

# --- byok.ts: ring buffer + accessors + guard ---
assert_grep_e "$BYOK_TS" "interface[[:space:]]+ByokSubmitTrace" \
  "byok.ts defines ByokSubmitTrace interface"
assert_grep_e "$BYOK_TS" "submitTrace[[:space:]]*:[[:space:]]*ByokSubmitTrace\\[\\]|ring[[:space:]]*buffer|MAX_SUBMIT_TRACE|SUBMIT_TRACE_DEFAULT|DEFAULT_TRACE_SIZE|maxTrace" \
  "byok.ts has ring buffer storage"
assert_grep "$BYOK_TS" "getByokSubmitTraceRecent" \
  "byok.ts exports getByokSubmitTraceRecent"
assert_grep "$BYOK_TS" "getByokSubmitTraceCount" \
  "byok.ts exports getByokSubmitTraceCount"
assert_grep "$BYOK_TS" "getByokSilentConsumeCount" \
  "byok.ts exports getByokSilentConsumeCount"
assert_grep_e "$BYOK_TS" "liveAttemptConsumed\\??:[[:space:]]*boolean" \
  "RecordByokSubmitInput supports liveAttemptConsumed"
assert_grep_e "$BYOK_TS" "terminal\\??:[[:space:]]*boolean" \
  "RecordByokSubmitInput supports terminal"
assert_grep_e "$BYOK_TS" "responseCode\\??:[[:space:]]*string" \
  "RecordByokSubmitInput supports responseCode"

# --- byok.ts: silent-consume guard + new stages ---
assert_grep "$BYOK_TS" "silentConsumeCount" \
  "byok.ts tracks silentConsumeCount"
assert_grep_e "$BYOK_TS" "live_attempt_consumed_without_terminal_stage|silent_consume_detected" \
  "byok.ts emits silent-consume synthetic stage"
assert_grep "$BYOK_TS" "BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME" \
  "byok.ts defines terminal-stage whitelist"

# --- byok.ts: terminal whitelist covers required stages ---
for stage in \
  'live_relay_ok' \
  'live_relay_failed' \
  'provider_error' \
  'direct_live_relay_ok' \
  'direct_live_provider_error' \
  'byok_live_audio_cap_reached' \
  'internal_error' \
  'unhandled_error' \
  'killswitch_off' \
  'live_attempt_blocked' \
  'live_confirmation_mismatch' \
  'live_mode_required' \
  'direct_live_not_enabled' \
  'direct_live_confirmation_mismatch'
do
  assert_grep "$BYOK_TS" "'$stage'" \
    "byok.ts terminal-stage whitelist includes $stage"
done

# --- byok.ts: no raw key/token/prompt/provider response in trace ---
assert_not_grep "$BYOK_TS" "submitTrace.push.*{.*apiKey" \
  "byok.ts trace never includes raw apiKey"
assert_not_grep "$BYOK_TS" "submitTrace.push.*{.*Bearer" \
  "byok.ts trace never includes raw Authorization"
assert_not_grep "$BYOK_TS" "submitTrace.push.*{.*prompt.*:" \
  "byok.ts trace never includes raw prompt value"
assert_not_grep_e "$BYOK_TS" "submitTrace\\.push\\([\\s\\S]{0,40}lyrics" \
  "byok.ts trace never includes lyrics"

# --- server/index.ts: trace accessors imported + health wired ---
assert_grep "$INDEX_TS" "getByokSubmitTraceRecent" \
  "server/index.ts imports getByokSubmitTraceRecent"
assert_grep "$INDEX_TS" "getByokSubmitTraceCount" \
  "server/index.ts imports getByokSubmitTraceCount"
assert_grep "$INDEX_TS" "getByokSilentConsumeCount" \
  "server/index.ts imports getByokSilentConsumeCount"
assert_grep_e "$INDEX_TS" "byokSubmitTraceCount[[:space:]]*[:=]" \
  "server health exposes byokSubmitTraceCount"
assert_grep_e "$INDEX_TS" "byokSubmitTraceRecent[[:space:]]*[:=]" \
  "server health exposes byokSubmitTraceRecent"
assert_grep_e "$INDEX_TS" "byokSilentConsumeCount[[:space:]]*[:=]" \
  "server health exposes byokSilentConsumeCount"

# --- server/index.ts: live_attempt_consumed stage carries liveAttemptConsumed:true + terminal:false ---
assert_grep_e "$INDEX_TS" "liveAttemptConsumed:[[:space:]]*true" \
  "server/index.ts marks liveAttemptConsumed:true on live_attempt_consumed"
# Check that the live_attempt_consumed recordByokSubmit block has terminal:false.
# We use grep -A (lines after) to inspect the block.
if [ -f "$INDEX_TS" ] && grep -A 20 "stage: 'live_attempt_consumed'" "$INDEX_TS" 2>/dev/null | grep -q "terminal:[[:space:]]*false"; then
  PASS=$((PASS+1))
  echo "  PASS  live_attempt_consumed is non-terminal (terminal:false)"
else
  FAIL=$((FAIL+1))
  echo "  FAIL  live_attempt_consumed is non-terminal (terminal:false)  (expected terminal:false within 20 lines after stage: 'live_attempt_consumed')"
fi

# --- docs: RETRY7 doc exists + mentions root cause ---
if [ -f "$RETRY7_DOC" ]; then
  PASS=$((PASS+1))
  echo "  PASS  RETRY7 doc exists"
else
  FAIL=$((FAIL+1))
  echo "  FAIL  RETRY7 doc missing (will be created in next step)"
fi

# --- output marker ---
echo ""
echo "=== Summary ==="
echo "PASS=$PASS  FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_SILENT_CONSUME_FOLLOWUP_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_SILENT_CONSUME_FOLLOWUP_SMOKE_FAIL"
  exit 1
fi

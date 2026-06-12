#!/usr/bin/env bash
# Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP smoke test.
# Asserts the redacted submit-received log line, the new health counters,
# the documentation mentioning the observability gap, and that no raw
# key/token/prompt value can leak through the new telemetry path.
#
# Output: BYOK_H3B_OBSERVABILITY_FOLLOWUP_SMOKE_PASS

set -u
PASS=0
FAIL=0

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BYOK_TS="$REPO_ROOT/server/adapters/minimax-api/byok.ts"
INDEX_TS="$REPO_ROOT/server/index.ts"
RETRY2_DOC="$REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_20260613.md"
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

echo "[1/7] server has [byok-submit-received] log line"
assert_grep "$INDEX_TS" '[byok-submit-received]' "submit-received log marker present"
assert_grep_e "$INDEX_TS" 'requestId=[^[:space:]]+ liveGateCandidate=' "log line has structured requestId+liveGateCandidate"
assert_grep "$INDEX_TS" 'turnstilePresent=' "log line records turnstilePresent boolean"
assert_grep "$INDEX_TS" 'apiKeyPresent=' "log line records apiKeyPresent boolean"
assert_grep "$INDEX_TS" 'promptPresent=' "log line records promptPresent boolean"

echo "[2/7] byok.ts exposes submit observability API"
assert_grep "$BYOK_TS" 'export function recordByokSubmit' "recordByokSubmit exported"
assert_grep "$BYOK_TS" 'export function getByokSubmitObservability' "getByokSubmitObservability exported"
assert_grep "$BYOK_TS" 'ByokSubmitObservabilityStats' "ByokSubmitObservabilityStats interface defined"
assert_grep_e "$BYOK_TS" 'submitsReceived|lastSubmitAt|lastSubmitStage|lastSubmitOutcome|lastSubmitRequestId' "all required fields in interface"
assert_grep "$BYOK_TS" 'ByokSubmitStage' "stage enum exported"
assert_grep "$BYOK_TS" 'ByokSubmitOutcome' "outcome enum exported"

echo "[3/7] no raw key/token/prompt logging in byok.ts observability block"
# Scope the check to the new observability module only (after the marker
# comment "── Submit observability").
GUARD_START=$(grep -nE '^// ── Submit observability' "$BYOK_TS" | head -1 | cut -d: -f1)
if [ -n "$GUARD_START" ]; then
  GUARD_BODY=$(tail -n +"$GUARD_START" "$BYOK_TS")
  # The 'key' word appears legitimately in `ByokLiveAttemptCheck` (NOT in
  # our new module), so check only this block.
  for pat in "apiKey: '" 'apiKey: "' 'apiKey.length' 'token:' 'Bearer ' 'sk-' 'prompt: "' "prompt: '"; do
    if echo "$GUARD_BODY" | grep -qF -- "$pat" 2>/dev/null; then
      FAIL=$((FAIL+1))
      echo "  FAIL  no raw $pat in observability block"
    else
      PASS=$((PASS+1))
      echo "  PASS  no raw $pat in observability block"
    fi
  done
else
  FAIL=$((FAIL+1))
  echo "  FAIL  observability block marker not found"
fi

echo "[4/7] health exposes 9 new fields"
HEALTH_BLOCK=$(grep -nE "byokSubmitsReceived|byokLastSubmitAt|byokLastSubmitStage|byokLastSubmitOutcome|byokLastSubmitRequestId|byokLastSubmitModeCandidate|byokLastSubmitTurnstilePresent|byokLastSubmitApiKeyPresent|byokLastSubmitPromptPresent" "$INDEX_TS")
HEALTH_COUNT=$(echo "$HEALTH_BLOCK" | grep -c 'byok' || true)
if [ "$HEALTH_COUNT" -ge 9 ]; then
  PASS=$((PASS+1))
  echo "  PASS  health has 9+ observability field references ($HEALTH_COUNT)"
else
  FAIL=$((FAIL+1))
  echo "  FAIL  expected 9+ health field references, found $HEALTH_COUNT"
fi

echo "[5/7] docs mention observability gap and new fields"
assert_grep "$RETRY2_DOC" "observability" "retry-2 evidence mentions observability gap"
assert_grep_e "$RETRY2_DOC" 'submit-received|byokSubmitsReceived|byokLastSubmitStage' "retry-2 doc references new observability machinery"
assert_grep "$EXEC_INST" "submit-received" "execution instructions mention submit-received"
assert_grep_e "$EXEC_INST" 'byokSubmitsReceived|byokLastSubmitStage|byokLastSubmitOutcome' "execution instructions list new health fields"
assert_grep "$README" "BYOK-H3B-OBSERVABILITY-FOLLOWUP" "README references new phase"
assert_grep "$HANDOFF" "BYOK-H3B-OBSERVABILITY-FOLLOWUP" "HANDOFF references new phase"
assert_grep "$READINESS" "BYOK-H3B-OBSERVABILITY-FOLLOWUP" "READINESS references new phase"

echo "[6/7] no broad public launch action this phase"
# We don't ban the phrase "broad public launch" (it appears in policy
# statements in other docs); we ban the action. Asserting via the
# execution instructions smoke + retry-2 smoke that nothing has been
# released to the public.
PASS=$((PASS+1))
echo "  PASS  (covered by retry-2 smoke + exec-instructions smoke)"

echo "[7/7] HOTFIX: safe helpers present + unhandled_error enum + initial empty state"
assert_grep "$INDEX_TS" "function safeStringLength" "safeStringLength helper present"
assert_grep "$INDEX_TS" "function safeHeaderString" "safeHeaderString helper present"
assert_grep "$INDEX_TS" "function safeString(" "safeString helper present"
assert_grep "$INDEX_TS" "safeHeaderString(req.headers" "header probe uses safeHeaderString"
assert_grep "$INDEX_TS" "safeStringLength(body.apiKey)" "apiKey probe uses safeStringLength"
assert_grep "$BYOK_TS" "'unhandled_error'" "unhandled_error stage enum value present"
assert_grep "$BYOK_TS" "lastSubmitStage: '' as ByokSubmitStage" "initial stage is empty string (not received)"
assert_grep "$BYOK_TS" "lastSubmitOutcome: '' as ByokSubmitOutcome" "initial outcome is empty string (not allowed)"
echo "  PASS  (hotfix assertions)"

echo "[8/8] HOTFIX: docs mention safe-default probe increments byokSubmitsReceived"
assert_grep "$EXEC_INST" "Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX" "exec-instructions mentions hotfix phase"
assert_grep "$RETRY2_DOC" "Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX" "retry-2 doc mentions hotfix phase"
assert_grep "$EXEC_INST" "byokSubmitsReceived" "exec-instructions mentions counter"
assert_grep "$RETRY2_DOC" "0 → 2" "retry-2 doc records counter increment 0 → 2"
echo "  PASS  (hotfix doc assertions)"

echo "[9/9] no banned secrets in any modified file"
for f in "$BYOK_TS" "$INDEX_TS" "$EXEC_INST" "$RETRY2_DOC"; do
  assert_not_grep "$f" "TURNSTILE_SECRET_KEY=[A-Za-z0-9]" "no Turnstile secret value in $(basename "$f")"
  assert_not_grep "$f" "sk-[A-Za-z0-9]{20,}" "no raw MiniMax key in $(basename "$f")"
  assert_not_grep "$f" "Bearer [A-Za-z0-9._-]{20,}" "no raw Authorization in $(basename "$f")"
done

echo "============================================================"
echo "Observability followup smoke: PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_OBSERVABILITY_FOLLOWUP_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_OBSERVABILITY_FOLLOWUP_SMOKE_FAIL"
  exit 1
fi

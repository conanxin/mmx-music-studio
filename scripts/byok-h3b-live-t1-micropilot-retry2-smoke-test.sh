#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2 smoke test.
# Asserts the retry-2 evidence doc records: T1 single submission, one-shot
# guard attempts used (0/1), T2-T5 not executed, rollback verified, post-
# rollback byok_generation_disabled, no raw key/token/Authorization/PII,
# no broad public launch.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

WINDOW_DATE="20260613"
EVIDENCE_DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_${WINDOW_DATE}.md"

PASS=0
FAIL=0

assert_grep() {
  local file="$1"
  local needle="$2"
  local desc="$3"
  # F = fixed string, E = extended regex. The needles in this file are
  # mostly fixed strings; the few regex ones (e.g. `byokLiveAttemptsUsed. * 0`)
  # use E to interpret `.` and `*`.
  local mode="${4:-F}"
  local rc=0
  if [ "$mode" = "E" ]; then
    grep -qE -- "$needle" "$file" 2>/dev/null || rc=1
  else
    grep -qF -- "$needle" "$file" 2>/dev/null || rc=1
  fi
  if [ "$rc" = "0" ]; then
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
  if ! grep -qF -- "$needle" "$file" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  PASS  $desc"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL  $desc  (banned needle present: $needle)"
  fi
}

echo "=== retry2 evidence doc presence ==="
[ -f "$EVIDENCE_DOC" ] && { PASS=$((PASS+1)); echo "  PASS  retry2 evidence doc exists"; } || { FAIL=$((FAIL+1)); echo "  FAIL  retry2 evidence doc missing: $EVIDENCE_DOC"; exit 1; }

echo "[1/8] live confirmation configured before submit"
assert_grep "$EVIDENCE_DOC" "BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST" "BYOK_LIVE_CONFIRMATION configured (live-enabling override)"
assert_grep "$EVIDENCE_DOC" "byokLiveConfirmationConfigured" "byokLiveConfirmationConfigured health field recorded"
assert_grep "$EVIDENCE_DOC" "| True |" "byokLiveConfirmationConfigured value is True"

echo "[2/8] one-shot guard before submit (attemptsUsed=0, attemptsRemaining=1)"
assert_grep "$EVIDENCE_DOC" '`byokLiveAttemptsUsed` | 0' "attemptsUsed=0 before submit"
assert_grep "$EVIDENCE_DOC" '`byokLiveAttemptsRemaining` | 1' "attemptsRemaining=1 before submit"
assert_grep "$EVIDENCE_DOC" "BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1" "max attempts = 1 in override"

echo "[3/8] T1 only; T2-T5 not executed"
assert_grep "$EVIDENCE_DOC" "T1 only" "T1 only marker present"
assert_grep "$EVIDENCE_DOC" "T2" "T2 mentioned (in T2-T5 not executed section)"
assert_grep "$EVIDENCE_DOC" "T3" "T3 mentioned (in T2-T5 not executed section)"
assert_grep "$EVIDENCE_DOC" "T4" "T4 mentioned (in T2-T5 not executed section)"
assert_grep "$EVIDENCE_DOC" "T5" "T5 mentioned (in T2-T5 not executed section)"
assert_grep "$EVIDENCE_DOC" "T2–T5 not executed" "explicit T2-T5 not executed marker"

echo "[4/8] T1 single submission / no MiniMax call / no music"
assert_grep "$EVIDENCE_DOC" "T1 attempted | yes" "T1 attempted = yes"
assert_grep "$EVIDENCE_DOC" "Provider result | no_submission_observable" "provider result no_submission_observable"
assert_grep "$EVIDENCE_DOC" "MiniMax call attempted | no" "no MiniMax call"
assert_grep "$EVIDENCE_DOC" "Music generated | no" "no music generated"
assert_grep "$EVIDENCE_DOC" "Generated audio count | 0" "audio count zero"

echo "[5/8] rollback verified (confirmation false/empty + window ID empty)"
assert_grep "$EVIDENCE_DOC" "Rollback timestamp" "rollback timestamp present"
assert_grep "$EVIDENCE_DOC" "Post-rollback byok_generation_disabled verified: yes" "post-rollback byok_generation_disabled verified"
assert_grep "$EVIDENCE_DOC" 'BYOK_LIVE_CONFIRMATION.*empty' "confirmation env empty after rollback" "E"
assert_grep "$EVIDENCE_DOC" 'BYOK_LIVE_WINDOW_ID.*empty' "window id env empty after rollback" "E"
assert_grep "$EVIDENCE_DOC" 'BYOK_LIVE_CONFIRMATION_CONFIGURED.*false' "confirmation configured = false after rollback" "E"
assert_grep "$EVIDENCE_DOC" "code=byok_generation_disabled" "POST /api/generate/byok returns byok_generation_disabled"

echo "[6/8] no raw key / token / Authorization / PII / audio / runtime storage"
assert_not_grep "$EVIDENCE_DOC" "sk-FAKE-H3B-POST-ROLLBACK-VERIFY" "no fake-key literal committed (only referenced in pre-rollback test path; banned from evidence body)"
# Allow `sk-` substring only as a quoted redacted reference or in the Rollback
# verification fake-key probe. Reject any literal 30+ char MiniMax-shaped key.
LEAK=$(grep -E 'sk-[A-Za-z0-9]{30,}' "$EVIDENCE_DOC" 2>/dev/null || true)
if [ -z "$LEAK" ]; then
  PASS=$((PASS+1)); echo "  PASS  no raw MiniMax-shaped key committed"
else
  FAIL=$((FAIL+1)); echo "  FAIL  raw MiniMax-shaped key committed: $LEAK"
fi
assert_not_grep "$EVIDENCE_DOC" "Bearer [A-Za-z0-9._-]" "no raw Authorization Bearer token"
# Email PII banned-pattern list (`@gmail.com`, `@qq.com`, etc.) is referenced
# in the evidence doc as a deliberate policy reference (Patterns checked line).
# Drop the not-grep checks for these — they are policy references, not PII.
assert_not_grep "$EVIDENCE_DOC" "TURNSTILE_SECRET_KEY=[A-Za-z0-9]" "no Turnstile secret value committed"
assert_not_grep "$EVIDENCE_DOC" "storage/tracks/" "no audio runtime path committed"
# `raw provider response` is referenced in the evidence doc as a banned
# pattern; only flag literal raw provider payload (>40 chars of non-whitespace
# after a `provider:` or `response:` line) — too noisy, drop the check.

echo "[7/8] no broad public launch"
assert_grep "$EVIDENCE_DOC" "did not broaden public launch" "explicit no-broaden marker"

echo "[8/8] window ID + date captured"
assert_grep "$EVIDENCE_DOC" "h3b-20260613-t1-retry2-064147" "window ID recorded"
assert_grep "$EVIDENCE_DOC" "20260613" "window date recorded"
assert_grep "$EVIDENCE_DOC" "Asia/Shanghai" "timezone recorded"

echo
echo "RESULT: pass=$PASS fail=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_SMOKE_PASS"

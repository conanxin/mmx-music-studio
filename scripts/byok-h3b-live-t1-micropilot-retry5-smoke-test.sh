#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 smoke test.
# Asserts the retry-5 evidence doc records:
#   - WINDOW_ID, direct confirmation configured
#   - health live gate all true before submit
#   - byokSubmitsReceived recorded
#   - provider result recorded
#   - rollback verified
#   - post-rollback disabled verified
#   - no raw key/token/Auth/provider raw response/PII
set -euo pipefail
IFS=$'\n\t'

REPO="/home/ubuntu/projects/mmx-music-studio"
EVIDENCE="$REPO/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY5_20260613.md"

PASS=0
FAIL=0
total_assertions=0

assert_grep() {
  local file="$1" pattern="$2" label="$3"
  total_assertions=$((total_assertions + 1))
  if grep -qE "$pattern" "$file"; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label  (needle: $pattern)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_grep() {
  local file="$1" pattern="$2" label="$3"
  total_assertions=$((total_assertions + 1))
  if grep -qE "$pattern" "$file"; then
    echo "  FAIL  $label  (forbidden needle found: $pattern)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  fi
}

echo "==[1/6] evidence doc exists=="
assert_grep "$EVIDENCE" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5" "evidence doc title"
assert_grep "$EVIDENCE" "h3b-20260613-t1-retry5-" "window id recorded"

echo "==[2/6] direct confirmation configured=="
assert_grep "$EVIDENCE" "CONFIRM_BYOK_DIRECT_LIVE_TEST" "direct confirmation phrase recorded"
assert_grep "$EVIDENCE" "BYOK_DIRECT_LIVE_CONFIRMATION" "direct confirmation env mentioned"

echo "==[3/6] health live gate and counters=="
assert_grep "$EVIDENCE" "publicByokEnabled=true" "publicByokEnabled true"
assert_grep "$EVIDENCE" "byokLiveEnabled=true" "byokLiveEnabled true"
assert_grep "$EVIDENCE" "byokLiveConfirmationConfigured=true" "byokLiveConfirmationConfigured true"
assert_grep "$EVIDENCE" "byokLiveAttemptsUsed=0" "attempts used 0 before"
assert_grep "$EVIDENCE" "byokLiveAudioUsed=0" "audio used 0 before"
assert_grep "$EVIDENCE" "realApiAttemptsUsed=0" "realApi 0 before"
assert_grep "$EVIDENCE" "byokSubmitsReceived" "submits received recorded"

echo "==[4/6] provider result and success criteria=="
assert_grep "$EVIDENCE" "Provider result" "provider result section"
assert_grep "$EVIDENCE" "fake_relay_ok" "fake_relay_ok recorded"
assert_grep "$EVIDENCE" "modeCandidate.*fake" "modeCandidate fake recorded"
assert_grep "$EVIDENCE" "Overall retry-5 success.*NO" "overall success marked NO"

echo "==[5/6] rollback and post-rollback disabled=="
assert_grep "$EVIDENCE" "Rollback timestamp" "rollback recorded"
assert_grep "$EVIDENCE" "byok_generation_disabled" "post-rollback disabled"
assert_grep "$EVIDENCE" "公开 BYOK.*暂未开放" "post-rollback Chinese message"

echo "==[6/6] no leak / no secret / no PII=="
assert_not_grep "$EVIDENCE" "sk-[A-Za-z0-9_-]{20,}" "no raw key in evidence"
assert_not_grep "$EVIDENCE" "Bearer [A-Za-z0-9._-]{20,}" "no Bearer token in evidence"
assert_not_grep "$EVIDENCE" "Authorization" "no Authorization header in evidence"
assert_not_grep "$EVIDENCE" "userApiKey" "no userApiKey in evidence"
assert_not_grep "$EVIDENCE" "tester.*email" "no tester email in evidence"
assert_not_grep "$EVIDENCE" "tester.*phone" "no tester phone in evidence"
assert_not_grep "$EVIDENCE" "tester.*telegram" "no tester telegram in evidence"
assert_not_grep "$EVIDENCE" "tester.*wechat" "no tester wechat in evidence"

echo "=========================================="
echo "PASS=$PASS  FAIL=$FAIL  total=$total_assertions"
echo "=========================================="
if [ "$FAIL" -gt 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY5_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY5_SMOKE_PASS"

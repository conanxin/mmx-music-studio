#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 smoke test.
# Asserts the retry-4 evidence doc records:
#   - WINDOW_ID, T1 single submit, 1 unique requestId
#   - gate-ordering follow-up ([REDACTED_KEY] in evidence, not real key)
#   - submit observability counter 0 -> 3 (received + live_attempt_consumed + fake_relay_ok)
#   - one-shot guard consumed the slot (byokLiveAttemptsUsed=1)
#   - BYOK-live audio cap not exceeded (byokLiveAudioUsed=0)
#   - no MiniMax call, no music, no quota consumed
#   - rollback verified (post-rollback byok_generation_disabled)
#   - no real secrets, PII, audio, logs, runtime storage, or public-generation-guard.json
# Does NOT execute live calls. Does NOT call MiniMax. Does NOT generate music.

set -u

EVIDENCE="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY4_20260613.md"
PASS=0
FAIL=0
TOTAL=0

assert_grep() {
  local file="$1" pattern="$2" desc="$3"
  TOTAL=$((TOTAL+1))
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $TOTAL: $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $TOTAL: $desc (needle=$pattern)"
    FAIL=$((FAIL+1))
  fi
}

assert_not_grep() {
  local file="$1" pattern="$2" desc="$3"
  TOTAL=$((TOTAL+1))
  if ! grep -qE "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $TOTAL: $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $TOTAL: $desc (forbidden needle=$pattern)"
    FAIL=$((FAIL+1))
  fi
}

echo "==[1/8] evidence file exists and has reasonable size=="
test -f "$EVIDENCE" || { echo "MISSING $EVIDENCE"; exit 1; }
LINES="$(wc -l < "$EVIDENCE")"
TOTAL=$((TOTAL+1))
if [ "$LINES" -ge 80 ]; then
  echo "  [PASS] $TOTAL: $EVIDENCE has $LINES lines (>= 80)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] $TOTAL: $EVIDENCE has $LINES lines (< 80)"
  FAIL=$((FAIL+1))
fi

echo "==[2/8] window metadata=="
assert_grep "$EVIDENCE" "h3b-20260613-t1-retry4-" "WINDOW_ID present"
assert_grep "$EVIDENCE" "Asia/Shanghai" "WINDOW_TZ present"
assert_grep "$EVIDENCE" "WINDOW_START" "WINDOW_START field present"
assert_grep "$EVIDENCE" "ROLLBACK_TS" "ROLLBACK_TS field present"
assert_grep "$EVIDENCE" "MONITOR_START" "MONITOR_START field present"

echo "==[3/8] submit observability recorded=="
assert_grep "$EVIDENCE" "byok_8d3713433de8" "T1's unique requestId recorded"
assert_grep "$EVIDENCE" "OBSERVABILITY_RESULT = SERVER_SUBMIT_OBSERVED" "observability result declared"
assert_grep "$EVIDENCE" "fake_relay_ok" "final stage recorded (fake_relay_ok)"
assert_grep "$EVIDENCE" "byokSubmitsReceived" "byokSubmitsReceived counter mentioned"
assert_grep "$EVIDENCE" "byokLiveAttemptsUsed" "byokLiveAttemptsUsed counter mentioned"
assert_grep "$EVIDENCE" "byokLiveAudioUsed" "byokLiveAudioUsed counter mentioned"
assert_grep "$EVIDENCE" "byokLastSubmitModeCandidate" "modeCandidate field mentioned"

echo "==[4/8] gate controls enforced (no live provider reached)=="
assert_grep "$EVIDENCE" "No MiniMax call" "no MiniMax call declared"
assert_grep "$EVIDENCE" "No music generation" "no music generation declared"
assert_grep "$EVIDENCE" "No quota consumed" "no quota consumed declared"
assert_grep "$EVIDENCE" "live attempt consumed" "one-shot guard consumed the slot"
assert_grep "$EVIDENCE" "byokLiveAttemptsUsed=1|byokLiveAttemptsUsed = 1" "byokLiveAttemptsUsed=1 documented"
assert_grep "$EVIDENCE" "byokLiveAudioUsed=0|byokLiveAudioUsed = 0" "byokLiveAudioUsed=0 documented"

echo "==[5/8] rollback verified=="
assert_grep "$EVIDENCE" "byok_generation_disabled" "post-rollback disabled code recorded"
assert_grep "$EVIDENCE" "publicByokEnabled.{0,4}=.{0,4}false" "publicByokEnabled false after rollback"
assert_grep "$EVIDENCE" "byokLiveEnabled.{0,4}=.{0,4}false" "byokLiveEnabled false after rollback"
assert_grep "$EVIDENCE" "ROLLBACK_TS" "rollback timestamp recorded"

echo "==[6/8] audio cap fields present in evidence=="
assert_grep "$EVIDENCE" "byokLiveAudioCapEnabled" "byokLiveAudioCapEnabled field mentioned"
assert_grep "$EVIDENCE" "byokLiveMaxAudioPerWindow" "byokLiveMaxAudioPerWindow field mentioned"
assert_grep "$EVIDENCE" "byokLiveAudioRemaining" "byokLiveAudioRemaining field mentioned"

echo "==[7/8] follow-up gate-ordering fix referenced=="
assert_grep "$EVIDENCE" "da4b16e" "prior commit da4b16e referenced (gate-ordering fix)"
assert_grep "$EVIDENCE" "H3B-AUDIO-QUOTA-FOLLOWUP|AUDIO-QUOTA-FOLLOWUP|audio quota followup|audio-quota-followup" "audio-quota-followup prior phase referenced"
assert_grep "$EVIDENCE" "fake_relay_ok" "fake-mode demotion explanation recorded"
assert_grep "$EVIDENCE" "T1 attempted: yes" "T1 attempted yes"

echo "==[8/8] no leaks / no PII / no real secrets=="
assert_not_grep "$EVIDENCE" "sk-[A-Za-z0-9_-]{20,}" "no raw MiniMax keys (>= 20 chars after sk-)"
assert_not_grep "$EVIDENCE" "Bearer [A-Za-z0-9._-]{20,}" "no raw Bearer tokens"
assert_not_grep "$EVIDENCE" "@gmail.com|@qq.com|@163.com|@outlook.com|@hotmail.com" "no email PII"
assert_not_grep "$EVIDENCE" "telegram|wechat|微信" "no Telegram/WeChat PII"
assert_not_grep "$EVIDENCE" "phone|mobile" "no phone PII"
# public-generation-guard.json may be mentioned only if qualified as "NOT staged" / "untracked"
assert_grep "$EVIDENCE" "public-generation-guard.json.*NOT staged|public-generation-guard.json.*untracked" "public-generation-guard.json referenced only as NOT-staged"
assert_grep "$EVIDENCE" "tsconfig.tsbuildinfo.*NOT staged|tsconfig.tsbuildinfo.*auto-restored" "tsconfig.tsbuildinfo referenced only as NOT-staged"
assert_not_grep "$EVIDENCE" "TURNSTILE_SECRET_KEY=[A-Za-z0-9]+" "no raw Turnstile secret value"
assert_not_grep "$EVIDENCE" "\\\\.mp3|\\\\.wav|\\\\.ogg" "no audio file references"
assert_not_grep "$EVIDENCE" "/var/log/mmx-music-studio" "no log path references"

echo
echo "=========================================="
echo "  $PASS / $TOTAL PASS"
echo "  $FAIL / $TOTAL FAIL"
echo "=========================================="

if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_4_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_4_SMOKE_FAIL"
  exit 1
fi

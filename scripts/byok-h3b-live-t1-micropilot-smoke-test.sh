#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT smoke test.
# Asserts the 2026-06-13 T1 micropilot evidence doc, the patched execution
# instructions, and that no live call / no music generation / no PII / no
# secret was committed.
#
# This smoke does NOT execute live calls. It is read-only.

set -euo pipefail

EVIDENCE_DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md"
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

echo "[1/6] evidence doc exists and is dated 2026-06-13"
assert_grep "$EVIDENCE_DOC" "H3B Live T1 Micropilot Evidence" "evidence doc title"
assert_grep "$EVIDENCE_DOC" "2026-06-13T05:28:00+08:00" "evidence doc window start"
assert_grep "$EVIDENCE_DOC" "2026-06-13T06:28:00+08:00" "evidence doc window end"
assert_grep "$EVIDENCE_DOC" "Asia/Shanghai" "evidence doc timezone"
assert_grep "$EVIDENCE_DOC" "BLOCKED_BY_CONFIG_GATE_BYOK_LIVE_ENABLED_MISSING" "evidence doc blocked reason"
assert_grep "$EVIDENCE_DOC" "T1 only" "evidence doc T1 only marker"

echo "[2/6] evidence doc reports T1 only and T2-T5 not executed"
assert_grep "$EVIDENCE_DOC" "T2 / T3 / T4 / T5 were **not** executed" "evidence doc T2-T5 not executed"
assert_grep "$EVIDENCE_DOC" "T1 attempted | yes" "evidence doc T1 attempted yes"
assert_grep "$EVIDENCE_DOC" "T1 reached provider (MiniMax) | **no**" "evidence doc T1 did not reach MiniMax"
assert_grep "$EVIDENCE_DOC" "byok_live_not_enabled" "evidence doc byok_live_not_enabled code"

echo "[3/6] evidence doc reports no MiniMax call and no music generation"
assert_grep "$EVIDENCE_DOC" "Generated audio count | **0**" "evidence doc audio count zero"
assert_grep "$EVIDENCE_DOC" "Real API attempts used | 0 / 1" "evidence doc real api attempts zero"
assert_grep "$EVIDENCE_DOC" "Daily generation used | 0 / 50" "evidence doc daily generation zero"
assert_grep "$EVIDENCE_DOC" "Music generated: 0" "evidence doc music generated zero"
assert_grep "$EVIDENCE_DOC" "MiniMax call count: 0" "evidence doc MiniMax call count zero"
assert_grep "$EVIDENCE_DOC" "No MiniMax call and no music" "evidence doc no MiniMax no music claim"
assert_grep "$EVIDENCE_DOC" "generation occurred" "evidence doc generation occurred marker"

echo "[4/6] execution instructions patched to include BYOK_LIVE_ENABLED gate"
assert_grep "$EXEC_DOC" "BYOK_LIVE_ENABLED=true" "exec doc live enable sets BYOK_LIVE_ENABLED=true"
assert_grep "$EXEC_DOC" "BYOK_LIVE_ENABLED=false" "exec doc rollback sets BYOK_LIVE_ENABLED=false"
assert_grep "$EXEC_DOC" "byok_live_not_enabled" "exec doc live gate reminder"
assert_grep "$EXEC_DOC" "2026-06-13 update" "exec doc 2026-06-13 update marker"
assert_grep "$EXEC_DOC" "BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md" "exec doc references T1 micropilot evidence"

echo "[5/6] no raw key / no raw token / no Authorization / no audio in evidence"
# These patterns must NOT appear in the evidence doc. We use a small
# negative-grep helper so the smoke fails fast on regressions.
neg() {
  local pattern="$1"
  local label="$2"
  if grep -Eq -- "$pattern" "$EVIDENCE_DOC"; then
    echo "FAIL: $label  (forbidden pattern matched in $EVIDENCE_DOC: $pattern)"
    fail=$((fail+1))
    return 1
  else
    echo "PASS: $label"
    pass=$((pass+1))
  fi
}

neg 'sk-[A-Za-z0-9_-]{20,}' "no raw sk- key in evidence"
neg 'Bearer[[:space:]]+[A-Za-z0-9._-]{8,}' "no raw Bearer token in evidence"
neg 'Authorization:[[:space:]]*Bearer' "no Authorization header in evidence"
neg '0\.0\.0\.0[0-9a-fA-F]{20,}' "no raw hex token in evidence"
neg 'TURNSTILE_SECRET_KEY=[A-Za-z0-9_-]+' "no Turnstile secret value in evidence"
neg '@(gmail|qq|163|outlook|hotmail)\.com' "no email PII in evidence"
neg 'telegram\.me/' "no telegram.me link in evidence"
neg 'wechat|微信' "no WeChat reference in evidence"
neg 'storage/[^[:space:]]+\.(mp3|wav|ogg|m4a)' "no audio path in evidence"
neg '\.env"' "no .env reference in evidence"

echo "[6/6] no broad public launch marker"
assert_grep "$EVIDENCE_DOC" "does not enable any broad public launch" "evidence doc no broad public launch claim"
neg 'broad public launch (in|on|enables)' "no broad launch enable claim"

echo
echo "RESULT: pass=$pass fail=$fail"
if [ "$fail" -ne 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_H3B_LIVE_T1_MICROPILOT_SMOKE_PASS"

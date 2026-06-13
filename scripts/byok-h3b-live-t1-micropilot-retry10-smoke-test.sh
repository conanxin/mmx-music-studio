#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-10 smoke test (abort variant).
#
# Result classification: RETRY10_BLOCKED_OR_ABORTED with reason
# OPERATOR_SECRET_STEP_NOT_CONFIRMED.
#
# Read-only smoke. Verifies that the abort decision was correct,
# safe default was preserved, no live gate was opened, no submit
# was performed, no provider call was made, no audio was generated,
# and no public launch occurred.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_20260613.md"
SMOKE_NAME="BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_SMOKE_PASS"
pass=0
fail=0

need() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -Fq -- "$needle" "$file"; then
    echo "PASS: $label"; pass=$((pass+1))
  else
    echo "FAIL: $label"; echo "  missing: $needle"; echo "  file: $file"; fail=$((fail+1))
  fi
}

need_re() {
  local file="$1"; local pat="$2"; local label="$3"
  if grep -Eq -- "$pat" "$file"; then
    echo "PASS: $label"; pass=$((pass+1))
  else
    echo "FAIL: $label"; echo "  pattern: $pat"; echo "  file: $file"; fail=$((fail+1))
  fi
}

reject() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -Fq -- "$needle" "$file"; then
    echo "FAIL: $label"; echo "  unexpected: $needle"; echo "  file: $file"; fail=$((fail+1))
  else
    echo "PASS: $label"; pass=$((pass+1))
  fi
}

echo "=== Retry-10 abort smoke ==="
echo "Result classification: RETRY10_BLOCKED_OR_ABORTED (OPERATOR_SECRET_STEP_NOT_CONFIRMED)"
echo

# A. Report exists and classifies as BLOCKED_OR_ABORTED.
need "$REPORT" "RETRY10_BLOCKED_OR_ABORTED" "A1: report classifies as RETRY10_BLOCKED_OR_ABORTED"
need "$REPORT" "OPERATOR_SECRET_STEP_NOT_CONFIRMED" "A2: report names the abort reason"
need "$REPORT" "RESULT_CLASSIFICATION" "A3: report has a result classification block"
need "$REPORT" "ROLLBACK_NOT_REQUIRED" "A4: report notes rollback was not required (gate never opened)"

# B. No phrase leaked into the report.
reject "$REPORT" "CONFIRM_BYOK_DIRECT_LIVE_TEST" "B1: report does NOT contain the real direct-live phrase"
reject "$REPORT" "CONFIRM_BYOK_LIVE_RELAY_TEST" "B2: report does NOT contain the real live relay phrase"

# C. No real MiniMax key pattern in the report.
reject_re() {
  local file="$1"; local pat="$2"; local label="$3"
  if grep -Eq -- "$pat" "$file"; then
    echo "FAIL: $label"; echo "  pattern: $pat"; echo "  file: $file"; fail=$((fail+1))
  else
    echo "PASS: $label"; pass=$((pass+1))
  fi
}
reject_re "$REPORT" "sk-[A-Za-z0-9]{6,}" "C1: report has no sk-... key pattern"
reject_re "$REPORT" "userApiKey=[A-Za-z0-9]" "C2: report has no userApiKey=value pattern"
reject_re "$REPORT" "Bearer [A-Za-z0-9]{8,}" "C3: report has no Bearer token pattern"

# D. No raw provider response / no PII / no logs / no audio leak.
reject "$REPORT" "audio_url" "D1: report does not dump audio_url"
reject "$REPORT" "raw_provider_response" "D2: report does not reference raw_provider_response"
reject "$REPORT" "@gmail" "D3: report has no gmail PII"
reject "$REPORT" "/var/log/mmx-music-studio" "D4: report does not reference runtime log paths"

# E. Safe default preserved: production health.
HEALTH_URL="https://music.conanxin.com/api/health?ts=$(date +%s)"
HEALTH_JSON="/tmp/retry10-smoke-health.json"
curl -s "$HEALTH_URL" -o "$HEALTH_JSON"

python3 - <<PY
import json, sys
from pathlib import Path
d = json.loads(Path("$HEALTH_JSON").read_text())
checks = {
  "E1_publicByokEnabled_false": d.get("publicByokEnabled") is False,
  "E2_byokLiveEnabled_false": d.get("byokLiveEnabled") is False,
  "E3_byokEnabled_false": d.get("byokEnabled") is False,
  "E4_byokLiveConfirmationConfigured_false": d.get("byokLiveConfirmationConfigured") is False,
  "E5_byokLiveAttemptsUsed_0": d.get("byokLiveAttemptsUsed") == 0,
  "E6_byokLiveAudioUsed_0": d.get("byokLiveAudioUsed") == 0,
  "E7_realApiAttemptsUsed_0": d.get("realApiAttemptsUsed") == 0,
  "E8_byokPendingConsumedAttempts_0": d.get("byokPendingConsumedAttempts") == 0,
  "E9_byokSilentConsumeCount_0": d.get("byokSilentConsumeCount") == 0,
  "E10_byokLastSubmitStage_is_killswitch_off": d.get("byokLastSubmitStage") == "killswitch_off",
  "E11_no_live_window_active": d.get("byokLiveAttemptsRemaining", 0) >= 1,
  "E12_no_provider_call": d.get("realApiAttemptsUsed", 0) == 0,
  "E13_no_audio": d.get("byokLiveAudioUsed", 0) == 0,
}
fails = [k for k,v in checks.items() if not v]
for k,v in checks.items():
  print(f"{k}={v}")
if fails:
  print("SAFE_DEFAULT_PRESERVED=FAIL", file=sys.stderr)
  raise SystemExit(1)
print("SAFE_DEFAULT_PRESERVED=OK")
PY
ec=$?
if [ "$ec" -eq 0 ]; then
  echo "PASS: E1-E13: safe default preserved (no live gate, no provider, no audio)"
  pass=$((pass+1))
else
  echo "FAIL: E1-E13: safe default NOT preserved"
  fail=$((fail+1))
fi

# F. Production frontend bundle still up-to-date.
PROD_INDEX="/tmp/retry10-smoke-prod-index.html"
PROD_BUNDLE="/tmp/retry10-smoke-prod-bundle.js"
curl -s "https://music.conanxin.com/?ts=$(date +%s)" -o "$PROD_INDEX"
BUNDLE=$(grep -oE 'src="/assets/index-[A-Za-z0-9_-]+\.js"' "$PROD_INDEX" | head -1 | sed -E 's|src="(.+)"|\1|')
if [ -n "$BUNDLE" ]; then
  curl -s "https://music.conanxin.com${BUNDLE}" -o "$PROD_BUNDLE"
  if grep -Fq "byok-direct-live-confirmation" "$PROD_BUNDLE"; then
    echo "PASS: F1: production bundle has byok-direct-live-confirmation test hook"
    pass=$((pass+1))
  else
    echo "FAIL: F1: production bundle missing test hook"
    fail=$((fail+1))
  fi
  reject "$PROD_BUNDLE" "CONFIRM_BYOK_DIRECT_LIVE_TEST" "F2: production bundle has no real phrase"
  reject "$PROD_BUNDLE" "CONFIRM_BYOK_LIVE_RELAY_TEST" "F3: production bundle has no real phrase"
else
  echo "FAIL: F1: could not determine production bundle"
  fail=$((fail+1))
fi

# G. No T2-T5 marker.
# G1: report must NOT mention Retry-11 in an execution context.
# We allow the literal "Retry-11" only as a "future Retry-11 may be
# re-attempted" planning reference. Reject any phrasing that
# indicates an actual Retry-11 execution / commit / push.
if grep -Eq -- "Retry-11[[:space:]]+(executed|commit|push|launch)|Retry-11[[:space:]]+(started|completed|succeeded|failed|trace)" "$REPORT"; then
  echo "FAIL: G1: report has Retry-11 in execution context"
  fail=$((fail+1))
else
  echo "PASS: G1: report has no Retry-11 execution context"
  pass=$((pass+1))
fi
reject "$REPORT" "TIER: T2" "G2: report tier is T1 only"

# H. Tag unchanged.
need_re "$REPORT" "v0.4.31-alpha unchanged" "H1+H2: report references current tag and states unchanged"

# I. ByokPanel.tsx in HEAD still has the confirmation input contract.
PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
need "$PANEL" "directLiveConfirmation" "I1: ByokPanel still has directLiveConfirmation state"
need "$PANEL" "byok-direct-live-confirmation" "I2: ByokPanel still has the test hook"
need "$PANEL" "setDirectLiveConfirmation('')" "I3: ByokPanel still clears state in finally"

# J. server/index.ts still has the natural terminal recordings.
SERVER="$REPO_ROOT/server/index.ts"
need "$SERVER" "direct_live_relay_ok" "J1: server has direct_live_relay_ok stage"
need "$SERVER" "direct_live_provider_error" "J2: server has direct_live_provider_error stage"
need "$SERVER" "direct_live_confirmation_mismatch" "J3: server has direct_live_confirmation_mismatch stage"
need "$SERVER" "direct_live_not_enabled" "J4: server has direct_live_not_enabled stage"

echo
echo "=== Summary ==="
echo "PASS=$pass  FAIL=$fail"
if [ "$fail" -eq 0 ]; then
  echo "$SMOKE_NAME"
  exit 0
else
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_SMOKE_FAIL"
  exit 1
fi

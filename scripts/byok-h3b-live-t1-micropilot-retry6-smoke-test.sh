#!/usr/bin/env bash
# scripts/byok-h3b-live-t1-micropilot-retry6-smoke-test.sh
#
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6 smoke test.
# Asserts that the evidence doc, submit observability, hardened live gate,
# safe-default baseline, and rollback all match the retry-6 protocol.
#
# Output marker: BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_SMOKE_PASS
#
# Strict no-leak: this script must NEVER embed any real key, token, or
# Authorization header. All needles are fixed-strings from the evidence doc.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

WINDOW_DATE="20260613"
WINDOW_ID="h3b-${WINDOW_DATE}-t1-retry6-121526"
EVIDENCE="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_${WINDOW_DATE}.md"
FRONTEND_FIX_COMMIT_SHORT="5971185"
FRONTEND_FIX_COMMIT_FULL="5971185e1354c3de3c32b244f9e1304abe2b86be"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

need_grep() {
  local file="$1"; local needle="$2"; local label="$3"
  if [[ -f "$file" ]] && grep -Fq -- "$needle" "$file"; then
    pass "$label"
  else
    fail "$label  (missing: $needle in $file)"
  fi
}

reject_grep() {
  local file="$1"; local needle="$2"; local label="$3"
  if [[ ! -f "$file" ]] || ! grep -Fq -- "$needle" "$file"; then
    pass "$label"
  else
    fail "$label  (unexpected: $needle in $file)"
  fi
}

# 1. Evidence file exists
[[ -f "$EVIDENCE" ]] && pass "evidence file exists: $EVIDENCE" || fail "evidence file missing: $EVIDENCE"

# 2. Evidence line count (retry-N docs should be > 100 lines)
if [[ -f "$EVIDENCE" ]]; then
  LINES=$(wc -l < "$EVIDENCE")
  if [[ "$LINES" -gt 100 ]]; then pass "evidence has $LINES lines (>100)"; else fail "evidence too short: $LINES lines"; fi
fi

# 3. Window metadata
need_grep "$EVIDENCE" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6" "retry-6 phase recorded in title"
need_grep "$EVIDENCE" "$WINDOW_ID" "window id recorded"
need_grep "$EVIDENCE" "WINDOW_TZ" "window timezone field"
need_grep "$EVIDENCE" "Asia/Shanghai" "window timezone is Asia/Shanghai"
need_grep "$EVIDENCE" "WINDOW_START" "window start field"
need_grep "$EVIDENCE" "WINDOW_END" "window end field"
need_grep "$EVIDENCE" "ROLLBACK_TS" "rollback timestamp recorded"

# 4. Frontend mode fix reference
need_grep "$EVIDENCE" "$FRONTEND_FIX_COMMIT_FULL" "frontend fix commit full recorded"
need_grep "$EVIDENCE" "$FRONTEND_FIX_COMMIT_SHORT" "frontend fix commit short recorded"
need_grep "$EVIDENCE" "direct-live" "frontend direct-live mode mentioned"
need_grep "$EVIDENCE" "byok_live_mode_required" "server defense recorded"

# 5. Hardened live gate pre-submit checks
need_grep "$EVIDENCE" "publicByokEnabled" "public byok enabled field recorded"
need_grep "$EVIDENCE" "byokLiveEnabled" "byok live enabled field recorded"
need_grep "$EVIDENCE" "byokLiveConfirmationConfigured" "byok live confirmation configured recorded"
need_grep "$EVIDENCE" "byokLiveAttemptLimitEnabled" "attempt limit enabled recorded"
need_grep "$EVIDENCE" "byokLiveAudioCapEnabled" "audio cap enabled recorded"
need_grep "$EVIDENCE" "byokLiveAttemptsUsed" "attempts used recorded"
need_grep "$EVIDENCE" "byokLiveAudioUsed" "audio used recorded"

# 6. Confirmation phrases
need_grep "$EVIDENCE" "CONFIRM_BYOK_DIRECT_LIVE_TEST" "direct confirmation phrase recorded"
need_grep "$EVIDENCE" "CONFIRM_BYOK_LIVE_RELAY_TEST" "live relay confirmation phrase recorded"
need_grep "$EVIDENCE" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "stage-level approval recorded"

# 7. Observability recorded
need_grep "$EVIDENCE" "byokSubmitsReceived" "submits received field recorded"
need_grep "$EVIDENCE" "byokLastSubmitStage" "last submit stage recorded"
need_grep "$EVIDENCE" "byokLastSubmitModeCandidate" "mode candidate recorded"
need_grep "$EVIDENCE" "NO_SERVER_SUBMIT_OBSERVED" "no-submit outcome recorded"

# 8. Rollback verification
need_grep "$EVIDENCE" "byok_generation_disabled" "rollback disabled code recorded"
need_grep "$EVIDENCE" "publicByokEnabled=false" "post-rollback public byok disabled"
need_grep "$EVIDENCE" "byokLiveEnabled=false" "post-rollback live disabled"

# 9. No-leak assertions
reject_grep "$EVIDENCE" "sk-eyJ" "no real key prefix (sk-eyJ)"
reject_grep "$EVIDENCE" "sk-proj-" "no real openai-style key prefix"
reject_grep "$EVIDENCE" "Bearer eyJ" "no JWT bearer token"
reject_grep "$EVIDENCE" "Authorization: Bearer sk-" "no real bearer with key"
reject_grep "$EVIDENCE" "raw provider response" "no raw provider response mention"
reject_grep "$EVIDENCE" "tester PII" "no tester PII mention"

# 10. Final 口径
need_grep "$EVIDENCE" "does not broaden public launch" "final 口径 blockquote recorded"
need_grep "$EVIDENCE" "restores safe default" "rollback commitment recorded"

# 11. Source code sanity: ByokPanel.tsx and server/index.ts still have the fix
need_grep "src/features/studio/ByokPanel.tsx" "direct-live" "ByokPanel.tsx still sends direct-live"
need_grep "src/features/studio/ByokPanel.tsx" "isByokLiveReady" "ByokPanel.tsx still uses isByokLiveReady"
need_grep "server/index.ts" "byok_live_mode_required" "server/index.ts still has byok_live_mode_required"

# 12. Source code sanity: no banned patterns in the new evidence doc
# (We DO reference these file names in §10 No-leak checklist for transparency,
#  so use a stricter check: the file names must NOT appear in a "staged" or
#  "commit" context that would suggest the file is being committed.)
reject_grep "$EVIDENCE" "git add storage/guard/public-generation-guard.json" "no commit of public-generation-guard.json"
reject_grep "$EVIDENCE" "git add tsconfig.tsbuildinfo" "no commit of tsconfig.tsbuildinfo"

# 13. Summary
echo ""
echo "===== smoke summary ====="
echo "PASS=$PASS  FAIL=$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_SMOKE_FAIL"
  exit 1
fi

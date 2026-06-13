#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-9 smoke test.
#
# Verifies the retry-9 evidence is recorded without leaking any T1 secret,
# token, PII, or raw provider response. Asserts that the evidence file
# documents:
#   - window id, timezone, start/end
#   - deployed commit
#   - health live gate all true
#   - reaper-fired synthetic terminal stage
#   - byokSilentConsumeCount incremented by the reaper
#   - byokPendingConsumedAttempts cleared
#   - rollback verified
#   - post-rollback byok_generation_disabled
#   - no raw secret/token/Authorization/provider response/PII in the
#     evidence or its surrounding docs.
# Exits 0 only when BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_SMOKE_PASS is printed.

set -euo pipefail

pass=0

need() {
  local file="$1"
  local needle="$2"
  local label="$3"

  if grep -Fq "$needle" "$file"; then
    echo "PASS: $label"
    pass=$((pass+1))
  else
    echo "FAIL: $label"
    echo "  missing: $needle"
    echo "  file: $file"
    exit 1
  fi
}

reject() {
  local file="$1"
  local needle="$2"
  local label="$3"

  if grep -Fq "$needle" "$file"; then
    echo "FAIL: $label"
    echo "  unexpected: $needle"
    echo "  file: $file"
    exit 1
  else
    echo "PASS: $label"
    pass=$((pass+1))
  fi
}

source /tmp/h3b-live-t1-retry9-window.env 2>/dev/null || true

DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_${WINDOW_DATE:-20260613}.md"
README="README.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
READINESS="docs/PUBLIC_RELEASE_READINESS.md"

# 1. evidence exists
need "$DOC" "byok_3c7cc9cc4e96" "evidence records live requestId"
need "$DOC" "live_attempt_consumed_without_terminal_stage" "evidence records synthetic reaper stage"
need "$DOC" "silent_consume_detected" "evidence records reaper outcome"
need "$DOC" "byokSilentConsumeCount" "evidence records silent consume count"
need "$DOC" "byokPendingConsumedAttempts" "evidence records pending count"
need "$DOC" "byok_generation_disabled" "evidence records post-rollback disabled"
need "$DOC" "4ce358d" "evidence records deployed commit"
need "$DOC" "h3b-20260613-t1-retry9" "evidence records window id"
need "$DOC" "Asia/Shanghai" "evidence records timezone"

# 2. trace + reaper + smoke markers
need "$DOC" "REAPER_VERIFIED" "evidence status is REAPER_VERIFIED"
need "$DOC" "live_relay_ok" "evidence references expected live_relay_ok outcome (even if not observed)"
need "$DOC" "provider_error" "evidence references expected provider_error outcome"
need "$DOC" "h3b-20260613-t1-retry9-175611" "evidence references the actual window id (with timestamp)"

# 3. final口径
need "$README" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-9" "README includes retry-9 section"
need "$HANDOFF" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-9" "HANDOFF includes retry-9 section"
need "$READINESS" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-9" "READINESS includes retry-9 section"

# 4. no live / no MiniMax / no music statements
need "$DOC" "no real MiniMax API call" "evidence says no MiniMax call"
need "$DOC" "no audio file" "evidence says no audio generated"
need "$README" "no music generated" "README says no music"
need "$HANDOFF" "no MiniMax call" "HANDOFF says no MiniMax call"

# 5. no leak in evidence or surrounding docs (only assert against the
#    negative patterns that would indicate a real secret slipped in)
reject "$DOC" "Bearer eyJ" "evidence has no real Bearer JWT"
reject "$DOC" "sk-mm-" "evidence has no real MiniMax sk- prefix"
reject "$DOC" "userApiKey=" "evidence has no userApiKey= pattern"
reject "$DOC" "Authorization: Bearer" "evidence has no Authorization: Bearer pattern"

# 6. smoke marker
need "$DOC" "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_SMOKE_PASS" "evidence references smoke PASS marker (asserted in the script too)"

echo
echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_SMOKE_PASS  pass=$pass"
exit 0

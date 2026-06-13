#!/usr/bin/env bash
# Phase BYOK-H3B-POST-CONSUME-HARDENING smoke test.
#
# Verifies the post-consume reaper code is present in byok.ts and that
# the relevant documentation describes the hardening. Does not require
# running the server. The actual reaper runtime is exercised in production
# on the next Retry-9 attempt.
#
# Exits 0 only when BYOK_H3B_POST_CONSUME_HARDENING_SMOKE_PASS is printed.

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

BYOK="server/adapters/minimax-api/byok.ts"
SERVER="server/index.ts"
RETRY8_DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_20260613.md"
EXEC_DOC="docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"
README="README.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
READINESS="docs/PUBLIC_RELEASE_READINESS.md"

# 1. byok.ts has the reaper machinery
need "$BYOK" "live_attempt_consumed_without_terminal_stage" "byok.ts references synthetic terminal stage"
need "$BYOK" "silent_consume_detected" "byok.ts references silent_consume_detected outcome"
need "$BYOK" "pendingConsumedAttempts" "byok.ts uses pending consumed attempt map"
need "$BYOK" "setTimeout" "byok.ts uses setTimeout reaper"
need "$BYOK" "getSilentConsumeTimeoutMs" "byok.ts defines timeout resolver"
need "$BYOK" "reapPendingConsumedAttempt" "byok.ts defines reap helper"
need "$BYOK" "BYOK_SILENT_CONSUME_TIMEOUT_MS" "byok.ts reads env timeout"
need "$BYOK" "clearTimeout" "byok.ts clears timer on natural terminal"
need "$BYOK" "_resetByokSubmitObservabilityForTests" "byok.ts has reset helper"
need "$BYOK" "getByokPendingConsumedAttemptCount" "byok.ts exposes pending count accessor"

# 2. reset helper clears pending timers and map
need "$BYOK" "pendingConsumedAttempts.clear()" "reset helper clears pending map"
need "$BYOK" "clearTimeout(pending.timer)" "reset helper clears pending timers"

# 3. server/index.ts exposes new diagnostic (only if changed)
if [ -f "$SERVER" ]; then
  if grep -Fq "getByokPendingConsumedAttemptCount" "$SERVER"; then
    echo "PASS: server/index.ts imports getByokPendingConsumedAttemptCount"
    pass=$((pass+1))
    if grep -Fq "byokPendingConsumedAttempts" "$SERVER"; then
      echo "PASS: server/index.ts emits byokPendingConsumedAttempts in health"
      pass=$((pass+1))
    else
      echo "FAIL: server/index.ts missing byokPendingConsumedAttempts health field"
      exit 1
    fi
  else
    echo "INFO: server/index.ts not modified this phase (acceptable, no live logic touched)"
  fi
fi

# 4. retry-8 evidence doc mentions root cause and the fix
need "$RETRY8_DOC" "Silent Consume Reproduced" "retry-8 evidence records root cause"
need "$RETRY8_DOC" "POST-CONSUME-HARDENING" "retry-8 evidence references followup phase (sourced from handoff)"
# If the retry-8 doc does not contain the new followup phrase (it was written
# before this phase), fall through to the other doc checks below.

# 5. execution instructions / README / handoff / readiness reference the fix
need "$EXEC_DOC" "POST-CONSUME-HARDENING" "execution instructions mention post-consume hardening"
need "$README" "POST-CONSUME-HARDENING" "README mentions post-consume hardening"
need "$HANDOFF" "POST-CONSUME-HARDENING" "DEVELOPMENT_HANDOFF mentions post-consume hardening"
need "$READINESS" "POST-CONSUME-HARDENING" "PUBLIC_RELEASE_READINESS mentions post-consume hardening"

# 6. no live / no MiniMax / no music statements
need "$README" "does not call MiniMax" "README says no MiniMax call"
need "$README" "does not generate music" "README says no music"
need "$HANDOFF" "No live call" "HANDOFF says no live call"
need "$READINESS" "No MiniMax call" "READINESS says no MiniMax call"

# 7. no secret / raw data leak in the new code
reject "$BYOK" "Authorization:[[:space:]]*Bearer" "byok.ts contains no Bearer auth code"
reject "$BYOK" "rawProviderResponse" "byok.ts does not log rawProviderResponse"
reject "$BYOK" "apiKey.*=.*['\"]" "byok.ts does not hardcode an apiKey string"
reject "$BYOK" "TURNSTILE_SECRET_KEY" "byok.ts does not embed TURNSTILE_SECRET_KEY"

# 8. final口径
need "$README" "BYOK-H3B-POST-CONSUME-HARDENING" "README includes final口径 title"
need "$HANDOFF" "BYOK-H3B-POST-CONSUME-HARDENING" "HANDOFF includes final口径 title"
need "$READINESS" "BYOK-H3B-POST-CONSUME-HARDENING" "READINESS includes final口径 title"

echo
echo "BYOK_H3B_POST_CONSUME_HARDENING_SMOKE_PASS  pass=$pass"
exit 0

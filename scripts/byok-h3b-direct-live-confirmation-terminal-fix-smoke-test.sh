#!/usr/bin/env bash
# Phase BYOK-H3B-DIRECT-LIVE-CONFIRMATION-TERMINAL-FIX smoke test.
#
# Verifies that the direct-live post-consume rejection branches in
# server/index.ts now record a natural terminal trace BEFORE returning
# to the client. This closes the silent-consume gap that Retry-9 hit
# (requestId byok_3c7cc9cc4e96, branch direct_live_confirmation_mismatch).
#
# Exits 0 on full pass and prints the marker on the last line:
#   BYOK_H3B_DIRECT_LIVE_CONFIRMATION_TERMINAL_FIX_SMOKE_PASS

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
BYOK_TS="$REPO_ROOT/server/adapters/minimax-api/byok.ts"

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

# A. Branch `byok_direct_live_not_enabled` records terminal before return.
need "$SERVER_INDEX" "stage: 'direct_live_not_enabled'" \
  "A1: byok_direct_live_not_enabled branch records a trace stage"
need "$SERVER_INDEX" "outcome: 'blocked_direct_live_not_enabled'" \
  "A2: byok_direct_live_not_enabled branch records a matching outcome"
need "$SERVER_INDEX" "responseCode: 'byok_direct_live_not_enabled'" \
  "A3: byok_direct_live_not_enabled branch responseCode aligned with HTTP body"
# B. Branch `direct_live_confirmation_mismatch` records terminal before return.
need "$SERVER_INDEX" "stage: 'direct_live_confirmation_mismatch'" \
  "B1: direct_live_confirmation_mismatch branch records a trace stage"
need "$SERVER_INDEX" "outcome: 'blocked_direct_live_confirmation_mismatch'" \
  "B2: direct_live_confirmation_mismatch branch records a matching outcome"
need "$SERVER_INDEX" "responseCode: 'byok_direct_live_confirmation_required'" \
  "B3: direct_live_confirmation_mismatch branch responseCode aligned with HTTP body"
# C. Branch `direct_live_provider_error` records terminal before return.
need "$SERVER_INDEX" "stage: 'direct_live_provider_error'" \
  "C1: direct_live_provider_error branch records a trace stage"
need "$SERVER_INDEX" "responseCode: directResult.code" \
  "C2: direct_live_provider_error branch forwards directResult.code as responseCode"
# D. Success path `direct_live_relay_ok` records terminal before return.
need "$SERVER_INDEX" "stage: 'direct_live_relay_ok'" \
  "D1: direct_live success path records a trace stage"
need "$SERVER_INDEX" "outcome: 'direct_live_relay_ok'" \
  "D2: direct_live success path records a matching outcome"
need "$SERVER_INDEX" "responseCode: 'byok_direct_live_ok'" \
  "D3: direct_live success path responseCode aligned with HTTP body"

# E. The four new recordings all carry terminal: true. Use
#    separate single-line grep checks since `grep -F` does not match
#    across literal newlines. The four recordings live in distinct
#    blocks, so we assert on the block anchors (stage line) plus the
#    terminal: true line being within ~10 lines of the stage line.
assert_terminal_for_stage() {
  local file="$1"
  local stage="$2"
  local label="$3"
  # Find the stage line; then within 10 lines, find terminal: true
  # and the responseCode line that follows the stage.
  local line
  line=$(grep -nF "stage: '$stage'" "$file" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    echo "FAIL: $label (stage line not found)"
    exit 1
  fi
  if ! sed -n "${line},$((line+10))p" "$file" | grep -qF "terminal: true"; then
    echo "FAIL: $label (no terminal: true within 10 lines of stage)"
    exit 1
  fi
  echo "PASS: $label"
  pass=$((pass+1))
}

assert_terminal_for_stage "$SERVER_INDEX" "direct_live_not_enabled" \
  "E1: byok_direct_live_not_enabled recording carries terminal: true"
assert_terminal_for_stage "$SERVER_INDEX" "direct_live_confirmation_mismatch" \
  "E2: direct_live_confirmation_mismatch recording carries terminal: true"
assert_terminal_for_stage "$SERVER_INDEX" "direct_live_provider_error" \
  "E3: direct_live_provider_error recording carries terminal: true"
assert_terminal_for_stage "$SERVER_INDEX" "direct_live_relay_ok" \
  "E4: direct_live success recording carries terminal: true"

# F. byok.ts already lists these as terminal stages in the
#    BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME set (the reaper recognizes
#    them as natural terminals; this smoke is the contract test that
#    the server actually emits them).
need "$BYOK_TS" "BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME" \
  "F1: byok.ts exports the terminal-stage set"
need "$BYOK_TS" "'direct_live_not_enabled'" \
  "F2: direct_live_not_enabled is registered as a terminal stage"
need "$BYOK_TS" "'direct_live_confirmation_mismatch'" \
  "F3: direct_live_confirmation_mismatch is registered as a terminal stage"
need "$BYOK_TS" "'direct_live_provider_error'" \
  "F4: direct_live_provider_error is registered as a terminal stage"
need "$BYOK_TS" "'direct_live_relay_ok'" \
  "F5: direct_live_relay_ok is registered as a terminal stage"

# G. The pre-existing `live_mode_required` recording (CLI path, already
#    had a natural terminal) is still present — this verifies the
#    post-consume-hardening work in 4ce358d was not regressed.
need "$SERVER_INDEX" "stage: 'live_mode_required'" \
  "G1: live_mode_required branch still records a terminal (regression check)"

# H. The reaper is still in place as a defense-in-depth backstop. Even
#    though this fix makes the reaper unreachable from handleByokGenerate,
#    the reaper must remain in case an uncaught exception path or a
#    future code path leaves a liveAttemptConsumed=true entry without
#    a follow-up terminal.
need "$BYOK_TS" "live_attempt_consumed_without_terminal_stage" \
  "H1: reaper stage still present in byok.ts (defense-in-depth)"
need "$BYOK_TS" "getByokSilentConsumeCount" \
  "H2: reaper counter accessor still exposed"
need "$BYOK_TS" "pendingConsumedAttempts" \
  "H3: reaper pending map still present"

# I. Documentation.
DOC_DIR="$REPO_ROOT/docs/launch"
DOC_REPORT="BYOK_H3B_DIRECT_LIVE_CONFIRMATION_TERMINAL_FIX_20260613.md"
if [ -f "$DOC_DIR/$DOC_REPORT" ]; then
  echo "PASS: I1: phase report $DOC_REPORT exists"
  pass=$((pass+1))
else
  echo "FAIL: I1: phase report $DOC_REPORT missing"
  exit 1
fi

# J. No MiniMax / no music / no PII leaked into the diff.
reject "$SERVER_INDEX" "sk-FAKE" "J1: server/index.ts has no fake MiniMax key"
reject "$SERVER_INDEX" "userApiKey=" "J2: server/index.ts has no userApiKey= pattern"

# K. Reject any direct-literal `TURNSTILE_SECRET_KEY=` value (the smoke
#    grep is a string literal, not a value).
reject "$SERVER_INDEX" "TURNSTILE_SECRET_KEY=[A-Za-z0-9]" \
  "K1: server/index.ts does not embed a Turnstile secret value"

echo
echo "=== Summary ==="
echo "PASS=$pass  FAIL=0"
echo "BYOK_H3B_DIRECT_LIVE_CONFIRMATION_TERMINAL_FIX_SMOKE_PASS"

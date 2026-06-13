#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-8 smoke test.
#
# Verifies the retry-8 evidence is recorded without leaking any T1 secret,
# token, PII, or raw provider response. Asserts the silent-consume finding,
# rollback verification, and post-rollback byok_generation_disabled reply.
#
# Exits 0 only when BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_SMOKE_PASS is printed.

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

DOC="docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_20260613.md"
HEALTH_ENABLED="/tmp/h3b-live-t1-retry8-health-enabled.json"
HEALTH_AFTER="/tmp/h3b-live-t1-retry8-health-after-submit.json"
POST_ROLLBACK="/tmp/h3b-live-t1-retry8-post-rollback-byok-disabled.json"

# 1. evidence exists
need "$DOC" "h3b-20260613-t1-retry8-165539" "evidence records window id"
need "$DOC" "Asia/Shanghai" "evidence records timezone"
need "$DOC" "byok_0bf283b70815" "evidence records requestId"
need "$DOC" "live_attempt_consumed" "evidence records live_attempt_consumed stage"
need "$DOC" "terminal: false" "evidence records terminal:false for live_attempt_consumed"
need "$DOC" "liveAttemptConsumed: true" "evidence records liveAttemptConsumed=true"
need "$DOC" "Silent Consume Reproduced" "evidence includes silent-consume finding"
need "$DOC" "byok_generation_disabled" "evidence includes post-rollback byok_generation_disabled"
need "$DOC" "2026-06-13T17:11:45+08:00" "evidence records rollback timestamp"
need "$DOC" "byokLastSubmitStage\`          | \`live_attempt_blocked" "evidence records byokLastSubmitStage field"

# 2. trace fields recorded (in the saved health snapshot)
need "$HEALTH_AFTER" "byokSubmitTraceRecent" "trace recent field captured in post-submit health"
need "$HEALTH_AFTER" "byokSilentConsumeCount" "silent consume count field captured"
need "$HEALTH_AFTER" "byok_0bf283b70815" "live submit requestId captured in trace"
need "$HEALTH_AFTER" "live_attempt_consumed" "live_attempt_consumed stage captured"
need "$HEALTH_AFTER" "liveAttemptConsumed" "liveAttemptConsumed boolean captured"

# 3. rollback verified
need "$HEALTH_AFTER" "publicByokEnabled" "health exposes publicByokEnabled"
need "$POST_ROLLBACK" "byok_generation_disabled" "post-rollback reply code=byok_generation_disabled"

# 4. no leak in committed evidence / saved snapshots
reject "$DOC" "sk-FAKE-H3B-POST-ROLLBACK-VERIFY" "no fake-key literal leaked into evidence"
reject "$DOC" "TURNSTILE_SECRET_KEY=" "no turnstile secret leaked into evidence"
reject "$HEALTH_ENABLED" "TURNSTILE_SECRET_KEY" "no turnstile secret in baseline health"
reject "$HEALTH_ENABLED" "sk-" "no sk- literal in baseline health"
reject "$HEALTH_AFTER" "TURNSTILE_SECRET_KEY" "no turnstile secret in post-submit health"
reject "$HEALTH_AFTER" "sk-FAKE" "no fake-key literal in post-submit health"
reject "$POST_ROLLBACK" "TURNSTILE_SECRET_KEY" "no turnstile secret in post-rollback reply"
reject "$POST_ROLLBACK" "sk-FAKE" "no fake-key literal echoed in post-rollback reply"

# 5. final口径
need "$DOC" "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-8 attempts one controlled" "final口径 present"
need "$DOC" "does not broaden public launch" "public-launch negative statement present"

echo
echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_SMOKE_PASS  pass=$pass"
exit 0

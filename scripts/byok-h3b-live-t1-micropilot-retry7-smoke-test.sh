#!/usr/bin/env bash
# scripts/byok-h3b-live-t1-micropilot-retry7-smoke-test.sh
#
# BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-7 evidence smoke test.
# Verifies the retry-7 evidence document and the artifacts that
# must be present after the phase closes. Does not touch production
# env, does not call MiniMax, does not generate music.
#
# Exit codes:
#   0  = all assertions pass; prints BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_SMOKE_PASS
#   1  = at least one assertion failed
#
# Usage:
#   bash scripts/byok-h3b-live-t1-micropilot-retry7-smoke-test.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md"

pass=0

# Resolve the doc; if it is not at the default path, also accept
# docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_*.md (date may vary).
if [ ! -f "$DOC" ]; then
    for f in "$REPO_ROOT"/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_*.md; do
        if [ -f "$f" ]; then
            DOC="$f"
            break
        fi
    done
fi

need() {
    local needle="$1"
    local label="$2"
    if grep -Fq "$needle" "$DOC"; then
        echo "PASS: $label"
        pass=$((pass+1))
    else
        echo "FAIL: $label"
        echo "  missing: $needle"
        echo "  file:    $DOC"
        exit 1
    fi
}

if [ ! -f "$DOC" ]; then
    echo "FAIL: evidence doc not found"
    echo "  expected: $REPO_ROOT/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md"
    exit 1
fi

echo "Smoke source: $DOC"
echo "----"

# 1. evidence doc exists
echo "PASS: evidence doc exists"
pass=$((pass+1))

# 2. doc says PARTIAL_PASS_RUNTIME_CLOSED
need "PARTIAL_PASS_RUNTIME_CLOSED" "doc says PARTIAL_PASS_RUNTIME_CLOSED"

# 3. doc contains h3b-20260613-t1-retry7-125556
need "h3b-20260613-t1-retry7-125556" "doc contains window id h3b-20260613-t1-retry7-125556"

# 4. doc says T1 attempted yes
need "**T1 attempted:** yes" "doc says T1 attempted yes"

# 5. doc says submit count 6
need "**Submit count:** 6" "doc says submit count 6"

# 6. doc says one-submission rule violated
need "**T1 violated one-submission rule:** yes" "doc says one-submission rule violated"

# 7. doc contains byok_03867c9a057e
need "byok_03867c9a057e" "doc contains first requestId byok_03867c9a057e"

# 8. doc contains byok_16909b8fec4b
need "byok_16909b8fec4b" "doc contains second requestId byok_16909b8fec4b"

# 9. doc says modeCandidate=live or direct-live fix verified
need "byokLastSubmitModeCandidate=live" "doc says byokLastSubmitModeCandidate=live (direct-live fix verified)"

# 10. doc says byokSubmitsReceived 0 → 6
need "byokSubmitsReceived:** 0 → 6" "doc says byokSubmitsReceived 0 → 6"

# 11. doc says byokLiveAttemptsUsed 0 → 1
need "byokLiveAttemptsUsed:** 0 → 1" "doc says byokLiveAttemptsUsed 0 → 1"

# 12. doc says live_attempt_blocked
need "live_attempt_blocked" "doc says final stage live_attempt_blocked"

# 13. doc says blocked_live_attempt_limit
need "blocked_live_attempt_limit" "doc says final outcome blocked_live_attempt_limit"

# 14. doc says realApiAttemptsUsed 0
need "**realApiAttemptsUsed:** 0" "doc says realApiAttemptsUsed 0"

# 15. doc says generated audio count 0
need "**generated audio count:** 0" "doc says generated audio count 0"

# 16. doc says rollback verified
need "**Rollback verified:** yes" "doc says rollback verified"

# 17. doc says byok_generation_disabled verified
need "byok_generation_disabled" "doc says byok_generation_disabled verified"

# 18. doc says no MiniMax call observed
need "**Provider result:** no MiniMax call observed" "doc says no MiniMax call observed"

# 19. doc says silent consume follow-up required
need "BYOK-H3B-SILENT-CONSUME-FOLLOWUP" "doc requires BYOK-H3B-SILENT-CONSUME-FOLLOWUP"

# 20. doc says no T2–T5
need "**T2–T5:** not executed" "doc says no T2–T5"

echo "----"
echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_SMOKE_PASS"
echo "  total_pass=$pass"

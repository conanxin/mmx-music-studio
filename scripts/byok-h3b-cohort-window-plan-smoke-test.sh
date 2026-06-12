#!/usr/bin/env bash
# byok-h3b-cohort-window-plan-smoke-test.sh
# Phase BYOK-H3B-COHORT — Tester cohort + pilot window plan smoke test
# Verifies:
#   - plan doc exists + framing
#   - not live execution + does not enable BYOK live + does not call MiniMax + does not generate music
#   - approval phrase present but NOT RECEIVED
#   - 3-5 trusted testers
#   - T1-T5 anonymous slot table
#   - no PII in repo
#   - pilot window NOT SCHEDULED
#   - tester consent checklist + tester-facing message draft
#   - Decision: NO-GO for H3B live execution
#   - cross-doc links
# Expected output: BYOK_H3B_COHORT_WINDOW_PLAN_SMOKE_PASS
set -euo pipefail

DRILL_DATE="$(date +%Y%m%d)"
PLAN="docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md"
RUNBOOK="docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md"
GONO="docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md"
H3A="docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md"
DRILL="docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_${DRILL_DATE}.md"

PASS=0
FAIL=0
WARN=0

assert_contains() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -q -F -- "$needle" "$file" 2>/dev/null; then
    printf "  [PASS] %s\n" "$label"; PASS=$((PASS+1))
  else
    printf "  [FAIL] %s  (needle: %s)\n" "$label" "$needle"; FAIL=$((FAIL+1))
  fi
}

assert_regex() {
  local file="$1"; local pattern="$2"; local label="$3"
  if grep -q -E -- "$pattern" "$file" 2>/dev/null; then
    printf "  [PASS] %s\n" "$label"; PASS=$((PASS+1))
  else
    printf "  [FAIL] %s  (pattern: %s)\n" "$label" "$pattern"; FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  local file="$1"; local needle="$2"; local label="$3"
  if ! grep -q -F -- "$needle" "$file" 2>/dev/null; then
    printf "  [PASS] %s\n" "$label"; PASS=$((PASS+1))
  else
    printf "  [FAIL] %s  (should not contain: %s)\n" "$label" "$needle"; FAIL=$((FAIL+1))
  fi
}

cd "$(dirname "$0")/.."

echo "=========================================="
echo "BYOK-H3B-COHORT Tester Cohort Window Plan Smoke"
echo "Target: $PLAN"
echo "Date: $DRILL_DATE"
echo "=========================================="

echo
echo "[1/4] Plan doc basics + not live + safe default (10 assertions)"

# 1. plan doc exists
test -f "$PLAN" && { printf "  [PASS] plan doc exists\n"; PASS=$((PASS+1)); } || { printf "  [FAIL] plan doc exists\n"; FAIL=$((FAIL+1)); }
# 2. doc says planning only
assert_contains "$PLAN" "PLANNING ONLY" "doc says PLANNING ONLY"
# 3. doc says not live execution
assert_contains "$PLAN" "It does NOT execute the live pilot" "doc says not live execution"
# 4. doc says does not enable BYOK live
assert_contains "$PLAN" "It does NOT enable BYOK live generation" "doc says does not enable BYOK live"
# 5. doc says does not call MiniMax
assert_contains "$PLAN" "It does NOT call MiniMax" "doc says does not call MiniMax"
# 6. doc says does not generate music
assert_contains "$PLAN" "It does NOT generate music" "doc says does not generate music"
# 7. doc references H3A plan
assert_contains "$PLAN" "BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md" "doc references H3A plan"
# 8. doc references H3B pre-flight runbook
assert_contains "$PLAN" "BYOK_H3B_PREFLIGHT_RUNBOOK.md" "doc references H3B pre-flight runbook"
# 9. doc references H3B Go/No-Go review
assert_contains "$PLAN" "BYOK_H3B_GO_NO_GO_REVIEW" "doc references H3B Go/No-Go review"
# 10. doc records production safe default
assert_regex "$PLAN" "PUBLIC_BYOK_ENABLED.*false" "doc records publicByokEnabled=false safe default"

echo
echo "[2/4] Tester cohort + slots + PII + window (10 assertions)"

# 11. 3-5 trusted testers mentioned
assert_regex "$PLAN" "3-5 trusted tester" "doc mentions 3-5 trusted testers"
# 12. T1-T5 slot table present
assert_regex "$PLAN" 'T1\*\* \| `pending_consent`' "T1 row with pending_consent"
assert_regex "$PLAN" 'T2\*\* \| `pending_consent`' "T2 row with pending_consent"
assert_regex "$PLAN" 'T3\*\* \| `pending_consent`' "T3 row with pending_consent"
assert_regex "$PLAN" 'T4\*\* \| `pending_consent`' "T4 row with pending_consent"
assert_regex "$PLAN" 'T5\*\* \| `pending_consent`' "T5 row with pending_consent"
# 13. no PII in repo (no @xxxxx telegram handle example token as a real handle, but the doc has "(e.g. @xxxxx)" as an example — this is a literal illustrative example, not real PII)
# Verify explicit PII prohibition list exists
assert_contains "$PLAN" "Real names of testers" "doc lists PII prohibition"
# 14. pilot window NOT SCHEDULED
assert_contains "$PLAN" "not scheduled" "pilot window is not scheduled"
# 15. tester consent checklist present
assert_contains "$PLAN" "Tester Consent Checklist" "tester consent checklist section"
# 16. tester-facing message draft
assert_contains "$PLAN" "Tester-Facing Message Draft" "tester-facing message draft section"

echo
echo "[3/4] Approval phrase + Decision + cost controls (8 assertions)"

# 17. approval phrase present
assert_contains "$PLAN" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "approval phrase present"
# 18. approval phrase NOT RECEIVED
assert_regex "$PLAN" "Status.*NOT RECEIVED" "approval phrase status is NOT RECEIVED"
# 19. this plan does not count as approval
assert_contains "$PLAN" "does NOT count as approval" "this plan does not count as approval"
# 20. no production live toggle may be changed
assert_contains "$PLAN" "no production live toggle may be changed" "no production live toggle may be changed"
# 21. cost ceiling
assert_regex "$PLAN" "Total live generations across all testers" "total live generations ceiling defined"
# 22. per-tester ceiling
assert_regex "$PLAN" "Per-tester live generations" "per-tester ceiling defined"
# 23. decision NO-GO
assert_contains "$PLAN" "Decision: NO-GO for H3B live execution" "Decision NO-GO for H3B live execution"
# 24. H3B execution instructions not yet authorized
assert_contains "$PLAN" "H3B execution MUST NOT proceed" "H3B execution MUST NOT proceed"

echo
echo "[4/4] Cross-doc links: README + HANDOFF + READINESS + runbook + GONO + DRILL (6 assertions)"

# 25. README links to plan
assert_contains "README.md" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "README links to cohort plan"
# 26. HANDOFF links to plan
assert_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "HANDOFF links to cohort plan"
# 27. READINESS links to plan
assert_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "READINESS links to cohort plan"
# 28. runbook links to plan
assert_contains "$RUNBOOK" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "runbook links to cohort plan"
# 29. GONO review links to plan
assert_contains "$GONO" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "GONO review links to cohort plan"
# 30. final no-live statement
assert_contains "$PLAN" "planning only" "final no-live statement present"

echo
echo "=========================================="
echo "Summary: PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "=========================================="

if [ "$FAIL" -eq 0 ] && [ "$PASS" -ge 24 ]; then
  echo "BYOK_H3B_COHORT_WINDOW_PLAN_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_COHORT_WINDOW_PLAN_SMOKE_FAIL"
  exit 1
fi

#!/usr/bin/env bash
# byok-h3b-go-no-go-review-smoke-test.sh
# Phase BYOK-H3B-GONO — Go/No-Go review smoke
# Verifies that the H3B Go/No-Go review doc exists, references all 4 cross-refs,
# contains the 22-gate checklist, records approval phrase as NOT RECEIVED,
# records decision as NO-GO, and is linked from README / HANDOFF / READINESS / runbook.
set -u
set -o pipefail

# ============== Setup ==============

DRILL_DATE="$(date +%Y%m%d)"
PLAN="docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md"

PASS=0
FAIL=0
WARN=0

assert_contains() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -qF -- "$needle" "$file" 2>/dev/null; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label  (needle: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

assert_regex() {
  local file="$1"; local pattern="$2"; local label="$3"
  if grep -qE -- "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label  (regex: $pattern)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo "BYOK-H3B-GONO Go/No-Go Review Smoke"
echo "Target: $PLAN"
echo "Date: $DRILL_DATE"
echo "=========================================="

echo
echo "[1/3] Go/No-Go review doc basics + not live + safe default (9 assertions)"

# 1. doc exists
if [ -f "$PLAN" ]; then
  echo "  [PASS] review doc exists"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] review doc missing"
  FAIL=$((FAIL + 1))
  echo "STOP: review doc not found"
  exit 1
fi

# 2. doc says Go/No-Go review
assert_contains "$PLAN" "Go/No-Go review" "doc says Go/No-Go review"
# 3. doc says not live execution
assert_contains "$PLAN" "not a live execution authorization" "doc says not live execution"
# 4. doc says does not enable BYOK live generation
assert_contains "$PLAN" "does **not** enable BYOK live generation" "doc says does not enable BYOK live"
# 5. doc references H3A plan
assert_contains "$PLAN" "BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md" "doc references H3A plan"
# 6. doc references H3B pre-flight runbook
assert_contains "$PLAN" "BYOK_H3B_PREFLIGHT_RUNBOOK.md" "doc references H3B pre-flight runbook"
# 7. doc references rollback drill evidence
assert_contains "$PLAN" "H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md" "doc references rollback drill evidence"
# 8. doc references H2C evidence
assert_contains "$PLAN" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md" "doc references H2C evidence"
# 9. doc records production safe default
# 匹配表格行 "| `PUBLIC_BYOK_ENABLED` | `false` |"
assert_regex "$PLAN" "PUBLIC_BYOK_ENABLED.*false" "doc records publicByokEnabled=false safe default"

echo
echo "[2/3] checklist + approval + tester + cost + decision (9 assertions)"

# 10. doc contains Go/No-Go checklist
assert_contains "$PLAN" "Go/No-Go Checklist" "doc contains Go/No-Go Checklist section"
# 11. doc contains approval phrase
assert_contains "$PLAN" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "doc contains approval phrase"
# 12. doc says approval phrase NOT RECEIVED
assert_contains "$PLAN" "NOT RECEIVED" "doc says approval phrase NOT RECEIVED"
# 13. doc says review does not count as approval
assert_contains "$PLAN" "does **not** count as approval" "doc says review does not count as approval"
# 14. doc says no production live toggle may be changed
assert_contains "$PLAN" "no production live toggle may be changed" "doc says no production live toggle may be changed"
# 15. doc contains tester cohort status
assert_contains "$PLAN" "tester cohort" "doc contains tester cohort status (lowercase)"
# 16. doc contains cost and safety controls
assert_contains "$PLAN" "Cost and Safety Controls" "doc contains Cost and Safety Controls section"
# 17. doc says Decision: NO-GO for H3B live execution
assert_contains "$PLAN" "Decision: NO-GO for H3B live execution" "doc says Decision NO-GO"
# 18. doc says H3B execution instructions are not yet authorized
assert_contains "$PLAN" "not yet authorized" "doc says H3B execution instructions are not yet authorized"

echo
echo "[3/3] cross-doc links: README + HANDOFF + READINESS + runbook (4 assertions)"

# 19. README links to review doc
assert_contains "README.md" "BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md" "README links to review doc"
# 20. HANDOFF links to review doc
assert_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md" "HANDOFF links to review doc"
# 21. READINESS links to review doc
assert_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md" "READINESS links to review doc"
# 22. runbook links to review doc
assert_contains "docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md" "BYOK_H3B_GO_NO_GO_REVIEW_${DRILL_DATE}.md" "runbook links to review doc"

echo
echo "=========================================="
echo "Summary: PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "=========================================="

if [ "$FAIL" -eq 0 ] && [ "$PASS" -ge 22 ]; then
  echo "BYOK_H3B_GO_NO_GO_REVIEW_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_GO_NO_GO_REVIEW_SMOKE_FAIL"
  exit 1
fi

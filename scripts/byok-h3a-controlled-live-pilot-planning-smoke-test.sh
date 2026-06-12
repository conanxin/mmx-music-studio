#!/usr/bin/env bash
# byok-h3a-controlled-live-pilot-planning-smoke-test.sh
#
# Verifies Phase BYOK-H3A: controlled live pilot PLAN exists with all required sections.
# This is PLANNING ONLY — does NOT enable or execute live generation.
# Does NOT modify production env, does NOT call MiniMax, does NOT generate music.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAN="$ROOT/docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md"

pass=0
fail=0

assert_contains() {
  local file="$1" needle="$2" label="$3"
  if grep -qF -- "$needle" "$file"; then
    pass=$((pass+1))
    echo "  PASS: $label"
  else
    fail=$((fail+1))
    echo "  FAIL: $label  (missing: $needle)"
  fi
}

if [ ! -f "$PLAN" ]; then
  echo "FATAL: H3 plan doc not found: $PLAN"
  exit 1
fi

echo "[1/6] doc exists and framing"
assert_contains "$PLAN" "Status: PLANNING ONLY" "planning-only status"
assert_contains "$PLAN" "not** a live execution authorization" "not live execution"
assert_contains "$PLAN" "not** open BYOK to a broad public audience" "not broad public launch"
assert_contains "$PLAN" "does not modify the production environment" "no env change (plaintext)"

echo "[2/6] readiness references"
assert_contains "$PLAN" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md" "links H2C evidence"
assert_contains "$PLAN" "BYOK_H2_DRY_RUN_PILOT_PLAN.md" "links H2 plan"
assert_contains "$PLAN" "H2D" "references H2D UX/copy"

echo "[3/6] approval gate and toggle matrix"
assert_contains "$PLAN" "## 4. Explicit Operator Approval Gate" "approval gate section"
assert_contains "$PLAN" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "approval phrase"
assert_contains "$PLAN" "## 5. Environment Toggle Matrix" "toggle matrix section"
assert_contains "$PLAN" "PUBLIC_BYOK_ENABLED" "toggle matrix var"
assert_contains "$PLAN" "BYOK_DRY_RUN_ONLY" "toggle matrix var"
assert_contains "$PLAN" "BYOK_DIRECT_LIVE_ENABLED" "toggle matrix var"
echo "[4/6] cost / circuit / rollback / key isolation"
assert_contains "$PLAN" "## 6. Cost Ceiling" "cost ceiling section"
assert_contains "$PLAN" "Cost ceiling" "cost ceiling word"
assert_contains "$PLAN" "## 7. Circuit Breaker" "circuit breaker section"
assert_contains "$PLAN" "## 8. Rollback Drill" "rollback drill section"
assert_contains "$PLAN" "## 9. Real API Key Isolation" "key isolation section"
assert_contains "$PLAN" "localStorage" "key isolation mentions localStorage"
assert_contains "$PLAN" "sessionStorage" "key isolation mentions sessionStorage"
assert_contains "$PLAN" "IndexedDB" "key isolation mentions IndexedDB"
assert_contains "$PLAN" "URL" "key isolation mentions URL"
echo "[5/6] provider / monitoring / tester / incident"
assert_contains "$PLAN" "## 10. Provider Call Boundary" "provider boundary section"
assert_contains "$PLAN" "No CLI path" "no CLI path"
assert_contains "$PLAN" "No site operator key fallback" "no site operator key fallback"
assert_contains "$PLAN" "MINIMAX_API_KEY" "operator key fallback mention"
assert_contains "$PLAN" "## 11. Monitoring Checklist" "monitoring section"
assert_contains "$PLAN" "## 12. Tester Instructions" "tester instructions section"
assert_contains "$PLAN" "受控 live pilot" "tester copy is in Chinese"
assert_contains "$PLAN" "## 13. Incident Response" "incident response section"
echo "[6/6] Go/No-Go + execution placeholder + final"
assert_contains "$PLAN" "## 14. Go / No-Go Checklist" "go no-go section"
assert_contains "$PLAN" "## 15. H3 Execution Placeholder" "execution placeholder section"
assert_contains "$PLAN" "H3B execution instructions will be written only after operator approval" "H3B is gated"
assert_contains "$PLAN" "This document does not enable live generation" "this doc does not enable live"
assert_contains "$PLAN" "does not enable BYOK live generation or broad public launch" "final key statement"

echo
echo "=========================================="
echo "Results: $pass pass, $fail fail"
if [ "$fail" -eq 0 ]; then
  echo "BYOK_H3A_CONTROLLED_LIVE_PILOT_PLANNING_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3A_CONTROLLED_LIVE_PILOT_PLANNING_SMOKE_FAIL"
  exit 1
fi

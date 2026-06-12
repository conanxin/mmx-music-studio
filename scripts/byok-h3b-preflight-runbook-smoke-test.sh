#!/usr/bin/env bash
# byok-h3b-preflight-runbook-smoke-test.sh
#
# Verifies that Phase BYOK-H3B-PREFLIGHT's runbook exists and contains
# all required sections. This is pre-flight ONLY — it does NOT enable or
# execute a live pilot.
#
# Required needles: 23 structural assertions + 1 final pass marker.
# Exits 0 on PASS, 1 on FAIL.

set -e

PLAN="/home/ubuntu/projects/mmx-music-studio/docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md"

if [ ! -f "$PLAN" ]; then
  echo "FAIL: H3B pre-flight runbook not found at $PLAN"
  exit 1
fi

pass=0
fail=0

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -qF -- "$needle" "$file"; then
    echo "  PASS: $label"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label (missing: $needle)"
    fail=$((fail + 1))
  fi
}

assert_not_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -qF -- "$needle" "$file"; then
    echo "  PASS: $label"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label (forbidden content present: $needle)"
    fail=$((fail + 1))
  fi
}

echo "[1/5] H3B pre-flight runbook exists and is runbook (4 assertions)"
assert_contains "$PLAN" "BYOK-H3B Pre-Flight Runbook" "H3B pre-flight runbook title"
assert_contains "$PLAN" "PRE-FLIGHT RUNBOOK ONLY" "says pre-flight runbook"
assert_contains "$PLAN" "runbook, not a live execution authorization" "says not live execution"
assert_contains "$PLAN" "broad public launch" "mentions not public launch"

echo "[2/5] approval + safe default + Go/No-Go (4 assertions)"
assert_contains "$PLAN" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "approval phrase present"
assert_contains "$PLAN" "explicit operator approval" "says approval is required"
assert_contains "$PLAN" "PUBLIC_BYOK_ENABLED" "mentions PUBLIC_BYOK_ENABLED"
assert_contains "$PLAN" "Go / No-Go Checklist" "contains Go/No-Go checklist"

echo "[3/5] cost ceiling + circuit breaker + rollback drill (5 assertions)"
assert_contains "$PLAN" "Cost Ceiling" "cost ceiling section"
assert_contains "$PLAN" "Total pilot max live generations" "cost ceiling total"
assert_contains "$PLAN" "Circuit Breaker" "circuit breaker section"
assert_contains "$PLAN" "byok_generation_disabled" "circuit breaker verification"
assert_contains "$PLAN" "Rollback Drill" "rollback drill section"

echo "[4/5] live window rules + tester + monitoring + provider (8 assertions)"
assert_contains "$PLAN" "Live Window Operating Rules" "live window rules"
assert_contains "$PLAN" "Tester Instructions" "tester instructions"
assert_contains "$PLAN" "Monitoring Commands" "monitoring commands"
assert_contains "$PLAN" "byok-turnstile-ok" "redacted monitoring marker"
assert_contains "$PLAN" "Provider Call Boundary" "provider call boundary"
assert_contains "$PLAN" "No CLI" "no CLI"
assert_contains "$PLAN" "No site operator key fallback" "no operator key fallback"
assert_contains "$PLAN" "Per-request user key only" "per-request user key only"

echo "[5/5] incident + handoff + final + no live (5 assertions)"
assert_contains "$PLAN" "Incident Response" "incident response"
assert_contains "$PLAN" "H3B Execution Handoff Placeholder" "H3B execution placeholder"
assert_contains "$PLAN" "not be used alone to execute a live pilot" "runbook cannot be used alone"
assert_contains "$PLAN" "does not enable BYOK live generation" "final no-live statement"
assert_contains "$PLAN" "broad public launch" "no broad public launch"

echo
echo "=========================================="
echo "Results: $pass pass / $fail fail"
if [ "$fail" -eq 0 ]; then
  echo "BYOK_H3B_PREFLIGHT_RUNBOOK_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_PREFLIGHT_RUNBOOK_SMOKE_FAIL"
  exit 1
fi

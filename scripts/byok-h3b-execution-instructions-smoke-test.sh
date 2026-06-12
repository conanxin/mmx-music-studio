#!/usr/bin/env bash
set -euo pipefail

DOC="docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"

pass=0

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  # try fixed-string match first; fall back to case-insensitive if not found
  if grep -Fq "$needle" "$file"; then
    echo "PASS: $label"
    pass=$((pass+1))
  elif grep -Fiq "$needle" "$file"; then
    echo "PASS: $label (case-insensitive)"
    pass=$((pass+1))
  else
    echo "FAIL: $label"
    echo "  missing: $needle"
    echo "  file: $file"
    exit 1
  fi
}

echo "[1/6] doc exists + not execution + final口径"
test -f "$DOC"
echo "PASS: execution instructions doc exists"
pass=$((pass+1))
need "$DOC" "It does not itself execute BYOK live generation" "doc says not execution itself"
need "$DOC" "It only records" "doc says only records"
need "$DOC" "BYOK-H3B-EXEC-INSTRUCTIONS writes the controlled live pilot execution instructions" "final口径"

echo "[2/6] references approval + window-lock + rollback drill"
need "$DOC" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "approval phrase"
need "$DOC" "RECEIVED" "approval received"
need "$DOC" "BYOK_H3B_WINDOW_LOCK" "window-lock doc referenced"
need "$DOC" "BYOK_H3B_TESTER_COHORT_WINDOW_PLAN" "cohort plan referenced"
need "$DOC" "H3B_DRY_RUN_ROLLBACK_DRILL" "rollback drill referenced"
need "$DOC" "BYOK_H3B_PREFLIGHT_RUNBOOK" "preflight runbook referenced"
need "$DOC" "BYOK_H3B_GO_NO_GO_REVIEW" "gono review referenced"

echo "[3/6] final pre-flight checks + window check"
need "$DOC" "Final pre-flight checks" "final pre-flight checks section"
need "$DOC" "Window still valid" "window still valid check"
need "$DOC" "current time" "current time check"
need "$DOC" "Production safe default before enabling" "safe default check"
need "$DOC" "Turnstile configured" "turnstile configured check"
need "$DOC" "Access protection checked" "access protection check"
need "$DOC" "Rollback drill evidence exists" "rollback drill evidence check"
need "$DOC" "Window-lock evidence exists" "window-lock evidence check"
need "$DOC" "T1–T5 confirmed" "T1-T5 confirmed check"
need "$DOC" "Operator online" "operator online check"

echo "[4/6] live-enabling + one-tester sequence"
need "$DOC" "Live-enabling plan" "live-enabling plan section"
need "$DOC" "PUBLIC_BYOK_ENABLED=true" "public byok true (in plan)"
need "$DOC" "BYOK_DRY_RUN_ONLY=false" "dry run false (in plan)"
need "$DOC" "BYOK_DIRECT_LIVE_ENABLED=true" "direct live true (in plan)"
need "$DOC" "BYOK_LIVE_ENABLED=true" "byok live enabled true (in plan, 2026-06-13 update)"
need "$DOC" "BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST" "byok live confirmation phrase in live-enabling drop-in"
need "$DOC" "byok_live_not_enabled" "byok live not enabled code referenced (live gate reminder)"
need "$DOC" "byok_live_confirmation_required" "byok live confirmation required code referenced (third gate reminder)"
need "$DOC" "TURNSTILE_BYOK_REQUIRED=true" "turnstile required true (in plan)"
need "$DOC" "One-tester-at-a-time sequence" "one-tester sequence section"
need "$DOC" "| T1 | Tester brings own MiniMax key" "T1 step"
need "$DOC" "| T2 | Same as T1" "T2 step"
need "$DOC" "| T3 | Same as T1" "T3 step"
need "$DOC" "T4 (optional)" "T4 optional"
need "$DOC" "T5 (optional)" "T5 optional"
need "$DOC" "own MiniMax key only" "own key rule"
need "$DOC" "key is **never** persisted" "no key persistence"
need "$DOC" "max 1–2 generations" "per-tester cap"
need "$DOC" "stop after first provider error" "stop on first provider error"

echo "[5/6] monitoring + circuit breaker + rollback + stop conditions"
need "$DOC" "Monitoring checklist" "monitoring checklist section"
need "$DOC" "request count" "request count"
need "$DOC" "live generation count" "live generation count"
need "$DOC" "generated audio count" "generated audio count"
need "$DOC" "provider success/failure" "provider success/failure"
need "$DOC" "4xx / 5xx HTTP rate" "4xx/5xx rate"
need "$DOC" "storage growth" "storage growth"
need "$DOC" "leak scan" "leak scan"
need "$DOC" "Circuit breaker" "circuit breaker section"
need "$DOC" "PUBLIC_BYOK_ENABLED=false" "circuit breaker public byok false"
need "$DOC" "BYOK_DRY_RUN_ONLY=true" "circuit breaker dry run true"
need "$DOC" "BYOK_DIRECT_LIVE_ENABLED=false" "circuit breaker direct live false"
need "$DOC" "BYOK_LIVE_ENABLED=false" "circuit breaker byok live false (2026-06-13 update)"
need "$DOC" "BYOK_LIVE_CONFIRMATION=" "circuit breaker byok live confirmation empty"
need "$DOC" "byok_generation_disabled" "verify byok_generation_disabled"
need "$DOC" "Rollback after pilot" "rollback after pilot section"
need "$DOC" "Stop conditions" "stop conditions section"
need "$DOC" "window expired" "stop: window expired"
need "$DOC" "leak indication" "stop: leak indication"
need "$DOC" "tester confusion" "stop: tester confusion"
need "$DOC" "Access protection loss" "stop: access protection loss"
need "$DOC" "cost not observable" "stop: cost not observable"

echo "[6/6] no PII + no key persistence + cross-doc links"
need "$DOC" "no PII" "no PII policy"
need "$DOC" "key is **never** persisted" "no key persistence"
need "README.md" "$DOC" "README links exec-instructions"
need "docs/DEVELOPMENT_HANDOFF.md" "$DOC" "HANDOFF links exec-instructions"
need "docs/PUBLIC_RELEASE_READINESS.md" "$DOC" "READINESS links exec-instructions"
need "docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md" "$DOC" "runbook links exec-instructions"
need "docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md" "$DOC" "GONO links exec-instructions"
need "docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md" "$DOC" "window-lock links exec-instructions"

echo "BYOK_H3B_EXECUTION_INSTRUCTIONS_SMOKE_PASS (${pass} assertions)"

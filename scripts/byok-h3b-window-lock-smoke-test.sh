#!/usr/bin/env bash
set -euo pipefail

DATE="${1:-$(TZ=Asia/Shanghai date +%Y%m%d)}"
DOC="docs/launch/BYOK_H3B_WINDOW_LOCK_${DATE}.md"

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

echo "[1/4] window-lock doc basics"
test -f "$DOC"
echo "PASS: window-lock doc exists"
pass=$((pass+1))
need "$DOC" "H3B Controlled Live Pilot Window Lock" "doc title"
need "$DOC" "not live execution" "not live execution"
need "$DOC" "does not enable BYOK live generation" "does not enable live"
need "$DOC" "does not call MiniMax" "does not call MiniMax"
need "$DOC" "does not generate music" "does not generate music"

echo "[2/4] approval, cohort, window"
need "$DOC" "CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT" "approval phrase"
need "$DOC" "Status: RECEIVED" "approval received"
need "$DOC" "| T1   | CONFIRMED" "T1 confirmed"
need "$DOC" "| T2   | CONFIRMED" "T2 confirmed"
need "$DOC" "| T3   | CONFIRMED" "T3 confirmed"
need "$DOC" "| T4   | CONFIRMED" "T4 confirmed"
need "$DOC" "| T5   | CONFIRMED" "T5 confirmed"
need "$DOC" "no PII in repo" "no PII"
need "$DOC" "Window duration          | 30 minutes" "30-minute window"
need "$DOC" "Operator online for full window | yes" "operator online"

echo "[3/4] safety and decision"
need "$DOC" "PUBLIC_BYOK_ENABLED" "public byok mention"
need "$DOC" "false" "false value"
need "$DOC" "true" "true value"
need "$DOC" "Expected future document:" "future execution doc"
need "$DOC" "BYOK_H3B_EXECUTION_INSTRUCTIONS.md" "execution instructions placeholder"
need "$DOC" "GO for authoring separate H3B execution instructions, but NOT live execution from this document alone" "decision wording"
need "$DOC" "does not modify production env" "no env modification"
need "$DOC" "does not execute a live call" "no live call"
need "$DOC" "does not commit tester PII" "no tester PII"

echo "[4/4] cross-doc links"
need "README.md" "$DOC" "README links window-lock"
need "docs/DEVELOPMENT_HANDOFF.md" "$DOC" "HANDOFF links window-lock"
need "docs/PUBLIC_RELEASE_READINESS.md" "$DOC" "READINESS links window-lock"
need "docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md" "$DOC" "runbook links window-lock"
need "docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md" "$DOC" "GONO links window-lock"
need "docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md" "$DOC" "cohort plan links window-lock"

echo "BYOK_H3B_WINDOW_LOCK_SMOKE_PASS (${pass} assertions)"

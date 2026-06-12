#!/usr/bin/env bash
# byok-h2c-final-evidence-smoke-test.sh
#
# Verifies that the H2C dry-run pilot evidence is fully documented.
# Does NOT modify production env, does NOT execute live calls,
# does NOT call MiniMax, does NOT generate music.
#
# Asserts:
#   - H2C evidence report exists at docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md
#   - Report contains the canonical PASS status string
#   - Report contains all 4 unique pilot requestIds
#   - Report contains action=byok-generate, outcome=turnstile_ok
#   - Report documents 4/4 testers PASS
#   - Report documents 0 failure-path debug during pilot
#   - Report documents 8-pattern leak audit ALL CLEAR
#   - Report documents 0 live call, 0 MiniMax, 0 music
#   - Report documents rollback completed
#   - Report documents PUBLIC_BYOK_ENABLED=false and byok_generation_disabled
#   - Report contains 3 lessons learned
#   - README, HANDOFF, READINESS, and pilot plan link to the evidence report
#
# Exit code 0 = PASS, 1 = FAIL.

set -u

PASS_COUNT=0
FAIL_COUNT=0
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Helper
assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    echo "  ❌ FAIL: $label — file not found: $file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if grep -qF -- "$needle" "$file"; then
    echo "  ✅ PASS: $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  ❌ FAIL: $label — '$needle' not found in $file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

EVIDENCE="docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md"
README="README.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
READINESS="docs/PUBLIC_RELEASE_READINESS.md"
PLAN="docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md"

echo "=== byok-h2c-final-evidence-smoke-test ==="
echo "Project root: $PROJECT_ROOT"
echo

# Section 1: evidence report exists
echo "[1/8] Evidence report exists"
assert_contains "$EVIDENCE" "H2C_DRY_RUN_PILOT_PASS_ROLLED_BACK" "PASS_ROLLED_BACK status"
echo

# Section 2: 4 requestIds
echo "[2/8] 4 unique requestIds"
for rid in \
  "byok_8d4ffa2fbe94" \
  "byok_717b3025da5a" \
  "byok_d7b73105d73c" \
  "byok_1a526bf40112"; do
  assert_contains "$EVIDENCE" "$rid" "requestId $rid"
done
echo

# Section 3: action metadata
echo "[3/8] action metadata + outcome"
assert_contains "$EVIDENCE" "action=byok-generate" "action=byok-generate"
assert_contains "$EVIDENCE" "turnstile_ok" "outcome=turnstile_ok"
echo

# Section 4: 4/4 testers PASS
echo "[4/8] 4/4 testers PASS"
assert_contains "$EVIDENCE" "4 / 4 PASS" "4 / 4 PASS"
assert_contains "$EVIDENCE" "## 4. Failure-Path Evidence" "Failure-Path Evidence section"
assert_contains "$EVIDENCE" "**Pilot window \`[byok-turnstile-debug]\` count: 0**" "Pilot-window failure-path count = 0"
echo

# Section 5: leak audit
echo "[5/8] leak audit ALL CLEAR"
assert_contains "$EVIDENCE" "ALL CLEAR" "ALL CLEAR (leak audit result)"
echo

# Section 6: live-call boundary
echo "[6/8] live-call boundary"
assert_contains "$EVIDENCE" "| BYOK live calls | 0 |" "BYOK live calls = 0"
assert_contains "$EVIDENCE" "| Music generated | 0 |" "Music generated = 0"
assert_contains "$EVIDENCE" "BYOK_DRY_RUN_ONLY=true" "BYOK_DRY_RUN_ONLY=true"
assert_contains "$EVIDENCE" "BYOK_DIRECT_LIVE_ENABLED=false" "BYOK_DIRECT_LIVE_ENABLED=false"
echo

# Section 7: rollback evidence
echo "[7/8] rollback evidence"
assert_contains "$EVIDENCE" "PUBLIC_BYOK_ENABLED=false" "rollback to PUBLIC_BYOK_ENABLED=false"
assert_contains "$EVIDENCE" "byok_generation_disabled" "byok_generation_disabled response"
assert_contains "$EVIDENCE" "Rollback" "Rollback section"
echo

# Section 8: lessons learned
echo "[8/8] lessons learned (3 lessons)"
assert_contains "$EVIDENCE" "drop-in" "systemd drop-in lesson"
assert_contains "$EVIDENCE" "Sandbox cannot" "sandbox lesson"
assert_contains "$EVIDENCE" "output_preview" "process output_preview lesson"
echo

# Cross-link check: README / HANDOFF / READINESS / PLAN link to evidence report
echo "[cross-link] README, HANDOFF, READINESS, pilot plan reference evidence report"
assert_contains "$README" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT" "README links to evidence"
assert_contains "$HANDOFF" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT" "HANDOFF links to evidence"
assert_contains "$READINESS" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT" "READINESS links to evidence"
assert_contains "$PLAN" "BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT" "PLAN links to evidence"
echo

# Final
echo "=========================================="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
echo "=========================================="
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "STATUS: BYOK_H2C_FINAL_EVIDENCE_SMOKE_FAIL"
  exit 1
fi
echo "STATUS: BYOK_H2C_FINAL_EVIDENCE_SMOKE_PASS"
exit 0

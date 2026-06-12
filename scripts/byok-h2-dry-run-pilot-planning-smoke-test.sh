#!/usr/bin/env bash
# BYOK-H2A Smoke Test
# Validates the BYOK-H2A dry-run pilot planning document and that it
# does NOT enable live generation or broad public launch.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md"

declare -i PASS=0 FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== BYOK-H2A Dry-Run Pilot Planning Smoke Test ==="

# 1. Doc exists
if [ -f "$DOC" ]; then pass "H2 plan doc exists"; else fail "H2 plan doc missing"; fi

# 2. Says dry-run pilot planning
if grep -q "dry-run pilot plan" "$DOC" 2>/dev/null; then
  pass "doc says dry-run pilot planning"
else
  fail "doc missing dry-run pilot planning"
fi

# 3. Says not live generation
if grep -qi "does not enable BYOK live generation\|not.*live generation\|no live generation" "$DOC" 2>/dev/null; then
  pass "doc says not live generation"
else
  fail "doc missing not-live-generation statement"
fi

# 4. Says not public launch
if grep -qi "no broad public launch\|not.*public launch\|no public launch" "$DOC" 2>/dev/null; then
  pass "doc says not public launch"
else
  fail "doc missing not-public-launch statement"
fi

# 5. References H1 PASS
if grep -qi "H1.*PASS\|H1 valid-token" "$DOC" 2>/dev/null; then
  pass "doc references H1 PASS"
else
  fail "doc missing H1 PASS reference"
fi

# 6. Contains environment matrix
if grep -q "environment matrix" "$DOC" 2>/dev/null; then
  pass "doc contains environment matrix"
else
  fail "doc missing environment matrix section"
fi

# 7. Contains current safe default
if grep -q "Current safe default" "$DOC" 2>/dev/null; then
  pass "doc contains current safe default"
else
  fail "doc missing current safe default row"
fi

# 8. Contains H2 dry-run toggle state
if grep -q "PUBLIC_BYOK_ENABLED" "$DOC" 2>/dev/null && grep -q "BYOK_DRY_RUN_ONLY" "$DOC" 2>/dev/null; then
  pass "doc contains H2 dry-run toggle state"
else
  fail "doc missing H2 dry-run toggle state"
fi

# 9. Says BYOK_DIRECT_LIVE_ENABLED=false (in H2 rows)
if grep -q "BYOK_DIRECT_LIVE_ENABLED.*false" "$DOC" 2>/dev/null; then
  pass "doc says BYOK_DIRECT_LIVE_ENABLED=false"
else
  fail "doc missing BYOK_DIRECT_LIVE_ENABLED=false"
fi

# 10. Contains pilot cohort
if grep -q "pilot cohort\|Pilot cohort\|Cohort" "$DOC" 2>/dev/null; then
  pass "doc contains pilot cohort section"
else
  fail "doc missing pilot cohort section"
fi

# 11. Contains tester feedback template
if grep -q "feedback template\|Tester feedback" "$DOC" 2>/dev/null; then
  pass "doc contains tester feedback template"
else
  fail "doc missing tester feedback template"
fi

# 12. Contains monitoring checklist
if grep -q "Monitoring checklist\|monitoring checklist" "$DOC" 2>/dev/null; then
  pass "doc contains monitoring checklist"
else
  fail "doc missing monitoring checklist"
fi

# 13. Contains rollback plan
if grep -q "Rollback plan\|rollback plan" "$DOC" 2>/dev/null; then
  pass "doc contains rollback plan"
else
  fail "doc missing rollback plan"
fi

# 14. Contains Go/No-Go gates for H3
if grep -qE "Go\s*/\s*No-Go|H3.*Go.*No-Go" "$DOC" 2>/dev/null; then
  pass "doc contains Go/No-Go gates for H3"
else
  fail "doc missing Go/No-Go gates for H3"
fi

# 15. Says no MiniMax call (matches English "no ... MiniMax call" or Chinese "不会调用 MiniMax")
if grep -qE "不会调用 MiniMax|no real MiniMax call|no MiniMax call|does not call.*MiniMax" "$DOC" 2>/dev/null; then
  pass "doc says no MiniMax call"
else
  fail "doc missing no-MiniMax-call statement"
fi

# 16. Says no music generation
if grep -qi "no music generation\|does not generate music\|no real music" "$DOC" 2>/dev/null; then
  pass "doc says no music generation"
else
  fail "doc missing no-music-generation statement"
fi

# 17. Says no raw key/token/secret logging
if grep -qi "no raw key\|no raw token\|redact\|no token.*log\|no secret.*log" "$DOC" 2>/dev/null; then
  pass "doc says no raw key/token/secret logging"
else
  fail "doc missing no-raw-key/token/secret statement"
fi

# 18. Recommends success-path redacted log
if grep -qi "success-path redacted log\|byok-turnstile-ok\|symmetric success-path" "$DOC" 2>/dev/null; then
  pass "doc recommends success-path redacted log"
else
  fail "doc missing success-path redacted log recommendation"
fi

# 19. Does NOT contain a real key / token / secret pattern
if grep -Eq "sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9_.-]{20,}|eyJ[A-Za-z0-9_=-]{20,}" "$DOC" 2>/dev/null; then
  fail "doc contains key-like / token pattern"
else
  pass "doc contains no real key / token pattern"
fi

# 20. Says H2 dry-run pilot is the only toggle difference (no live)
# The env matrix must show H2C row with BYOK_DIRECT_LIVE_ENABLED=false
if awk '/H2C.*dry-run pilot execution/{flag=1} flag && /BYOK_DIRECT_LIVE_ENABLED/{print; exit}' "$DOC" 2>/dev/null | grep -q "false"; then
  pass "H2C env row keeps BYOK_DIRECT_LIVE_ENABLED=false"
else
  fail "H2C env row missing BYOK_DIRECT_LIVE_ENABLED=false"
fi

# 21. Pilot cohort is 3-5 testers
if grep -qE "3.{0,2}5.{0,10}(trusted testers|testers|cohort)" "$DOC" 2>/dev/null; then
  pass "pilot cohort is 3-5 testers"
else
  fail "pilot cohort size not 3-5"
fi

# 22. Rollback sets PUBLIC_BYOK_ENABLED=false
# Find the rollback section (between "## 11. Rollback plan" and "## 12. Go")
RB_START=$(grep -n "^## 11\." "$DOC" 2>/dev/null | head -1 | cut -d: -f1)
RB_END=$(grep -n "^## 12\." "$DOC" 2>/dev/null | head -1 | cut -d: -f1)
if [ -n "$RB_START" ] && [ -n "$RB_END" ] && [ "$RB_START" -lt "$RB_END" ]; then
  RB_SECTION=$(sed -n "${RB_START},${RB_END}p" "$DOC")
  if echo "$RB_SECTION" | grep -q 'PUBLIC_BYOK_ENABLED=false'; then
    pass "rollback plan restores PUBLIC_BYOK_ENABLED=false"
  else
    fail "rollback plan does not restore PUBLIC_BYOK_ENABLED=false"
  fi
else
  fail "could not locate rollback section"
fi

# 23. H3 is gated on explicit operator approval
if grep -qi "explicit operator approval" "$DOC" 2>/dev/null; then
  pass "H3 gated on explicit operator approval"
else
  fail "H3 missing explicit operator approval gate"
fi

# 24. Doc contains Chinese tester instructions
if grep -qE "费用由你自己的 MiniMax 账户承担" "$DOC" 2>/dev/null; then
  pass "doc contains Chinese tester instructions"
else
  fail "doc missing Chinese tester instructions"
fi

# 25. H2A wordings do not claim "BYOK is now live"
# Check for bare positive claims. Quoted anti-claims like "Forbids drift into 'BYOK is now live'"
# are canonical wording and must NOT be flagged.
if grep -E "BYOK is now live|BYOK is live" "$DOC" 2>/dev/null \
   | grep -vE "['\"].*BYOK is now live.*['\"]|drift into" >/dev/null; then
  fail "doc contains bare claim that BYOK is now live"
else
  pass "doc does not claim BYOK is now live (any references are negated/canonical-wording)"
fi

# --- Summary ---
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Results: $PASS passed, $FAIL failed"
  echo "BYOK_H2_DRY_RUN_PILOT_PLANNING_SMOKE_PASS"
  exit 0
else
  echo "Results: $PASS passed, $FAIL failed"
  echo "BYOK_H2_DRY_RUN_PILOT_PLANNING_SMOKE_FAIL"
  exit 1
fi

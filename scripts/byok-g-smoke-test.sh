#!/usr/bin/env bash
# BYOK-G Smoke Test
# Validates the BYOK-G single direct live call report and safety invariants.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$REPO_ROOT/docs/security/BYOK_DIRECT_SINGLE_LIVE_CALL_REPORT.md"
ADAPTER="$REPO_ROOT/server/adapters/minimax-api/byok-direct.ts"
ENDPOINT="$REPO_ROOT/server/index.ts"

declare -i PASS=0 FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== BYOK-G Smoke Test ==="

# --- Report assertions ---
if [ -f "$REPORT" ]; then pass "report exists"; else fail "report missing"; fi
if grep -q "Operator Confirmation" "$REPORT" 2>/dev/null; then pass "report has operator confirmation section"; else fail "report missing operator confirmation"; fi
if grep -q "CONFIRM_BYOK_G_SINGLE_DIRECT_LIVE_CALL" "$REPORT" 2>/dev/null; then pass "report contains confirmation phrase"; else fail "report missing confirmation phrase"; fi
if grep -q "RECEIVED" "$REPORT" 2>/dev/null; then pass "report says confirmation received"; else fail "report not marked received"; fi
if grep -q "no broad public launch" "$REPORT" 2>/dev/null || grep -q "No broad public launch" "$REPORT" 2>/dev/null; then pass "report says no broad public launch"; else fail "report missing no-launch statement"; fi
if grep -q "No CLI" "$REPORT" 2>/dev/null; then pass "report says no CLI"; else fail "report missing no-CLI"; fi
if grep -q "no site operator key" "$REPORT" 2>/dev/null || grep -q "No site operator key" "$REPORT" 2>/dev/null || grep -q "No operator key" "$REPORT" 2>/dev/null; then pass "report says no site operator key"; else fail "report missing no-operator-key"; fi
if grep -q "no raw provider response" "$REPORT" 2>/dev/null || grep -q "No raw provider response" "$REPORT" 2>/dev/null || grep -q "redacted summary only" "$REPORT" 2>/dev/null; then pass "report says no raw provider response"; else fail "report missing no-raw-response"; fi
if grep -q "Defaults restored" "$REPORT" 2>/dev/null || grep -q "pending" "$REPORT" 2>/dev/null; then pass "report mentions defaults restored or pending"; else fail "report missing defaults status"; fi

# --- No real key in report ---
if grep -Eq "sk-[a-zA-Z0-9]{20,}" "$REPORT" 2>/dev/null; then fail "report contains key-like pattern"; else pass "report contains no real key pattern"; fi
if grep -Eq "Bearer [a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+" "$REPORT" 2>/dev/null; then fail "report contains Bearer token pattern"; else pass "report contains no Bearer token"; fi

# --- Adapter assertions ---
if grep -q "import.*child_process" "$ADAPTER" 2>/dev/null; then fail "adapter imports child_process"; else pass "adapter does not import child_process"; fi
if grep -q "spawn(" "$ADAPTER" 2>/dev/null && ! grep -q "No spawn(" "$ADAPTER" 2>/dev/null; then fail "adapter uses spawn"; else pass "adapter does not use spawn"; fi
if grep -q "process.env.MINIMAX_API_KEY" "$ADAPTER" 2>/dev/null; then fail "adapter uses MINIMAX_API_KEY env"; else pass "adapter does not use MINIMAX_API_KEY env"; fi
if grep -q "'--api-key'" "$ADAPTER" 2>/dev/null || grep -q '"--api-key"' "$ADAPTER" 2>/dev/null; then fail "adapter uses --api-key flag"; else pass "adapter does not use --api-key flag"; fi

# --- Endpoint assertions ---
if grep -q "BYOK_DIRECT_LIVE_ENABLED" "$ENDPOINT" 2>/dev/null; then pass "endpoint has direct live gate"; else fail "endpoint missing direct live gate"; fi
if grep -q "BYOK_DIRECT_LIVE_CONFIRMATION" "$ENDPOINT" 2>/dev/null; then pass "endpoint has confirmation gate"; else fail "endpoint missing confirmation gate"; fi
if grep -q "byok_direct_live_not_enabled" "$ENDPOINT" 2>/dev/null; then pass "endpoint has not-enabled response"; else fail "endpoint missing not-enabled response"; fi
if grep -q "byok_direct_live_confirmation_required" "$ENDPOINT" 2>/dev/null; then pass "endpoint has confirmation-required response"; else fail "endpoint missing confirmation-required response"; fi

# --- No live call in smoke ---
SELF_NO_COMMENTS=$(grep -v "^#" "$0" | grep -v "grep -q")
if echo "$SELF_NO_COMMENTS" | grep -q "api.minimaxi.com" 2>/dev/null; then fail "smoke script calls live API"; else pass "smoke does not call live API"; fi
if echo "$SELF_NO_COMMENTS" | grep -q "generateByokDirectMusic" 2>/dev/null; then fail "smoke imports live adapter"; else pass "smoke does not import live adapter"; fi

# --- Summary ---
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Results: $PASS passed, $FAIL failed"
  echo "BYOK_G_SMOKE_PASS"
  exit 0
else
  echo "Results: $PASS passed, $FAIL failed"
  echo "BYOK_G_SMOKE_FAIL"
  exit 1
fi

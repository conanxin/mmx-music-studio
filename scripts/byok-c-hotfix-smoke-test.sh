#!/usr/bin/env bash
# scripts/byok-c-hotfix-smoke-test.sh
#
# Phase BYOK-C-Hotfix: Verify BYOK live path is fail-closed after CLI key
# fallback bug discovery.
#
# This smoke does NOT call any live endpoint, does NOT use real keys, and does
# NOT generate music.
#
set -euo pipefail

SELF="${BASH_SOURCE[0]}"
REPORT="docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md"
DESIGN="docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md"
ADAPTER="server/adapters/minimax-api/byok.ts"
INDEX="server/index.ts"
BYOK_PANEL="src/features/studio/ByokPanel.tsx"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; ((PASS++)) || true; }
fail() { echo "  ❌ $1"; ((FAIL++)) || true; }

assert_file_contains() {
  local file="$1" pattern="$2" msg="$3"
  if [ -f "$file" ] && grep -qF "$pattern" "$file"; then
    pass "$msg"
  else
    fail "$msg (file=$file, pattern=$pattern)"
  fi
}

assert_file_absent() {
  local file="$1" pattern="$2" msg="$3"
  # Strip our own assertion lines to avoid self-match
  local hits
  hits=$(grep -nF "$pattern" "$file" 2>/dev/null | grep -vE '^[0-9]+:[[:space:]]*assert_file_absent' | grep -vE '^[0-9]+:[[:space:]]*if.*grep.*-qF' | grep -vE '^[0-9]+:[[:space:]]*hits=' | grep -vE '^[0-9]+:[[:space:]]*"' || true)
  if [ -z "$hits" ]; then
    pass "$msg"
  else
    fail "$msg (hits: $(echo "$hits" | head -3))"
  fi
}

echo "=== BYOK-C-Hotfix Smoke ==="

# 1. Report doc contains bug
assert_file_contains "$REPORT" "CLI key fallback bug" "report contains CLI key fallback bug"
assert_file_contains "$REPORT" "byok_live_provider_path_disabled" "report mentions disabled code"
assert_file_contains "$REPORT" "mmx CLI" "report mentions mmx CLI"
assert_file_contains "$REPORT" "config.json" "report mentions config.json"
assert_file_contains "$REPORT" "operator key" "report mentions operator key"
assert_file_contains "$REPORT" "env injection" "report mentions env injection"
assert_file_contains "$REPORT" "direct HTTPS API call" "report mentions future fix"

# 2. Design doc contains known issue
assert_file_contains "$DESIGN" "Known issue / Superseded" "design doc contains known issue header"
assert_file_contains "$DESIGN" "CLI env-injection live path" "design doc mentions unsafe path"
assert_file_contains "$DESIGN" "direct HTTPS call" "design doc mentions future path"

# 3. Adapter contains fail-closed code
assert_file_contains "$ADAPTER" "byok_live_provider_path_disabled" "adapter returns disabled code"
assert_file_contains "$ADAPTER" "CRITICAL BUG (2026-06-11)" "adapter documents bug"
assert_file_contains "$ADAPTER" "mmx CLI ignores MINIMAX_API_KEY" "adapter documents root cause"

# 4. Adapter does NOT use env injection for user key
assert_file_absent "$ADAPTER" "MINIMAX_API_KEY: input.apiKey" "adapter does not env-inject user key"
assert_file_absent "$ADAPTER" "'--api-key'" "adapter does not use --api-key flag"
assert_file_absent "$ADAPTER" "spawn('mmx'" "adapter does not spawn mmx for live"

# 5. runMmxChild removed
assert_file_absent "$ADAPTER" "function runMmxChild" "runMmxChild function removed"
assert_file_absent "$ADAPTER" "spawn('mmx'" "no mmx spawn in adapter"

# 6. spawn import removed
assert_file_absent "$ADAPTER" "import { spawn }" "spawn import removed from adapter"

# 7. Fake mode still available
assert_file_contains "$ADAPTER" "byok_fake_relay_ok" "fake mode code still present"
assert_file_contains "$ADAPTER" "input.mode === 'fake'" "fake mode branch still present"

# 8. Endpoint still has all safe modes
assert_file_contains "$INDEX" "byok_generation_disabled" "disabled mode still present"
assert_file_contains "$INDEX" "byok_dry_run_only" "dry-run mode still present"
assert_file_contains "$INDEX" "handleByokGenerate" "endpoint handler still present"

# 9. UI still handles safe modes
assert_file_contains "$BYOK_PANEL" "byok_generation_disabled" "UI handles disabled"
assert_file_contains "$BYOK_PANEL" "byok_dry_run_only" "UI handles dry-run"
assert_file_contains "$BYOK_PANEL" "byok_fake_relay_ok" "UI handles fake"

# 10. No real key material in docs
for f in "$REPORT" "$DESIGN"; do
  if grep -qE 'sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}' "$f" 2>/dev/null; then
    fail "no real key in $(basename $f)"
  else
    pass "no real key in $(basename $f)"
  fi
done

# 11. No localStorage key persistence
if grep -qE "localStorage.*apiKey|localStorage.*key|localStorage.*setItem" "$BYOK_PANEL" 2>/dev/null | grep -v "//.*localStorage"; then
  fail "no localStorage key write"
else
  pass "no localStorage key write"
fi

# Summary
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_C_HOTFIX_SMOKE_PASS ($PASS/$((PASS+FAIL)))"
  exit 0
else
  echo "BYOK_C_HOTFIX_SMOKE_FAIL ($PASS passed, $FAIL failed)"
  exit 1
fi

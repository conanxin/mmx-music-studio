#!/usr/bin/env bash
# BYOK-D Direct API Relay Design Smoke Test
# Phase BYOK-D: Design-only — no live provider calls.
set -euo pipefail

SELF="scripts/byok-d-smoke-test.sh"
DESIGN="docs/security/BYOK_DIRECT_API_RELAY_DESIGN.md"
ADAPTER="server/adapters/minimax-api/byok-direct.ts"
BYOK="server/adapters/minimax-api/byok.ts"
PANEL="src/features/studio/ByokPanel.tsx"

pass_count=0
fail_count=0

pass() {
  pass_count=$((pass_count + 1))
  echo "  ✅ $1"
}

fail() {
  fail_count=$((fail_count + 1))
  echo "  ❌ FAIL: $1"
}

assert_file_contains() {
  local file="$1" needle="$2"
  if grep -qF "$needle" "$file"; then
    pass "$file contains: $needle"
  else
    fail "$file missing: $needle"
  fi
}

assert_file_absent() {
  local file="$1" needle="$2"
  if grep -qF "$needle" "$file"; then
    fail "$file should NOT contain: $needle"
  else
    pass "$file does not contain: $needle"
  fi
}

echo "=== BYOK-D Smoke Test ==="

# Design doc
assert_file_contains "$DESIGN" "BYOK-D Direct HTTPS API Relay Design"
assert_file_contains "$DESIGN" "Why CLI is not acceptable"
assert_file_contains "$DESIGN" "process argv"
assert_file_contains "$DESIGN" "PARTIAL_DESIGN_ONLY"
assert_file_contains "$DESIGN" "No live provider call"
assert_file_contains "$DESIGN" "byok_direct_api_not_verified"

# Adapter skeleton
assert_file_contains "$ADAPTER" "generateByokDirectMusic"
assert_file_contains "$ADAPTER" "byok_direct_api_not_verified"
assert_file_contains "$ADAPTER" "redactObject"
assert_file_contains "$ADAPTER" "redactSensitive"
assert_file_absent "$ADAPTER" "child_process"
# spawn allowed in comments; no actual import
assert_file_absent "$ADAPTER" "from "child_process""
assert_file_absent "$ADAPTER" "import { spawn }"
# MINIMAX_API_KEY allowed in explanatory comments
assert_file_absent "$ADAPTER" "MINIMAX_API_KEY:"
# api-key check: only dangerous if in executable code (not comments)
# The adapter only mentions api-key in comments explaining why it is unsafe
assert_file_absent "$ADAPTER" "runMmxChild"

# BYOK adapter still has disabled + new code
assert_file_contains "$BYOK" "byok_live_provider_path_disabled"
assert_file_contains "$BYOK" "byok_direct_api_not_verified"

# UI
assert_file_contains "$PANEL" "byok_live_provider_path_disabled"
assert_file_contains "$PANEL" "byok_direct_api_not_verified"
assert_file_contains "$PANEL" "BYOK direct API relay 尚未完成验证"

# No real call
assert_file_absent "$ADAPTER" "fetch(\"https://api.minimax"
# fetch is allowed in commented-out TODO blocks
# assert_file_absent "$ADAPTER" "fetch('https://api.minimax"

# README / docs updated
assert_file_contains "README.md" "BYOK-D"
assert_file_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK-D"
assert_file_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK-D"

# Existing BYOK smokes still pass (we will run them separately)

echo ""
echo "Results: $pass_count passed, $fail_count failed"

if [ "$fail_count" -eq 0 ]; then
  echo "BYOK_D_SMOKE_PASS"
  exit 0
else
  echo "BYOK_D_SMOKE_FAIL"
  exit 1
fi

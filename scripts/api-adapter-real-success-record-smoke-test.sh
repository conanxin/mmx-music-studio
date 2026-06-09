#!/usr/bin/env bash
# scripts/api-adapter-real-success-record-smoke-test.sh
# Phase API-Debug-D: Verify API Adapter real success is documented and not regressed
# Does NOT call /api/generate, does NOT read .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS=0
FAIL=0

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  # Check full file content so header + status on separate lines still matches
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAIL: $label — pattern not found in $file"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Phase API-Debug-D: API Adapter Real Success Record Smoke Test ==="
echo ""

# 1. Real call report exists
echo "[1] Real call report exists"
REPORT="$PROJECT_ROOT/docs/API_DEBUG_C_REAL_CALL_REPORT.md"
if [ -f "$REPORT" ]; then
  echo "  ✓ docs/API_DEBUG_C_REAL_CALL_REPORT.md exists"
  PASS=$((PASS+1))
else
  echo "  ✗ FAIL: docs/API_DEBUG_C_REAL_CALL_REPORT.md not found"
  FAIL=$((FAIL+1))
fi

# 2. Report contains job id
assert_contains "$REPORT" "job_1780992991977_c9eaaa0c" "Report contains real job ID"

# 3. Report contains track id
assert_contains "$REPORT" "track_1780993112817_yg4g4m" "Report contains real track ID"

# 4. Report contains direct_audio
assert_contains "$REPORT" "direct_audio" "Report identifies response kind as direct_audio"

# 5. Report contains minimax-api generation source
assert_contains "$REPORT" "minimax-api" "Report shows generation source minimax-api"

# 6. Report confirms key safety: only in Web UI
assert_contains "$REPORT" "Web UI" "Report confirms Web UI key entry"
assert_contains "$REPORT" "in-memory" "Report confirms in-memory key storage"

# 7. Report confirms no key in logs
assert_contains "$REPORT" "not printed in server logs\|no Bearer\|未出现在" "Report confirms no key in logs"

# 8. Report confirms audio endpoint success
assert_contains "$REPORT" "200 OK" "Report confirms audio endpoint 200 OK"

# 9. API Adapter debug report updated
echo ""
echo "[2] API Adapter debug report updated"
ADAPTER_REPORT="$PROJECT_ROOT/docs/API_ADAPTER_DEBUG_REPORT.md"
assert_contains "$ADAPTER_REPORT" "completed one controlled real generation\|job_1780992991977_c9eaaa0c" "API Adapter report mentions Phase API-Debug-C success"

# 10. README status updated
echo ""
echo "[3] README API Adapter status"
README="$PROJECT_ROOT/README.md"
assert_contains "$README" "API Adapter.*BYOK.*PASS\|direct_audio\|一次真实 BYOK" "README reflects API Adapter real success"
assert_contains "$README" "CLI.*recommended\|推荐主链路\|default path" "README still shows CLI as recommended path"

# 11. BYOK_MODE.md updated
echo ""
echo "[4] BYOK_MODE.md updated"
BYOK_MODE="$PROJECT_ROOT/docs/BYOK_MODE.md"
assert_contains "$BYOK_MODE" "Phase API-Debug-C" "BYOK_MODE.md mentions real success record"
assert_contains "$BYOK_MODE" "experimental\|not claimed.*production\|实验" "BYOK_MODE.md still marks as experimental"

# 12. BYOK_REAL_TEST_PLAN.md updated
echo ""
echo "[5] BYOK_REAL_TEST_PLAN.md updated"
TEST_PLAN="$PROJECT_ROOT/docs/BYOK_REAL_TEST_PLAN.md"
assert_contains "$TEST_PLAN" "Phase API-Debug-C 结果记录\|job_1780992991977_c9eaaa0c\|direct_audio" "Test plan reflects API-Debug-C completion"

# 13. DEVELOPMENT_HANDOFF.md updated
echo ""
echo "[6] DEVELOPMENT_HANDOFF.md updated"
HANDOFF="$PROJECT_ROOT/docs/DEVELOPMENT_HANDOFF.md"
assert_contains "$HANDOFF" "Phase API-Debug-C.*COMPLETE\|API-Debug-C.*✅" "Handoff reflects API-Debug-C completion"

# 14. No .env reading — check script does not read dotenv files
echo ""
echo "[7] Script does not read .env"
SCRIPT_CONTENT="$(cat "$SCRIPT_DIR/api-adapter-real-success-record-smoke-test.sh")"
# Flag if script contains patterns that read dotenv files (but not the grep pattern used for testing)
if echo "$SCRIPT_CONTENT" | grep -qE "^\s*(source|\.\.)[ \"']*\.env[\"']|export[ \"']*\w+=\$\(cat[ \"']*\.env"; then
  echo "  ✗ FAIL: Script contains .env sourcing pattern"
  FAIL=$((FAIL+1))
else
  echo "  ✓ No .env sourcing pattern"
  PASS=$((PASS+1))
fi

# 15. CHANGELOG.md exists and has entry
echo ""
echo "[8] CHANGELOG.md has entry"
if [ -f "$PROJECT_ROOT/CHANGELOG.md" ]; then
  echo "  ✓ CHANGELOG.md exists"
  PASS=$((PASS+1))
  if grep -q "API-Debug-C\|BYOK\|direct_audio\|API Adapter" "$PROJECT_ROOT/CHANGELOG.md" 2>/dev/null; then
    echo "  ✓ CHANGELOG.md mentions API-Debug-C / BYOK"
    PASS=$((PASS+1))
  else
    echo "  ! WARNING: CHANGELOG.md does not mention API-Debug-C / BYOK (optional)"
  fi
else
  echo "  ! WARNING: CHANGELOG.md not found (optional)"
fi

echo ""
echo "============================================================"
if [ $FAIL -gt 0 ]; then
  echo "  FAIL: $FAIL    PASS: $PASS"
  echo "============================================================"
  echo "API_ADAPTER_REAL_SUCCESS_RECORD_SMOKE_FAIL"
  exit 1
else
  echo "  PASS: $PASS    FAIL: $FAIL"
  echo "============================================================"
  echo "API_ADAPTER_REAL_SUCCESS_RECORD_SMOKE_PASS"
  exit 0
fi
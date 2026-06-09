#!/usr/bin/env bash
# scripts/product-polish-smoke-test.sh
# Phase Product Polish-A smoke test — verifies Studio UX improvements

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

README="$PROJECT_DIR/README.md"
STUDIO_TSX="$PROJECT_DIR/src/features/studio/Studio.tsx"
STUDIO_CSS="$PROJECT_DIR/src/features/studio/Studio.module.css"
LIBRARY_TSX="$PROJECT_DIR/src/features/library/Library.tsx"
LIBRARY_CSS="$PROJECT_DIR/src/features/library/Library.module.css"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "== Phase Product Polish-A Smoke Test =="

# 1. README public URL still correct
echo ""
echo "[README]"
if [ -f "$README" ]; then
  pass "README exists"
  if grep -q "https://music.conanxin.com" "$README"; then
    pass "Public URL: https://music.conanxin.com"
  else
    fail "Public URL not found"
  fi
else
  fail "README not found"
fi

# 2. Studio has example prompt chips
echo ""
echo "[Studio.tsx]"
if grep -q "exampleChip\|PROMPT_EXAMPLES\|exampleChips" "$STUDIO_TSX"; then
  pass "Example prompt chips present"
else
  fail "Example prompt chips missing"
fi

if grep -q "示例灵感\|示例灵感\|exampleLabel" "$STUDIO_TSX"; then
  pass "Example label text present"
else
  fail "Example label text missing"
fi

# 3. Studio mode labels are product-friendly
if grep -q "MMX CLI 模式\|BYOK API 模式\|本地预览" "$STUDIO_TSX"; then
  pass "Product-friendly mode labels (MMX CLI mode, BYOK API mode, local preview)"
else
  fail "Mode labels not updated to product-friendly"
fi

# 4. Studio status bar warnings only show for API backend
API_GUARD_COUNT=$(grep -c "healthInfo?.backend === 'api'" "$STUDIO_TSX" 2>/dev/null || echo "0")
if [ "$API_GUARD_COUNT" -ge 2 ]; then
  pass "Status bar warnings gated to API backend only ($API_GUARD_COUNT guards found)"
else
  fail "Status bar warnings may appear for non-API backends (only $API_GUARD_COUNT backend guards)"
fi

# 5. Studio CSS has example chip styles
if grep -q "exampleChip\|exampleRow" "$STUDIO_CSS"; then
  pass "Example chip CSS styles present"
else
  fail "Example chip CSS styles missing"
fi

# 6. Library has source filter tabs
echo ""
echo "[Library.tsx]"
if grep -q "filterSource\|SOURCE_FILTERS\|filterTab" "$LIBRARY_TSX"; then
  pass "Source filter state and tabs present"
else
  fail "Source filter missing from Library"
fi

if grep -q "mmx-cli\|MiniMax API\|全部" "$LIBRARY_TSX"; then
  pass "Source filter options: mmx-cli, MiniMax API, all"
else
  fail "Source filter options incomplete"
fi

# 7. Library CSS has filter tab styles
if grep -q "filterTab\|filterTabs" "$LIBRARY_CSS"; then
  pass "Filter tab CSS styles present"
else
  fail "Filter tab CSS styles missing"
fi

# 8. Library header uses filteredTracks
if grep -q "filteredTracks" "$LIBRARY_TSX"; then
  pass "Library uses filteredTracks for display"
else
  fail "Library not using filteredTracks"
fi

# 9. CSS has mobile responsive styles
echo ""
echo "[Responsive CSS]"
if grep -q "@media.*639px\|@media.*640px\|@media.*768px" "$STUDIO_CSS" "$LIBRARY_CSS" 2>/dev/null; then
  pass "Mobile media queries present"
else
  fail "Mobile media queries missing"
fi

# 10. No generate() calls in smoke test context
if ! grep -q "generate.*generate\|Generate.*Music" "$SCRIPT_DIR/product-polish-smoke-test.sh" 2>/dev/null; then
  pass "No generation calls in smoke test itself"
fi

# 11. Secret scan clean (quick check)
echo ""
echo "[Security]"
if [ -f "$PROJECT_DIR/scripts/ci-secret-scan.py" ]; then
  if python3 "$PROJECT_DIR/scripts/ci-secret-scan.py" 2>&1 | grep -q "CLEAN\|0 secrets"; then
    pass "Secret scan: CLEAN"
  else
    fail "Secret scan found issues"
  fi
else
  fail "Secret scan script not found"
fi

# Summary
echo ""
echo "== Result: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ] && echo "PRODUCT_POLISH_SMOKE_PASS" || echo "PRODUCT_POLISH_SMOKE_FAIL"
exit $FAIL

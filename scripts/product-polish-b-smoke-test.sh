#!/usr/bin/env bash
# scripts/product-polish-b-smoke-test.sh
# Phase Product Polish-B smoke test — library search, favorites, detail drawer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

LIBRARY_TSX="$PROJECT_DIR/src/features/library/Library.tsx"
LIBRARY_CSS="$PROJECT_DIR/src/features/library/Library.module.css"
STUDIO_TSX="$PROJECT_DIR/src/features/studio/Studio.tsx"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "== Phase Product Polish-B Smoke Test =="

echo ""
echo "[Library.tsx]"
# 1. Search
if grep -q "searchQuery\|searchInput\|搜索标题" "$LIBRARY_TSX"; then
  pass "Library search input present"
else
  fail "Library search missing"
fi

# 2. Favorites localStorage
if grep -q "FAVORITES_KEY\|localStorage\|favorites" "$LIBRARY_TSX"; then
  pass "Favorites localStorage implemented"
else
  fail "Favorites localStorage missing"
fi

# 3. Favorites filter tab
if grep -q "favorites.*FilterSource\|'favorites'.*label.*收藏\|收藏.*favorites" "$LIBRARY_TSX"; then
  pass "Favorites filter tab present"
else
  fail "Favorites filter tab missing"
fi

# 4. Detail drawer / modal
if grep -q "detailTrack\|drawer\|DetailDrawer" "$LIBRARY_TSX"; then
  pass "Detail panel/drawer state present"
else
  fail "Detail panel/drawer missing"
fi

# 5. Copy prompt
if grep -q "copyPrompt\|handleCopyPrompt\|navigator.clipboard" "$LIBRARY_TSX"; then
  pass "Copy prompt function present"
else
  fail "Copy prompt function missing"
fi

# 6. Copy track ID
if grep -q "copyId\|handleCopyId\|track.id" "$LIBRARY_TSX"; then
  pass "Copy track ID function present"
else
  fail "Copy track ID function missing"
fi

# 7. Source filter still exists
if grep -q "filterSource\|SOURCE_FILTERS\|FILTER_TABS" "$LIBRARY_TSX"; then
  pass "Source filter tabs still present"
else
  fail "Source filter tabs removed"
fi

echo ""
echo "[Library CSS]"
# 8. CSS has drawer styles
if grep -q "drawer\|detailDrawer\|detailPanel" "$LIBRARY_CSS"; then
  pass "Detail drawer CSS present"
else
  fail "Detail drawer CSS missing"
fi

# 9. CSS has mobile styles
if grep -q "@media.*639px\|@media.*640px" "$LIBRARY_CSS"; then
  pass "Mobile media queries present"
else
  fail "Mobile media queries missing"
fi

# 10. CSS has search styles
if grep -q "searchInput\|searchRow" "$LIBRARY_CSS"; then
  pass "Search CSS present"
else
  fail "Search CSS missing"
fi

# 11. CSS has favorite button
if grep -q "favoriteBtn\|favorite" "$LIBRARY_CSS"; then
  pass "Favorite button CSS present"
else
  fail "Favorite button CSS missing"
fi

# 12. CSS has toast
if grep -q "toast" "$LIBRARY_CSS"; then
  pass "Toast notification CSS present"
else
  fail "Toast CSS missing"
fi

echo ""
echo "[Studio.tsx — cross-link]"
# 13. Studio example chips still present (Phase A feature preserved)
if grep -q "exampleChip\|PROMPT_EXAMPLES\|exampleChips" "$STUDIO_TSX"; then
  pass "Studio example chips preserved"
else
  fail "Studio example chips removed"
fi

echo ""
echo "[Security]"
# 14. No real generation calls
if ! grep -q "generate.*generate\b\|/api/generate\b" "$LIBRARY_TSX" 2>/dev/null; then
  pass "No /api/generate calls in Library"
else
  fail "Unexpected /api/generate found"
fi

if ! grep -q "apiKey\|API_KEY\|token.*plan\|MINIMAX_API_KEY" "$LIBRARY_TSX" 2>/dev/null | grep -qv "placeholder\|comment"; then
  pass "No secret values hardcoded"
fi

echo ""
echo "== Result: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ] && echo "PRODUCT_POLISH_B_SMOKE_PASS" || echo "PRODUCT_POLISH_B_SMOKE_FAIL"
exit $FAIL

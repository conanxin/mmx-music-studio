#!/usr/bin/env bash
# scripts/product-polish-g-smoke-test.sh
# Phase Product Polish-G: Global mini player smoke test
# Does NOT call /api/generate, does NOT generate music
set -e

PASS=0
FAIL=0

assert_contains() {
  local file=$1
  local pattern=$2
  local desc=$3
  if grep -Fq "$pattern" "$file" 2>/dev/null; then
    echo "  ✓ $desc"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAIL: $desc"
    echo "    Expected to find: $pattern"
    FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  local file=$1
  local pattern=$2
  local desc=$3
  if grep -Fq "$pattern" "$file" 2>/dev/null; then
    echo "  ✗ FAIL: $desc"
    echo "    Found forbidden: $pattern"
    FAIL=$((FAIL+1))
  else
    echo "  ✓ $desc"
    PASS=$((PASS+1))
  fi
}

echo "=== Phase Product Polish-G: Global Mini Player Smoke Test ==="
echo ""

# 1. globalPlayerTrack type file exists
if [ -f "src/lib/globalPlayerTrack.ts" ]; then
  echo "  ✓ src/lib/globalPlayerTrack.ts exists"
  PASS=$((PASS+1))
else
  echo "  ✗ FAIL: src/lib/globalPlayerTrack.ts missing"
  FAIL=$((FAIL+1))
fi

# 2. GlobalPlayerTrack type is defined
assert_contains "src/lib/globalPlayerTrack.ts" "export interface GlobalPlayerTrack" "GlobalPlayerTrack type exported"

# 3. App.tsx has currentPlayingTrack state
assert_contains "src/App.tsx" "currentPlayingTrack" "App.tsx has currentPlayingTrack state"

# 4. App.tsx has setter
assert_contains "src/App.tsx" "setCurrentPlayingTrack" "App.tsx has setCurrentPlayingTrack setter"

# 5. Layout receives currentPlayingTrack
assert_contains "src/components/Layout.tsx" "currentPlayingTrack" "Layout receives currentPlayingTrack prop"

# 6. Layout receives onSetPlayingTrack
assert_contains "src/components/Layout.tsx" "onSetPlayingTrack" "Layout receives onSetPlayingTrack prop"

# 7. "当前播放" label in layout
assert_contains "src/components/Layout.tsx" "当前播放" "Layout has '当前播放' label"

# 8. "查看作品库" link
assert_contains "src/components/Layout.tsx" "查看作品库" "Layout has '查看作品库' link"

# 9. Download button
assert_contains "src/components/Layout.tsx" "globalMiniPlayerDownload" "Layout has download button"

# 10. Library receives onSetPlayingTrack
assert_contains "src/features/library/Library.tsx" "onSetPlayingTrack" "Library receives onSetPlayingTrack prop"

# 11. Library has itemToGlobal conversion
assert_contains "src/features/library/Library.tsx" "itemToGlobal" "Library has itemToGlobal conversion function"

# 12. Library handlePlay calls onSetPlayingTrack
assert_contains "src/features/library/Library.tsx" "onSetPlayingTrack(itemToGlobal" "Library handlePlay calls onSetPlayingTrack"

# 13. Studio receives onSetPlayingTrack
assert_contains "src/features/studio/Studio.tsx" "onSetPlayingTrack" "Studio receives onSetPlayingTrack prop"

# 14. Studio generation success calls onSetPlayingTrack
assert_contains "src/features/studio/Studio.tsx" "onSetPlayingTrack(displayToGlobal" "Studio success calls onSetPlayingTrack"

# 15. CSS has fixed bottom player
assert_contains "src/components/Layout.module.css" "position: fixed" "CSS has position: fixed for mini player"

# 16. CSS has mobile media query for mini player
assert_contains "src/components/Layout.module.css" ".globalMiniPlayer" "CSS has .globalMiniPlayer class"

# 17. No /api/generate
assert_not_contains "src/components/Layout.tsx" "/api/generate" "Layout does not call /api/generate"
assert_not_contains "src/App.tsx" "/api/generate" "App.tsx does not call /api/generate"

# 18. No key/token in new files
for f in src/App.tsx src/components/Layout.tsx src/lib/globalPlayerTrack.ts; do
  assert_not_contains "$f" "sk-" "No secret key in $f"
  assert_not_contains "$f" "token" "No token string in $f"
done

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "PRODUCT_POLISH_G_SMOKE_PASS"
  exit 0
else
  echo "PRODUCT_POLISH_G_SMOKE_FAIL"
  exit 1
fi
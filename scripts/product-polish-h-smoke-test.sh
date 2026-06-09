#!/usr/bin/env bash
# scripts/product-polish-h-smoke-test.sh
# Phase Product Polish-H smoke test: playback queue and continuous playback

set -e

PASS=0
FAIL=0

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qF "$pattern" "$file"; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label — pattern not found: $pattern"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -qF "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $label — not found (good)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label — forbidden pattern found: $pattern"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Product Polish-H Smoke Test ==="

# 1. GlobalPlaybackQueue type exists
echo "[1] Type definitions"
assert_contains src/lib/globalPlayerTrack.ts "GlobalPlaybackQueue" "GlobalPlaybackQueue interface exists"
assert_contains src/lib/globalPlayerTrack.ts "currentIndex: number" "currentIndex field in GlobalPlaybackQueue"
assert_contains src/lib/globalPlayerTrack.ts "sourceLabel?: string" "sourceLabel field in GlobalPlaybackQueue"

# 2. App has queue state
echo "[2] App queue state"
assert_contains src/App.tsx "playbackQueue" "playbackQueue state in App"
assert_contains src/App.tsx "playbackIndex" "playbackIndex state in App"
assert_contains src/App.tsx "playNextTrack" "playNextTrack function in App"
assert_contains src/App.tsx "playPreviousTrack" "playPreviousTrack function in App"
assert_contains src/App.tsx "addToQueue" "addToQueue function in App"
assert_contains src/App.tsx "playQueue" "playQueue function in App"

# 3. Layout has prev/next buttons
echo "[3] GlobalMiniPlayer prev/next"
assert_contains src/components/Layout.tsx "onPlayPrevious" "onPlayPrevious prop in Layout"
assert_contains src/components/Layout.tsx "onPlayNext" "onPlayNext prop in Layout"
assert_contains src/components/Layout.tsx "globalMiniPlayerPrev" "Prev button CSS class in Layout"
assert_contains src/components/Layout.tsx "globalMiniPlayerNext" "Next button CSS class in Layout"

# 4. Layout has queue panel
echo "[4] Queue panel"
assert_contains src/components/Layout.tsx "isQueueOpen" "isQueueOpen state in Layout"
assert_contains src/components/Layout.tsx "queuePanel" "queuePanel in Layout"
assert_contains src/components/Layout.tsx "globalMiniPlayerQueue" "Queue toggle button in Layout"
assert_contains src/components/Layout.tsx "queueBadge" "queueBadge CSS class in Layout"
assert_contains src/components/Layout.tsx "clearQueueBtn" "clearQueueBtn CSS class in Layout"

# 5. Audio ended triggers next
echo "[5] Audio ended auto-play"
assert_contains src/components/Layout.tsx "ended" "ended event listener in Layout"
assert_contains src/components/Layout.tsx "onPlayNext" "onPlayNext called on audio ended"

# 6. Library plays filtered list
echo "[6] Library plays filtered list"
assert_contains src/features/library/Library.tsx "onPlayQueue" "onPlayQueue prop in Library"
assert_contains src/features/library/Library.tsx "播放当前列表" "Play current list button in Library"
assert_contains src/features/library/Library.tsx "filteredTracks" "filteredTracks used in queue building"
assert_contains src/features/library/Library.tsx "handlePlay" "handlePlay function in Library"

# 7. Library detail drawer has add to queue
echo "[7] Library detail drawer add-to-queue"
assert_contains src/features/library/Library.tsx "onAddToQueue" "onAddToQueue prop in Library"
assert_contains src/features/library/Library.tsx "加入队列" "Add to queue button in Library detail drawer"

# 8. Studio generates and sets track
echo "[8] Studio generation → global player"
assert_contains src/features/studio/Studio.tsx "onSetPlayingTrack" "onSetPlayingTrack in Studio"
assert_contains src/features/studio/Studio.tsx "displayToGlobal" "displayToGlobal helper in Studio"
assert_contains src/features/studio/Studio.tsx "播放当前作品" "Play current track button in Studio success card"

# 9. Mobile queue panel CSS
echo "[9] Mobile queue panel CSS"
assert_contains src/components/Layout.module.css "@media (max-width: 639px)" "639px mobile media query"
assert_contains src/components/Layout.module.css "queuePanel" "queuePanel mobile adaptation"

# 10. No forbidden patterns
echo "[10] No forbidden patterns"
assert_not_contains src/App.tsx "apiKey" "No apiKey in App.tsx"
assert_not_contains src/components/Layout.tsx "apiKey" "No apiKey in Layout.tsx"
assert_not_contains src/features/library/Library.tsx ".env" "No .env in Library.tsx"
assert_not_contains src/features/studio/Studio.tsx "MINIMAX_API_KEY" "No MINIMAX_API_KEY in Studio.tsx"

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  echo "PRODUCT_POLISH_H_SMOKE_FAIL"
  exit 1
else
  echo "PRODUCT_POLISH_H_SMOKE_PASS"
  exit 0
fi

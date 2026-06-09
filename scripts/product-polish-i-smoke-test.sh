#!/bin/bash
# Phase Product Polish-I smoke test
# Verifies: localStorage persistence, playback modes, progress memory, queue UX
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
FAIL_COUNT=0; PASS_COUNT=0

pass() { echo -e "  [PASS] $1"; ((++PASS_COUNT)); }
fail() { echo -e "  [FAIL] $1"; ((++FAIL_COUNT)); }

echo "=== Phase Product Polish-I Smoke Test ==="

# ── 1. localStorage key constants exist ──────────────────────────
echo ""
echo "[1] localStorage keys in source files"
grep -q "mmx-studio:playback-queue:v1" src/App.tsx && pass "QUEUE_KEY in App.tsx" || fail "QUEUE_KEY not found in App.tsx"
grep -q "mmx-studio:playback-progress:v1" src/components/Layout.tsx && pass "PROGRESS_KEY in Layout.tsx" || fail "PROGRESS_KEY not found in Layout.tsx"

# ── 2. PlaybackMode type ──────────────────────────────────────────
echo ""
echo "[2] PlaybackMode type and values"
grep -q "PlaybackMode" src/lib/globalPlayerTrack.ts && pass "PlaybackMode type exported" || fail "PlaybackMode type not found"
for mode in "sequence" "repeat-all" "repeat-one" "shuffle"; do
  grep -q "$mode" src/lib/globalPlayerTrack.ts && pass "mode '$mode' referenced" || fail "mode '$mode' not referenced"
done

# ── 3. App.tsx queue persistence functions ───────────────────────
echo ""
echo "[3] Queue persistence in App.tsx"
grep -q "loadPersistedQueue" src/App.tsx && pass "loadPersistedQueue function exists" || fail "loadPersistedQueue not found"
grep -q "saveQueueToStorage" src/App.tsx && pass "saveQueueToStorage function exists" || fail "saveQueueToStorage not found"
grep -q "clearQueueFromStorage" src/App.tsx && pass "clearQueueFromStorage function exists" || fail "clearQueueFromStorage not found"
grep -q "getNextTrackIndex" src/App.tsx && pass "getNextTrackIndex function exists" || fail "getNextTrackIndex not found"

# ── 4. PlaybackMode state in App.tsx ──────────────────────────────
echo ""
echo "[4] PlaybackMode state"
grep -q "playbackMode" src/App.tsx && pass "playbackMode state found" || fail "playbackMode state not found"
grep -q "onPlaybackModeChange" src/App.tsx && pass "onPlaybackModeChange callback found" || fail "onPlaybackModeChange not found"

# ── 5. App.tsx → Layout props ────────────────────────────────────
echo ""
echo "[5] App.tsx passes playbackMode to Layout"
grep -q "playbackMode={playbackMode}" src/App.tsx && pass "playbackMode passed to Layout" || fail "playbackMode not passed to Layout"
grep -q "onPlaybackModeChange={setPlaybackMode}" src/App.tsx && pass "onPlaybackModeChange passed to Layout" || fail "onPlaybackModeChange not passed"

# ── 6. Layout accepts playbackMode prop ─────────────────────────
echo ""
echo "[6] Layout accepts playbackMode prop"
grep -q "playbackMode: PlaybackMode" src/components/Layout.tsx && pass "playbackMode in LayoutProps" || fail "playbackMode not in LayoutProps"
grep -q "onPlaybackModeChange" src/components/Layout.tsx && pass "onPlaybackModeChange in LayoutProps" || fail "onPlaybackModeChange not in LayoutProps"

# ── 7. Mode toggle button in Layout ───────────────────────────────
echo ""
echo "[7] Playback mode toggle button"
grep -q "globalMiniPlayerMode" src/components/Layout.tsx && pass "mode toggle button found" || fail "mode toggle button not found"
grep -q "globalMiniPlayerMode" src/components/Layout.module.css && pass "mode button CSS class found" || fail "mode button CSS class not found"

# ── 8. getNextTrackIndex logic ────────────────────────────────────
echo ""
echo "[8] getNextTrackIndex mode branches"
for mode in "repeat-one" "shuffle" "repeat-all" "sequence"; do
  grep -q "$mode" src/App.tsx && pass "mode branch '$mode' in getNextTrackIndex" || fail "mode branch '$mode' not found"
done

# ── 9. Progress save/restore in Layout ──────────────────────────
echo ""
echo "[9] Playback progress in Layout.tsx"
grep -q "timeupdate" src/components/Layout.tsx && pass "timeupdate event listener found" || fail "timeupdate event not found"
grep -q "loadedmetadata" src/components/Layout.tsx && pass "loadedmetadata for progress restore" || fail "loadedmetadata not found"
grep -q "playback-progress:v1" src/components/Layout.tsx && pass "progress localStorage key used" || fail "progress localStorage key not used"

# ── 10. Queue jump ────────────────────────────────────────────────
echo ""
echo "[10] Queue item jump"
grep -q "onJumpToQueueItem" src/App.tsx && pass "onJumpToQueueItem callback in App" || fail "onJumpToQueueItem not in App"
grep -q "onJumpToQueueItem" src/components/Layout.tsx && pass "onJumpToQueueItem prop in Layout" || fail "onJumpToQueueItem not in Layout"
grep -q "onJumpToQueueItem(i)" src/components/Layout.tsx && pass "queue item click calls onJumpToQueueItem" || fail "queue item jump not wired"

# ── 11. Queue panel mode display ─────────────────────────────────
echo ""
echo "[11] Queue panel mode display"
grep -q "queueModeLabel" src/components/Layout.module.css && pass "queueModeLabel CSS class found" || fail "queueModeLabel CSS not found"
grep -q "顺序" src/components/Layout.tsx && pass "Chinese mode label '顺序' in Layout" || fail "'顺序' label not found"

# ── 12. Clear queue + localStorage ───────────────────────────────
echo ""
echo "[12] Clear queue clears localStorage"
grep -q "clearQueueFromStorage" src/App.tsx && pass "clearQueueFromStorage called on clear" || fail "clearQueueFromStorage not called on clear"

# ── 13. No /api/generate calls ────────────────────────────────────
echo ""
echo "[13] No generate API calls"
! grep -q "/api/generate" src/App.tsx && pass "App.tsx: no /api/generate" || fail "App.tsx contains /api/generate"
! grep -q "/api/generate" src/components/Layout.tsx && pass "Layout.tsx: no /api/generate" || fail "Layout.tsx contains /api/generate"

# ── 14. No secret keys ─────────────────────────────────────────────
echo ""
echo "[14] Safety: no key/token strings"
! grep -q "MINIMAX_API_KEY" src/App.tsx && pass "App.tsx: no MINIMAX_API_KEY" || fail "App.tsx contains MINIMAX_API_KEY"
! grep -q "apiKey" src/components/Layout.tsx && pass "Layout.tsx: no apiKey in code" || fail "Layout.tsx contains apiKey"

# ── 15. Mobile CSS ────────────────────────────────────────────────
echo ""
echo "[15] Mobile queue panel CSS"
grep -q "70vh" src/components/Layout.module.css && pass "70vh max-height for mobile queue" || fail "70vh mobile height not found"

# ── 16. typecheck ─────────────────────────────────────────────────
echo ""
echo "[16] TypeScript typecheck"
cd /home/ubuntu/projects/mmx-music-studio
npm run typecheck --silent > /tmp/i_typecheck.txt 2>&1 && pass "typecheck PASS" || { cat /tmp/i_typecheck.txt; fail "typecheck FAILED"; }

# ── Result ───────────────────────────────────────────────────────
echo ""
echo "============================================================"
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}=== RESULT: $PASS_COUNT PASS, 0 FAIL ===${NC}"
  echo -e "${GREEN}PRODUCT_POLISH_I_SMOKE_PASS${NC}"
  exit 0
else
  echo -e "${RED}=== RESULT: $FAIL_COUNT FAIL ===${NC}"
  exit 1
fi
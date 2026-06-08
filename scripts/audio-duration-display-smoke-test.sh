#!/bin/bash
# Audio Duration Display Smoke Test — Phase CLI-Web-F
# Verifies: WaveformPlayer reads metadata, no '?:??' hardcoding, duration shows "读取中" → real time

set -e

ERRORS=0

check() {
  local label="$1"
  local file="$2"
  local pattern="$3"
  if grep -q "$pattern" "$file"; then
    echo "[PASS] $label"
  else
    echo "[FAIL] $label"
    ERRORS=$((ERRORS + 1))
  fi
}

check_not() {
  local label="$1"
  local file="$2"
  local pattern="$3"
  if grep -q "$pattern" "$file"; then
    echo "[FAIL] $label — found '$pattern' (hardcoded '?:??')"
    ERRORS=$((ERRORS + 1))
  else
    echo "[PASS] $label — no '?:??' found"
  fi
}

echo "=== Audio Duration Display Smoke Test ==="

# WaveformPlayer: has loadedmetadata listener
check "WaveformPlayer has loadedmetadata listener" \
  src/components/WaveformPlayer.tsx \
  "loadedmetadata"

# WaveformPlayer: uses audio.duration in onLoadedMetadata
check "WaveformPlayer uses audio.duration in metadata handler" \
  src/components/WaveformPlayer.tsx \
  "audio.duration.*isFinite\|isFinite.*audio.duration"

# WaveformPlayer: has totalDuration state
check "WaveformPlayer has totalDuration state" \
  src/components/WaveformPlayer.tsx \
  "totalDuration.*useState\|useState.*totalDuration"

# WaveformPlayer: shows "读取中" when duration unknown and audio present
check "WaveformPlayer shows '读取中' for loading duration" \
  src/components/WaveformPlayer.tsx \
  "'读取中'"

# WaveformPlayer: NO hardcoded '?:??'
check_not "WaveformPlayer has no '?:??'" \
  src/components/WaveformPlayer.tsx \
  "?:??"

# Studio: NO hardcoded '?:??'
check_not "Studio.tsx has no '?:??'" \
  src/features/studio/Studio.tsx \
  "?:??"

# Studio: passes durationText without forcing '?:??'
check "Studio.tsx passes durationText from server" \
  src/features/studio/Studio.tsx \
  "durationText: latest.durationText\|durationText: track.durationText\|durationText: t.durationText"

# Library: NO hardcoded '?:??'
check_not "Library.tsx has no '?:??'" \
  src/features/library/Library.tsx \
  "?:??"

# Library: uses formatDuration for mock tasks (or undefined fallback)
check "Library.tsx maps duration properly" \
  src/features/library/Library.tsx \
  "formatDuration.*t.duration\|durationText.*t.durationText"

# API: /api/tracks has at least one track with audioUrl
echo ""
echo "[API Check] Fetching /api/tracks..."
RESPONSE=$(curl -s "http://127.0.0.1:8787/api/tracks" 2>/dev/null || echo "{}")
TRACK_COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tracks',[])))" 2>/dev/null || echo "0")
AUDIO_TRACKS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([t for t in d.get('tracks',[]) if t.get('audioUrl')]))" 2>/dev/null || echo "0")
if [ "$AUDIO_TRACKS" -gt 0 ]; then
  echo "[PASS] /api/tracks has $AUDIO_TRACKS track(s) with audioUrl"
else
  echo "[FAIL] /api/tracks has no tracks with audioUrl"
  ERRORS=$((ERRORS + 1))
fi

# Secret scan: no apiKey console.log
check_not "No console.log(apiKey) in WaveformPlayer" \
  src/components/WaveformPlayer.tsx \
  "console.log.*apiKey"
check_not "No console.log(apiKey) in Studio.tsx" \
  src/features/studio/Studio.tsx \
  "console.log.*apiKey"
check_not "No console.log(apiKey) in Library.tsx" \
  src/features/library/Library.tsx \
  "console.log.*apiKey"

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "=== Results: All passed ==="
  echo "AUDIO_DURATION_DISPLAY_SMOKE_PASS"
  exit 0
else
  echo "=== Results: $ERRORS failed ==="
  exit 1
fi
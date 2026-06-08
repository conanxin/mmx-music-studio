#!/bin/bash
# scripts/weapp-audio-url-smoke-test.sh
# Phase 3C: Verify server mock track audio and download URLs
# Does NOT trigger real generation

set -e
API_BASE="${API_BASE:-http://localhost:8787}"
PASS=0
FAIL=0

report() { echo "$1"; [[ "$1" == *"✅"* ]] && ((PASS++)) || true; [[ "$1" == *"❌"* ]] && ((FAIL++)) || true; }

echo "=== mmx-music-studio Audio/Download URL Smoke Test ==="
echo "API Base: $API_BASE"
echo ""

# 1. Get track list
echo "[1] GET /api/tracks — fetch tracks"
TRACKS_JSON=$(curl -s "$API_BASE/api/tracks")
COUNT=$(echo "$TRACKS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tracks',[])))" 2>/dev/null || echo "0")
if [ "$COUNT" -gt 0 ]; then
  report "  tracks count: $COUNT ✅ PASS"
else
  report "  tracks count: 0 ❌ FAIL — no tracks returned"
fi

# 2. Get first track ID
TRACK_ID=$(echo "$TRACKS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('tracks',[]); print(t[0]['id'] if t else '')" 2>/dev/null || echo "")
if [ -n "$TRACK_ID" ]; then
  report "  track ID: $TRACK_ID ✅ PASS"
else
  report "  track ID: none ❌ FAIL"
fi

# 3. Verify audioUrl field
AUDIO_URL=$(echo "$TRACKS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('tracks',[]); print(t[0].get('audioUrl','') if t else '')" 2>/dev/null || echo "")
if [ -n "$AUDIO_URL" ]; then
  report "  audioUrl field: $AUDIO_URL ✅ PASS"
else
  report "  audioUrl field: missing ❌ FAIL"
fi

# 4. Verify downloadUrl field
DL_URL=$(echo "$TRACKS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('tracks',[]); print(t[0].get('downloadUrl','') if t else '')" 2>/dev/null || echo "")
if [ -n "$DL_URL" ]; then
  report "  downloadUrl field: $DL_URL ✅ PASS"
else
  report "  downloadUrl field: missing ❌ FAIL"
fi

# 5. Test audio endpoint
if [ -n "$TRACK_ID" ]; then
  echo "[2] GET /api/tracks/$TRACK_ID/audio — audio stream"
  AUDIO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/tracks/$TRACK_ID/audio")
  if [ "$AUDIO_CODE" = "200" ] || [ "$AUDIO_CODE" = "206" ]; then
    report "  audio HTTP $AUDIO_CODE ✅ PASS"
  else
    report "  audio HTTP $AUDIO_CODE ❌ FAIL"
  fi
fi

# 6. Test download endpoint
if [ -n "$TRACK_ID" ]; then
  echo "[3] GET /api/tracks/$TRACK_ID/download — download"
  DL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/tracks/$TRACK_ID/download")
  if [ "$DL_CODE" = "200" ]; then
    report "  download HTTP $DL_CODE ✅ PASS"
  else
    report "  download HTTP $DL_CODE ❌ FAIL"
  fi
fi

# 7. Test relative URL → absolute URL conversion
echo "[4] Verify URL format"
if echo "$AUDIO_URL" | grep -q "^/api/tracks/"; then
  ABS_URL="${API_BASE}${AUDIO_URL}"
  report "  relative URL correctly formatted ✅ PASS"
  ABS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ABS_URL")
  if [ "$ABS_CODE" = "200" ] || [ "$ABS_CODE" = "206" ]; then
    report "  absolute audio URL HTTP $ABS_CODE ✅ PASS"
  else
    report "  absolute audio URL HTTP $ABS_CODE ❌ FAIL"
  fi
else
  report "  audioUrl not relative path ❌ FAIL"
fi

echo ""
echo "=== Summary: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -eq 0 ]; then
  echo "✅ All audio/download URL tests passed"
  echo "NOTE: This only verifies mock track URLs, does NOT trigger real generation"
else
  echo "❌ Some tests failed"
fi

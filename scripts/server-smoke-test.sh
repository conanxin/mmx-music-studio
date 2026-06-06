#!/bin/bash
# ─── Server Smoke Test ────────────────────────────────────────────────────────
# Verifies mock generation pipeline without real MiniMax API.
# Forces: REAL_GENERATION_ENABLED=false, MOCK_GENERATION_ENABLED=true,
#         PUBLIC_DEMO_MODE=false, MINIMAX_API_KEY=MOCK_ONLY_PRESENT_KEY
#
# Tests:
#   1. GET  /api/health
#   2. POST /api/generate → mock track
#   3. GET  /api/tracks → includes new track
#   4. GET  /api/tracks/:id/audio → 200/206, audio/wav
#   5. GET  /api/tracks/:id/download → 200, attachment
#   6. DELETE /api/tracks/:id
#   7. GET  /api/tracks → excludes deleted track
#   8. Verify no secret leakage in any response

set -euo pipefail
cd "$(dirname "$0")/.."

API_BASE="http://localhost:8787"
SERVER_PID=""
SERVER_LOG="/tmp/mmx-server-smoke.log"
SECRET_PATTERNS="MOCK_ONLY_PRESENT_KEY|Bearer|Authorization|sk-|sk_"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

start_server() {
  pkill -f "tsx server/index.ts" 2>/dev/null || true
  sleep 2
  echo "Starting server with REAL_GENERATION_ENABLED=false..."
  REAL_GENERATION_ENABLED=false \
    MOCK_GENERATION_ENABLED=true \
    PUBLIC_DEMO_MODE=false \
    MINIMAX_API_KEY=MOCK_ONLY_PRESENT_KEY \
    npm run dev:server > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  sleep 3
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  ✗ Server failed to start"
    tail -20 "$SERVER_LOG"
    exit 1
  fi
  echo "  ✓ Server started (PID $SERVER_PID)"
}

wait_health() {
  for i in $(seq 1 15); do
    if curl -sf "$API_BASE/api/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "  ✗ Server did not become ready"
  tail -20 "$SERVER_LOG"
  exit 1
}

check_no_secrets() {
  local response="$1"
  local label="$2"
  if echo "$response" | grep -Ei "$SECRET_PATTERNS" > /dev/null 2>&1; then
    echo "  ✗ Secret found in $label:"
    echo "$response" | grep -Ei "$SECRET_PATTERNS"
    exit 1
  fi
  echo "  ✓ No secrets in $label"
}

# ── Start ─────────────────────────────────────────────────────────────────────
echo "=== mmx-music-studio Server Smoke Test ==="
start_server
wait_health

# ── JSON helpers (no jq needed) ────────────────────────────────────────────────
json_get() {
  local key="$1"
  # Extract first top-level value, strip whitespace
  echo "$2" | python3 -c "
import json,sys
d=json.load(sys.stdin)
v=d.get('$key','')
sys.stdout.write(str(v))
" 2>/dev/null || echo ""
}

json_get_nested() {
  local key="$1"
  echo "$2" | python3 -c "
import json,sys
d=json.load(sys.stdin)
v=d.get('track',{}).get('$key','')
sys.stdout.write(str(v))
" 2>/dev/null || echo ""
}

# ── Test 1: GET /api/health ───────────────────────────────────────────────────
echo ""
echo "─── Test 1: GET /api/health ───"
HEALTH=$(curl -sf "$API_BASE/api/health")
echo "Response: $HEALTH"
check_no_secrets "$HEALTH" "/api/health"

if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "  ✓ ok=true"
else
  echo "  ✗ ok should be true"; exit 1
fi
if echo "$HEALTH" | grep -q '"realGenerationEnabled":false'; then
  echo "  ✓ realGenerationEnabled=false"
else
  echo "  ✗ realGenerationEnabled should be false"; exit 1
fi
if echo "$HEALTH" | grep -q '"mockGenerationEnabled":true'; then
  echo "  ✓ mockGenerationEnabled=true"
else
  echo "  ✗ mockGenerationEnabled should be true"; exit 1
fi
if echo "$HEALTH" | grep -q '"hasServerKey":true'; then
  echo "  ✓ hasServerKey=true (MOCK_ONLY_PRESENT_KEY detected)"
else
  echo "  ✗ hasServerKey should be true"; exit 1
fi

# ── Test 2: POST /api/generate ───────────────────────────────────────────────
echo ""
echo "─── Test 2: POST /api/generate ───"
GEN_RESP=$(curl -sf -X POST "$API_BASE/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "keyMode": "server",
    "input": {
      "mode": "instrumental",
      "prompt": "warm electronic ambient, late-night coding, calm, focused, no vocals"
    }
  }')
echo "Response: $GEN_RESP"
check_no_secrets "$GEN_RESP" "/api/generate response"

if echo "$GEN_RESP" | grep -q '"ok":true'; then
  echo "  ✓ ok=true"
else
  echo "  ✗ ok should be true"; exit 1
fi

TRACK_ID=$(json_get_nested "id" "$GEN_RESP")
if [ -n "$TRACK_ID" ]; then
  echo "  ✓ track.id=$TRACK_ID"
else
  echo "  ✗ track.id not found"; exit 1
fi

SOURCE=$(json_get "generationSource" "$GEN_RESP")
if [ "$SOURCE" = "mock" ]; then
  echo "  ✓ generationSource=mock"
else
  echo "  ✗ generationSource should be mock, got: $SOURCE"; exit 1
fi

AUDIO_URL=$(json_get_nested "audioUrl" "$GEN_RESP")
if [ -n "$AUDIO_URL" ]; then
  echo "  ✓ audioUrl=$AUDIO_URL"
else
  echo "  ✗ audioUrl not found"; exit 1
fi

DL_URL=$(json_get_nested "downloadUrl" "$GEN_RESP")
if [ -n "$DL_URL" ]; then
  echo "  ✓ downloadUrl=$DL_URL"
else
  echo "  ✗ downloadUrl not found"; exit 1
fi

# ── Test 3: GET /api/tracks ───────────────────────────────────────────────────
echo ""
echo "─── Test 3: GET /api/tracks ───"
TRACKS_RESP=$(curl -sf "$API_BASE/api/tracks")
echo "Response: $TRACKS_RESP"
check_no_secrets "$TRACKS_RESP" "/api/tracks response"

if echo "$TRACKS_RESP" | grep -q "\"$TRACK_ID\""; then
  echo "  ✓ Track $TRACK_ID found in list"
else
  echo "  ✗ Track $TRACK_ID not in tracks list"; exit 1
fi

# ── Test 4: GET /api/tracks/:id/audio ───────────────────────────────────────
echo ""
echo "─── Test 4: GET /api/tracks/$TRACK_ID/audio ───"
AUDIO_HEAD=$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/audio")
echo "Headers: $AUDIO_HEAD"
check_no_secrets "$AUDIO_HEAD" "audio headers"

AUDIO_STATUS=$(echo "$AUDIO_HEAD" | grep -i "^HTTP" | awk '{print $2}')
if [ "$AUDIO_STATUS" = "200" ] || [ "$AUDIO_STATUS" = "206" ]; then
  echo "  ✓ HTTP $AUDIO_STATUS"
else
  echo "  ✗ Expected 200 or 206, got: $AUDIO_STATUS"; exit 1
fi

if echo "$AUDIO_HEAD" | grep -qi "content-type: audio/wav"; then
  echo "  ✓ Content-Type: audio/wav"
elif echo "$AUDIO_HEAD" | grep -qi "content-type: audio/mpeg"; then
  echo "  ✓ Content-Type: audio/mpeg"
else
  CT=$(echo "$AUDIO_HEAD" | grep -i "content-type:" | head -1)
  echo "  ⚠ Content-Type: $CT"
fi

# ── Test 5: GET /api/tracks/:id/download ────────────────────────────────────
echo ""
echo "─── Test 5: GET /api/tracks/$TRACK_ID/download ───"
DL_HEAD=$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/download")
echo "Headers: $DL_HEAD"
check_no_secrets "$DL_HEAD" "download headers"

DL_STATUS=$(echo "$DL_HEAD" | grep -i "^HTTP" | awk '{print $2}')
if [ "$DL_STATUS" = "200" ]; then
  echo "  ✓ HTTP 200"
else
  echo "  ✗ Expected 200, got: $DL_STATUS"; exit 1
fi

if echo "$DL_HEAD" | grep -qi "attachment"; then
  echo "  ✓ Content-Disposition: attachment"
else
  echo "  ⚠ Content-Disposition header not found"
fi

# ── Test 6: DELETE /api/tracks/:id ─────────────────────────────────────────
echo ""
echo "─── Test 6: DELETE /api/tracks/$TRACK_ID ───"
DEL_RESP=$(curl -sf -X DELETE "$API_BASE/api/tracks/$TRACK_ID")
echo "Response: $DEL_RESP"
check_no_secrets "$DEL_RESP" "delete response"

if echo "$DEL_RESP" | grep -q '"ok":true'; then
  echo "  ✓ ok=true"
else
  echo "  ✗ ok should be true"; exit 1
fi
if echo "$DEL_RESP" | grep -q '"deleted":true'; then
  echo "  ✓ deleted=true"
else
  echo "  ✗ deleted should be true"; exit 1
fi

# ── Test 7: GET /api/tracks (deleted track gone) ─────────────────────────────
echo ""
echo "─── Test 7: GET /api/tracks (verify deletion) ───"
TRACKS2=$(curl -sf "$API_BASE/api/tracks")
echo "Response: $TRACKS2"
check_no_secrets "$TRACKS2" "/api/tracks after delete"

if ! echo "$TRACKS2" | grep -q "\"$TRACK_ID\""; then
  echo "  ✓ Track $TRACK_ID is gone (correctly deleted)"
else
  echo "  ✗ Track $TRACK_ID still in list after deletion"; exit 1
fi

echo ""
echo "=== All Server Smoke Tests Passed ==="
echo "  API: $API_BASE"
echo "  PID: $SERVER_PID"
echo ""

#!/bin/bash
# ─── Web API Smoke Test ───────────────────────────────────────────────────────
# Verifies the full Web → API pipeline in mock mode.
# Forces: REAL_GENERATION_ENABLED=false, MOCK_GENERATION_ENABLED=true,
#         PUBLIC_DEMO_MODE=false, MINIMAX_API_KEY=MOCK_ONLY_PRESENT_KEY
#
# Tests:
#   1. npm run build
#   2. GET  /api/health
#   3. POST /api/key/check (server mode)
#   4. POST /api/generate → mock track
#   5. GET  /api/tracks/:id/audio
#   6. GET  /api/tracks/:id/download
#   7. DELETE /api/tracks/:id
#   8. Verify no secret leakage

set -euo pipefail
cd "$(dirname "$0")/.."

API_BASE="http://localhost:8787"
SERVER_PID=""
SERVER_LOG="/tmp/mmx-webapi-smoke.log"
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
  echo "Starting API server (mock mode)..."
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
  echo "  ✗ Server did not become ready"; exit 1
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

# ── JSON helpers ──────────────────────────────────────────────────────────────
json_get() {
  local key="$1"
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

echo "=== mmx-music-studio Web API Smoke Test ==="

# ── Build ─────────────────────────────────────────────────────────────────────
echo ""
echo "─── Step 1: npm run build ───"
npm run build 2>&1 | tail -5

# ── Start server ──────────────────────────────────────────────────────────────
start_server
wait_health

# ── Test 1: GET /api/health ───────────────────────────────────────────────────
echo ""
echo "─── Test 1: GET /api/health ───"
HEALTH=$(curl -sf "$API_BASE/api/health")
echo "Response: $HEALTH"
check_no_secrets "$HEALTH" "/api/health"

# ── Test 2: POST /api/key/check ─────────────────────────────────────────────
echo ""
echo "─── Test 2: POST /api/key/check (server mode) ───"
KEY_RESP=$(curl -sf -X POST "$API_BASE/api/key/check" \
  -H "Content-Type: application/json" \
  -d '{"keyMode":"server"}')
echo "Response: $KEY_RESP"
check_no_secrets "$KEY_RESP" "/api/key/check"
if echo "$KEY_RESP" | grep -q '"ok":true'; then
  echo "  ✓ ok=true"
else
  echo "  ✗ ok should be true"; exit 1
fi

# ── Test 3: POST /api/generate ───────────────────────────────────────────────
echo ""
echo "─── Test 3: POST /api/generate ───"
GEN_RESP=$(curl -sf -X POST "$API_BASE/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "keyMode": "server",
    "input": {
      "mode": "instrumental",
      "prompt": "lo-fi hip hop, study, coffee shop, relaxed, no vocals"
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
  echo "  ✗ generationSource should be mock"; exit 1
fi

# ── Test 4: GET /api/tracks/:id/audio ───────────────────────────────────────
echo ""
echo "─── Test 4: GET /api/tracks/$TRACK_ID/audio ───"
AUDIO_HEAD=$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/audio")
AUDIO_STATUS=$(echo "$AUDIO_HEAD" | grep -i "^HTTP" | awk '{print $2}')
echo "  HTTP $AUDIO_STATUS"
check_no_secrets "$AUDIO_HEAD" "audio headers"
if [ "$AUDIO_STATUS" = "200" ] || [ "$AUDIO_STATUS" = "206" ]; then
  echo "  ✓ HTTP $AUDIO_STATUS"
else
  echo "  ✗ Expected 200 or 206"; exit 1
fi

# ── Test 5: GET /api/tracks/:id/download ─────────────────────────────────────
echo ""
echo "─── Test 5: GET /api/tracks/$TRACK_ID/download ───"
DL_HEAD=$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/download")
DL_STATUS=$(echo "$DL_HEAD" | grep -i "^HTTP" | awk '{print $2}')
echo "  HTTP $DL_STATUS"
check_no_secrets "$DL_HEAD" "download headers"
if [ "$DL_STATUS" = "200" ]; then
  echo "  ✓ HTTP 200"
else
  echo "  ✗ Expected 200"; exit 1
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

echo ""
echo "=== All Web API Smoke Tests Passed ==="
echo ""

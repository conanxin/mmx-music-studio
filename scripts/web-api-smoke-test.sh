#!/usr/bin/env bash
# Web API smoke test.
#
# Runs the normal web API in mock mode only. It never calls MiniMax,
# never calls /api/generate/byok, and never enables BYOK live gates.

set -euo pipefail

cd "$(dirname "$0")/.."

API_PORT="${API_PORT:-8787}"
API_FALLBACK_PORT="${API_FALLBACK_PORT:-18787}"
API_BASE="http://127.0.0.1:${API_PORT}"
SERVER_PID=""
SERVER_LOG="/tmp/mmx-webapi-smoke.log"
SECRET_PATTERNS="MOCK_ONLY_PRESENT_KEY|Bearer|Authorization|sk-|sk_"
TSX_BIN="./node_modules/.bin/tsx"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

port_is_free() {
  python3 - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    sock.bind(("127.0.0.1", port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
}

pick_port() {
  if port_is_free "$API_PORT"; then
    API_BASE="http://127.0.0.1:${API_PORT}"
    return
  fi

  echo "  INFO: port ${API_PORT} is busy; trying ${API_FALLBACK_PORT}"
  API_PORT="$API_FALLBACK_PORT"
  API_BASE="http://127.0.0.1:${API_PORT}"
  if ! port_is_free "$API_PORT"; then
    echo "  FAIL: fallback port ${API_PORT} is also busy"
    exit 1
  fi
}

wait_health() {
  for _ in {1..20}; do
    if curl -sf "$API_BASE/api/health" >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "  FAIL: server exited before health was ready"
      tail -40 "$SERVER_LOG" 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "  FAIL: server did not become ready at $API_BASE"
  tail -40 "$SERVER_LOG" 2>/dev/null || true
  exit 1
}

start_server() {
  pick_port
  echo "Starting API server on ${API_BASE} (mock mode)..."
  REAL_GENERATION_ENABLED=false \
    MOCK_GENERATION_ENABLED=true \
    PUBLIC_DEMO_MODE=false \
    MINIMAX_BACKEND=mock \
    MINIMAX_API_KEY=MOCK_ONLY_PRESENT_KEY \
    PUBLIC_BYOK_ENABLED=false \
    BYOK_DRY_RUN_ONLY=true \
    BYOK_LIVE_ENABLED=false \
    BYOK_DIRECT_LIVE_ENABLED=false \
    PORT="$API_PORT" \
    "$TSX_BIN" server/index.ts > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  wait_health
  echo "  PASS: server started (PID $SERVER_PID)"
}

check_no_secrets() {
  local response="$1"
  local label="$2"
  if echo "$response" | grep -Ei "$SECRET_PATTERNS" >/dev/null 2>&1; then
    echo "  FAIL: secret-like value found in $label"
    echo "$response" | grep -Ei "$SECRET_PATTERNS"
    exit 1
  fi
  echo "  PASS: no secrets in $label"
}

echo "=== mmx-music-studio Web API Smoke Test ==="

echo ""
echo "--- Step 1: npm run build ---"
npm run build >/tmp/mmx-webapi-build.out 2>&1
tail -5 /tmp/mmx-webapi-build.out

start_server

echo ""
echo "--- Test 1: GET /api/health ---"
HEALTH="$(curl -sf "$API_BASE/api/health")"
echo "Response: $HEALTH"
check_no_secrets "$HEALTH" "/api/health"
JSON_INPUT="$HEALTH" python3 - <<'PY'
import json
import os
import sys

d = json.loads(os.environ["JSON_INPUT"])
checks = {
    "realGenerationEnabled false": d.get("realGenerationEnabled") is False,
    "publicByokEnabled false": d.get("publicByokEnabled") is False,
    "byokLiveEnabled false": d.get("byokLiveEnabled") is False,
    "realApiAttemptsUsed zero": d.get("realApiAttemptsUsed", 0) == 0,
}
for label, ok in checks.items():
    print(("  PASS: " if ok else "  FAIL: ") + label)
    if not ok:
        raise SystemExit(1)
PY

echo ""
echo "--- Test 2: POST /api/key/check (server mode) ---"
KEY_RESP="$(curl -sf -X POST "$API_BASE/api/key/check" \
  -H "Content-Type: application/json" \
  -d '{"keyMode":"server"}')"
echo "Response: $KEY_RESP"
check_no_secrets "$KEY_RESP" "/api/key/check"
echo "$KEY_RESP" | grep -q '"ok":true' || {
  echo "  FAIL: key/check ok should be true"
  exit 1
}
echo "  PASS: key/check ok=true"

echo ""
echo "--- Test 3: POST /api/generate (mock mode) ---"
GEN_RESP="$(curl -sf -X POST "$API_BASE/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "keyMode": "server",
    "input": {
      "mode": "instrumental",
      "prompt": "lo-fi hip hop, study, coffee shop, relaxed, no vocals"
    }
  }')"
echo "Response: $GEN_RESP"
check_no_secrets "$GEN_RESP" "/api/generate response"
echo "$GEN_RESP" | grep -q '"ok":true' || {
  echo "  FAIL: generate ok should be true"
  exit 1
}

JOB_ID="$(echo "$GEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('id',''))" 2>/dev/null)"
TRACK_ID="$(echo "$GEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('track',{}).get('id',''))" 2>/dev/null)"

if [ -n "$JOB_ID" ]; then
  echo "  PASS: job.id=$JOB_ID"
  for i in {1..15}; do
    sleep 2
    JOB_JSON="$(curl -sf "${API_BASE}/api/jobs/${JOB_ID}")"
    JOB_STATUS="$(echo "$JOB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('status','?'))" 2>/dev/null)"
    echo "  [$i] status=$JOB_STATUS"
    case "$JOB_STATUS" in
      succeeded)
        TRACK_ID="$(echo "$JOB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('trackId',''))" 2>/dev/null)"
        break
        ;;
      failed|cancelled)
        echo "  FAIL: job ended with status=$JOB_STATUS"
        exit 1
        ;;
    esac
  done
elif [ -n "$TRACK_ID" ]; then
  echo "  PASS: track.id=$TRACK_ID"
else
  echo "  FAIL: neither job.id nor track.id found"
  exit 1
fi

if [ -z "$TRACK_ID" ]; then
  echo "  FAIL: no track id resolved"
  exit 1
fi

echo ""
echo "--- Test 4: GET /api/tracks/$TRACK_ID/audio ---"
AUDIO_HEAD="$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/audio")"
AUDIO_STATUS="$(echo "$AUDIO_HEAD" | awk 'BEGIN{IGNORECASE=1} /^HTTP/{print $2; exit}')"
check_no_secrets "$AUDIO_HEAD" "audio headers"
if [ "$AUDIO_STATUS" != "200" ] && [ "$AUDIO_STATUS" != "206" ]; then
  echo "  FAIL: expected audio HTTP 200 or 206, got $AUDIO_STATUS"
  exit 1
fi
echo "  PASS: audio HTTP $AUDIO_STATUS"

echo ""
echo "--- Test 5: GET /api/tracks/$TRACK_ID/download ---"
DL_HEAD="$(curl -sI "$API_BASE/api/tracks/$TRACK_ID/download")"
DL_STATUS="$(echo "$DL_HEAD" | awk 'BEGIN{IGNORECASE=1} /^HTTP/{print $2; exit}')"
check_no_secrets "$DL_HEAD" "download headers"
if [ "$DL_STATUS" != "200" ]; then
  echo "  FAIL: expected download HTTP 200, got $DL_STATUS"
  exit 1
fi
echo "  PASS: download HTTP 200"

echo ""
echo "--- Test 6: DELETE /api/tracks/$TRACK_ID ---"
DEL_RESP="$(curl -sf -X DELETE "$API_BASE/api/tracks/$TRACK_ID")"
echo "Response: $DEL_RESP"
check_no_secrets "$DEL_RESP" "delete response"
echo "$DEL_RESP" | grep -q '"ok":true' || {
  echo "  FAIL: delete ok should be true"
  exit 1
}
echo "  PASS: delete ok=true"

echo ""
echo "WEB_API_SMOKE_PASS"

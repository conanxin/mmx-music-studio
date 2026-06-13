#!/usr/bin/env bash
# Config smoke test for release safe defaults.
#
# This smoke reads /api/health only. It never calls /api/generate,
# /api/generate/byok, MiniMax, or any live provider path.

set -euo pipefail

cd "$(dirname "$0")/.."

API_PORT="${API_PORT:-8787}"
API_BASE="http://127.0.0.1:${API_PORT}"
SERVER_LOG="/tmp/mmx-config-smoke.log"
SERVER_PID=""
TSX_BIN="./node_modules/.bin/tsx"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_health() {
  for _ in {1..20}; do
    if curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "Server exited before health was ready"
      tail -40 "$SERVER_LOG" 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "Server did not become ready at ${API_BASE}"
  tail -40 "$SERVER_LOG" 2>/dev/null || true
  exit 1
}

assert_json() {
  local json="$1"
  local expr="$2"
  local label="$3"
  JSON_INPUT="$json" python3 - "$expr" "$label" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["JSON_INPUT"])
expr = sys.argv[1]
label = sys.argv[2]
ok = bool(eval(expr, {"__builtins__": {}}, {"d": data}))
if ok:
    print(f"  PASS: {label}")
else:
    print(f"  FAIL: {label}")
    raise SystemExit(1)
PY
}

echo "=== Config Smoke Test: release safe defaults ==="

REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
PUBLIC_DEMO_MODE=false \
MINIMAX_BACKEND=mock \
PUBLIC_BYOK_ENABLED=false \
BYOK_DRY_RUN_ONLY=true \
BYOK_LIVE_ENABLED=false \
BYOK_DIRECT_LIVE_ENABLED=false \
TURNSTILE_BYOK_REQUIRED=false \
PORT="$API_PORT" \
  "$TSX_BIN" server/index.ts > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

wait_health
HEALTH="$(curl -sf "${API_BASE}/api/health")"

assert_json "$HEALTH" "d.get('realGenerationEnabled') is False" \
  "real generation stays disabled"
assert_json "$HEALTH" "d.get('mockGenerationEnabled') is True" \
  "mock generation remains available for local checks"
assert_json "$HEALTH" "d.get('publicByokEnabled') is False" \
  "public BYOK stays disabled"
assert_json "$HEALTH" "d.get('byokLiveEnabled') is False" \
  "BYOK live stays disabled"
assert_json "$HEALTH" "d.get('byokLiveConfirmationConfigured') is False" \
  "BYOK live confirmation is not configured"
assert_json "$HEALTH" "d.get('byokLiveAttemptsUsed', 0) == 0" \
  "BYOK live attempts are unused"
assert_json "$HEALTH" "d.get('byokLiveAudioUsed', 0) == 0" \
  "BYOK live audio counter is unused"
assert_json "$HEALTH" "d.get('realApiAttemptsUsed', 0) == 0" \
  "real API attempts are unused"
assert_json "$HEALTH" "d.get('turnstileSecretKeyConfigured') is False" \
  "Turnstile secret is not configured in local safe default"

echo "CONFIG_SMOKE_SAFE_DEFAULT_PASS"

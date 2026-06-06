#!/bin/bash
# ─── Config Smoke Test ─────────────────────────────────────────────────────────
# Verifies env bool parsing logic.
# Does NOT call /api/generate in real mode.
# Does NOT use real keys.

set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="$PWD"

SERVER_LOG="/tmp/mmx-config-smoke.log"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

start_server() {
  local env_vars="$1"
  kill_server
  sleep 1
  cd "$PROJECT"
  eval "env_vars=$env_vars"  # harmless - only used with known test values
  env_vars_eval=$(eval "echo \"$env_vars\"")
  echo "Starting server with: $env_vars_eval"
  npm run dev:server > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  sleep 3
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  ✗ Server failed to start"
    cat "$SERVER_LOG"
    exit 1
  fi
}

kill_server() {
  pkill -f "tsx server/index.ts" 2>/dev/null || true
}

get_health() {
  curl -s http://localhost:8787/api/health
}

# ── Test 1: Default (no vars set) ────────────────────────────────────────────
echo ""
echo "─── Test 1: Default (all vars unset) ───"
kill_server; sleep 1
npm run dev:server > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 3
HEALTH=$(get_health)
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"realGenerationEnabled":false'; then
  echo "  ✓ realGenerationEnabled=false"
else
  echo "  ✗ realGenerationEnabled should be false"
  exit 1
fi
if echo "$HEALTH" | grep -q '"mockGenerationEnabled":true'; then
  echo "  ✓ mockGenerationEnabled=true"
else
  echo "  ✗ mockGenerationEnabled should be true"
  exit 1
fi
kill_server; sleep 1

# ── Test 2: REAL_GENERATION_ENABLED=false ─────────────────────────────────────
echo ""
echo "─── Test 2: REAL_GENERATION_ENABLED=false ───"
REAL_GENERATION_ENABLED=false MOCK_GENERATION_ENABLED=true PUBLIC_DEMO_MODE=false \
  npm run dev:server > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 3
HEALTH=$(get_health)
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"realGenerationEnabled":false'; then
  echo "  ✓ realGenerationEnabled=false"
else
  echo "  ✗ realGenerationEnabled should be false"
  exit 1
fi
kill_server; sleep 1

# ── Test 3: PUBLIC_DEMO_MODE=true + REAL_GENERATION_ENABLED=true ─────────────
echo ""
echo "─── Test 3: PUBLIC_DEMO_MODE=true + REAL_GENERATION_ENABLED=true ───"
PUBLIC_DEMO_MODE=true REAL_GENERATION_ENABLED=true MOCK_GENERATION_ENABLED=true \
  npm run dev:server > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 3
HEALTH=$(get_health)
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"realGenerationEnabled":false'; then
  echo "  ✓ realGenerationEnabled=false (PUBLIC_DEMO_MODE overrides)"
else
  echo "  ✗ realGenerationEnabled should be false when PUBLIC_DEMO_MODE=true"
  exit 1
fi
kill_server; sleep 1

# ── Test 4: REAL_GENERATION_ENABLED=true + PUBLIC_DEMO_MODE=false ───────────
echo ""
echo "─── Test 4: REAL_GENERATION_ENABLED=true + PUBLIC_DEMO_MODE=false (health only) ───"
REAL_GENERATION_ENABLED=true PUBLIC_DEMO_MODE=false MOCK_GENERATION_ENABLED=true \
  npm run dev:server > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 3
HEALTH=$(get_health)
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"realGenerationEnabled":true'; then
  echo "  ✓ realGenerationEnabled=true"
else
  echo "  ✗ realGenerationEnabled should be true"
  exit 1
fi
# Do NOT call /api/generate in this test - we don't have a real key
kill_server; sleep 1

echo ""
echo "─── All config smoke tests passed ───"
echo ""

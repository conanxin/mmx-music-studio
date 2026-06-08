#!/usr/bin/env bash
# scripts/byok-mode-smoke-test.sh — Phase 5A BYOK smoke test
# No real MiniMax API calls, no quota consumption, no real key output
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

report() {
  local msg="$1"; local ok="$2"
  echo -e "${ok}${msg}${NC}"
  if [[ "$ok" == "${GREEN}"* ]]; then ((PASS++)); else ((FAIL++)); fi
}

cleanup() { kill $PID 2>/dev/null || true; }
trap cleanup EXIT

wait_server() {
  local url="$1"; local max=20; local i=0
  while [[ $i -lt $max ]]; do
    curl -sf "$url" -o /dev/null 2>/dev/null && return 0
    sleep 1; ((i++))
  done
  return 1
}

start_server() {
  local cfg="$1"; local desc="$2"; local port="$3"
  kill $(lsof -t -i:$port 2>/dev/null) 2>/dev/null || true; sleep 1
  echo -e "\n${BLUE}[$desc]${NC} port=$port"
  env $cfg BYOK_ENABLED=true HOST=127.0.0.1 PORT=$port npx tsx server/index.ts \
    > "/tmp/byok-$port.log" 2>&1 &
  PID=$!
  wait_server "http://127.0.0.1:$port/api/health" \
    && echo -e "  ${GREEN}server up${NC}" \
    || { echo -e "  ${RED}server failed${NC}"; tail -3 "/tmp/byok-$port.log"; exit 1; }
}

do_post() {
  local port="$1"; local key="${2:-__NONE__}"
  python3 "$SCRIPT_DIR/byok_http_helper.py" "$port" "$key"
}

echo -e "${YELLOW}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Phase 5A: BYOK Mode Smoke Tests               ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════╝${NC}"

# ── Test A: Health BYOK fields ────────────────────────────────────────────────
start_server "MINIMAX_BACKEND=mock MOCK_GENERATION_ENABLED=true REAL_GENERATION_ENABLED=false SERVER_KEY_FALLBACK=false" "mock+BYOK" 8999

HEALTH=$(curl -sf "http://127.0.0.1:8999/api/health")
BYOK_EN=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('byokEnabled'))")
SVR_FB=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('serverKeyFallback'))")
BYOK_KS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('byokKeyStorage'))")
BACKEND=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('backend'))")

if [[ "$BYOK_EN" == "True" ]] && [[ "$SVR_FB" == "False" ]] && [[ "$BYOK_KS" == "memory" ]] && [[ "$BACKEND" == "mock" ]]; then
  report "A: Health BYOK fields — PASS (byokEnabled=$BYOK_EN fallback=$SVR_FB storage=$BYOK_KS backend=$BACKEND)" "$GREEN"
else
  report "A: Health BYOK fields — FAIL (byokEnabled=$BYOK_EN fallback=$SVR_FB storage=$BYOK_KS backend=$BACKEND)" "$RED"
fi

# ── Test B: Mock safety path (API backend + REAL_GENERATION=false) → no key needed ──
RESP_B=$(curl -s -X POST "http://127.0.0.1:8999/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"instrumental","prompt":"smoke test"}}')
JOB_OK_B=$(echo "$RESP_B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',False))" 2>/dev/null || echo "ERROR")
if [[ "$JOB_OK_B" == "True" ]]; then
  report "B: mock-safe path, no key → job created — PASS" "$GREEN"
else
  report "B: mock-safe path → FAIL (ok=$JOB_OK_B)" "$RED"
fi
if echo "$RESP_B" | grep -qiE "sk-[A-Za-z0-9_-]{10,}|MOCK_SERVER|Bearer|Authorization"; then
  report "B: Response must not leak secrets — FAIL" "$RED"
else
  report "B: Response does not leak secrets — PASS" "$GREEN"
fi

# ── Test C: Real API mode without BYOK key → must reject before network ──────────
kill $PID 2>/dev/null; sleep 1
start_server "MINIMAX_BACKEND=api REAL_GENERATION_ENABLED=true MOCK_GENERATION_ENABLED=false SERVER_KEY_FALLBACK=false" "real-api+noKey" 9000

RESULT_C=$(do_post 9000 "__NONE__")
HTTP_C=$(echo "$RESULT_C" | python3 -c "import sys,json; print(json.load(sys.stdin).get('http_status'))")
ERR_TYPE_C=$(echo "$RESULT_C" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_type','ok'))")
MSG_C=$(echo "$RESULT_C" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_msg','')[:50])")
if [[ "$HTTP_C" == "400" ]] && [[ "$ERR_TYPE_C" == "missing_api_key" ]]; then
  report "C: real API + no BYOK key → HTTP 400 missing_api_key ($MSG_C) — PASS" "$GREEN"
else
  report "C: real API + no BYOK key → HTTP=$HTTP_C type=$ERR_TYPE_C msg=$MSG_C — FAIL" "$RED"
fi

# ── Test D: Real API mode + too-short fake key → validation error ──────────────
RESULT_D=$(do_post 9000 "fake")
HTTP_D=$(echo "$RESULT_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('http_status'))")
ERR_TYPE_D=$(echo "$RESULT_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_type','ok'))")
if [[ "$HTTP_D" == "400" ]] && [[ "$ERR_TYPE_D" == "validation" ]]; then
  report "D: real API + short fake key → HTTP 400 validation — PASS" "$GREEN"
else
  report "D: real API + short fake key → HTTP=$HTTP_D type=$ERR_TYPE_D — FAIL" "$RED"
fi
BODY_D=$(echo "$RESULT_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('body',''))")
if echo "$BODY_D" | grep -qi "x-minimax-api-key.*fake\\|'fake'\\|fake_key\\|short.*fake"; then
  report "D: Response must not expose 'fake' key value — FAIL" "$RED"
else
  report "D: Response does not expose 'fake' key value — PASS" "$GREEN"
fi

# ── Test E: Mock mode + valid-looking fake key → job created, key not leaked ────
kill $PID 2>/dev/null; sleep 1
start_server "MINIMAX_BACKEND=api REAL_GENERATION_ENABLED=false MOCK_GENERATION_ENABLED=true SERVER_KEY_FALLBACK=false" "mock-api+fakeKey" 9001

FAKE_KEY="sk_test_local_fake_key_for_byok_1234567890"
RESP_E=$(curl -s -X POST "http://127.0.0.1:9001/api/generate" \
  -H "Content-Type: application/json" \
  -H "x-minimax-api-key: $FAKE_KEY" \
  -d '{"input":{"mode":"instrumental","prompt":"smoke test"}}')
JOB_OK_E=$(echo "$RESP_E" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',False))" 2>/dev/null || echo "ERROR")
JOB_ID_E=$(echo "$RESP_E" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('id',''))" 2>/dev/null || echo "")
if [[ "$JOB_OK_E" == "True" ]]; then
  report "E: mock-api + valid-looking fake key → job ok (id=$JOB_ID_E) — PASS" "$GREEN"
else
  report "E: mock-api + fake key → FAIL (ok=$JOB_OK_E) — FAIL" "$RED"
fi
if echo "$RESP_E" | grep -qi "sk_test_local_fake_key_for_byok_1234567890"; then
  report "E: Response must not contain fake key — FAIL" "$RED"
else
  report "E: Response does not contain fake key — PASS" "$GREEN"
fi

# ── Test F: Fallback disabled → server key must not be used ────────────────────
kill $PID 2>/dev/null; sleep 1
start_server "MINIMAX_BACKEND=api REAL_GENERATION_ENABLED=true MOCK_GENERATION_ENABLED=false SERVER_KEY_FALLBACK=false MINIMAX_API_KEY=MOCK_SERVER_KEY_SHOULD_NOT_BE_USED" "fallback-disabled" 9002

RESULT_F=$(do_post 9002 "__NONE__")
HTTP_F=$(echo "$RESULT_F" | python3 -c "import sys,json; print(json.load(sys.stdin).get('http_status'))")
ERR_TYPE_F=$(echo "$RESULT_F" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_type','ok'))")
if [[ "$HTTP_F" == "400" ]] && [[ "$ERR_TYPE_F" == "missing_api_key" ]]; then
  report "F: fallback disabled + no key → HTTP 400 missing_api_key, server key NOT used — PASS" "$GREEN"
else
  report "F: fallback disabled + no key → HTTP=$HTTP_F type=$ERR_TYPE_F — FAIL" "$RED"
fi
BODY_F=$(echo "$RESULT_F" | python3 -c "import sys,json; print(json.load(sys.stdin).get('body',''))")
if echo "$BODY_F" | grep -qi "MOCK_SERVER_KEY_SHOULD_NOT_BE_USED"; then
  report "F: Response must not contain server key — FAIL" "$RED"
else
  report "F: Response does not contain server key — PASS" "$GREEN"
fi

# ── Test G: serverKeyFallback=true in health ───────────────────────────────────
kill $PID 2>/dev/null; sleep 1
start_server "MINIMAX_BACKEND=api REAL_GENERATION_ENABLED=false SERVER_KEY_FALLBACK=true" "fallback-enabled-health" 9003
SVR_FB_G=$(curl -sf "http://127.0.0.1:9003/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('serverKeyFallback'))" 2>/dev/null)
if [[ "$SVR_FB_G" == "True" ]]; then
  report "G: health serverKeyFallback=true — PASS" "$GREEN"
else
  report "G: health serverKeyFallback=true — FAIL (got $SVR_FB_G)" "$RED"
fi

# ── Test H: Job record must not contain api key ───────────────────────────────
if [[ -n "$JOB_ID_E" ]]; then
  JOB_RESP=$(curl -sf "http://127.0.0.1:9001/api/jobs/$JOB_ID_E" 2>/dev/null || echo "{}")
  if echo "$JOB_RESP" | grep -qiE "sk-[A-Za-z0-9_-]{10,}|MOCK_SERVER|Bearer|Authorization"; then
    report "H: Job record must not contain secrets — FAIL" "$RED"
  else
    report "H: Job record does not contain secrets — PASS" "$GREEN"
  fi
else
  echo -e "  ${YELLOW}H: no job id, skipping${NC}"
fi

# ── Test I: Manifest must not contain api key ─────────────────────────────────
if [[ -n "$JOB_ID_E" ]]; then
  MANIFEST=$(curl -sf "http://127.0.0.1:9001/api/manifest/$JOB_ID_E" 2>/dev/null || echo "{}")
  if echo "$MANIFEST" | grep -qiE "sk-[A-Za-z0-9_-]{10,}|MOCK_SERVER|Bearer|Authorization"; then
    report "I: Manifest must not contain secrets — FAIL" "$RED"
  else
    report "I: Manifest does not contain secrets — PASS" "$GREEN"
  fi
else
  echo -e "  ${YELLOW}I: no job id, skipping${NC}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo -e "  PASS: ${GREEN}${PASS}${NC}   FAIL: ${RED}${FAIL}${NC}"
echo "══════════════════════════════════════════════════"
[[ "$FAIL" -eq 0 ]] && echo -e "${GREEN}BYOK_MODE_SMOKE_PASS${NC}" || echo -e "${RED}BYOK_MODE_SMOKE_FAIL${NC}"
exit $FAIL

#!/bin/bash
# scripts/weapp-api-smoke-test.sh
# 不依赖微信运行时，只测试 server mock API 是否可用
# 不含 key / token / secret

API_BASE="${API_BASE:-http://118.195.129.137:8787}"
PASS=0
FAIL=0

report() {
  case "$1" in
    pass) ((PASS++)) || true ;;
    fail) ((FAIL++)) || true ;;
  esac
}

curl_ok() {
  curl -sf "$1" > /dev/null 2>&1
}

echo "=== mmx-music-studio API Smoke Test ==="
echo "API Base: $API_BASE"
echo ""

# [1] GET /api/health
echo "[1] GET /api/health"
echo -n "  health ... "
if curl_ok "$API_BASE/api/health"; then
  echo "✅ PASS"
  report pass
else
  echo "❌ FAIL"
  report fail
fi

# [2] POST /api/generate (instrumental, mock) — needs preview access unlocked
echo ""
echo "[2] POST /api/generate (instrumental, mock)"
echo -n "  generate instrumental (unlock first) ... "

# First unlock preview access (PIN-less since PREVIEW_ACCESS_ENABLED=false)
UNLOCK_RES=$(curl -sf -X POST "$API_BASE/api/preview-access/unlock" \
  -H "Content-Type: application/json" \
  -d '{"pin":""}' 2>&1) || true

# Extract cookie if present
COOKIE=$(echo "$UNLOCK_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('')" 2>/dev/null)

GEN_RES=$(curl -sf -X POST "$API_BASE/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"instrumental","prompt":"深夜编程温暖电子氛围"},"keyMode":"server"}' \
  2>&1) || true

if echo "$GEN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') and d.get('generationSource')=='mock' else 1)" 2>/dev/null; then
  echo "✅ PASS"
  report pass
  SRC=$(echo "$GEN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('generationSource','?'))" 2>/dev/null)
  echo "  generationSource: $SRC"
else
  echo "❌ FAIL"
  report fail
  echo "  response: $(echo "$GEN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message', d.get('message', 'unknown')))" 2>/dev/null || echo 'unreachable')"
fi

# [3] GET /api/tracks
echo ""
echo "[3] GET /api/tracks"
echo -n "  list tracks ... "
TRACKS_RES=$(curl -sf "$API_BASE/api/tracks" 2>&1) || true
if echo "$TRACKS_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)" 2>/dev/null; then
  CNT=$(echo "$TRACKS_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tracks',[])))" 2>/dev/null)
  echo "✅ PASS ($CNT tracks)"
  report pass
else
  echo "❌ FAIL"
  report fail
fi

# [4] Verify mock generation source
echo ""
echo "[4] Verify mock generation source"
LATEST=$(echo "$TRACKS_RES" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  tracks=d.get('tracks',[])
  if tracks:
    t=tracks[-1]
    src=t.get('generationSource','unknown')
    print(f'  latest track source: {src}')
    if src=='mock':
      print('  ✅ generationSource=mock — safe mock mode confirmed')
    else:
      print(f'  ⚠️ unexpected source: {src}')
  else:
    print('  (no tracks yet — OK)')
except Exception as e:
  print(f'  parse error: {e}')
" 2>/dev/null || echo "  (could not parse)")
echo "$LATEST"

echo ""
echo "=== Summary: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -eq 0 ]; then
  echo "✅ All tests passed — server mock API is healthy"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi
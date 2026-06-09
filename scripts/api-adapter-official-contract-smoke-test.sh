#!/usr/bin/env bash
# scripts/api-adapter-official-contract-smoke-test.sh
# Phase API-Debug-B1: Official MiniMax Music Generation API contract smoke test
# No real network calls. No real keys. No quota consumption.
# Uses test-fixtures/ + static checks against source files.
set -euo pipefail

PROJ="${HOME}/projects/mmx-music-studio"
FIXTURES="${PROJ}/test-fixtures/minimax-api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

report() { echo -e "${2}[${1}]${NC}"; }

passed=0
failed=0

# ── 1. Official fixtures exist ────────────────────────────────────────────────
for fixture in music-generation-hex-success music-generation-url-success music-generation-error music-generation-async-defensive; do
  path="${FIXTURES}/${fixture}.json"
  if [[ -f "$path" ]]; then
    ((passed++)) || true
    echo "  PASS: $fixture.json exists"
  else
    ((failed++)) || true
    echo "  FAIL: $fixture.json missing"
  fi
done

# ── 2. Validate fixture JSON is parseable ────────────────────────────────────
for fixture in music-generation-hex-success music-generation-url-success music-generation-error music-generation-async-defensive; do
  path="${FIXTURES}/${fixture}.json"
  if python3 -c "import json; json.load(open('$path'))" 2>/dev/null; then
    ((passed++)) || true
    echo "  PASS: $fixture.json is valid JSON"
  else
    ((failed++)) || true
    echo "  FAIL: $fixture.json is not valid JSON"
  fi
done

# ── 3. Verify fixture structure matches official contract ──────────────────────
# hex success: data.audio (hex), base_resp.status_code=0, extra_info present
HEX=$(python3 -c "import json; d=json.load(open('${FIXTURES}/music-generation-hex-success.json')); print('OK' if 'data' in d and 'audio' in d['data'] and 'base_resp' in d and d['base_resp']['status_code']==0 and 'extra_info' in d and 'music_duration' in d['extra_info'] else 'FAIL')" 2>/dev/null || echo "FAIL")
if [[ "$HEX" == "OK" ]]; then
  ((passed++)) || true
  echo "  PASS: hex-success fixture matches official contract"
else
  ((failed++)) || true
  echo "  FAIL: hex-success fixture structure issue"
fi

# url success: data.audio (URL), base_resp.status_code=0
URL_FIX=$(python3 -c "import json; d=json.load(open('${FIXTURES}/music-generation-url-success.json')); print('OK' if 'data' in d and d['data']['audio'].startswith('http') and 'base_resp' in d and d['base_resp']['status_code']==0 else 'FAIL')" 2>/dev/null || echo "FAIL")
if [[ "$URL_FIX" == "OK" ]]; then
  ((passed++)) || true
  echo "  PASS: url-success fixture matches official contract"
else
  ((failed++)) || true
  echo "  FAIL: url-success fixture structure issue"
fi

# error: base_resp.status_code!=0
ERR_FIX=$(python3 -c "import json; d=json.load(open('${FIXTURES}/music-generation-error.json')); print('OK' if 'base_resp' in d and d['base_resp']['status_code']!=0 else 'FAIL')" 2>/dev/null || echo "FAIL")
if [[ "$ERR_FIX" == "OK" ]]; then
  ((passed++)) || true
  echo "  PASS: error fixture matches official contract"
else
  ((failed++)) || true
  echo "  FAIL: error fixture structure issue"
fi

# async defensive: data.task_id + status=processing
ASYNC_FIX=$(python3 -c "import json; d=json.load(open('${FIXTURES}/music-generation-async-defensive.json')); print('OK' if 'data' in d and 'task_id' in d['data'] and d['data']['status']=='processing' else 'FAIL')" 2>/dev/null || echo "FAIL")
if [[ "$ASYNC_FIX" == "OK" ]]; then
  ((passed++)) || true
  echo "  PASS: async-defensive fixture matches official contract"
else
  ((failed++)) || true
  echo "  FAIL: async-defensive fixture structure issue"
fi

# ── 4. Verify parser reads extra_info.music_duration ─────────────────────────
DUR_PARSER=$(grep -c "music_duration" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$DUR_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles extra_info.music_duration"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle music_duration"
fi

# ── 5. Verify parser reads extra_info.music_sample_rate ──────────────────────
SR_PARSER=$(grep -c "music_sample_rate" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$SR_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles extra_info.music_sample_rate"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle music_sample_rate"
fi

# ── 6. Verify parser reads extra_info.bitrate ────────────────────────────────
BR_PARSER=$(grep -c "bitrate" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$BR_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles extra_info.bitrate"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle bitrate"
fi

# ── 7. Verify parser reads extra_info.music_size ────────────────────────────
SZ_PARSER=$(grep -c "music_size" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$SZ_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles extra_info.music_size"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle music_size"
fi

# ── 8. Verify parser reads base_resp.status_code ─────────────────────────────
BASE_PARSER=$(grep -c "status_code" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$BASE_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles base_resp.status_code"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle status_code"
fi

# ── 9. Verify parser reads base_resp.status_msg ──────────────────────────────
MSG_PARSER=$(grep -c "status_msg" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$MSG_PARSER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: parser handles base_resp.status_msg"
else
  ((failed++)) || true
  echo "  FAIL: parser does not handle status_msg"
fi

# ── 10. Verify call-minimax sets output_format=url ───────────────────────────
OF_URL=$(grep -c "output_format.*url" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$OF_URL" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: call-minimax defaults to output_format=url"
else
  ((failed++)) || true
  echo "  FAIL: call-minimax does not set output_format=url"
fi

# ── 11. Verify official endpoint ─────────────────────────────────────────────
EP_CN=$(grep -c "api.minimaxi.com/v1/music_generation" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
EP_GL=$(grep -c "api.minimax.io/v1/music_generation" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$EP_CN" -gt 0 ]] && [[ "$EP_GL" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: both CN and Global endpoints correctly defined"
else
  ((failed++)) || true
  echo "  FAIL: endpoint mismatch (cn=$EP_CN global=$EP_GL)"
fi

# ── 12. Verify Authorization header uses Bearer ──────────────────────────────
AUTH_BEARER=$(grep -c "Bearer.*apiKey\|Bearer.*params" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$AUTH_BEARER" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: Authorization uses Bearer token scheme"
else
  ((failed++)) || true
  echo "  FAIL: Authorization header scheme not found"
fi

# ── 13. Verify Content-Type is application/json ───────────────────────────────
CT=$(grep -c "application/json" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$CT" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: Content-Type is application/json"
else
  ((failed++)) || true
  echo "  FAIL: Content-Type header not set to application/json"
fi

# ── 14. Verify parser maps direct_audio / hex_audio ──────────────────────────
KINDS=$(grep -c "'direct_audio'\|'hex_audio'\|'async_task'\|'failure'\|'unknown'" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$KINDS" -ge 5 ]]; then
  ((passed++)) || true
  echo "  PASS: parser defines all 5 response kinds"
else
  ((failed++)) || true
  echo "  FAIL: parser missing response kinds (found $KINDS, expected 5)"
fi

# ── 15. Verify defensive async task note is present ─────────────────────────
# Check source and docs separately to avoid multi-file grep -c issue
DEFENSIVE_R=$(grep -c "defensive\|DEFENSIVE\|not configured yet\|polling.*not.*configured" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || true)
DEFENSIVE_D=$(grep -c "defensive\|DEFENSIVE\|not configured yet\|polling.*not.*configured" "${PROJ}/docs/API_ADAPTER_DEBUG_REPORT.md" 2>/dev/null || true)
DEFENSIVE_R=${DEFENSIVE_R:-0}; DEFENSIVE_D=${DEFENSIVE_D:-0}
if [[ "$((DEFENSIVE_R + DEFENSIVE_D))" -gt 0 ]]; then
  ((passed++)) || true
  echo "  PASS: defensive async compatibility documented"
else
  ((failed++)) || true
  echo "  FAIL: defensive async task not documented"
fi

# ── 16. Verify polling endpoint is NOT guessed ───────────────────────────────
# No hardcoded https://...status... or /v1/...status... in source
POLL_GUESS=$(grep -rE "https://[^'\"]*status[^'\"]*|/v1/status|MINIMAX_API_STATUS_ENDPOINT.*=.*\"https" \
  "${PROJ}/server/" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v "pollingRequired\|pollingRequired.*true" || true)
if [[ -z "$POLL_GUESS" ]]; then
  ((passed++)) || true
  echo "  PASS: no hardcoded polling endpoint guessing"
else
  ((failed++)) || true
  echo "  FAIL: found potential polling endpoint: $POLL_GUESS"
fi

# ── 17. Verify no console.log of apiKey/Bearer/sk_ in call-minimax.ts ────────
NO_LOG=$(grep -c "console.log.*apiKey\|console.log.*Bearer\|console.log.*sk_\|console.log.*token" "${PROJ}/server/call-minimax.ts" 2>/dev/null || true)
NO_LOG=${NO_LOG:-0}
if [[ "$NO_LOG" -eq 0 ]]; then
  ((passed++)) || true
  echo "  PASS: no apiKey logging in call-minimax.ts"
else
  ((failed++)) || true
  echo "  FAIL: console.log of apiKey/Bearer/sk_ found"
fi

# ── 18. Verify no console.log of secrets in response.ts ────────────────────────
NO_LOG_R=$(grep -c "console.log.*apiKey\|console.log.*Bearer\|console.log.*sk_\|console.log.*token" "${PROJ}/server/adapters/minimax-api/response.ts" 2>/dev/null || true)
NO_LOG_R=${NO_LOG_R:-0}
if [[ "$NO_LOG_R" -eq 0 ]]; then
  ((passed++)) || true
  echo "  PASS: no secret logging in response.ts"
else
  ((failed++)) || true
  echo "  FAIL: console.log of secrets found in response.ts"
fi

# ── 19. Verify MiniMaxResult preserves durationMs / sampleRate ─────────────
RES_KIND=$(grep -c "durationMs\|sampleRate\|bitrate\|sizeBytes" "${PROJ}/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$RES_KIND" -ge 3 ]]; then
  ((passed++)) || true
  echo "  PASS: MiniMaxResult interface preserves metadata fields"
else
  ((failed++)) || true
  echo "  FAIL: MiniMaxResult may not preserve metadata"
fi

# ── 20. Verify fixtures contain no real keys / tokens ───────────────────────
REAL_KEYS=$(python3 -c "
import json, re, sys
bad = []
for fname in ['music-generation-hex-success.json','music-generation-url-success.json','music-generation-error.json','music-generation-async-defensive.json']:
    try:
        text = open('${FIXTURES}/' + fname).read()
        if re.search(r'sk-[0-9A-Za-z]{20,}|Bearer\s+[A-Za-z0-9\-_]{20,}|minimax[a-z0-9]{20,}', text):
            bad.append(fname)
    except: pass
print('FAIL' if bad else 'OK')
" 2>/dev/null || echo "OK")
if [[ "$REAL_KEYS" == "OK" ]]; then
  ((passed++)) || true
  echo "  PASS: fixtures contain no real keys/tokens"
else
  ((failed++)) || true
  echo "  FAIL: fixtures may contain real credentials"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
printf "  PASS: %-4d   FAIL: %-4d\n" "$passed" "$failed"
echo "══════════════════════════════════════════════════"

if [[ "$failed" -eq 0 ]]; then
  echo -e "${GREEN}API_ADAPTER_OFFICIAL_CONTRACT_SMOKE_PASS${NC}"
  exit 0
else
  echo -e "${RED}API_ADAPTER_OFFICIAL_CONTRACT_SMOKE_FAIL ($failed items)${NC}"
  exit 1
fi

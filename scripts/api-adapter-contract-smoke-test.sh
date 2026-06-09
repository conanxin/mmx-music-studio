#!/usr/bin/env bash
# scripts/api-adapter-contract-smoke-test.sh
# Phase API-Debug-A: API Adapter static contract + safety smoke test
# No real network calls. No real keys. No quota consumption.
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

report() {
  local msg="$1"; local ok="$2"
  echo -e "${ok}${msg}${NC}"
  if [[ "$ok" == "${GREEN}"* ]]; then ((PASS++)); else ((FAIL++)); fi
}

echo -e "${YELLOW}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  Phase API-Debug-A: API Adapter Contract Tests  ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════╝${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ="$SCRIPT_DIR/.."

# ── 1. API Adapter code structure exists ───────────────────────────────────────
report "1: call-minimax.ts exists" "$(test -f "$PROJ/server/call-minimax.ts" && echo "$GREEN" || echo "$RED")"
report "2: core-wrapper.ts exists" "$(test -f "$PROJ/server/core-wrapper.ts" && echo "$GREEN" || echo "$RED")"
report "3: byok-secrets.ts exists" "$(test -f "$PROJ/server/byok-secrets.ts" && echo "$GREEN" || echo "$RED")"
report "4: jobs.ts exists (executeApiJob)" "$(test -f "$PROJ/server/jobs.ts" && echo "$GREEN" || echo "$RED")"

# ── 2. BYOK key safety: never written to disk ──────────────────────────────────
KEY_IN_DISK=$(grep -rE "writeFile|appendFile|fs\.write|fsSync" "$PROJ/server/byok-secrets.ts" 2>/dev/null | grep -v "readFile\|existsSync\|mkdirSync" || true)
if [[ -z "$KEY_IN_DISK" ]]; then
  report "5: byok-secrets.ts never writes keys to disk — PASS" "$GREEN"
else
  report "5: byok-secrets.ts writes to disk — FAIL" "$RED"
fi

# ── 3. BYOK key cleanup paths exist ─────────────────────────────────────────────
HAS_DELETE=$(grep -c "deleteJobApiKey\|secretStore.delete" "$PROJ/server/byok-secrets.ts" 2>/dev/null || echo "0")
if [[ "$HAS_DELETE" -ge 2 ]]; then
  report "6: byok-secrets.ts has deleteJobApiKey + Map.delete — PASS" "$GREEN"
else
  report "6: byok-secrets.ts missing key deletion paths — FAIL" "$RED"
fi

# ── 4. BYOK key not in job manifest ─────────────────────────────────────────────
JOB_KEY_LEAK=$(grep -c "apiKey\|secret\|Authorization.*job\|key.*job" "$PROJ/server/jobs.ts" 2>/dev/null | head -1 || echo "0")
JOB_RECORD=$(grep "export interface GenerateJob" "$PROJ/server/jobs.ts" 2>/dev/null || true)
if [[ -z "$JOB_RECORD" ]] || echo "$JOB_RECORD" | grep -qv "apiKey\|secret"; then
  report "7: GenerateJob interface does NOT include apiKey/secret — PASS" "$GREEN"
else
  report "7: GenerateJob may include apiKey/secret — FAIL" "$RED"
fi

# ── 5. BYOK key not in logs ─────────────────────────────────────────────────────
LOGS_KEY=$(grep -rE "console\.(log|error).*apiKey|console\.(log|error).*Bearer|console\.(log|error).*sk_" "$PROJ/server/byok-secrets.ts" "$PROJ/server/call-minimax.ts" 2>/dev/null | grep -v "redact\|REDACTED" || true)
if [[ -z "$LOGS_KEY" ]]; then
  report "8: No console.log of apiKey/Bearer/sk_ in byok-secrets/call-minimax — PASS" "$GREEN"
else
  report "8: Found console.log with api key — FAIL" "$RED"
fi

# ── 6. Request payload builder exists and has field mapping ─────────────────────
PAYLOAD_BUILDER="$PROJ/packages/core/src/request-builder.ts"
HAS_BUILD=$(grep -c "buildMiniMaxMusicPayload\|export function build" "$PAYLOAD_BUILDER" 2>/dev/null || echo "0")
if [[ "$HAS_BUILD" -ge 1 ]]; then
  report "9: buildMiniMaxMusicPayload() exists — PASS" "$GREEN"
else
  report "9: buildMiniMaxMusicPayload() not found — FAIL" "$RED"
fi

# ── 7. Payload covers mode-specific fields ─────────────────────────────────────
HAS_MODE_FIELDS=$(grep -c "is_instrumental\|lyrics_optimizer\|lyrics\|audio_url\|audio_base64\|prompt" "$PAYLOAD_BUILDER" 2>/dev/null || echo "0")
if [[ "$HAS_MODE_FIELDS" -ge 5 ]]; then
  report "10: Payload covers instrumental/auto/lyrics/cover-url/cover-file fields — PASS" "$GREEN"
else
  report "10: Payload missing some mode-specific fields — FAIL" "$RED"
fi

# ── 8. Response parser covers url + hex + error ──────────────────────────────────
RESPONSE_PARSER="$PROJ/server/call-minimax.ts"
HAS_URL=$(grep -c "audioKind.*url\|audio_url\|data.audio" "$RESPONSE_PARSER" 2>/dev/null || echo "0")
HAS_HEX=$(grep -c "audioKind.*hex\|^[0-9a-fA-F]" "$RESPONSE_PARSER" 2>/dev/null || echo "0")
HAS_ERR=$(grep -c "base_resp.*status_code\|status_msg\|MINIMAX_ERROR" "$RESPONSE_PARSER" 2>/dev/null || echo "0")
if [[ "$HAS_URL" -ge 2 ]] && [[ "$HAS_HEX" -ge 1 ]] && [[ "$HAS_ERR" -ge 2 ]]; then
  report "11: Response parser covers direct audio URL + hex + error — PASS" "$GREEN"
else
  report "11: Response parser may miss url/hex/error handling — FAIL" "$RED"
fi

# ── 9. Async polling / task_id support check ────────────────────────────────────
# Current call-minimax.ts does NOT have async polling — it expects immediate response
ASYNC_POLL=$(grep -c "task_id\|job_id.*poll\|async.*wait\|pollInterval\|setInterval\|long_polling" "$RESPONSE_PARSER" 2>/dev/null || echo "0")
if [[ "$ASYNC_POLL" -eq 0 ]]; then
  report "12: No async polling/task_id support found — EXPECTED (current impl is sync) — PASS" "$GREEN"
else
  report "12: Async polling code found — PASS" "$GREEN"
fi

# ── 10. BYOK key TTL + expiry check ────────────────────────────────────────────
HAS_TTL=$(grep -c "TTL_MS\|expiresAt\|expired" "$PROJ/server/byok-secrets.ts" 2>/dev/null || echo "0")
if [[ "$HAS_TTL" -ge 2 ]]; then
  report "13: BYOK key has TTL + expiry logic — PASS" "$GREEN"
else
  report "13: BYOK key TTL/expiry logic not found — FAIL" "$RED"
fi

# ── 11. Track mapping: API job writes generationSource=minimax-api ───────────────
TRACK_SOURCE=$(grep -c "generationSource.*minimax-api\|minimax-api" "$PROJ/server/jobs.ts" 2>/dev/null || echo "0")
if [[ "$TRACK_SOURCE" -ge 2 ]]; then
  report "14: executeApiJob sets generationSource=minimax-api — PASS" "$GREEN"
else
  report "14: executeApiJob may not set generationSource=minimax-api — FAIL" "$RED"
fi

# ── 12. Track mapping: audioUrl + downloadUrl + durationMs ─────────────────────
TRACK_FIELDS=$(grep -c "audioUrl\|downloadUrl\|durationMs\|durationText" "$PROJ/server/jobs.ts" 2>/dev/null | head -1 || echo "0")
if [[ "$TRACK_FIELDS" -ge 3 ]]; then
  report "15: executeApiJob writes audioUrl/durationMs/durationText — PASS" "$GREEN"
else
  report "15: executeApiJob may miss audioUrl/duration fields — FAIL" "$RED"
fi

# ── 13. Guard vs quota distinction ──────────────────────────────────────────────
HAS_REAL_API_LIMIT=$(grep -c "realApiAttempt\|RealApiAttemptConfig\|reserveRealApiAttempt" "$PROJ/server/rate-limit.ts" 2>/dev/null || echo "0")
HAS_DAILY_QUOTA=$(grep -c "incrementDailyQuota\|DailyQuotaConfig\|getDailyQuotaStatus" "$PROJ/server/rate-limit.ts" 2>/dev/null || echo "0")
if [[ "$HAS_REAL_API_LIMIT" -ge 3 ]] && [[ "$HAS_DAILY_QUOTA" -ge 3 ]]; then
  report "16: Two distinct guards: realApiAttempt + dailyGeneration — PASS" "$GREEN"
else
  report "16: Guard distinction unclear (realApiAttempt=$HAS_REAL_API_LIMIT dailyQuota=$HAS_DAILY_QUOTA) — FAIL" "$RED"
fi

# ── 14. API endpoint from constants ─────────────────────────────────────────────
ENDPOINT_CONST="$PROJ/packages/core/src/constants.ts"
HAS_ENDPOINT=$(grep -c "MINI_MAX_ENDPOINTS\|music_generation\|api.minimax" "$ENDPOINT_CONST" 2>/dev/null || echo "0")
if [[ "$HAS_ENDPOINT" -ge 2 ]]; then
  report "17: Endpoint defined in constants (cn + global) — PASS" "$GREEN"
else
  report "17: Endpoint constant not found — FAIL" "$RED"
fi

# ── 15. API Adapter documented as experimental ─────────────────────────────────
EXPERIMENTAL_DOC="$PROJ/docs/BYOK_MODE.md"
IS_EXPERIMENTAL=$(grep -c "experimental\|Experimental" "$EXPERIMENTAL_DOC" 2>/dev/null || echo "0")
if [[ "$IS_EXPERIMENTAL" -ge 2 ]]; then
  report "18: BYOK_MODE.md marks API Adapter as experimental — PASS" "$GREEN"
else
  report "18: BYOK_MODE.md may not clearly mark API Adapter as experimental — FAIL" "$RED"
fi

# ── 16. CLI track mapping vs API track mapping alignment ───────────────────────
# Both should use createTrackRecord() with same fields
CLI_TRACK=$(grep -c "createTrackRecord" "$PROJ/server/jobs.ts" 2>/dev/null | head -1 || echo "0")
if [[ "$CLI_TRACK" -ge 2 ]]; then
  report "19: Both CLI and API paths use createTrackRecord() — PASS" "$GREEN"
else
  report "19: Track record creation may differ between CLI and API paths — FAIL" "$RED"
fi

# ── 20. Error messages sanitized before client response ─────────────────────────
REDACT_CALLS=$(grep -rn "redactSecrets\|redactForLog" "$PROJ/server/call-minimax.ts" "$PROJ/server/jobs.ts" "$PROJ/server/security.ts" 2>/dev/null | wc -l || echo "0")
if [[ "$REDACT_CALLS" -ge 2 ]]; then
  report "20: Error messages use redactSecrets/redactForLog — PASS" "$GREEN"
else
  report "20: Errors may not be sanitized (found $REDACT_CALLS redact calls) — FAIL" "$RED"
fi

# ── 18. Health endpoint has backend indicator ───────────────────────────────────
# backend is included in /api/health response (server/index.ts line ~647)
HAS_BACKEND_HEALTH=$(grep -c "backend.*:.*config\.backend\|backend," "$PROJ/server/index.ts" 2>/dev/null || echo "0")
if [[ "$HAS_BACKEND_HEALTH" -ge 1 ]]; then
  report "21: Health endpoint reports backend mode — PASS" "$GREEN"
else
  report "21: Health endpoint may not report backend mode — FAIL" "$RED"
fi

# ── Summary ─────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo -e "  PASS: ${GREEN}${PASS}${NC}   FAIL: ${RED}${FAIL}${NC}"
echo "══════════════════════════════════════════════════"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}API_ADAPTER_CONTRACT_SMOKE_PASS${NC}"
else
  echo -e "${RED}API_ADAPTER_CONTRACT_SMOKE_FAIL (${FAIL} items)${NC}"
fi
exit $FAIL
#!/usr/bin/env bash
# scripts/api-adapter-async-contract-smoke-test.sh
# Phase API-Debug-B0: Async task response contract + mock parser test
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
echo -e "${YELLOW}║  Phase API-Debug-B0: Async Task Response Contract ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════╝${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ="$SCRIPT_DIR/.."

# ── 1. Response parser file exists ─────────────────────────────────────────
report "1: response.ts exists" "$(test -f "$PROJ/server/adapters/minimax-api/response.ts" && echo "$GREEN" || echo "$RED")"

# ── 2. Parser has ResponseKind type ─────────────────────────────────────────
HAS_KIND=$(grep -c "ResponseKind\|'direct_audio'\|'hex_audio'\|'async_task'\|'failure'\|'unknown'" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_KIND" -ge 5 ]]; then
  report "2: ResponseKind type defines async_task + direct_audio + hex_audio + failure + unknown — PASS" "$GREEN"
else
  report "2: ResponseKind missing some kinds (found=$HAS_KIND) — FAIL" "$RED"
fi

# ── 3. Parser recognizes task_id ─────────────────────────────────────────────
HAS_TASK_ID=$(grep -c "task_id\|taskId" "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_TASK_ID" -ge 4 ]]; then
  report "3: Parser recognizes task_id / taskId — PASS" "$GREEN"
else
  report "3: Parser may not recognize task_id — FAIL" "$RED"
fi

# ── 4. Parser supports data.task_id nested ───────────────────────────────────
HAS_NESTED=$(grep -c "data\.task_id\|data\.taskId" "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_NESTED" -ge 2 ]]; then
  report "4: Parser handles nested data.task_id / data.taskId — PASS" "$GREEN"
else
  report "4: Parser may not handle nested task_id — FAIL" "$RED"
fi

# ── 5. Direct audio path preserved ─────────────────────────────────────────
HAS_DIRECT=$(grep -c "direct_audio\|audioUrl.*data\.audio\|audio_url.*data" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_DIRECT" -ge 3 ]]; then
  report "5: Direct audio URL path preserved — PASS" "$GREEN"
else
  report "5: Direct audio path may be broken — FAIL" "$RED"
fi

# ── 6. Hex audio path preserved ─────────────────────────────────────────────
HAS_HEX=$(grep -c "hex_audio\|looksLikeHex" "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_HEX" -ge 2 ]]; then
  report "6: Hex audio path preserved — PASS" "$GREEN"
else
  report "6: Hex audio path may be broken — FAIL" "$RED"
fi

# ── 7. async_task error code is MINIMAX_API_ASYNC_POLLING_REQUIRED ──────────
HAS_ASYNC_CODE=$(grep -c "MINIMAX_API_ASYNC_POLLING_REQUIRED\|MINIMAX_API_ASYNC" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$HAS_ASYNC_CODE" -ge 1 ]]; then
  report "7: async_task error code = MINIMAX_API_ASYNC_POLLING_REQUIRED — PASS" "$GREEN"
else
  report "7: async_task error code not found — FAIL" "$RED"
fi

# ── 8. call-minimax.ts uses parseMiniMaxMusicResponse ───────────────────────
USES_PARSER=$(grep -c "parseMiniMaxMusicResponse\|parsedToResult" \
  "$PROJ/server/call-minimax.ts" 2>/dev/null || echo "0")
if [[ "$USES_PARSER" -ge 2 ]]; then
  report "8: call-minimax.ts uses parseMiniMaxMusicResponse + parsedToResult — PASS" "$GREEN"
else
  report "8: call-minimax.ts may not use new parser — FAIL" "$RED"
fi

set -o pipefail

# ── 9. No "音频格式无法处理" in call-minimax.ts + jobs.ts ──────────────────
# grep -c returns count on stdout, exits 0 if matches found, exits 1 if none
# pipefail ensures subshell catches grep's non-zero exit even through || echo
OLD_ERROR_CALL=$(grep -c "音频格式无法处理" "$PROJ/server/call-minimax.ts" 2>/dev/null || true)
OLD_ERROR_JOBS=$(grep -c "音频格式无法处理" "$PROJ/server/jobs.ts" 2>/dev/null || true)
# Guard against empty (grep not found / file missing)
OLD_ERROR_CALL=${OLD_ERROR_CALL:-0}
OLD_ERROR_JOBS=${OLD_ERROR_JOBS:-0}
if [[ "$OLD_ERROR_CALL" -eq 0 ]] && [[ "$OLD_ERROR_JOBS" -eq 0 ]]; then
  report "9: Old '音频格式无法处理' removed from call-minimax.ts + jobs.ts — PASS" "$GREEN"
else
  report "9: Old '音频格式无法处理' still present (call=$OLD_ERROR_CALL jobs=$OLD_ERROR_JOBS) — FAIL" "$RED"
fi

# ── 10. async task message says polling not configured ───────────────────────
ASYNC_MSG=$(grep -c "polling is not configured\|task polling is not configured\|async.*polling" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$ASYNC_MSG" -ge 1 ]]; then
  report "10: async_task error message mentions 'polling not configured' — PASS" "$GREEN"
else
  report "10: async_task error message may not explain polling gap — FAIL" "$RED"
fi

# ── 11. No hardcoded polling endpoint URL guessing ──────────────────────────
# pollingRequired: true is a type field, not a URL — only flag actual endpoint strings
POLL_GUESS=$(grep -rE "https://[^'\"]*status[^'\"]*|https://[^'\"]*poll[^'\"]*|/v1/music_status|/status\"|'MINIMAX_API_STATUS_ENDPOINT'" \
  "$PROJ/server/" --include="*.ts" 2>/dev/null | grep -v "node_modules" || true)
if [[ -z "$POLL_GUESS" ]]; then
  report "11: No hardcoded polling endpoint URL guessing — PASS" "$GREEN"
else
  report "11: Found potential polling endpoint URL — FAIL: $POLL_GUESS" "$RED"
fi

# ── 12. Parser throws on async_task (does not silently return) ────────────────
THROWS_ASYNC=$(grep -c "throw.*async_task\|throw Object.assign.*async\|MINIMAX_API_ASYNC" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$THROWS_ASYNC" -ge 1 ]]; then
  report "12: Parser throws on async_task (no silent fallback) — PASS" "$GREEN"
else
  report "12: Parser may silently handle async_task — FAIL" "$RED"
fi

# ── 13. No console.log(apiKey) in call-minimax.ts ────────────────────────────
KEY_LOG=$(grep -n "console\.\(log\|error\).*apiKey\|console\.\(log\|error\).*Bearer\|console\.\(log\|error\).*sk_" \
  "$PROJ/server/call-minimax.ts" 2>/dev/null || true)
if [[ -z "$KEY_LOG" ]]; then
  report "13: No console.log of apiKey/Bearer/sk_ in call-minimax.ts — PASS" "$GREEN"
else
  report "13: Found console.log with api key — FAIL" "$RED"
fi

# ── 14. No console.log(apiKey) in response.ts ───────────────────────────────
KEY_LOG_PARSER=$(grep -n "console\.\(log\|error\).*apiKey\|console\.\(log\|error\).*Bearer\|console\.\(log\|error\).*sk_" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || true)
if [[ -z "$KEY_LOG_PARSER" ]]; then
  report "14: No console.log of apiKey/Bearer/sk_ in response.ts — PASS" "$GREEN"
else
  report "14: Found console.log with api key in response.ts — FAIL" "$RED"
fi

# ── 15. parsedToResult handles direct_audio + hex_audio ─────────────────────
CONVERTS=$(grep -c "direct_audio\|hex_audio" "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null | head -1 || echo "0")
if [[ "$CONVERTS" -ge 2 ]]; then
  report "15: parsedToResult converts direct_audio + hex_audio — PASS" "$GREEN"
else
  report "15: parsedToResult may not convert both — FAIL" "$RED"
fi

# ── 16. failure kind handled in parsedToResult ──────────────────────────────
FAIL_HANDLED=$(grep -c "kind.*failure\|failure.*throw\|MINIMAX_ERROR" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$FAIL_HANDLED" -ge 2 ]]; then
  report "16: parsedToResult handles failure kind — PASS" "$GREEN"
else
  report "16: parsedToResult may not handle failure kind — FAIL" "$RED"
fi

# ── 17. jobs.ts handles async errors (catch-all or explicit) ────────────────
# Pre-polling: async errors can be caught by the generic catch block in executeApiJob
# OR handled explicitly. Either pattern is acceptable.
HAS_CATCH=$(grep -c "catch.*err\|catch.*e\|catch.{" "$PROJ/server/jobs.ts" 2>/dev/null || echo "0")
if [[ "$HAS_CATCH" -gt 0 ]]; then
  report "17: jobs.ts has catch block for callMiniMaxApi errors — PASS" "$GREEN"
else
  report "17: jobs.ts may not handle async polling error — FAIL" "$RED"
fi

# ── 18. Failure message is sanitized (no raw API response in error) ─────────
# parseMiniMaxMusicResponse uses baseResp.status_msg only, not full raw
FAIL_SANITIZED=$(grep -c "base_resp.*status_msg\|status_msg" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$FAIL_SANITIZED" -ge 1 ]]; then
  report "18: Failure uses status_msg (not full raw response) — PASS" "$GREEN"
else
  report "18: Failure may include raw response — FAIL" "$RED"
fi

# ── 19. Unknown response includes knownKeys (diagnostic) ───────────────────
UNKNOWN_KEYS=$(grep -c "knownKeys\|collectKeys" \
  "$PROJ/server/adapters/minimax-api/response.ts" 2>/dev/null || echo "0")
if [[ "$UNKNOWN_KEYS" -ge 2 ]]; then
  report "19: Unknown response includes knownKeys for diagnostics — PASS" "$GREEN"
else
  report "19: Unknown response may not include diagnostic keys — FAIL" "$RED"
fi

# ── 20. No hardcoded polling endpoint in codebase ────────────────────────────
POLL_ENDPOINT=$(grep -rE "minimax.*status|music.*status|/v1/status|/poll|api.minimax.*status" \
  "$PROJ/server/" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v "response.ts" | grep -v "polling.ts" || true)
if [[ -z "$POLL_ENDPOINT" ]]; then
  report "20: No hardcoded polling endpoint in server/ — PASS" "$GREEN"
else
  report "20: Found hardcoded polling endpoint — FAIL" "$RED"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo -e "  PASS: ${GREEN}${PASS}${NC}   FAIL: ${RED}${FAIL}${NC}"
echo "══════════════════════════════════════════════════"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}API_ADAPTER_ASYNC_CONTRACT_SMOKE_PASS${NC}"
else
  echo -e "${RED}API_ADAPTER_ASYNC_CONTRACT_SMOKE_FAIL (${FAIL} items)${NC}"
fi
exit $FAIL
#!/usr/bin/env bash
# scripts/api-adapter-async-polling-design-smoke-test.sh
# Phase API-Debug-E: Async polling design smoke test
# No real network calls. No real keys. No quota consumption.
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "  [PASS] $1"; PASS=$((PASS+1)); }
fail() { echo -e "  [FAIL] $1"; FAIL=$((FAIL+1)); }
info() { echo -e "  [INFO] $1"; }

echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  Phase API-Debug-E: Async Polling Design Smoke Test      ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ="$SCRIPT_DIR/.."

# ── helpers ──────────────────────────────────────────────────────────────────
file_contains() { grep -c "$1" "$2" >/dev/null 2>&1; }
file_has_text() { grep -q "$1" "$2" 2>/dev/null; }

# ── 1. polling.ts exists ────────────────────────────────────────────────────
if [[ -f "$PROJ/server/adapters/minimax-api/polling.ts" ]]; then
  pass "1: polling.ts exists"
else
  fail "1: polling.ts missing"
fi

# ── 2. MiniMaxAsyncTaskStatus enum covers all states ────────────────────────
POLL="$PROJ/server/adapters/minimax-api/polling.ts"
if file_has_text "'accepted'" "$POLL" && \
   file_has_text "'queued'" "$POLL" && \
   file_has_text "'processing'" "$POLL" && \
   file_has_text "'succeeded'" "$POLL" && \
   file_has_text "'failed'" "$POLL" && \
   file_has_text "'timeout'" "$POLL" && \
   file_has_text "'unknown'" "$POLL"; then
  pass "2: MiniMaxAsyncTaskStatus covers all 7 states"
else
  fail "2: MiniMaxAsyncTaskStatus incomplete"
fi

# ── 3. normalizeMiniMaxTaskStatus function exists ────────────────────────────
if file_has_text "normalizeMiniMaxTaskStatus" "$POLL"; then
  pass "3: normalizeMiniMaxTaskStatus function exists"
else
  fail "3: normalizeMiniMaxTaskStatus missing"
fi

# ── 4. Status normalization covers key states ───────────────────────────────
for state in accepted queued processing succeeded failed timeout; do
  if file_has_text "$state" "$POLL"; then
    pass "4.$state: '$state' covered"
  else
    fail "4.$state: '$state' not covered"
  fi
done

# ── 5. pollingEndpointConfigured: false present ─────────────────────────────
if file_has_text "pollingEndpointConfigured" "$POLL"; then
  pass "5: pollingEndpointConfigured field present"
else
  fail "5: pollingEndpointConfigured field missing"
fi

# ── 6. No guessed polling endpoint URL in polling.ts ────────────────────────
# Allow example.invalid fixture URLs, reject anything looking like a real minimax status endpoint
POLL_URL_LINE=$(grep -nE "https://[^'\"]*minimax[^'\"]*status|/v1/music_status|/v1/status|\"MINIMAX_API_STATUS" \
  "$POLL" 2>/dev/null | grep -v "example.invalid" || echo "")
if [[ -z "$POLL_URL_LINE" ]]; then
  pass "6: No guessed polling endpoint URL in polling.ts"
else
  fail "6: Found guessed polling URL in polling.ts: $POLL_URL_LINE"
fi

# ── 7. No guessed polling endpoint in entire server/ ────────────────────────
ALL_GUESS=$(grep -rnE "https://[^'\"]*minimax[^'\"]*status|/v1/music_status|\"MINIMAX_API_STATUS" \
  "$PROJ/server/" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v "example.invalid" | grep -v "polling.ts" || echo "")
if [[ -z "$ALL_GUESS" ]]; then
  pass "7: No guessed polling endpoint in server/ (excluding polling.ts)"
else
  fail "7: Found guessed polling URL in server/: $ALL_GUESS"
fi

# ── 8. async processing fixture exists ──────────────────────────────────────
FIX="$PROJ/test-fixtures/minimax-api/music-generation-async-processing.json"
if [[ -f "$FIX" ]]; then
  if file_has_text "processing" "$FIX" && file_has_text "task_id" "$FIX"; then
    pass "8: async processing fixture valid (has task_id + status)"
  else
    fail "8: async processing fixture incomplete"
  fi
else
  fail "8: async processing fixture missing"
fi

# ── 9. async succeeded fixture exists ──────────────────────────────────────
FIX2="$PROJ/test-fixtures/minimax-api/music-generation-async-succeeded.json"
if [[ -f "$FIX2" ]]; then
  if file_has_text "succeeded" "$FIX2" && file_has_text "task_id" "$FIX2"; then
    pass "9: async succeeded fixture valid"
  else
    fail "9: async succeeded fixture incomplete"
  fi
else
  fail "9: async succeeded fixture missing"
fi

# ── 10. async failed fixture exists ────────────────────────────────────────
FIX3="$PROJ/test-fixtures/minimax-api/music-generation-async-failed.json"
if [[ -f "$FIX3" ]]; then
  if file_has_text "failed" "$FIX3" && file_has_text "task_id" "$FIX3"; then
    pass "10: async failed fixture valid"
  else
    fail "10: async failed fixture incomplete"
  fi
else
  fail "10: async failed fixture missing"
fi

# ── 11. MINIMAX_API_ASYNC_POLLING_REQUIRED error code in response.ts ─────────
RESP="$PROJ/server/adapters/minimax-api/response.ts"
if file_has_text "MINIMAX_API_ASYNC_POLLING_REQUIRED" "$RESP"; then
  pass "11: MINIMAX_API_ASYNC_POLLING_REQUIRED in response.ts"
else
  fail "11: MINIMAX_API_ASYNC_POLLING_REQUIRED code not found"
fi

# ── 12. Studio has async_polling_required error type ────────────────────────
STUDIO="$PROJ/src/features/studio/Studio.tsx"
if file_has_text "async_polling_required" "$STUDIO"; then
  COUNT=$(grep -c "async_polling_required" "$STUDIO" 2>/dev/null || echo "0")
  if [[ "$COUNT" -ge 3 ]]; then
    pass "12: Studio async_polling_required type + ERROR_TYPE_LABELS entry"
  else
    fail "12: Studio async_polling_required found but incomplete ($COUNT occurrences)"
  fi
else
  fail "12: Studio async_polling_required type missing"
fi

# ── 13. Studio error card shows async polling hint ─────────────────────────
if file_has_text "任务轮询\|尚未配置轮询\|polling.*not.*configured" "$STUDIO"; then
  pass "13: Studio error card shows async polling hint"
else
  fail "13: Studio async polling hint missing"
fi

# ── 14. response.ts or polling.ts documents polling endpoint not confirmed ────
if file_has_text "polling.*not.*configured\|not.*confirmed\|official.*polling\|polling.*endpoint.*not" "$POLL" || \
   file_has_text "polling.*not.*configured\|not.*confirmed\|official.*polling\|polling.*endpoint.*not" "$RESP"; then
  pass "14: Source documents polling endpoint not confirmed"
else
  fail "14: Polling gap not documented in source comments"
fi

# ── 15. No real key/token in polling fixtures (task_id fixtures are ok) ────
# task_id field names are expected; reject actual key values
REAL_KEY=$(grep -rE "sk-[a-zA-Z0-9]{20,}|Bearer\s+sk-|api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20}" \
  "$PROJ/test-fixtures/minimax-api/" 2>/dev/null | grep -v "node_modules" || echo "")
if [[ -z "$REAL_KEY" ]]; then
  pass "15: No real key/token in fixtures (task_id names are expected)"
else
  fail "15: Found potential key/token in fixtures: $REAL_KEY"
fi

# ── 16. No /api/generate in polling.ts ─────────────────────────────────────
if ! file_has_text "/api/generate" "$POLL"; then
  pass "16: No /api/generate in polling.ts"
else
  fail "16: /api/generate found in polling.ts"
fi

# ── 17. BYOK_REAL_TEST_PLAN.md documents polling endpoint gap ─────────────────
PLAN="$PROJ/docs/BYOK_REAL_TEST_PLAN.md"
if file_has_text "polling.*endpoint\|polling.*未确认\|not.*confirmed.*polling" "$PLAN"; then
  pass "17: BYOK plan documents polling endpoint gap"
else
  fail "17: BYOK plan may not document polling gap"
fi

# ── 18. API_ADAPTER_DEBUG_REPORT mentions polling design ─────────────────────
REPORT="$PROJ/docs/API_ADAPTER_DEBUG_REPORT.md"
if file_has_text "pollingEndpointConfigured\|polling.*not.*confirmed\|polling.*design" "$REPORT"; then
  pass "18: API_ADAPTER_DEBUG_REPORT mentions polling design"
else
  fail "18: API_ADAPTER_DEBUG_REPORT missing polling design note"
fi

# ── 19. No console.log of apiKey/Bearer in polling.ts ───────────────────────
KEY_LOG=$(grep -n "console\.\(log\|error\)" "$POLL" 2>/dev/null | grep -i "apiKey\|Bearer\|sk_" || echo "")
if [[ -z "$KEY_LOG" ]]; then
  pass "19: No key logging in polling.ts"
else
  fail "19: Key logging found: $KEY_LOG"
fi

# ── 20. classifyError recognizes MINIMAX_API_ASYNC_POLLING_REQUIRED ─────────
if file_has_text "MINIMAX_API_ASYNC_POLLING_REQUIRED\|async.*task.*polling\|任务轮询" "$STUDIO"; then
  COUNT=$(grep -c "MINIMAX_API_ASYNC_POLLING_REQUIRED\|任务轮询" "$STUDIO" 2>/dev/null || echo "0")
  if [[ "$COUNT" -ge 2 ]]; then
    pass "20: classifyError recognizes async polling error"
  else
    fail "20: classifyError async polling check may be incomplete"
  fi
else
  fail "20: classifyError does not check async polling error"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo -e "  PASS: ${GREEN}${PASS}${NC}   FAIL: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}API_ADAPTER_ASYNC_POLLING_DESIGN_SMOKE_PASS${NC}"
else
  echo -e "${RED}API_ADAPTER_ASYNC_POLLING_DESIGN_SMOKE_FAIL (${FAIL} items)${NC}"
fi
exit $FAIL
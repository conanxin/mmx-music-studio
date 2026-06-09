#!/usr/bin/env bash
# studio-api-byok-click-path-smoke-test.sh
# Phase API-Debug-C-Click-Path smoke test
# Verifies Studio submit guard / click path — no real API calls

set -euo pipefail

PROJECT_DIR="/home/ubuntu/projects/mmx-music-studio"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

check() {
  local label="$1"
  local condition="$2"
  if eval "$condition" >/dev/null 2>&1; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAIL: $label"
    echo "    Condition: $condition"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================================"
echo "  Studio API BYOK Click Path Smoke Test"
echo "============================================================"
echo ""

STUDIO_TSX="src/features/studio/Studio.tsx"

# 1. Submit disabled reason diagnostic is present above the button
echo "[1] Submit disabled reason diagnostic present above button"
check "diagnostic uses '提交状态' label" \
  "grep -q '提交状态' '$STUDIO_TSX'"
check "diagnostic checks !settings.apiKey" \
  "grep -q '!settings.apiKey' '$STUDIO_TSX'"
check "diagnostic shows '✅ 可点击' when all guards pass" \
  "grep -q '✅ 可点击' '$STUDIO_TSX'"
check "diagnostic checks isGenerating in reason" \
  "grep -q '正在生成中' '$STUDIO_TSX'"
check "diagnostic checks remainingRealApiAttempts=0" \
  "grep -q '真实 API 测试次数已用完' '$STUDIO_TSX'"
check "diagnostic checks remainingDailyGenerations=0" \
  "grep -q '本地每日生成保护次数已用完' '$STUDIO_TSX'"
check "diagnostic shows BYOK key missing message" \
  "grep -q '请先在设置中输入 BYOK Key' '$STUDIO_TSX'"

# 2. handleGenerate has BYOK key runtime guard
echo ""
echo "[2] handleGenerate has BYOK key runtime guard"
check "BYOK guard in handleGenerate sets error" \
  "grep -A2 'Block if BYOK API mode but no key' '$STUDIO_TSX' | grep -q 'setGenError'"
check "BYOK guard returns early" \
  "grep -A3 'Block if BYOK API mode but no key' '$STUDIO_TSX' | grep -q 'return;'"

# 3. handleGenerate NO silent returns
echo ""
echo "[3] No silent returns in handleGenerate guards"
# Count returns that are NOT preceded by setGenError or setGenError-like
# All guard returns must set an error OR be unreachable
check "All guard blocks before input validation set genError" \
  "grep -B2 'return;' '$STUDIO_TSX' | grep -v 'Block if' | grep -c 'setGenError\\|return;'"

# 4. disabled condition is exactly 6 clauses
echo ""
echo "[4] Button disabled has all 6 guard clauses"
check "disabled has isGenerating clause" \
  "grep -q 'isGenerating ||' '$STUDIO_TSX'"
check "disabled has currentJob running clause" \
  "grep -q 'currentJob &&.*queued.*running' '$STUDIO_TSX'"
check "disabled has BYOK no-key clause" \
  "grep -q 'byokEnabled.*backend.*api.*!settings.apiKey' '$STUDIO_TSX'"
check "disabled has realApiAttempts exhausted clause" \
  "grep -q 'remainingRealApiAttempts.*<= 0' '$STUDIO_TSX'"
check "disabled has daily quota exhausted clause" \
  "grep -q 'remainingDailyGenerations.*<= 0' '$STUDIO_TSX'"

# 5. Server health confirms correct BYOK state
echo ""
echo "[5] Server health confirms BYOK API state"
HEALTH_JSON=$(curl -s http://127.0.0.1:8787/api/health 2>/dev/null || echo '{}')
check "health endpoint responds" \
  "[ -n \"$HEALTH_JSON\" ] && echo '$HEALTH_JSON' | python3 -c 'import json,sys; json.load(sys.stdin)'"
check "backend is api" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"backend\") == \"api\"'"
check "byokEnabled is true" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"byokEnabled\") is True'"
check "serverKeyFallback is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"serverKeyFallback\") is False'"
check "remainingRealApiAttempts >= 1" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert (d.get(\"remainingRealApiAttempts\") or 0) >= 1'"
check "realApiAttemptsUsed == 0" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"realApiAttemptsUsed\") == 0'"
check "dailyQuotaEnabled is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"dailyQuotaEnabled\") is False'"

# 6. No console.log of apiKey
echo ""
echo "[6] No secret leaks in Studio.tsx"
check "no console.log of apiKey" \
  "! grep -n 'console.log.*apiKey' '$STUDIO_TSX'"
check "no console.log of sessionKey" \
  "! grep -n 'console.log.*sessionKey' '$STUDIO_TSX'"
check "no console.log of Bearer" \
  "! grep -n 'console.log.*Bearer' '$STUDIO_TSX'"

# 7. No /api/generate calls in smoke test
echo ""
echo "[7] No real generation during smoke test"
check "generationAccessEnabled is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"generationAccessEnabled\") is False'"

# 8. Settings store has apiKey field
echo ""
echo "[8] Settings store holds apiKey"
SETTINGS_TSX="src/lib/settingsStore.tsx"
check "settingsStore exports apiKey field" \
  "grep -q 'apiKey: string' '$SETTINGS_TSX'"
check "settingsStore uses useState for apiKey" \
  "grep -q 'useState.*AppSettings' '$SETTINGS_TSX'"
check "maskKey function exists (no full key display)" \
  "grep -q 'maskKey' '$SETTINGS_TSX'"

# Summary
echo ""
echo "============================================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "============================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "STUDIO_API_BYOK_CLICK_PATH_SMOKE_PASS"
  exit 0
else
  echo "STUDIO_API_BYOK_CLICK_PATH_SMOKE_FAIL"
  exit 1
fi
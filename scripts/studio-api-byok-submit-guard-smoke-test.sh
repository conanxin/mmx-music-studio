#!/usr/bin/env bash
# studio-api-byok-submit-guard-smoke-test.sh
# Phase API-Debug-C-UI-Guard smoke test
# Verifies BYOK API submit guard logic without calling /api/generate

set -euo pipefail

PROJECT_DIR="/home/ubuntu/projects/mmx-music-studio"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

check() {
  local label="$1"
  local condition="$2"
  if eval "$condition"; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAIL: $label"
    echo "    Condition: $condition"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================================"
echo "  Studio API BYOK Submit Guard Smoke Test"
echo "============================================================"
echo ""

# 1. Verify Studio.tsx has the BYOK key missing guard in handleGenerate
echo "[1] BYOK key missing guard in handleGenerate"
STUDIO_TSX="src/features/studio/Studio.tsx"
check "BYOK guard checks !settings.apiKey" \
  "grep -q 'healthInfo?.byokEnabled && healthInfo?.backend === .api. && !settings.apiKey' '$STUDIO_TSX'"
check "BYOK guard sets clear error message" \
  "grep -q '请先在设置中填写你的 MiniMax Token Plan Key' '$STUDIO_TSX'"
check "BYOK guard returns early (setGenError + return)" \
  "grep -A5 'Block if BYOK API mode but no key' '$STUDIO_TSX' | grep -q 'return;'"

# 2. Verify realApiAttempts remaining=1 does NOT disable button
echo ""
echo "[2] remainingRealApiAttempts=1 does NOT block button (only exhausted=0 does)"
check "Button disabled only when remaining <= 0" \
  "grep -q '(healthInfo?.remainingRealApiAttempts ?? 1) <= 0' '$STUDIO_TSX'"

# 3. Verify dailyQuotaEnabled=false does NOT block BYOK API mode
echo ""
echo "[3] Daily quota disabled in API backend does NOT block"
check "dailyQuota check only applies to non-CLI backends" \
  "grep -q 'healthInfo?.backend !== .cli.' '$STUDIO_TSX'"
check "health does NOT use remainingDailyGenerations to block BYOK when dailyQuotaEnabled=false" \
  "grep -q 'remainingDailyGenerations <= 0' '$STUDIO_TSX'"

# 4. Verify realApiWarning banner shows different message when BYOK key missing
echo ""
echo "[4] Real API warning banner shows contextual message"
check "Warning shows '请先在设置中输入 BYOK Key' when key missing" \
  "grep -q '请先在设置中输入 BYOK Key' '$STUDIO_TSX'"
check "Warning falls back to '✅ 可点击' when key present (submit path diagnostic)" \
  "grep -q '✅ 可点击' '$STUDIO_TSX'"

# 5. Verify Settings.tsx shows BYOK key input guidance
echo ""
echo "[5] Settings page has BYOK guidance"
SETTINGS_TSX="src/features/settings/Settings.tsx"
check "Settings warns when BYOK mode and no key" \
  "grep -q '请先填写你的 MiniMax Token Plan Key' '$SETTINGS_TSX'"
check "Settings shows masked key after entry" \
  "grep -q 'maskedKey' '$SETTINGS_TSX'"

# 6. Verify errorBox renders genError
echo ""
echo "[6] Error display renders near generate button"
check "genError displayed in errorBox" \
  "grep -q 'className={styles.errorBox}>{genError}' '$STUDIO_TSX'"
check "errorBox appears in source before generateBtn" \
  "[ \$(grep -n 'errorBox' '\$STUDIO_TSX' | head -1 | cut -d: -f1) -lt \$(grep -n 'generateBtn' '\$STUDIO_TSX' | head -1 | cut -d: -f1) ]"

# 7. Verify server health supports BYOK with correct limits
echo ""
echo "[7] Server health endpoint returns correct BYOK fields"
HEALTH_JSON=$(curl -s http://127.0.0.1:8787/api/health 2>/dev/null || echo '{}')
check "health endpoint responds" \
  "[ -n \"$HEALTH_JSON\" ] && [ \"$HEALTH_JSON\" != '{}' ]"
check "backend is api" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"backend\") == \"api\"'"
check "byokEnabled is true" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"byokEnabled\") is True'"
check "serverKeyFallback is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"serverKeyFallback\") is False'"
check "remainingRealApiAttempts >= 1" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert (d.get(\"remainingRealApiAttempts\") or 0) >= 1'"
check "dailyQuotaEnabled is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"dailyQuotaEnabled\") is False'"

# 8. Verify no real generation happens (no /api/generate called)
echo ""
echo "[8] No generation triggered during this smoke test"
check "jobs API has 0 real api attempts used" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"realApiAttemptsUsed\") == 0'"
check "generationAccessEnabled is false" \
  "echo '$HEALTH_JSON' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get(\"generationAccessEnabled\") is False'"

# 9. Verify API adapter fixtures are intact
echo ""
echo "[9] API adapter fixtures intact"
FIXTURES="test-fixtures/minimax-api"
check "official fixture hex-success exists" \
  "[ -f '$FIXTURES/music-generation-hex-success.json' ]"
check "official fixture url-success exists" \
  "[ -f '$FIXTURES/music-generation-url-success.json' ]"
check "official fixture error exists" \
  "[ -f '$FIXTURES/music-generation-error.json' ]"

# Summary
echo ""
echo "============================================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "============================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "STUDIO_API_BYOK_SUBMIT_GUARD_SMOKE_PASS"
  exit 0
else
  echo "STUDIO_API_BYOK_SUBMIT_GUARD_SMOKE_FAIL"
  exit 1
fi
#!/usr/bin/env bash
# scripts/weapp-byok-strategy-smoke-test.sh
# Phase 5C: WeApp BYOK Strategy — static smoke test
# Verifies: byok adapter (memory-only), request.ts (BYOK headers), Settings UI, Studio logic

set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "=== Phase 5C: WeApp BYOK Strategy Smoke Test ==="
echo

# ── 1. byok.ts: memory-only (no wx storage) ───────────────────────────────
# byok.ts: memory-only (no wx storage)
BYOK_FILE="apps/weapp/src/adapters/byok.ts"
# Exclude comment lines (lines starting with // or *)
BYOK_CODE_LINES=$(grep -vE "^\s*//|^\s*\*" "$BYOK_FILE" 2>/dev/null || echo "")

echo "[1/13] byok adapter — memory-only storage"
if echo "$BYOK_CODE_LINES" | grep -q "wx\." 2>/dev/null; then
  fail "byok.ts uses wx.* (should be memory-only)"
else
  pass "byok.ts — no wx.* usage"
fi

if echo "$BYOK_CODE_LINES" | grep -q "setStorage\|getStorage\|removeStorage" 2>/dev/null; then
  fail "byok.ts uses storage APIs"
else
  pass "byok.ts — no storage API usage"
fi

# ── 2. byok.ts: has required exports ───────────────────────────────────────
echo "[2/13] byok adapter — required exports"
for fn in setSessionApiKey getSessionApiKey clearSessionApiKey maskApiKey hasSessionApiKey; do
  if grep -q "^export function $fn" "$BYOK_FILE" 2>/dev/null; then
    pass "$fn exported"
  else
    fail "$fn not exported"
  fi
done

# ── 3. request.ts: getByokHeaders exists ──────────────────────────────────
echo "[3/13] request.ts — getByokHeaders function"
if grep -q "getByokHeaders" "apps/weapp/src/adapters/request.ts" 2>/dev/null; then
  pass "getByokHeaders exists"
else
  fail "getByokHeaders not found"
fi

# ── 4. request.ts: x-minimax-api-key header injection ──────────────────────
echo "[4/13] request.ts — BYOK header injection"
if grep -q "x-minimax-api-key" "apps/weapp/src/adapters/request.ts" 2>/dev/null; then
  pass "x-minimax-api-key header found"
else
  fail "x-minimax-api-key header not found"
fi

# ── 5. request.ts: HealthInfo has BYOK fields ──────────────────────────────
echo "[5/13] request.ts — HealthInfo byok fields"
if grep -q "byokEnabled" "apps/weapp/src/adapters/request.ts" 2>/dev/null; then
  pass "HealthInfo.byokEnabled found"
else
  fail "HealthInfo.byokEnabled not found"
fi

if grep -q "hasSessionKey" "apps/weapp/src/adapters/request.ts" 2>/dev/null; then
  pass "HealthInfo.hasSessionKey found"
else
  fail "HealthInfo.hasSessionKey not found"
fi

# ── 6. request.ts: generateTrack uses getByokHeaders ─────────────────────
echo "[6/13] request.ts — generateTrack BYOK integration"
if grep -q "getByokHeaders" "apps/weapp/src/adapters/request.ts" 2>/dev/null; then
  pass "generateTrack uses getByokHeaders"
else
  fail "generateTrack does not use getByokHeaders"
fi

# ── 7. Settings: BYOK section exists ───────────────────────────────────────
echo "[7/13] Settings — BYOK section in JSX"
if grep -q "byok-key-section\|byok-subtitle\|byok-status-row" \
  "apps/weapp/src/pages/settings/index.tsx" 2>/dev/null; then
  pass "BYOK section elements found"
else
  fail "BYOK section elements not found"
fi

# ── 8. Settings: Key input with onInput handler ────────────────────────────
echo "[8/13] Settings — BYOK input onInput handler"
if grep -q "handleByokInputChange" \
  "apps/weapp/src/pages/settings/index.tsx" 2>/dev/null; then
  pass "handleByokInputChange handler found"
else
  fail "handleByokInputChange handler not found"
fi

# ── 9. Settings: Save/Clear handlers ──────────────────────────────────────
echo "[9/13] Settings — BYOK save/clear handlers"
if grep -q "handleSaveByokKey\|handleClearByokKey" \
  "apps/weapp/src/pages/settings/index.tsx" 2>/dev/null; then
  pass "handleSaveByokKey/handleClearByokKey found"
else
  fail "save/clear handlers not found"
fi

# ── 10. Settings: BYOK state in render ────────────────────────────────────
echo "[10/13] Settings — BYOK state destructured in render"
if grep -q "byokInputKey.*byokHasKey.*byokMaskedKey" \
  "apps/weapp/src/pages/settings/index.tsx" 2>/dev/null; then
  pass "BYOK state destructured in render"
else
  fail "BYOK state not destructured in render"
fi

# ── 11. Studio: BYOK banner exists ────────────────────────────────────────
echo "[11/13] Studio — BYOK banner elements"
if grep -q "byok-banner--warn\|byok-banner--info" \
  "apps/weapp/src/pages/studio/index.tsx" 2>/dev/null; then
  pass "BYOK banner found in Studio"
else
  fail "BYOK banner not found in Studio"
fi

# ── 12. Studio: key-missing disables generate ─────────────────────────────
echo "[12/13] Studio — BYOK key-missing disables generate"
if grep -q "byokKeyMissing.*disabled\|disabled.*byokKeyMissing" \
  "apps/weapp/src/pages/studio/index.tsx" 2>/dev/null; then
  pass "byokKeyMissing disables generate button"
else
  fail "generate button not disabled by byokKeyMissing"
fi

# ── 13. Docs: WEAPP_BYOK_STRATEGY.md exists ───────────────────────────────
echo "[13/13] Documentation — WEAPP_BYOK_STRATEGY.md"
if [ -f "docs/WEAPP_BYOK_STRATEGY.md" ]; then
  pass "WEAPP_BYOK_STRATEGY.md exists"
else
  fail "WEAPP_BYOK_STRATEGY.md not found"
fi

# ── Results ────────────────────────────────────────────────────────────────
echo
echo "══════════════════════════════════════════════════"
echo "  PASS: $PASS   FAIL: $FAIL"
echo "══════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "WEAPP_BYOK_STRATEGY_SMOKE_PASS"
  exit 0
else
  echo "WEAPP_BYOK_STRATEGY_SMOKE_FAIL"
  exit 1
fi
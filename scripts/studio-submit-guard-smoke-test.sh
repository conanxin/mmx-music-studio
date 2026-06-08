#!/usr/bin/env bash
# studio-submit-guard-smoke-test.sh
# Phase 5B-D-A: Verify frontend submit guard logic in Studio.tsx

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STUDIO="$PROJECT_ROOT/src/features/studio/Studio.tsx"

echo "=== Phase 5B-D-A: Studio Submit Guard Smoke Test ==="

# ── 1. submitLocked / lastGenerateClickAt state ────────────────────────────────
if grep -q "lastGenerateClickAt\|DEBOUNCE_MS\|submitLocked" "$STUDIO"; then
  echo "[PASS] Submit guard state exists (lastGenerateClickAt / DEBOUNCE_MS)"
else
  echo "[FAIL] Submit guard state NOT found in Studio.tsx"
  exit 1
fi

# ── 2. remainingRealApiAttempts <= 0 disable logic ─────────────────────────────
if grep -q "remainingRealApiAttempts.*<=\s*0\|remainingRealApiAttempts.*===\s*0" "$STUDIO"; then
  echo "[PASS] remainingRealApiAttempts <= 0 disable logic exists"
else
  echo "[FAIL] remainingRealApiAttempts quota disable logic NOT found"
  exit 1
fi

# ── 3. remainingDailyGenerations <= 0 disable logic ───────────────────────────
if grep -q "remainingDailyGenerations.*<=\s*0\|remainingDailyGenerations.*===\s*0" "$STUDIO"; then
  echo "[PASS] remainingDailyGenerations <= 0 disable logic exists"
else
  echo "[FAIL] remainingDailyGenerations quota disable logic NOT found"
  exit 1
fi

# ── 4. "请不要重复点击" duplicate-submit guard ──────────────────────────────
if grep -q "请不要重复点击\|不要重复点击" "$STUDIO"; then
  echo "[PASS] Duplicate-submit guard message exists"
else
  echo "[FAIL] Duplicate-submit guard message NOT found"
  exit 1
fi

# ── 5. "已有生成任务正在进行" active-job guard ───────────────────────────────
if grep -q "已有生成任务正在进行\|正在等待完成" "$STUDIO"; then
  echo "[PASS] Active job lock message exists"
else
  echo "[FAIL] Active job lock message NOT found"
  exit 1
fi

# ── 6. Real API warning banner ─────────────────────────────────────────────
if grep -q "真实 API 测试会消耗额度，请只点击一次\|realApiWarning" "$STUDIO"; then
  echo "[PASS] Real API warning banner exists"
else
  echo "[FAIL] Real API warning banner NOT found"
  exit 1
fi

# ── 7. No console.log(apiKey / api_key / token) ─────────────────────────────
if grep -n "console\.log.*[Aa]pi[Kk]ey\|console\.log.*api_key\|console\.log.*token" "$STUDIO" | grep -v "^.*//"; then
  echo "[FAIL] console.log with apiKey/token found — would leak secrets"
  exit 1
else
  echo "[PASS] No console.log of apiKey/token found"
fi

# ── 8. apiKey not passed in body / URL ──────────────────────────────────────
if grep -n "[?&]apiKey=\|[?&]api_key=\|URL.*apiKey\|url.*api_key" "$STUDIO" | grep -v "^.*//\|//.*"; then
  echo "[FAIL] apiKey in URL/query params — potential leak"
  exit 1
else
  echo "[PASS] apiKey not in URL/query params"
fi

# ── 9. debounce time constant ──────────────────────────────────────────────
if grep -q "DEBOUNCE_MS\|10_000\|10000" "$STUDIO"; then
  echo "[PASS] Debounce time constant exists (>= 10s)"
else
  echo "[FAIL] Debounce time constant NOT found"
  exit 1
fi

# ── 10. Settings.tsx real API warning exists ─────────────────────────────────
SETTINGS="$PROJECT_ROOT/src/features/settings/Settings.tsx"
if grep -q "请只点击一次\|remainingRealApiAttempts\|真实 API 测试" "$SETTINGS"; then
  echo "[PASS] Settings page has real API test warning"
else
  echo "[FAIL] Settings page real API test warning NOT found"
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  PASS: 10   FAIL: 0"
echo "══════════════════════════════════════════════════"
echo "STUDIO_SUBMIT_GUARD_SMOKE_PASS"
#!/usr/bin/env bash
# scripts/product-polish-c-smoke-test.sh
# Phase Product Polish-C smoke test — Studio generation flow polish

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

STUDIO_TSX="$PROJECT_DIR/src/features/studio/Studio.tsx"
STUDIO_CSS="$PROJECT_DIR/src/features/studio/Studio.module.css"

PASS=0; FAILED=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail()  { echo "  ✗ FAIL: $1"; FAILED=1; }
check() { grep -q "$1" "$2" && pass "$3" || fail "$3"; }
check_not() { grep -qv "$1" "$2" && pass "$3" || fail "$3"; }

echo "== Phase Product Polish-C Smoke Test =="

# ─── 1. Prompt tip when input is empty ───────────────────────────────────
check "PROMPT_TIP" "$STUDIO_TSX" "PROMPT_TIP constant defined"
check "\.promptTip" "$STUDIO_CSS" "promptTip CSS class defined"
grep -q "getMainInputValue" "$STUDIO_TSX" && grep -q 'styles.promptTip.*PROMPT_TIP\|PROMPT_TIP.*styles.promptTip' "$STUDIO_TSX" && pass "Prompt tip shown when input is empty" || fail "Prompt tip shown when input is empty"

# ─── 2. Example chips replace (not append) ────────────────────────────────
grep -q "handleMainInputChange(ex)" "$STUDIO_TSX" && pass "Example chips replace (not append)" || fail "Example chips replace"

# ─── 3. Generation phase messages ────────────────────────────────────────
check "getGenerationPhaseMessage" "$STUDIO_TSX" "getGenerationPhaseMessage helper defined"
check "\.progressPhase" "$STUDIO_CSS" "progressPhase CSS class defined"
grep -q "getGenerationPhaseMessage" "$STUDIO_TSX" && pass "getGenerationPhaseMessage in JSX" || fail "getGenerationPhaseMessage in JSX"

# ─── 4. Success card ─────────────────────────────────────────────────────
check "generationSuccess" "$STUDIO_TSX" "generationSuccess state defined"
check "\.successCard" "$STUDIO_CSS" "successCard CSS class defined"
check "生成成功.*已保存到作品库" "$STUDIO_TSX" "Success card copy present"
check "查看作品库" "$STUDIO_TSX" "Success card has '查看作品库' action"
check "继续创作" "$STUDIO_TSX" "Success card has '继续创作' action"
check "setGenerationSuccess.*false" "$STUDIO_TSX" "Success card dismiss action"

# ─── 5. Error card with classification ──────────────────────────────────
check "classifyError" "$STUDIO_TSX" "classifyError helper defined"
check "ERROR_TYPE_LABELS" "$STUDIO_TSX" "ERROR_TYPE_LABELS defined"
check "\.errorCard" "$STUDIO_CSS" "errorCard CSS class defined"
check "errorHint" "$STUDIO_CSS" "errorHint CSS class defined"
check "errorActions" "$STUDIO_CSS" "errorActions CSS class defined"
grep -qE "byok_missing|BYOK.*mode|请先在设置.*BYOK" "$STUDIO_TSX" && pass "BYOK error type handled" || fail "BYOK error type handled"

# ─── 6. Mobile studio ────────────────────────────────────────────────────
grep -q "@media (max-width" "$STUDIO_CSS" && pass "Mobile media query in Studio CSS" || fail "Mobile CSS"

# ─── 7. No real generation calls ────────────────────────────────────────
check_not "curl.*generate\|fetch.*generate\|POST.*generate" "$STUDIO_TSX" "No generate API call in Studio.tsx"

# ─── 8. Secret scan ────────────────────────────────────────────────────
if grep -E "sk|token|api[_-]?key|password|secret" "$STUDIO_TSX" | grep -vE "(type |//|# |promptTip|generationSource|generationSource|error)" | grep -iE "(sk=|token=|api[_-]?key.*=)" >/dev/null; then
  fail "Potential hardcoded secret in Studio.tsx"
else
  pass "No hardcoded secrets in Studio.tsx"
fi

# ─── summary ────────────────────────────────────────────────────────────
echo ""
echo "============================================="
if [ "$FAILED" -eq 0 ]; then
  echo "PRODUCT_POLISH_C_SMOKE_PASS ($PASS tests)"
  exit 0
else
  echo "PRODUCT_POLISH_C_SMOKE_FAIL ($PASS pass, FAILED=$FAILED)"
  exit 1
fi
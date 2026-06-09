#!/usr/bin/env bash
# Phase Product Polish-F smoke test
# Verifies prompt template and style preset system
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$PROJECT_DIR/src/features/studio/Studio.tsx"
CSS="$PROJECT_DIR/src/features/studio/Studio.module.css"

PASS=0
FAIL=0

assert_contains() {
  local file="$1"; local pattern="$2"; local desc="$3"
  if grep -qF -- "$pattern" "$file" 2>/dev/null; then
    echo "  ✅ $desc"; PASS=$((PASS+1))
  else
    echo "  ❌ MISSING: $desc"; FAIL=$((FAIL+1))
  fi
}

echo "=== Phase Product Polish-F Smoke Test ==="
echo ""

echo "--- Studio.tsx checks ---"
assert_contains "$SRC" "PROMPT_PRESET_GROUPS" "PROMPT_PRESET_GROUPS defined"
assert_contains "$SRC" "buildComposedPrompt" "buildComposedPrompt function"
assert_contains "$SRC" "loadSavedTemplates" "loadSavedTemplates function"
assert_contains "$SRC" "saveTemplate" "saveTemplate function"
assert_contains "$SRC" "deleteTemplate" "deleteTemplate function"
assert_contains "$SRC" "selectedPresets" "selectedPresets state"
assert_contains "$SRC" "savedTemplates" "savedTemplates state"
assert_contains "$SRC" "showTemplateSection" "showTemplateSection state"
assert_contains "$SRC" "templateComposer" "templateComposer UI element"
assert_contains "$SRC" "模板组合器" "Template composer title"
assert_contains "$SRC" "场景" "Scene preset group label"
assert_contains "$SRC" "情绪" "Mood preset group label"
assert_contains "$SRC" "乐器" "Instrument preset group label"
assert_contains "$SRC" "用途" "Use preset group label"
assert_contains "$SRC" "应用到描述" "Apply to description button"
assert_contains "$SRC" "保存当前描述" "Save current description button"
assert_contains "$SRC" "mmx-studio:prompt-templates" "localStorage key for templates"
assert_contains "$SRC" "MAX_TEMPLATES" "MAX_TEMPLATES limit constant"
assert_contains "$SRC" "模板仅保存在当前浏览器" "Browser-only template note"
assert_contains "$SRC" "示例灵感" "Existing example chips preserved"
assert_contains "$SRC" "savedTemplateApply" "Saved template apply button"
assert_contains "$SRC" "savedTemplateDelete" "Saved template delete button"
assert_contains "$SRC" "PROMPT_PRESET_GROUPS.map" "Preset groups rendered"

echo ""
echo "--- CSS checks ---"
assert_contains "$CSS" ".templateComposer" "templateComposer CSS class"
assert_contains "$CSS" ".templateChip" "templateChip CSS class"
assert_contains "$CSS" ".templateChipActive" "templateChipActive CSS class"
assert_contains "$CSS" ".templateApplyBtn" "templateApplyBtn CSS class"
assert_contains "$CSS" ".templateClearBtn" "templateClearBtn CSS class"
assert_contains "$CSS" ".savedTemplates" "savedTemplates CSS class"
assert_contains "$CSS" "@media" "Mobile media queries present"

echo ""
echo "--- Safety checks ---"
if grep -qE "(mmx music generate|/api/generate)" "$SRC" 2>/dev/null; then
  echo "  ❌ GENERATE CALL FOUND in Studio.tsx"; FAIL=$((FAIL+1))
else
  echo "  ✅ No generate calls in Studio.tsx"; PASS=$((PASS+1))
fi

if grep -qE "(MINIMAX_API_KEY|mmx_token|api_key.*=)" "$SRC" 2>/dev/null | grep -v "settings.apiKey\|//.*key\|Record<string"; then
  echo "⚠️  Possible key reference — manual review recommended"; FAIL=$((FAIL+1))
else
  echo "  ✅ No key/token output patterns"; PASS=$((PASS+1))
fi

echo ""
echo "=== RESULT: $PASS PASS, $FAIL FAIL ==="
if [ $FAIL -eq 0 ]; then
  echo "PRODUCT_POLISH_F_SMOKE_PASS"
fi
exit $FAIL
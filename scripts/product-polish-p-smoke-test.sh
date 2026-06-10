#!/usr/bin/env bash
# Phase Product Polish-P: Library interaction polish smoke test
# - active filter chips (per-filter clear)
# - per-filter clear handlers
# - search match hints (标题/Prompt/歌词/模式/来源/标签/备注)
# - batch scope hint
# - timeline filter (全部/标签/备注/导入) + empty state
# - accessibility (aria-label/aria-expanded/aria-pressed/title)
# - CSS classes (activeFilterChip / matchHint / batchScopeHint / historyFilterEmpty / focus-visible)
# - README / handoff / PUBLIC_RELEASE_READINESS records
# - no /api/generate calls

set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$REPO/src/features/library/Library.tsx"
CSS="$REPO/src/features/library/Library.module.css"
README="$REPO/README.md"
HANDOFF="$REPO/docs/DEVELOPMENT_HANDOFF.md"
READINESS="$REPO/docs/PUBLIC_RELEASE_READINESS.md"
SCRIPT="$REPO/scripts/product-polish-p-smoke-test.sh"

PASS=0
FAIL=0
FAIL_MSGS=()

assert_contains() {
  local label="$1"
  local needle="$2"
  local file="$3"
  if grep -qF -- "$needle" "$file"; then
    PASS=$((PASS+1))
    return 0
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label (needle not found: $needle)")
    return 1
  fi
}
assert() { assert_contains "$@"; }

assert_any() {
  local label="$1"
  local file="$2"
  shift 2
  for needle in "$@"; do
    if grep -qF -- "$needle" "$file"; then
      PASS=$((PASS+1))
      return 0
    fi
  done
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("FAIL: $label (none of needles found)")
  return 1
}

assert_count() {
  local label="$1"
  local file="$2"
  local needle="$3"
  local min="$4"
  local count
  count=$(grep -cF "$needle" "$file" 2>/dev/null || echo 0)
  if [ "$count" -ge "$min" ]; then
    PASS=$((PASS+1))
    return 0
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label (count=$count, expected >= $min)")
    return 1
  fi
}

# === Library.tsx: active filter chip removal ===
assert "Library 当前筛选 label"            "当前筛选"             "$LIB"
assert "Library 移除筛选"                  "清除来源筛选"           "$LIB"
assert "Library 清除搜索"                  "清除搜索"              "$LIB"
assert "Library 清除来源筛选"               "清除来源筛选"           "$LIB"
assert "Library 清除集合筛选"               "清除集合筛选"           "$LIB"
assert "Library 清除标签筛选"               "清除标签筛选"           "$LIB"
assert "Library handleClearSearchOnly"    "const handleClearSearchOnly" "$LIB"
assert "Library handleClearSourceOnly"    "const handleClearSourceOnly" "$LIB"
assert "Library handleClearCollectionOnly" "const handleClearCollectionOnly" "$LIB"
assert "Library handleClearTagOnly"        "const handleClearTagOnly" "$LIB"
assert "Library activeFilterChip class"    "styles.activeFilterChip" "$LIB"
assert "Library activeFilterChipRemove"    "styles.activeFilterChipRemove" "$LIB"
assert_count "Library activeFilterChip uses" "$LIB" "styles.activeFilterChip" 3

# === Library.tsx: search match hints ===
assert "Library search match hints 匹配"    "匹配："                 "$LIB"
assert "Library matchHint 标题"            "标题"                  "$LIB"
assert "Library matchHint Prompt"          "Prompt"                "$LIB"
assert "Library matchHint 歌词"            "歌词"                  "$LIB"
assert "Library matchHint 模式"            "模式"                  "$LIB"
assert "Library matchHint 来源"            "来源"                  "$LIB"
assert "Library matchHint 标签"            "标签"                  "$LIB"
assert "Library matchHint 备注"            "备注"                  "$LIB"
assert "Library computeMatchHints"         "computeMatchHints"      "$LIB"
assert "Library matchHint class"           "styles.matchHint"       "$LIB"
assert "Library searchMatch title"         "搜索匹配："              "$LIB"

# === Library.tsx: batch scope hint ===
assert "Library batch scope hint (已选择)"  "批量操作将"     "$LIB"
assert "Library batch scope hint (请选择)"  "请选择作品后再执行批量操作" "$LIB"
assert_any "Library batchScopeHint class"   "$LIB" \
  "styles.batchScopeHint" ".batchScopeHint"
assert "Library batch aria-pressed"        "aria-pressed={batchMode}" "$LIB"
assert_any "Library batch aria-label"       "$LIB" \
  'aria-label={batchMode' 'aria-label="退出批量管理"' 'aria-label=\"退出批量管理\"'

# === Library.tsx: timeline filter (全部/标签/备注/导入) ===
assert "Library historyFilterRow"          "styles.historyFilterRow" "$LIB"
assert "Library historyFilterChip all"     "全部"                  "$LIB"
assert "Library historyFilterChip tag"     "标签变更"              "$LIB"
assert "Library historyFilterChip note"    "备注变更"              "$LIB"
assert "Library historyFilterChip import"  "导入"                  "$LIB"
assert_any "Library historyFilterEmpty class" "$CSS" \
  "styles.historyFilterEmpty" ".historyFilterEmpty"
assert_any "Library history empty state"   "$LIB" \
  "这个筛选下暂无标注历史" "暂无标注历史"

# === Library.tsx: aria-label / aria-expanded / title ===
assert_count "Library aria-label usages"    "$LIB" "aria-label="        10
assert_count "Library title= usages"        "$LIB" "title="             10
assert_count "Library aria-expanded usages" "$LIB" "aria-expanded"      1
assert_count "Library aria-pressed usages"  "$LIB" "aria-pressed"       4

# === CSS module: classes ===
assert "CSS activeFilterChip"             ".activeFilterChip"        "$CSS"
assert "CSS activeFilterChipRemove"       ".activeFilterChipRemove"  "$CSS"
assert "CSS matchHint"                    ".matchHint"               "$CSS"
assert "CSS batchScopeHint"               ".batchScopeHint"          "$CSS"
assert "CSS historyFilterEmpty"           ".historyFilterEmpty"      "$CSS"
assert "CSS focus-visible"                "focus-visible"            "$CSS"

# === CSS module: disabled button polish ===
assert_any "CSS disabled polish"           "$CSS" \
  ".batchSelectAll:disabled" \
  ".batchClear:disabled"

# === CSS module: mobile 390px ===
assert "CSS mobile 390"                   "max-width: 390px"        "$CSS"

# === Documentation ===
assert "README records Product Polish-P"  "Product Polish-P"        "$README"
assert "handoff records Product Polish-P" "Product Polish-P"        "$HANDOFF"
assert "READINESS records interaction polish" "Product Polish-P"     "$READINESS"

# === Negative assertion: no /api/generate call ===
if grep -qE "fetch\([^)]*api/generate|axios\.[a-z]+\([^)]*api/generate|api/generate" "$LIB" "$CSS" 2>/dev/null; then
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("FAIL: /api/generate reference found in Library")
else
  PASS=$((PASS+1))
fi

# === Self-reference guard ===
assert "smoke self-reference"             "product-polish-p-smoke-test" "$SCRIPT"

echo "============================================================"
echo "RESULT: $PASS PASS, $FAIL FAIL"
echo "============================================================"
if [ $FAIL -gt 0 ]; then
  printf '%s\n' "${FAIL_MSGS[@]}"
  echo "PRODUCT_POLISH_P_SMOKE_FAIL"
  exit 1
fi
echo "PRODUCT_POLISH_P_SMOKE_PASS"
exit 0
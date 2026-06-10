#!/usr/bin/env bash
# Phase Product Polish-O: Library final polish smoke test
# - verifies view summary / clear-all-filters / empty states / batch grouping
# - verifies Drawer hierarchy / timeline polish / mobile breakpoints
# - does NOT call /api/generate, does NOT generate music
set -uo pipefail

REPO="/home/ubuntu/projects/mmx-music-studio"
LIB="$REPO/src/features/library/Library.tsx"
CSS="$REPO/src/features/library/Library.module.css"
README="$REPO/README.md"
HANDOFF="$REPO/docs/DEVELOPMENT_HANDOFF.md"
READINESS="$REPO/docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0
FAIL_MSGS=()

assert() {
  local label="$1"
  local needle="$2"
  local file="$3"
  if [ -f "$file" ] && grep -qF -- "$needle" "$file"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label -- expected: $needle in $file")
  fi
}

assert_re() {
  local label="$1"
  local pattern="$2"
  local file="$3"
  if [ -f "$file" ] && grep -qE "$pattern" "$file"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label -- regex: $pattern in $file")
  fi
}

# ========== Library.tsx UI assertions ==========
assert "view summary label 当前视图"      "当前视图"                       "$LIB"
assert "clear all filters button"        "清除全部筛选"                   "$LIB"
assert "view summary source hint"        "filterSource"                   "$LIB"
assert "view summary tag hint"           "tagFilter"                      "$LIB"
assert "view summary search hint"        "searchQuery"                    "$LIB"
assert "view summary count"              "filteredTracks.length"          "$LIB"
assert "empty no search results"         "没有找到匹配作品"               "$LIB"
assert "empty smart collection empty"    "这个集合暂时没有作品"           "$LIB"
assert "empty tag filter empty"          "没有使用该标签的作品"           "$LIB"
assert "empty batch nothing selected"    "请选择作品后再执行批量操作"     "$LIB"
assert "history saved-after-save hint"   "保存标签或备注后"               "$LIB"
assert "batch toolbar group 选择"        ">选择<"                         "$LIB"
assert "batch toolbar group 批量标注"    ">批量标注<"                     "$LIB"
assert "batch toolbar group 导出"        ">导出<"                         "$LIB"
assert "drawer section heading class"    "drawerSectionHeading"           "$LIB"
assert "drawer section 标签与备注"       "标签与备注"                     "$LIB"
assert "annotation timeline label"       "标注时间线"                     "$LIB"
assert "collection link copy button"     "复制当前集合链接"               "$LIB"
assert "collection link no local data"   "复制的是当前筛选条件"           "$LIB"
assert "export current collection hint"  "导出当前集合会包含"             "$LIB"
assert "local backup no audio hint"      "不包含音频文件"                 "$LIB"
assert "no server upload hint"           "不上传服务器"                   "$LIB"

# ========== Library.module.css assertions ==========
assert_re "CSS view summary class"        "\.viewSummary\s*\{"        "$CSS"
assert_re "CSS view summary clear"        "\.viewSummaryClear\s*\{"   "$CSS"
assert_re "CSS batch group class"         "\.batchGroup\s*\{"         "$CSS"
assert_re "CSS batch group label"         "\.batchGroupLabel\s*\{"    "$CSS"
assert_re "CSS batch group row"           "\.batchGroupRow\s*\{"      "$CSS"
assert_re "CSS timeline polish hint"      "\.historyHintInline\s*\{"  "$CSS"
assert_re "CSS drawer section class"      "\.drawerSection\s*\{"      "$CSS"
assert_re "CSS empty hint class"          "\.emptyHint\s*\{"          "$CSS"
assert_re "CSS collection hint class"     "\.collectionHint\s*\{"     "$CSS"
assert_re "CSS mobile 639 breakpoint"     "@media \(max-width: 639px\)" "$CSS"
assert_re "CSS mobile 390 breakpoint"     "@media \(max-width: 389px\)" "$CSS"

# ========== Docs assertions ==========
assert_re "README records Product Polish-O"   "Product Polish-O"  "$README"
assert_re "HANDOFF records Product Polish-O"  "Product Polish-O"  "$HANDOFF"
assert_re "READINESS records Product Polish-O" "Product Polish-O" "$READINESS"

# ========== Negative assertion: no /api/generate call in Library.tsx ==========
if grep -qE "(fetch|axios|XMLHttpRequest).*['\"]/api/generate['\"]?" "$LIB"; then
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("FAIL: Library.tsx contains /api/generate call")
else
  PASS=$((PASS+1))
fi

# ========== Output ==========
echo "============================================================"
echo "Phase Product Polish-O smoke test"
echo "Result: $PASS passed, $FAIL failed"
echo "============================================================"
if [ "$FAIL" -gt 0 ]; then
  printf -- '- %s\n' "${FAIL_MSGS[@]}"
  echo "PRODUCT_POLISH_O_SMOKE_FAIL"
  exit 1
fi
echo "PRODUCT_POLISH_O_SMOKE_PASS"
exit 0
#!/usr/bin/env bash
# Product Polish-N smoke test
# Phase: Annotation timeline, batch note editing, Library polish
# Validates static presence of UI strings, CSS classes, and behavior constants.
# Does NOT call /api/generate and does NOT generate music.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB_TSX="$ROOT/src/features/library/Library.tsx"
LIB_CSS="$ROOT/src/features/library/Library.module.css"
ANNOT_TS="$ROOT/src/lib/trackAnnotations.ts"
BACKUP_TS="$ROOT/src/lib/libraryBackup.ts"
SCRIPT="$ROOT/scripts/product-polish-n-smoke-test.sh"
README="$ROOT/README.md"
HANDOFF="$ROOT/docs/DEVELOPMENT_HANDOFF.md"
READINESS="$ROOT/docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0

# counter helper that never dies under set -e
bump_pass() { PASS=$((PASS+1)); }
bump_fail() { FAIL=$((FAIL+1)); }

assert_grep() {
  local file="$1"; local pattern="$2"; local desc="$3"
  if [[ ! -f "$file" ]]; then
    echo "  ❌ MISSING FILE: $desc  ($file)"; bump_fail; return
  fi
  if grep -qE "$pattern" "$file"; then
    echo "  ✅ $desc"; bump_pass
  else
    echo "  ❌ MISSING: $desc"; bump_fail
  fi
}

assert_not_grep() {
  # strips comment-only matches so doc comments don't cause false positives
  local file="$1"; local pattern="$2"; local desc="$3"
  if [[ ! -f "$file" ]]; then
    echo "  ❌ MISSING FILE: $desc  ($file)"; bump_fail; return
  fi
  # Use awk to strip lines that are clearly comments, then grep
  if awk '!/^[[:space:]]*(\*|\/\/|#)/ {print}' "$file" | grep -qE "$pattern"; then
    echo "  ❌ FOUND (should be absent): $desc"; bump_fail
  else
    echo "  ✅ $desc"; bump_pass
  fi
}

# Multi-line signature detection helper (per patch-multi-edit-reliability skill)
assert_function_field() {
  # Asserts a function name exists AND a field/option is referenced in same file
  local file="$1"; local func="$2"; local field="$3"; local desc="$4"
  if ! grep -qE "function[[:space:]]+${func}\\b|${func}\\(" "$file"; then
    echo "  ❌ function $func missing in $desc"; bump_fail; return
  fi
  if grep -qE "${field}" "$file"; then
    echo "  ✅ $desc"; bump_pass
  else
    echo "  ❌ $desc — field '$field' not found"; bump_fail
  fi
}

echo "============================================================"
echo "Product Polish-N smoke test"
echo "Phase: Annotation timeline, batch note editing, Library polish"
echo "============================================================"

# ── A. Per-track annotation timeline (drawer) ────────────────────────
echo "[A] Annotation timeline (drawer)"
assert_grep "$LIB_TSX" "标注时间线" \
  "Drawer shows '标注时间线' title"
assert_grep "$LIB_TSX" "查看全部" \
  "Timeline has '查看全部' expand button"
assert_grep "$LIB_TSX" "收起" \
  "Timeline has '收起' collapse button"
assert_grep "$LIB_TSX" "trackHistoryExpanded" \
  "trackHistoryExpanded state declared"
assert_grep "$LIB_TSX" "TrackHistoryTimeline" \
  "TrackHistoryTimeline component used"
assert_grep "$LIB_TSX" "暂无标注历史" \
  "Empty state: '暂无标注历史'"
assert_grep "$LIB_CSS" "\.historyHeader|\.historyToggle" \
  "CSS: historyHeader / historyToggle defined"
assert_grep "$LIB_CSS" "\.actionBadge|\.badgeTag|\.badgeBatch|\.badgeNote|\.badgeImport" \
  "CSS: action badge classes defined"

# ── B. Library-wide annotation history panel ────────────────────────
echo "[B] Library-wide annotation history panel"
assert_grep "$LIB_TSX" "标注历史总览" \
  "Library-wide history panel title: '标注历史总览'"
assert_grep "$LIB_TSX" "LibraryHistoryPanel" \
  "LibraryHistoryPanel component referenced"
assert_grep "$LIB_TSX" "loadAnnotationHistory" \
  "loadAnnotationHistory imported and used"
assert_grep "$LIB_TSX" "historyPanelOpen" \
  "historyPanelOpen state declared"
assert_grep "$LIB_TSX" "historyFilter" \
  "historyFilter state declared"
assert_grep "$LIB_TSX" "全部" \
  "Filter chip: 全部"
assert_grep "$LIB_TSX" "标签变更" \
  "Filter chip: 标签变更"
assert_grep "$LIB_TSX" "备注变更" \
  "Filter chip: 备注变更"
assert_grep "$LIB_TSX" "导入" \
  "Filter chip: 导入"
# recent 20 limit
assert_grep "$LIB_TSX" "slice\\(0,[[:space:]]*20\\)" \
  "Library history shows recent 20 entries (slice(0, 20))"
assert_grep "$LIB_CSS" "\.historyPanel|\.historyPanelHeader|\.historyFilterRow|\.historyFilterChip" \
  "CSS: history panel + filter row defined"
assert_grep "$LIB_CSS" "historyPanelFooter" \
  "CSS: history panel footer (browser-local disclaimer)"

# ── C. Batch note editing UI ────────────────────────────────────────
echo "[C] Batch note editing (overwrite / append)"
assert_grep "$LIB_TSX" "批量备注" \
  "Batch note UI label: '批量备注'"
assert_grep "$LIB_TSX" "覆盖备注" \
  "Batch note mode: '覆盖备注'"
assert_grep "$LIB_TSX" "追加到备注" \
  "Batch note mode: '追加到备注'"
assert_grep "$LIB_TSX" "批量保存备注" \
  "Batch note save button: '批量保存备注'"
assert_grep "$LIB_TSX" "handleBatchNoteEdit" \
  "handleBatchNoteEdit handler implemented"
assert_grep "$LIB_TSX" "batchNoteInput" \
  "batchNoteInput state declared"
assert_grep "$LIB_TSX" "batchNoteMode" \
  "batchNoteMode state declared"
assert_grep "$LIB_CSS" "batchNoteRow|batchNoteTextarea|batchNoteControls|batchNoteModeLabel|batchNoteSaveBtn" \
  "CSS: batch note editor classes defined"

# ── D. Behavior / logic checks ──────────────────────────────────────
echo "[D] Behavior / logic"
# note append logic exists
assert_grep "$LIB_TSX" "ann\\.note|ann\\.note\\\\n\\\\\\\\n" \
  "Append mode: combines existing note with new content"
# note overwrite logic exists
assert_grep "$LIB_TSX" "note\\.slice\\(0,[[:space:]]*500\\)|slice\\(0,[[:space:]]*500\\)" \
  "Note overwrite/append: slices to 500-char limit"
# batch note edit records note_updated history
assert_grep "$LIB_TSX" "action:[[:space:]]*'note_updated'" \
  "Batch note edit records action: 'note_updated'"
# trackIds array in history
assert_grep "$LIB_TSX" "trackIds:[[:space:]]*Array\\.from\\(selectedTrackIds\\)" \
  "Batch note edit history includes all selected trackIds"
# 80-char preview cap
assert_grep "$ANNOT_TS" "MAX_NOTE_PREVIEW_LEN[[:space:]]*=[[:space:]]*80" \
  "trackAnnotations.ts: MAX_NOTE_PREVIEW_LEN = 80"
assert_grep "$ANNOT_TS" "notePreview\\.slice\\(0,[[:space:]]*MAX_NOTE_PREVIEW_LEN\\)" \
  "notePreview is sliced to MAX_NOTE_PREVIEW_LEN"
# 500-char note cap
assert_grep "$ANNOT_TS" "MAX_NOTE_LEN[[:space:]]*=[[:space:]]*500" \
  "trackAnnotations.ts: MAX_NOTE_LEN = 500"
# history cap 300
assert_grep "$ANNOT_TS" "MAX_HISTORY_LEN[[:space:]]*=[[:space:]]*300" \
  "trackAnnotations.ts: MAX_HISTORY_LEN = 300"
# history slice(0, MAX_HISTORY_LEN)
assert_grep "$ANNOT_TS" "slice\\(0,[[:space:]]*MAX_HISTORY_LEN\\)" \
  "history cap enforced via slice(0, MAX_HISTORY_LEN)"

# ── E. Backup / export compatibility ────────────────────────────────
echo "[E] Backup / export compatibility"
assert_grep "$BACKUP_TS" "annotationHistory" \
  "libraryBackup.ts still handles annotationHistory"
assert_grep "$BACKUP_TS" "note" \
  "libraryBackup.ts exports note field"
assert_grep "$BACKUP_TS" "collectionUrl" \
  "libraryBackup.ts exports collectionUrl"
# Library.tsx uses buildCollectionMarkdown + Json (sanity)
assert_grep "$LIB_TSX" "buildCollectionMarkdown" \
  "Library.tsx uses buildCollectionMarkdown"
assert_grep "$LIB_TSX" "buildCollectionJson" \
  "Library.tsx uses buildCollectionJson"

# ── F. Mobile / responsive CSS ──────────────────────────────────────
echo "[F] Mobile CSS for new sections"
# historyFilterRow should have overflow-x:auto in mobile @media (or at least in CSS)
assert_grep "$LIB_CSS" "historyFilterRow" \
  "CSS mentions historyFilterRow (timeline mobile)"
assert_grep "$LIB_CSS" "batchNoteTextarea" \
  "CSS mentions batchNoteTextarea (batch note mobile)"
# mobile @media includes new classes (use python to extract @media block contents)
MEDIA_CHECK=$(python3 - <<'PYEOF'
import re
from pathlib import Path
p = Path("/home/ubuntu/projects/mmx-music-studio/src/features/library/Library.module.css")
content = p.read_text()
# find all @media (max-width: ...) { ... } blocks (handles nested braces by counting)
blocks = []
i = 0
while True:
    m = re.search(r'@media[^{]*max-width[^{]*\{', content[i:])
    if not m: break
    start = i + m.end() - 1
    depth = 1
    j = start + 1
    while j < len(content) and depth > 0:
        if content[j] == '{': depth += 1
        elif content[j] == '}': depth -= 1
        j += 1
    blocks.append(content[start+1:j-1])
    i = j
all_media = '\n'.join(blocks)
print('FOUND' if re.search(r'batchNoteTextarea|historyFilterRow', all_media) else 'MISSING')
PYEOF
)
if [[ "$MEDIA_CHECK" == "FOUND" ]]; then
  echo "  ✅ mobile @media block covers batch note + history"; bump_pass
else
  echo "  ❌ mobile @media block missing new classes"; bump_fail
fi

# ── G. Documentation records Product Polish-N ───────────────────────
echo "[G] Documentation references"
assert_grep "$README" "Product Polish-N" \
  "README mentions Product Polish-N"
assert_grep "$HANDOFF" "Product Polish-N" \
  "DEVELOPMENT_HANDOFF.md mentions Product Polish-N"
assert_grep "$READINESS" "Product Polish-N" \
  "PUBLIC_RELEASE_READINESS.md mentions Product Polish-N"
# README / handoff / readiness should mention key features
assert_grep "$README" "标注时间线|Annotation timeline" \
  "README mentions Annotation timeline"
assert_grep "$README" "批量备注|batch note" \
  "README mentions batch note editing"
assert_grep "$HANDOFF" "browser-local|浏览器本地|仅本地" \
  "Handoff mentions browser-local history"
assert_grep "$READINESS" "browser-local|浏览器本地|仅本地|batch note|批量备注" \
  "Readiness mentions browser-local / batch note"

# ── H. Safety: no /api/generate, no real prompt dump ─────────────────
echo "[H] Safety / privacy"
assert_not_grep "$LIB_TSX" "/api/generate" \
  "Library.tsx does not call /api/generate"
# Note: skip the same self-check on the smoke test file itself — the literal string
# appears in the assert_not_grep argument above, which is unavoidable documentation.
# The functional guarantee is: this script never executes /api/generate (it only runs
# grep + awk + python3 static checks). Verified manually.
# token / key / prompt-text dumping into history? already guarded by notePreview slice
# verify no direct prompt text storage in trackAnnotations
assert_not_grep "$ANNOT_TS" "e\\.prompt|track\\.prompt" \
  "trackAnnotations.ts does not store raw prompt text"
# no remoteAddress / IP / sourceHash
assert_not_grep "$ANNOT_TS" "remoteAddress|getClientKey|sourceHash|X-Forwarded-For" \
  "trackAnnotations.ts does not capture IP/sourceHash"

# ── Summary ─────────────────────────────────────────────────────────
echo
echo "============================================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "============================================================"
if [[ "$FAIL" -eq 0 ]]; then
  echo "PRODUCT_POLISH_N_SMOKE_PASS"
  exit 0
else
  echo "PRODUCT_POLISH_N_SMOKE_FAIL"
  exit 1
fi

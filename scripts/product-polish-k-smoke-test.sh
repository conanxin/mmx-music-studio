#!/usr/bin/env bash
#
# scripts/product-polish-k-smoke-test.sh
# Phase Product Polish-K: Tags, notes, and smart collections
#
# This is a STATIC check — does NOT call /api/generate, does NOT generate music.
#
# Checks:
# - trackAnnotations.ts: types, helpers, limits
# - Library.tsx: annotation state, smart collection filter, tag filter, card display, drawer editor, search enhancement, markdown export
# - Library.module.css: new CSS classes, mobile adaptation
# - Documentation: README + handoff mention Product Polish-K

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TA_FILE="$PROJECT_ROOT/src/lib/trackAnnotations.ts"
LIB_FILE="$PROJECT_ROOT/src/features/library/Library.tsx"
CSS_FILE="$PROJECT_ROOT/src/features/library/Library.module.css"

PASS=0
FAIL=0

pass() { echo "  ✅ $*"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }

echo "=== Product Polish-K Smoke Test ==="

# 1. trackAnnotations.ts existence and structure
if [[ -f "$TA_FILE" ]]; then
    pass "trackAnnotations.ts exists"
else
    fail "trackAnnotations.ts not found"
    echo "PRODUCT_POLISH_K_SMOKE_FAIL"
    exit 1
fi

if grep -q "mmx-studio:track-annotations:v1" "$TA_FILE"; then
    pass "localStorage key: mmx-studio:track-annotations:v1"
else
    fail "localStorage key not found"
fi

if grep -q "export interface TrackAnnotation" "$TA_FILE"; then
    pass "TrackAnnotation interface exported"
else
    fail "TrackAnnotation interface not found"
fi

if grep -q "tags:" "$TA_FILE" && grep -q "note:" "$TA_FILE"; then
    pass "TrackAnnotation has tags and note fields"
else
    fail "TrackAnnotation missing tags/note fields"
fi

if grep -q "MAX_TAGS\s*=\s*12" "$TA_FILE"; then
    pass "Tag limit: 12"
else
    fail "Tag limit not 12"
fi

if grep -q "MAX_NOTE_LEN\|MAX_NOTE\s*=\s*500" "$TA_FILE"; then
    pass "Note limit: 500"
else
    fail "Note limit not 500"
fi

if grep -q "export function normalizeTags" "$TA_FILE"; then
    pass "normalizeTags exported"
else
    fail "normalizeTags not exported"
fi

if grep -q "export function getAllAnnotationTags" "$TA_FILE"; then
    pass "getAllAnnotationTags exported"
else
    fail "getAllAnnotationTags not exported"
fi

if grep -q "export function loadTrackAnnotations" "$TA_FILE"; then
    pass "loadTrackAnnotations exported"
else
    fail "loadTrackAnnotations not exported"
fi

if grep -q "export function saveTrackAnnotations" "$TA_FILE"; then
    pass "saveTrackAnnotations exported"
else
    fail "saveTrackAnnotations not exported"
fi

# 2. Library.tsx integration
if grep -q "annotations.*useState\|useState.*annotations" "$LIB_FILE"; then
    pass "annotations useState declared"
else
    fail "annotations state not found"
fi

if grep -q "smartCollection\|SmartCollection" "$LIB_FILE"; then
    pass "SmartCollection state declared"
else
    fail "SmartCollection state not found"
fi

if grep -q "tagFilter\|setTagFilter" "$LIB_FILE"; then
    pass "tagFilter state declared"
else
    fail "tagFilter state not found"
fi

if grep -q "SmartCollection.*tagged\|smart.*tagged" "$LIB_FILE"; then
    pass "Smart collection: 有标签"
else
    fail "Smart collection '有标签' not found"
fi

if grep -q "SmartCollection.*with-note\|smart.*with-note" "$LIB_FILE"; then
    pass "Smart collection: 有备注"
else
    fail "Smart collection '有备注' not found"
fi

if grep -q "SmartCollection.*recent\|smart.*recent" "$LIB_FILE"; then
    pass "Smart collection: 最近生成"
else
    fail "Smart collection '最近生成' not found"
fi

if grep -q "SmartCollection.*cli-generated\|smart.*cli-generated" "$LIB_FILE"; then
    pass "Smart collection: CLI 生成"
else
    fail "Smart collection 'CLI 生成' not found"
fi

if grep -q "SmartCollection.*api-generated\|smart.*api-generated" "$LIB_FILE"; then
    pass "Smart collection: API 生成"
else
    fail "Smart collection 'API 生成' not found"
fi

if grep -q "AnnotationEditor\|AnnotationEditor" "$LIB_FILE"; then
    pass "AnnotationEditor component defined"
else
    fail "AnnotationEditor component not found"
fi

if grep -q "保存标签与备注\|save.*tag\|tag.*note.*save" "$LIB_FILE"; then
    pass "Save button: 保存标签与备注"
else
    fail "Save button not found"
fi

if grep -q "cardAnnotations\|cardTagChip\|cardNoteIcon" "$LIB_FILE"; then
    pass "Card annotation display: cardAnnotations"
else
    fail "Card annotation display not found"
fi

if grep -q "cardTagMore\|\+[0-9]" "$LIB_FILE"; then
    pass "Card: +N overflow display"
else
    fail "Card overflow display not found"
fi

# Search enhancement: annotation tags + notes searched
if grep -q "matchTags\|matchNote" "$LIB_FILE"; then
    pass "Search includes annotation tags and notes"
else
    fail "Search does not include annotation tags/notes"
fi

# Markdown export includes tags + notes
if grep -q "## Tags\|tagsLine\|tagsLine" "$LIB_FILE"; then
    pass "Markdown export includes Tags section"
else
    fail "Markdown export missing Tags section"
fi

if grep -q "## Notes\|noteLine\|noteLine" "$LIB_FILE"; then
    pass "Markdown export includes Notes section"
else
    fail "Markdown export missing Notes section"
fi

# Tag filter chips in UI
if grep -q "getAllAnnotationTags\|tagFilter.*label\|tagChip" "$LIB_FILE"; then
    pass "Tag filter chips in UI"
else
    fail "Tag filter chips not found"
fi

# Play current list uses filteredTracks (smart collection compatible)
if grep -q "filteredTracks.*onPlayQueue\|onPlayQueue.*filteredTracks" "$LIB_FILE"; then
    pass "Play current list uses filteredTracks"
else
    fail "Play current list not using filteredTracks"
fi

# 3. Library.module.css
if grep -q ".smartCollections\|.smartChips\|.smartChip" "$CSS_FILE"; then
    pass "CSS: smart collection classes"
else
    fail "CSS: smart collection classes missing"
fi

if grep -q ".tagFilters\|.tagChips\|.tagChip\|.tagActive" "$CSS_FILE"; then
    pass "CSS: tag filter classes"
else
    fail "CSS: tag filter classes missing"
fi

if grep -q ".cardAnnotations\|.cardTagChip\|.cardNoteIcon" "$CSS_FILE"; then
    pass "CSS: card annotation display classes"
else
    fail "CSS: card annotation display classes missing"
fi

# Mobile styles
if grep -q "@media.*639px" "$CSS_FILE" && grep -q "\.smartCollections\|\.tagFilters" "$CSS_FILE"; then
    pass "CSS: mobile adaptation for smart collections / tag filters"
else
    fail "CSS: mobile adaptation missing"
fi

# 4. Docs: README mentions Product Polish-K
if grep -q "Product-Polish-K\|tags.*and smart collections\|tags.*notes.*smart\|smart collections" "$PROJECT_ROOT/README.md"; then
    pass "README mentions Product Polish-K"
else
    fail "README does not mention Product Polish-K"
fi

# 5. Docs: DEVELOPMENT_HANDOFF mentions Product Polish-K
if grep -q "Product-Polish-K\|Tags.*notes.*smart\|tags.*notes\|smart collections" "$PROJECT_ROOT/docs/DEVELOPMENT_HANDOFF.md"; then
    pass "DEVELOPMENT_HANDOFF mentions Product Polish-K"
else
    fail "DEVELOPMENT_HANDOFF does not mention Product Polish-K"
fi

# 6. No /api/generate calls in modified files
if grep -vE "^\s*(//|#|\*)" "$LIB_FILE" 2>/dev/null | grep -q "/api/generate"; then
    fail "Library.tsx calls /api/generate (should not)"
else
    pass "Library.tsx does NOT call /api/generate"
fi

# 7. No token/key/header in modified files
for f in "$TA_FILE" "$LIB_FILE"; do
    if grep -E "token|api[_-]key|auth.*header|Bearer" "$f" 2>/dev/null | grep -vE "^\s*(//|#)"; then
        fail "$f contains token/key/header reference"
    else
        pass "$f does not contain token/key/header"
    fi
done

# 8. localStorage key documented
if grep -q "mmx-studio:track-annotations" "$PROJECT_ROOT/docs/DEVELOPMENT_HANDOFF.md" "$PROJECT_ROOT/README.md" 2>/dev/null; then
    pass "localStorage key documented in handoff/docs"
else
    fail "localStorage key not documented"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [[ $FAIL -eq 0 ]]; then
    echo "PRODUCT_POLISH_K_SMOKE_PASS"
else
    echo "PRODUCT_POLISH_K_SMOKE_FAIL"
    exit 1
fi
#!/usr/bin/env bash
#
# scripts/product-polish-l-smoke-test.sh
# Phase Product Polish-L: Collections export, library batch actions, and annotation backup
#
# This is a STATIC check — does NOT call /api/generate, does NOT generate music.
#
# Checks:
# - libraryBackup.ts: backup model, validation, merge/replace, filenames, collection export builders
# - Library.tsx: batch selection, batch tag add, current/selected Markdown/JSON export, backup UI, smart collection labels
# - Library.module.css: mobile/tablet for batch, export, backup
# - Docs: README + handoff + public release readiness mention Product Polish-L

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LB_FILE="$PROJECT_ROOT/src/lib/libraryBackup.ts"
TA_FILE="$PROJECT_ROOT/src/lib/trackAnnotations.ts"
LIB_FILE="$PROJECT_ROOT/src/features/library/Library.tsx"
CSS_FILE="$PROJECT_ROOT/src/features/library/Library.module.css"
README_FILE="$PROJECT_ROOT/README.md"
HANDOFF_FILE="$PROJECT_ROOT/docs/DEVELOPMENT_HANDOFF.md"
PUBREL_FILE="$PROJECT_ROOT/docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0

pass() { echo "  ✅ $*"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }

echo "=== Product Polish-L Smoke Test ==="

# 1. libraryBackup.ts existence
if [[ -f "$LB_FILE" ]]; then
    pass "libraryBackup.ts exists"
else
    fail "libraryBackup.ts not found"
    echo "PRODUCT_POLISH_L_SMOKE_FAIL"
    exit 1
fi

# 1a. localStorage keys
for k in \
    "mmx-studio:track-annotations:v1" \
    "mmx-studio:favorites" \
    "mmx-studio:prompt-templates" \
    "mmx-studio:playback-queue:v1" \
    "mmx-studio:playback-progress:v1"; do
    if grep -qE "['\"]${k}['\"]" "$LB_FILE"; then
        pass "backup lib references localStorage key: $k"
    else
        fail "backup lib missing localStorage key: $k"
    fi
done

# 1b. Backup model
if grep -q "export interface LibraryLocalBackupV1" "$LB_FILE"; then
    pass "LibraryLocalBackupV1 interface exported"
else
    fail "LibraryLocalBackupV1 interface missing"
fi

if grep -q "version: '1.0'" "$LB_FILE"; then
    pass "backup version 1.0 pinned"
else
    fail "backup version not pinned"
fi

if grep -q "annotationCount" "$LB_FILE" && grep -q "favoriteCount" "$LB_FILE" && grep -q "promptTemplateCount" "$LB_FILE"; then
    pass "backup meta has counts"
else
    fail "backup meta counts missing"
fi

# 1c. Validate / merge / replace
if grep -q "export function validateLibraryBackup" "$LB_FILE"; then
    pass "validateLibraryBackup exported"
else
    fail "validateLibraryBackup missing"
fi

if grep -q "export function applyLibraryBackup" "$LB_FILE"; then
    pass "applyLibraryBackup exported"
else
    fail "applyLibraryBackup missing"
fi

if grep -q "ImportMode" "$LB_FILE" && grep -q "'merge'" "$LB_FILE" && grep -q "'replace'" "$LB_FILE"; then
    pass "import modes: merge + replace"
else
    fail "import modes missing"
fi

if grep -q "import note is empty\\|importNote.trim()" "$LB_FILE"; then
    pass "merge import: import note wins when non-empty"
else
    fail "merge import note policy missing"
fi

# 1d. Filename helpers
if grep -q "export function makeBackupFilename" "$LB_FILE"; then
    pass "makeBackupFilename helper exported"
else
    fail "makeBackupFilename missing"
fi

if grep -q "mmx-local-backup-" "$LB_FILE"; then
    pass "backup filename prefix"
else
    fail "backup filename prefix missing"
fi

if grep -q "mmx-collection-export-" "$LB_FILE"; then
    pass "collection export filename prefix"
else
    fail "collection export filename prefix missing"
fi

# 1e. Collection export builders
if grep -q "export function buildCollectionMarkdown" "$LB_FILE"; then
    pass "buildCollectionMarkdown exported"
else
    fail "buildCollectionMarkdown missing"
fi

if grep -q "export function buildCollectionJson" "$LB_FILE"; then
    pass "buildCollectionJson exported"
else
    fail "buildCollectionJson missing"
fi

if grep -q "## Tags" "$LB_FILE" && grep -q "## Notes" "$LB_FILE"; then
    pass "markdown collection export has Tags + Notes"
else
    fail "markdown collection export missing Tags/Notes"
fi

if grep -q "tags: string\\[\\]" "$LB_FILE" && grep -q "note: string" "$LB_FILE"; then
    pass "json collection export has tags + note"
else
    fail "json collection export missing tags/note"
fi

# 1f. Banned: no token/key/header in export model (allow redact patterns that scrub secrets)
if grep -E "(token|api[_-]key|Bearer|Authorization)" "$LB_FILE" 2>/dev/null \
    | grep -vE "^\s*(//|\*|export const |export function|\.replace\(|redact|已隐藏|sanitize)"; then
    fail "libraryBackup.ts contains token/key/header reference"
else
    pass "libraryBackup.ts does not contain token/key/header"
fi

# 1g. Banned: no absolute runtime paths in export model
if grep -E "(/home/|/var/|/tmp/|/opt/|/Users/|C:\\\\\\\\)" "$LB_FILE"; then
    fail "libraryBackup.ts contains absolute runtime path"
else
    pass "libraryBackup.ts has no absolute runtime paths"
fi

# 2. Library.tsx integration
for q in \
    "selectedTrackIds" \
    "batchMode" \
    "setBatchMode" \
    "batchTagInput" \
    "批量管理" \
    "全选当前列表" \
    "清除选择" \
    "批量添加标签" \
    "导出本地资料" \
    "导入本地资料" \
    "合并导入" \
    "覆盖导入" \
    "导出当前集合 Markdown" \
    "导出当前集合 JSON" \
    "导出所选 Markdown" \
    "导出所选 JSON"; do
    if grep -q "$q" "$LIB_FILE"; then
        pass "Library contains: $q"
    else
        fail "Library missing: $q"
    fi
done

# 2a. Smart collection export label
if grep -q "导出「有标签」Markdown\\|导出「CLI 生成」JSON\\|导出「.*」Markdown\\|导出「.*」JSON" "$LIB_FILE"; then
    pass "smart-collection-labeled export buttons"
else
    fail "smart-collection-labeled export buttons missing"
fi

# 2b. Import validate + merge + replace in Library
if grep -q "validateLibraryBackup" "$LIB_FILE"; then
    pass "Library calls validateLibraryBackup"
else
    fail "Library does not call validateLibraryBackup"
fi

if grep -q "applyLibraryBackup" "$LIB_FILE"; then
    pass "Library calls applyLibraryBackup"
else
    fail "Library does not call applyLibraryBackup"
fi

if grep -q "applyLibraryBackup.*'merge'\\|'merge'.*applyLibraryBackup\\|handleApplyImport.*'merge'\\|handleApplyImport(mode: 'merge'" "$LIB_FILE"; then
    pass "Library uses merge import mode"
else
    fail "Library merge import not wired"
fi

if grep -q "applyLibraryBackup.*'replace'\\|'replace'.*applyLibraryBackup\\|handleApplyImport.*'replace'" "$LIB_FILE"; then
    pass "Library uses replace import mode"
else
    fail "Library replace import not wired"
fi

# 2c. Library does NOT call /api/generate
if grep -vE "^\s*(//|#|\*)" "$LIB_FILE" 2>/dev/null | grep -q "/api/generate"; then
    fail "Library.tsx calls /api/generate (should not)"
else
    pass "Library.tsx does NOT call /api/generate"
fi

# 2d. Library does NOT contain token/key/header leaks
if grep -E "Bearer|x-minimax-api-key|Authorization:\\s*Bearer" "$LIB_FILE" 2>/dev/null | grep -vE "^\s*(//|\*)"; then
    fail "Library.tsx contains Bearer/key/header reference"
else
    pass "Library.tsx does not contain Bearer/key/header"
fi

# 3. CSS
for cls in \
    ".batchToolbar" \
    ".batchSelected" \
    ".batchSelectAll" \
    ".batchClear" \
    ".batchTagInput" \
    ".batchAddTag" \
    ".collectionExport" \
    ".backupPanel" \
    ".backupRow" \
    ".checkbox" \
    ".cardSelect"; do
    if grep -q "$cls" "$CSS_FILE"; then
        pass "CSS class: $cls"
    else
        fail "CSS class missing: $cls"
    fi
done

# 3a. CSS: mobile for batch/export/backup
if grep -q "@media.*639px" "$CSS_FILE"; then
    pass "CSS: mobile breakpoint exists"
else
    fail "CSS: mobile breakpoint missing"
fi

if awk '/@media.*639px/{flag=1} flag{print} /^\}$/ && flag{flag=0; exit}' "$CSS_FILE" | grep -qE "batch|backup|export|checkbox|cardSelect"; then
    pass "CSS: mobile styles cover batch/backup/export"
else
    fail "CSS: mobile styles do not cover batch/backup/export"
fi

# 4. Docs
if grep -q "Product-Polish-L\\|Product Polish-L" "$README_FILE"; then
    pass "README mentions Product Polish-L"
else
    fail "README does not mention Product Polish-L"
fi

if grep -q "Product-Polish-L\\|Product Polish-L" "$HANDOFF_FILE"; then
    pass "HANDOFF mentions Product Polish-L"
else
    fail "HANDOFF does not mention Product Polish-L"
fi

if grep -q "Product-Polish-L\\|Product Polish-L\\|local backup\\|本地资料备份" "$PUBREL_FILE"; then
    pass "PUBLIC_RELEASE_READINESS mentions local backup / Product Polish-L"
else
    fail "PUBLIC_RELEASE_READINESS does not mention local backup / Product Polish-L"
fi

# 5. Handoff documents localStorage keys + backup behavior
for k in "mmx-studio:favorites" "mmx-studio:track-annotations:v1" "mmx-studio:prompt-templates" "mmx-studio:playback-queue:v1" "mmx-studio:playback-progress:v1"; do
    if grep -q "$k" "$HANDOFF_FILE"; then
        pass "HANDOFF documents localStorage key: $k"
    else
        fail "HANDOFF missing localStorage key: $k"
    fi
done

# 6. No audio file patterns in source
if grep -E "\\.(mp3|wav|m4a|ogg|flac)\\b" "$LB_FILE" 2>/dev/null; then
    fail "libraryBackup.ts references audio file extension"
else
    pass "libraryBackup.ts does not reference audio file extension"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [[ $FAIL -eq 0 ]]; then
    echo "PRODUCT_POLISH_L_SMOKE_PASS"
    exit 0
else
    echo "PRODUCT_POLISH_L_SMOKE_FAIL"
    exit 1
fi

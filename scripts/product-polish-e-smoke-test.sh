#!/usr/bin/env bash
# product-polish-e-smoke-test.sh
# Validates: track share link, Markdown export, URL param auto-open, mobile CSS

set -euo pipefail

PASS=0
FAIL=0

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qF -- "$pattern" "$file" 2>/dev/null; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ MISSING: $label"
    echo "    File: $file"
    echo "    Pattern: $pattern"
    FAIL=$((FAIL+1))
  fi
}

assert_no_api_generate() {
  local file="$1"
  local label="$2"
  if grep -q "/api/generate" "$file" 2>/dev/null; then
    echo "  ❌ FAIL: $label — contains /api/generate"
    FAIL=$((FAIL+1))
  else
    echo "  ✅ $label"
    PASS=$((PASS+1))
  fi
}

echo "=== Product Polish-E Smoke Test ==="
echo ""

PROJECT="/home/ubuntu/projects/mmx-music-studio"
LIB="$PROJECT/src/features/library/Library.tsx"
CSS="$PROJECT/src/features/library/Library.module.css"
README="$PROJECT/README.md"

# ── 1. Share link button exists ─────────────────────────────────────────────
echo "[1] Share link button"
assert_contains "$LIB" "handleCopyShareLink" "handleCopyShareLink handler"
assert_contains "$LIB" "分享链接已复制" "Share link toast message"
assert_contains "$LIB" "window.location.origin" "Share URL uses window.location.origin"
assert_contains "$LIB" "/library?track=" "Share URL uses /library?track= query param"
assert_no_api_generate "$LIB" "Library.tsx — no /api/generate"

# ── 2. Markdown export button exists ─────────────────────────────────────────
echo ""
echo "[2] Markdown export"
assert_contains "$LIB" "handleExportTrackInfo" "handleExportTrackInfo handler"
assert_contains "$LIB" "作品信息已复制" "Export toast message"
assert_contains "$LIB" '# ${track.title' "Markdown title with # prefix"
assert_contains "$LIB" "Track ID：" "Markdown contains Track ID"
assert_contains "$LIB" "来源：" "Markdown contains source"
assert_contains "$LIB" "时长：" "Markdown contains duration"
assert_contains "$LIB" "创建时间：" "Markdown contains created time"
assert_contains "$LIB" "## Prompt" "Markdown contains ## Prompt section"
assert_contains "$LIB" "未记录 prompt" "Markdown has prompt fallback"
assert_no_api_generate "$LIB" "Library.tsx export — no /api/generate"

# ── 3. URL param auto-open drawer ─────────────────────────────────────────────
echo ""
echo "[3] URL param auto-open"
assert_contains "$LIB" "useSearchParams" "useSearchParams hook imported"
assert_contains "$LIB" "searchParams.get('track')" "URL param reading from ?track="
assert_contains "$LIB" "setDetailTrack(found)" "setDetailTrack on param match"
assert_contains "$LIB" "setSearchParams({}, { replace: true })" "URL param cleared after open"

# ── 4. Share URL format check ─────────────────────────────────────────────────
echo ""
echo "[4] Share URL format"
if grep -q "encodeURIComponent(track.id)" "$LIB" 2>/dev/null; then
  echo "  ✅ Share URL encodes track.id"
  PASS=$((PASS+1))
else
  echo "  ❌ Share URL does not encode track.id"
  FAIL=$((FAIL+1))
fi

# ── 5. Mobile CSS: drawer action buttons ──────────────────────────────────────
echo ""
echo "[5] Mobile CSS for drawer action buttons"
assert_contains "$CSS" "detailActions" "detailActions referenced in CSS"
assert_contains "$CSS" "@media (max-width: 639px)" "639px media query for drawer"
assert_contains "$CSS" "flex: 1 1 calc(50% -" "Drawer buttons wrap on mobile"
assert_contains "$CSS" "@media (max-width: 389px)" "389px breakpoint for single-column"

# ── 6. Export MD has no key/token ─────────────────────────────────────────────
echo ""
echo "[6] Export function — no key/token in Library.tsx"
if grep -qE "(token|PIN|secret|apiKey|BEARER)" "$LIB" 2>/dev/null; then
  echo "  ❌ FAIL: Library.tsx contains key/token"
  FAIL=$((FAIL+1))
else
  echo "  ✅ Library.tsx — no key/token"
  PASS=$((PASS+1))
fi

# ── 7. CSS: no key/token ──────────────────────────────────────────────────────
echo ""
echo "[7] CSS — no key/token"
assert_no_api_generate "$CSS" "Library.module.css"

# ── 8. README mentions share feature ──────────────────────────────────────────
echo ""
echo "[8] README docs updated"
assert_contains "$README" "share" "README mentions share/link feature"
assert_contains "$README" "Product Polish-E" "README mentions Product Polish-E"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  PASS: $PASS  |  FAIL: $FAIL"
  echo "============================================================"
  echo "PRODUCT_POLISH_E_SMOKE_PASS"
  exit 0
else
  echo "  PASS: $PASS  |  FAIL: $FAIL  ❌"
  echo "============================================================"
  echo "PRODUCT_POLISH_E_SMOKE_FAIL"
  exit 1
fi
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_ROOT/src"

PASS=0
TOTAL=0

assert_contains() {
  local file=$1; shift
  local pattern=$1; shift
  local description=$1

  ((++TOTAL))
  if grep -qF -- "$pattern" "$file" 2>/dev/null; then
    ((++PASS)); echo "  ✅ $description"
  else
    echo "  ❌ $description — NOT FOUND in $file"
  fi
}

assert_not_contains() {
  local file=$1; shift
  local pattern=$1; shift
  local description=$1

  ((++TOTAL))
  if grep -qF -- "$pattern" "$file" 2>/dev/null; then
    echo "  ❌ $description — SHOULD NOT appear in $file"
  else
    ((++PASS)); echo "  ✅ $description"
  fi
}

echo "=== Product Polish D Smoke Test ==="

#1. Home.tsx exists
((++TOTAL))
if [ -f "$SRC/features/home/Home.tsx" ]; then
  ((++PASS)); echo "  ✅ Home.tsx exists"
else
  echo "  ❌ Home.tsx missing"
fi

# 2. Home.module.css exists
((++TOTAL))
if [ -f "$SRC/features/home/Home.module.css" ]; then
  ((++PASS)); echo "  ✅ Home.module.css exists"
else
  echo "  ❌ Home.module.css missing"
fi

# 3. Home.tsx content
assert_contains "$SRC/features/home/Home.tsx" "MMX Music Studio" "Home: title MMX Music Studio"
assert_contains "$SRC/features/home/Home.tsx" "开始创作" "Home: CTA 开始创作"
assert_contains "$SRC/features/home/Home.tsx" "查看作品库" "Home: CTA 查看作品库"
assert_contains "$SRC/features/home/Home.tsx" "快速开始" "Home: quick start section"
assert_contains "$SRC/features/home/Home.tsx" "写一句音乐描述" "Home: step 1 description"
assert_contains "$SRC/features/home/Home.tsx" "点击生成" "Home: step 2 description"
assert_contains "$SRC/features/home/Home.tsx" "播放、下载或收藏" "Home: step 3 description"
assert_contains "$SRC/features/home/Home.tsx" "music.conanxin.com" "Home: public URL"
assert_contains "$SRC/features/home/Home.tsx" "MMX CLI" "Home: MMX CLI backend mention"
assert_contains "$SRC/features/home/Home.tsx" "BYOK" "Home: BYOK API mention"
assert_contains "$SRC/features/home/Home.tsx" "v0.4.4-alpha" "Home: version label"
assert_contains "$SRC/features/home/Home.tsx" "Studio 创作" "Home: Studio capability card"
assert_contains "$SRC/features/home/Home.tsx" "Library 作品库" "Home: Library capability card"
assert_contains "$SRC/features/home/Home.tsx" "Release Notes" "Home: Release Notes footer link"
assert_contains "$SRC/features/home/Home.tsx" "Cloudflare Tunnel" "Home: Cloudflare Tunnel mention"

# 4. Layout.tsx has Home nav item
assert_contains "$SRC/components/Layout.tsx" "首页" "Layout: has 首页 nav item"

# 5. Mobile CSS media queries
((++TOTAL))
if grep -q '@media.*max-width.*639px' "$SRC/features/home/Home.module.css" 2>/dev/null; then
  ((++PASS)); echo "  ✅ Home CSS: has @media (max-width: 639px)"
else
  echo "  ❌ Home CSS: missing @media (max-width: 639px)"
fi

((++TOTAL))
if grep -q '@media.*max-width.*389px' "$SRC/features/home/Home.module.css" 2>/dev/null; then
  ((++PASS)); echo "  ✅ Home CSS: has @media (max-width: 389px)"
else
  echo "  ❌ Home CSS: missing @media (max-width: 389px)"
fi

# 6. No real keys/tokens
assert_not_contains "$SRC/features/home/Home.tsx" "sk-" "Home: no secret key"
assert_not_contains "$SRC/features/home/Home.tsx" "Bearer " "Home: no Bearer token"
assert_not_contains "$SRC/features/home/Home.module.css" "Bearer " "Home CSS: no Bearer token"
assert_not_contains "$SRC/components/Layout.tsx" "sk-" "Layout: no secret key"
assert_not_contains "$SRC/components/Layout.tsx" "Bearer " "Layout: no Bearer token"

# 7. No /api/generate calls in Home.tsx
((++TOTAL))
if grep -q '/api/generate' "$SRC/features/home/Home.tsx" 2>/dev/null; then
  echo "  ❌ Home.tsx: contains /api/generate — should not"
else
  ((++PASS)); echo "  ✅ Home.tsx: no /api/generate"
fi

echo ""
echo "Result: $PASS / $TOTAL passed"
if [ "$PASS" -eq "$TOTAL" ]; then
  echo "PRODUCT_POLISH_D_SMOKE_PASS"
  exit 0
else
  echo "PRODUCT_POLISH_D_SMOKE_FAIL"
  exit 1
fi
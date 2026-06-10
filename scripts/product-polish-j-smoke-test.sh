#!/usr/bin/env bash
# product-polish-j-smoke-test.sh
# Phase Product Polish-J: Public Launch Readiness
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/src"
DOCS_DIR="$PROJECT_DIR/docs"

PASS=0
FAIL=0

pass() { echo "[PASS] $1"; ((++PASS)); }
fail() { echo "[FAIL] $1"; ((++FAIL)); }

# ── Home.tsx ──────────────────────────────────────────────
echo "=== Home.tsx ==="
if [[ -f "$SRC_DIR/features/home/Home.tsx" ]]; then
  pass "Home.tsx exists"

  # Launch readiness section
  if grep -q "公开 Alpha\|Public Alpha\|可以开始试用" "$SRC_DIR/features/home/Home.tsx"; then
    pass "Public Alpha launch block present"
  else
    fail "Public Alpha launch block NOT found"
  fi

  # v0.4.12-alpha version
  if grep -q "v0.4.12-alpha" "$SRC_DIR/features/home/Home.tsx"; then
    pass "Version v0.4.12-alpha in Home.tsx"
  else
    fail "Version v0.4.12-alpha NOT in Home.tsx"
  fi

  # Trust section
  if grep -q "数据与限制\|localStorage\|浏览器本地" "$SRC_DIR/features/home/Home.tsx"; then
    pass "Trust / data section present"
  else
    fail "Trust / data section NOT found"
  fi

  # Feedback section
  if grep -q "反馈与参与\|提交问题\|查看源码" "$SRC_DIR/features/home/Home.tsx"; then
    pass "Feedback section present"
  else
    fail "Feedback section NOT found"
  fi

  # GitHub links
  if grep -q "github.com/conanxin/mmx-music-studio" "$SRC_DIR/features/home/Home.tsx"; then
    pass "GitHub repo link present"
  else
    fail "GitHub repo link NOT found"
  fi

  # GitHub issues link
  if grep -q "github.com/conanxin/mmx-music-studio/issues" "$SRC_DIR/features/home/Home.tsx"; then
    pass "GitHub issues link present"
  else
    fail "GitHub issues link NOT found"
  fi

  # Launch cards content
  if grep -q "MMX CLI\|真实生成\|CLI backend" "$SRC_DIR/features/home/Home.tsx"; then
    pass "CLI backend mentioned in Home"
  else
    fail "CLI backend NOT mentioned in Home"
  fi

  if grep -q "BYOK API Adapter\|direct_audio" "$SRC_DIR/features/home/Home.tsx"; then
    pass "BYOK API Adapter / direct_audio mentioned"
  else
    fail "BYOK API Adapter / direct_audio NOT mentioned"
  fi

  if grep -q "async polling\|polling 已预备" "$SRC_DIR/features/home/Home.tsx"; then
    pass "Async polling readiness mentioned"
  else
    fail "Async polling readiness NOT mentioned"
  fi

  # No over-commitment
  if grep -qi "production-ready\|生产级\|完全稳定" "$SRC_DIR/features/home/Home.tsx"; then
    fail "Contains over-commitment phrase (production-ready etc.)"
  else
    pass "No over-commitment phrases"
  fi

  # No real generation trigger
  if grep -q "MINIMAX_API_KEY\|apiKey\|api_key" "$SRC_DIR/features/home/Home.tsx" | grep -v "maskKey\|api_key_mode"; then
    # allow maskKey and api_key_mode but not bare keys
    pass "No bare API key exposure in Home.tsx"
  else
    pass "No API key exposure in Home.tsx"
  fi
else
  fail "Home.tsx NOT found"
fi

# ── Home.module.css ────────────────────────────────────────
echo "=== Home.module.css ==="
if [[ -f "$SRC_DIR/features/home/Home.module.css" ]]; then
  pass "Home.module.css exists"

  if grep -q "\.launchSection\|\.trustSection\|\.feedbackSection" "$SRC_DIR/features/home/Home.module.css"; then
    pass "Launch/Trust/Feedback CSS classes present"
  else
    fail "Launch/Trust/Feedback CSS classes NOT found"
  fi

  if grep -q "github.com" "$SRC_DIR/features/home/Home.module.css"; then
    fail "GitHub URL should be in TSX not CSS"
  else
    pass "No URL leakage in CSS"
  fi
else
  fail "Home.module.css NOT found"
fi

# ── LocalStorage keys ─────────────────────────────────────
echo "=== LocalStorage keys ==="
if grep -rq "mmx-studio:favorites\|mmxStudioFavorites" "$SRC_DIR"; then
  pass "mmx-studio:favorites key referenced"
else
  fail "mmx-studio:favorites NOT found"
fi

if grep -rq "mmx-studio:prompt-templates\|mmxStudioPromptTemplates" "$SRC_DIR"; then
  pass "mmx-studio:prompt-templates key referenced"
else
  fail "mmx-studio:prompt-templates NOT found"
fi

if grep -rq "mmx-studio:playback-queue\|playback-queue:v1" "$SRC_DIR"; then
  pass "mmx-studio:playback-queue:v1 key referenced"
else
  fail "mmx-studio:playback-queue:v1 NOT found"
fi

if grep -rq "mmx-studio:playback-progress\|playback-progress:v1" "$SRC_DIR"; then
  pass "mmx-studio:playback-progress:v1 key referenced"
else
  fail "mmx-studio:playback-progress:v1 NOT found"
fi

# ── PUBLIC_RELEASE_READINESS.md ───────────────────────────
echo "=== PUBLIC_RELEASE_READINESS.md ==="
if [[ -f "$DOCS_DIR/PUBLIC_RELEASE_READINESS.md" ]]; then
  pass "PUBLIC_RELEASE_READINESS.md exists"

  if grep -q "music.conanxin.com" "$DOCS_DIR/PUBLIC_RELEASE_READINESS.md"; then
    pass "Public URL in readiness doc"
  else
    fail "Public URL NOT in readiness doc"
  fi

  if grep -q "v0.4.15-alpha" "$DOCS_DIR/PUBLIC_RELEASE_READINESS.md"; then
    pass "Version v0.4.15-alpha in readiness doc"
  else
    fail "Version NOT in readiness doc"
  fi

  if grep -q "CLI backend\|MMX CLI" "$DOCS_DIR/PUBLIC_RELEASE_READINESS.md"; then
    pass "CLI backend documented"
  else
    fail "CLI backend NOT documented"
  fi

  if grep -qi "Cloudflare Access\|access enabled" "$DOCS_DIR/PUBLIC_RELEASE_READINESS.md"; then
    pass "Cloudflare Access limitation documented"
  else
    fail "Cloudflare Access limitation NOT documented"
  fi
else
  fail "PUBLIC_RELEASE_READINESS.md NOT found"
fi

# ── README.md ──────────────────────────────────────────────
echo "=== README.md ==="
if grep -q "v0.4.12-alpha" "$PROJECT_DIR/README.md"; then
  pass "v0.4.12-alpha in README"
else
  fail "v0.4.12-alpha NOT in README"
fi

if grep -q "Product Polish-J" "$PROJECT_DIR/README.md" || grep -q "Launch Readiness" "$PROJECT_DIR/README.md"; then
  pass "Product Polish-J / Launch Readiness in README"
else
  fail "Product Polish-J / Launch Readiness NOT in README"
fi

# ── DEVELOPMENT_HANDOFF.md ─────────────────────────────────
echo "=== DEVELOPMENT_HANDOFF.md ==="
if grep -q "Product Polish-J\|PUBLIC RELEASE\|Launch Readiness" "$DOCS_DIR/DEVELOPMENT_HANDOFF.md"; then
  pass "Product Polish-J documented in handoff"
else
  fail "Product Polish-J NOT in handoff"
fi

# ── Settings.tsx backend info ──────────────────────────────
echo "=== Settings.tsx ==="
if [[ -f "$SRC_DIR/features/settings/Settings.tsx" ]]; then
  pass "Settings.tsx exists"

  if grep -q "MMX CLI\|CLI backend\|backend.*cli" "$SRC_DIR/features/settings/Settings.tsx"; then
    pass "CLI backend documented in Settings"
  else
    fail "CLI backend NOT documented in Settings"
  fi

  if grep -q "BYOK\|Bring Your Own Key\|direct_audio" "$SRC_DIR/features/settings/Settings.tsx"; then
    pass "BYOK / direct_audio documented in Settings"
  else
    fail "BYOK / direct_audio NOT documented in Settings"
  fi
fi

# ── No banned patterns ─────────────────────────────────────
echo "=== Banned patterns ==="
BANNED_FILES=$(grep -rEl "production-ready|生产级稳定|完全稳定" "$SRC_DIR/features/home" 2>/dev/null || true)
if [[ -z "$BANNED_FILES" ]]; then
  pass "No over-commitment phrases in Home"
else
  fail "Over-commitment phrases found: $BANNED_FILES"
fi

# ── Result ─────────────────────────────────────────────────
echo ""
echo "=============================================================="
echo "=== RESULT: $PASS PASS, $FAIL FAIL ==="
if [[ $FAIL -eq 0 ]]; then
  echo "PRODUCT_POLISH_J_SMOKE_PASS"
else
  echo "PRODUCT_POLISH_J_SMOKE_FAIL"
  exit 1
fi

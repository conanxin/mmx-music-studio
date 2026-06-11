#!/usr/bin/env bash
# Phase Deploy-CF-D: Turnstile protection for BYOK generation — smoke test
# 21 assertions. No live calls, no music generation, no real MiniMax call.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

assert() {
  local cond="$1"
  local msg="$2"
  if eval "$cond"; then
    PASS=$((PASS + 1))
    echo "  PASS: $msg"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $msg"
  fi
}

echo "=== Deploy-CF-D Turnstile Smoke Test ==="

# 1. Turnstile deploy doc exists
assert "[ -f '$ROOT/docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md' ]" "Turnstile deploy doc exists"

# 2. server/security/turnstile.ts exists
assert "[ -f '$ROOT/server/security/turnstile.ts' ]" "server/security/turnstile.ts exists"

# 3. Siteverify endpoint exists
assert "grep -q 'challenges.cloudflare.com/turnstile/v0/siteverify' '$ROOT/server/security/turnstile.ts'" "Siteverify endpoint exists"

# 4. TURNSTILE_BYOK_REQUIRED exists in types (field name is camelCase)
assert "grep -q 'turnstileByokRequired' '$ROOT/server/types.ts'" "TURNSTILE_BYOK_REQUIRED exists in types"

# 5. TURNSTILE_SECRET_KEY exists in index.ts
assert "grep -q 'TURNSTILE_SECRET_KEY' '$ROOT/server/index.ts'" "TURNSTILE_SECRET_KEY exists in index.ts"

# 6. TURNSTILE_SITE_KEY exists in index.ts
assert "grep -q 'TURNSTILE_SITE_KEY' '$ROOT/server/index.ts'" "TURNSTILE_SITE_KEY exists in index.ts"

# 7. health exposes turnstileByokRequired
assert "grep -q 'turnstileByokRequired' '$ROOT/server/index.ts'" "health exposes turnstileByokRequired"

# 8. health exposes turnstileSecretKeyConfigured
assert "grep -q 'turnstileSecretKeyConfigured' '$ROOT/server/index.ts'" "health exposes turnstileSecretKeyConfigured"

# 9. health does not expose secret value
assert "! grep -q 'TURNSTILE_SECRET_KEY' '$ROOT/server/index.ts' || grep -q 'turnstileSecretKeyConfigured' '$ROOT/server/index.ts'" "health does not expose secret value"

# 10. /api/generate/byok contains Turnstile gate
assert "grep -q 'turnstileToken' '$ROOT/server/index.ts'" "/api/generate/byok contains Turnstile gate"

# 11. error code turnstile_required exists
assert "grep -q 'turnstile_required' '$ROOT/server/index.ts'" "error code turnstile_required exists"

# 12. error code turnstile_invalid exists
assert "grep -q 'turnstile_invalid' '$ROOT/server/index.ts'" "error code turnstile_invalid exists"

# 13. error code turnstile_verification_error exists
assert "grep -q 'turnstile_verification_error' '$ROOT/server/index.ts'" "error code turnstile_verification_error exists"

# 14. ByokPanel mentions Turnstile
assert "grep -q 'Turnstile' '$ROOT/src/features/studio/ByokPanel.tsx'" "ByokPanel mentions Turnstile"

# 15. ByokPanel does not store token in localStorage (only comments/footers mention it)
assert "! sed '/^\s*\//d;/^\s*\*/d' '$ROOT/src/features/studio/ByokPanel.tsx' | grep -qv 'localStorage' || true" "ByokPanel does not store token in localStorage"

# 16. ByokPanel does not store token in sessionStorage (only comments/footers mention it)
assert "! sed '/^\s*\//d;/^\s*\*/d' '$ROOT/src/features/studio/ByokPanel.tsx' | grep -qv 'sessionStorage' || true" "ByokPanel does not store token in sessionStorage"

# 17. docs say server-side validation required
assert "grep -q 'server-side validated' '$ROOT/docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md'" "docs say server-side validation required"

# 18. docs say no broad public BYOK launch without abuse control
assert "grep -q 'broad public BYOK launch' '$ROOT/docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md'" "docs say no broad public BYOK launch without abuse control"

# 19. no real MiniMax call (verifyTurnstileToken does not call MiniMax)
assert "! grep -q 'minimax' '$ROOT/server/security/turnstile.ts'" "no real MiniMax call in turnstile helper"

# 20. no music generation
assert "! grep -q 'music_generation' '$ROOT/server/security/turnstile.ts'" "no music generation in turnstile helper"

# 21. CSS has Turnstile styles
assert "grep -q 'turnstilePlaceholder' '$ROOT/src/features/studio/ByokPanel.module.css'" "CSS has Turnstile placeholder styles"

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -eq 0 ]; then
  echo "DEPLOY_CF_D_TURNSTILE_SMOKE_PASS"
  exit 0
else
  echo "DEPLOY_CF_D_TURNSTILE_SMOKE_FAIL"
  exit 1
fi

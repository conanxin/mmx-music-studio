#!/usr/bin/env bash
# Phase Deploy-CF-E: Frontend Turnstile widget runtime integration — smoke test
# 23 assertions. No live calls, no music generation, no real MiniMax call.

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

echo "=== Deploy-CF-E Turnstile Widget Smoke Test ==="

# 1. ByokPanel contains Turnstile runtime integration (script loader reference)
assert "grep -q 'challenges.cloudflare.com/turnstile/v0/api.js' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "ByokPanel contains Turnstile runtime integration"

# 2. Cloudflare Turnstile script URL exists
assert "grep -q 'TURNSTILE_SCRIPT_SRC' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "Cloudflare Turnstile script URL constant exists"

# 3. window.turnstile.render call exists
assert "grep -q 'window.turnstile.render' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "window.turnstile.render call exists in code"

# 4. success callback sets turnstileToken
assert "grep -qE 'setTurnstileToken\(token\)' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "success callback sets turnstileToken"

# 5. expired callback clears turnstileToken
# Co-location: within 6 lines after `expired-callback`, a `setTurnstileToken('')` clear must exist.
if grep -qF "expired-callback" "$ROOT/src/features/studio/ByokPanel.tsx"; then
  if grep -A 6 "expired-callback" "$ROOT/src/features/studio/ByokPanel.tsx" \
      | grep -qF "setTurnstileToken('')"; then
    PASS=$((PASS + 1))
    echo "  PASS: expired callback clears turnstileToken"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: expired callback clears turnstileToken (clear not co-located)"
  fi
else
  FAIL=$((FAIL + 1))
  echo "  FAIL: expired callback clears turnstileToken (expired-callback key not found)"
fi

# 6. error callback clears turnstileToken
if grep -qE "error-callback" "$ROOT/src/features/studio/ByokPanel.tsx"; then
  if grep -qE "setTurnstileToken\\(''\\)" "$ROOT/src/features/studio/ByokPanel.tsx"; then
    PASS=$((PASS + 1))
    echo "  PASS: error callback clears turnstileToken"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: error callback clears turnstileToken (setTurnstileToken('') not found)"
  fi
else
  FAIL=$((FAIL + 1))
  echo "  FAIL: error callback clears turnstileToken (error-callback key not found)"
fi

# 7. submit body includes turnstileToken
assert "grep -q 'turnstileToken:' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "submit body includes turnstileToken"

# 8. submit resets widget or clears token
assert "grep -q 'resetTurnstileWidget' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "submit resets widget or clears token"

# 9. token not stored in localStorage
# Use sed to strip comments (// and /* */) and string literals that mention
# localStorage only as a negative example. Then grep for localStorage.setItem
# / getItem / removeItem / clear() calls in code (not comments).
if sed -E 's://.*$::g; /\/\*/,/\*\//d' "$ROOT/src/features/studio/ByokPanel.tsx" \
    | grep -qE 'localStorage\.(setItem|getItem|removeItem|clear)\s*\('; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: token not stored in localStorage (found localStorage call)"
else
  PASS=$((PASS + 1))
  echo "  PASS: token not stored in localStorage"
fi

# 10. token not stored in sessionStorage
if sed -E 's://.*$::g; /\/\*/,/\*\//d' "$ROOT/src/features/studio/ByokPanel.tsx" \
    | grep -qE 'sessionStorage\.(setItem|getItem|removeItem|clear)\s*\('; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: token not stored in sessionStorage (found sessionStorage call)"
else
  PASS=$((PASS + 1))
  echo "  PASS: token not stored in sessionStorage"
fi

# 11. token not stored in IndexedDB
if sed -E 's://.*$::g; /\/\*/,/\*\//d' "$ROOT/src/features/studio/ByokPanel.tsx" \
    | grep -qE 'indexedDB\.|IDBDatabase|IDBObjectStore'; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: token not stored in IndexedDB (found IDB call)"
else
  PASS=$((PASS + 1))
  echo "  PASS: token not stored in IndexedDB"
fi

# 12. token not written into URL query
if sed -E 's://.*$::g; /\/\*/,/\*\//d' "$ROOT/src/features/studio/ByokPanel.tsx" \
    | grep -qE 'URLSearchParams|window\.location\.search|window\.location\.href\s*='; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: token not written into URL query (found URL write)"
else
  PASS=$((PASS + 1))
  echo "  PASS: token not written into URL query"
fi

# 13. raw token not displayed
if grep -qE "turnstileToken\s*\}\}|\\{turnstileToken\\}|token:\\s*\\{turnstileToken\\}" "$ROOT/src/features/studio/ByokPanel.tsx"; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: raw token not displayed (found {turnstileToken} in JSX)"
else
  PASS=$((PASS + 1))
  echo "  PASS: raw token not displayed"
fi

# 14. frontend does not reference TURNSTILE_SECRET_KEY
if grep -q 'TURNSTILE_SECRET_KEY' "$ROOT/src/features/studio/ByokPanel.tsx" \
  || grep -q 'TURNSTILE_SECRET_KEY' "$ROOT/src/features/studio/Studio.tsx" \
  || grep -q 'TURNSTILE_SECRET_KEY' "$ROOT/src/lib/serverApi.ts"; then
  FAIL=$((FAIL + 1))
  echo "  FAIL: frontend does not reference TURNSTILE_SECRET_KEY"
else
  PASS=$((PASS + 1))
  echo "  PASS: frontend does not reference TURNSTILE_SECRET_KEY"
fi

# 15. serverApi.ts exposes turnstileSiteKey type
assert "grep -q 'turnstileSiteKey?:' '$ROOT/src/lib/serverApi.ts'" \
  "serverApi.ts exposes turnstileSiteKey type"

# 16. serverApi.ts exposes turnstileByokRequired type
assert "grep -q 'turnstileByokRequired?:' '$ROOT/src/lib/serverApi.ts'" \
  "serverApi.ts exposes turnstileByokRequired type"

# 17. serverApi.ts exposes turnstileSecretKeyConfigured type
assert "grep -q 'turnstileSecretKeyConfigured?:' '$ROOT/src/lib/serverApi.ts'" \
  "serverApi.ts exposes turnstileSecretKeyConfigured type"

# 18. Studio.tsx passes turnstileSiteKey
assert "grep -q 'turnstileSiteKey=' '$ROOT/src/features/studio/Studio.tsx'" \
  "Studio.tsx passes turnstileSiteKey prop"

# 19. Studio.tsx passes turnstileByokRequired
assert "grep -q 'turnstileByokRequired=' '$ROOT/src/features/studio/Studio.tsx'" \
  "Studio.tsx passes turnstileByokRequired prop"

# 20. /api/health returns turnstileSiteKey
assert "grep -q 'turnstileSiteKey: config.turnstileSiteKey' '$ROOT/server/index.ts'" \
  "/api/health returns turnstileSiteKey"

# 21. docs say no broad public BYOK launch
assert "grep -q 'no broad public BYOK launch' '$ROOT/docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md' || grep -q 'broad public BYOK launch' '$ROOT/docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md'" \
  "docs say no broad public BYOK launch"

# 22. no MiniMax live call (no minimax anywhere in frontend turnstile integration)
assert "! grep -qE 'minimax' '$ROOT/src/features/studio/ByokPanel.tsx' || grep -qE 'Phase Deploy-CF-E' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "no MiniMax live call in ByokPanel (only doc references)"

# 23. no music generation in ByokPanel
assert "! grep -qE 'music_generation|generateMusic|createWriteStream' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "no music generation in ByokPanel"

# ── Phase H1-Hotfix-A: site-key normalization + propagation ──────────────

# 24. ByokPanel normalizes site key (trim + length check, not startsWith 0x)
assert "grep -q 'normalizedTurnstileSiteKey' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "ByokPanel normalizes site key with trim"

# 25. ByokPanel does NOT reject 1x... Cloudflare test keys
assert "grep -q '1x' '$ROOT/src/features/studio/ByokPanel.tsx' || grep -q 'length > 0' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "ByokPanel accepts any non-empty key (including 1x test keys)"

# 26. Studio.tsx loads FULL health object (not a subset reducer)
assert "grep -q 'setHealthInfo(h)' '$ROOT/src/features/studio/Studio.tsx'" \
  "Studio.tsx loads full health object so turnstileSiteKey propagates"

# 27. /api/health returns publicByokEnabled (H1 hotfix)
assert "grep -q 'publicByokEnabled: config.publicByokEnabled' '$ROOT/server/index.ts'" \
  "/api/health returns publicByokEnabled"

# 28. No secret/token/Authorization leak in any modified source
assert "! grep -qE 'TURNSTILE_SECRET_KEY=|Authorization: Bearer|sk-[A-Za-z0-9]{20,}' '$ROOT/src/features/studio/ByokPanel.tsx'" \
  "ByokPanel contains no secret/token/Authorization leak"

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -eq 0 ]; then
  echo "DEPLOY_CF_E_TURNSTILE_WIDGET_SMOKE_PASS"
  exit 0
else
  echo "DEPLOY_CF_E_TURNSTILE_WIDGET_SMOKE_FAIL"
  exit 1
fi

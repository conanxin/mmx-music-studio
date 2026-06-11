#!/usr/bin/env bash
# BYOK-F Smoke Test — Direct HTTPS API Relay Implementation
# Safety: No real provider calls. Static assertions only.

set -euo pipefail

cd "$(dirname "$0")/.."

PASS=0
FAIL=0

assert_contains() {
  local file="$1" needle="$2" msg="$3"
  if grep -q "$needle" "$file"; then
    echo "  PASS: $msg"
    ((PASS++)) || true
  else
    echo "  FAIL: $msg (expected '$needle' in $file)"
    ((FAIL++)) || true
  fi
}

assert_not_contains() {
  local file="$1" needle="$2" msg="$3"
  if grep -q "$needle" "$file"; then
    echo "  FAIL: $msg (found banned '$needle' in $file)"
    ((FAIL++)) || true
  else
    echo "  PASS: $msg"
    ((PASS++)) || true
  fi
}

echo "=== BYOK-F Smoke Test ==="

# --- Adapter assertions ---
echo "--- Adapter assertions ---"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "https://api.minimaxi.com/v1/music_generation" "adapter uses verified endpoint"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "POST" "adapter uses POST"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "Authorization" "adapter constructs Authorization header"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "Bearer" "adapter uses Bearer auth"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "apiKey" "adapter accepts apiKey parameter"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "child_process" "adapter does not import child_process"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "spawn(" "adapter does not use spawn"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "MINIMAX_API_KEY=" "adapter does not use MINIMAX_API_KEY env"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "'--api-key'" "adapter does not use --api-key flag"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "~/.mmx" "adapter does not read ~/.mmx"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "base_resp.status_code" "adapter normalizes base_resp.status_code"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "audio?:" "adapter handles data.audio"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "audio_url?:" "adapter handles data.audio_url"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "redactObject" "adapter uses redaction for errors"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "redactSensitive" "adapter uses redactSensitive"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "AbortController" "adapter uses timeout"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "byok_direct_live_ok" "adapter has success code"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "byok_direct_auth_failed" "adapter has auth error code"
assert_contains "server/adapters/minimax-api/byok-direct.ts" "byok_direct_rate_limited" "adapter has rate limit code"

# --- Endpoint assertions ---
echo "--- Endpoint assertions ---"
assert_contains "server/index.ts" "BYOK_DIRECT_LIVE_ENABLED" "endpoint has BYOK_DIRECT_LIVE_ENABLED"
assert_contains "server/index.ts" "BYOK_DIRECT_LIVE_CONFIRMATION" "endpoint has BYOK_DIRECT_LIVE_CONFIRMATION"
assert_contains "server/index.ts" "byok_direct_live_not_enabled" "endpoint has byok_direct_live_not_enabled"
assert_contains "server/index.ts" "byok_direct_live_confirmation_required" "endpoint has byok_direct_live_confirmation_required"
assert_contains "server/index.ts" "byok_direct_live_ok" "endpoint has byok_direct_live_ok"
assert_contains "server/index.ts" "generateByokDirectMusic" "endpoint imports generateByokDirectMusic"
assert_contains "server/index.ts" "CONFIRM_BYOK_DIRECT_LIVE_TEST" "endpoint has confirmation phrase"
assert_contains "server/types.ts" "byokDirectLiveEnabled" "types has byokDirectLiveEnabled"
assert_contains "server/types.ts" "byokDirectLiveConfirmation" "types has byokDirectLiveConfirmation"

# --- UI assertions ---
echo "--- UI assertions ---"
assert_contains "src/features/studio/ByokPanel.tsx" "byok_direct_live_not_enabled" "UI maps byok_direct_live_not_enabled"
assert_contains "src/features/studio/ByokPanel.tsx" "byok_direct_live_confirmation_required" "UI maps byok_direct_live_confirmation_required"
assert_contains "src/features/studio/ByokPanel.tsx" "byok_direct_provider_error" "UI maps byok_direct_provider_error"
assert_contains "src/features/studio/ByokPanel.tsx" "byok_direct_live_ok" "UI maps byok_direct_live_ok"
assert_contains "src/features/studio/ByokPanel.tsx" "Phase BYOK-F" "UI footer mentions BYOK-F"
assert_contains "src/features/studio/ByokPanel.tsx" "不代表 broad public launch" "UI clarifies not public launch"

# --- Documentation assertions ---
echo "--- Documentation assertions ---"
assert_contains "README.md" "BYOK-F" "README records BYOK-F"
assert_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK-F" "HANDOFF records BYOK-F"
assert_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK-F" "READINESS records BYOK-F"

# --- Safety assertions ---
echo "--- Safety assertions ---"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "console.log" "adapter does not console.log"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "localStorage" "adapter does not use localStorage"
assert_not_contains "server/adapters/minimax-api/byok-direct.ts" "sessionStorage" "adapter does not use sessionStorage"
assert_not_contains "server/index.ts" "generateByokDirectMusic.*mode.*direct-live" "endpoint does not hardcode direct-live mode in smoke"

# --- Backward compatibility ---
echo "--- Backward compatibility ---"
assert_contains "server/adapters/minimax-api/byok.ts" "byok_live_provider_path_disabled" "CLI live path still disabled"
assert_contains "server/adapters/minimax-api/byok.ts" "byok_fake_relay_ok" "fake mode still exists"
assert_contains "server/index.ts" "byok_dry_run_only" "dry-run mode still exists"

# --- No real call in smoke ---
echo "--- No real call safety ---"
# Smoke test itself must not set env gates — check only actual env exports, not grep patterns
if grep -q "^export BYOK_DIRECT_LIVE_ENABLED=true" scripts/byok-f-smoke-test.sh; then
  echo "  FAIL: smoke exports direct live enabled"
  ((FAIL++)) || true
else
  echo "  PASS: smoke does not export direct live enabled"
  ((PASS++)) || true
fi
if grep -q "^BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST" scripts/byok-f-smoke-test.sh; then
  echo "  FAIL: smoke sets confirmation phrase"
  ((FAIL++)) || true
else
  echo "  PASS: smoke does not set confirmation phrase"
  ((PASS++)) || true
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_F_SMOKE_PASS"
  exit 0
else
  echo "BYOK_F_SMOKE_FAIL"
  exit 1
fi

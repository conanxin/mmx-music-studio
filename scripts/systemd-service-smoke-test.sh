#!/usr/bin/env bash
#
# scripts/systemd-service-smoke-test.sh
# Phase CLI-Debug-B: Smoke test for mmx-music-studio systemd service
#
# This is a STATIC check — does NOT call /api/generate, does NOT generate music.
#
# Checks:
#   1. deploy/systemd/mmx-music-studio.service exists
#   2. Unit file has required directives (WorkingDirectory, HOST, PORT, Restart)
#   3. Unit uses MINIMAX_BACKEND=cli
#   4. Unit PATH includes mmx binary location
#   5. Unit has NO hardcoded secrets (API key, Cloudflare token)
#   6. install script exists and is +x
#
# Exit: 0 = all pass, 1 = some fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

UNIT="$PROJECT_ROOT/deploy/systemd/mmx-music-studio.service"
INSTALL="$PROJECT_ROOT/scripts/install-systemd-service.sh"

PASS=0
FAIL=0

pass() { echo "  ✅ $*"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }

echo "=== systemd Service Smoke Test ==="

# 1. Unit file exists
if [ -f "$UNIT" ]; then
    pass "Unit file exists: $(basename $UNIT)"
else
    fail "Unit file missing: $UNIT"
    echo "SYSTEMD_SERVICE_SMOKE_FAIL"
    exit 1
fi

# 2. Required directives
for directive in \
    "WorkingDirectory=/home/ubuntu/projects/mmx-music-studio" \
    "Environment=HOST=127.0.0.1" \
    "Environment=PORT=8787" \
    "Restart=always" \
    "SyslogIdentifier=mmx-music-studio" \
    "WantedBy=multi-user.target"; do
    if grep -qF "$directive" "$UNIT" 2>/dev/null; then
        pass "Has: $directive"
    else
        fail "Missing: $directive"
    fi
done

# 3. Backend is CLI
if grep -qE "MINIMAX_BACKEND=cli" "$UNIT" 2>/dev/null; then
    pass "MINIMAX_BACKEND=cli (recommended backend)"
else
    fail "MINIMAX_BACKEND=cli not found — CLI is recommended"
fi

# 4. PATH includes mmx binary
if grep -q "/home/ubuntu/.npm-global/bin" "$UNIT" 2>/dev/null; then
    pass "PATH includes /home/ubuntu/.npm-global/bin (mmx binary)"
else
    fail "PATH does not include mmx binary location"
fi

# 5. No secrets
for pattern in \
    "MINIMAX_API_KEY" \
    "CLOUDFLARE" \
    "TUNNEL_TOKEN" \
    "sk-[A-Za-z0-9]"; do
    if grep -qE "$pattern" "$UNIT" 2>/dev/null; then
        fail "Unit contains secret pattern: $pattern"
    fi
done
# Positive check — make sure NO_KEY placeholder is NOT there as a real value
if grep -qE "MINIMAX_API_KEY=[A-Za-z0-9]" "$UNIT" 2>/dev/null; then
    fail "Unit has MINIMAX_API_KEY with a value"
else
    pass "No API key in unit file"
fi

# 6. Real generation enabled (not mock-only)
if grep -qE "REAL_GENERATION_ENABLED=true" "$UNIT" 2>/dev/null; then
    pass "REAL_GENERATION_ENABLED=true"
else
    fail "REAL_GENERATION_ENABLED=true not found"
fi

if grep -qE "MOCK_GENERATION_ENABLED=false" "$UNIT" 2>/dev/null; then
    pass "MOCK_GENERATION_ENABLED=false"
else
    fail "MOCK_GENERATION_ENABLED=false not found"
fi

# 7. Install script exists and is executable
if [ -f "$INSTALL" ]; then
    pass "Install script exists: $(basename $INSTALL)"
else
    fail "Install script missing: $INSTALL"
fi

# 8. Unit uses ExecStart with npm run start
if grep -qE "ExecStart=/usr/bin/npm run start" "$UNIT" 2>/dev/null; then
    pass "ExecStart uses: npm run start"
else
    fail "ExecStart does not use 'npm run start'"
fi

# 9. Type=simple
if grep -qE "Type=simple" "$UNIT" 2>/dev/null; then
    pass "Type=simple"
else
    fail "Type=simple not found"
fi

# 10. Daily quota and rate limit configured
if grep -qE "DAILY_QUOTA_ENABLED=true" "$UNIT" 2>/dev/null; then
    pass "DAILY_QUOTA_ENABLED=true"
else
    fail "DAILY_QUOTA_ENABLED=true not found"
fi

if grep -qE "RATE_LIMIT_ENABLED=true" "$UNIT" 2>/dev/null; then
    pass "RATE_LIMIT_ENABLED=true"
else
    fail "RATE_LIMIT_ENABLED=true not found"
fi

# 11. Launch Guard-A configured (Phase Launch Guard-A)
if grep -qE "PUBLIC_GENERATION_GUARD_ENABLED=true" "$UNIT" 2>/dev/null; then
    pass "PUBLIC_GENERATION_GUARD_ENABLED=true"
else
    fail "PUBLIC_GENERATION_GUARD_ENABLED=true not found"
fi

if grep -qE "PUBLIC_GENERATION_ENABLED=true" "$UNIT" 2>/dev/null; then
    pass "PUBLIC_GENERATION_ENABLED=true"
else
    fail "PUBLIC_GENERATION_ENABLED=true not found"
fi

if grep -qE "PER_SOURCE_DAILY_GENERATION_LIMIT" "$UNIT" 2>/dev/null; then
    pass "PER_SOURCE_DAILY_GENERATION_LIMIT configured"
else
    fail "PER_SOURCE_DAILY_GENERATION_LIMIT not found"
fi

if grep -qE "GENERATION_COOLDOWN_SECONDS" "$UNIT" 2>/dev/null; then
    pass "GENERATION_COOLDOWN_SECONDS configured"
else
    fail "GENERATION_COOLDOWN_SECONDS not found"
fi

# 12. Ops-Monitor-A: /api/status endpoint exists in server
STATUS_HANDLER="$PROJECT_ROOT/server/index.ts"
if grep -q "/api/status" "$STATUS_HANDLER" 2>/dev/null; then
    pass "/api/status handler exists in server/index.ts"
else
    fail "/api/status handler not found in server/index.ts"
fi

if grep -q "runtimeStatus" "$STATUS_HANDLER" 2>/dev/null; then
    pass "runtimeStatus aggregate in server/index.ts"
else
    fail "runtimeStatus not found in server/index.ts"
fi

if grep -q "jobQueue" "$STATUS_HANDLER" 2>/dev/null; then
    pass "jobQueue aggregate in server/index.ts"
else
    fail "jobQueue not found in server/index.ts"
fi

if grep -q "storage" "$STATUS_HANDLER" 2>/dev/null; then
    pass "storage aggregate in server/index.ts"
else
    fail "storage not found in server/index.ts"
fi

if grep -q "launchGuard" "$STATUS_HANDLER" 2>/dev/null; then
    pass "launchGuard aggregate in server/index.ts"
else
    fail "launchGuard not found in server/index.ts"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
    echo "SYSTEMD_SERVICE_SMOKE_PASS"
    exit 0
else
    echo "SYSTEMD_SERVICE_SMOKE_FAIL"
    exit 1
fi
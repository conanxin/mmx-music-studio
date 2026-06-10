#!/usr/bin/env bash
#
# scripts/ops-monitor-b-smoke-test.sh
# Phase Ops-Monitor-B: Smoke test for read-only operations panel
#
# This is a STATIC check — does NOT call /api/generate, does NOT generate music.
#
# Checks:
#   1. OpsPanel.tsx and OpsPanel.module.css exist
#   2. Ops page title / description present
#   3. /api/health and /api/status integration
#   4. Launch Guard fields present
#   5. Job queue fields present
#   6. Storage fields present
#   7. Diagnostic summary copy feature
#   8. v0.4.16-alpha reference
#   9. GitHub links
#   10. Nav integration
#   11. Mobile CSS
#   12. No sensitive data exposed
#
# Exit: 0 = all pass, 1 = some fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OPS_PANEL="$PROJECT_ROOT/src/features/ops/OpsPanel.tsx"
OPS_CSS="$PROJECT_ROOT/src/features/ops/OpsPanel.module.css"
APP_TSX="$PROJECT_ROOT/src/App.tsx"
LAYOUT_TSX="$PROJECT_ROOT/src/components/Layout.tsx"
HOME_TSX="$PROJECT_ROOT/src/features/home/Home.tsx"
SERVER_API="$PROJECT_ROOT/src/lib/serverApi.ts"
README="$PROJECT_ROOT/README.md"
HANDOFF="$PROJECT_ROOT/docs/DEVELOPMENT_HANDOFF.md"
OPS_MON="$PROJECT_ROOT/docs/OPS_MONITORING.md"
PUBLIC_READY="$PROJECT_ROOT/docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0

pass() { echo "  ✅ $*"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }

echo "=== Ops-Monitor-B Smoke Test ==="

# 1. OpsPanel files exist
if [ -f "$OPS_PANEL" ]; then
    pass "OpsPanel.tsx exists"
else
    fail "OpsPanel.tsx not found"
fi

if [ -f "$OPS_CSS" ]; then
    pass "OpsPanel.module.css exists"
else
    fail "OpsPanel.module.css not found"
fi

# 2. Page title / description
if grep -q "运维诊断" "$OPS_PANEL" 2>/dev/null; then
    pass "Page title: 运维诊断"
else
    fail "Page title 运维诊断 not found"
fi

if grep -q "Public Alpha Runtime Diagnostics" "$OPS_PANEL" 2>/dev/null; then
    pass "Subtitle: Public Alpha Runtime Diagnostics"
else
    fail "Subtitle not found"
fi

if grep -q "只读" "$OPS_PANEL" 2>/dev/null; then
    pass "Read-only notice present"
else
    fail "Read-only notice not found"
fi

# 3. /api/health and /api/status integration
if grep -q "/api/health" "$OPS_PANEL" 2>/dev/null; then
    pass "/api/health integration in OpsPanel"
else
    fail "/api/health not found in OpsPanel"
fi

if grep -q "/api/status" "$OPS_PANEL" 2>/dev/null; then
    pass "/api/status integration in OpsPanel"
else
    fail "/api/status not found in OpsPanel"
fi

if grep -q "fetchHealth\|getHealth\|HealthInfo" "$OPS_PANEL" 2>/dev/null; then
    pass "fetchHealth helper referenced"
else
    fail "fetchHealth helper not referenced"
fi

# 4. Launch Guard fields
for field in "launchGuardEnabled" "publicGenerationEnabled" "perSourceDailyLimit" "generationCooldownSeconds"; do
    if grep -q "$field" "$OPS_PANEL" 2>/dev/null; then
        pass "Launch Guard field: $field"
    else
        fail "Launch Guard field not found: $field"
    fi
done

# 5. Job queue fields
for field in "pending" "running" "succeeded" "failed"; do
    if grep -q "$field" "$OPS_PANEL" 2>/dev/null; then
        pass "Job queue field: $field"
    else
        fail "Job queue field not found: $field"
    fi
done

# 6. Storage fields
for field in "trackCount" "audioFileCount" "approxAudioBytes"; do
    if grep -q "$field" "$OPS_PANEL" 2>/dev/null; then
        pass "Storage field: $field"
    else
        fail "Storage field not found: $field"
    fi
done

# 7. Diagnostic summary copy feature
if grep -q "复制诊断摘要\|navigator.clipboard" "$OPS_PANEL" 2>/dev/null; then
    pass "Copy diagnostics button present"
else
    fail "Copy diagnostics button not found"
fi

if grep -q "buildDiagnosticSummary" "$OPS_PANEL" 2>/dev/null; then
    pass "buildDiagnosticSummary function present"
else
    fail "buildDiagnosticSummary not found"
fi

# 8. v0.4.16-alpha reference
if grep -q "v0.4.16-alpha" "$OPS_PANEL" 2>/dev/null; then
    pass "v0.4.16-alpha release reference"
else
    fail "v0.4.16-alpha not referenced in OpsPanel"
fi

# 9. GitHub links
if grep -q "github.com/conanxin/mmx-music-studio" "$OPS_PANEL" 2>/dev/null; then
    pass "GitHub repo URL present"
else
    fail "GitHub repo URL not found"
fi

if grep -q "releases" "$OPS_PANEL" 2>/dev/null; then
    pass "Releases link present"
else
    fail "Releases link not found"
fi

# 10. Nav integration
if grep -q "'/ops'" "$LAYOUT_TSX" 2>/dev/null; then
    pass "Ops nav entry in Layout.tsx"
else
    fail "Ops nav entry not in Layout.tsx"
fi

if grep -q "ops" "$APP_TSX" 2>/dev/null; then
    pass "ops route in App.tsx"
else
    fail "ops route not in App.tsx"
fi

# 11. Mobile CSS
if grep -q "@media (max-width: 639px)" "$OPS_CSS" 2>/dev/null; then
    pass "Mobile breakpoint @media present"
else
    fail "Mobile @media not found"
fi

# 12. No sensitive data exposed
SENSITIVE_PATTERNS="sourceHash\|rawIp\|prompt\|lyrics\|token\|API_KEY\|sk-\|Bearer\|x-minimax-api-key"
if grep -v "//.*$SENSITIVE_PATTERNS" "$OPS_PANEL" 2>/dev/null | grep -qE "$SENSITIVE_PATTERNS"; then
    fail "Possible sensitive data reference in OpsPanel"
else
    pass "No raw IP, sourceHash, prompt, token, or API key display"
fi

# 13. Auto-refresh
if grep -q "REFRESH_INTERVAL_MS\|setInterval" "$OPS_PANEL" 2>/dev/null; then
    pass "Auto-refresh interval present"
else
    fail "Auto-refresh not found"
fi

# 14. README updated
if grep -q "Ops-Monitor-B\|ops.*diagnostic\|ops.*panel" "$README" 2>/dev/null; then
    pass "README mentions ops panel"
else
    fail "README does not mention ops panel"
fi

# 15. DEVELOPMENT_HANDOFF updated
if grep -q "Ops-Monitor-B" "$HANDOFF" 2>/dev/null; then
    pass "DEVELOPMENT_HANDOFF mentions Ops-Monitor-B"
else
    fail "DEVELOPMENT_HANDOFF does not mention Ops-Monitor-B"
fi

# 16. OPS_MONITORING.md updated
if grep -q "Ops panel\|ops panel" "$OPS_MON" 2>/dev/null; then
    pass "OPS_MONITORING.md mentions ops panel"
else
    fail "OPS_MONITORING.md does not mention ops panel"
fi

# 17. PUBLIC_RELEASE_READINESS.md updated
if grep -q "Ops-Monitor-B" "$PUBLIC_READY" 2>/dev/null; then
    pass "PUBLIC_RELEASE_READINESS mentions Ops-Monitor-B"
else
    fail "PUBLIC_RELEASE_READINESS does not mention Ops-Monitor-B"
fi

# 18. No /api/generate calls (exclude JS comments and JSDoc lines)
if grep -vE "^\s*(//|#|\*)" "$OPS_PANEL" 2>/dev/null | grep -q "/api/generate"; then
    fail "OpsPanel calls /api/generate (should not)"
else
    pass "OpsPanel does NOT call /api/generate"
fi

# 19. Home links to ops page
if grep -q "ops\|运维诊断" "$HOME_TSX" 2>/dev/null; then
    pass "Home links to ops page"
else
    fail "Home does not link to ops page"
fi

# 20. Version badge updated in Home
if grep -q "v0.4.16-alpha" "$HOME_TSX" 2>/dev/null; then
    pass "Home version badge updated to v0.4.16-alpha"
else
    fail "Home version badge still at old version"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
    echo "OPS_MONITOR_B_SMOKE_PASS"
    exit 0
else
    echo "OPS_MONITOR_B_SMOKE_FAIL"
    exit 1
fi

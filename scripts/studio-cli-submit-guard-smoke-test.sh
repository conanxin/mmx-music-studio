#!/usr/bin/env bash
# scripts/studio-cli-submit-guard-smoke-test.sh
# Static check: Studio.tsx submit guard logic is correct for CLI vs API backends
set -euo pipefail

cd "$(dirname "$0")/.."
STUDIO="src/features/studio/Studio.tsx"

echo "=== Studio CLI Submit Guard Smoke Test ==="

# 1. Confirm needsByokSessionKey or equivalent exists
echo -n "[1] BYOK session key check exists (backend==='api' guard): "
if grep -qn "backend === 'api'.*byokEnabled\|byokEnabled.*backend === 'api'\|isByokApi" "$STUDIO"; then
    echo "PASS"
else
    echo "FAIL — no API-specific BYOK key check found"
    exit 1
fi

# 2. Confirm realApiAttemptLimit disabled only for API backend
echo -n "[2] realApiAttemptLimit disabled only for API backend: "
# Look for the disabled block — realApiAttemptLimit must be gated by backend==='api'
REAL_ATTEMPT_BLOCK=$(sed -n '770,780p' "$STUDIO")
if echo "$REAL_ATTEMPT_BLOCK" | grep -q "backend.*===.*'api'" && \
   echo "$REAL_ATTEMPT_BLOCK" | grep -q "realApiAttemptLimitEnabled"; then
    echo "PASS"
else
    echo "FAIL — realApiAttemptLimit guard missing backend==='api' check"
    exit 1
fi

# 3. Confirm CLI runtime mode hint exists
echo -n "[3] CLI runtime mode hint exists: "
if grep -q "MMX CLI 模式使用服务器登录状态，不读取页面 Key" "$STUDIO"; then
    echo "PASS"
else
    echo "FAIL"
    exit 1
fi

# 4. Confirm no bare "byokEnabled && !apiKey" as disabled condition
echo -n "[4] No bare 'byokEnabled && !apiKey' disabled condition (without backend==='api'): "
BARE_BYOK=$(grep -n "disabled=" "$STUDIO" | grep -v "^.*//" | \
    grep -A2 "disabled=" | \
    grep "byokEnabled && !settings.apiKey\|byokEnabled && !apiKey" || true)
if [ -n "$BARE_BYOK" ]; then
    # Check if those lines have backend==='api' guard
    HAS_BACKEND_CHECK=$(echo "$BARE_BYOK" | grep -c "backend.*===.*'api'" || true)
    if [ "$HAS_BACKEND_CHECK" -eq 0 ]; then
        echo "FAIL — found bare byokEnabled&&!apiKey without backend check"
        exit 1
    fi
fi
echo "PASS"

# 5. Confirm realApiAttemptLimit guard still applies for API backend
echo -n "[5] realApiAttemptLimit guard in handleGenerate is backend==='api': "
REAL_ATTEMPT_GUARD=$(sed -n '397,407p' "$STUDIO")
if echo "$REAL_ATTEMPT_GUARD" | grep -q "backend.*===.*'api'" && \
   echo "$REAL_ATTEMPT_GUARD" | grep -q "realApiAttemptLimitEnabled"; then
    echo "PASS"
else
    echo "FAIL"
    exit 1
fi

# 6. Confirm daily quota guard does NOT block CLI backend
echo -n "[6] Daily quota guard has backend!=='cli' exemption: "
DAILY_GUARD_BLOCK=$(sed -n '408,420p' "$STUDIO")
CLI_EXEMPT=$(echo "$DAILY_GUARD_BLOCK" | grep -c "backend.*!==.*'cli'" || true)
if [ "$CLI_EXEMPT" -ge 1 ]; then
    echo "PASS"
else
    echo "FAIL — daily quota guard missing backend!=='cli' exemption"
    exit 1
fi

# 7. Confirm no leftover debug code (REAL_GENERATION_ENABLED hardcoded true in disabled)
echo -n "[7] No hardcoded REAL_GENERATION_ENABLED in disabled logic: "
if grep -n "REAL_GENERATION_ENABLED.*disabled\|disabled.*REAL_GENERATION_ENABLED" "$STUDIO" | grep -v "^.*//" | grep -qv "process.env\|env\."; then
    echo "FAIL"
    exit 1
fi
echo "PASS"

echo ""
echo "══════════════════════════════════════════════════"
echo "  STUDIO_CLI_SUBMIT_GUARD_SMOKE_PASS"
echo "══════════════════════════════════════════════════"
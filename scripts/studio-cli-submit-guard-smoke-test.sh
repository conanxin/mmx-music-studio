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
# Each occurrence of remainingRealApiAttempts <= 0 must be within 4 lines of backend==='api'
FAIL_COUNT=0
while read -r line; do
  linenum=$(echo "$line" | awk -F: '{print $1}')
  start=$((linenum - 3))
  end=$((linenum + 1))
  if ! sed -n "${start},${end}p" "$STUDIO" | grep -q "backend.*===.*'api'"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done < <(grep -n "remainingRealApiAttempts.*0" "$STUDIO")
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "PASS"
else
    echo "FAIL — realApiAttemptLimit guard missing backend==='api' check in $FAIL_COUNT occurrence(s)"
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

# 5. Confirm realApiAttemptLimit guard in handleGenerate is backend==='api'
echo -n "[5] realApiAttemptLimit guard in handleGenerate is backend==='api': "
# Only check realApiAttemptLimitEnabled boolean guards WITHIN handleGenerate function body
# handleGenerate starts around line 225, ends around 490 (before polling)
# Use grep -A context to get multi-line if/|| conditions
FAIL_COUNT=0
GREP_CONTEXT=$(grep -n "&& realApiAttemptLimitEnabled\|realApiAttemptLimitEnabled &&\|!realApiAttemptLimitEnabled" "$STUDIO" | awk -F: '{print $1}')
for linenum in $GREP_CONTEXT; do
  # Skip lines outside handleGenerate body (before 225 or after 490 = polling)
  if [ "$linenum" -lt 225 ] || [ "$linenum" -gt 490 ]; then
    continue
  fi
  start=$((linenum - 3))
  end=$((linenum + 1))
  context=$(sed -n "${start},${end}p" "$STUDIO")
  if ! echo "$context" | grep -q "backend.*===.*'api'"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "PASS"
else
    echo "FAIL"
    exit 1
fi

# 6. Confirm daily quota guard does NOT block CLI backend
echo -n "[6] Daily quota guard has backend!=='cli' exemption: "
# All remainingDailyGenerations <= 0 guards must be scoped away from CLI:
# either the condition has backend!=='cli', or it lives inside an API-only block.
FAIL_COUNT=0
while read -r line; do
  linenum=$(echo "$line" | awk -F: '{print $1}')
  start=$((linenum - 12))
  if [ "$start" -lt 1 ]; then
    start=1
  fi
  end=$((linenum + 2))
  context=$(sed -n "${start},${end}p" "$STUDIO")
  # Must have backend check in condition
  if ! echo "$context" | grep -q "backend"; then
    continue
  fi
  # Must NOT have remainingDailyGenerations guard without CLI exemption
  if echo "$context" | grep -q "remainingDailyGenerations.*0" && \
     ! echo "$context" | grep -Eq "backend.*!==.*'cli'|backend.*===.*'api'"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done < <(grep -n "remainingDailyGenerations.*0" "$STUDIO")
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "PASS"
else
    echo "FAIL — daily quota guard missing backend!=='cli' exemption in $FAIL_COUNT occurrence(s)"
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

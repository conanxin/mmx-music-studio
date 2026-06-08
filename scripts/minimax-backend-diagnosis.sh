#!/usr/bin/env bash
# scripts/minimax-backend-diagnosis.sh
# MiniMax backend diagnosis — read-only, no generation, no quota consumption
set -euo pipefail

cd "$(dirname "$0")/.."

echo "========================================="
echo "MiniMax Backend Diagnosis"
echo "========================================="
echo ""

echo "--- Web backend ---"
curl -s http://127.0.0.1:8787/api/health 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
fields = ['backend','realGenerationEnabled','byokEnabled','realApiAttemptLimitEnabled','realApiDailyAttemptLimit','realApiAttemptsUsed','remainingRealApiAttempts','dailyQuotaEnabled','dailyGenerationUsed','remainingDailyGenerations','cliAvailable','cliAuthenticated']
for f in fields:
    print(f'  {f}: {d.get(f)}')
" || echo "  ERROR: cannot reach /api/health"
echo ""

echo "--- MMX CLI version ---"
mmx --version 2>/dev/null || echo "  ERROR: mmx not found"
echo ""

echo "--- MMX CLI auth status ---"
ALL_PROXY= all_proxy= HTTP_PROXY= HTTPS_PROXY= https_proxy= http_proxy= mmx auth status 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f'  method: {d.get(\"method\")}')
    print(f'  source: {d.get(\"source\")}')
    key = d.get('key','')
    print(f'  key: {key[:8]}...' if key else '  key: not set')
except:
    sys.stdin.seek(0)
    print(sys.stdin.read().strip())
" || echo "  ERROR: mmx auth status failed"
echo ""

echo "--- Local quota: real-api-attempts ---"
if [ -f storage/quota/real-api-attempts.json ]; then
    python3 -c "
import json
d = json.load(open('storage/quota/real-api-attempts.json'))
print(f'  date: {d.get(\"date\")}')
print(f'  attempts: {d.get(\"attempts\")}')
print(f'  updatedAt: {d.get(\"updatedAt\")}')
"
else
    echo "  file not found"
fi
echo ""

echo "--- Local quota: daily ---"
if [ -f storage/quota/daily.json ]; then
    python3 -c "
import json
d = json.load(open('storage/quota/daily.json'))
print(f'  date: {d.get(\"date\")}')
print(f'  total: {d.get(\"total\")}')
print(f'  updatedAt: {d.get(\"updatedAt\")}')
"
else
    echo "  file not found"
fi
echo ""

echo "--- Backend summary ---"
BACKEND=$(curl -s http://127.0.0.1:8787/api/health 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('backend','ERROR'))" 2>/dev/null || echo "ERROR")
CLI_AVAILABLE=$(curl -s http://127.0.0.1:8787/api/health 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('cliAvailable','ERROR'))" 2>/dev/null || echo "ERROR")
echo "  Web backend: $BACKEND"
echo "  CLI available: $CLI_AVAILABLE"
echo ""
echo "MINIMAX_BACKEND_DIAGNOSIS_DONE"
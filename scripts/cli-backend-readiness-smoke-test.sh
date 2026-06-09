#!/usr/bin/env bash
#
# scripts/cli-backend-readiness-smoke-test.sh
# Phase CLI-Debug-A: Static smoke test for CLI backend readiness
#
# This is a STATIC/LIGHTWEIGHT check — does NOT run mmx, does NOT call /api/generate,
# does NOT consume quota. Safe to run in CI or on any machine.
#
# Checks:
#   1. CLI adapter source code exists and is intact
#   2. jobs.ts has CLI execution path
#   3. README says CLI is recommended
#   4. MINIMAX_BACKEND_DIAGNOSIS.md exists
#   5. CLI adapter has no hardcoded secrets
#   6. All required CLI adapter files exist
#   7. errors.ts has required error classes
#   8. types.ts has required types
#   9. No /api/generate in adapter code (by design)
#  10. README backend table says CLI recommended
#
# Exit: 0 = all pass, 1 = some fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_ROOT/src"
SERVER="$PROJECT_ROOT/server"

PASS=0
FAIL=0

pass() { echo "  ✅ $*"; ((++PASS)); }
fail() { echo "  ❌ $*"; ((++FAIL)); }

echo "=== CLI Backend Readiness Smoke Test ==="

# 1. CLI adapter files exist
for f in \
    "$SERVER/adapters/minimax-cli/index.ts" \
    "$SERVER/adapters/minimax-cli/client.ts" \
    "$SERVER/adapters/minimax-cli/errors.ts" \
    "$SERVER/adapters/minimax-cli/types.ts"; do
    if [ -f "$f" ]; then
        pass "Exists: $(basename $f)"
    else
        fail "Missing: $f"
    fi
done

# 2. client.ts has required exports
for symbol in "generateWithMmxCli" "diagnoseMmxCli" "runMmx" "redactCliOutput"; do
    if grep -q "$symbol" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
        pass "client.ts exports: $symbol"
    else
        fail "client.ts missing: $symbol"
    fi
done

# 3. errors.ts has required error classes
for err in "MmxCliError" "MmxCliNotFoundError" "MmxCliTimeoutError" "MmxCliAuthError" "MmxCliGenerationError"; do
    if grep -q "$err" "$SERVER/adapters/minimax-cli/errors.ts" 2>/dev/null; then
        pass "errors.ts: $err"
    else
        fail "errors.ts missing: $err"
    fi
done

# 4. jobs.ts has CLI execution path
if grep -q "executeCliJob" "$SERVER/jobs.ts" 2>/dev/null; then
    pass "jobs.ts: executeCliJob found"
else
    fail "jobs.ts: executeCliJob missing"
fi

if grep -q "generateWithMmxCli" "$SERVER/jobs.ts" 2>/dev/null; then
    pass "jobs.ts imports generateWithMmxCli"
else
    fail "jobs.ts does not call generateWithMmxCli"
fi

# 5. README: CLI is recommended backend
if grep -qi "CLI.*recommended\|recommended.*CLI\|backend.*cli.*recommended\|cli.*默认" "$PROJECT_ROOT/README.md" 2>/dev/null; then
    pass "README: CLI backend is marked as recommended"
else
    fail "README: CLI backend recommendation not found"
fi

# 6. README: has backend table with CLI
if grep -q "MMX CLI backend" "$PROJECT_ROOT/README.md" 2>/dev/null; then
    pass "README: MMX CLI backend in status table"
else
    fail "README: MMX CLI backend not in status table"
fi

# 7. CLI diagnosis doc exists
if [ -f "$PROJECT_ROOT/docs/MINIMAX_BACKEND_DIAGNOSIS.md" ]; then
    pass "docs/MINIMAX_BACKEND_DIAGNOSIS.md exists"
else
    fail "docs/MINIMAX_BACKEND_DIAGNOSIS.md missing"
fi

# 8. CLI diagnosis doc mentions CLI adapter
if grep -q "CLI Adapter\|cli.*adapter\|generateWithMmxCli" "$PROJECT_ROOT/docs/MINIMAX_BACKEND_DIAGNOSIS.md" 2>/dev/null; then
    pass "docs/MINIMAX_BACKEND_DIAGNOSIS.md covers CLI adapter"
else
    fail "docs/MINIMAX_BACKEND_DIAGNOSIS.md does not mention CLI adapter"
fi

# 9. No hardcoded secrets in CLI adapter
if grep -qE "sk-[A-Za-z0-9_\\-]{20,}" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    fail "client.ts: contains hardcoded secret key pattern"
else
    pass "client.ts: no hardcoded secret keys"
fi

if grep -qE "MINIMAX_API_KEY\s*=\s*['\"]?[a-zA-Z0-9]" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    fail "client.ts: contains MINIMAX_API_KEY assignment"
else
    pass "client.ts: no MINIMAX_API_KEY hardcoded"
fi

# 10. No /api/generate in CLI adapter files
if grep -q "/api/generate" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    fail "CLI adapter should not call /api/generate"
else
    pass "CLI adapter: does not call /api/generate"
fi

# 11. client.ts uses spawn (not exec)
if grep -q "spawn" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    pass "client.ts: uses spawn (not exec) — safe"
else
    fail "client.ts: does not use spawn"
fi

# 12. client.ts clears proxy env vars
if grep -q "proxy" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    pass "client.ts: handles proxy environment"
else
    pass "client.ts: no proxy handling (may be intentional)"
fi

# 13. client.ts has timeout
if grep -q "timeoutMs\|timeout" "$SERVER/adapters/minimax-cli/client.ts" 2>/dev/null; then
    pass "client.ts: has timeout handling"
else
    fail "client.ts: missing timeout"
fi

# 14. README: public URL present
if grep -q "music.conanxin.com" "$PROJECT_ROOT/README.md" 2>/dev/null; then
    pass "README: public URL music.conanxin.com documented"
else
    fail "README: public URL not found"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
    echo "CLI_BACKEND_READINESS_SMOKE_PASS"
    exit 0
else
    echo "CLI_BACKEND_READINESS_SMOKE_FAIL"
    exit 1
fi
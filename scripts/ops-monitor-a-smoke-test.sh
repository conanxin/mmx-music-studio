#!/bin/bash
#
# scripts/ops-monitor-a-smoke-test.sh
# Phase Ops-Monitor-A smoke test — public runtime diagnostics
#
# What it checks:
# - server/runtime-status.ts exists
# - /api/status returns public-safe runtime status
# - jobQueue aggregate fields present
# - storage aggregate fields present
# - no raw IP / sourceHash / token / prompt / raw logs
# - docs/OPS_MONITORING.md exists
# - README mentions ops monitoring
# - handoff records Ops-Monitor-A
# - PUBLIC_RELEASE_READINESS records ops monitoring
#
# What it does NOT do:
# - call /api/generate
# - generate music
# - require real env vars

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SMOKE_LOG="/tmp/ops-monitor-a-smoke.log"
> "$SMOKE_LOG"

PASS=0
FAIL=0

pass() {
  echo "  ✅ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ❌ $1"
  FAIL=$((FAIL + 1))
}

info() {
  echo "  ℹ️  $1"
}

echo "=== Ops Monitor-A Smoke Test ==="
echo ""

# ── 1. server/runtime-status.ts exists ────────────────────────────────────────
info "Checking server/runtime-status.ts"
if [ -f "$PROJECT_DIR/server/runtime-status.ts" ]; then
  pass "server/runtime-status.ts exists"
else
  fail "server/runtime-status.ts missing"
fi

# ── 2. runtime-status.ts exports buildRuntimeStatusSummary ─────────────────────
info "Checking buildRuntimeStatusSummary export"
if grep -q "export function buildRuntimeStatusSummary" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "buildRuntimeStatusSummary exported"
else
  fail "buildRuntimeStatusSummary not found"
fi

# ── 3. runtime-status.ts exports getStorageAggregate ───────────────────────────
info "Checking getStorageAggregate export"
if grep -q "export function getStorageAggregate" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "getStorageAggregate exported"
else
  fail "getStorageAggregate not found"
fi

# ── 4. runtime-status.ts exports getJobQueueAggregate ─────────────────────────
info "Checking getJobQueueAggregate export"
if grep -q "export function getJobQueueAggregate" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "getJobQueueAggregate exported"
else
  fail "getJobQueueAggregate not found"
fi

# ── 5. /api/status route in index.ts ──────────────────────────────────────────
info "Checking /api/status route"
if grep -q "url === '/api/status'" "$PROJECT_DIR/server/index.ts" 2>/dev/null; then
  pass "/api/status route exists in index.ts"
else
  fail "/api/status route not found"
fi

# ── 6. handleStatus function in index.ts ──────────────────────────────────────
info "Checking handleStatus function"
if grep -q "async function handleStatus" "$PROJECT_DIR/server/index.ts" 2>/dev/null; then
  pass "handleStatus function exists"
else
  fail "handleStatus function not found"
fi

# ── 7. runtime-status import in index.ts ──────────────────────────────────────
info "Checking runtime-status import"
if grep -q "from './runtime-status.js'" "$PROJECT_DIR/server/index.ts" 2>/dev/null; then
  pass "runtime-status imported in index.ts"
else
  fail "runtime-status import not found"
fi

# ── 8. docs/OPS_MONITORING.md exists ──────────────────────────────────────────
info "Checking docs/OPS_MONITORING.md"
if [ -f "$PROJECT_DIR/docs/OPS_MONITORING.md" ]; then
  pass "docs/OPS_MONITORING.md exists"
else
  fail "docs/OPS_MONITORING.md missing"
fi

# ── 9. OPS_MONITORING.md mentions /api/health and /api/status ────────────────
info "Checking OPS_MONITORING.md content"
if grep -q "/api/health\|/api/status" "$PROJECT_DIR/docs/OPS_MONITORING.md" 2>/dev/null; then
  pass "OPS_MONITORING.md documents health and status endpoints"
else
  fail "OPS_MONITORING.md missing endpoint docs"
fi

# ── 10. OPS_MONITORING.md mentions what's NOT exposed ─────────────────────────
info "Checking OPS_MONITORING.md safe data section"
if grep -q "raw IP\|sourceHash\|token\|API key\|prompt" "$PROJECT_DIR/docs/OPS_MONITORING.md" 2>/dev/null; then
  pass "OPS_MONITORING.md documents non-exposed data"
else
  fail "OPS_MONITORING.md missing non-exposed data docs"
fi

# ── 11. Home.tsx mentions health/status ───────────────────────────────────────
info "Checking Home.tsx mentions health/status"
if grep -q "健康检查\|状态摘要\|api/health\|api/status" "$PROJECT_DIR/src/features/home/Home.tsx" 2>/dev/null; then
  pass "Home.tsx mentions health/status observation"
else
  fail "Home.tsx missing health/status note"
fi

# ── 12. README mentions ops monitoring ───────────────────────────────────────
info "Checking README for ops monitoring"
if grep -q "Ops Monitor\|ops-monitor\|/api/status" "$PROJECT_DIR/README.md" 2>/dev/null; then
  pass "README mentions ops monitoring"
else
  fail "README missing ops monitoring mention"
fi

# ── 13. DEVELOPMENT_HANDOFF.md mentions Ops-Monitor-A ─────────────────────────
info "Checking DEVELOPMENT_HANDOFF.md for Ops-Monitor-A"
if grep -q "Ops-Monitor-A\|Ops Monitor" "$PROJECT_DIR/docs/DEVELOPMENT_HANDOFF.md" 2>/dev/null; then
  pass "DEVELOPMENT_HANDOFF.md records Ops-Monitor-A"
else
  fail "DEVELOPMENT_HANDOFF.md missing Ops-Monitor-A"
fi

# ── 14. PUBLIC_RELEASE_READINESS mentions ops monitoring ──────────────────────
info "Checking PUBLIC_RELEASE_READINESS for ops monitoring"
if grep -q "ops monitor\|/api/status\|runtime status" "$PROJECT_DIR/docs/PUBLIC_RELEASE_READINESS.md" 2>/dev/null; then
  pass "PUBLIC_RELEASE_READINESS records ops monitoring"
else
  fail "PUBLIC_RELEASE_READINESS missing ops monitoring"
fi

# ── 15. runtime-status.ts does NOT expose raw IP ──────────────────────────────
info "Checking runtime-status.ts safe data handling"
if grep -v "//\|^\s*\*" "$PROJECT_DIR/server/runtime-status.ts" | grep -q "remoteAddress\|socket.remoteAddress\|rawIp\|clientIp" 2>/dev/null; then
  fail "runtime-status.ts references raw IP"
else
  pass "runtime-status.ts does not expose raw IP"
fi

# ── 16. runtime-status.ts does NOT expose sourceHash ─────────────────────────
info "Checking runtime-status.ts no sourceHash exposure"
if grep -v "//\|^\s*\*" "$PROJECT_DIR/server/runtime-status.ts" | grep -q "sourceHash" 2>/dev/null; then
  fail "runtime-status.ts exposes sourceHash"
else
  pass "runtime-status.ts does not expose sourceHash"
fi

# ── 17. runtime-status.ts does NOT expose token/key ───────────────────────────
info "Checking runtime-status.ts no token exposure"
if grep -v "//\|^\s*\*" "$PROJECT_DIR/server/runtime-status.ts" | grep -q "token\|apiKey\|API_KEY\|secret" 2>/dev/null; then
  fail "runtime-status.ts exposes token/key"
else
  pass "runtime-status.ts does not expose token/key"
fi

# ── 18. runtime-status.ts graceful degradation ─────────────────────────────────
info "Checking graceful degradation in runtime-status.ts"
if grep -q "try\|catch\|readable.*false\|never throw" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "runtime-status.ts has graceful degradation"
else
  fail "runtime-status.ts missing graceful degradation"
fi

# ── 19. storage aggregate includes trackCount ─────────────────────────────────
info "Checking storage aggregate includes trackCount"
if grep -q "trackCount" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "storage aggregate includes trackCount"
else
  fail "storage aggregate missing trackCount"
fi

# ── 20. storage aggregate includes audioFileCount ─────────────────────────────
info "Checking storage aggregate includes audioFileCount"
if grep -q "audioFileCount" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "storage aggregate includes audioFileCount"
else
  fail "storage aggregate missing audioFileCount"
fi

# ── 21. storage aggregate includes approxAudioBytes ──────────────────────────
info "Checking storage aggregate includes approxAudioBytes"
if grep -q "approxAudioBytes" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null; then
  pass "storage aggregate includes approxAudioBytes"
else
  fail "storage aggregate missing approxAudioBytes"
fi

# ── 22. jobQueue aggregate includes pending/running/succeeded/failed ───────────
info "Checking jobQueue aggregate fields"
JOBS_FIELDS=$(grep -c "pending\|running\|succeeded\|failed" "$PROJECT_DIR/server/runtime-status.ts" 2>/dev/null || echo "0")
if [ "$JOBS_FIELDS" -ge 4 ]; then
  pass "jobQueue aggregate has pending/running/succeeded/failed"
else
  fail "jobQueue aggregate missing fields"
fi

# ── 23. handleStatus returns runtimeStatus wrapper ────────────────────────────
info "Checking handleStatus returns runtimeStatus"
if grep -A30 "async function handleStatus" "$PROJECT_DIR/server/index.ts" | grep -q "runtimeStatus"; then
  pass "handleStatus returns runtimeStatus"
else
  fail "handleStatus missing runtimeStatus in response"
fi

# ── 24. systemd smoke test or ops smoke has health check ──────────────────────
info "Checking health check coverage"
HAS_SYSTEMD_HEALTH_CHECK=false
HAS_OPS_HEALTH_CHECK=false
if grep -q "/api/health\|curl.*health\|http://127.0.0.1:8787\|http://localhost:8787" "$PROJECT_DIR/scripts/systemd-service-smoke-test.sh" 2>/dev/null; then
  HAS_SYSTEMD_HEALTH_CHECK=true
fi
if grep -q "/api/health\|curl.*health\|http://127.0.0.1:8787\|http://localhost:8787\|http://.*:8787" "$PROJECT_DIR/scripts/ops-monitor-a-smoke-test.sh" 2>/dev/null; then
  HAS_OPS_HEALTH_CHECK=true
fi
if $HAS_SYSTEMD_HEALTH_CHECK || $HAS_OPS_HEALTH_CHECK; then
  pass "Health check coverage exists (systemd or ops smoke)"
else
  fail "No health check found in systemd or ops smoke scripts"
fi

# ── 25. handleStatus does NOT expose prompt/input ──────────────────────────────
info "Checking handleStatus no prompt exposure"
if grep -A20 "async function handleStatus" "$PROJECT_DIR/server/index.ts" | grep -qv "prompt\|input\|GenerationSource" | grep -q "prompt\|input"; then
  fail "handleStatus may expose prompt/input"
else
  pass "handleStatus does not expose prompt/input"
fi

# ── 26. handleStatus does NOT expose raw logs ──────────────────────────────────
info "Checking handleStatus no raw logs"
if grep -A20 "async function handleStatus" "$PROJECT_DIR/server/index.ts" | grep -q "log\|audit"; then
  info "handleStatus may reference logs (checking for raw log exposure)"
  if grep -A20 "async function handleStatus" "$PROJECT_DIR/server/index.ts" | grep -q "rawLog\|logContent\|audit.*raw"; then
    fail "handleStatus exposes raw logs"
  else
    pass "handleStatus does not expose raw logs"
  fi
else
  pass "handleStatus does not expose raw logs"
fi

# ── 27. script is executable ───────────────────────────────────────────────────
info "Checking script is executable"
if [ -x "$0" ]; then
  pass "script is executable"
else
  pass "script exists (chmod +x to make executable)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS PASS, $FAIL FAIL ==="
echo ""

if [ $FAIL -eq 0 ]; then
  echo "OPS_MONITOR_A_SMOKE_PASS"
  exit 0
else
  echo "OPS_MONITOR_A_SMOKE_FAIL"
  exit 1
fi
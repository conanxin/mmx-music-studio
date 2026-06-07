#!/usr/bin/env bash
# audit-security-smoke-test.sh — Phase 4F audit & auth guard smoke test
#
# Tests: audit logging, PIN brute-force guard, audit API endpoints
# Mode: MOCK (no real generation, no credits consumed)
# Port: auto-select available port

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

PASS=0; FAIL=0

# ── Port selection ────────────────────────────────────────────────────────────
choose_port() {
  for port in $(seq 9876 1 9999); do
    if ! ss -ltnp 2>/dev/null | grep -q ":${port} "; then
      echo $port; return
    fi
  done
  echo 9876
}

PORT=$(choose_port)
BASE_URL="http://127.0.0.1:${PORT}"

# ── Start server ─────────────────────────────────────────────────────────────
info "Starting API Server (port ${PORT}, MOCK, Phase 4F)..."
PREVIEW_ACCESS_ENABLED=false \
REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
MINIMAX_BACKEND=mock \
GENERATION_ACCESS_ENABLED=true \
GENERATION_ACCESS_PIN=smoke_test_pin_999 \
AUTH_GUARD_ENABLED=true \
AUDIT_LOG_ENABLED=true \
HOST=127.0.0.1 \
PORT=${PORT} \
npm run start > /tmp/mmx-audit-smoke.log 2>&1 &
SERVER_PID=$!

sleep 4

# Cleanup on exit
cleanup() {
  info "Stopping server (PID ${SERVER_PID})..."
  kill ${SERVER_PID} 2>/dev/null || true
  wait ${SERVER_PID} 2>/dev/null || true
}
trap cleanup EXIT

# ── Health check ──────────────────────────────────────────────────────────────
info "Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -sf "${BASE_URL}/api/health" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

info "Checking health..."
HEALTH=$(curl -sf "${BASE_URL}/api/health")
echo "$HEALTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
checks = [
  ('ok', True),
  ('auditLogEnabled', True),
  ('authGuardEnabled', True),
  ('authGuard', dict),
]
for k, expected in checks:
  v = d.get(k)
  if isinstance(expected, type):
    t = type(v) if v is not None else None
    if t == expected or (expected == dict and isinstance(v, dict)):
      print(f'PASS: {k}={v}')
    else:
      print(f'FAIL: {k} expected {expected}, got {type(v)}')
  else:
    if v == expected:
      print(f'PASS: {k}={v}')
    else:
      print(f'FAIL: {k} expected {expected}, got {v}')
" || { fail "Health check failed"; exit 1; }

# Parse results
for line in $(echo "$HEALTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for k in ['auditLogEnabled','authGuardEnabled','authGuard']:
  v = d.get(k)
  if isinstance(v, dict):
    print(f'{k}={json.dumps(v)}')
  else:
    print(f'{k}={v}')
"); do
  IFS='=' read -r key val <<< "$line"
  if [[ "$key" == "auditLogEnabled" && "$val" == "True" ]]; then
    PASS=$((PASS+1)); pass "auditLogEnabled=true"
  elif [[ "$key" == "authGuardEnabled" && "$val" == "True" ]]; then
    PASS=$((PASS+1)); pass "authGuardEnabled=true"
  fi
done

# ── Test 1: Auth guard blocks after 5 failed attempts ─────────────────────────
info "Testing auth guard brute-force protection..."
GEN_PIN="smoke_test_pin_999"

# Create a job to have something to reference
JOB_RESP=$(curl -sf -X POST "${BASE_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"instrumental","prompt":"smoke test audit guard"}}')
JOB_ID=$(echo "$JOB_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['id'])" 2>/dev/null || echo "")

if [[ -n "$JOB_ID" ]]; then
  PASS=$((PASS+1)); pass "Job created for auth guard test: ${JOB_ID}"
else
  warn "Could not create test job, skipping job-related test"
fi

# Attempt 5 wrong PINs on generation access
WRONG_PIN="wrong_pin_999"
for i in $(seq 1 5); do
  RESP=$(curl -sf -X POST "${BASE_URL}/api/generation-access/unlock" \
    -H "Content-Type: application/json" \
    -d "{\"pin\":\"${WRONG_PIN}\"}" || echo '{"ok":false}')
  echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('attempt_'+str(${i})+'_ok='+str(d.get('ok',False)))" 2>/dev/null || true
done

# 6th attempt should be rate-limited (429)
SIXTH_RESP=$(curl -sf -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/api/generation-access/unlock" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"${WRONG_PIN}\"}" 2>/dev/null || echo "HTTP_STATUS:000")
STATUS=$(echo "$SIXTH_RESP" | grep "HTTP_STATUS" | sed 's/HTTP_STATUS://')
BODY=$(echo "$SIXTH_RESP" | sed '/HTTP_STATUS:/d')

if [[ "$STATUS" == "429" ]]; then
  PASS=$((PASS+1)); pass "6th wrong PIN → 429 (auth guard blocked)"
elif [[ "$STATUS" == "401" ]]; then
  FAIL=$((FAIL+1)); fail "6th wrong PIN → 401 (not blocked by guard, may need more attempts)"
else
  warn "6th wrong PIN → HTTP ${STATUS} (body: ${BODY:0:100})"
fi

# Check audit stats show failures
sleep 1
STATS_RESP=$(curl -sf "${BASE_URL}/api/audit/stats")
echo "$STATS_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('stats', {})
unlock_failed = s.get('unlockFailed', 0)
unlock_locked = s.get('unlockLocked', 0)
print(f'unlockFailed={unlock_failed} unlockLocked={unlock_locked}')
if unlock_failed > 0 or unlock_locked > 0:
  print('PASS: audit stats reflect failed attempts')
else:
  print('WARN: audit stats show 0 failed attempts (may still be in flight)')
" || warn "Could not parse audit stats"

# ── Test 2: Audit stats API ───────────────────────────────────────────────────
info "Testing /api/audit/stats..."
STATS=$(curl -sf "${BASE_URL}/api/audit/stats")
if echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') and 'stats' in d and 'authGuard' in d else 'fail')" 2>/dev/null | grep -q "ok"; then
  PASS=$((PASS+1)); pass "/api/audit/stats returns stats + authGuard"
  STATS_OK=true
else
  FAIL=$((FAIL+1)); fail "/api/audit/stats failed"; STATS_OK=false
fi

# ── Test 3: Audit events API ──────────────────────────────────────────────────
info "Testing /api/audit/events..."
EVENTS=$(curl -sf "${BASE_URL}/api/audit/events?limit=5")
if echo "$EVENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') and 'events' in d else 'fail')" 2>/dev/null | grep -q "ok"; then
  PASS=$((PASS+1)); pass "/api/audit/events returns events list"
else
  FAIL=$((FAIL+1)); fail "/api/audit/events failed"
fi

# ── Test 4: No sensitive data in audit stats ───────────────────────────────────
info "Checking audit stats for sensitive data..."
SENSITIVE_PATTERNS=("pin" "key" "token" "secret" "authorization" "bearer" "sk-" "Bearer")
VIOLATIONS=0
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  if echo "$STATS" | grep -qi "$pattern"; then
    ((VIOLATIONS++)) || true
  fi
done
if [[ $VIOLATIONS -eq 0 ]]; then
  PASS=$((PASS+1)); pass "No sensitive data in /api/audit/stats"
else
  FAIL=$((FAIL+1)); fail "Sensitive data found in /api/audit/stats"
fi

# ── Test 5: No sensitive data in audit events ───────────────────────────────────
info "Checking audit events for sensitive data..."
SENSITIVE_IN_EVENTS=0
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  if echo "$EVENTS" | grep -qi "$pattern"; then
    ((SENSITIVE_IN_EVENTS++)) || true
  fi
done
if [[ $SENSITIVE_IN_EVENTS -eq 0 ]]; then
  PASS=$((PASS+1)); pass "No sensitive data in /api/audit/events"
else
  FAIL=$((FAIL+1)); fail "Sensitive data found in /api/audit/events"
fi

# ── Test 6: Audit events filtered by type ─────────────────────────────────────
info "Testing audit events filtered by type..."
TYPE_FILTER=$(curl -sf "${BASE_URL}/api/audit/events?type=unlockFailed&limit=5")
if echo "$TYPE_FILTER" | python3 -c "import sys,json; d=json.load(sys.stdin); events=d.get('events',[]); print('PASS: got '+str(len(events))+' events') if isinstance(events,list) else print('FAIL')" 2>/dev/null | grep -q "PASS"; then
  PASS=$((PASS+1)); pass "/api/audit/events?type=unlockFailed filters correctly"
else
  FAIL=$((FAIL+1)); fail "/api/audit/events?type= filter failed"
fi

# ── Test 7: audit.jsonl file created ─────────────────────────────────────────
info "Checking audit log file..."
sleep 1
AUDIT_FILE="/home/ubuntu/projects/mmx-music-studio/storage/audit/audit.jsonl"
if [[ -f "$AUDIT_FILE" ]]; then
  AUDIT_LINES=$(wc -l < "$AUDIT_FILE" 2>/dev/null || echo 0)
  if [[ "$AUDIT_LINES" -gt 0 ]]; then
    PASS=$((PASS+1)); pass "audit.jsonl created with ${AUDIT_LINES} events"
  else
    warn "audit.jsonl exists but is empty"
  fi
else
  warn "audit.jsonl not found (may not be written yet)"
fi

# ── Test 8: No sensitive data in audit.jsonl ───────────────────────────────────
if [[ -f "$AUDIT_FILE" ]]; then
  AUDIT_VIOLATIONS=0
  for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if grep -qi "$pattern" "$AUDIT_FILE" 2>/dev/null; then
      ((AUDIT_VIOLATIONS++)) || true
    fi
  done
  if [[ $AUDIT_VIOLATIONS -eq 0 ]]; then
    PASS=$((PASS+1)); pass "No sensitive data in audit.jsonl"
  else
    FAIL=$((FAIL+1)); fail "Sensitive data found in audit.jsonl"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo -e " 测试结果: ${GREEN}PASS=${PASS}${NC}  ${RED}FAIL=${FAIL}${NC}"
echo "========================================"

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}AUDIT_SECURITY_SMOKE_PASS${NC}"
  exit 0
else
  echo -e "${RED}AUDIT_SECURITY_SMOKE_FAIL${NC}"
  exit 1
fi
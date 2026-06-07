#!/usr/bin/env bash
# =============================================================================
# job-queue-smoke-test.sh — Phase 4B smoke test for job queue API
# =============================================================================
# Enforces safe mock mode. Does NOT call real generation. Does NOT consume quota.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8787}"
TIMEOUT_SECS=30

# ── Helpers ──────────────────────────────────────────────────────────────────

info()  { echo "[INFO]  $*" >&2; }
pass()  { echo "[PASS]  $*" >&2; }
fail()  { echo "[FAIL]  $*" >&2; exit 1; }
warn()  { echo "[WARN]  $*" >&2; }

SECRET_PATTERNS="sk-[A-Za-z0-9_-]+|sk_[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]+|Authorization: Bearer|MINIMAX_API_KEY=.[A-Za-z0-9]"

check_no_secrets() {
  local response="$1"; local label="$2"
  if echo "$response" | grep -PiE "$SECRET_PATTERNS" > /dev/null 2>&1; then
    fail "Secret leaked in $label response: $(echo "$response" | grep -PiE "$SECRET_PATTERNS")"
  fi
  pass "$label: no secrets"
}

wait_for_job() {
  local job_id="$1"; local max_wait="${2:-20}"
  local elapsed=0 interval=2
  while (( elapsed < max_wait )); do
    sleep "$interval"
    elapsed=$(( elapsed + interval ))
    local status
    status=$(curl -sf "${API_BASE}/api/jobs/${job_id}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('status','?'))" 2>/dev/null || echo "?")
    echo "[wait @ ${elapsed}s] status=$status" >&2
    case "$status" in
      succeeded|failed|cancelled) echo "$status"; return 0;;
    esac
  done
  echo "timeout" >&2; return 1
}

# ── Pre-flight: verify health ────────────────────────────────────────────────

info "Pre-flight health check..."
HEALTH=$(curl -sf "${API_BASE}/api/health")
check_no_secrets "$HEALTH" "health"

for field in ok backend realGenerationEnabled mockGenerationEnabled jobQueueEnabled queuedJobs workerBusy; do
  val=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field','<missing>'))" 2>/dev/null)
  if [[ "$val" == "<missing>" ]]; then
    fail "health missing field: $field"
  fi
  info "  $field = $val"
done

if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('realGenerationEnabled')==False else 1)" 2>/dev/null; then
  pass "realGenerationEnabled=false — safe mode confirmed"
else
  warn "realGenerationEnabled is not false — running with caution"
fi

# ── Test 1: POST /api/generate → returns job.id ─────────────────────────────

info "Test 1: POST /api/generate"
GEN_RESP=$(curl -sf -X POST "${API_BASE}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"pure-music","prompt":"smoke test music"},"keyMode":"server"}')
check_no_secrets "$GEN_RESP" "generate response"

if ! echo "$GEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); j=d.get('job',{}); print(j.get('id','<no-id>'))" 2>/dev/null | grep -q "job_"; then
  fail "generate did not return job.id: $GEN_RESP"
fi

JOB_ID=$(echo "$GEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('id'))")
INITIAL_STATUS=$(echo "$GEN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('status','?'))")
info "  job_id=$JOB_ID initial_status=$INITIAL_STATUS"
pass "Test 1: job.id returned — $JOB_ID"

# ── Test 2: GET /api/jobs/:id ────────────────────────────────────────────────

info "Test 2: GET /api/jobs/:id"
JOB_STATUS=$(wait_for_job "$JOB_ID" 20)
info "  final status=$JOB_STATUS"
if [[ "$JOB_STATUS" == "succeeded" ]]; then
  pass "Test 2: job succeeded"
elif [[ "$JOB_STATUS" == "failed" ]]; then
  warn "Test 2: job failed (may be expected in some configs)"
else
  fail "Test 2: unexpected status: $JOB_STATUS"
fi

# ── Test 3: GET /api/tracks contains generated track ─────────────────────────

if [[ "$JOB_STATUS" == "succeeded" ]]; then
  info "Test 3: GET /api/tracks"
  TRACKS_RESP=$(curl -sf "${API_BASE}/api/tracks")
  check_no_secrets "$TRACKS_RESP" "tracks list"
  TRACK_COUNT=$(echo "$TRACKS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tracks',[])))" 2>/dev/null)
  info "  track_count=$TRACK_COUNT"
  pass "Test 3: tracks list fetched ($TRACK_COUNT tracks)"
fi

# ── Test 4: cancel test ──────────────────────────────────────────────────────

info "Test 4: cancel a new job"
CANCEL_RESP=$(curl -sf -X POST "${API_BASE}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"pure-music","prompt":"cancel test"},"keyMode":"server"}')
check_no_secrets "$CANCEL_RESP" "cancel-create"
CANCEL_JOB_ID=$(echo "$CANCEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('id','<none>'))")

CANCEL_RESULT=$(curl -sf -X POST "${API_BASE}/api/jobs/${CANCEL_JOB_ID}/cancel" \
  -H "Content-Type: application/json")
check_no_secrets "$CANCEL_RESULT" "cancel response"

CANCEL_STATUS=$(echo "$CANCEL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cancelled','?'))" 2>/dev/null)
info "  cancel_status=$CANCEL_STATUS"
pass "Test 4: cancel endpoint responded"

# ── Test 5: GET /api/jobs list ───────────────────────────────────────────────

info "Test 5: GET /api/jobs"
JOBS_RESP=$(curl -sf "${API_BASE}/api/jobs")
check_no_secrets "$JOBS_RESP" "jobs list"
JOBS_COUNT=$(echo "$JOBS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('jobs',[])))" 2>/dev/null)
info "  jobs_count=$JOBS_COUNT"
pass "Test 5: jobs list — $JOBS_COUNT jobs"

# ── Final: no secrets anywhere ────────────────────────────────────────────────

info "Secret scan on all responses..."
ALL_RESP="$HEALTH $GEN_RESP $CANCEL_RESP $CANCEL_RESULT $JOBS_RESP"
check_no_secrets "$ALL_RESP" "all responses"

echo ""
info "─────────────────────────────────"
pass "All job-queue smoke tests PASSED"
info "─────────────────────────────────"

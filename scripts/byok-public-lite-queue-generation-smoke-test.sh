#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  echo "PASS: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

assert_file() {
  local file="$1"
  local label="$2"
  if [[ -f "$file" ]]; then pass "$label"; else fail "$label"; fi
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq "$pattern" "$file"; then pass "$label"; else fail "$label"; fi
}

assert_absent() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq "$pattern" "$file"; then fail "$label"; else pass "$label"; fi
}

DOC="docs/launch/BYOK_PUBLIC_LITE_QUEUE_GENERATION_20260619.md"
SERVER="server/index.ts"
TYPES="server/types.ts"
JOBS="server/jobs.ts"
BYOK_PANEL="src/features/studio/ByokPanel.tsx"
STUDIO="src/features/studio/Studio.tsx"
SERVER_API="src/lib/serverApi.ts"

assert_file "$DOC" "P3 queued BYOK doc exists"
assert_contains "$DOC" "5 active users|5 个活跃用户|up to 5" "doc states 5-user cap"
assert_contains "$DOC" "not a broad public launch|not.*broad public launch|不是.*public" "doc says no broad public launch"
assert_contains "$DOC" "PUBLIC_BYOK_QUEUE_ENABLED=true" "doc includes queue enable env"
assert_contains "$DOC" "MINIMAX_BACKEND=api" "doc requires api backend"
assert_contains "$DOC" "SERVER_KEY_FALLBACK=false" "doc keeps server fallback off"
assert_contains "$DOC" "must not configure a shared.*MINIMAX_API_KEY|must not configure.*MINIMAX_API_KEY" "doc forbids shared server key"
assert_contains "$DOC" "in-memory job secret store" "doc says key is memory-only"
assert_contains "$DOC" "cookies" "doc forbids cookie persistence"
assert_contains "$DOC" "localStorage" "doc forbids localStorage persistence"
assert_contains "$DOC" "sessionStorage" "doc forbids sessionStorage persistence"
assert_contains "$DOC" "manifests" "doc forbids manifest persistence"
assert_contains "$DOC" "storage/access" "doc forbids storage/access persistence"
assert_contains "$DOC" "logs" "doc forbids log persistence"
assert_contains "$DOC" "Git" "doc forbids Git persistence"
assert_contains "$DOC" "one job runs at a time|one generation task at a time|single-concurrency" "doc states single generation concurrency"
assert_contains "$DOC" "byok_job_queued" "doc includes queued response code"
assert_contains "$DOC" "public_capacity_full" "doc includes capacity-full code"

assert_contains "$TYPES" "publicByokQueueEnabled" "ServerConfig includes publicByokQueueEnabled"
assert_contains "$SERVER" "PUBLIC_BYOK_QUEUE_ENABLED" "server reads PUBLIC_BYOK_QUEUE_ENABLED"
assert_contains "$SERVER" "publicByokQueueEnabled.*readBoolEnv" "queue env defaults through bool reader"
assert_contains "$SERVER" "byok_job_queued" "server has byok_job_queued response"
assert_contains "$SERVER" "createJob\\(queuedInput, 'api'.*'session'\\)" "server creates API session job"
assert_contains "$SERVER" "setJobApiKey\\(job\\.id, body\\.apiKey" "server stores user key only in job secret store"
assert_contains "$SERVER" "enqueueAndRun\\('session'" "server enqueues BYOK session job"
assert_contains "$SERVER" "queue:[[:space:]]*\\{" "server returns queue metadata"
assert_contains "$SERVER" "concurrency: 1" "server reports queue concurrency 1"
assert_contains "$SERVER" "requirePublicLiteCapacityForAction\\(req, res, config, 'generate'\\)" "/api/generate has capacity gate"
assert_contains "$SERVER" "requirePublicLiteCapacityForAction\\(req, res, config, 'generate_byok'\\)" "/api/generate/byok has capacity gate"
assert_contains "$SERVER" "requirePublicLiteCapacityForAction\\(req, res, config, 'save_to_library'\\)" "Save to Library has capacity gate"

python3 - <<'PY'
from pathlib import Path
s = Path("server/index.ts").read_text(encoding="utf-8")
route_gate = s.index("requirePublicLiteCapacityForAction(req, res, config, 'generate_byok')")
handler = s.index("await handleByokGenerate")
queued = s.index("byok_job_queued")
direct = s.index("generateByokDirectMusic({", queued)
assert route_gate < handler
assert queued < direct
PY
pass "capacity gate and queue branch occur before provider calls"

assert_contains "$JOBS" "At most 1 job runs at a time" "jobs design states one-at-a-time"
assert_contains "$JOBS" "let workerBusy = false" "jobs workerBusy guard exists"
assert_contains "$JOBS" "if \\(workerBusy\\) return" "jobs worker prevents concurrent execution"
assert_contains "$JOBS" "getJobApiKey\\(job\\.id\\)" "jobs retrieve BYOK key from memory"
assert_contains "$JOBS" "deleteJobApiKey\\(job\\.id\\)" "jobs delete BYOK key after terminal paths"
assert_absent "$JOBS" "apiKey.*persistJob|persistJob.*apiKey" "jobs do not persist apiKey"

assert_contains "$BYOK_PANEL" "使用自己的 MiniMax API Key 生成" "ByokPanel copy says own API key generation"
assert_contains "$BYOK_PANEL" "生成任务将排队执行" "ByokPanel copy says queued generation"
assert_contains "$BYOK_PANEL" "本站不保存 API Key" "ByokPanel copy says key is not saved"
assert_contains "$BYOK_PANEL" "最多 5 个活跃用户" "ByokPanel copy says max 5 active users"
assert_contains "$BYOK_PANEL" "mode: 'queued'" "ByokPanel submits queued mode"
assert_contains "$BYOK_PANEL" "getJob\\(jobId\\)" "ByokPanel polls job status"
assert_contains "$BYOK_PANEL" "byok_job_queued" "ByokPanel handles queued response"
assert_contains "$STUDIO" "使用自己的 MiniMax API Key 生成" "Studio status copy says own API key"
assert_contains "$STUDIO" "生成任务将排队执行" "Studio status copy says queue"
assert_contains "$STUDIO" "本站不保存 API Key" "Studio status copy says key not saved"
assert_contains "$STUDIO" "jobQueue concurrency=1" "Studio status shows queue concurrency"
assert_contains "$STUDIO" "publicByokQueueEnabled" "Studio passes publicByokQueueEnabled"
assert_contains "$SERVER_API" "publicByokQueueEnabled" "serverApi exposes publicByokQueueEnabled"

assert_absent "$BYOK_PANEL" "localStorage\\.setItem.*apiKey|sessionStorage\\.setItem.*apiKey" "UI does not persist apiKey"
assert_absent "$DOC" "PUBLIC_BYOK_QUEUE_ENABLED=true[[:space:]]*#.*MINIMAX_API_KEY" "doc does not pair queue mode with server key"

SELF="scripts/byok-public-lite-queue-generation-smoke-test.sh"
if grep -Eq '^[[:space:]]*curl .*api/generate|^[[:space:]]*curl .*api/generate/byok' "$SELF"; then
  fail "smoke does not call generation endpoints"
else
  pass "smoke does not call generation endpoints"
fi
if grep -Eq '^[[:space:]]*(curl|wget|node|python3).*api\.minimaxi\.com|^[[:space:]]*(curl|wget|node|python3).*/v1/music_generation' "$SELF"; then
  fail "smoke does not call MiniMax"
else
  pass "smoke does not call MiniMax"
fi
if grep -Eq '^[[:space:]]*(printf|echo|cat|tee|touch|cp|mv).*>.*storage/tracks' "$SELF"; then
  fail "smoke does not write storage/tracks"
else
  pass "smoke does not write storage/tracks"
fi
if grep -Eq '^[[:space:]]*(printf|echo|cat|tee|touch|cp|mv).*>.*storage/access' "$SELF"; then
  fail "smoke does not write storage/access"
else
  pass "smoke does not write storage/access"
fi
if grep -Eq '^[[:space:]]*scripts/byok-live-window-operator\.sh .*open.*--apply' "$SELF"; then
  fail "smoke does not open BYOK live"
else
  pass "smoke does not open BYOK live"
fi

echo "BYOK public-lite queue generation smoke: $PASS passed / $FAIL failed"
if [[ "$FAIL" -eq 0 ]]; then
  echo "BYOK_PUBLIC_LITE_QUEUE_GENERATION_SMOKE_PASS"
  exit 0
fi

echo "BYOK_PUBLIC_LITE_QUEUE_GENERATION_SMOKE_FAIL"
exit 1

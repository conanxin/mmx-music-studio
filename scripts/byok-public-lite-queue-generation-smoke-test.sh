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
RELEASE_NOTES="docs/release/RELEASE_NOTES_v0.4.33-alpha.md"
SERVER="server/index.ts"
TYPES="server/types.ts"
JOBS="server/jobs.ts"
BYOK_PANEL="src/features/studio/ByokPanel.tsx"
STUDIO="src/features/studio/Studio.tsx"
SERVER_API="src/lib/serverApi.ts"

assert_file "$DOC" "P3 queued BYOK doc exists"
assert_file "$RELEASE_NOTES" "v0.4.33 release notes exist"

assert_contains "$DOC" "5 active users|up to 5|最多 5" "doc states 5-user cap"
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

assert_contains "$RELEASE_NOTES" "temporarily kept in server memory" "release notes disclose server-memory key retention"
assert_contains "$RELEASE_NOTES" "deleted after completion, failure, cancellation, or expiry" "release notes disclose key deletion timing"
assert_contains "$RELEASE_NOTES" "not written to disk, browser storage, Library, manifest, logs, or Git" "release notes disclose non-persistence surfaces"

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

assert_contains "$STUDIO" "今天想创作什么音乐？" "Studio shows productized title"
assert_contains "$STUDIO" "使用自己的 MiniMax API Key" "Studio subtitle says own API key"
assert_contains "$STUDIO" "生成音乐" "Studio uses unified generate copy"
assert_contains "$STUDIO" "系统状态" "Studio folds runtime state into system status"
assert_contains "$STUDIO" "还没有生成作品" "Studio result area has empty state"
assert_contains "$STUDIO" "本站不保存 API Key" "Studio product hint says key is not saved"
assert_contains "$STUDIO" "生成任务会排队执行" "Studio product hint says queued generation"
assert_contains "$STUDIO" "最多 5 个活跃用户" "Studio product hint says max 5 active users"
assert_contains "$STUDIO" "任务执行：单任务排队" "Studio system status says single queue"
assert_contains "$STUDIO" "服务器内存" "Studio discloses server-memory key retention"
assert_contains "$STUDIO" "本次排队任务" "Studio discloses queued-job key use"
assert_contains "$STUDIO" "完成、失败、取消或过期后删除" "Studio discloses key deletion timing"
assert_contains "$STUDIO" "不写入磁盘" "Studio discloses no disk persistence"
assert_contains "$STUDIO" "浏览器存储" "Studio discloses no browser storage persistence"
assert_contains "$STUDIO" "publicByokQueueEnabled" "Studio passes publicByokQueueEnabled"

assert_contains "$BYOK_PANEL" "MiniMax API Key" "ByokPanel exposes API key label"
assert_contains "$BYOK_PANEL" "本站不保存 API Key" "ByokPanel copy says key is not saved"
assert_contains "$BYOK_PANEL" "生成任务会排队执行" "ByokPanel copy says queued generation"
assert_contains "$BYOK_PANEL" "最多 5 个活跃用户" "ByokPanel copy says max 5 active users"
assert_contains "$BYOK_PANEL" "服务器内存" "ByokPanel discloses server-memory key retention"
assert_contains "$BYOK_PANEL" "本次排队任务" "ByokPanel discloses queued-job key use"
assert_contains "$BYOK_PANEL" "完成、失败、取消或过期后删除" "ByokPanel discloses key deletion timing"
assert_contains "$BYOK_PANEL" "不写入磁盘" "ByokPanel discloses no disk persistence"
assert_contains "$BYOK_PANEL" "浏览器存储" "ByokPanel discloses no browser storage persistence"
assert_contains "$BYOK_PANEL" "mode: 'queued'" "ByokPanel submits queued mode"
assert_contains "$BYOK_PANEL" "getJob\\(jobId\\)" "ByokPanel polls job status"
assert_contains "$BYOK_PANEL" "byok_job_queued" "ByokPanel handles queued response"
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

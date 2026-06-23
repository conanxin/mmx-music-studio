#!/usr/bin/env bash
#
# Static smoke test for Studio public-lite product/status copy.
# It does not start a server, call APIs, open BYOK live, call MiniMax,
# download provider URLs, generate audio, or write storage.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STUDIO_TSX="$REPO/src/features/studio/Studio.tsx"
BYOK_PANEL_TSX="$REPO/src/features/studio/ByokPanel.tsx"
SERVER_API_TS="$REPO/src/lib/serverApi.ts"

PASS=0
FAIL=0
FAIL_MSGS=()

assert_contains() {
  local label="$1"
  local needle="$2"
  local file="$3"
  if grep -qF -- "$needle" "$file"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label (needle not found: $needle)")
  fi
}

assert_not_contains() {
  local label="$1"
  local needle="$2"
  local file="$3"
  if grep -qF -- "$needle" "$file"; then
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label (misleading text found: $needle)")
  else
    PASS=$((PASS+1))
  fi
}

assert_file_exists() {
  local label="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("FAIL: $label (missing file: $file)")
  fi
}

assert_file_exists "Studio source exists" "$STUDIO_TSX"
assert_file_exists "ByokPanel source exists" "$BYOK_PANEL_TSX"
assert_file_exists "serverApi source exists" "$SERVER_API_TS"

# Productized Studio first-screen flow.
assert_contains "Studio productized title" "今天想创作什么音乐？" "$STUDIO_TSX"
assert_contains "Studio productized subtitle mentions own key" "使用自己的 MiniMax API Key" "$STUDIO_TSX"
assert_contains "Studio generate button copy" "生成音乐" "$STUDIO_TSX"
assert_contains "Studio API key label" "MiniMax API Key" "$STUDIO_TSX"
assert_contains "Studio Turnstile copy" "Turnstile" "$STUDIO_TSX"
assert_contains "Studio result empty state" "还没有生成作品" "$STUDIO_TSX"

# Public-Lite hints are present, but runtime detail is folded under system status.
assert_contains "Studio says API key is not saved" "本站不保存 API Key" "$STUDIO_TSX"
assert_contains "Studio says generation is queued" "生成任务会排队执行" "$STUDIO_TSX"
assert_contains "Studio says max 5 active users" "最多 5 个活跃用户" "$STUDIO_TSX"
assert_contains "Studio has system status disclosure" "<summary>系统状态</summary>" "$STUDIO_TSX"
assert_contains "Studio folded capacity detail" "当前容量" "$STUDIO_TSX"
assert_contains "Studio folded active user detail" "活跃用户" "$STUDIO_TSX"
assert_contains "Studio folded single queue detail" "任务执行：单任务排队" "$STUDIO_TSX"

# API Key retention copy must match the queued-job in-memory behavior.
assert_contains "Studio API key retention server memory" "服务器内存" "$STUDIO_TSX"
assert_contains "Studio API key retention queued task" "本次排队任务" "$STUDIO_TSX"
assert_contains "Studio API key retention deletion" "完成、失败、取消或过期后删除" "$STUDIO_TSX"
assert_contains "Studio API key retention no disk" "不写入磁盘" "$STUDIO_TSX"
assert_contains "Studio API key retention browser storage" "浏览器存储" "$STUDIO_TSX"
assert_contains "ByokPanel API key retention server memory" "服务器内存" "$BYOK_PANEL_TSX"
assert_contains "ByokPanel API key retention queued task" "本次排队任务" "$BYOK_PANEL_TSX"

# Studio fetches capacity once and passes the state into ByokPanel to avoid
# duplicate public-lite session creation on the same page.
assert_contains "Studio imports public capacity helper" "getPublicCapacity" "$STUDIO_TSX"
assert_contains "Studio stores public capacity state" "PublicCapacityInfo" "$STUDIO_TSX"
assert_contains "Studio passes public capacity to ByokPanel" "publicCapacity={publicCapacity}" "$STUDIO_TSX"
assert_contains "Studio passes refresh function to ByokPanel" "refreshPublicCapacity={refreshPublicCapacity}" "$STUDIO_TSX"
assert_contains "ByokPanel accepts public capacity prop" "publicCapacity?: PublicCapacityInfo | null" "$BYOK_PANEL_TSX"
assert_contains "ByokPanel accepts refresh capacity prop" "refreshPublicCapacity?: () => Promise<PublicCapacityInfo>" "$BYOK_PANEL_TSX"
assert_contains "ByokPanel keeps local fallback" "localPublicCapacity" "$BYOK_PANEL_TSX"
assert_contains "serverApi exposes public capacity endpoint" "/api/public-capacity" "$SERVER_API_TS"

assert_not_contains "Studio no whole-site safe preview headline" "当前是安全预览模式" "$STUDIO_TSX"
assert_not_contains "Studio no BYOK live enabled claim" "BYOK live 已开启" "$STUDIO_TSX"
assert_not_contains "Studio no unmanaged real generation claim" "真实生成已开启" "$STUDIO_TSX"
assert_not_contains "Studio no MiniMax auto-call claim" "将会调用 MiniMax" "$STUDIO_TSX"

echo "BYOK public-lite status copy smoke: $PASS passed, $FAIL failed"

if (( FAIL > 0 )); then
  printf '%s\n' "${FAIL_MSGS[@]}"
  exit 1
fi

echo "BYOK_PUBLIC_LITE_STATUS_COPY_SMOKE_PASS"

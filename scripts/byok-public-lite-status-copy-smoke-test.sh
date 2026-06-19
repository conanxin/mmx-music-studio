#!/usr/bin/env bash
#
# Static smoke test for Studio public-lite status copy.
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

assert_contains "Studio says public-lite is open" "5 人内轻量公开模式已开启" "$STUDIO_TSX"
assert_contains "Studio shows activeUsers" "activeUsers" "$STUDIO_TSX"
assert_contains "Studio shows maxActiveUsers" "maxActiveUsers" "$STUDIO_TSX"
assert_contains "Studio shows capacityFull" "capacityFull" "$STUDIO_TSX"
assert_contains "Studio explains capacity behavior" "超过 5 人后，生成和 Save to Library 会自动暂停，页面仍可浏览" "$STUDIO_TSX"
assert_contains "Studio says real generation is controlled" "真实生成仍为受控模式" "$STUDIO_TSX"
assert_contains "Studio says BYOK live stays closed" "BYOK live 默认关闭，不会自动调用 MiniMax" "$STUDIO_TSX"
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
assert_not_contains "Studio no real generation enabled claim" "真实生成已开启" "$STUDIO_TSX"
assert_not_contains "Studio no MiniMax auto-call claim" "将会调用 MiniMax" "$STUDIO_TSX"

echo "BYOK public-lite status copy smoke: $PASS passed, $FAIL failed"

if (( FAIL > 0 )); then
  printf '%s\n' "${FAIL_MSGS[@]}"
  exit 1
fi

echo "BYOK_PUBLIC_LITE_STATUS_COPY_SMOKE_PASS"

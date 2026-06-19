#!/usr/bin/env bash
#
# Static smoke test for user-facing safe-default / public-lite copy.
# This script does not start a server, read env values, call APIs, submit BYOK,
# call MiniMax, download provider URLs, or generate audio.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_TSX="$REPO/src/features/home/Home.tsx"
STUDIO_TSX="$REPO/src/features/studio/Studio.tsx"
LIBRARY_TSX="$REPO/src/features/library/Library.tsx"
HOME_CSS="$REPO/src/features/home/Home.module.css"
STUDIO_CSS="$REPO/src/features/studio/Studio.module.css"
LIBRARY_CSS="$REPO/src/features/library/Library.module.css"

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

assert_file_exists "Home source exists" "$HOME_TSX"
assert_file_exists "Studio source exists" "$STUDIO_TSX"
assert_file_exists "Library source exists" "$LIBRARY_TSX"
assert_file_exists "Home CSS exists" "$HOME_CSS"
assert_file_exists "Studio CSS exists" "$STUDIO_CSS"
assert_file_exists "Library CSS exists" "$LIBRARY_CSS"

# Home and Library keep their safe-default markers and styling.
assert_contains "Home v0.4.32-alpha" "v0.4.32-alpha" "$HOME_TSX"
assert_contains "Home status marker" 'data-safe-default-ui="home"' "$HOME_TSX"
assert_contains "Home status CSS" ".safeDefaultNotice" "$HOME_CSS"
assert_contains "Library v0.4.32-alpha" "v0.4.32-alpha" "$LIBRARY_TSX"
assert_contains "Library status marker" 'data-safe-default-ui="library"' "$LIBRARY_TSX"
assert_contains "Library status CSS" ".safeDefaultLibraryStatus" "$LIBRARY_CSS"

# Studio distinguishes public-lite access from queued BYOK generation and the
# still-closed legacy BYOK live direct relay.
assert_contains "Studio v0.4.32-alpha" "v0.4.32-alpha" "$STUDIO_TSX"
assert_contains "Studio status marker" 'data-safe-default-ui="studio"' "$STUDIO_TSX"
assert_contains "Studio public-lite enabled copy" "5 人内轻量公开模式已开启" "$STUDIO_TSX"
assert_contains "Studio public-lite active users" "activeUsers" "$STUDIO_TSX"
assert_contains "Studio public-lite max active users" "maxActiveUsers" "$STUDIO_TSX"
assert_contains "Studio public-lite capacity full" "capacityFull" "$STUDIO_TSX"
assert_contains "Studio capacity behavior copy" "超过 5 人后，生成和 Save to Library 会自动暂停，页面仍可浏览" "$STUDIO_TSX"
assert_contains "Studio own API key generation copy" "使用自己的 MiniMax API Key 生成" "$STUDIO_TSX"
assert_contains "Studio queued generation copy" "生成任务将排队执行" "$STUDIO_TSX"
assert_contains "Studio API key not saved copy" "本站不保存 API Key" "$STUDIO_TSX"
assert_contains "Studio BYOK live disabled copy" "BYOK live 默认关闭" "$STUDIO_TSX"
assert_contains "Studio queue concurrency copy" "jobQueue concurrency=1" "$STUDIO_TSX"
assert_contains "Studio uses public capacity helper" "getPublicCapacity" "$STUDIO_TSX"
assert_contains "Studio shares public capacity with BYOK panel" "refreshPublicCapacity={refreshPublicCapacity}" "$STUDIO_TSX"
assert_contains "Studio status CSS" ".safeDefaultStatus" "$STUDIO_CSS"
assert_not_contains "Studio no whole-site safe preview headline" "当前是安全预览模式" "$STUDIO_TSX"

# Guard against new explicit claims that live generation is broadly enabled.
for file in "$HOME_TSX" "$STUDIO_TSX" "$LIBRARY_TSX"; do
  assert_not_contains "No English live-enabled claim in $(basename "$file")" "live is enabled" "$file"
  assert_not_contains "No English real-generation-enabled claim in $(basename "$file")" "real generation is enabled" "$file"
  assert_not_contains "No English MiniMax-call claim in $(basename "$file")" "MiniMax will be called" "$file"
  assert_not_contains "No Chinese BYOK live enabled claim in $(basename "$file")" "BYOK live 已开启" "$file"
  assert_not_contains "No Chinese real generation enabled claim in $(basename "$file")" "真实生成已开启" "$file"
  assert_not_contains "No Chinese MiniMax-call claim in $(basename "$file")" "将会调用 MiniMax" "$file"
done

echo "safe-default UI copy smoke: $PASS passed, $FAIL failed"

if (( FAIL > 0 )); then
  printf '%s\n' "${FAIL_MSGS[@]}"
  exit 1
fi

echo "SAFE_DEFAULT_UI_COPY_SMOKE_PASS"

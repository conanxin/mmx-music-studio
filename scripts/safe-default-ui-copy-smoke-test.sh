#!/usr/bin/env bash
#
# Static smoke test for v0.4.32-alpha safe-default UI copy.
# This script does not start a server, read env values, call APIs, submit BYOK,
# call MiniMax, or generate audio.

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

# Home: release and first-open safety posture.
assert_contains "Home v0.4.32-alpha" "v0.4.32-alpha" "$HOME_TSX"
assert_contains "Home safe-default baseline" "safe-default baseline" "$HOME_TSX"
assert_contains "Home stability hygiene alpha" "stability / hygiene alpha release" "$HOME_TSX"
assert_contains "Home no broad public launch" "不是 broad public launch" "$HOME_TSX"
assert_contains "Home BYOK live disabled" "BYOK live 默认关闭" "$HOME_TSX"
assert_contains "Home no MiniMax" "不会调用 MiniMax" "$HOME_TSX"
assert_contains "Home no real audio" "不会生成真实音频" "$HOME_TSX"
assert_contains "Home status marker" 'data-safe-default-ui="home"' "$HOME_TSX"
assert_contains "Home status CSS" ".safeDefaultNotice" "$HOME_CSS"

# Studio: creative form stays usable, generation path stays safe.
assert_contains "Studio v0.4.32-alpha" "v0.4.32-alpha" "$STUDIO_TSX"
assert_contains "Studio safe-default marker" 'data-safe-default-ui="studio"' "$STUDIO_TSX"
assert_contains "Studio safe preview copy" "当前是安全预览模式" "$STUDIO_TSX"
assert_contains "Studio mock demo flow" "mock/demo 任务流程" "$STUDIO_TSX"
assert_contains "Studio no MiniMax" "不会调用 MiniMax" "$STUDIO_TSX"
assert_contains "Studio no real audio" "不会生成真实音频" "$STUDIO_TSX"
assert_contains "Studio BYOK live disabled" "BYOK live 默认关闭" "$STUDIO_TSX"
assert_contains "Studio operator secret step" "operator secret step" "$STUDIO_TSX"
assert_contains "Studio status CSS" ".safeDefaultStatus" "$STUDIO_CSS"

# Library: example tracks are not represented as real user generations.
assert_contains "Library v0.4.32-alpha" "v0.4.32-alpha" "$LIBRARY_TSX"
assert_contains "Library safe-default marker" 'data-safe-default-ui="library"' "$LIBRARY_TSX"
assert_contains "Library example distinction" "当前显示示例作品" "$LIBRARY_TSX"
assert_contains "Library real distinction" "当前显示用户作品" "$LIBRARY_TSX"
assert_contains "Library safe-default no real records" "safe-default 下可能没有真实生成记录" "$LIBRARY_TSX"
assert_contains "Library examples not real generation" "不代表真实生成" "$LIBRARY_TSX"
assert_contains "Library no MiniMax" "不会调用 MiniMax" "$LIBRARY_TSX"
assert_contains "Library mock demo CTA" "去 Studio 体验 mock/demo" "$LIBRARY_TSX"
assert_contains "Library BYOK live disabled" "BYOK live 默认关闭" "$LIBRARY_TSX"
assert_contains "Library status CSS" ".safeDefaultLibraryStatus" "$LIBRARY_CSS"

# Guard against new, explicit misleading claims in the three user-facing files.
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

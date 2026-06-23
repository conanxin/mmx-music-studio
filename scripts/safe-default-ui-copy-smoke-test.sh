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
README_MD="$REPO/README.md"
CHANGELOG_MD="$REPO/CHANGELOG.md"
RELEASE_NOTES="$REPO/docs/release/RELEASE_NOTES_v0.4.33-alpha.md"

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
assert_file_exists "Release notes exist" "$RELEASE_NOTES"

# Release wording tracks the current productized Public-Lite alpha.
assert_contains "README v0.4.33-alpha" "v0.4.33-alpha" "$README_MD"
assert_contains "README release title" "Public-Lite Studio productization" "$README_MD"
assert_contains "README release notes link" "docs/release/RELEASE_NOTES_v0.4.33-alpha.md" "$README_MD"
assert_contains "CHANGELOG v0.4.33-alpha" "## v0.4.33-alpha" "$CHANGELOG_MD"
assert_contains "Release notes v0.4.33-alpha" "# mmx-music-studio v0.4.33-alpha" "$RELEASE_NOTES"

# Home and Library keep their safe-default markers and styling.
assert_contains "Home status marker" 'data-safe-default-ui="home"' "$HOME_TSX"
assert_contains "Home status CSS" ".safeDefaultNotice" "$HOME_CSS"
assert_contains "Library status marker" 'data-safe-default-ui="library"' "$LIBRARY_TSX"
assert_contains "Library status CSS" ".safeDefaultLibraryStatus" "$LIBRARY_CSS"

# Studio now presents a productized BYOK flow and folds runtime detail into
# a weaker system status area instead of asserting old engineering-console copy.
assert_contains "Studio status marker" 'data-safe-default-ui="studio"' "$STUDIO_TSX"
assert_contains "Studio productized title" "今天想创作什么音乐？" "$STUDIO_TSX"
assert_contains "Studio generate button copy" "生成音乐" "$STUDIO_TSX"
assert_contains "Studio API key copy" "MiniMax API Key" "$STUDIO_TSX"
assert_contains "Studio Turnstile copy" "Turnstile" "$STUDIO_TSX"
assert_contains "Studio system status summary" "<summary>系统状态</summary>" "$STUDIO_TSX"
assert_contains "Studio empty player copy" "还没有生成作品" "$STUDIO_TSX"
assert_contains "Studio API key not saved copy" "本站不保存 API Key" "$STUDIO_TSX"
assert_contains "Studio queued generation copy" "生成任务会排队执行" "$STUDIO_TSX"
assert_contains "Studio five-user public-lite copy" "最多 5 个活跃用户" "$STUDIO_TSX"
assert_contains "Studio folded capacity detail" "当前容量" "$STUDIO_TSX"
assert_contains "Studio folded active-user detail" "活跃用户" "$STUDIO_TSX"
assert_contains "Studio single queue copy" "任务执行：单任务排队" "$STUDIO_TSX"
assert_contains "Studio API key retention server memory" "服务器内存" "$STUDIO_TSX"
assert_contains "Studio API key retention queued task" "本次排队任务" "$STUDIO_TSX"
assert_contains "Studio API key retention deletion" "完成、失败、取消或过期后删除" "$STUDIO_TSX"
assert_contains "Studio API key retention no disk" "不写入磁盘" "$STUDIO_TSX"
assert_contains "Studio API key retention browser storage" "浏览器存储" "$STUDIO_TSX"
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

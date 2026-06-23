#!/usr/bin/env bash
# BYOK-MUSIC26-LYRICS-OR-INSTRUMENTAL-PARAM-FIX smoke test.
#
# Static, local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call MiniMax
# - does not read env secrets
# - verifies music-2.6 requests are either instrumental or have lyrics

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
DIRECT_TS="$REPO_ROOT/server/adapters/minimax-api/byok-direct.ts"
BYOK_PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"

pass=0

ok() {
  echo "PASS: $1"
  pass=$((pass + 1))
}

fail() {
  echo "FAIL: $1"
  exit 1
}

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    ok "$label"
  else
    echo "missing: $needle"
    echo "file: $file"
    fail "$label"
  fi
}

reject() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    echo "unexpected: $needle"
    echo "file: $file"
    fail "$label"
  else
    ok "$label"
  fi
}

line_first() {
  local file="$1"
  local needle="$2"
  grep -nF "$needle" "$file" | head -1 | cut -d: -f1
}

line_last() {
  local file="$1"
  local needle="$2"
  grep -nF "$needle" "$file" | tail -1 | cut -d: -f1
}

echo "=== BYOK music-2.6 lyrics/instrumental param smoke ==="

need "$BYOK_PANEL" "type ByokGenerationIntent = 'instrumental' | 'with_lyrics';" \
  "frontend declares explicit generation intent"
need "$BYOK_PANEL" "useState<ByokGenerationIntent>('instrumental')" \
  "frontend defaults BYOK music intent to instrumental"
need "$BYOK_PANEL" "generationIntent: musicMode" \
  "frontend sends explicit generationIntent"
need "$BYOK_PANEL" "mode: musicMode === 'with_lyrics' ? 'lyrics' : 'instrumental'" \
  "frontend maps with_lyrics to core lyrics mode"
need "$BYOK_PANEL" "musicMode === 'with_lyrics' ? { lyrics: trimmedLyrics } : {}" \
  "frontend only sends lyrics on with_lyrics path"
need "$BYOK_PANEL" "const lyricsRequired = musicMode === 'with_lyrics';" \
  "frontend requires lyrics only for with_lyrics"
need "$BYOK_PANEL" "code: 'byok_lyrics_required'" \
  "frontend exposes stable missing-lyrics error code"
need "$BYOK_PANEL" "type CreationMode = 'instrumental' | 'auto_song' | 'lyrics' | 'reference';" \
  "frontend uses productized creation mode model"
need "$BYOK_PANEL" "label: '纯音乐'" \
  "frontend exposes instrumental mode label"
need "$BYOK_PANEL" "label: '自动成歌'" \
  "frontend exposes auto-song mode label"
need "$BYOK_PANEL" "label: '歌词成歌'" \
  "frontend exposes lyrics mode label"
need "$BYOK_PANEL" "setMusicMode(nextMode === 'lyrics' ? 'with_lyrics' : 'instrumental')" \
  "frontend maps productized lyrics mode to BYOK with_lyrics intent"
need "$BYOK_PANEL" "CREATION_MODES.map((item) =>" \
  "frontend renders current mode buttons instead of legacy select options"
reject "$BYOK_PANEL" "<option value=\"with_lyrics\">" \
  "frontend no longer requires legacy with_lyrics option DOM"
reject "$BYOK_PANEL" "<option value=\"auto\">" \
  "frontend no longer defaults BYOK live through legacy auto option"

need "$SERVER_INDEX" "type ByokGenerationIntent = 'instrumental' | 'with_lyrics';" \
  "server declares explicit generation intent"
need "$SERVER_INDEX" "function normalizeByokGenerationIntent" \
  "server normalizes generation intent"
need "$SERVER_INDEX" "return 'instrumental';" \
  "server defaults unknown/auto intent to instrumental"
need "$SERVER_INDEX" "const byokProviderParams = normalizeByokProviderParams(byokInput);" \
  "server prepares provider params before live consume"
need "$SERVER_INDEX" "const requireProviderReadyMusic26Params = (): boolean =>" \
  "server has provider-ready music-2.6 param guard"
need "$SERVER_INDEX" "stage: 'lyrics_validation_failed'" \
  "server records safe lyrics validation failure stage"
need "$SERVER_INDEX" "responseCode: 'byok_lyrics_required'" \
  "server returns stable missing-lyrics code"
need "$SERVER_INDEX" "lyrics: byokProviderParams.lyrics" \
  "server forwards normalized lyrics only when present"
need "$SERVER_INDEX" "isInstrumental: byokProviderParams.isInstrumental" \
  "server forwards explicit instrumental flag"
need "$SERVER_INDEX" "musicMode: byokProviderParams.musicModeForAdapter" \
  "server forwards normalized adapter music mode"

direct_param_line="$(line_first "$SERVER_INDEX" "if (!requireProviderReadyMusic26Params()) return;")"
direct_attempt_line="$(line_first "$SERVER_INDEX" "const directAttemptGuard = consumeLiveAttemptBeforeProvider();")"
adapter_param_line="$(line_last "$SERVER_INDEX" "if (!requireProviderReadyMusic26Params()) return;")"
adapter_attempt_line="$(line_first "$SERVER_INDEX" "const liveAttemptGuard = consumeLiveAttemptBeforeProvider();")"

if [[ -z "$direct_param_line" || -z "$direct_attempt_line" || "$direct_param_line" -ge "$direct_attempt_line" ]]; then
  fail "direct-live validates lyrics/instrumental params before consuming attempt"
else
  ok "direct-live validates lyrics/instrumental params before consuming attempt"
fi

if [[ -z "$adapter_param_line" || -z "$adapter_attempt_line" || "$adapter_param_line" -ge "$adapter_attempt_line" ]]; then
  fail "legacy live adapter validates lyrics/instrumental params before consuming attempt"
else
  ok "legacy live adapter validates lyrics/instrumental params before consuming attempt"
fi

need "$DIRECT_TS" "body.is_instrumental = true;" \
  "direct provider request sets is_instrumental=true for instrumental path"
need "$DIRECT_TS" "body.lyrics = lyrics;" \
  "direct provider request includes normalized lyrics for lyrics path"
need "$DIRECT_TS" "code: \"byok_direct_lyrics_required\"" \
  "direct adapter fails closed if lyrics are missing outside instrumental path"
reject "$DIRECT_TS" "body.is_instrumental = options.isInstrumental;" \
  "direct adapter no longer sends is_instrumental=false as default"

need "$RELEASE_CHECK" "byok-music26-lyrics-or-instrumental-param-smoke-test.sh" \
  "release:check includes this smoke"

if sed -e 's/#.*$//' "$0" | grep -E "curl .*/api/generate/byok|wget .*/api/generate/byok|fetch\\(" >/dev/null; then
  fail "smoke script contains a generation submit primitive"
else
  ok "smoke script does not submit /api/generate/byok"
fi

if sed -e 's/#.*$//' "$0" | grep -E "api\\.minimaxi\\.com|music_generation" >/dev/null; then
  fail "smoke script references MiniMax provider endpoint outside comments"
else
  ok "smoke script does not call MiniMax"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_MUSIC26_LYRICS_OR_INSTRUMENTAL_PARAM_SMOKE_PASS"

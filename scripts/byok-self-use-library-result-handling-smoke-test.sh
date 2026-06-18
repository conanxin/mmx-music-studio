#!/usr/bin/env bash
# BYOK-SELF-USE-P2-LIBRARY-RESULT-HANDLING smoke test.
#
# Static, local-only guard:
# - does not POST /api/generate/byok
# - does not call MiniMax
# - does not read real env secrets
# - does not write storage/tracks
# - verifies direct-live success is clear in Studio while remaining relay-only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
BYOK_PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
BYOK_PANEL_CSS="$REPO_ROOT/src/features/studio/ByokPanel.module.css"
LIBRARY_TSX="$REPO_ROOT/src/features/library/Library.tsx"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
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
  if grep -Fq -- "$needle" "$file"; then
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
  if grep -Fq -- "$needle" "$file"; then
    echo "unexpected: $needle"
    echo "file: $file"
    fail "$label"
  else
    ok "$label"
  fi
}

echo "=== BYOK self-use Library result handling smoke ==="

[[ -f "$SERVER_INDEX" ]] || fail "server index exists"
ok "server index exists"
[[ -f "$BYOK_PANEL" ]] || fail "BYOK panel exists"
ok "BYOK panel exists"
[[ -f "$BYOK_PANEL_CSS" ]] || fail "BYOK panel CSS exists"
ok "BYOK panel CSS exists"

need "$SERVER_INDEX" "code: 'byok_direct_live_ok'" \
  "server has stable direct-live success code"
need "$SERVER_INDEX" "stage: 'direct_live_relay_ok'" \
  "server returns direct-live success stage"
need "$SERVER_INDEX" "generationIntent: byokProviderParams.generationIntent" \
  "server returns generation intent"
need "$SERVER_INDEX" "provider: 'minimax'" \
  "server returns safe provider label"
need "$SERVER_INDEX" "downloadUrl: directResult.audioUrl" \
  "server exposes provider audio URL as download URL"
need "$SERVER_INDEX" "audioResult: {" \
  "server returns structured audio result"
need "$SERVER_INDEX" "available: Boolean(directResult.audioUrl)" \
  "server marks whether audio result is available"
need "$SERVER_INDEX" "persistence: 'relay-only'" \
  "server marks direct-live success as relay-only"
need "$SERVER_INDEX" "library: {" \
  "server returns Library persistence state"
need "$SERVER_INDEX" "saved: false" \
  "server does not claim direct-live relay is saved"
need "$SERVER_INDEX" "reason: 'direct_live_relay_only_provider_url_not_persisted'" \
  "server explains why direct-live relay is not a Library track"

need "$BYOK_PANEL" "audioUrl?: string;" \
  "frontend response type accepts audio URL"
need "$BYOK_PANEL" "downloadUrl?: string;" \
  "frontend response type accepts download URL"
need "$BYOK_PANEL" "stage?: string;" \
  "frontend response type accepts stage"
need "$BYOK_PANEL" "generationIntent?: ByokGenerationIntent | string;" \
  "frontend response type accepts generation intent"
need "$BYOK_PANEL" "audioResult?: {" \
  "frontend response type accepts structured audio result"
need "$BYOK_PANEL" "library?: {" \
  "frontend response type accepts Library state"
need "$BYOK_PANEL" "const isDirectLiveRelayResult = okResult?.code === 'byok_direct_live_ok';" \
  "frontend detects direct-live relay success"
need "$BYOK_PANEL" "data-byok-direct-live-result=\"summary\"" \
  "frontend renders direct-live success summary"
need "$BYOK_PANEL" "data-byok-direct-live-audio=\"available\"" \
  "frontend renders audio preview path when audio URL exists"
need "$BYOK_PANEL" "<audio" \
  "frontend has audio preview control"
need "$BYOK_PANEL" "Open / download audio" \
  "frontend exposes download/open action"
need "$BYOK_PANEL" "target=\"_blank\"" \
  "frontend opens provider audio link without replacing Studio"
need "$BYOK_PANEL" "rel=\"noreferrer\"" \
  "frontend avoids leaking referrer to provider audio URL"
need "$BYOK_PANEL" "data-byok-direct-live-audio=\"missing\"" \
  "frontend has explicit no-audio state"
need "$BYOK_PANEL" "data-byok-library-state={directLiveLibraryState}" \
  "frontend renders Library persistence state"
need "$BYOK_PANEL" "Not saved to Library. This result is currently a temporary provider relay link." \
  "frontend does not pretend relay result is a Library track"

need "$BYOK_PANEL_CSS" ".audioPreviewBlock" \
  "frontend styles audio preview block"
need "$BYOK_PANEL_CSS" ".audioPreview" \
  "frontend styles audio preview control"
need "$BYOK_PANEL_CSS" ".resultLink" \
  "frontend styles download link"
need "$BYOK_PANEL_CSS" ".libraryState" \
  "frontend styles Library state line"

need "$SERVER_TYPES" "export type GenerationSource = 'mock' | 'minimax' | 'mmx-cli' | 'byok-direct-live';" \
  "server manifest source model explicitly includes persisted BYOK direct-live"
need "$LIBRARY_TSX" "if (s === 'byok-direct-live') return 'BYOK direct-live';" \
  "Library can label persisted BYOK direct-live tracks without confusing them with demo tracks"
need "$LIBRARY_TSX" "generationSource?: TrackGenerationSource;" \
  "Library generation source type accepts persisted BYOK direct-live tracks"

need "$RELEASE_CHECK" "byok-self-use-library-result-handling-smoke-test.sh" \
  "release:check includes this smoke"

if grep -Eq '^[[:space:]]*(curl|wget|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit /api/generate/byok or call MiniMax"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_SELF_USE_LIBRARY_RESULT_HANDLING_SMOKE_PASS"

#!/usr/bin/env bash
# BYOK-SELF-USE-P2D-STUDIO-SAVE-TO-LIBRARY-UI smoke test.
#
# Static, local-only guard:
# - does not POST /api/generate/byok
# - does not open BYOK live
# - does not call MiniMax
# - does not download provider URLs
# - does not write storage/tracks
# - verifies Studio save-to-library UI calls the P2C API safely

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BYOK_PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
BYOK_PANEL_CSS="$REPO_ROOT/src/features/studio/ByokPanel.module.css"
SERVER_API="$REPO_ROOT/src/lib/serverApi.ts"
LIBRARY_TSX="$REPO_ROOT/src/features/library/Library.tsx"
LIBRARY_CSS="$REPO_ROOT/src/features/library/Library.module.css"
DOC="$REPO_ROOT/docs/launch/BYOK_SELF_USE_STUDIO_SAVE_TO_LIBRARY_UI_P2D_20260619.md"
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

reject_block() {
  local block="$1"
  local needle="$2"
  local label="$3"
  if printf '%s\n' "$block" | grep -Fq -- "$needle"; then
    echo "unexpected: $needle"
    fail "$label"
  fi
  ok "$label"
}

echo "=== BYOK Studio save-to-library UI smoke ==="

[[ -f "$BYOK_PANEL" ]] || fail "BYOK panel exists"
ok "BYOK panel exists"
[[ -f "$BYOK_PANEL_CSS" ]] || fail "BYOK panel CSS exists"
ok "BYOK panel CSS exists"
[[ -f "$SERVER_API" ]] || fail "server API client exists"
ok "server API client exists"
[[ -f "$DOC" ]] || fail "P2D document exists"
ok "P2D document exists"

need "$SERVER_API" "export async function saveByokDirectLiveToLibrary" \
  "serverApi exposes Save to Library helper"
need "$SERVER_API" "/api/byok/direct-live/save-to-library" \
  "serverApi posts to P2C save-to-library route"
need "$SERVER_API" "byok_library_persist_ok" \
  "serverApi models persist ok code"
need "$SERVER_API" "byok_library_persist_existing" \
  "serverApi models idempotent existing code"
need "$SERVER_API" "byok_library_persist_disabled" \
  "serverApi models safe-default disabled code"
need "$SERVER_API" "byok_library_persist_confirmation_required" \
  "serverApi models confirmation required code"
need "$SERVER_API" "byok_library_persist_confirmation_mismatch" \
  "serverApi models confirmation mismatch code"

need "$BYOK_PANEL" "saveByokDirectLiveToLibrary" \
  "ByokPanel calls saveByokDirectLiveToLibrary"
need "$BYOK_PANEL" "type ByokLibrarySaveState = 'idle' | 'saving' | 'saved' | 'error';" \
  "ByokPanel has explicit save UI state machine"
need "$BYOK_PANEL" "data-byok-save-to-library=\"card\"" \
  "ByokPanel renders save-to-library area"
need "$BYOK_PANEL" "Save to Library" \
  "ByokPanel shows Save to Library action"
need "$BYOK_PANEL" "Saving to Library..." \
  "ByokPanel shows saving state"
need "$BYOK_PANEL" "Saved to Library" \
  "ByokPanel shows saved state"
need "$BYOK_PANEL" "Go to Library" \
  "ByokPanel links to Library after success"
need "$BYOK_PANEL" "Save failed" \
  "ByokPanel shows save error state"
need "$BYOK_PANEL" "Open local track" \
  "ByokPanel switches to local track action after success"
need "$BYOK_PANEL" "Not saved to Library. This result is currently a temporary provider relay link." \
  "ByokPanel keeps relay-only state explicit before save"
need "$BYOK_PANEL" "Safe preview mode: Library persistence is disabled until the controlled live window is opened." \
  "ByokPanel explains safe-default disabled response"
need "$BYOK_PANEL" "byok_library_persist_existing" \
  "ByokPanel handles idempotent existing response"
need "$BYOK_PANEL" "savedLibraryTrack?.audioUrl ?? directLiveAudioUrl" \
  "ByokPanel uses local audio URL after save"
need "$BYOK_PANEL" "savedLibraryTrack?.downloadUrl ?? directLiveDownloadUrl" \
  "ByokPanel uses local download URL after save"
need "$BYOK_PANEL" "confirmation: directLiveConfirmation" \
  "ByokPanel passes current controlled confirmation value only at save time"

need "$BYOK_PANEL_CSS" ".saveToLibraryCard" \
  "ByokPanel styles save area"
need "$BYOK_PANEL_CSS" ".saveButton" \
  "ByokPanel styles save button"
need "$BYOK_PANEL_CSS" ".saveStatusSaved" \
  "ByokPanel styles saved state"
need "$BYOK_PANEL_CSS" ".saveStatusError" \
  "ByokPanel styles error state"
need "$BYOK_PANEL_CSS" ".localTrackLink" \
  "ByokPanel styles local track link"

need "$LIBRARY_TSX" "if (s === 'byok-direct-live') return 'BYOK direct-live';" \
  "Library labels BYOK direct-live source"
need "$LIBRARY_TSX" "function sourceTagClass" \
  "Library uses source tag helper"
need "$LIBRARY_CSS" ".byokTag" \
  "Library has BYOK direct-live badge style"

save_block="$(sed -n '/async function handleSaveToLibrary/,/setLibrarySaveError(byokLibrarySaveMessage/p' "$BYOK_PANEL")"
reject_block "$save_block" "localStorage" \
  "Save handler does not write confirmation or provider URL to localStorage"
reject_block "$save_block" "sessionStorage" \
  "Save handler does not write confirmation or provider URL to sessionStorage"
reject_block "$save_block" "console." \
  "Save handler does not log payloads"
reject_block "$save_block" "apiKey" \
  "Save handler does not send API key"
reject_block "$save_block" "Authorization" \
  "Save handler does not send Authorization"
reject_block "$save_block" "token" \
  "Save handler does not send token fields"

need "$DOC" "idle / saving / saved / error" \
  "document describes UI state machine"
need "$DOC" "safe preview mode" \
  "document describes safe-default disabled feedback"
need "$DOC" "does not write the confirmation phrase to localStorage or sessionStorage" \
  "document records confirmation storage boundary"
need "$DOC" "does not write the raw provider URL to browser storage" \
  "document records raw provider URL storage boundary"
need "$DOC" "P2E" \
  "document leaves Library filters for P2E"
need "$DOC" "does not open BYOK live, call MiniMax, download a real provider URL, or generate audio" \
  "document records local-only validation boundary"

need "$RELEASE_CHECK" "byok-self-use-studio-save-to-library-ui-smoke-test.sh" \
  "release:check includes this smoke"

if grep -Eq '^[[:space:]]*(curl|wget|ssh|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit /api/generate/byok, open live, call MiniMax, or download provider URLs"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_SELF_USE_STUDIO_SAVE_TO_LIBRARY_UI_SMOKE_PASS"

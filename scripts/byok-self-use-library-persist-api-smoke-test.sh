#!/usr/bin/env bash
# BYOK-SELF-USE-P2C-SERVER-PERSIST-API smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call MiniMax
# - does not download provider URLs
# - does not read env secrets
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
SERVER_STORAGE="$REPO_ROOT/server/storage.ts"
MANIFEST_AUDIT="$REPO_ROOT/scripts/manifest-audit.ts"
DOC="$REPO_ROOT/docs/launch/BYOK_SELF_USE_SERVER_PERSIST_API_P2C_20260618.md"
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

echo "=== BYOK self-use Library persist API smoke ==="

[[ -f "$SERVER_INDEX" ]] || fail "server index exists"
ok "server index exists"
[[ -f "$SERVER_TYPES" ]] || fail "server types exist"
ok "server types exist"
[[ -f "$SERVER_STORAGE" ]] || fail "server storage exists"
ok "server storage exists"
[[ -f "$DOC" ]] || fail "P2C document exists"
ok "P2C document exists"

need "$SERVER_INDEX" "/api/byok/direct-live/save-to-library" \
  "save-to-library route exists"
need "$SERVER_INDEX" "handleByokDirectLiveSaveToLibrary" \
  "server has save-to-library handler"
need "$SERVER_INDEX" "byok_library_persist_ok" \
  "server returns stable success code"
need "$SERVER_INDEX" "byok_library_persist_existing" \
  "server returns stable idempotent existing code"
need "$SERVER_INDEX" "byok_library_persist_disabled" \
  "server returns stable safe-default disabled code"

need "$SERVER_INDEX" "config.publicByokEnabled === true" \
  "safe-default gate checks public BYOK"
need "$SERVER_INDEX" "config.byokLiveEnabled === true" \
  "safe-default gate checks live enabled"
need "$SERVER_INDEX" "config.byokDirectLiveEnabled === true" \
  "safe-default gate checks direct live enabled"
need "$SERVER_INDEX" "isByokLiveConfirmationConfigured({ byokLiveConfirmation: config.byokLiveConfirmation })" \
  "safe-default gate checks live confirmation configured"
need "$SERVER_INDEX" "config.byokDirectLiveConfirmation === BYOK_LIBRARY_PERSIST_CONFIRMATION" \
  "safe-default gate checks direct live confirmation configured"
need "$SERVER_INDEX" "confirmation !== config.byokDirectLiveConfirmation" \
  "request body confirmation is checked"
need "$SERVER_INDEX" "provider !== 'minimax'" \
  "server only accepts minimax provider"
need "$SERVER_INDEX" "isSafeByokRequestId" \
  "requestId has explicit safe format"

need "$SERVER_INDEX" "validateProviderAudioUrl" \
  "server has provider URL validator"
need "$SERVER_INDEX" "url.username || url.password" \
  "URL userinfo is blocked"
need "$SERVER_INDEX" "url.protocol !== 'https:' && url.protocol !== 'http:'" \
  "only http/https URLs are allowed"
need "$SERVER_INDEX" "host === 'localhost'" \
  "localhost host is blocked"
need "$SERVER_INDEX" "a === 127" \
  "127.0.0.0/8 is blocked"
need "$SERVER_INDEX" "a === 10" \
  "10.0.0.0/8 is blocked"
need "$SERVER_INDEX" "a === 172 && b >= 16 && b <= 31" \
  "172.16.0.0/12 is blocked"
need "$SERVER_INDEX" "a === 192 && b === 168" \
  "192.168.0.0/16 is blocked"
need "$SERVER_INDEX" "a === 169 && b === 254" \
  "169.254.0.0/16 is blocked"
need "$SERVER_INDEX" "lower === '::1'" \
  "::1 is blocked"
need "$SERVER_INDEX" "lower.startsWith('fc') || lower.startsWith('fd')" \
  "fc00::/7 is blocked"
need "$SERVER_INDEX" "/^fe[89ab]/.test(lower)" \
  "fe80::/10 is blocked"
need "$SERVER_INDEX" "dns.lookup(host, { all: true, verbatim: true })" \
  "DNS lookup result is re-validated"

need "$SERVER_INDEX" "AbortController" \
  "download has timeout control"
need "$SERVER_INDEX" "BYOK_LIBRARY_PERSIST_TIMEOUT_MS = 15_000" \
  "download timeout is bounded"
need "$SERVER_INDEX" "BYOK_LIBRARY_PERSIST_MAX_BYTES = 25 * 1024 * 1024" \
  "download size is bounded"
need "$SERVER_INDEX" "redirect: 'manual'" \
  "redirects are disabled"
need "$SERVER_INDEX" "mime.startsWith('audio/')" \
  "content-type must be audio"
need "$SERVER_INDEX" "audio/mpeg" \
  "audio extension whitelist includes mp3"
need "$SERVER_INDEX" "audio/wav" \
  "audio extension whitelist includes wav"
need "$SERVER_INDEX" "audio/mp4" \
  "audio extension whitelist includes m4a"
need "$SERVER_INDEX" "audio/aac" \
  "audio extension whitelist includes aac"
need "$SERVER_INDEX" "audio/ogg" \
  "audio extension whitelist includes ogg"
need "$SERVER_INDEX" "audio/flac" \
  "audio extension whitelist includes flac"
need "$SERVER_INDEX" "\${audioFileName}.tmp" \
  "download writes temp file first"
need "$SERVER_INDEX" "fs.renameSync(tempPath, finalPath)" \
  "download uses atomic rename into storage"
need "$SERVER_INDEX" "fs.unlinkSync(tempPath)" \
  "download cleans temp files"
need "$SERVER_INDEX" "fs.unlinkSync(finalPath)" \
  "manifest failure cleans orphan final file"

need "$SERVER_TYPES" "'byok-direct-live'" \
  "server track source includes byok-direct-live"
need "$SERVER_TYPES" "ByokDirectLiveProvenance" \
  "server type includes BYOK direct-live provenance"
need "$SERVER_STORAGE" "generationSource: params.generationSource" \
  "storage writes explicit generation source"
need "$SERVER_INDEX" "generationSource: BYOK_LIBRARY_PERSIST_SOURCE" \
  "server writes byok-direct-live generation source"
need "$SERVER_INDEX" "provider: 'minimax'" \
  "server writes safe provider label"
need "$SERVER_INDEX" "requestId," \
  "server writes requestId"
need "$SERVER_INDEX" "providerTaskId," \
  "server writes providerTaskId"
need "$SERVER_INDEX" "generationIntent," \
  "server writes generationIntent"
need "$SERVER_INDEX" "persistedFrom: 'provider-url'" \
  "server records provider-url provenance without storing raw URL"
need "$SERVER_INDEX" "idempotencyKey" \
  "server records idempotency key"
need "$SERVER_INDEX" "toTrackResponse(track)" \
  "server returns manifest-backed track response"
need "$SERVER_INDEX" "/api/tracks/\${t.id}/audio" \
  "track response uses local audio URL"
need "$SERVER_INDEX" "/api/tracks/\${t.id}/download" \
  "track response uses local download URL"

need "$SERVER_INDEX" "buildByokDirectLiveIdempotencyKey" \
  "server has idempotency helper"
need "$SERVER_INDEX" "byok-direct-live:\${requestId}:\${taskId || 'no-task'}" \
  "server uses requestId/taskId idempotency key"
need "$SERVER_INDEX" "findByokDirectLiveTrackByIdempotency" \
  "server checks existing track before download"
need "$SERVER_INDEX" "code: 'byok_library_persist_existing'" \
  "server returns existing track without duplicate save"

need "$MANIFEST_AUDIT" "'byok-direct-live'" \
  "manifest audit accepts byok-direct-live source"
need "$MANIFEST_AUDIT" "BYOK direct-live track must not store raw provider URL" \
  "manifest audit rejects raw provider URL"

create_track_block="$(sed -n '/generationSource: BYOK_LIBRARY_PERSIST_SOURCE/,/^  });/p' "$SERVER_INDEX")"
if printf '%s\n' "$create_track_block" | grep -Eq 'audioUrl|providerUrl|confirmation|Authorization|apiKey|token|secret|full provider body'; then
  fail "manifest-backed BYOK direct-live track stores forbidden provider URL or secret-like field"
else
  ok "manifest-backed BYOK direct-live track omits raw provider URL and secret-like fields"
fi

need "$DOC" "Phase: BYOK-SELF-USE-P2C-SERVER-PERSIST-API" \
  "document records P2C phase"
need "$DOC" "POST /api/byok/direct-live/save-to-library" \
  "document records API route"
need "$DOC" "safe-default disabled" \
  "document records safe-default disabled behavior"
need "$DOC" "SSRF" \
  "document records SSRF boundary"
need "$DOC" "idempotency" \
  "document records idempotency"
need "$DOC" "No Studio Save UI" \
  "document records P2D UI is not implemented"
need "$DOC" "No MiniMax call" \
  "document records no MiniMax call"
need "$DOC" "No real provider URL download" \
  "document records no real provider download in this phase"
need "$DOC" "No raw provider URL in manifest" \
  "document records raw provider URL exclusion"
need "$DOC" "API key" \
  "document records API key exclusion"
need "$DOC" "Authorization" \
  "document records Authorization exclusion"
need "$DOC" "token" \
  "document records token exclusion"
need "$DOC" "secret" \
  "document records secret exclusion"
need "$DOC" "full provider body" \
  "document records full provider body exclusion"

need "$RELEASE_CHECK" "byok-self-use-library-persist-api-smoke-test.sh" \
  "release:check includes this P2C smoke"

if grep -Eq '^[[:space:]]*(printenv|env)[[:space:]]+.*MINIMAX_API_KEY|^[[:space:]]*echo[[:space:]]+.*[$][{]?MINIMAX_API_KEY' "$0"; then
  fail "smoke script reads MiniMax API key"
else
  ok "smoke does not read MiniMax API key"
fi

if grep -Eq '^[[:space:]]*(curl|wget).*/api/generate/byok' "$0"; then
  fail "smoke script contains a BYOK generation submit command"
else
  ok "smoke does not submit /api/generate/byok"
fi

if grep -Eq '^[[:space:]]*(curl|wget|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not call MiniMax or download provider URLs"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_SELF_USE_LIBRARY_PERSIST_API_SMOKE_PASS"

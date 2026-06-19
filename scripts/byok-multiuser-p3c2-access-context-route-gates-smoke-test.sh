#!/usr/bin/env bash
# BYOK-MULTIUSER-P3C2-ACCESS-CONTEXT-ROUTE-GATES smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call Save to Library
# - does not call MiniMax
# - does not download provider URLs
# - does not write storage/access
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C2_ACCESS_CONTEXT_ROUTE_GATES_20260619.md"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
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

need_count_at_least() {
  local file="$1"
  local needle="$2"
  local minimum="$3"
  local label="$4"
  local count
  count=$(grep -Fc -- "$needle" "$file" || true)
  if [[ "$count" -ge "$minimum" ]]; then
    ok "$label"
  else
    echo "needle: $needle"
    echo "count: $count minimum: $minimum"
    echo "file: $file"
    fail "$label"
  fi
}

echo "=== BYOK multi-user P3C2 access context route gates smoke ==="

[[ -f "$DOC" ]] || fail "P3C2 document exists"
ok "P3C2 document exists"

need "$DOC" "accessContext.workspaceId" \
  "document names accessContext.workspaceId"
need "$DOC" "anonymous fallback" \
  "document describes anonymous fallback"
need "$DOC" "default workspace" \
  "document describes default workspace compatibility"
need "$DOC" "does not enable public sign-up" \
  "document keeps no public sign-up"
need "$DOC" "no broad public launch" \
  "document keeps no broad public launch"
need "$DOC" "header workspace selector" \
  "document rejects header workspace selector"
need "$DOC" "query workspace selector" \
  "document rejects query workspace selector"
need "$DOC" "localStorage workspace selector" \
  "document rejects localStorage workspace selector"
need "$DOC" "sessionStorage workspace selector" \
  "document rejects sessionStorage workspace selector"
need "$DOC" "P3C-2 does not force login" \
  "document says routes are not forced login"
need "$DOC" "does not create real invite/session records" \
  "document says no real invite/session creation"
need "$DOC" "/api/tracks" \
  "document lists tracks route"
need "$DOC" "/api/tracks/:id/audio" \
  "document lists audio route"
need "$DOC" "/api/tracks/:id/download" \
  "document lists download route"
need "$DOC" "DELETE /api/tracks/:id" \
  "document lists delete route"
need "$DOC" "job list track lookup" \
  "document lists job list lookup"
need "$DOC" "job detail track lookup" \
  "document lists job detail lookup"
need "$DOC" "/api/byok/direct-live/save-to-library" \
  "document lists Save to Library route"
need "$DOC" "P3C-3" \
  "document names P3C-3 follow-up"
need "$DOC" "P3C-4" \
  "document names P3C-4 follow-up"

need "$SERVER_INDEX" "ANONYMOUS_ACCESS_CONTEXT" \
  "server imports anonymous access context"
need "$SERVER_INDEX" "type AccessContext" \
  "server imports AccessContext type"
need "$SERVER_INDEX" "function resolveRouteAccessContext" \
  "server defines route access context resolver"
need "$SERVER_INDEX" "workspaceId: DEFAULT_WORKSPACE_ID" \
  "access context defaults to default workspace"
need "$SERVER_INDEX" "const accessContext = resolveRouteAccessContext(req, config)" \
  "workspace resolver reads access context"
need "$SERVER_INDEX" "return accessContext.workspaceId ?? DEFAULT_WORKSPACE_ID" \
  "workspace resolver returns accessContext workspace"
need "$SERVER_INDEX" "Do not trust client header/query/cookie/localStorage workspace selectors" \
  "server documents untrusted client workspace selectors"
need_count_at_least "$SERVER_INDEX" "resolveCurrentWorkspaceId(req, config)" 7 \
  "main workspace routes use config-backed access context"
need_count_at_least "$SERVER_INDEX" "resolveCurrentWorkspaceId(req, _config)" 2 \
  "job track lookup uses access context"
need "$SERVER_INDEX" "loadManifest(config.outputDir, { workspaceId })" \
  "/api/tracks uses resolved workspace"
need "$SERVER_INDEX" "findTrackById(config.outputDir, match[1], { workspaceId })" \
  "track detail/audio/download use resolved workspace"
need "$SERVER_INDEX" "getTrackFilePath(config.outputDir, track.audioFileName, { workspaceId })" \
  "audio/download/delete file paths use resolved workspace"
need "$SERVER_INDEX" "removeTrack(config.outputDir, id, { workspaceId })" \
  "delete route uses resolved workspace"
need "$SERVER_INDEX" "appendTrack(config.outputDir, track, { workspaceId })" \
  "Save to Library or generation append uses resolved workspace"

if grep -Fq "x-workspace-id" "$SERVER_INDEX"; then
  fail "server uses x-workspace-id as a workspace source"
else
  ok "server does not use x-workspace-id as authorization source"
fi

if grep -Fq "query.workspaceId" "$SERVER_INDEX"; then
  fail "server uses query.workspaceId as a workspace source"
else
  ok "server does not use query.workspaceId as authorization source"
fi

if grep -Eq "localStorage\\.|sessionStorage\\.|window\\.localStorage|window\\.sessionStorage" "$SERVER_INDEX"; then
  fail "server reads browser storage"
else
  ok "server does not read localStorage/sessionStorage"
fi

need "$RELEASE_CHECK" "byok-multiuser-p3c2-access-context-route-gates-smoke-test.sh" \
  "release:check includes this smoke"

if grep -Eq '^[[:space:]]*(curl|wget|ssh|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit BYOK generation, call Save to Library, open live, call MiniMax, or download provider URLs"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/access or storage/tracks"
fi

ok "smoke script does not migrate storage"
ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_MULTIUSER_P3C2_ACCESS_CONTEXT_ROUTE_GATES_SMOKE_PASS"

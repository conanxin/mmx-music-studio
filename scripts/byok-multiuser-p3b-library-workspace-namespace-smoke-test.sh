#!/usr/bin/env bash
# BYOK-MULTIUSER-P3B-LIBRARY-WORKSPACE-NAMESPACE smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call Save to Library
# - does not call MiniMax
# - does not download provider URLs
# - does not migrate storage
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3B_LIBRARY_WORKSPACE_NAMESPACE_20260619.md"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_STORAGE="$REPO_ROOT/server/storage.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
SERVER_API="$REPO_ROOT/src/lib/serverApi.ts"
MANIFEST_AUDIT="$REPO_ROOT/scripts/manifest-audit.ts"
LIBRARY_TSX="$REPO_ROOT/src/features/library/Library.tsx"
LIBRARY_CSS="$REPO_ROOT/src/features/library/Library.module.css"
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

echo "=== BYOK multi-user P3B Library workspace namespace smoke ==="

[[ -f "$DOC" ]] || fail "P3B document exists"
ok "P3B document exists"

need "$DOC" "workspace namespace scaffolding" \
  "document describes workspace namespace scaffolding"
need "$DOC" "default / single-workspace compatibility" \
  "document describes single-workspace compatibility"
need "$DOC" "No broad public launch" \
  "document keeps no broad public launch boundary"
need "$DOC" "legacy storage layout" \
  "document records legacy storage compatibility"
need "$DOC" "storage/tracks/manifest.json" \
  "document names legacy manifest path"
need "$DOC" 'storage/workspaces/{workspaceId}/tracks/manifest.json' \
  "document names future workspace manifest path"
need "$DOC" 'storage/workspaces/{workspaceId}/tracks/audio/...' \
  "document names future workspace audio path"
need "$DOC" "does not allow a client header/query/cookie to choose a workspace" \
  "document blocks client-selected workspace"
need "$DOC" "P3C must bind session/auth to workspaceId server-side" \
  "document leaves auth binding to P3C"

need "$SERVER_TYPES" "workspaceId?: string" \
  "TrackMetadata has optional workspaceId"
need "$SERVER_TYPES" "ownerUserId?: string" \
  "TrackMetadata has optional ownerUserId"
need "$SERVER_TYPES" "visibility?: 'private' | 'workspace' | 'demo'" \
  "TrackMetadata has optional visibility"
need "$SERVER_API" "workspaceId?: string" \
  "client TrackLike accepts workspaceId"

need "$SERVER_STORAGE" "export const DEFAULT_WORKSPACE_ID = 'default'" \
  "storage defines default workspace"
need "$SERVER_STORAGE" "export function isSafeWorkspaceId" \
  "storage has workspace id validator"
need "$SERVER_STORAGE" "id.includes('..')" \
  "workspace validator blocks dot-dot"
need "$SERVER_STORAGE" "id.includes('/')" \
  "workspace validator blocks slash"
need "$SERVER_STORAGE" "id.includes('\\\\')" \
  "workspace validator blocks backslash"
need "$SERVER_STORAGE" "path.isAbsolute(id)" \
  "workspace validator blocks absolute paths"
need "$SERVER_STORAGE" "return /^[a-z0-9_-]+$/.test(id)" \
  "workspace validator has strict safe pattern"
need "$SERVER_STORAGE" "export function resolveTrackStoragePaths" \
  "storage resolves workspace track paths"
need "$SERVER_STORAGE" "workspaceId === DEFAULT_WORKSPACE_ID" \
  "default workspace branch exists"
need "$SERVER_STORAGE" "tracksDir: outputDir" \
  "default workspace maps to legacy tracks dir"
need "$SERVER_STORAGE" "audioDir: outputDir" \
  "default workspace maps audio to legacy tracks dir"
need "$SERVER_STORAGE" "path.join(storageRoot, WORKSPACES_DIR_NAME, workspaceId, 'tracks')" \
  "future workspace tracks dir exists"
need "$SERVER_STORAGE" "path.join(tracksDir, WORKSPACE_AUDIO_DIR_NAME)" \
  "future workspace audio dir exists"

need "$SERVER_INDEX" "function resolveCurrentWorkspaceId" \
  "server has current workspace resolver"
need "$SERVER_INDEX" "do not trust client header/query/cookie workspace selectors" \
  "server documents no client-selected workspace"
need "$SERVER_INDEX" "return DEFAULT_WORKSPACE_ID" \
  "server currently fixes workspace to default"
need "$SERVER_INDEX" "loadManifest(config.outputDir, { workspaceId })" \
  "/api/tracks reads current workspace manifest"
need "$SERVER_INDEX" "findTrackById(config.outputDir, match[1], { workspaceId })" \
  "track get/audio/download use current workspace"
need "$SERVER_INDEX" "getTrackFilePath(config.outputDir, track.audioFileName, { workspaceId })" \
  "audio/download file paths use current workspace"
need "$SERVER_INDEX" "appendTrack(config.outputDir, track, { workspaceId })" \
  "manifest append uses current workspace"
need "$SERVER_INDEX" "removeTrack(config.outputDir, id, { workspaceId })" \
  "track delete uses current workspace"
need "$SERVER_INDEX" "findByokDirectLiveTrackByIdempotency(" \
  "Save to Library idempotency helper exists"
need "$SERVER_INDEX" "workspaceId: t.workspaceId ?? DEFAULT_WORKSPACE_ID" \
  "track response normalizes legacy records to default workspace"

need "$MANIFEST_AUDIT" "workspaceId?: string" \
  "manifest audit accepts workspaceId"
need "$MANIFEST_AUDIT" "Invalid workspaceId" \
  "manifest audit validates workspaceId when present"
need "$MANIFEST_AUDIT" "visibility?: 'private' | 'workspace' | 'demo'" \
  "manifest audit accepts visibility"

need "$LIBRARY_TSX" "workspaceLabel" \
  "Library has workspace label helper"
need "$LIBRARY_TSX" "Default workspace" \
  "Library displays default workspace"
need "$LIBRARY_TSX" "workspaceTag" \
  "Library renders workspace badge"
need "$LIBRARY_TSX" "BYOK direct-live" \
  "Library keeps BYOK direct-live compatibility"
need "$LIBRARY_CSS" ".workspaceTag" \
  "Library has workspace badge style"

need "$RELEASE_CHECK" "byok-multiuser-p3b-library-workspace-namespace-smoke-test.sh" \
  "release:check includes this smoke"

if grep -Eq '^[[:space:]]*(curl|wget|ssh|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit BYOK generation, call Save to Library, open live, call MiniMax, or download provider URLs"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write or migrate storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_MULTIUSER_P3B_LIBRARY_WORKSPACE_NAMESPACE_SMOKE_PASS"

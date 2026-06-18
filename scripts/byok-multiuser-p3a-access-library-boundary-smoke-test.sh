#!/usr/bin/env bash
# BYOK-MULTIUSER-P3A-ACCESS-AND-LIBRARY-BOUNDARY-DESIGN smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call Save to Library
# - does not call MiniMax
# - does not download provider URLs
# - does not read env secrets
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3A_ACCESS_AND_LIBRARY_BOUNDARY_DESIGN_20260619.md"
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

echo "=== BYOK multi-user P3A access and Library boundary smoke ==="

[[ -f "$DOC" ]] || fail "P3A document exists"
ok "P3A document exists"

need "$DOC" "not ready for broad public launch" \
  "document blocks broad public launch"
need "$DOC" "controlled multi-user pilot" \
  "document defines controlled multi-user pilot"
need "$DOC" "invite-only" \
  "document requires invite-only access"
need "$DOC" "global manifest" \
  "document records current global manifest risk"
need "$DOC" "storage/tracks/manifest.json" \
  "document names current global manifest path"
need "$DOC" "workspaceId" \
  "document includes workspaceId"
need "$DOC" "userId" \
  "document includes userId"
need "$DOC" "sessionId" \
  "document includes sessionId"
need "$DOC" "signed / bound / expiring / revocable" \
  "document requires strong session cookie properties"
need "$DOC" "format-only validation" \
  "document rejects format-only cookie validation"
need "$DOC" "storage/workspaces/{workspaceId}/tracks/manifest.json" \
  "document proposes workspace manifest namespace"
need "$DOC" "storage/workspaces/{workspaceId}/tracks/audio/..." \
  "document proposes workspace audio namespace"
need "$DOC" '`/api/tracks` must return only the current workspace tracks' \
  "document requires workspace-filtered track list"
need "$DOC" '`/api/tracks/:id/audio` must verify workspace ownership' \
  "document requires audio ownership check"
need "$DOC" '`/api/tracks/:id/download` must verify workspace ownership' \
  "document requires download ownership check"
need "$DOC" "Save to Library must write the current workspace manifest" \
  "document requires workspace-scoped Save to Library"
need "$DOC" "user/workspace daily generation quota" \
  "document includes user/workspace generation quota"
need "$DOC" "user/workspace daily save quota" \
  "document includes user/workspace save quota"
need "$DOC" "cooldown" \
  "document includes cooldown"
need "$DOC" "failure lock" \
  "document includes failure lock"
need "$DOC" "The MiniMax/BYOK key is request-memory only" \
  "document keeps BYOK key request-memory only"
need "$DOC" "must not be persisted to cookie, localStorage, sessionStorage, manifest, logs, audit payloads, or track metadata" \
  "document forbids sensitive persistence"
need "$DOC" "deletion/revocation ready" \
  "document includes deletion and revocation gate"
need "$DOC" "audit ready" \
  "document includes audit gate"
need "$DOC" "P3B" \
  "document includes P3B split"
need "$DOC" "P3C" \
  "document includes P3C split"
need "$DOC" "P3D" \
  "document includes P3D split"
need "$DOC" "P3E" \
  "document includes P3E split"
need "$DOC" "P4" \
  "document includes P4 split"
need "$DOC" "Launch Gate Checklist" \
  "document includes public launch gate checklist"
need "$DOC" "does not implement accounts, real multi-tenant storage, workspace manifest migration" \
  "document states P3A does not implement real multi-user storage"
need "$DOC" "does not change production environment" \
  "document states no production change"
need "$DOC" 'submit `/api/generate/byok`' \
  "document states no BYOK generation submission"
need "$DOC" "provider URL download" \
  "document states no provider URL download"

need "$RELEASE_CHECK" "byok-multiuser-p3a-access-library-boundary-smoke-test.sh" \
  "release:check includes this smoke"

if grep -Eq '^[[:space:]]*(curl|wget|ssh|node|python|python3|npm|pnpm|yarn|ts-node)\b' "$0"; then
  fail "smoke script contains a network/runtime execution primitive"
else
  ok "smoke script does not submit BYOK generation, call Save to Library, open live, call MiniMax, or download provider URLs"
fi

if grep -Eq '^[[:space:]]*(rm|cp|mv|touch|mkdir|install|tee)\b|^[[:space:]]*cat[[:space:]].*>' "$0"; then
  fail "smoke script contains a file write primitive"
else
  ok "smoke script does not write storage/tracks"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_MULTIUSER_P3A_ACCESS_LIBRARY_BOUNDARY_SMOKE_PASS"

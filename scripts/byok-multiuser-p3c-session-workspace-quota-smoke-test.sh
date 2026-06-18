#!/usr/bin/env bash
# BYOK-MULTIUSER-P3C-SESSION-WORKSPACE-BINDING-AND-QUOTA-DESIGN smoke test.
#
# Static/local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call Save to Library
# - does not call MiniMax
# - does not download provider URLs
# - does not write storage/tracks

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C_SESSION_WORKSPACE_BINDING_AND_QUOTA_DESIGN_20260619.md"
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

echo "=== BYOK multi-user P3C session/workspace quota smoke ==="

[[ -f "$DOC" ]] || fail "P3C document exists"
ok "P3C document exists"

need "$DOC" "invite-only" \
  "document defines invite-only model"
need "$DOC" "not ready for broad public launch" \
  "document keeps no broad public launch boundary"
need "$DOC" "signed cookie" \
  "document requires signed cookie"
need "$DOC" "expiring cookie/session" \
  "document requires expiring cookie/session"
need "$DOC" "revocable session" \
  "document requires revocable session"
need "$DOC" "userId" \
  "document includes userId"
need "$DOC" "workspaceId" \
  "document includes workspaceId"
need "$DOC" "sessionId" \
  "document includes sessionId"
need "$DOC" "inviteId" \
  "document includes inviteId"
need "$DOC" "server-side session store" \
  "document defines server-side session store"
need "$DOC" "storage/access/sessions.json" \
  "document names sessions store path"
need "$DOC" "storage/access/invites.json" \
  "document names invites store path"
need "$DOC" "storage/access/revocations.json" \
  "document names revocations store path"
need "$DOC" "query.workspaceId" \
  "document rejects query workspace selector"
need "$DOC" 'header `x-workspace-id`' \
  "document rejects header workspace selector"
need "$DOC" "localStorage workspaceId" \
  "document rejects localStorage workspace selector"
need "$DOC" "resolveCurrentWorkspaceId(req) -> read signed session -> verify signature / expiry / revocation -> return workspaceId" \
  "document resolves workspace from signed session"
need "$DOC" "Safe Preview Anonymous" \
  "document defines anonymous safe preview mode"
need "$DOC" "Invite-Only User Mode" \
  "document defines invite-only user mode"
need "$DOC" "Operator/Admin Mode" \
  "document defines operator/admin mode"
need "$DOC" "dailyGenerationQuotaPerUser" \
  "document defines daily generation quota per user"
need "$DOC" "dailyGenerationQuotaPerWorkspace" \
  "document defines daily generation quota per workspace"
need "$DOC" "dailySaveQuotaPerUser" \
  "document defines daily save quota per user"
need "$DOC" "dailySaveQuotaPerWorkspace" \
  "document defines daily save quota per workspace"
need "$DOC" "cooldownSeconds" \
  "document defines cooldown"
need "$DOC" "failureLockThreshold" \
  "document defines failure lock threshold"
need "$DOC" "failureLockMinutes" \
  "document defines failure lock minutes"
need "$DOC" "/api/generate/byok" \
  "document gates BYOK generation route"
need "$DOC" "/api/byok/direct-live/save-to-library" \
  "document gates Save to Library route"
need "$DOC" "/api/tracks" \
  "document gates tracks route"
need "$DOC" "/api/tracks/:id/audio" \
  "document gates audio route"
need "$DOC" "/api/tracks/:id/download" \
  "document gates download route"
need "$DOC" "ownership check" \
  "document requires audio/download ownership check"
need "$DOC" "BYOK key handling remains request-memory only" \
  "document keeps BYOK key request-memory only"
need "$DOC" "token/key/secret" \
  "document forbids token/key/secret persistence"
need "$DOC" "deletion" \
  "document includes deletion"
need "$DOC" "revocation" \
  "document includes revocation"
need "$DOC" "audit" \
  "document includes audit"
need "$DOC" "P3D" \
  "document includes P3D route"
need "$DOC" "P3E" \
  "document includes P3E route"
need "$DOC" "P4" \
  "document includes P4 route"
need "$DOC" "does not implement real auth" \
  "document states no real auth implementation"
need "$DOC" 'does not submit `/api/generate/byok`' \
  "document states no BYOK generation submit"
need "$DOC" "does not call Save to Library" \
  "document states no Save to Library call"
need "$DOC" "does not start BYOK live" \
  "document states no live enablement"
need "$DOC" "does not call MiniMax" \
  "document states no MiniMax call"
need "$DOC" "does not download provider URLs" \
  "document states no provider URL download"
need "$DOC" 'does not write `storage/tracks`' \
  "document states no storage/tracks writes"

need "$RELEASE_CHECK" "byok-multiuser-p3c-session-workspace-quota-smoke-test.sh" \
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
echo "BYOK_MULTIUSER_P3C_SESSION_WORKSPACE_QUOTA_SMOKE_PASS"

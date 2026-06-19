#!/usr/bin/env bash
# BYOK-MULTIUSER-P3C1-FIVE-USER-INVITE-SESSION-SCAFFOLDING smoke test.
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
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C1_FIVE_USER_INVITE_SESSION_SCAFFOLDING_20260619.md"
ACCESS_TS="$REPO_ROOT/server/access.ts"
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

echo "=== BYOK multi-user P3C1 five-user invite/session smoke ==="

[[ -f "$DOC" ]] || fail "P3C1 document exists"
ok "P3C1 document exists"
[[ -f "$ACCESS_TS" ]] || fail "access scaffold exists"
ok "access scaffold exists"

need "$DOC" "five-user small-circle version" \
  "document states five-user small-circle target"
need "$DOC" "at most 5 active users" \
  "document states max active users"
need "$DOC" "No broad public launch" \
  "document blocks broad public launch"
need "$DOC" "No public registration" \
  "document blocks public registration"
need "$DOC" "five-user invite-only mode" \
  "document defines invite-only mode"
need "$DOC" "signed, expiring, and revocable" \
  "document requires signed expiring revocable session"
need "$DOC" "workspaceId" \
  "document includes workspaceId"
need "$DOC" "userId" \
  "document includes userId"
need "$DOC" "sessionId" \
  "document includes sessionId"
need "$DOC" "inviteId" \
  "document includes inviteId"
need "$DOC" "storage/access/invites.json" \
  "document includes invite store"
need "$DOC" "storage/access/sessions.json" \
  "document includes session store"
need "$DOC" "storage/access/revocations.json" \
  "document includes revocation store"
need "$DOC" "header workspace selector" \
  "document rejects header workspace selector"
need "$DOC" "query workspace selector" \
  "document rejects query workspace selector"
need "$DOC" "localStorage workspace selector" \
  "document rejects localStorage workspace selector"
need "$DOC" "Save to Library must write the current workspace manifest" \
  "document scopes Save to Library to current workspace"
need "$DOC" "Library reads must be for the current workspace" \
  "document scopes Library to current workspace"
need "$DOC" "BYOK key handling remains request-memory only" \
  "document keeps BYOK key request-memory only"
need "$DOC" "cookie" \
  "document forbids BYOK key in cookie"
need "$DOC" "localStorage" \
  "document forbids BYOK key in localStorage"
need "$DOC" "sessionStorage" \
  "document forbids BYOK key in sessionStorage"
need "$DOC" "If active use grows beyond 5 users" \
  "document requires upgrade beyond five users"
need "$DOC" 'does not call `/api/generate/byok`' \
  "document states no BYOK generation call"
need "$DOC" "does not call Save to Library" \
  "document states no Save to Library call"
need "$DOC" "does not call MiniMax" \
  "document states no MiniMax call"
need "$DOC" "does not download provider URLs" \
  "document states no provider URL download"
need "$DOC" "does not deploy production" \
  "document states no production deploy"

need "$ACCESS_TS" "export const MAX_ACTIVE_INVITES = 5" \
  "access scaffold caps active invites at five"
need "$ACCESS_TS" "export const MAX_ACTIVE_SESSIONS = 5" \
  "access scaffold caps active sessions at five"
need "$ACCESS_TS" "export interface InviteRecord" \
  "access scaffold defines InviteRecord"
need "$ACCESS_TS" "export interface SessionRecord" \
  "access scaffold defines SessionRecord"
need "$ACCESS_TS" "export interface RevocationRecord" \
  "access scaffold defines RevocationRecord"
need "$ACCESS_TS" "export interface AccessContext" \
  "access scaffold defines AccessContext"
need "$ACCESS_TS" "export interface SessionCookiePayload" \
  "access scaffold defines signed cookie payload"
need "$ACCESS_TS" "export const ANONYMOUS_ACCESS_CONTEXT" \
  "access scaffold defines anonymous fallback"
need "$ACCESS_TS" "export function signSessionCookiePayload" \
  "access scaffold signs session cookies"
need "$ACCESS_TS" "export function verifySignedSessionCookie" \
  "access scaffold verifies signed session cookies"
need "$ACCESS_TS" "crypto.timingSafeEqual" \
  "access scaffold uses timing-safe signature comparison"
need "$ACCESS_TS" "HttpOnly" \
  "access scaffold builds HttpOnly cookie"
need "$ACCESS_TS" "Secure" \
  "access scaffold builds Secure cookie"
need "$ACCESS_TS" "SameSite=Lax" \
  "access scaffold builds SameSite cookie"
need "$ACCESS_TS" "isFiveUserPilotWithinCap" \
  "access scaffold has five-user cap helper"
need "$ACCESS_TS" "ACCESS_INVITES_FILE = 'storage/access/invites.json'" \
  "access scaffold names invite store path"
need "$ACCESS_TS" "ACCESS_SESSIONS_FILE = 'storage/access/sessions.json'" \
  "access scaffold names session store path"
need "$ACCESS_TS" "ACCESS_REVOCATIONS_FILE = 'storage/access/revocations.json'" \
  "access scaffold names revocation store path"

need "$RELEASE_CHECK" "byok-multiuser-p3c1-five-user-invite-session-smoke-test.sh" \
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
echo "BYOK_MULTIUSER_P3C1_FIVE_USER_INVITE_SESSION_SMOKE_PASS"

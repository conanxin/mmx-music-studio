#!/usr/bin/env bash
#
# BYOK-MULTIUSER-P3C4-INVITE-SESSION-ROUTE-GATE-ENFORCEMENT smoke test.
#
# Static/local-only guard:
# - does not start the server
# - does not call network endpoints
# - does not write storage/access or storage/tracks
# - does not open BYOK live
# - does not call MiniMax

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C4_INVITE_SESSION_ROUTE_GATE_ENFORCEMENT_20260619.md"
ACCESS_TS="$REPO_ROOT/server/access.ts"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"

PASS=0
FAIL=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1" >&2
  FAIL=$((FAIL + 1))
}

need() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if grep -Fq "$pattern" "$file"; then
    pass "$description"
  else
    fail "$description (missing: $pattern)"
  fi
}

need_regex() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if grep -Eq "$pattern" "$file"; then
    pass "$description"
  else
    fail "$description (missing regex: $pattern)"
  fi
}

echo "=== BYOK multi-user P3C4 route gate enforcement smoke ==="

[[ -f "$DOC" ]] || fail "P3C4 document exists"
[[ -f "$ACCESS_TS" ]] || fail "server/access.ts exists"
[[ -f "$SERVER_INDEX" ]] || fail "server/index.ts exists"
[[ -f "$SERVER_TYPES" ]] || fail "server/types.ts exists"

need "$DOC" "route gate enforcement" \
  "document describes route gate enforcement"
need "$DOC" "multiuser route gate is default off" \
  "document states multiuser gate default off"
need "$DOC" 'access context mode is `invite_user`' \
  "document requires invite_user mode"
need "$DOC" "multiuser_invite_session_required" \
  "document defines stable route gate error code"
need "$DOC" "does not enable public sign-up" \
  "document says no public sign-up"
need "$DOC" "no broad public launch" \
  "document keeps no broad public launch"
need "$DOC" '`x-workspace-id`' \
  "document rejects header workspace selector"
need "$DOC" 'query `workspaceId`' \
  "document rejects query workspace selector"
need "$DOC" "localStorage workspace selectors" \
  "document rejects localStorage workspace selector"
need "$DOC" "sessionStorage workspace selectors" \
  "document rejects sessionStorage workspace selector"
need "$DOC" "POST /api/generate/byok" \
  "document gates BYOK generate route"
need "$DOC" "POST /api/byok/direct-live/save-to-library" \
  "document gates Save to Library route"
need "$DOC" "DELETE /api/tracks/:id" \
  "document gates delete track route"
need "$DOC" "Read-only Library routes remain compatible" \
  "document keeps read-only routes compatible"
need "$DOC" "The response does not include cookie values" \
  "document forbids leaking cookie/session details"
need "$DOC" "The BYOK key remains request-memory only" \
  "document keeps BYOK key request-memory only"
need "$DOC" "session secret is server-only" \
  "document keeps session secret server-only"
need "$DOC" "P3C-5: user/workspace quota enforcement" \
  "document lists P3C-5 follow-up"
need "$DOC" "P3D: Library workspace UI" \
  "document lists P3D follow-up"
need "$DOC" "P3E: five-user controlled pilot" \
  "document lists P3E follow-up"

need "$ACCESS_TS" "isInviteUserAccessContext" \
  "access helper includes invite_user context predicate"
need "$ACCESS_TS" "accessContext.mode === 'invite_user'" \
  "access helper requires invite_user mode"
need "$ACCESS_TS" "accessContext.isAuthenticated === true" \
  "access helper requires authenticated context"
need "$ACCESS_TS" "!!accessContext.userId" \
  "access helper requires userId"
need "$ACCESS_TS" "!!accessContext.workspaceId" \
  "access helper requires workspaceId"
need "$ACCESS_TS" "!!accessContext.sessionId" \
  "access helper requires sessionId"
need "$ACCESS_TS" "!!accessContext.inviteId" \
  "access helper requires inviteId"

need "$SERVER_TYPES" "multiuserRouteGateEnabled: boolean" \
  "server config type includes route gate flag"
need "$SERVER_INDEX" "multiuserRouteGateEnabled: readBoolEnv('MULTIUSER_ROUTE_GATE_ENABLED', false)" \
  "server config defaults route gate to false"
need "$SERVER_INDEX" "function isMultiuserRouteGateEnabled" \
  "server includes route gate enabled helper"
need "$SERVER_INDEX" "config.multiuserAccessEnabled === true && config.multiuserRouteGateEnabled === true" \
  "route gate requires explicit multiuser access and route gate flags"
need "$SERVER_INDEX" "function requireInviteUserForAction" \
  "server includes require invite user helper"
need "$SERVER_INDEX" "sendMultiuserInviteSessionRequired" \
  "server includes stable multiuser invite session error sender"
need "$SERVER_INDEX" "code: 'multiuser_invite_session_required'" \
  "server returns stable route gate code"
need "$SERVER_INDEX" "stage: 'multiuser_invite_session_required'" \
  "server returns stable route gate stage"
need "$SERVER_INDEX" "A valid invite session is required for this action." \
  "server returns stable user-facing route gate message"
need "$SERVER_INDEX" "Do not trust client header/query/cookie/localStorage workspace selectors." \
  "server documents untrusted client workspace selectors"
need "$SERVER_INDEX" "Do not log or return cookies, signatures, session IDs, or secrets here." \
  "server documents secret-safe route gate error"
need "$SERVER_INDEX" "requireInviteUserForAction(req, res, config, 'byok_generate')" \
  "BYOK generate route uses route gate helper"
need "$SERVER_INDEX" "requireInviteUserForAction(req, res, config, 'byok_save_to_library')" \
  "Save to Library route uses route gate helper"
need "$SERVER_INDEX" "requireInviteUserForAction(req, res, config, 'track_delete')" \
  "DELETE track route uses route gate helper"
need "$SERVER_INDEX" "if (config.multiuserAccessEnabled && config.multiuserSessionSecret)" \
  "missing session secret cannot authorize invite_user access"

if grep -Eq "req\.headers\[['\"]x-workspace-id['\"]\]|query\.workspaceId|searchParams\.get\(['\"]workspaceId['\"]\)|localStorage\.getItem|sessionStorage\.getItem" "$SERVER_INDEX"; then
  fail "server must not use client-selected workspace as an authorization source"
else
  pass "server does not use header/query/localStorage/sessionStorage workspace selectors"
fi

if grep -Eq 'localStorage|sessionStorage|/api/generate/byok|/api/byok/direct-live/save-to-library' "$0"; then
  pass "smoke references guarded routes only for static assertions"
else
  fail "smoke should statically reference guarded routes"
fi

if grep -Eq '^[^#]*(curl|wget|ssh|npm run dev|node server|tsx .*server)' "$0"; then
  fail "smoke must not call network commands or start the server"
else
  pass "smoke does not call network commands or start the server"
fi

if grep -Eq '^[^#]*(curl|wget|ssh|npm run dev|node server|tsx .*server|open --apply|Remove-Item|rm -rf|mkdir|touch|cat >|>> storage|> storage)' "$0"; then
  fail "smoke must not execute generation, save, live, MiniMax, or storage writes"
else
  pass "smoke does not execute generation, save, live, MiniMax, or storage writes"
fi

need "$RELEASE_CHECK" "byok-multiuser-p3c4-route-gate-enforcement-smoke-test.sh" \
  "release:check includes this smoke"

echo ""
echo "=== Result ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if (( FAIL == 0 )); then
  echo "BYOK_MULTIUSER_P3C4_ROUTE_GATE_ENFORCEMENT_SMOKE_PASS"
  exit 0
fi

echo "BYOK_MULTIUSER_P3C4_ROUTE_GATE_ENFORCEMENT_SMOKE_FAIL"
exit 1

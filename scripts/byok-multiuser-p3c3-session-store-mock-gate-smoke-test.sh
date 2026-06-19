#!/usr/bin/env bash
#
# BYOK-MULTIUSER-P3C3-SESSION-STORE-MOCK-GATE smoke test.
#
# Static/local fixture only:
# - does not start the server
# - does not call network endpoints
# - does not write real storage/access
# - does not open BYOK live
# - does not call MiniMax

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C3_SESSION_STORE_MOCK_GATE_20260619.md"
ACCESS_TS="$REPO_ROOT/server/access.ts"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"
REAL_ACCESS_DIR="$REPO_ROOT/storage/access"

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

echo "=== BYOK multi-user P3C3 session store mock gate smoke ==="

[[ -f "$DOC" ]] || fail "P3C3 document exists"
[[ -f "$ACCESS_TS" ]] || fail "server/access.ts exists"
[[ -f "$SERVER_INDEX" ]] || fail "server/index.ts exists"
[[ -f "$SERVER_TYPES" ]] || fail "server/types.ts exists"

need "$DOC" "valid signed session" \
  "document describes valid signed session fixture"
need "$DOC" "invite_user" \
  "document describes invite_user context"
need "$DOC" "anonymous/default" \
  "document describes anonymous/default fallback"
need "$DOC" "revoked or expired" \
  "document describes revoked/expired fallback"
need "$DOC" "Five-User Cap" \
  "document includes five-user cap"
need "$DOC" "Multiuser access is default off" \
  "document states multiuser access default off"
need "$DOC" "Missing session secret means anonymous/default" \
  "document states missing secret fallback"
need "$DOC" "must not be exposed in health, logs" \
  "document forbids exposing session secret"
need "$DOC" "does not create real production invite/session records" \
  "document says no production invite/session creation"
need "$DOC" "does not enable public sign-up" \
  "document says no public sign-up"
need "$DOC" "does not force all routes to login" \
  "document says no forced login"
need "$DOC" "does not open BYOK live" \
  "document says no BYOK live"
need "$DOC" "does not call MiniMax" \
  "document says no MiniMax call"
need "$DOC" "does not download provider URLs" \
  "document says no provider URL download"
need "$DOC" "P3C-4: route gate enforcement" \
  "document lists P3C-4 follow-up"
need "$DOC" "P3C-5: user/workspace quota enforcement" \
  "document lists P3C-5 follow-up"
need "$DOC" "P3E: five-user controlled pilot" \
  "document lists P3E follow-up"

need "$ACCESS_TS" "readInvitesStore" \
  "access helper reads invites fixture store"
need "$ACCESS_TS" "readSessionsStore" \
  "access helper reads sessions fixture store"
need "$ACCESS_TS" "readRevocationsStore" \
  "access helper reads revocations fixture store"
need "$ACCESS_TS" "resolveAccessContextFromRequest" \
  "access helper resolves request context"
need "$ACCESS_TS" "validateFiveUserAccessStores" \
  "access helper validates five-user store caps"
need "$ACCESS_TS" "ACCESS_SESSION_COOKIE_NAME" \
  "access helper uses named session cookie"
need "$ACCESS_TS" "verifySignedSessionCookie" \
  "access helper verifies signed cookie"
need "$ACCESS_TS" "timingSafeEqual" \
  "access helper uses timing-safe signature compare"
need "$ACCESS_TS" "mode: 'invite_user'" \
  "access helper returns invite_user for verified sessions"
need "$ACCESS_TS" "mode: 'anonymous'" \
  "access helper preserves anonymous fallback"
need "$ACCESS_TS" "targetType === targetType" \
  "access helper checks revocation targets"

need "$SERVER_INDEX" "resolveAccessContextFromRequest" \
  "server route resolver calls access helper"
need "$SERVER_INDEX" "multiuserAccessEnabled" \
  "server config includes explicit multiuser enable flag"
need "$SERVER_INDEX" "multiuserSessionSecret" \
  "server config includes server-only session secret"
need "$SERVER_INDEX" "multiuserAccessStoreDir" \
  "server config supports fixture store dir"
need "$SERVER_INDEX" "Do not trust client header/query/cookie/localStorage workspace selectors." \
  "server route resolver documents untrusted client workspace selectors"
need "$SERVER_TYPES" "multiuserAccessEnabled: boolean" \
  "server types include multiuser access flag"
need "$SERVER_TYPES" "multiuserSessionSecret?: string" \
  "server types include optional session secret"
need "$SERVER_TYPES" "multiuserAccessStoreDir?: string" \
  "server types include optional fixture store dir"
need "$RELEASE_CHECK" "byok-multiuser-p3c3-session-store-mock-gate-smoke-test.sh" \
  "release:check includes this smoke"

need_regex "$0" 'curl|wget|ssh' \
  "smoke script mentions no external network commands only in comments/checks"
if grep -Eq '^[^#]*(curl|wget|ssh)[[:space:]]' "$0"; then
  fail "smoke must not execute curl/wget/ssh"
else
  pass "smoke does not execute curl/wget/ssh"
fi

if [[ -d "$REAL_ACCESS_DIR" ]]; then
  BEFORE_REAL_ACCESS_STATE="$(find "$REAL_ACCESS_DIR" -maxdepth 1 -type f -print | sort)"
else
  BEFORE_REAL_ACCESS_STATE=""
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ACCESS_IMPORT="$(node -e "const { pathToFileURL } = require('node:url'); console.log(pathToFileURL(process.argv[1]).href)" "$ACCESS_TS")"
STORE_DIR="$TMP_DIR/access-store"
TEST_FILE="$TMP_DIR/p3c3-session-store-test.mts"

cat > "$TEST_FILE" <<TS
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ACCESS_SESSION_COOKIE_NAME,
  signSessionCookiePayload,
  resolveAccessContextFromRequest,
  validateFiveUserAccessStores,
  type InviteRecord,
  type SessionRecord,
  type RevocationRecord,
} from '$ACCESS_IMPORT';

const storeDir = ${STORE_DIR@Q};
const now = new Date('2026-06-19T00:00:00.000Z');
const future = '2026-06-20T00:00:00.000Z';
const past = '2026-06-18T00:00:00.000Z';
const signingMaterial = 'fixture-signing-material-only';

let pass = 0;
function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
  pass += 1;
}

function request(cookie?: string, headers: Record<string, string> = {}): any {
  return {
    headers: cookie ? { ...headers, cookie } : headers,
    url: '/api/tracks?workspaceId=spoofed-workspace',
  };
}

function invite(overrides: Partial<InviteRecord> = {}): InviteRecord {
  return {
    inviteId: 'invite_1',
    userId: 'user_1',
    workspaceId: 'workspace_one',
    displayName: 'Fixture User',
    createdAt: '2026-06-19T00:00:00.000Z',
    expiresAt: future,
    maxSessions: 1,
    status: 'active',
    ...overrides,
  };
}

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: 'session_1',
    inviteId: 'invite_1',
    userId: 'user_1',
    workspaceId: 'workspace_one',
    issuedAt: '2026-06-19T00:00:00.000Z',
    expiresAt: future,
    status: 'active',
    ...overrides,
  };
}

function writeStore(
  invites: InviteRecord[] = [],
  sessions: SessionRecord[] = [],
  revocations: RevocationRecord[] = [],
): void {
  fs.mkdirSync(storeDir, { recursive: true });
  fs.writeFileSync(path.join(storeDir, 'invites.json'), JSON.stringify(invites, null, 2));
  fs.writeFileSync(path.join(storeDir, 'sessions.json'), JSON.stringify(sessions, null, 2));
  fs.writeFileSync(path.join(storeDir, 'revocations.json'), JSON.stringify(revocations, null, 2));
}

function cookie(expiresAt = future): string {
  const token = signSessionCookiePayload({
    sessionId: 'session_1',
    userId: 'user_1',
    workspaceId: 'workspace_one',
    inviteId: 'invite_1',
    issuedAt: '2026-06-19T00:00:00.000Z',
    expiresAt,
  }, signingMaterial);
  return \`\${ACCESS_SESSION_COOKIE_NAME}=\${token}\`;
}

let ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: false,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'disabled gate should return anonymous/default');

ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'missing secret should return anonymous/default');

ctx = resolveAccessContextFromRequest(request(), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'missing cookie should return anonymous/default');

ctx = resolveAccessContextFromRequest(request(\`\${ACCESS_SESSION_COOKIE_NAME}=invalid.token\`), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'invalid cookie should return anonymous/default');

ctx = resolveAccessContextFromRequest(request(cookie(past)), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'expired cookie should return anonymous/default');

const missingStore = path.join(storeDir, 'missing');
ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir: missingStore,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.workspaceId === 'default', 'missing store should return anonymous/default');

writeStore([invite()], [session()], []);
ctx = resolveAccessContextFromRequest(request(cookie(), { 'x-workspace-id': 'spoofed-workspace' }), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'invite_user', 'valid fixture session should return invite_user');
assert(ctx.isAuthenticated === true, 'valid fixture session should authenticate');
assert(ctx.workspaceId === 'workspace_one', 'workspace should come from verified session store');
assert(ctx.userId === 'user_1' && ctx.sessionId === 'session_1' && ctx.inviteId === 'invite_1', 'identity fields should come from verified session store');

writeStore([invite()], [session()], [{
  revocationId: 'rev_session_1',
  targetType: 'session',
  targetId: 'session_1',
  revokedAt: '2026-06-19T00:00:00.000Z',
}]);
ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.isAuthenticated === false, 'revoked session should not authenticate');

writeStore([invite()], [session()], [{
  revocationId: 'rev_invite_1',
  targetType: 'invite',
  targetId: 'invite_1',
  revokedAt: '2026-06-19T00:00:00.000Z',
}]);
ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.isAuthenticated === false, 'revoked invite should not authenticate');

writeStore([invite()], [session({ expiresAt: past })], []);
ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.isAuthenticated === false, 'expired session should not authenticate');

writeStore([invite({ expiresAt: past })], [session()], []);
ctx = resolveAccessContextFromRequest(request(cookie()), {
  enabled: true,
  sessionSecret: signingMaterial,
  storeDir,
  defaultWorkspaceId: 'default',
  now,
});
assert(ctx.mode === 'anonymous' && ctx.isAuthenticated === false, 'expired invite should not authenticate');

const fiveInvites = Array.from({ length: 5 }, (_, index) => invite({ inviteId: \`invite_\${index}\`, userId: \`user_\${index}\`, workspaceId: \`workspace_\${index}\` }));
const fiveSessions = Array.from({ length: 5 }, (_, index) => session({ sessionId: \`session_\${index}\`, inviteId: \`invite_\${index}\`, userId: \`user_\${index}\`, workspaceId: \`workspace_\${index}\` }));
let cap = validateFiveUserAccessStores(fiveInvites, fiveSessions, now);
assert(cap.ok === true && cap.activeInvites === 5 && cap.activeSessions === 5, 'five active invites/sessions should remain within cap');

cap = validateFiveUserAccessStores([...fiveInvites, invite({ inviteId: 'invite_6', userId: 'user_6', workspaceId: 'workspace_6' })], fiveSessions, now);
assert(cap.ok === false && cap.code === 'active_invite_cap_exceeded', 'six active invites should exceed cap');

cap = validateFiveUserAccessStores(fiveInvites, [...fiveSessions, session({ sessionId: 'session_6', inviteId: 'invite_6', userId: 'user_6', workspaceId: 'workspace_6' })], now);
assert(cap.ok === false && cap.code === 'active_session_cap_exceeded', 'six active sessions should exceed cap');

const storeText = fs.readFileSync(path.join(storeDir, 'invites.json'), 'utf8')
  + fs.readFileSync(path.join(storeDir, 'sessions.json'), 'utf8')
  + fs.readFileSync(path.join(storeDir, 'revocations.json'), 'utf8');
assert(!storeText.includes('BYOK_SECRET_SENTINEL'), 'store should not contain BYOK key sentinel');
assert(!storeText.includes('Authorization'), 'store should not contain Authorization');
assert(!storeText.includes('confirmation'), 'store should not contain confirmation phrase');

console.log(\`fixture assertions passed: \${pass}\`);
TS

npx --no-install tsx "$TEST_FILE"
pass "fixture resolver test passed"

if [[ -d "$REAL_ACCESS_DIR" ]]; then
  AFTER_REAL_ACCESS_STATE="$(find "$REAL_ACCESS_DIR" -maxdepth 1 -type f -print | sort)"
else
  AFTER_REAL_ACCESS_STATE=""
fi

if [[ "$BEFORE_REAL_ACCESS_STATE" == "$AFTER_REAL_ACCESS_STATE" ]]; then
  pass "smoke did not write real storage/access files"
else
  fail "smoke changed real storage/access files"
fi

if [[ -d "$TMP_DIR" ]]; then
  pass "temp fixture directory scheduled for cleanup"
else
  fail "temp fixture directory missing before cleanup trap"
fi

echo ""
echo "=== Result ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if (( FAIL == 0 )); then
  echo "BYOK_MULTIUSER_P3C3_SESSION_STORE_MOCK_GATE_SMOKE_PASS"
  exit 0
fi

echo "BYOK_MULTIUSER_P3C3_SESSION_STORE_MOCK_GATE_SMOKE_FAIL"
exit 1

#!/usr/bin/env bash
#
# BYOK-PUBLIC-LITE-P3F-FIVE-ACTIVE-USER-CAP smoke test.
#
# Static/local fixture guard:
# - does not start the server
# - does not call network endpoints
# - does not write real storage/access or storage/tracks
# - does not open BYOK live
# - does not call MiniMax

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DOC="$REPO_ROOT/docs/launch/BYOK_PUBLIC_LITE_P3F_FIVE_ACTIVE_USER_CAP_20260619.md"
PUBLIC_ACCESS_TS="$REPO_ROOT/server/publicAccess.ts"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
SERVER_API="$REPO_ROOT/src/lib/serverApi.ts"
BYOK_PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"
REAL_ACCESS_DIR="$REPO_ROOT/storage/access"
REAL_TRACKS_DIR="$REPO_ROOT/storage/tracks"

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

echo "=== BYOK public-lite P3F five active user cap smoke ==="

[[ -f "$DOC" ]] || fail "P3F document exists"
[[ -f "$PUBLIC_ACCESS_TS" ]] || fail "server/publicAccess.ts exists"
[[ -f "$SERVER_INDEX" ]] || fail "server/index.ts exists"
[[ -f "$SERVER_TYPES" ]] || fail "server/types.ts exists"
[[ -f "$SERVER_API" ]] || fail "src/lib/serverApi.ts exists"
[[ -f "$BYOK_PANEL" ]] || fail "ByokPanel exists"

need "$DOC" "five active user cap" \
  "document states five active user cap"
need "$DOC" "not a broad public launch" \
  "document keeps no broad public launch"
need "$DOC" "does not open public sign-up" \
  "document states no public sign-up"
need "$DOC" "PUBLIC_LITE_MODE_ENABLED=false" \
  "document states public-lite default off"
need "$DOC" "PUBLIC_LITE_MAX_ACTIVE_USERS=5" \
  "document states max active users is 5"
need "$DOC" "PUBLIC_LITE_SESSION_TTL_MINUTES=30" \
  "document states active session TTL"
need "$DOC" "GET /api/public-capacity" \
  "document includes public capacity API"
need "$DOC" "public_capacity_full" \
  "document includes capacity full error code"
need "$DOC" "MiniMax is not called" \
  "document says capacity full blocks MiniMax"
need "$DOC" "provider URLs are not downloaded" \
  "document says capacity full blocks provider download"
need "$DOC" "manifests are not written" \
  "document says capacity full blocks manifest writes"
need "$DOC" "must not save raw IP addresses" \
  "document forbids raw IP persistence"
need "$DOC" "BYOK API keys" \
  "document forbids BYOK key persistence"
need "$DOC" "provider URLs" \
  "document forbids provider URL persistence"
need "$DOC" "formal account/session system" \
  "document includes upgrade path beyond five users"

need "$PUBLIC_ACCESS_TS" "PUBLIC_LITE_MAX_ACTIVE_USERS = 5" \
  "public access module defines max active users"
need "$PUBLIC_ACCESS_TS" "PUBLIC_LITE_SESSION_TTL_MINUTES = 30" \
  "public access module defines session TTL"
need "$PUBLIC_ACCESS_TS" "PUBLIC_LITE_SESSION_COOKIE_NAME = 'mmx_public_session'" \
  "public access module defines public session cookie"
need "$PUBLIC_ACCESS_TS" "PUBLIC_LITE_ACTIVE_SESSIONS_FILE = 'storage/access/public-active-sessions.json'" \
  "public access module defines active session store path"
need "$PUBLIC_ACCESS_TS" "signPublicSessionCookiePayload" \
  "public access module signs anonymous session cookie"
need "$PUBLIC_ACCESS_TS" "verifyPublicSessionCookie" \
  "public access module verifies anonymous session cookie"
need "$PUBLIC_ACCESS_TS" "timingSafeEqual" \
  "public access module uses timing-safe signature compare"
need "$PUBLIC_ACCESS_TS" "userAgentHash" \
  "public access module stores userAgentHash only"
need "$PUBLIC_ACCESS_TS" "ipHash" \
  "public access module stores ipHash only"
need "$PUBLIC_ACCESS_TS" "writePublicActiveSessionsStoreAtomic" \
  "public access module uses atomic store writes"
need "$PUBLIC_ACCESS_TS" "capacityFull: true" \
  "public access module can fail closed at capacity"
need "$PUBLIC_ACCESS_TS" "options.enabled !== true" \
  "public access module does not read/write when disabled"

need "$SERVER_TYPES" "publicLiteModeEnabled: boolean" \
  "server config type includes public-lite enabled flag"
need "$SERVER_TYPES" "publicLiteMaxActiveUsers: number" \
  "server config type includes public-lite max active users"
need "$SERVER_TYPES" "publicLiteSessionTtlMinutes: number" \
  "server config type includes public-lite session TTL"
need "$SERVER_INDEX" "PUBLIC_LITE_MODE_ENABLED', false" \
  "server config defaults public-lite off"
need "$SERVER_INDEX" "PUBLIC_LITE_MAX_ACTIVE_USERS" \
  "server config reads max active users env"
need "$SERVER_INDEX" "PUBLIC_LITE_SESSION_TTL_MINUTES" \
  "server config reads session TTL env"
need "$SERVER_INDEX" "PUBLIC_LITE_SESSION_SECRET" \
  "server supports optional server-only public-lite signing secret"
need "$SERVER_INDEX" "url === '/api/public-capacity'" \
  "server exposes public capacity API"
need "$SERVER_INDEX" "function requirePublicLiteCapacityForAction" \
  "server includes public-lite action gate helper"
need "$SERVER_INDEX" "code: 'public_capacity_full'" \
  "server returns stable public capacity full code"
need "$SERVER_INDEX" "requirePublicLiteCapacityForAction(req, res, config, 'generate_byok')" \
  "BYOK generate route uses public-lite capacity gate"
need "$SERVER_INDEX" "requirePublicLiteCapacityForAction(req, res, config, 'save_to_library')" \
  "Save to Library route uses public-lite capacity gate"

need "$SERVER_API" "/api/public-capacity" \
  "frontend API client calls public capacity API"
need "$SERVER_API" "getPublicCapacity" \
  "frontend API client exposes getPublicCapacity helper"
need "$BYOK_PANEL" "getPublicCapacity" \
  "ByokPanel queries public capacity"
need "$BYOK_PANEL" "public_capacity_full" \
  "ByokPanel handles public_capacity_full"
need "$BYOK_PANEL" "当前使用人数已满，请稍后再试" \
  "ByokPanel shows capacity-full message"
need "$BYOK_PANEL" "5 人内轻量公开模式" \
  "ByokPanel shows public-lite five-user message"
need "$BYOK_PANEL" "data-public-lite-mode=\"five-user\"" \
  "ByokPanel marks five-user public-lite mode"

gen_gate_line="$(grep -n "requirePublicLiteCapacityForAction(req, res, config, 'generate_byok')" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
gen_handler_line="$(grep -n "await handleByokGenerate(req, res, config, accessContext)" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
if [[ -n "$gen_gate_line" && -n "$gen_handler_line" && "$gen_gate_line" -lt "$gen_handler_line" ]]; then
  pass "BYOK generate capacity gate runs before generation handler"
else
  fail "BYOK generate capacity gate must run before generation handler"
fi

save_gate_line="$(grep -n "requirePublicLiteCapacityForAction(req, res, config, 'save_to_library')" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
save_handler_line="$(grep -n "await handleByokDirectLiveSaveToLibrary(req, res, config, accessContext)" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
if [[ -n "$save_gate_line" && -n "$save_handler_line" && "$save_gate_line" -lt "$save_handler_line" ]]; then
  pass "Save to Library capacity gate runs before save handler"
else
  fail "Save to Library capacity gate must run before save handler"
fi

if grep -Eq 'localStorage\.setItem|sessionStorage\.setItem|localStorage\.getItem\([^)]*public|sessionStorage\.getItem\([^)]*public' "$BYOK_PANEL" "$SERVER_API"; then
  fail "frontend must not persist public-lite session or provider data to browser storage"
else
  pass "frontend does not persist public-lite data to browser storage"
fi

if grep -Eq '^[^#]*(curl|wget|ssh)[[:space:]]' "$0"; then
  fail "smoke must not execute external network commands"
else
  pass "smoke does not execute external network commands"
fi

if grep -Eq '^[^#]*(npm run dev|node server|tsx .*server|open --apply)' "$0"; then
  fail "smoke must not start server or open BYOK live"
else
  pass "smoke does not start server or open BYOK live"
fi

if [[ -d "$REAL_ACCESS_DIR" ]]; then
  BEFORE_REAL_ACCESS_STATE="$(find "$REAL_ACCESS_DIR" -maxdepth 3 -type f -print | sort)"
else
  BEFORE_REAL_ACCESS_STATE=""
fi
if [[ -d "$REAL_TRACKS_DIR" ]]; then
  BEFORE_REAL_TRACKS_TMP="$(find "$REAL_TRACKS_DIR" -maxdepth 1 -name '*.tmp' -print | sort)"
else
  BEFORE_REAL_TRACKS_TMP=""
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PUBLIC_ACCESS_IMPORT="$(node -e "const { pathToFileURL } = require('node:url'); console.log(pathToFileURL(process.argv[1]).href)" "$PUBLIC_ACCESS_TS")"
STORE_DIR="$TMP_DIR/public-access-store"
TEST_FILE="$TMP_DIR/p3f-public-lite-test.mts"

cat > "$TEST_FILE" <<TS
import * as fs from 'node:fs';
import {
  PUBLIC_LITE_SESSION_COOKIE_NAME,
  readPublicActiveSessionsStore,
  resolvePublicLiteCapacity,
} from '$PUBLIC_ACCESS_IMPORT';

const storeDir = ${STORE_DIR@Q};
const secret = 'fixture-public-lite-secret';
const now = new Date('2026-06-19T00:00:00.000Z');
let pass = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
  pass += 1;
}

function request(cookie?: string, index = 0): any {
  return {
    headers: {
      ...(cookie ? { cookie } : {}),
      'user-agent': 'FixtureUserAgent/' + index,
      'x-forwarded-for': '203.0.113.' + (10 + index),
    },
    socket: { remoteAddress: '203.0.113.' + (10 + index) },
  };
}

function cookieToken(setCookie: string | undefined): string {
  const match = setCookie?.match(new RegExp(PUBLIC_LITE_SESSION_COOKIE_NAME + '=([^;]+)'));
  if (!match) throw new Error('missing set-cookie token');
  return match[1];
}

const disabled = resolvePublicLiteCapacity(request(), {
  enabled: false,
  signingSecret: secret,
  storeDir,
  maxActiveUsers: 5,
  ttlMinutes: 30,
  now,
});
assert(disabled.status.capacityFull === false, 'disabled mode should not be full');
assert(!fs.existsSync(storeDir), 'disabled mode should not create store dir');

const tokens: string[] = [];
for (let i = 0; i < 5; i += 1) {
  const result = resolvePublicLiteCapacity(request(undefined, i), {
    enabled: true,
    signingSecret: secret,
    storeDir,
    maxActiveUsers: 5,
    ttlMinutes: 30,
    now,
  });
  assert(result.status.capacityFull === false, 'first five users should fit capacity');
  assert(result.status.activeUsers === i + 1, 'active user count should increment');
  tokens.push(cookieToken(result.setCookie));
}

const sixth = resolvePublicLiteCapacity(request(undefined, 6), {
  enabled: true,
  signingSecret: secret,
  storeDir,
  maxActiveUsers: 5,
  ttlMinutes: 30,
  now,
});
assert(sixth.status.capacityFull === true, 'sixth new user should be capacity full');
assert(sixth.status.activeUsers === 5, 'sixth user should not create a new active session');
assert(!sixth.setCookie, 'capacity full response should not issue a new cookie');

const existing = resolvePublicLiteCapacity(
  request(PUBLIC_LITE_SESSION_COOKIE_NAME + '=' + tokens[0], 0),
  {
    enabled: true,
    signingSecret: secret,
    storeDir,
    maxActiveUsers: 5,
    ttlMinutes: 30,
    now,
  },
);
assert(existing.status.capacityFull === false, 'existing active user should remain allowed');

const records = readPublicActiveSessionsStore({
  enabled: true,
  signingSecret: secret,
  storeDir,
  maxActiveUsers: 5,
  ttlMinutes: 30,
  now,
});
assert(records.length === 5, 'store should contain exactly five active sessions');

const storeText = fs.readFileSync(storeDir + '/public-active-sessions.json', 'utf8');
assert(!storeText.includes('FixtureUserAgent'), 'store should not contain raw user agent');
assert(!storeText.includes('203.0.113'), 'store should not contain raw IP');
assert(!storeText.includes('sk-'), 'store should not contain BYOK key material');
assert(!storeText.includes('Authorization'), 'store should not contain Authorization');
assert(!storeText.includes('CONFIRM'), 'store should not contain confirmation phrase');
assert(!storeText.includes('provider.example'), 'store should not contain provider URLs');

const later = new Date('2026-06-19T00:31:00.000Z');
const afterExpiry = resolvePublicLiteCapacity(request(undefined, 7), {
  enabled: true,
  signingSecret: secret,
  storeDir,
  maxActiveUsers: 5,
  ttlMinutes: 30,
  now: later,
});
assert(afterExpiry.status.capacityFull === false, 'expired sessions should be pruned');
assert(afterExpiry.status.activeUsers === 1, 'after pruning one new active session should remain');

console.log('fixture passes=' + pass);
TS

if npx --no-install tsx "$TEST_FILE" > "$TMP_DIR/fixture.out" 2>&1; then
  pass "public-lite fixture behavior: PASS"
else
  fail "public-lite fixture behavior: FAIL"
  tail -40 "$TMP_DIR/fixture.out" >&2 || true
fi

rm -rf "$TMP_DIR"
trap - EXIT
if [[ ! -e "$TMP_DIR" ]]; then
  pass "temp fixture dir cleaned"
else
  fail "temp fixture dir should be cleaned"
fi

if [[ -d "$REAL_ACCESS_DIR" ]]; then
  AFTER_REAL_ACCESS_STATE="$(find "$REAL_ACCESS_DIR" -maxdepth 3 -type f -print | sort)"
else
  AFTER_REAL_ACCESS_STATE=""
fi
if [[ "$BEFORE_REAL_ACCESS_STATE" == "$AFTER_REAL_ACCESS_STATE" ]]; then
  pass "smoke did not write real storage/access files"
else
  fail "smoke must not write real storage/access files"
fi

if [[ -d "$REAL_TRACKS_DIR" ]]; then
  AFTER_REAL_TRACKS_TMP="$(find "$REAL_TRACKS_DIR" -maxdepth 1 -name '*.tmp' -print | sort)"
else
  AFTER_REAL_TRACKS_TMP=""
fi
if [[ "$BEFORE_REAL_TRACKS_TMP" == "$AFTER_REAL_TRACKS_TMP" ]]; then
  pass "smoke did not write storage/tracks tmp files"
else
  fail "smoke must not write storage/tracks tmp files"
fi

need "$RELEASE_CHECK" "byok-public-lite-five-active-user-cap-smoke-test.sh" \
  "release:check includes public-lite five-user smoke"

echo "=== Summary ==="
echo "PASS=$PASS"
echo "FAIL=$FAIL"

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi

echo "BYOK public-lite five active user cap smoke: PASS ($PASS passed / 0 failed)"

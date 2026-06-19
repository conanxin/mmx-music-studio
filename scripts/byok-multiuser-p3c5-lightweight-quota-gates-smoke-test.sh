#!/usr/bin/env bash
#
# BYOK-MULTIUSER-P3C5-LIGHTWEIGHT-QUOTA-GATES smoke test.
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
DOC="$REPO_ROOT/docs/launch/BYOK_MULTIUSER_P3C5_LIGHTWEIGHT_QUOTA_GATES_20260619.md"
QUOTA_TS="$REPO_ROOT/server/quota.ts"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
SERVER_TYPES="$REPO_ROOT/server/types.ts"
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

echo "=== BYOK multi-user P3C5 lightweight quota gates smoke ==="

[[ -f "$DOC" ]] || fail "P3C5 document exists"
[[ -f "$QUOTA_TS" ]] || fail "server/quota.ts exists"
[[ -f "$SERVER_INDEX" ]] || fail "server/index.ts exists"
[[ -f "$SERVER_TYPES" ]] || fail "server/types.ts exists"

need "$DOC" "small trusted five-user mode" \
  "document states five-user target"
need "$DOC" "not a broad public launch" \
  "document keeps no broad public launch"
need "$DOC" "quota gate is default off" \
  "document states quota default off"
need "$DOC" '`generate_byok`' \
  "document includes generate_byok action"
need "$DOC" '`save_to_library`' \
  "document includes save_to_library action"
need "$DOC" '`dailyGeneratePerUser`: 10' \
  "document includes dailyGeneratePerUser default"
need "$DOC" '`dailyGeneratePerWorkspace`: 50' \
  "document includes dailyGeneratePerWorkspace default"
need "$DOC" '`dailySavePerUser`: 20' \
  "document includes dailySavePerUser default"
need "$DOC" '`dailySavePerWorkspace`: 100' \
  "document includes dailySavePerWorkspace default"
need "$DOC" "storage/access/quotas/YYYY-MM-DD.json" \
  "document includes quota store path"
need "$DOC" "must not save BYOK API keys" \
  "document forbids BYOK key persistence"
need "$DOC" "Authorization headers" \
  "document forbids Authorization persistence"
need "$DOC" "provider URLs" \
  "document forbids provider URL persistence"
need "$DOC" "POST /api/generate/byok" \
  "document lists BYOK generate route"
need "$DOC" "POST /api/byok/direct-live/save-to-library" \
  "document lists Save to Library route"
need "$DOC" "before provider URL validation" \
  "document says Save quota check precedes provider URL handling"
need "$DOC" "multiuser_quota_exceeded" \
  "document defines quota exceeded error"
need "$DOC" "upgrade before broader access" \
  "document explains upgrade path beyond five users"

need "$QUOTA_TS" "export type QuotaAction = 'generate_byok' | 'save_to_library'" \
  "quota module defines expected actions"
need "$QUOTA_TS" "export interface QuotaUsageRecord" \
  "quota module defines usage record"
need "$QUOTA_TS" "export interface QuotaLimits" \
  "quota module defines quota limits"
need "$QUOTA_TS" "DEFAULT_MULTIUSER_QUOTA_LIMITS" \
  "quota module defines default limits"
need "$QUOTA_TS" "dailyGeneratePerUser: 10" \
  "quota module default dailyGeneratePerUser is 10"
need "$QUOTA_TS" "dailyGeneratePerWorkspace: 50" \
  "quota module default dailyGeneratePerWorkspace is 50"
need "$QUOTA_TS" "dailySavePerUser: 20" \
  "quota module default dailySavePerUser is 20"
need "$QUOTA_TS" "dailySavePerWorkspace: 100" \
  "quota module default dailySavePerWorkspace is 100"
need "$QUOTA_TS" "export function checkMultiuserQuota" \
  "quota module exports checkMultiuserQuota"
need "$QUOTA_TS" "export function recordMultiuserQuotaUsage" \
  "quota module exports recordMultiuserQuotaUsage"
need "$QUOTA_TS" "export function writeQuotaStoreAtomic" \
  "quota module uses atomic write helper"
need "$QUOTA_TS" "options.enabled !== true" \
  "quota module avoids work when disabled"
need "$QUOTA_TS" "code: 'multiuser_quota_exceeded'" \
  "quota module returns stable quota exceeded code"
need "$QUOTA_TS" "ACCESS_STORE_DIR" \
  "quota module stores under access store root"
need "$QUOTA_TS" "QUOTA_STORE_DIR_NAME = 'quotas'" \
  "quota module uses quotas subdirectory"

need "$SERVER_TYPES" "multiuserQuotaEnabled: boolean" \
  "server config type includes quota enabled flag"
need "$SERVER_TYPES" "dailyGeneratePerUser: number" \
  "server config type includes dailyGeneratePerUser"
need "$SERVER_TYPES" "dailyGeneratePerWorkspace: number" \
  "server config type includes dailyGeneratePerWorkspace"
need "$SERVER_TYPES" "dailySavePerUser: number" \
  "server config type includes dailySavePerUser"
need "$SERVER_TYPES" "dailySavePerWorkspace: number" \
  "server config type includes dailySavePerWorkspace"

need "$SERVER_INDEX" "multiuserQuotaEnabled: readBoolEnv('MULTIUSER_QUOTA_ENABLED', false)" \
  "server config defaults quota gate to false"
need "$SERVER_INDEX" "MULTIUSER_DAILY_GENERATE_PER_USER" \
  "server config reads daily generate per user env"
need "$SERVER_INDEX" "MULTIUSER_DAILY_GENERATE_PER_WORKSPACE" \
  "server config reads daily generate per workspace env"
need "$SERVER_INDEX" "MULTIUSER_DAILY_SAVE_PER_USER" \
  "server config reads daily save per user env"
need "$SERVER_INDEX" "MULTIUSER_DAILY_SAVE_PER_WORKSPACE" \
  "server config reads daily save per workspace env"
need "$SERVER_INDEX" "function checkMultiuserQuotaForAction" \
  "server includes quota route helper"
need "$SERVER_INDEX" "function recordMultiuserQuotaUsageForAction" \
  "server includes quota usage record helper"
need "$SERVER_INDEX" "stage: 'multiuser_quota_exceeded'" \
  "server returns stable quota exceeded stage"
need "$SERVER_INDEX" "Daily quota exceeded for this action." \
  "server returns stable quota exceeded message"
need "$SERVER_INDEX" "checkMultiuserQuotaForAction(res, config, accessContext, 'generate_byok')" \
  "BYOK generate route path checks quota"
need "$SERVER_INDEX" "recordMultiuserQuotaUsageForAction(config, accessContext, 'generate_byok')" \
  "BYOK generate success path records quota"
need "$SERVER_INDEX" "checkMultiuserQuotaForAction(res, config, accessContext, 'save_to_library')" \
  "Save to Library route checks quota"
need "$SERVER_INDEX" "recordMultiuserQuotaUsageForAction(config, accessContext, 'save_to_library')" \
  "Save to Library success path records quota"

save_quota_line="$(grep -n "checkMultiuserQuotaForAction(res, config, accessContext, 'save_to_library')" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
download_line="$(grep -n "downloadProviderAudio({" "$SERVER_INDEX" | head -1 | cut -d: -f1)"
if [[ -n "$save_quota_line" && -n "$download_line" && "$save_quota_line" -lt "$download_line" ]]; then
  pass "Save to Library quota check is before provider URL download"
else
  fail "Save to Library quota check must be before provider URL download"
fi

if grep -Eq "req\.headers\[['\"]x-workspace-id['\"]\]|query\.workspaceId|searchParams\.get\(['\"]workspaceId['\"]\)|localStorage\.getItem|sessionStorage\.getItem" "$SERVER_INDEX"; then
  fail "server must not use client-selected workspace as an authorization source"
else
  pass "server does not use header/query/localStorage/sessionStorage workspace selectors"
fi

if grep -Eq '^[^#]*(curl|wget|ssh)[[:space:]]' "$0"; then
  fail "smoke must not execute curl/wget/ssh"
else
  pass "smoke does not execute curl/wget/ssh"
fi

if grep -Eq '^[^#]*(npm run dev|node server|tsx .*server|open --apply)' "$0"; then
  fail "smoke must not start server, open live, or run production paths"
else
  pass "smoke does not start server or open live"
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

QUOTA_IMPORT="$(node -e "const { pathToFileURL } = require('node:url'); console.log(pathToFileURL(process.argv[1]).href)" "$QUOTA_TS")"
STORE_DIR="$TMP_DIR/access-store"
TEST_FILE="$TMP_DIR/p3c5-quota-test.mts"

cat > "$TEST_FILE" <<TS
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_MULTIUSER_QUOTA_LIMITS,
  checkMultiuserQuota,
  recordMultiuserQuotaUsage,
  type QuotaLimits,
} from '$QUOTA_IMPORT';

const storeDir = ${STORE_DIR@Q};
const now = new Date('2026-06-19T00:00:00.000Z');

const accessContext = {
  mode: 'invite_user',
  isAuthenticated: true,
  userId: 'user_1',
  workspaceId: 'workspace_1',
  sessionId: 'session_1',
  inviteId: 'invite_1',
} as const;

const secondUserSameWorkspace = {
  mode: 'invite_user',
  isAuthenticated: true,
  userId: 'user_2',
  workspaceId: 'workspace_1',
  sessionId: 'session_2',
  inviteId: 'invite_2',
} as const;

const limits: QuotaLimits = {
  dailyGeneratePerUser: 1,
  dailyGeneratePerWorkspace: 1,
  dailySavePerUser: 1,
  dailySavePerWorkspace: 2,
};

let pass = 0;
function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
  pass += 1;
}

assert(DEFAULT_MULTIUSER_QUOTA_LIMITS.dailyGeneratePerUser === 10, 'default generate per user should be 10');
assert(DEFAULT_MULTIUSER_QUOTA_LIMITS.dailyGeneratePerWorkspace === 50, 'default generate per workspace should be 50');
assert(DEFAULT_MULTIUSER_QUOTA_LIMITS.dailySavePerUser === 20, 'default save per user should be 20');
assert(DEFAULT_MULTIUSER_QUOTA_LIMITS.dailySavePerWorkspace === 100, 'default save per workspace should be 100');

let result = checkMultiuserQuota(accessContext, 'generate_byok', limits, {
  enabled: false,
  storeDir,
  now,
});
assert(result.allowed === true, 'disabled quota should allow');
recordMultiuserQuotaUsage(accessContext, 'generate_byok', {
  enabled: false,
  storeDir,
  now,
});
assert(!fs.existsSync(path.join(storeDir, 'quotas')), 'disabled quota should not write store');

result = checkMultiuserQuota(accessContext, 'generate_byok', limits, {
  enabled: true,
  storeDir,
  now,
});
assert(result.allowed === true && result.remaining === 1, 'empty enabled quota should allow first generate');
recordMultiuserQuotaUsage(accessContext, 'generate_byok', {
  enabled: true,
  storeDir,
  now,
});
result = checkMultiuserQuota(accessContext, 'generate_byok', limits, {
  enabled: true,
  storeDir,
  now,
});
assert(result.allowed === false, 'user daily generate cap should block second generate');
assert(result.code === 'multiuser_quota_exceeded', 'quota exceeded code should be stable');
assert(result.scope === 'user', 'user cap should report user scope');

result = checkMultiuserQuota(secondUserSameWorkspace, 'generate_byok', {
  ...limits,
  dailyGeneratePerUser: 10,
  dailyGeneratePerWorkspace: 1,
}, {
  enabled: true,
  storeDir,
  now,
});
assert(result.allowed === false && result.scope === 'workspace', 'workspace generate cap should block second workspace user');

result = checkMultiuserQuota(accessContext, 'save_to_library', limits, {
  enabled: true,
  storeDir,
  now,
});
assert(result.allowed === true, 'empty save quota should allow first save');
recordMultiuserQuotaUsage(accessContext, 'save_to_library', {
  enabled: true,
  storeDir,
  now,
});
result = checkMultiuserQuota(accessContext, 'save_to_library', limits, {
  enabled: true,
  storeDir,
  now,
});
assert(result.allowed === false && result.scope === 'user', 'user daily save cap should block second save');

const quotaFile = path.join(storeDir, 'quotas', '2026-06-19.json');
assert(fs.existsSync(quotaFile), 'enabled quota should write temp fixture store');
const storeText = fs.readFileSync(quotaFile, 'utf8');
assert(storeText.includes('generate_byok'), 'store should include generate action counter');
assert(storeText.includes('save_to_library'), 'store should include save action counter');
assert(!storeText.includes('BYOK_SECRET_SENTINEL'), 'store should not contain BYOK key sentinel');
assert(!storeText.includes('Authorization'), 'store should not contain Authorization');
assert(!storeText.includes('confirmation'), 'store should not contain confirmation phrase');
assert(!storeText.includes('provider.example'), 'store should not contain provider URL');

console.log(\`quota fixture assertions passed: \${pass}\`);
TS

npx --no-install tsx "$TEST_FILE"
pass "fixture quota helper test passed"

if [[ -d "$REAL_ACCESS_DIR" ]]; then
  AFTER_REAL_ACCESS_STATE="$(find "$REAL_ACCESS_DIR" -maxdepth 3 -type f -print | sort)"
else
  AFTER_REAL_ACCESS_STATE=""
fi
if [[ "$BEFORE_REAL_ACCESS_STATE" == "$AFTER_REAL_ACCESS_STATE" ]]; then
  pass "smoke did not write real storage/access files"
else
  fail "smoke changed real storage/access files"
fi

if [[ -d "$REAL_TRACKS_DIR" ]]; then
  AFTER_REAL_TRACKS_TMP="$(find "$REAL_TRACKS_DIR" -maxdepth 1 -name '*.tmp' -print | sort)"
else
  AFTER_REAL_TRACKS_TMP=""
fi
if [[ "$BEFORE_REAL_TRACKS_TMP" == "$AFTER_REAL_TRACKS_TMP" ]]; then
  pass "smoke did not write storage/tracks tmp files"
else
  fail "smoke changed storage/tracks tmp files"
fi

need "$RELEASE_CHECK" "byok-multiuser-p3c5-lightweight-quota-gates-smoke-test.sh" \
  "release:check includes this smoke"

echo ""
echo "=== Result ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if (( FAIL == 0 )); then
  echo "BYOK_MULTIUSER_P3C5_LIGHTWEIGHT_QUOTA_GATES_SMOKE_PASS"
  exit 0
fi

echo "BYOK_MULTIUSER_P3C5_LIGHTWEIGHT_QUOTA_GATES_SMOKE_FAIL"
exit 1

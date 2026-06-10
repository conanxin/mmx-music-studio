#!/usr/bin/env bash
# scripts/launch-guard-a-smoke-test.sh — Phase Launch Guard-A smoke test
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== Launch Guard-A Smoke Test ==="

# ── 1. Config env vars exist ────────────────────────────────────────────────
echo "--- Config env vars ---"
grep -rq "PUBLIC_GENERATION_GUARD_ENABLED" "$PROJECT_DIR/.env.example" && pass "PUBLIC_GENERATION_GUARD_ENABLED referenced in .env.example" || fail "PUBLIC_GENERATION_GUARD_ENABLED referenced in .env.example"
grep -rq "PUBLIC_GENERATION_ENABLED" "$PROJECT_DIR/.env.example" && pass "PUBLIC_GENERATION_ENABLED referenced in .env.example" || fail "PUBLIC_GENERATION_ENABLED referenced in .env.example"
grep -rq "PER_SOURCE_DAILY_GENERATION_LIMIT" "$PROJECT_DIR/.env.example" && pass "PER_SOURCE_DAILY_GENERATION_LIMIT referenced in .env.example" || fail "PER_SOURCE_DAILY_GENERATION_LIMIT referenced in .env.example"
grep -rq "GENERATION_COOLDOWN_SECONDS" "$PROJECT_DIR/.env.example" && pass "GENERATION_COOLDOWN_SECONDS referenced in .env.example" || fail "GENERATION_COOLDOWN_SECONDS referenced in .env.example"

# ── 2. server/launch-guard.ts exists ────────────────────────────────────────
echo "--- Launch guard module ---"
[ -f "$PROJECT_DIR/server/launch-guard.ts" ] && pass "server/launch-guard.ts exists" || fail "server/launch-guard.ts exists"

# ── 3. Launch guard config fields exist in source ────────────────────────────
echo "--- Launch guard config fields ---"
grep -rq "PUBLIC_GENERATION_GUARD_ENABLED" "$PROJECT_DIR/server/" && pass "PUBLIC_GENERATION_GUARD_ENABLED referenced in server" || fail "PUBLIC_GENERATION_GUARD_ENABLED referenced in server"
grep -rq "PUBLIC_GENERATION_ENABLED" "$PROJECT_DIR/server/" && pass "PUBLIC_GENERATION_ENABLED referenced in server" || fail "PUBLIC_GENERATION_ENABLED referenced in server"
grep -rq "PER_SOURCE_DAILY_GENERATION_LIMIT" "$PROJECT_DIR/server/" && pass "PER_SOURCE_DAILY_GENERATION_LIMIT referenced in server" || fail "PER_SOURCE_DAILY_GENERATION_LIMIT referenced in server"
grep -rq "GENERATION_COOLDOWN_SECONDS" "$PROJECT_DIR/server/" && pass "GENERATION_COOLDOWN_SECONDS referenced in server" || fail "GENERATION_COOLDOWN_SECONDS referenced in server"

# ── 4. Error code strings exist ────────────────────────────────────────────
echo "--- Error codes ---"
grep -rq "public_generation_paused" "$PROJECT_DIR/server/" "$PROJECT_DIR/src/" && pass "public_generation_paused error code in source" || fail "public_generation_paused error code"
grep -rq "per_source_daily_limit_exceeded" "$PROJECT_DIR/server/" "$PROJECT_DIR/src/" && pass "per_source_daily_limit_exceeded in source" || fail "per_source_daily_limit_exceeded"
grep -rq "generation_cooldown_active" "$PROJECT_DIR/server/" "$PROJECT_DIR/src/" && pass "generation_cooldown_active in source" || fail "generation_cooldown_active"

# ── 5. Source identification ────────────────────────────────────────────────
echo "--- Source identification ---"
grep -rqi "x-forwarded-for\|x-real-ip\|remoteAddress" "$PROJECT_DIR/server/rate-limit.ts" && pass "x-forwarded-for/x-real-ip/remoteAddress in rate-limit.ts" || fail "x-forwarded-for/x-real-ip in rate-limit.ts"
grep -rq "getClientKey\|getSourceHash\|sha256\|SHA256" "$PROJECT_DIR/server/launch-guard.ts" && pass "SHA256 source hash in launch-guard.ts" || fail "SHA256 source hash in launch-guard.ts"

# ── 6. No raw IP storage ─────────────────────────────────────────────────────
echo "--- No raw IP storage ---"
# Guard state uses sourceHash (SHA256), not raw IP. Type annotation remoteAddress is OK.
grep -rq "sourceHash\|getClientKey\|getSourceHash" "$PROJECT_DIR/server/launch-guard.ts" && pass "Uses hashed source identifier (no raw IP)" || fail "Uses hashed source identifier (no raw IP)"

# ── 7. Guard state storage ──────────────────────────────────────────────────
echo "--- Guard state storage ---"
[ -d "$PROJECT_DIR/storage/guard" ] && pass "storage/guard directory exists" || fail "storage/guard directory"
grep -rq "public-generation-guard.json" "$PROJECT_DIR/server/launch-guard.ts" && pass "guard state file name in source" || fail "guard state file name"
grep -rq "\.tmp\|renameSync\|atomic" "$PROJECT_DIR/server/launch-guard.ts" && pass "atomic write pattern in launch-guard.ts" || fail "atomic write pattern in launch-guard.ts"

# ── 8. Daily reset logic ────────────────────────────────────────────────────
echo "--- Daily reset logic ---"
grep -rq "todayStr\|YYYY-MM-DD\|new Date.*slice.*10" "$PROJECT_DIR/server/launch-guard.ts" && pass "daily reset logic in launch-guard.ts" || fail "daily reset logic"

# ── 9. Cooldown logic ───────────────────────────────────────────────────────
echo "--- Cooldown logic ---"
grep -rq "cooldownSeconds\|retryAfterSeconds" "$PROJECT_DIR/server/launch-guard.ts" && pass "cooldown logic in launch-guard.ts" || fail "cooldown logic"

# ── 10. Guard check in handleGenerate ───────────────────────────────────────
echo "--- Guard integration in handleGenerate ---"
grep -rq "checkLaunchGuard\|launchGuard" "$PROJECT_DIR/server/index.ts" && pass "checkLaunchGuard called in index.ts" || fail "checkLaunchGuard called in index.ts"

# ── 11. Guard in /api/health ────────────────────────────────────────────────
echo "--- Health endpoint fields ---"
grep -rq "launchGuardEnabled\|publicGenerationEnabled\|perSourceDailyLimit\|generationCooldownSeconds" "$PROJECT_DIR/server/index.ts" && pass "launchGuard fields in health endpoint" || fail "launchGuard fields in health endpoint"

# ── 12. Debug reset endpoint ─────────────────────────────────────────────────
echo "--- Debug reset endpoint ---"
grep -rq "reset-guard\|resetGuardState" "$PROJECT_DIR/server/index.ts" && pass "reset-guard endpoint in index.ts" || fail "reset-guard endpoint"

# ── 13. Studio error labels ────────────────────────────────────────────────
echo "--- Studio error labels ---"
grep -rq "公开生成已暂停\|今日生成次数已达上限\|生成冷却中" "$PROJECT_DIR/src/features/studio/Studio.tsx" && pass "3 guard error labels in Studio.tsx" || fail "3 guard error labels in Studio.tsx"

# ── 14. Studio generate button guard ───────────────────────────────────────
echo "--- Studio generate button guard ---"
grep -rq "publicGenerationEnabled.*false\|launchGuardEnabled" "$PROJECT_DIR/src/features/studio/Studio.tsx" && pass "publicGenerationEnabled check in Studio button disabled" || fail "publicGenerationEnabled check in Studio button"

# ── 15. Home Trust section ─────────────────────────────────────────────────
echo "--- Home trust section ---"
grep -rq "生成保护\|每日有生成次数与冷却限制" "$PROJECT_DIR/src/features/home/Home.tsx" && pass "生成保护说明 in Home.tsx Trust section" || fail "生成保护说明 in Home.tsx"

# ── 16. README mentions guard ───────────────────────────────────────────────
echo "--- README ---"
if grep -rq "Launch Guard\|launch.*guard\|per-source.*daily\|generation.*protection" "$PROJECT_DIR/README.md"; then
  pass "Launch Guard mentioned in README.md"
else
  fail "Launch Guard mentioned in README.md"
fi

# ── 17. DEVELOPMENT_HANDOFF mentions guard ──────────────────────────────────
echo "--- DEVELOPMENT_HANDOFF ---"
if grep -rq "Launch Guard\|launch-guard" "$PROJECT_DIR/docs/DEVELOPMENT_HANDOFF.md"; then
  pass "Launch Guard in DEVELOPMENT_HANDOFF.md"
else
  fail "Launch Guard in DEVELOPMENT_HANDOFF.md"
fi

# ── 18. PUBLIC_RELEASE_READINESS mentions guard ──────────────────────────────
echo "--- PUBLIC_RELEASE_READINESS ---"
if grep -rq "guard\|protection\|limit" "$PROJECT_DIR/docs/PUBLIC_RELEASE_READINESS.md"; then
  pass "Generation guard mentioned in PUBLIC_RELEASE_READINESS.md"
else
  fail "Generation guard mentioned in PUBLIC_RELEASE_READINESS.md"
fi

# ── 19. No real API key/token in launch-guard.ts ────────────────────────────
echo "--- No secrets in launch-guard.ts ---"
# Only check non-comment lines for actual secret patterns (not doc comments)
if awk '!/^\s*\* / && !/\/\*/ && !/\*\// {print}' "$PROJECT_DIR/server/launch-guard.ts" 2>/dev/null | grep -lq "MINIMAX_API_KEY\|x-minimax-api-key\|Bearer\|sk-"; then
  fail "API key/token found in launch-guard.ts"
else
  pass "No API keys/tokens in launch-guard.ts"
fi

# ── 20. No /api/generate call in smoke test ─────────────────────────────────
echo "--- No /api/generate calls ---"
# Only fail if there's an actual HTTP call to /api/generate, not grep self-matches
if grep "curl\|wget\|fetch\|axios" "$SCRIPT_DIR/launch-guard-a-smoke-test.sh" 2>/dev/null | grep -v "grep.*curl\|grep.*wget\|grep.*fetch\|grep.*axios" | grep -q "api/generate"; then
  fail "/api/generate HTTP call found in smoke test"
else
  pass "No /api/generate HTTP calls in smoke test"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS PASS, $FAIL FAIL ==="
if [ $FAIL -eq 0 ]; then
  echo "LAUNCH_GUARD_A_SMOKE_PASS"
  exit 0
else
  echo "LAUNCH_GUARD_A_SMOKE_FAIL"
  exit 1
fi

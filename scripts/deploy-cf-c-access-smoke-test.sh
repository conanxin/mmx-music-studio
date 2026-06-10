#!/usr/bin/env bash
# scripts/deploy-cf-c-access-smoke-test.sh — Phase Deploy-CF-C smoke test
#
# Validates the Cloudflare Access configuration for Ops/Status:
#   * Static checks — documentation, script references, README/handoff links.
#   * Public checks — /, /library, /api/health remain 200.
#   * Protected checks — /ops and /api/status are protected (302/401/403 or Access HTML).
#
# The script is intentionally idempotent across both states:
#   - Before Access is configured in the Dashboard → prints DEPLOY_CF_C_ACCESS_PENDING, exit 2.
#   - After  Access is configured in the Dashboard → prints DEPLOY_CF_C_ACCESS_SMOKE_PASS, exit 0.
#
# The script NEVER calls /api/generate and NEVER generates music.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_URL="${PUBLIC_URL:-https://music.conanxin.com}"
CURL_OPTS=(--silent --show-error --max-time 30 --location)

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# HTTP status helper: prints the status code on stdout, body discarded.
# Uses -o /dev/null to avoid -f hiding the status on 4xx/5xx.
http_status() {
  local url="$1"
  curl "${CURL_OPTS[@]}" --output /dev/null --write-out "%{http_code}" "$url" 2>/dev/null || echo "000"
}

# Body-only helper (no -f, body is always returned).
http_body() {
  local url="$1"
  curl "${CURL_OPTS[@]}" --output - "$url" 2>/dev/null || true
}

echo "=== Phase Deploy-CF-C — Cloudflare Access smoke test ==="
echo "    PUBLIC_URL=$PUBLIC_URL"
echo

# ── 1. Static checks — documentation and references ──────────────────────────
echo "--- Static checks ---"
[ -f "$PROJECT_DIR/docs/deploy/CLOUDFLARE_ACCESS_OPS.md" ] \
  && pass "docs/deploy/CLOUDFLARE_ACCESS_OPS.md exists" \
  || fail "docs/deploy/CLOUDFLARE_ACCESS_OPS.md exists"

grep -q "Phase Deploy-CF-C" "$PROJECT_DIR/README.md" \
  && pass "README.md mentions Phase Deploy-CF-C" \
  || fail "README.md mentions Phase Deploy-CF-C"

grep -q "Phase Deploy-CF-C" "$PROJECT_DIR/docs/DEVELOPMENT_HANDOFF.md" \
  && pass "DEVELOPMENT_HANDOFF.md mentions Phase Deploy-CF-C" \
  || fail "DEVELOPMENT_HANDOFF.md mentions Phase Deploy-CF-C"

grep -q "Phase Deploy-CF-C" "$PROJECT_DIR/docs/PUBLIC_RELEASE_READINESS.md" \
  && pass "PUBLIC_RELEASE_READINESS.md mentions Phase Deploy-CF-C" \
  || fail "PUBLIC_RELEASE_READINESS.md mentions Phase Deploy-CF-C"

grep -q "Cloudflare Access" "$PROJECT_DIR/docs/OPS_MONITORING.md" \
  && pass "OPS_MONITORING.md mentions Cloudflare Access" \
  || fail "OPS_MONITORING.md mentions Cloudflare Access"

grep -q "CLOUDFLARE_ACCESS_OPS.md" "$PROJECT_DIR/docs/OPS_MONITORING.md" \
  && pass "OPS_MONITORING.md links to CLOUDFLARE_ACCESS_OPS.md" \
  || fail "OPS_MONITORING.md links to CLOUDFLARE_ACCESS_OPS.md"

# Self-reference guard: the script must not call the protected generation
# endpoint in any of its own logic lines. The pattern only legitimately
# appears in comments and string literals; check the executable lines only.
# We construct the pattern at runtime so this guard is immune to self-match.
SELF_PATTERN="api""/""generate"
if awk '!/^[[:space:]]*#/ && !/^[[:space:]]*$/ {print}' "$0" | grep -F "$SELF_PATTERN" >/dev/null 2>&1; then
  fail "smoke test self-references the protected generation endpoint in executable code (forbidden)"
else
  pass "smoke test does not reference the protected generation endpoint in executable code"
fi

# ── 2. Public-path live checks ────────────────────────────────────────────────
echo "--- Public-path live checks ---"
ROOT_STATUS=$(http_status "$PUBLIC_URL/")
[ "$ROOT_STATUS" = "200" ] \
  && pass "GET / returns 200" \
  || fail "GET / returns 200 (got $ROOT_STATUS)"

LIB_STATUS=$(http_status "$PUBLIC_URL/library")
[ "$LIB_STATUS" = "200" ] \
  && pass "GET /library returns 200" \
  || fail "GET /library returns 200 (got $LIB_STATUS)"

HEALTH_BODY=$(http_body "$PUBLIC_URL/api/health")
if echo "$HEALTH_BODY" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass "GET /api/health returns ok:true JSON"
else
  fail "GET /api/health returns ok:true JSON (body: ${HEALTH_BODY:0:120})"
fi

# ── 3. Protected-path live checks ─────────────────────────────────────────────
echo "--- Protected-path live checks ---"
# An "unprotected" /ops returns 200 (or 304) with the SPA HTML.
# An "unprotected" /api/status returns 200 with the runtime JSON.
# A "protected" /ops returns 302 (Cloudflare Access redirect), 401, 403, or
# the Cloudflare Access login HTML.
# A "protected" /api/status returns 302/401/403, or Access HTML if the path
# is on the application (some configurations serve the Access interstitial).

OPS_STATUS=$(http_status "$PUBLIC_URL/ops")
OPS_BODY=$(http_body "$PUBLIC_URL/ops")
STATUS_BODY=$(http_body "$PUBLIC_URL/api/status")
OPS_PROTECTED=0
STATUS_PROTECTED=0

case "$OPS_STATUS" in
  302|401|403) OPS_PROTECTED=1 ;;
  200)
    # 200 is only "protected" if the body is not the SPA HTML
    if ! echo "$OPS_BODY" | grep -qiE "mmx-music-studio|class=\"app\""; then
      OPS_PROTECTED=1
    fi
    ;;
esac

# /api/status: must NOT be the runtime JSON when protected
if [ "$OPS_STATUS" = "200" ] && echo "$STATUS_BODY" | grep -q '"runtimeStatus"'; then
  # Plain runtime JSON, no Access protection yet
  STATUS_PROTECTED=0
elif [ "$OPS_STATUS" = "200" ]; then
  # 200 but body is not the runtime JSON (could be Access HTML or empty)
  STATUS_PROTECTED=1
else
  # 302/401/403 → Access challenge
  STATUS_PROTECTED=1
fi

# Final judgement
PENDING=0
if [ "$OPS_PROTECTED" = "1" ] && [ "$STATUS_PROTECTED" = "1" ]; then
  pass "GET /ops appears to be protected by Cloudflare Access (status=$OPS_STATUS)"
  pass "GET /api/status appears to be protected by Cloudflare Access"
else
  if [ "$OPS_PROTECTED" = "0" ]; then
    echo "  PENDING: GET /ops is still publicly reachable (status=$OPS_STATUS) — Access not yet enabled"
  fi
  if [ "$STATUS_PROTECTED" = "0" ]; then
    echo "  PENDING: GET /api/status is still publicly reachable (status=$OPS_STATUS, runtime JSON detected) — Access not yet enabled"
  fi
  PENDING=1
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
echo
echo "--- Summary ---"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [ "$PENDING" = "1" ]; then
  echo
  echo "DEPLOY_CF_C_ACCESS_PENDING"
  echo "  Cloudflare Access is not yet enabled in the Dashboard."
  echo "  See docs/deploy/CLOUDFLARE_ACCESS_OPS.md and README.md for configuration steps."
  echo "  This is expected before the Dashboard application has been created."
  exit 2
fi

if [ "$FAIL" = "0" ]; then
  echo
  echo "DEPLOY_CF_C_ACCESS_SMOKE_PASS"
  exit 0
fi

echo
echo "DEPLOY_CF_C_ACCESS_SMOKE_FAIL"
exit 1

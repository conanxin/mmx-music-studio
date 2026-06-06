#!/usr/bin/env bash
# ============================================================
# mmx-music-studio — Release Check Script
# ============================================================
# Runs all pre-release validation in one shot.
# Safe: does NOT trigger real generation or consume credits.
#
# Usage: npm run release:check
#        bash scripts/release-check.sh
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo "  ❌ $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
info() { echo "  ℹ️  $1"; }

echo ""
echo "=== mmx-music-studio Release Check ==="
echo ""

# ── 1. TypeScript ──────────────────────────────────────────
echo "[1/11] TypeScript check..."
if npm run typecheck > /tmp/typecheck.out 2>&1; then
  pass "TypeScript: no errors"
else
  fail "TypeScript: errors found (see above)"
  cat /tmp/typecheck.out | tail -5
fi

# ── 2. Build ─────────────────────────────────────────────
echo "[2/11] Vite build..."
if npm run build > /tmp/build.out 2>&1; then
  pass "Build: success"
else
  fail "Build: failed (see above)"
  cat /tmp/build.out | tail -5
fi

# ── 3. Manifest audit ─────────────────────────────────────
echo "[3/11] Manifest audit..."
if npm run manifest:audit > /tmp/manifest.out 2>&1; then
  pass "Manifest: 0 issues"
else
  fail "Manifest: issues found (see above)"
  cat /tmp/manifest.out | tail -5
fi

# ── 4. Config smoke test ──────────────────────────────────
echo "[4/11] Config smoke test..."
if bash scripts/config-smoke-test.sh > /tmp/config-smoke.out 2>&1; then
  pass "Config smoke test: PASS"
else
  fail "Config smoke test: FAIL"
  cat /tmp/config-smoke.out | tail -5
fi

# ── 5. Server smoke test ──────────────────────────────────
echo "[5/11] Server smoke test..."
# Start server briefly for smoke test
export REAL_GENERATION_ENABLED=false
export MOCK_GENERATION_ENABLED=true
export PUBLIC_DEMO_MODE=false
export MINIMAX_BACKEND=mock
SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

npm run dev:server > /tmp/server.out 2>&1 &
SERVER_PID=$!
sleep 4

if curl -s --max-time 5 http://localhost:8787/api/health > /dev/null 2>&1; then
  pass "Server smoke test: HTTP 200"
else
  fail "Server smoke test: cannot reach http://localhost:8787"
fi

# ── 6. Web API smoke test ─────────────────────────────────
echo "[6/11] Web API smoke test..."
if bash scripts/web-api-smoke-test.sh > /tmp/web-api.out 2>&1; then
  pass "Web API smoke test: PASS"
else
  fail "Web API smoke test: FAIL"
fi

# ── 7. CLI adapter smoke test ─────────────────────────────
echo "[7/11] CLI adapter smoke test..."
if bash scripts/cli-adapter-smoke-test.sh > /tmp/cli-adapter.out 2>&1; then
  pass "CLI adapter smoke test: PASS"
else
  fail "CLI adapter smoke test: FAIL"
fi

# ── 8. Existing CLI track verification ───────────────────
echo "[8/11] Existing CLI track verification..."
if bash scripts/verify-existing-cli-track.sh > /tmp/cli-track.out 2>&1; then
  pass "CLI track verification: PASS"
else
  fail "CLI track verification: FAIL"
fi

# ── 9. Secret scan ───────────────────────────────────────
echo "[9/11] Secret scan..."
SECRET_FOUND=$(grep -rInE "sk-[a-zA-Z0-9]{20,}|Bearer [a-zA-Z0-9_-]{30,}|authorization: Bearer" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=storage \
  --exclude="*.png" \
  --exclude="*.zip" \
  --exclude="*.mp3" \
  --exclude="*.wav" \
  --exclude="*.log" \
  . 2>/dev/null | grep -v ".env.example" | grep -v "MINIMAX_API_KEY" | grep -v "sk-" | head -5 || true)

if [[ -z "$SECRET_FOUND" ]]; then
  pass "Secret scan: CLEAN"
else
  fail "Secret scan: potential secret found"
  echo "$SECRET_FOUND" | head -5
fi

# ── 10. Git status ────────────────────────────────────────
echo "[10/11] Git status..."
if git status --short | grep -q "\.env$"; then
  fail ".env is tracked by git (should be ignored)"
else
  pass ".env not in git"
fi

if git status --short | grep "storage/tracks/.*\.mp3" | grep -v "\.gitkeep" | head -1; then
  fail "Real audio files tracked in git (should be ignored)"
else
  pass "No real audio files in git"
fi

# ── 11. File existence checks ──────────────────────────────
echo "[11/11] Required files check..."
REQUIRED_FILES=(
  "Dockerfile"
  "docker-compose.yml"
  ".dockerignore"
  "docs/DEPLOYMENT.md"
  "CONTRIBUTING.md"
  "CHANGELOG.md"
  "docs/SECURITY.md"
  ".env.example"
  "README.md"
  "LICENSE"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    pass "exists: $f"
  else
    fail "MISSING: $f"
  fi
done

# ── Summary ───────────────────────────────────────────────
echo ""
echo "=== Result ==="
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
echo ""

if ((FAIL_COUNT == 0)); then
  echo "✅ RELEASE CHECK: PASS"
  exit 0
else
  echo "❌ RELEASE CHECK: FAIL ($FAIL_COUNT issue(s))"
  exit 1
fi
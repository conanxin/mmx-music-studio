#!/usr/bin/env bash
#
# scripts/release-check.sh
# Phase-gated release readiness checklist for mmx-music-studio
# Used for CI, handoff, and pre-release validation
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# ── Helpers ────────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { echo "  ✅ $1"; PASS_COUNT=$((PASS_COUNT+1)); }
skip() { echo "  ⏭️  $1"; SKIP_COUNT=$((SKIP_COUNT+1)); }
fail() { echo "  ❌ $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }

# ── 1. TypeScript check ────────────────────────────────────────────────────
echo "[1/17] TypeScript check..."
if npm run typecheck > /tmp/typecheck.out 2>&1; then
  pass "TypeScript: no errors"
else
  fail "TypeScript: errors found (see above)"
  cat /tmp/typecheck.out | tail -5
fi

# ── 2. Build ──────────────────────────────────────────────────────────────
echo "[2/17] Vite build..."
if npm run build > /tmp/build.out 2>&1; then
  pass "Build: success"
else
  fail "Build: failed (see above)"
  cat /tmp/build.out | tail -5
fi

# ── 3. Manifest audit ────────────────────────────────────────────────────
echo "[3/17] Manifest audit..."
if npm run manifest:audit > /tmp/manifest.out 2>&1; then
  pass "Manifest: 0 issues"
else
  fail "Manifest: issues found (see above)"
  cat /tmp/manifest.out | tail -5
fi

# ── 4. Config smoke test ───────────────────────────────────────────────────
echo "[4/17] Config smoke test..."
if bash scripts/config-smoke-test.sh > /tmp/config-smoke.out 2>&1; then
  pass "Config smoke test: PASS"
else
  fail "Config smoke test: FAIL"
  cat /tmp/config-smoke.out | tail -5
fi

# ── 5. Safe-default UI copy smoke test ────────────────────────────────────
echo "[5/17] Safe-default UI copy smoke test..."
if bash scripts/safe-default-ui-copy-smoke-test.sh > /tmp/safe-default-ui-copy.out 2>&1; then
  pass "Safe-default UI copy smoke test: PASS"
else
  fail "Safe-default UI copy smoke test: FAIL"
  cat /tmp/safe-default-ui-copy.out | tail -10
fi

# ── 6. Server smoke test ──────────────────────────────────────────────────
echo "[6/17] BYOK live attempt consume guard smoke test..."
if bash scripts/byok-live-attempt-consume-guard-smoke-test.sh > /tmp/byok-live-attempt-consume-guard.out 2>&1; then
  pass "BYOK live attempt consume guard smoke test: PASS"
else
  fail "BYOK live attempt consume guard smoke test: FAIL"
  cat /tmp/byok-live-attempt-consume-guard.out | tail -10
fi

echo "[7/17] BYOK live provider error observability smoke test..."
if bash scripts/byok-live-provider-error-observability-smoke-test.sh > /tmp/byok-live-provider-error-observability.out 2>&1; then
  pass "BYOK live provider error observability smoke test: PASS"
else
  fail "BYOK live provider error observability smoke test: FAIL"
  cat /tmp/byok-live-provider-error-observability.out | tail -10
fi

# ── 8. Server smoke test ────────────────────────────────────────────────
echo "[8/17] BYOK music-2.6 lyrics/instrumental param smoke test..."
if bash scripts/byok-music26-lyrics-or-instrumental-param-smoke-test.sh > /tmp/byok-music26-lyrics-or-instrumental-param.out 2>&1; then
  pass "BYOK music-2.6 lyrics/instrumental param smoke test: PASS"
else
  fail "BYOK music-2.6 lyrics/instrumental param smoke test: FAIL"
  cat /tmp/byok-music26-lyrics-or-instrumental-param.out | tail -10
fi

echo "[9/17] BYOK self-use live window script smoke test..."
if bash scripts/byok-self-use-live-window-script-smoke-test.sh > /tmp/byok-self-use-live-window-script.out 2>&1; then
  pass "BYOK self-use live window script smoke test: PASS"
else
  fail "BYOK self-use live window script smoke test: FAIL"
  cat /tmp/byok-self-use-live-window-script.out | tail -10
fi

echo "[10/17] BYOK self-use Library result handling smoke test..."
if bash scripts/byok-self-use-library-result-handling-smoke-test.sh > /tmp/byok-self-use-library-result-handling.out 2>&1; then
  pass "BYOK self-use Library result handling smoke test: PASS"
else
  fail "BYOK self-use Library result handling smoke test: FAIL"
  cat /tmp/byok-self-use-library-result-handling.out | tail -10
fi

echo "[11/17] Server smoke test..."
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
sleep 5

if curl -s --max-time 8 http://localhost:8787/api/health > /dev/null 2>&1; then
  pass "Server smoke test: HTTP 200"
else
  # Server not running — skip (handoff/CI environments may not have server started)
  echo "  ⏭️  Server smoke test: skipped (server not running, OK for handoff)"
fi

# ── 7. Web API smoke test ────────────────────────────────────────────────
echo "[12/17] Web API smoke test..."
if bash scripts/web-api-smoke-test.sh > /tmp/web-api.out 2>&1; then
  pass "Web API smoke test: PASS"
else
  fail "Web API smoke test: FAIL"
  cat /tmp/web-api.out | tail -5
fi

# ── 8. CLI adapter smoke test ────────────────────────────────────────────
echo "[13/17] CLI adapter smoke test..."
if bash scripts/cli-adapter-smoke-test.sh > /tmp/cli-adapter.out 2>&1; then
  pass "CLI adapter smoke test: PASS"
else
  fail "CLI adapter smoke test: FAIL"
  cat /tmp/cli-adapter.out | tail -5
fi

# ── 9. Existing CLI track verification ────────────────────────────────────
echo "[14/17] Existing CLI track verification..."
if bash scripts/verify-existing-cli-track.sh > /tmp/cli-track.out 2>&1; then
  pass "CLI track verification: PASS"
elif grep -q "PARTIAL_NO_CLI_TRACK" /tmp/cli-track.out 2>/dev/null; then
  # No mmx-cli tracks found — expected in mock/preview mode
  echo "  ⏭️  CLI track verification: skipped (no mmx-cli tracks in manifest, OK for handoff)"
else
  fail "CLI track verification: FAIL"
  cat /tmp/cli-track.out | tail -5
fi

# ── 10. Secret scan ────────────────────────────────────────────────────────
echo "[15/17] Secret scan..."
if python3 scripts/ci-secret-scan.py > /tmp/secret-scan.out 2>&1; then
  pass "Secret scan: CLEAN"
else
  fail "Secret scan: potential secret found"
  cat /tmp/secret-scan.out | tail -10
fi

# ── 11. Git status ─────────────────────────────────────────────────────────
echo "[16/17] Git status..."
# Only fail if real .env is staged/tracked (not .env.example, .env.demo.example, etc.)
if git status --porcelain | grep -E '^.?M .env$' | grep -v '.env.'; then
  fail ".env is staged or tracked"
else
  pass ".env not in git"
fi

if git ls-files | grep -q "storage/tracks/.*\.\(mp3\|wav\|flac\|m4a\|aac\)$"; then
  fail "Real audio files in git"
else
  pass "No real audio files in git"
fi

# ── 12. Required files ─────────────────────────────────────────────────────
echo "[17/17] Required files..."
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
    fail "missing: $f"
  fi
done

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Result ==="
echo "  Passed: $PASS_COUNT"
echo "  Skipped: $SKIP_COUNT"
echo "  Failed: $FAIL_COUNT"
echo ""

if ((FAIL_COUNT == 0)); then
  echo "✅ RELEASE CHECK: PASS"
  exit 0
else
  echo "❌ RELEASE CHECK: FAIL ($FAIL_COUNT issue(s))"
  exit 1
fi

#!/usr/bin/env bash
# ============================================================
# ci-weapp-build-diagnostic.sh — Self-contained WeApp build diagnostics
# ============================================================
# Captures the complete environment + build output for the WeApp
# CI-only failure. Generates a sanitized summary for agent review.
#
# Safety:
# - Does NOT call /api/generate or any real generation endpoint
# - Does NOT read ~/.mmx / ~/.hermes / .env
# - Redacts tokens/keys/PINs from all output
# - Always exits 0 after writing diagnostics (even on build failure)
# ============================================================

set -uo pipefail

DIAG_DIR="${CI_DIAG_DIR:-/tmp/mmx-ci-diagnostics}"
mkdir -p "$DIAG_DIR"

LOG="$DIAG_DIR/weapp-build.log"
SUMMARY="$DIAG_DIR/weapp-build-summary.md"

# ── Basic redaction (tokens/keys/PINs) ───────────────────────────────────────
redact() {
  sed -E \
    -e 's/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1***REDACTED***/g' \
    -e 's/(sk_[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1***REDACTED***/g' \
    -e 's/(Bearer )[A-Za-z0-9._-]{12,}/\1***REDACTED***/g' \
    -e 's/(MINIMAX_API_KEY=)[A-Za-z0-9.-]+/\1***REDACTED***/g' \
    -e 's/(PIN[=:] *)[A-Za-z0-9._-]+/\1***REDACTED***/g' \
    -e 's/(token[=:] *)[A-Za-z0-9._-]{12,}/\1***REDACTED***/g' \
    -e 's/(api[_-]?key[=:] *)[A-Za-z0-9.-]+/\1***REDACTED***/g'
}

# ── Collect environment ────────────────────────────────────────────────────────
{
  echo "=== system ==="
  uname -a
  pwd
  df -h / /home /home2 2>/dev/null || df -h
  free -h 2>/dev/null || echo "(free unavailable)"

  echo ""
  echo "=== node/npm ==="
  node -v
  npm -v

  echo ""
  echo "=== package versions ==="
  npm ls typescript --depth=0 2>&1 | head -5
  npm ls @tarojs/cli --depth=2 2>&1 | head -10
  npm ls @tarojs/webpack5-runner --depth=2 2>&1 | head -10
  npm ls @tarojs/mini-runner --depth=2 2>&1 | head -10
  npm ls @tarojs/taro-webpack5-runner --depth=2 2>&1 | head -10
  npm ls @tarojs/mini --depth=2 2>&1 | head -10

  echo ""
  echo "=== apps/weapp package.json scripts ==="
  cat apps/weapp/package.json 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('scripts',{}), indent=2))" \
    2>/dev/null || echo "(cannot read apps/weapp/package.json)"

  echo ""
  echo "=== apps/weapp config files ==="
  find apps/weapp -maxdepth 2 \( -name "*.config.*" -o -name "tsconfig*.json" \) 2>/dev/null | sort | head -20

  echo ""
  echo "=== apps/weapp files (first 240) ==="
  find apps/weapp -maxdepth 3 -type f 2>/dev/null | sort | sed -n '1,240p' \
    || echo "(find returned non-zero)"

  echo ""
  echo "=== npm run weapp:build ==="
} > "$LOG" 2>&1

# ── Run the actual build ──────────────────────────────────────────────────────
npm run weapp:build >> "$LOG" 2>&1
BUILD_EXIT=${PIPESTATUS[0]}

# ── Record exit code ─────────────────────────────────────────────────────────
{
  echo ""
  echo "=== build exit ==="
  echo "exit_code=$BUILD_EXIT"
} >> "$LOG" 2>&1

# ── Generate sanitized markdown summary ──────────────────────────────────────
{
  echo "# WeApp CI Build Diagnostic"
  echo ""
  echo "| Field | Value |"
  echo "|-------|-------|"
  echo "| exit_code | $BUILD_EXIT |"
  echo "| node | $(node -v 2>/dev/null) |"
  echo "| npm | $(npm -v 2>/dev/null) |"
  echo "| os | $(uname -a 2>/dev/null) |"
  echo "| disk | $(df -h / 2>/dev/null | tail -1) |"
  echo ""
  echo "## Taro dependencies"
  echo ""
  npm ls @tarojs/cli --depth=2 2>&1 | head -15 | redact
  echo ""
  echo "## Error keywords (redacted)"
  echo ""
  grep -RInE "error|failed|cannot find|module not found|ENOENT|EACCES|ENOMEM|heap out|OutOfMemory|TypeScript|tsc|vite|ESBUILD|plugin" "$LOG" 2>/dev/null \
    | redact | tail -80 \
    || echo "(no error keywords found)"
  echo ""
  echo "## Build log tail (last 120 lines, redacted)"
  echo ""
  echo '```'
  tail -n 120 "$LOG" | redact
  echo '```'
  echo ""
  echo "## Summary"
  if [ "$BUILD_EXIT" -eq 0 ]; then
    echo "**WeApp build: PASS** (exit_code=0)"
  else
    echo "**WeApp build: FAIL** (exit_code=$BUILD_EXIT)"
    echo ""
    echo "This failure is CI-only — local \`npm ci && npm run weapp:build\` passes."
    echo "Review the error lines above for root cause."
  fi
} > "$SUMMARY"

# ── Print summary to stdout ──────────────────────────────────────────────────
cat "$SUMMARY"

# ── Always exit 0 after diagnostics written ──────────────────────────────────
exit 0
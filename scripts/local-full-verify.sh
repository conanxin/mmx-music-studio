#!/usr/bin/env bash
# ============================================================
# local-full-verify.sh — Local release verification script
# ============================================================
# Runs the full set of checks that must pass before any release.
# This script is the authoritative gate — GitHub Actions treats
# WeApp build as diagnostic-only due to a CI-only failure.
#
# Safety: This script does NOT call /api/generate, does NOT run
# mmx music generate/cover, and does NOT consume MiniMax quota.
# ============================================================

set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  LOCAL FULL VERIFY"
echo "═══════════════════════════════════════════════"

echo ""
echo "== typecheck:server =="
npm run typecheck:server

echo ""
echo "== typecheck =="
npm run typecheck

echo ""
echo "== build =="
npm run build

echo ""
echo "== manifest:audit =="
npm run manifest:audit

echo ""
echo "== weapp:build =="
npm run weapp:build

echo ""
echo "== studio-cli-submit-guard-smoke-test.sh =="
bash scripts/studio-cli-submit-guard-smoke-test.sh

echo ""
echo "== audio-duration-display-smoke-test.sh =="
bash scripts/audio-duration-display-smoke-test.sh

echo ""
echo "== weapp-byok-strategy-smoke-test.sh =="
bash scripts/weapp-byok-strategy-smoke-test.sh

echo ""
echo "== byok-mode-smoke-test.sh =="
bash scripts/byok-mode-smoke-test.sh

echo ""
echo "== real-api-attempt-guard-smoke-test.sh =="
bash scripts/real-api-attempt-guard-smoke-test.sh

echo ""
echo "═══════════════════════════════════════════════"
echo "  LOCAL_FULL_VERIFY_PASS"
echo "═══════════════════════════════════════════════"
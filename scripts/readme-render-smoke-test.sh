#!/usr/bin/env bash
# scripts/readme-render-smoke-test.sh
# Verifies README.md renders correctly on GitHub (no compressed tables)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
README="$PROJECT_DIR/README.md"

PASS=0
FAIL=0

assert_contains() {
  local pattern="$1"
  local file="$2"
  local label="$3"
  if grep -Fq "$pattern" "$file"; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ MISSING: $label"
    FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  local pattern="$1"
  local file="$2"
  local label="$3"
  if grep -Fq "$pattern" "$file"; then
    echo "  ✗ FOUND (should not be): $label"
    FAIL=$((FAIL+1))
  else
    echo "  ✓ NOT present: $label"
    PASS=$((PASS+1))
  fi
}

assert_file_exists() {
  local file="$1"
  local label="$2"
  if [ -f "$file" ]; then
    echo "  ✓ $label exists"
    PASS=$((PASS+1))
  else
    echo "  ✗ MISSING: $label"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================================"
echo "  README Render Smoke Test"
echo "============================================================"

# File exists
assert_file_exists "$README" "README.md exists"

# Required sections
assert_contains "## Current Status" "$README" "Current Status section"
assert_contains "## Release" "$README" "Release section"
assert_contains "v0.4.2-alpha" "$README" "v0.4.2-alpha version"
assert_contains "BYOK API Adapter" "$README" "BYOK API Adapter mention"
assert_contains "MMX CLI backend" "$README" "MMX CLI backend"
assert_contains "Cloudflare Tunnel" "$README" "Cloudflare Tunnel"

# No compressed table markers (double-pipe rows)
assert_not_contains "|| " "$README" "Double-pipe table rows (broken renderer)"
assert_not_contains "|||" "$README" "Triple-pipe table rows (broken renderer)"

# GitHub table syntax: after | Header | there must be |---|---|
# Check that the Generation Backends table is properly formed
if grep -n "### Generation Backends" "$README" > /dev/null; then
  echo "  ✓ Generation Backends subsection"
  PASS=$((PASS+1))
else
  echo "  ✗ MISSING: Generation Backends subsection"
  FAIL=$((FAIL+1))
fi

# Check Studio and Library table exists
if grep -n "### Studio and Library" "$README" > /dev/null; then
  echo "  ✓ Studio and Library subsection"
  PASS=$((PASS+1))
else
  echo "  ✗ MISSING: Studio and Library subsection"
  FAIL=$((FAIL+1))
fi

# Check CI and Safety table exists
if grep -n "### CI and Safety" "$README" > /dev/null; then
  echo "  ✓ CI and Safety subsection"
  PASS=$((PASS+1))
else
  echo "  ✗ MISSING: CI and Safety subsection"
  FAIL=$((FAIL+1))
fi

# Check Deployment table exists
if grep -n "### Deployment" "$README" > /dev/null; then
  echo "  ✓ Deployment subsection"
  PASS=$((PASS+1))
else
  echo "  ✗ MISSING: Deployment subsection"
  FAIL=$((FAIL+1))
fi

# Check that tables have proper separator lines (|---| or |------| etc.)
# Count all markdown table separator lines (dashes with possible padding)
TABLE_SEP_COUNT=$(grep -cE '^\|[ -]+\|' "$README") || TABLE_SEP_COUNT=0
if [ "$TABLE_SEP_COUNT" -ge 4 ]; then
  echo "  ✓ Table separator count: $TABLE_SEP_COUNT (>= 4)"
  PASS=$((PASS+1))
else
  echo "  ✗ Too few table separators: $TABLE_SEP_COUNT (expected >= 4)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "============================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  PASS: $PASS    FAIL: $FAIL"
  echo "============================================================"
  echo "README_RENDER_SMOKE_PASS"
  exit 0
else
  echo "  PASS: $PASS    FAIL: $FAIL"
  echo "============================================================"
  echo "README_RENDER_SMOKE_FAIL"
  exit 1
fi
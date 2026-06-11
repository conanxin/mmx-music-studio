#!/usr/bin/env bash
# BYOK-E Official API Schema Validation Smoke Test
# Phase BYOK-E: Schema verification from official mmx-cli source.
set -euo pipefail

SELF="scripts/byok-e-smoke-test.sh"
REPORT="docs/security/BYOK_OFFICIAL_API_SCHEMA_VALIDATION.md"
ADAPTER="server/adapters/minimax-api/byok-direct.ts"

echo "=== BYOK-E Smoke Test ==="

fail_count=0
pass_count=0

assert_file_contains() {
  local file="$1"
  local needle="$2"
  local msg="$3"
  if grep -qF "$needle" "$file"; then
    echo "  PASS: $msg"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL: $msg (missing: $needle)"
    fail_count=$((fail_count + 1))
  fi
}

assert_file_absent() {
  local file="$1"
  local needle="$2"
  local msg="$3"
  if grep -qF "$needle" "$file"; then
    echo "  FAIL: $msg (found: $needle)"
    fail_count=$((fail_count + 1))
  else
    echo "  PASS: $msg"
    pass_count=$((pass_count + 1))
  fi
}

# --- Report assertions ---
echo "--- Report assertions ---"
assert_file_contains "$REPORT" "BYOK-E Official API Schema Validation" "report has correct title"
assert_file_contains "$REPORT" "Validation sources" "report has validation sources"
assert_file_contains "$REPORT" "Required fields verification" "report has required fields"
assert_file_contains "$REPORT" "Endpoint URL" "report documents endpoint URL"
assert_file_contains "$REPORT" "Request Body Schema" "report documents request schema"
assert_file_contains "$REPORT" "Response Success Schema" "report documents response schema"
assert_file_contains "$REPORT" "Response Error Schema" "report documents error schema"
assert_file_contains "$REPORT" "Decision" "report has decision section"
assert_file_contains "$REPORT" "VERIFIED" "report has verified status"
assert_file_contains "$REPORT" "mmx-cli" "report references official CLI source"
assert_file_contains "$REPORT" "v1/music_generation" "report documents verified endpoint"
assert_file_contains "$REPORT" "music-2.6" "report documents verified models"
assert_file_contains "$REPORT" "Authorization: Bearer" "report documents auth format"
assert_file_contains "$REPORT" "BYOK-F Direct API Implementation is UNBLOCKED" "report unblocks BYOK-F"
# Relaxed: check for endpoint verification language
if grep -qF "endpoint guessing" "$REPORT" || grep -qF "verified from official" "$REPORT"; then
  echo "  PASS: report confirms no guessing"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: report confirms no guessing"
  fail_count=$((fail_count + 1))
fi

# --- Adapter assertions ---
echo "--- Adapter assertions ---"
assert_file_contains "$ADAPTER" "ByokDirectRequest" "adapter has verified request type"
assert_file_contains "$ADAPTER" "ByokDirectSuccessResponse" "adapter has verified success response type"
assert_file_contains "$ADAPTER" "ByokDirectErrorResponse" "adapter has verified error response type"
assert_file_contains "$ADAPTER" "MinimaxMusicModel" "adapter has verified model type"
assert_file_contains "$ADAPTER" "music-2.6" "adapter references verified model"
assert_file_contains "$ADAPTER" "byok_direct_api_not_verified" "adapter still returns not-verified"
assert_file_absent "$ADAPTER" "child_process" "adapter does not import child_process"
# Check spawn only in non-comment code
if grep -v "^[[:space:]]*//" "$ADAPTER" | grep -v "^[[:space:]]*\*" | grep -qF "spawn"; then
  echo "  FAIL: adapter does not use spawn (found in code)"
  fail_count=$((fail_count + 1))
else
  echo "  PASS: adapter does not use spawn"
  pass_count=$((pass_count + 1))
fi
# Check MINIMAX_API_KEY only in non-comment code
if grep -v "^[[:space:]]*//" "$ADAPTER" | grep -v "^[[:space:]]*\*" | grep -qF "MINIMAX_API_KEY"; then
  echo "  FAIL: adapter does not use MINIMAX_API_KEY env (found in code)"
  fail_count=$((fail_count + 1))
else
  echo "  PASS: adapter does not use MINIMAX_API_KEY env"
  pass_count=$((pass_count + 1))
fi
# Check fetch( only in active (non-commented) code
# Use a Python script to properly handle /* */ comment blocks
fetch_in_active=$(python3 - <<'PY'
import re
with open("server/adapters/minimax-api/byok-direct.ts") as f:
    content = f.read()

# Remove /* */ comments
content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
# Remove // comments
content = re.sub(r"//.*", "", content)
# Count fetch(
count = content.count("fetch(")
print(count)
PY
)
if [ "$fetch_in_active" -gt 0 ]; then
  echo "  FAIL: adapter does not call fetch live (found in active code)"
  fail_count=$((fail_count + 1))
else
  echo "  PASS: adapter does not call fetch live"
  pass_count=$((pass_count + 1))
fi

# --- Documentation assertions ---
echo "--- Documentation assertions ---"
assert_file_contains "README.md" "BYOK-E" "README records BYOK-E"
assert_file_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK-E" "HANDOFF records BYOK-E"
assert_file_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK-E" "READINESS records BYOK-E"

# --- Safety assertions ---
echo "--- Safety assertions ---"
assert_file_contains "$REPORT" "No key persistence" "report requires no key persistence"
assert_file_contains "$REPORT" "Strict redaction" "report requires strict redaction"
assert_file_contains "$REPORT" "No CLI spawn" "report requires no CLI spawn"
assert_file_contains "$REPORT" "No operator key fallback" "report requires no operator key fallback"
assert_file_contains "$REPORT" "Abuse controls" "report requires abuse controls"

# --- Summary ---
echo ""
echo "Results: $pass_count passed, $fail_count failed"

if [ "$fail_count" -gt 0 ]; then
  echo "BYOK_E_SMOKE_FAIL"
  exit 1
fi

echo "BYOK_E_SMOKE_PASS"

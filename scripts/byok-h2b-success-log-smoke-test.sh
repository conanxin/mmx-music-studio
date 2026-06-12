#!/usr/bin/env bash
# BYOK-H2B Smoke Test
# Validates that the success-path redacted Turnstile log was added in server code
# and that the redaction policy is preserved (no token, no secret, no user apiKey
# in any of the success-path or failure-path log strings).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
FAILED=()

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); FAILED+=("$1"); }

# 1. server/index.ts exists
if [ -f "server/index.ts" ]; then
  pass "server/index.ts exists"
else
  fail "server/index.ts missing"
  echo
  echo "Summary: $PASS pass, $FAIL fail"
  echo "BYOK_H2B_SUCCESS_LOG_SMOKE_FAIL"
  exit 1
fi

# 2. server contains [byok-turnstile-ok] success log
if grep -q "\[byok-turnstile-ok\]" server/index.ts; then
  pass "server contains [byok-turnstile-ok] success log"
else
  fail "server missing [byok-turnstile-ok] success log"
fi

# 3. failure log [byok-turnstile-debug] still exists
if grep -q "\[byok-turnstile-debug\]" server/index.ts; then
  pass "failure log [byok-turnstile-debug] still exists"
else
  fail "failure log [byok-turnstile-debug] missing (regression)"
fi

# 4. success log gated by debug flag (we check that the success log is
#    only emitted inside `if (turnstileResult.redacted)` block — this is the
#    contract that ties success logging to TURNSTILE_DEBUG_REDACTED=true,
#    since the redacted field is only populated when that flag is on).
#    We check that the success log line is preceded by the same `if (turnstileResult.redacted)` guard
#    used by the failure log block.
if grep -B 4 "\[byok-turnstile-ok\]" server/index.ts | grep -q "if (turnstileResult.redacted)"; then
  pass "success log gated by if (turnstileResult.redacted) — TURNSTILE_DEBUG_REDACTED tied"
else
  fail "success log not gated by if (turnstileResult.redacted)"
fi

# Extract the success log block: the next 7 lines starting at the
# line that contains [byok-turnstile-ok]. The log is a template literal
# broken across multiple concatenated string fragments.
SUCCESS_LINE=$(grep -n "\[byok-turnstile-ok\]" server/index.ts | head -1 | cut -d: -f1)
SUCCESS_BLOCK=$(sed -n "${SUCCESS_LINE},$((SUCCESS_LINE+7))p" server/index.ts)

# 5. success log includes requestId
if echo "$SUCCESS_BLOCK" | grep -q "requestId="; then
  pass "success log includes requestId"
else
  fail "success log missing requestId"
fi

# 6. success log includes tokenLength
if echo "$SUCCESS_BLOCK" | grep -q "tokenLength="; then
  pass "success log includes tokenLength"
else
  fail "success log missing tokenLength"
fi

# 7. success log includes tokenSha256_8
if echo "$SUCCESS_BLOCK" | grep -q "tokenSha256_8="; then
  pass "success log includes tokenSha256_8"
else
  fail "success log missing tokenSha256_8"
fi

# 8. success log includes cloudflareSuccess
if echo "$SUCCESS_BLOCK" | grep -q "cloudflareSuccess="; then
  pass "success log includes cloudflareSuccess"
else
  fail "success log missing cloudflareSuccess"
fi

# 9. success log includes hostname
if echo "$SUCCESS_BLOCK" | grep -q "hostname="; then
  pass "success log includes hostname"
else
  fail "success log missing hostname"
fi

# 10. success log includes action
if echo "$SUCCESS_BLOCK" | grep -q "action="; then
  pass "success log includes action"
else
  fail "success log missing action"
fi

# 11. success log includes outcome=turnstile_ok
if echo "$SUCCESS_BLOCK" | grep -q "outcome=turnstile_ok"; then
  pass "success log includes outcome=turnstile_ok"
else
  fail "success log missing outcome=turnstile_ok"
fi

# 12. success log does not include raw token reference
# Check that the log line itself does not include any token-shaped variable name
# like `token}` or `${token}` or a literal "token=" that would print the token.
if echo "$SUCCESS_BLOCK" | grep -qE 'token\$\{|=\$\{token\}|=\$\{turnstileToken\}|token:.*\$'; then
  fail "success log appears to print raw token"
else
  pass "success log does not include raw token"
fi

# 13. success log does not include TURNSTILE_SECRET_KEY
if echo "$SUCCESS_BLOCK" | grep -qE "TURNSTILE_SECRET_KEY|\$\{secret\}|secret=\$"; then
  fail "success log appears to print secret"
else
  pass "success log does not include secret"
fi

# 14. success log does not include user apiKey
if echo "$SUCCESS_BLOCK" | grep -qE "apiKey=\$|userApiKey|Authorization"; then
  fail "success log appears to print user apiKey or Authorization"
else
  pass "success log does not include user apiKey"
fi

# 15. The success log path is in the right location (inside handleByokGenerate,
#     after the failure branch returns, still inside the
#     `if (config.turnstileByokRequired === true)` gate).
FAIL_LINE=$(grep -n "\[byok-turnstile-debug\]" server/index.ts | head -1 | cut -d: -f1)
if [ -n "$SUCCESS_LINE" ] && [ -n "$FAIL_LINE" ] && [ "$SUCCESS_LINE" -gt "$FAIL_LINE" ]; then
  pass "success log line ($SUCCESS_LINE) is after failure log line ($FAIL_LINE)"
else
  fail "success log line not positioned after failure log line"
fi

# 16. server has no live call / no MiniMax / no music generation code in the new block
# (The new block only adds a console.log, no fetch / no provider call)
# We check that within 15 lines of the success log, there is no `fetch(` or
# `minimax` (case-insensitive) or `audio` write.
if tail -n +"$SUCCESS_LINE" server/index.ts | head -n 15 | grep -qiE "fetch\(|axios\.|minimax"; then
  fail "success log block appears to contain provider call (fetch / axios / minimax)"
else
  pass "success log block contains no provider call"
fi

# 17. /api/health does not leak the new log (the log is per-request, not
#     a health field). Check the file for any reference to "[byok-turnstile-ok]"
#     in /api/health route. Simpler: ensure that the success log is inside
#     handleByokGenerate and not in any /api/health handler.
HEALTH_LOG_LINES=$(grep -n "\[byok-turnstile-ok\]" server/index.ts | wc -l)
if [ "$HEALTH_LOG_LINES" = "1" ]; then
  pass "[byok-turnstile-ok] appears exactly once in server/index.ts (per-request only)"
else
  fail "[byok-turnstile-ok] appears $HEALTH_LOG_LINES times (expected 1)"
fi

# 18. Documentation marker (success log block has H2B comment)
# Check the 10 lines BEFORE the success log for the "Phase BYOK-H2B" comment.
ANNOTATION=$(sed -n "$((SUCCESS_LINE-10)),$((SUCCESS_LINE-1))p" server/index.ts)
if echo "$ANNOTATION" | grep -q "BYOK-H2B"; then
  pass "success log block annotated with Phase BYOK-H2B comment"
else
  fail "success log block missing H2B comment annotation (preceding 10 lines: $ANNOTATION)"
fi

echo
echo "Summary: $PASS pass, $FAIL fail"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed checks:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  echo
  echo "BYOK_H2B_SUCCESS_LOG_SMOKE_FAIL"
  exit 1
fi
echo
echo "BYOK_H2B_SUCCESS_LOG_SMOKE_PASS"

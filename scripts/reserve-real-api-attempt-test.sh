#!/usr/bin/env bash
# scripts/reserve-real-api-attempt-test.sh
# Phase 5E: Direct unit test for reserveRealApiAttempt()
# Tests counter logic WITHOUT starting the server or calling MiniMax API.
# Uses a temporary quota dir to avoid polluting real data.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Use a temporary directory for the test quota file
TEST_QUOTA_DIR="$(mktemp -d)"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1 — $2"; FAIL=$((FAIL+1)); }

echo "=== Phase 5E: reserveRealApiAttempt Direct Unit Test ==="
echo "  Test quota dir: $TEST_QUOTA_DIR"
echo

# Write test script to a known location in project
TEST_SCRIPT="$PROJECT_DIR/scripts/test-reserve-internal.ts"

cat > "$TEST_SCRIPT" << 'ENDOFFILE'
import { reserveRealApiAttempt, checkRealApiAttemptLimit, getRealApiAttemptStats } from '../server/rate-limit.ts';
import type { RealApiAttemptConfig } from '../server/rate-limit.ts';

const quotaDir = process.env.TEST_QUOTA_DIR ?? '/tmp';

const config: RealApiAttemptConfig = {
  enabled: true,
  dailyLimit: 3,
  quotaDir,
};

// Test 1: reserve increments counter by 1
const before = getRealApiAttemptStats(config);
reserveRealApiAttempt(config, { jobId: 'job-1', mode: 'instrumental' });
const after1 = getRealApiAttemptStats(config);
if (after1.attempts === before.attempts + 1) {
  console.log('[PASS] Test 1: counter increments to', after1.attempts);
} else {
  console.error('[FAIL] Test 1: counter did not increment (before:', before.attempts, ', after:', after1.attempts, ')');
  process.exit(1);
}

// Test 2: second reserve increments attempts by 1 (relative assertion, not absolute)
const statsAfterTest1 = getRealApiAttemptStats(config);
reserveRealApiAttempt(config, { jobId: 'job-2', mode: 'auto' });
const after2 = getRealApiAttemptStats(config);
const deltaAttempts = after2.attempts - statsAfterTest1.attempts;
if (deltaAttempts === 1) {
  console.log('[PASS] Test 2: delta +1 attempts (attempts=', after2.attempts, 'remaining=', after2.remaining, ')');
} else {
  console.error('[FAIL] Test 2: expected delta +1 attempts, got delta=', deltaAttempts, 'attempts=', after2.attempts, 'remaining=', after2.remaining);
  process.exit(1);
}

// Test 3: disabled config does not throw
const disabledConfig: RealApiAttemptConfig = { enabled: false, dailyLimit: 3, quotaDir };
try {
  reserveRealApiAttempt(disabledConfig, { jobId: 'job-3', mode: 'lyrics' });
  console.log('[PASS] Test 3: disabled config does not throw');
} catch (e: any) {
  console.error('[FAIL] Test 3: threw error:', e.message);
  process.exit(1);
}

// Test 4: checkRealApiAttemptLimit returns remaining matching current stats (delta=0)
const statsBeforeCheck = getRealApiAttemptStats(config);
const checkResult = checkRealApiAttemptLimit(config);
// remaining should match current stats (check does not consume quota)
if (checkResult.remaining === statsBeforeCheck.remaining) {
  console.log('[PASS] Test 4: check returns remaining=', checkResult.remaining, '(delta=0 from stats, allowed=', checkResult.allowed, ')');
} else {
  console.error('[FAIL] Test 4: expected remaining=', statsBeforeCheck.remaining, 'got remaining=', checkResult.remaining);
  process.exit(1);
}

// Test 5: limit=0 blocks
const zeroLimitConfig: RealApiAttemptConfig = { enabled: true, dailyLimit: 0, quotaDir };
const zeroResult = checkRealApiAttemptLimit(zeroLimitConfig);
if (zeroResult.allowed === false && zeroResult.remaining === 0) {
  console.log('[PASS] Test 5: limit=0 blocks correctly');
} else {
  console.error('[FAIL] Test 5: expected allowed=false remaining=0, got', JSON.stringify(zeroResult));
  process.exit(1);
}

console.log('[DONE] All 5 tests passed');
ENDOFFILE

STORAGE_QUOTA_DIR="$TEST_QUOTA_DIR" TEST_QUOTA_DIR="$TEST_QUOTA_DIR" npx tsx "$TEST_SCRIPT" 2>&1
RESULT=$?

rm -f "$TEST_SCRIPT"
rm -rf "$TEST_QUOTA_DIR"

if [ $RESULT -eq 0 ]; then
  pass "All 5 reserve/counter tests passed"
else
  fail "reserve/counter tests" "exit code $RESULT"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS   FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "RESERVE_REAL_API_ATTEMPT_TEST_PASS"
  exit 0
else
  echo "RESERVE_REAL_API_ATTEMPT_TEST_FAIL"
  exit 1
fi
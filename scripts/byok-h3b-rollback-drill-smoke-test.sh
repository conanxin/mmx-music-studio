#!/usr/bin/env bash
# byok-h3b-rollback-drill-smoke-test.sh
# Smoke test for Phase BYOK-H3B-DRILL: dry-run rollback drill evidence.
# Verifies evidence doc + cross-references + secret hygiene + no-live posture.

set -euo pipefail

EVIDENCE_DOC="docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md"
README="README.md"
HANDOFF="docs/DEVELOPMENT_HANDOFF.md"
READINESS="docs/PUBLIC_RELEASE_READINESS.md"
RUNBOOK="docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md"

PASS=0
FAIL=0

assert_contains() {
  local file="$1"
  local needle="$2"
  local msg="$3"
  if grep -qF -- "$needle" "$file" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  PASS: $msg"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL: $msg (needle not found: $needle)"
  fi
}

assert_file_exists() {
  local file="$1"
  local msg="$2"
  if [ -f "$file" ]; then
    PASS=$((PASS+1))
    echo "  PASS: $msg"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL: $msg (file missing: $file)"
  fi
}

echo "[1/3] evidence doc exists + drill framing + safe default + byok disabled (8 assertions)"
assert_file_exists "$EVIDENCE_DOC" "evidence doc exists"
assert_contains "$EVIDENCE_DOC" "dry-run rollback drill" "doc says dry-run rollback drill"
assert_contains "$EVIDENCE_DOC" "does not execute BYOK live generation" "doc says no live generation"
assert_contains "$EVIDENCE_DOC" "does not call MiniMax" "doc says no MiniMax call"
assert_contains "$EVIDENCE_DOC" "does not generate music" "doc says no music"
assert_contains "$EVIDENCE_DOC" 'PUBLIC_BYOK_ENABLED=false' "doc records PUBLIC_BYOK_ENABLED=false"
assert_contains "$EVIDENCE_DOC" 'BYOK_DRY_RUN_ONLY=true' "doc records BYOK_DRY_RUN_ONLY=true"
assert_contains "$EVIDENCE_DOC" 'BYOK_DIRECT_LIVE_ENABLED=false' "doc records BYOK_DIRECT_LIVE_ENABLED=false"
assert_contains "$EVIDENCE_DOC" 'byok_generation_disabled' "doc records byok_generation_disabled"


echo "[2/3] Access + leak + approval + cross-refs (8 assertions)"
assert_contains "$EVIDENCE_DOC" 'Cloudflare Access' "doc records Access protection"
assert_contains "$EVIDENCE_DOC" '/ops' "doc records /ops Access"
assert_contains "$EVIDENCE_DOC" '/api/status' "doc records /api/status Access"
assert_contains "$EVIDENCE_DOC" 'www-authenticate: Cloudflare-Access' "doc records Access header"
assert_contains "$EVIDENCE_DOC" '6/6 leak patterns absent' "doc records 6/6 leak patterns absent"
assert_contains "$EVIDENCE_DOC" 'TURNSTILE_SECRET_KEY' "doc mentions TURNSTILE_SECRET_KEY leak pattern"
assert_contains "$EVIDENCE_DOC" 'CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT' "doc contains approval phrase"
assert_contains "$EVIDENCE_DOC" 'PASS' "doc records PASS result"


echo "[3/3] cross-doc links: README + HANDOFF + READINESS + runbook (8 assertions)"
assert_contains "$README" "H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md" "README links to drill evidence"
assert_contains "$README" "H3B-DRILL" "README mentions H3B-DRILL phase"
assert_contains "$HANDOFF" "H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md" "HANDOFF links to drill evidence"
assert_contains "$HANDOFF" "Phase BYOK-H3B-DRILL" "HANDOFF mentions H3B-DRILL phase"
assert_contains "$READINESS" "H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md" "READINESS links to drill evidence"
assert_contains "$READINESS" "Phase BYOK-H3B-DRILL" "READINESS mentions H3B-DRILL phase"
assert_contains "$RUNBOOK" "H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md" "runbook references drill evidence"
assert_contains "$RUNBOOK" "PASS" "runbook records drill PASS"
assert_contains "$READINESS" 'does not execute BYOK live generation' "READINESS confirms no live"


echo
echo "============================================"
echo "BYOK-H3B-ROLLBACK-DRILL smoke test result"
echo "PASS: $PASS, FAIL: $FAIL"
echo "============================================"
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_ROLLBACK_DRILL_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_ROLLBACK_DRILL_SMOKE_FAIL"
  exit 1
fi


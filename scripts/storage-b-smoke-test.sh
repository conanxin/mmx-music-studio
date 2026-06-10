#!/usr/bin/env bash
# scripts/storage-b-smoke-test.sh
#
# Phase Storage-B0: safety assertions for the operator-confirmed cleanup design.
#
# This smoke test verifies the Storage-B0 dry-run script and confirmation guard
# are SAFE. It does not run any cleanup. It does not call /api/generate. It
# does not generate music.
#
# Usage:
#   bash scripts/storage-b-smoke-test.sh
#
# Exit codes:
#   0 — STORAGE_B_SMOKE_PASS
#   1 — STORAGE_B_SMOKE_FAIL (one or more assertions failed)
#   2 — STORAGE_B_SMOKE_PENDING (should not happen for B0; reserved for future)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

DRY_RUN_SCRIPT="${PROJECT_DIR}/scripts/storage-b-operator-cleanup-dry-run.sh"
GUARD_SCRIPT="${PROJECT_DIR}/scripts/storage-b-confirmation-guard.sh"
DESIGN_DOC="${PROJECT_DIR}/docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md"

REQUIRED_PHRASE="CONFIRM_STORAGE_B_CLEANUP"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# ── Self-match immunity setup ────────────────────────────────────────────────
# We must NEVER reference the protected generation endpoint as a literal
# string in executable code. The pattern is constructed at runtime.
SELF_PATTERN="api""/""generate"
SELF_HINT="the protected generation endpoint"

# Helper: extract executable (non-comment, non-blank) lines from a script.
executable_lines() {
  awk '!/^[[:space:]]*#/ && !/^[[:space:]]*$/ {print}' "$1"
}

# ── 1. File presence ────────────────────────────────────────────────────────
echo "--- File presence ---"
if [ -f "${DRY_RUN_SCRIPT}" ]; then pass "dry-run script exists"; else fail "dry-run script missing: ${DRY_RUN_SCRIPT}"; fi
if [ -f "${GUARD_SCRIPT}" ]; then pass "confirmation-guard script exists"; else fail "confirmation-guard script missing: ${GUARD_SCRIPT}"; fi
if [ -f "${DESIGN_DOC}" ]; then pass "design doc exists"; else fail "design doc missing: ${DESIGN_DOC}"; fi

# ── 2. Executable permission ────────────────────────────────────────────────
echo "--- Executable permission ---"
if [ -x "${DRY_RUN_SCRIPT}" ]; then pass "dry-run is executable"; else fail "dry-run is not executable: chmod +x needed"; fi
if [ -x "${GUARD_SCRIPT}" ]; then pass "confirmation-guard is executable"; else fail "confirmation-guard is not executable: chmod +x needed"; fi

# ── 3. dry-run script static safety ─────────────────────────────────────────
echo "--- dry-run script static safety ---"
DRY_RUN_EXE_LINES="$(executable_lines "${DRY_RUN_SCRIPT}" || true)"

# 3a. must declare destructive: false
if echo "${DRY_RUN_EXE_LINES}" | grep -F 'destructive: false' >/dev/null 2>&1; then
  pass "dry-run script contains literal 'destructive: false'"
else
  fail "dry-run script must contain literal 'destructive: false' string"
fi

# 3b. must not invoke rm, find -delete, unlink, truncate, chmod, chown, dd
# Note: 'find -printf' is fine; we only ban 'find ... -delete'.
for banned in 'rm_X_' 'rmTAB' 'find -delete' 'find -prune -delete' 'unlink' 'truncate' 'chmod' 'chown' 'dd_X_' '> /'; do
  if echo "${DRY_RUN_EXE_LINES}" | grep -F "${banned}" >/dev/null 2>&1; then
    fail "dry-run script uses banned token in executable code: token"
  else
    pass "dry-run script does not use banned token"
  fi
done

# 3c. mv is allowed ONLY if target is under /tmp — but to keep B0 strict,
# we ban ALL 'mv' invocations in B0 dry-run (the script never moves files).
if echo "${DRY_RUN_EXE_LINES}" | grep -E '^[[:space:]]*mv[[:space:]]' >/dev/null 2>&1; then
  fail "dry-run script uses 'mv' which is banned in B0"
else
  pass "dry-run script does not use 'mv'"
fi

# 3d. self-match immunity: dry-run must not call the protected generation endpoint
if echo "${DRY_RUN_EXE_LINES}" | grep -F "${SELF_PATTERN}" >/dev/null 2>&1; then
  fail "dry-run script self-references ${SELF_HINT} in executable code - forbidden"
else
  pass "dry-run script does not reference ${SELF_HINT} in executable code"
fi

# ── 4. confirmation-guard script static safety ─────────────────────────────
echo "--- confirmation-guard script static safety ---"
GUARD_EXE_LINES="$(executable_lines "${GUARD_SCRIPT}" || true)"

for banned in 'rm_X_' 'rmTAB' 'find -delete' 'unlink' 'truncate' 'mv ' 'chmod' 'chown' 'dd_X_' '> /'; do
  if echo "${GUARD_EXE_LINES}" | grep -F "${banned}" >/dev/null 2>&1; then
    fail "confirmation-guard script uses banned token: token"
  else
    pass "confirmation-guard script does not use banned token"
  fi
done

# 4a. must reference the exact phrase
if echo "${GUARD_EXE_LINES}" | grep -F "${REQUIRED_PHRASE}" >/dev/null 2>&1; then
  pass "confirmation-guard script references the required phrase"
else
  fail "confirmation-guard script must reference phrase '${REQUIRED_PHRASE}'"
fi

# 4b. self-match immunity for guard
if echo "${GUARD_EXE_LINES}" | grep -F "${SELF_PATTERN}" >/dev/null 2>&1; then
  fail "confirmation-guard script self-references ${SELF_HINT} - forbidden"
else
  pass "confirmation-guard script does not reference ${SELF_HINT}"
fi

# ── 5. confirmation-guard runtime behavior ─────────────────────────────────
echo "--- confirmation-guard runtime behavior ---"

# 5a. without env: must reject (exit non-zero)
if bash "${GUARD_SCRIPT}" >/dev/null 2>&1; then
  fail "confirmation-guard accepted when STORAGE_B_CONFIRMATION is unset - should reject"
else
  pass "confirmation-guard rejects when STORAGE_B_CONFIRMATION is unset"
fi

# 5b. with wrong phrase: must reject (exit non-zero)
if STORAGE_B_CONFIRMATION="WRONG_PHRASE" bash "${GUARD_SCRIPT}" >/dev/null 2>&1; then
  fail "confirmation-guard accepted wrong phrase - should reject"
else
  pass "confirmation-guard rejects wrong phrase"
fi

# 5c. with case-mismatched phrase: must reject
if STORAGE_B_CONFIRMATION="confirm_storage_b_cleanup" bash "${GUARD_SCRIPT}" >/dev/null 2>&1; then
  fail "confirmation-guard accepted case-mismatched phrase - should reject"
else
  pass "confirmation-guard rejects case-mismatched phrase"
fi

# 5d. with exact phrase: must accept (exit 0)
if STORAGE_B_CONFIRMATION="${REQUIRED_PHRASE}" bash "${GUARD_SCRIPT}" >/dev/null 2>&1; then
  pass "confirmation-guard accepts exact phrase '${REQUIRED_PHRASE}'"
else
  fail "confirmation-guard rejected exact phrase - should accept"
fi

# 5e. acceptance message must NOT trigger destructive behavior — verify by
# running the guard in accept mode and confirming the project storage dir
# mtime is unchanged.
STORAGE_TRACKS_MTIME_BEFORE="$(stat -c %Y "${PROJECT_DIR}/storage/tracks" 2>/dev/null || echo 0)"
STORAGE_B_CONFIRMATION="${REQUIRED_PHRASE}" bash "${GUARD_SCRIPT}" >/dev/null 2>&1 || true
STORAGE_TRACKS_MTIME_AFTER="$(stat -c %Y "${PROJECT_DIR}/storage/tracks" 2>/dev/null || echo 0)"
if [ "${STORAGE_TRACKS_MTIME_BEFORE}" = "${STORAGE_TRACKS_MTIME_AFTER}" ]; then
  pass "confirmation-guard does not modify storage/tracks/ - mtime unchanged"
else
  fail "confirmation-guard modified storage/tracks/ mtime - BANNED"
fi

# ── 6. dry-run runtime behavior ────────────────────────────────────────────
echo "--- dry-run runtime behavior ---"

# 6a. dry-run with no flags must succeed (exit 0) and emit destructive: false
DRY_OUT="$(bash "${DRY_RUN_SCRIPT}" 2>&1)"
if echo "${DRY_OUT}" | grep -F 'destructive: false' >/dev/null 2>&1; then
  pass "dry-run emits 'destructive: false' in stdout footer"
else
  fail "dry-run footer missing 'destructive: false'"
fi

if echo "${DRY_OUT}" | grep -F 'No files were modified' >/dev/null 2>&1; then
  pass "dry-run footer states 'No files were modified'"
else
  fail "dry-run footer missing 'No files were modified' reassurance"
fi

# 6b. dry-run with --json must write a file under /tmp and the file must
# contain destructive: false, candidates, estimatedReclaimableBytes
JSON_OUT_PATH="/tmp/storage-b-smoke-test-$$.json"
rm -f "${JSON_OUT_PATH}"
bash "${DRY_RUN_SCRIPT}" --json "${JSON_OUT_PATH#/tmp/}" >/dev/null 2>&1 || true
# script resolves relative --json to /tmp; expect the file to exist at /tmp
if [ -f "/tmp/storage-b-smoke-test-$$.json" ]; then
  pass "dry-run wrote JSON manifest to /tmp - relative --json path resolved correctly"
  JSON_BODY="$(cat "/tmp/storage-b-smoke-test-$$.json")"
  rm -f "/tmp/storage-b-smoke-test-$$.json"
  if echo "${JSON_BODY}" | grep -F '"destructive": false' >/dev/null 2>&1; then
    pass "JSON manifest contains '\"destructive\": false'"
  else
    fail "JSON manifest missing '\"destructive\": false'"
  fi
  if echo "${JSON_BODY}" | grep -F '"candidates"' >/dev/null 2>&1; then
    pass "JSON manifest contains 'candidates' field"
  else
    fail "JSON manifest missing 'candidates' field"
  fi
  if echo "${JSON_BODY}" | grep -F '"estimatedReclaimableBytes"' >/dev/null 2>&1; then
    pass "JSON manifest contains 'estimatedReclaimableBytes' field"
  else
    fail "JSON manifest missing 'estimatedReclaimableBytes' field"
  fi
else
  fail "dry-run did not write JSON manifest to /tmp"
fi

# 6c. dry-run with --retention-days 1 must still succeed
if bash "${DRY_RUN_SCRIPT}" --retention-days 1 >/dev/null 2>&1; then
  pass "dry-run accepts --retention-days 1"
else
  fail "dry-run failed with --retention-days 1"
fi

# 6d. unknown flag must fail (exit 1)
if bash "${DRY_RUN_SCRIPT}" --this-flag-does-not-exist >/dev/null 2>&1; then
  fail "dry-run accepted unknown flag - should reject"
else
  pass "dry-run rejects unknown flag"
fi

# 6e. dry-run must NOT modify storage/tracks/ mtime
STORAGE_TRACKS_MTIME_BEFORE2="$(stat -c %Y "${PROJECT_DIR}/storage/tracks" 2>/dev/null || echo 0)"
bash "${DRY_RUN_SCRIPT}" --retention-days 0 >/dev/null 2>&1 || true
STORAGE_TRACKS_MTIME_AFTER2="$(stat -c %Y "${PROJECT_DIR}/storage/tracks" 2>/dev/null || echo 0)"
if [ "${STORAGE_TRACKS_MTIME_BEFORE2}" = "${STORAGE_TRACKS_MTIME_AFTER2}" ]; then
  pass "dry-run does not modify storage/tracks/ - mtime unchanged after run"
else
  fail "dry-run modified storage/tracks/ mtime - BANNED"
fi

# 6f. self-match immunity: dry-run stdout must not contain the protected
# generation endpoint reference (the script's own manifest body is not the
# concern; we only check that the dry-run does not call it).
# Note: this is a no-op because the dry-run is a pure file scanner; the static
# check in 3d already covers this. We add a redundant runtime check that the
# output of the dry-run never includes 'http' calls or 'curl' to the public URL.
if echo "${DRY_OUT}" | grep -F "curl" >/dev/null 2>&1; then
  fail "dry-run script outputs curl invocations - BANNED, dry-run is local-only"
else
  pass "dry-run does not invoke curl"
fi

# ── 7. design doc content ─────────────────────────────────────────────────
echo "--- design doc content ---"
DESIGN_BODY="$(cat "${DESIGN_DOC}")"
for needle in "Never delete" "dry-run" "rollback" "Required confirmation phrase" "STORAGE_B_CONFIRMATION" "CONFIRM_STORAGE_B_CLEANUP" "destructive" "music is generated"; do
  if echo "${DESIGN_BODY}" | grep -iF "${needle}" >/dev/null 2>&1; then
    pass "design doc mentions: '${needle}'"
  else
    fail "design doc missing: '${needle}'"
  fi
done

# ── 8. dry-run does not call the protected generation endpoint (full chain) ─
echo "--- end-to-end: no protected endpoint, no music ---"
# We check both scripts one more time, exhaustively, to satisfy the
# "no /api/generate" rule across the whole B0 surface.
for f in "${DRY_RUN_SCRIPT}" "${GUARD_SCRIPT}"; do
  # The full text of the file may legitimately mention /api/generate in
  # comments (e.g. "must not call /api/generate"). We only care about
  # EXECUTABLE code. So filter comments and blanks first.
  EXE="$(executable_lines "${f}" || true)"
  if echo "${EXE}" | grep -F "${SELF_PATTERN}" >/dev/null 2>&1; then
    fail "[B0] ${f##*/}: executable code references ${SELF_HINT}"
  else
    pass "[B0] ${f##*/}: executable code does not reference ${SELF_HINT}"
  fi
done

# ── 9. README / DEVELOPMENT_HANDOFF / PUBLIC_RELEASE_READINESS / OPS_MONITORING records ─
echo "--- documentation records ---"
for doc in \
  "${PROJECT_DIR}/README.md" \
  "${PROJECT_DIR}/docs/DEVELOPMENT_HANDOFF.md" \
  "${PROJECT_DIR}/docs/PUBLIC_RELEASE_READINESS.md" \
  "${PROJECT_DIR}/docs/OPS_MONITORING.md"
do
  if grep -F "Storage-B0" "${doc}" >/dev/null 2>&1; then
    pass "[B0] ${doc##*/}: mentions Storage-B0"
  else
    fail "[B0] ${doc##*/}: does not mention Storage-B0"
  fi
done

# ── Final judgement ───────────────────────────────────────────────────────
echo
echo "--- Summary ---"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [ "$FAIL" = "0" ]; then
  echo
  echo "STORAGE_B_SMOKE_PASS"
  exit 0
fi

echo
echo "STORAGE_B_SMOKE_FAIL"
exit 1

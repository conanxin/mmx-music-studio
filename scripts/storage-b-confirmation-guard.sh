#!/usr/bin/env bash
# scripts/storage-b-confirmation-guard.sh
#
# Phase Storage-B0: Confirmation protocol guard (SKELETON ONLY).
#
# This script is a SAFETY GUARD. It does NOT delete any file. It does NOT
# perform any cleanup. Its only job is to verify that the operator has typed
# the exact confirmation phrase into the STORAGE_B_CONFIRMATION environment
# variable.
#
# Usage:
#   bash scripts/storage-b-confirmation-guard.sh
#   STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP bash scripts/storage-b-confirmation-guard.sh
#
# Exit codes:
#   0 — confirmation phrase is present and matches exactly
#   1 — confirmation phrase is missing
#   2 — confirmation phrase is present but does not match
#
# Future Storage-B1 (NOT in this phase) will call this guard before any
# destructive action. The guard will refuse to allow any cleanup unless the
# exact phrase is provided.
#
# Safety invariants (asserted by scripts/storage-b-smoke-test.sh):
#   - This script does NOT call rm, find -delete, unlink, truncate, mv, chmod, chown, dd
#   - This script does NOT call /api/generate
#   - This script does NOT generate music
#   - This script does NOT modify any file
#   - The literal "api/generate" does NOT appear in executable code
#     (self-match immunity — see smoke-test-pending-state-pattern skill)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

REQUIRED_PHRASE="CONFIRM_STORAGE_B_CLEANUP"

# Read from environment
PROVIDED="${STORAGE_B_CONFIRMATION:-}"

# Defensive: ensure neither empty set, typo, nor case-mismatch leaks through.
if [ -z "${PROVIDED}" ]; then
  echo "storage-b-confirmation-guard: confirmation missing"
  echo "  set STORAGE_B_CONFIRMATION=${REQUIRED_PHRASE} to acknowledge"
  echo "  this script is a SKELETON only — it does not delete anything"
  exit 1
fi

if [ "${PROVIDED}" = "${REQUIRED_PHRASE}" ]; then
  echo "storage-b-confirmation-guard: confirmation accepted"
  echo "  phrase matches exactly: ${REQUIRED_PHRASE}"
  echo "  B0 NOTE: this guard does not perform cleanup. It is a safety skeleton."
  echo "  future Storage-B1 would call this guard before any destructive action."
  exit 0
fi

echo "storage-b-confirmation-guard: confirmation rejected"
echo "  expected: ${REQUIRED_PHRASE}"
echo "  got:      ${PROVIDED}"
exit 2

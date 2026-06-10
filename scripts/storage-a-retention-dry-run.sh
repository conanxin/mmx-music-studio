#!/usr/bin/env bash
# scripts/storage-a-retention-dry-run.sh
# Phase Storage-A: Storage retention dry-run
#
# Usage: bash scripts/storage-a-retention-dry-run.sh
#        RETENTION_DAYS=30 bash scripts/storage-a-retention-dry-run.sh
#
# Default retention window: 90 days.
# mode is always 'dry-run' — no files are deleted or modified.
# Outputs candidate count + reclaimable bytes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${OUTPUT_DIR:-./storage/tracks}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"

echo "=== Storage Retention Dry-Run ==="
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Retention window: ${RETENTION_DAYS} days"
echo "Mode: DRY-RUN (no files will be deleted)"
echo ""

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found"
  exit 1
fi

TMPFILE=$(mktemp --suffix=.mts "$PROJECT_DIR/.storage-a-tmp-XXXXXX")
cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

cat > "$TMPFILE" <<'SCRIPT'
import { buildStorageRetentionDryRun } from "./server/storage-maintenance.js";

const outputDir = process.env.OUTPUT_DIR ?? "./storage/tracks";
const retentionDays = parseInt(process.env.RETENTION_DAYS ?? "90", 10);

const report = buildStorageRetentionDryRun({ outputDir, retentionDays });

console.log("Retention days:   ", report.retentionDays);
console.log("Mode: ", report.mode);
console.log("Candidate count:  ", report.candidateCount);
console.log("Reclaimable MB:  ", (report.reclaimableBytes / 1024 / 1024).toFixed(2));
console.log("Generated at:     ", report.generatedAt);
console.log("");

// Group by kind
const byKind: Record<string, number> = {};
for (const c of report.candidates) {
  byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
}
for (const [kind, count] of Object.entries(byKind)) {
  console.log("  " + kind + ":", count);
}
console.log("");

if (report.candidateCount === 0) {
  console.log("✓ No retention candidates found");
} else {
  console.log("⚠  Candidates found — review before any cleanup");
  console.log(" To delete, an operator must review candidates and remove files manually");
  console.log("   This script will NEVER delete files automatically");
}
SCRIPT

npx --prefix "$PROJECT_DIR" tsx "$TMPFILE"

echo ""
echo "=== End Dry-Run ==="
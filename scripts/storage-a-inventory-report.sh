#!/usr/bin/env bash
# scripts/storage-a-inventory-report.sh
# Phase Storage-A: Storage inventory report
#
# Usage: bash scripts/storage-a-inventory-report.sh
#
# Reads storage/tracks/ and outputs a human-readable inventory summary.
# No files are modified. No paths or tokens are exposed.
# Safe to run in CI.

set -euo pipefail

OUTPUT_DIR="${OUTPUT_DIR:-./storage/tracks}"

echo "=== Storage Inventory Report ==="
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found"
  exit 1
fi

# Use the TypeScript helper via node + tsx eval
node --input-type=module <<'EOF'
import { buildStorageInventorySummary } from './server/storage-maintenance.js';

const outputDir = process.env.OUTPUT_DIR ?? './storage/tracks';
const summary = buildStorageInventorySummary(outputDir);

console.log('Storage directory:', outputDir.replace(/^\.\//, 'storage/'));
console.log('');
console.log('Track records:    ', summary.trackCount);
console.log('Audio files:      ', summary.audioFileCount);
console.log('Approx audio MB:  ', (summary.approxAudioBytes / 1024 / 1024).toFixed(2));
console.log('Orphan audio:     ', summary.orphanAudioFileCount);
console.log('Missing audio:    ', summary.missingAudioFileCount);
console.log('Readable:         ', summary.readable);
console.log('Generated at:     ', summary.generatedAt);
console.log('');

if (summary.orphanAudioFileCount > 0) {
  console.warn('⚠  Orphan audio files detected — review with retention dry-run');
}
if (summary.missingAudioFileCount > 0) {
  console.warn('⚠  Missing audio files detected — tracks reference missing audio');
}
if (!summary.readable) {
  console.error('ERROR: storage directory not readable');
  process.exit(1);
}
EOF

echo ""
echo "=== End Inventory Report ==="
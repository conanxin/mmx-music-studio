#!/usr/bin/env bash
# scripts/storage-a-backup-manifest.sh
# Phase Storage-A: Storage backup manifest
#
# Usage: bash scripts/storage-a-backup-manifest.sh
#        bash scripts/storage-a-backup-manifest.sh > /tmp/backup-manifest.json
#
# Outputs a lightweight JSON manifest snapshot to stdout.
# No files are written. No audio content is included.
# Safe to store in operator records before any cleanup.

set -euo pipefail

OUTPUT_DIR="${OUTPUT_DIR:-./storage/tracks}"

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found"
  exit 1
fi

node --input-type=module <<'EOF'
import { buildStorageBackupManifest } from './server/storage-maintenance.js';

const outputDir = process.env.OUTPUT_DIR ?? './storage/tracks';
const manifest = buildStorageBackupManifest(outputDir);

process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
EOF
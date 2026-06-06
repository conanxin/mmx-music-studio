#!/usr/bin/env tsx
/**
 * scripts/manifest-fix.ts
 * Optional fixes for legacy manifest inconsistencies.
 * Default: DRY RUN. Use --apply to write changes.
 *
 * Fixes handled:
 * - Adds legacyFileName: true to old mmx-cli records where filename != id.mp3
 *   (does NOT rename files, only annotates metadata)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = path.resolve(ROOT_DIR, 'storage/tracks/manifest.json');
const TRACKS_DIR = path.resolve(ROOT_DIR, 'storage/tracks');

interface TrackRecord {
  id: string;
  title?: string;
  mode?: string;
  model?: string;
  prompt?: string;
  status?: string;
  audioFileName?: string;
  audioFilePath?: string | null;
  audioMimeType?: string;
  audioFormat?: string;
  durationMs?: number;
  durationText?: string;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  generationSource?: string;
  createdAt?: string;
  legacyFileName?: boolean;
  [key: string]: unknown;
}

interface Manifest {
  version: number;
  tracks: TrackRecord[];
}

async function fix(): Promise<{ changes: string[]; total: number }> {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest: Manifest = JSON.parse(raw);
  const changes: string[] = [];
  const total = manifest.tracks.length;

  for (let i = 0; i < manifest.tracks.length; i++) {
    const track = manifest.tracks[i];

    // For mmx-cli tracks: if audioFileName doesn't match ${id}.mp3 pattern,
    // mark it as legacyFileName=true (file was generated before filename fix)
    if (track.generationSource === 'mmx-cli' && track.audioFileName) {
      const expectedName = `${track.id}.mp3`;
      if (track.audioFileName !== expectedName && !track.legacyFileName) {
        // Check if the file actually exists with the old name
        const oldPath = path.join(TRACKS_DIR, track.audioFileName);
        if (fs.existsSync(oldPath)) {
          track.legacyFileName = true;
          changes.push(`[${i}] Marked legacyFileName=true: ${track.id} file=${track.audioFileName}`);
        }
      }
    }
  }

  return { changes, total };
}

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('=== mmx-music-studio manifest fix ===\n');
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (use --apply to write)'}\n`);

  const { changes, total } = await fix();

  console.log(`Tracks scanned: ${total}`);
  console.log(`Changes: ${changes.length}\n`);

  if (changes.length === 0) {
    console.log('✅ No changes needed');
    process.exit(0);
  }

  for (const c of changes) {
    console.log(`  ${c}`);
  }

  if (apply) {
    // Re-read and write
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest: Manifest = JSON.parse(raw);

    // Re-apply fixes (already done in fix() which mutated in-place)
    for (let i = 0; i < manifest.tracks.length; i++) {
      const track = manifest.tracks[i];
      if (track.generationSource === 'mmx-cli' && track.audioFileName) {
        const expectedName = `${track.id}.mp3`;
        if (track.audioFileName !== expectedName && !track.legacyFileName) {
          const oldPath = path.join(TRACKS_DIR, track.audioFileName);
          if (fs.existsSync(oldPath)) {
            track.legacyFileName = true;
          }
        }
      }
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n✅ Written to ${MANIFEST_PATH}`);
  } else {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to apply.');
  }
}

main().catch((e) => {
  console.error('Fix script failed:', e);
  process.exit(1);
});

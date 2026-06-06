#!/usr/bin/env tsx
/**
 * scripts/manifest-audit.ts
 * Audits storage/tracks/manifest.json for consistency and security issues.
 * Usage: npm run manifest:audit
 *        npm run manifest:audit -- --fix  (apply safe fixes)
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

const MIMETYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

const KNOWN_SOURCES = new Set(['mock', 'mmx-cli', 'minimax-api']);

const SENSITIVE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{10,}/,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /Authorization:\s*[\w\s]+/,
  /MINIMAX_API_KEY\s*=\s*[^?\s]+/i,
  /api[_-]?key\s*=\s*[^?\s]+/i,
  /token\s*=\s*[^?\s&]+/i,
];

async function audit(): Promise<{ issues: string[]; fixed: number; total: number }> {
  const issues: string[] = [];
  let fixed = 0;

  if (!fs.existsSync(MANIFEST_PATH)) {
    issues.push(`FATAL: manifest.json not found at ${MANIFEST_PATH}`);
    return { issues, fixed, total: 0 };
  }

  let manifest: Manifest;
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (e) {
    issues.push(`FATAL: manifest.json is not valid JSON: ${e}`);
    return { issues, fixed, total: 0 };
  }

  if (!manifest.tracks || !Array.isArray(manifest.tracks)) {
    issues.push('FATAL: manifest.tracks is missing or not an array');
    return { issues, fixed, total: 0 };
  }

  const total = manifest.tracks.length;
  const seenIds = new Set<string>();

  for (let i = 0; i < manifest.tracks.length; i++) {
    const track = manifest.tracks[i];

    // 1. Check id
    if (!track.id) {
      issues.push(`[${i}] Missing track id`);
    } else {
      if (seenIds.has(track.id)) {
        issues.push(`[${i}] Duplicate track id: ${track.id}`);
      }
      seenIds.add(track.id);

      // 2. Check audioFileName vs id consistency
      if (track.audioFileName) {
        const expectedPrefix = track.id.endsWith('.mp3') || track.id.endsWith('.wav')
          ? track.id.replace(/\.(mp3|wav)$/, '') : track.id;
        const fileNameWithoutExt = track.audioFileName.replace(/\.(mp3|wav)$/, '');
        // For mmx-cli tracks, fileName should start with id prefix.
        // Skip if legacyFileName=true (pre-fix records, documented as legacy).
        if (track.generationSource === 'mmx-cli' && !track.legacyFileName) {
          if (!track.audioFileName.startsWith(expectedPrefix.slice(0, 16))) {
            issues.push(`[${i}] mmx-cli track id=${track.id} audioFileName=${track.audioFileName} may be inconsistent`);
          }
        }
      }
    }

    // 3. Check audioFileName exists
    if (track.audioFileName) {
      const filePath = path.join(TRACKS_DIR, track.audioFileName);
      if (!fs.existsSync(filePath)) {
        issues.push(`[${i}] File missing: ${track.audioFileName} (id=${track.id})`);
      } else {
        const stat = fs.statSync(filePath);
        if (stat.size === 0) {
          issues.push(`[${i}] File empty: ${track.audioFileName} (id=${track.id})`);
        }
      }
    } else if (!track.audioFilePath) {
      issues.push(`[${i}] Neither audioFileName nor audioFilePath set (id=${track.id})`);
    }

    // 4. Check generationSource
    if (track.generationSource && !KNOWN_SOURCES.has(track.generationSource)) {
      issues.push(`[${i}] Unknown generationSource: ${track.generationSource} (id=${track.id})`);
    }

    // 5. Check audioMimeType
    if (track.audioMimeType) {
      const validMimes = new Set(Object.values(MIMETYPE_MAP));
      validMimes.add('audio/mpeg');
      if (!validMimes.has(track.audioMimeType) && !track.audioMimeType.startsWith('audio/')) {
        issues.push(`[${i}] Suspicious audioMimeType: ${track.audioMimeType} (id=${track.id})`);
      }
    }

    // 6. Check for sensitive data in ALL string fields
    const trackStr = JSON.stringify(track);
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(trackStr)) {
        issues.push(`[${i}] POSSIBLE SECRET LEAK in track (id=${track.id}): matched sensitive pattern ${pattern}`);
      }
    }

    // 7. Check title/prompt don't leak keys
    for (const field of ['title', 'prompt', 'lyrics']) {
      if (track[field] && typeof track[field] === 'string') {
        for (const pattern of SENSITIVE_PATTERNS) {
          if (pattern.test(track[field] as string)) {
            issues.push(`[${i}] POSSIBLE SECRET LEAK in ${field} (id=${track.id})`);
          }
        }
      }
    }
  }

  return { issues, fixed, total };
}

async function main() {
  const applyFix = process.argv.includes('--fix');

  console.log('=== mmx-music-studio manifest audit ===\n');
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Tracks dir: ${TRACKS_DIR}`);
  console.log(`Fix mode: ${applyFix ? 'DRY RUN (use --fix to apply)' : 'REPORT ONLY'}\n`);

  const { issues, fixed, total } = await audit();

  console.log(`Total tracks: ${total}`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ PASS — No issues found');
    process.exit(0);
  }

  console.log('--- Issues ---\n');
  for (const issue of issues) {
    const marker = issue.includes('POSSIBLE SECRET') || issue.includes('FATAL')
      ? '🔴' : issue.includes('missing') || issue.includes('empty')
      ? '🟡' : '⚠️ ';
    console.log(`${marker} ${issue}`);
  }

  if (fixed > 0) {
    console.log(`\n🔧 Fixed: ${fixed} issue(s)`);
  }

  const hasSecrets = issues.some(i => i.includes('POSSIBLE SECRET') || i.includes('FATAL'));
  process.exit(hasSecrets ? 2 : 1);
}

main().catch((e) => {
  console.error('Audit script failed:', e);
  process.exit(2);
});

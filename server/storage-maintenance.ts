/**
 * server/storage-maintenance.ts — Storage inventory and retention analysis.
 *
 * Design goals:
 * - Read-only. Never deletes files. Never modifies metadata.
 * - Never exposes absolute paths, raw prompts, tokens, or API keys.
 * - Graceful degradation: read failures return safe defaults, never crash.
 * - Candidates are operator-only (scripts), not exposed via /api/status.
 *
 * Three main exports:
 *   buildStorageInventorySummary()  — current state: counts + orphan/missing
 *   buildStorageRetentionDryRun()   — retention candidates (dry-run only)
 *   buildStorageBackupManifest()     — exportable snapshot for operator records
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StorageInventorySummary {
  /** Number of track records in manifest.json */
  trackCount: number;
  /** Number of audio files found in storage/tracks/ (audio only, no .json) */
  audioFileCount: number;
  /** Sum of sizeBytes from manifest entries */
  approxAudioBytes: number;
  /** Audio files present but not referenced by any manifest track */
  orphanAudioFileCount: number;
  /** Track records referencing an audio file that does not exist */
  missingAudioFileCount: number;
  /** Whether the storage directory was readable */
  readable: boolean;
  generatedAt: string;
}

/** A single storage artifact flagged for potential retention review. */
export interface StorageRetentionCandidate {
  /** 'orphan-audio' | 'missing-audio-metadata' | 'old-track' */
  kind: 'orphan-audio' | 'missing-audio-metadata' | 'old-track';
  /** Approximate age in days (from createdAt for tracks; from file mtime for orphans) */
  ageDays?: number;
  /** Estimated byte size of the artifact */
  approxBytes?: number;
  /** Human-readable reason this candidate was flagged */
  reason: string;
}

export interface StorageRetentionDryRun {
  mode: 'dry-run';
  /** retentionDays threshold used */
  retentionDays: number;
  /** Total candidates found */
  candidateCount: number;
  /** Total bytes reclaimable if candidates were removed */
  reclaimableBytes: number;
  /** Candidates — never exposed via public /api/status */
  candidates: StorageRetentionCandidate[];
  generatedAt: string;
}

export interface StorageBackupManifest {
  generatedAt: string;
  version: string;
  trackCount: number;
  audioFileCount: number;
  approxAudioBytes: number;
  note: string;
}

// ── Audio file extension filter ───────────────────────────────────────────────

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac']);

/** Returns true for files that look like audio (by extension). */
function isAudioFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

// ── Core inventory builder ────────────────────────────────────────────────────

/**
 * Builds a current-state inventory of storage/tracks/.
 *
 * Reads manifest + filesystem to detect:
 * - orphan audio: audio file on disk not referenced by any manifest track
 * - missing audio: manifest track references audio file that doesn't exist
 *
 * Safe to call in any context. Failures return safe defaults.
 */
export function buildStorageInventorySummary(outputDir: string): StorageInventorySummary {
  const result: StorageInventorySummary = {
    trackCount: 0,
    audioFileCount: 0,
    approxAudioBytes: 0,
    orphanAudioFileCount: 0,
    missingAudioFileCount: 0,
    readable: false,
    generatedAt: new Date().toISOString(),
  };

  try {
    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = { version: 1, tracks: [] as Array<{ id?: string; audioFileName?: string; sizeBytes?: number; createdAt?: string }> };

    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        manifest.tracks = parsed.tracks ?? [];
        manifest.version = parsed.version ?? 1;
      } catch {
        // Manifest unreadable — continue with empty tracks
        manifest.tracks = [];
      }
    }

    // Build set of audio filenames referenced in manifest
    const referencedAudio = new Set<string>();
    let totalBytes = 0;

    for (const track of manifest.tracks) {
      if (track.audioFileName) {
        referencedAudio.add(track.audioFileName);
      }
      if (track.sizeBytes) {
        totalBytes += track.sizeBytes;
      }
    }

    result.trackCount = manifest.tracks.length;
    result.approxAudioBytes = totalBytes;

    // Scan filesystem for actual audio files
    let actualAudioFiles: string[] = [];
    try {
      const entries = fs.readdirSync(outputDir);
      actualAudioFiles = entries.filter(isAudioFile);
    } catch {
      // Directory unreadable — return readable:false
      return result;
    }

    result.audioFileCount = actualAudioFiles.length;

    // Orphan: audio on disk but not in manifest
    result.orphanAudioFileCount = actualAudioFiles.filter(
      (f) => !referencedAudio.has(f),
    ).length;

    // Missing: audio referenced in manifest but not on disk
    const missing = manifest.tracks.filter(
      (t) => t.audioFileName && !actualAudioFiles.includes(t.audioFileName),
    );
    result.missingAudioFileCount = missing.length;

    result.readable = true;
  } catch {
    // Unexpected failure — readable stays false
  }

  return result;
}

// ── Retention dry-run builder ─────────────────────────────────────────────────

/**
 * Builds a retention dry-run report.
 *
 * mode is always 'dry-run' — no files are modified.
 *
 * Candidates:
 * - orphan-audio: audio file on disk not referenced by any manifest track
 * - missing-audio-metadata: track record references audio file that doesn't exist
 * - old-track: track older than retentionDays (ageDays >= retentionDays)
 *
 * Never exposes candidate details via public endpoints.
 */
export function buildStorageRetentionDryRun(params: {
  outputDir: string;
  retentionDays?: number;
}): StorageRetentionDryRun {
  const retentionDays = params.retentionDays ?? 90;
  const now = Date.now();
  const msPerDay = 86_400_000;

  const candidates: StorageRetentionCandidate[] = [];
  let reclaimableBytes = 0;

  try {
    const manifestPath = path.join(params.outputDir, 'manifest.json');
    const manifest = { version: 1, tracks: [] as Array<{ id?: string; audioFileName?: string; sizeBytes?: number; createdAt?: string }> };

    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        manifest.tracks = parsed.tracks ?? [];
      } catch {
        manifest.tracks = [];
      }
    }

    const referencedAudio = new Set<string>();
    const missingTracks: Array<{ audioFileName?: string; sizeBytes?: number; createdAt?: string }> = [];

    for (const track of manifest.tracks) {
      if (track.audioFileName) {
        referencedAudio.add(track.audioFileName);
      }
      if (track.audioFileName) {
        const audioPath = path.join(params.outputDir, track.audioFileName);
        try {
          if (!fs.existsSync(audioPath)) {
            missingTracks.push(track);
          }
        } catch {
          // Can't check — treat as missing
          missingTracks.push(track);
        }
      }
    }

    // Missing audio metadata
    for (const track of missingTracks) {
      candidates.push({
        kind: 'missing-audio-metadata',
        approxBytes: track.sizeBytes ?? 0,
        reason: 'Track record references audio file that does not exist on disk',
      });
      if (track.sizeBytes) reclaimableBytes += track.sizeBytes;
    }

    // Orphan audio files
    let actualAudioFiles: string[] = [];
    try {
      const entries = fs.readdirSync(params.outputDir);
      actualAudioFiles = entries.filter(isAudioFile);
    } catch {
      // Unreadable — skip orphan check
    }

    for (const audioFile of actualAudioFiles) {
      if (!referencedAudio.has(audioFile)) {
        let fileBytes = 0;
        let fileMtime: number | undefined;

        try {
          const stat = fs.statSync(path.join(params.outputDir, audioFile));
          fileBytes = stat.size;
          fileMtime = stat.mtimeMs;
        } catch {
          // Can't stat — use 0
        }

        const ageDays = fileMtime !== undefined ? Math.floor((now - fileMtime) / msPerDay) : undefined;

        candidates.push({
          kind: 'orphan-audio',
          ageDays,
          approxBytes: fileBytes,
          reason: 'Audio file exists on disk but is not referenced by any manifest track',
        });
        reclaimableBytes += fileBytes;
      }
    }

    // Old tracks
    for (const track of manifest.tracks) {
      if (!track.createdAt) continue;
      const createdMs = Date.parse(track.createdAt);
      if (isNaN(createdMs)) continue;

      const ageDays = Math.floor((now - createdMs) / msPerDay);
      if (ageDays >= retentionDays) {
        candidates.push({
          kind: 'old-track',
          ageDays,
          approxBytes: track.sizeBytes ?? 0,
          reason: `Track older than ${retentionDays} days (age: ${ageDays}d)`,
        });
        if (track.sizeBytes) reclaimableBytes += track.sizeBytes;
      }
    }
  } catch {
    // Unexpected failure — return empty dry-run
  }

  return {
    mode: 'dry-run',
    retentionDays,
    candidateCount: candidates.length,
    reclaimableBytes,
    candidates,
    generatedAt: new Date().toISOString(),
  };
}

// ── Backup manifest builder ─────────────────────────────────────────────────────

/**
 * Builds a lightweight backup manifest snapshot.
 *
 * Safe to store externally — excludes:
 * - raw prompts / lyrics
 * - absolute paths
 * - tokens / API keys
 * - raw audio content
 *
 * Suitable for operator records before any cleanup operation.
 */
export function buildStorageBackupManifest(outputDir: string): StorageBackupManifest {
  const summary = buildStorageInventorySummary(outputDir);

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0',
    trackCount: summary.trackCount,
    audioFileCount: summary.audioFileCount,
    approxAudioBytes: summary.approxAudioBytes,
    note: 'Backup manifest excludes raw audio content, prompts, and tokens',
  };
}
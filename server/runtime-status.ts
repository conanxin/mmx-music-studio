/**
 * server/runtime-status.ts — Public-safe runtime diagnostics.
 *
 * Design goals:
 * - Read-only, public-safe runtime summary for ops monitoring.
 * - No raw IPs, sourceHashes, tokens, API keys, prompts, or raw logs.
 * - Graceful degradation: read failures return { readable: false } not 500.
 *
 * This module is safe to expose via /api/status or embed in /api/health.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getJobStats } from './jobs.js';
import type { LaunchGuardConfig } from './launch-guard.js';

// ── Storage stats ──────────────────────────────────────────────────────────────

export interface StorageAggregate {
  trackCount: number;
  audioFileCount: number;
  approxAudioBytes: number;
  readable: boolean;
}

/**
 * Walk storage/tracks/ to count audio files and estimate total bytes.
 * Fails gracefully — never throws, never exposes absolute paths.
 */
export function getStorageAggregate(outputDir: string): StorageAggregate {
  const result: StorageAggregate = {
    trackCount: 0,
    audioFileCount: 0,
    approxAudioBytes: 0,
    readable: false,
  };

  try {
    // Read manifest for track count
    const manifestPath = path.join(outputDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as { version: number; tracks: Array<{ audioFileName?: string; sizeBytes?: number }> };
      result.trackCount = manifest.tracks?.length ?? 0;
      for (const track of manifest.tracks ?? []) {
        if (track.audioFileName) result.audioFileCount++;
        if (track.sizeBytes) result.approxAudioBytes += track.sizeBytes;
      }
    }
    result.readable = true;
  } catch {
    // Directory not readable — return readable:false
  }

  return result;
}

// ── Job queue aggregate ────────────────────────────────────────────────────────

export interface JobQueueAggregate {
  enabled: boolean;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
}

export function getJobQueueAggregate(): JobQueueAggregate {
  const stats = getJobStats();
  return {
    enabled: true,
    pending: stats.queued,
    running: stats.running,
    succeeded: stats.succeeded,
    failed: stats.failed,
  };
}

// ── Launch guard summary (no source-specific data) ───────────────────────────────

export interface LaunchGuardSummary {
  enabled: boolean;
  publicGenerationEnabled: boolean;
  perSourceDailyLimit: number;
  generationCooldownSeconds: number;
}

export function buildLaunchGuardSummary(config: LaunchGuardConfig): LaunchGuardSummary {
  return {
    enabled: config.enabled,
    publicGenerationEnabled: config.publicGenerationEnabled,
    perSourceDailyLimit: config.perSourceDailyLimit,
    generationCooldownSeconds: config.cooldownSeconds,
  };
}

// ── Full runtime status (safe to serialize) ────────────────────────────────────

export interface RuntimeStatusSummary {
  service: {
    ok: boolean;
    timestamp: string;
  };
  backend: {
    current: string;
    realGenerationEnabled: boolean;
    mockGenerationEnabled: boolean;
  };
  launchGuard: LaunchGuardSummary;
  jobQueue: JobQueueAggregate;
  storage: StorageAggregate;
}

export function buildRuntimeStatusSummary(params: {
  backend: string;
  realGenerationEnabled: boolean;
  mockGenerationEnabled: boolean;
  launchGuardConfig: LaunchGuardConfig;
  outputDir: string;
}): RuntimeStatusSummary {
  const { backend, realGenerationEnabled, mockGenerationEnabled, launchGuardConfig, outputDir } = params;
  return {
    service: {
      ok: true,
      timestamp: new Date().toISOString(),
    },
    backend: {
      current: backend,
      realGenerationEnabled,
      mockGenerationEnabled,
    },
    launchGuard: buildLaunchGuardSummary(launchGuardConfig),
    jobQueue: getJobQueueAggregate(),
    storage: getStorageAggregate(outputDir),
  };
}
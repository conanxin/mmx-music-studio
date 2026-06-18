/**
 * Server-side file storage for track manifests and audio files.
 * Never persists API keys, Authorization headers, or signing URLs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Manifest, TrackMetadata, GenerationSource, ByokDirectLiveProvenance } from './types.js';

const MANIFEST_NAME = 'manifest.json';
const WORKSPACES_DIR_NAME = 'workspaces';
const WORKSPACE_AUDIO_DIR_NAME = 'audio';

export const DEFAULT_WORKSPACE_ID = 'default';

export interface TrackStorageOptions {
  workspaceId?: string;
}

export interface TrackStoragePaths {
  workspaceId: string;
  manifestPath: string;
  tracksDir: string;
  audioDir: string;
  legacy: boolean;
}

export function isSafeWorkspaceId(workspaceId: string): boolean {
  const id = workspaceId.trim();
  if (id.length < 1 || id.length > 64) return false;
  if (id.includes('..')) return false;
  if (id.includes('/')) return false;
  if (id.includes('\\')) return false;
  if (id.includes('://')) return false;
  if (path.isAbsolute(id)) return false;
  return /^[a-z0-9_-]+$/.test(id);
}

function normalizeWorkspaceId(workspaceId?: string): string {
  const id = (workspaceId ?? DEFAULT_WORKSPACE_ID).trim();
  if (!isSafeWorkspaceId(id)) {
    throw new Error('Invalid workspaceId');
  }
  return id;
}

/**
 * P3B workspace namespace scaffolding.
 *
 * The default workspace intentionally maps to the legacy storage/tracks
 * structure so production data does not need a migration. Future authenticated
 * workspaces get their own storage/workspaces/{workspaceId}/tracks tree.
 */
export function resolveTrackStoragePaths(outputDir: string, options: TrackStorageOptions = {}): TrackStoragePaths {
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  if (workspaceId === DEFAULT_WORKSPACE_ID) {
    return {
      workspaceId,
      manifestPath: path.join(outputDir, MANIFEST_NAME),
      tracksDir: outputDir,
      audioDir: outputDir,
      legacy: true,
    };
  }

  const storageRoot = path.dirname(outputDir);
  const tracksDir = path.join(storageRoot, WORKSPACES_DIR_NAME, workspaceId, 'tracks');
  return {
    workspaceId,
    manifestPath: path.join(tracksDir, MANIFEST_NAME),
    tracksDir,
    audioDir: path.join(tracksDir, WORKSPACE_AUDIO_DIR_NAME),
    legacy: false,
  };
}

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export function loadManifest(outputDir: string, options: TrackStorageOptions = {}): Manifest {
  const paths = resolveTrackStoragePaths(outputDir, options);
  if (!fs.existsSync(paths.manifestPath)) {
    return { version: 1, tracks: [] };
  }
  try {
    const content = fs.readFileSync(paths.manifestPath, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch {
    return { version: 1, tracks: [] };
  }
}

export function saveManifest(outputDir: string, manifest: Manifest, options: TrackStorageOptions = {}): void {
  const paths = resolveTrackStoragePaths(outputDir, options);
  ensureOutputDir(paths.tracksDir);
  fs.writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export function createTrackRecord(params: {
  id: string;
  title: string;
  mode: string;
  model: string;
  prompt: string;
  lyrics?: string;
  audioFileName: string;
  audioMimeType: string;
  audioFormat: string;
  durationMs?: number;
  durationText?: string;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  traceId?: string;
  generationSource: GenerationSource;
  provider?: 'minimax';
  requestId?: string;
  providerTaskId?: string;
  generationIntent?: 'instrumental' | 'with_lyrics';
  workspaceId?: string;
  ownerUserId?: string;
  visibility?: 'private' | 'workspace' | 'demo';
  byok?: ByokDirectLiveProvenance;
}): TrackMetadata {
  const workspaceId = normalizeWorkspaceId(params.workspaceId);
  return {
    id: params.id,
    title: params.title,
    mode: params.mode,
    model: params.model,
    prompt: params.prompt,
    lyrics: params.lyrics,
    status: 'success',
    audioFileName: params.audioFileName,
    audioMimeType: params.audioMimeType,
    audioFormat: params.audioFormat,
    durationMs: params.durationMs,
    durationText: params.durationText,
    sampleRate: params.sampleRate,
    bitrate: params.bitrate,
    sizeBytes: params.sizeBytes,
    traceId: params.traceId,
    generationSource: params.generationSource,
    provider: params.provider,
    requestId: params.requestId,
    providerTaskId: params.providerTaskId,
    generationIntent: params.generationIntent,
    workspaceId,
    ownerUserId: params.ownerUserId,
    visibility: params.visibility,
    byok: params.byok,
    createdAt: new Date().toISOString(),
  };
}

export function appendTrack(outputDir: string, track: TrackMetadata, options: TrackStorageOptions = {}): void {
  const manifest = loadManifest(outputDir, options);
  manifest.tracks.unshift(track); // newest first
  saveManifest(outputDir, manifest, options);
}

export function removeTrack(outputDir: string, id: string, options: TrackStorageOptions = {}): void {
  const manifest = loadManifest(outputDir, options);
  manifest.tracks = manifest.tracks.filter((t) => t.id !== id);
  saveManifest(outputDir, manifest, options);
}

export function findTrackById(outputDir: string, id: string, options: TrackStorageOptions = {}): TrackMetadata | null {
  const manifest = loadManifest(outputDir, options);
  return manifest.tracks.find((t) => t.id === id) ?? null;
}

export function getTrackFilePath(outputDir: string, audioFileName: string, options: TrackStorageOptions = {}): string {
  const paths = resolveTrackStoragePaths(outputDir, options);
  return path.join(paths.audioDir, audioFileName);
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\u4e00-\u9fff\-_. ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function generateTrackId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateFileName(params: {
  mode: string;
  title: string;
}): string {
  const ts = new Date();
  const datePart = ts
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const safeTitle = sanitizeFileName(params.title || 'untitled');
  return `${datePart}_${params.mode}_${safeTitle}.mp3`;
}

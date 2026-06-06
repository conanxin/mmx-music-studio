/**
 * Server-side file storage for track manifests and audio files.
 * Never persists API keys, Authorization headers, or signing URLs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Manifest, TrackMetadata, GenerationSource } from './types.js';

const MANIFEST_NAME = 'manifest.json';

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export function loadManifest(outputDir: string): Manifest {
  const manifestPath = path.join(outputDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    return { version: 1, tracks: [] };
  }
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch {
    return { version: 1, tracks: [] };
  }
}

export function saveManifest(outputDir: string, manifest: Manifest): void {
  const manifestPath = path.join(outputDir, MANIFEST_NAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
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
}): TrackMetadata {
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
    createdAt: new Date().toISOString(),
  };
}

export function appendTrack(outputDir: string, track: TrackMetadata): void {
  const manifest = loadManifest(outputDir);
  manifest.tracks.unshift(track); // newest first
  saveManifest(outputDir, manifest);
}

export function removeTrack(outputDir: string, id: string): void {
  const manifest = loadManifest(outputDir);
  manifest.tracks = manifest.tracks.filter((t) => t.id !== id);
  saveManifest(outputDir, manifest);
}

export function findTrackById(outputDir: string, id: string): TrackMetadata | null {
  const manifest = loadManifest(outputDir);
  return manifest.tracks.find((t) => t.id === id) ?? null;
}

export function getTrackFilePath(outputDir: string, audioFileName: string): string {
  return path.join(outputDir, audioFileName);
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

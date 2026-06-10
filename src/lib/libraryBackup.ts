/**
 * libraryBackup.ts — Phase Product Polish-L + M
 *
 * Browser-local Library data backup & restore.
 * Backed by localStorage — annotations, annotation history, favorites,
 * prompt templates, playback queue, playback progress.
 *
 * Hard rules:
 * - Never includes server audio, server paths, API keys, tokens, headers, logs.
 * - Never uploaded to the server.
 * - Import is validated; merge or replace semantics for annotations + history.
 * - Backward compatible with v1.0 backups (annotationHistory is optional).
 *
 * Version: 1.0 (annotationHistory optional for forward compat)
 */

import {
  loadTrackAnnotations,
  saveTrackAnnotations,
  loadAnnotationHistory,
  saveAnnotationHistory,
  normalizeTags,
  type TrackAnnotationsMap,
  type AnnotationHistoryEntry,
} from './trackAnnotations';

export const BACKUP_VERSION = '1.0';
export const FAVORITES_KEY = 'mmx-studio:favorites';
export const PROMPT_TEMPLATES_KEY = 'mmx-studio:prompt-templates';
export const PLAYBACK_QUEUE_KEY = 'mmx-studio:playback-queue:v1';
export const PLAYBACK_PROGRESS_KEY = 'mmx-studio:playback-progress:v1';
export const ANNOTATIONS_KEY = 'mmx-studio:track-annotations:v1';
export const ANNOTATION_HISTORY_KEY = 'mmx-studio:annotation-history:v1';

export const MAX_HISTORY_IN_BACKUP = 300;

export interface LibraryLocalBackupV1 {
  version: '1.0';
  exportedAt: string;
  app: 'mmx-music-studio';
  data: {
    annotations: TrackAnnotationsMap;
    annotationHistory?: AnnotationHistoryEntry[];
    favorites?: string[];
    promptTemplates?: unknown[];
    playbackQueue?: unknown;
    playbackProgress?: unknown;
  };
  meta: {
    annotationCount: number;
    annotationHistoryCount: number;
    favoriteCount: number;
    promptTemplateCount: number;
  };
}

// ── Read raw localStorage keys (best-effort, silent on failure) ───────────────

function readJsonArray(key: string): unknown[] | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readJsonUnknown(key: string): unknown | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// ── Build backup payload from current localStorage ────────────────────────────

export function buildLibraryBackup(): LibraryLocalBackupV1 {
  const annotations = loadTrackAnnotations();
  const annotationHistory = loadAnnotationHistory();
  const favorites = readJsonArray(FAVORITES_KEY) as string[] | undefined;
  const promptTemplates = readJsonArray(PROMPT_TEMPLATES_KEY);

  // Playback queue / progress are persisted by App.tsx / Layout.tsx.
  // We only snapshot whatever shape they have today. We treat them as opaque
  // (unknown) — restore writes them back byte-for-byte.
  const playbackQueue = readJsonUnknown(PLAYBACK_QUEUE_KEY);
  const playbackProgress = readJsonUnknown(PLAYBACK_PROGRESS_KEY);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'mmx-music-studio',
    data: {
      annotations,
      annotationHistory,
      favorites: favorites as string[] | undefined,
      promptTemplates,
      playbackQueue,
      playbackProgress,
    },
    meta: {
      annotationCount: Object.keys(annotations).length,
      annotationHistoryCount: annotationHistory.length,
      favoriteCount: Array.isArray(favorites) ? favorites.length : 0,
      promptTemplateCount: Array.isArray(promptTemplates) ? promptTemplates.length : 0,
    },
  };
}

// ── Validate a parsed backup payload ──────────────────────────────────────────

export type ValidationResult =
  | { ok: true; payload: LibraryLocalBackupV1 }
  | { ok: false; error: string };

export function validateLibraryBackup(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: '备份文件不是 JSON 对象' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== 'mmx-music-studio') {
    return { ok: false, error: '不是 mmx-music-studio 的备份文件' };
  }
  if (obj.version !== BACKUP_VERSION) {
    return { ok: false, error: `不支持的备份版本：${String(obj.version)}` };
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return { ok: false, error: '备份 data 字段缺失' };
  }
  const data = obj.data as Record<string, unknown>;
  if (!data.annotations || typeof data.annotations !== 'object') {
    return { ok: false, error: 'annotations 字段缺失或不是对象' };
  }
  // Best-effort shape check for annotations: must be a map of trackId → { tags, note }
  for (const [trackId, ann] of Object.entries(data.annotations as Record<string, unknown>)) {
    if (!ann || typeof ann !== 'object') {
      return { ok: false, error: `annotations.${trackId} 不是对象` };
    }
    const a = ann as Record<string, unknown>;
    if (!Array.isArray(a.tags)) {
      return { ok: false, error: `annotations.${trackId}.tags 不是数组` };
    }
    if (typeof a.note !== 'string') {
      return { ok: false, error: `annotations.${trackId}.note 不是字符串` };
    }
  }
  return { ok: true, payload: raw as LibraryLocalBackupV1 };
}

// ── Import strategies ─────────────────────────────────────────────────────────

export type ImportMode = 'merge' | 'replace';

/** Apply the backup to localStorage. Returns per-key status. */
export function applyLibraryBackup(
  payload: LibraryLocalBackupV1,
  mode: ImportMode
): { annotationsMerged: number; favoritesWritten: boolean; templatesWritten: boolean; queueWritten: boolean; progressWritten: boolean } {
  // Annotations
  const incoming = payload.data.annotations || {};
  const existing = mode === 'merge' ? loadTrackAnnotations() : {};
  const merged: TrackAnnotationsMap = { ...existing };
  for (const [trackId, ann] of Object.entries(incoming)) {
    if (mode === 'replace') {
      const tags = normalizeTags(Array.isArray(ann.tags) ? (ann.tags as string[]) : []);
      merged[trackId] = {
        trackId,
        tags,
        note: typeof ann.note === 'string' ? ann.note : '',
        updatedAt: typeof ann.updatedAt === 'string' ? ann.updatedAt : new Date().toISOString(),
      };
    } else {
      const prev = existing[trackId];
      const prevTags = prev ? prev.tags : [];
      const mergedTags = normalizeTags([...prevTags, ...((ann.tags as string[]) || [])]);
      // Note: import file wins unless import note is empty
      const importNote = typeof ann.note === 'string' ? ann.note : '';
      const note = importNote.trim() ? importNote : prev ? prev.note : '';
      merged[trackId] = {
        trackId,
        tags: mergedTags,
        note,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  saveTrackAnnotations(merged);

  // Favorites
  let favoritesWritten = false;
  const favs = payload.data.favorites;
  if (Array.isArray(favs)) {
    const cleaned = Array.from(new Set(favs.filter(f => typeof f === 'string')));
    if (mode === 'merge') {
      try {
        const existingFavs = readJsonArray(FAVORITES_KEY) as string[] | undefined;
        const set = new Set<string>(Array.isArray(existingFavs) ? existingFavs : []);
        for (const f of cleaned) set.add(f);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
      } catch { /* ignore */ }
    } else {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(cleaned));
      } catch { /* ignore */ }
    }
    favoritesWritten = true;
  }

  // Prompt templates — write-through as opaque array
  let templatesWritten = false;
  const templates = payload.data.promptTemplates;
  if (Array.isArray(templates)) {
    try {
      localStorage.setItem(PROMPT_TEMPLATES_KEY, JSON.stringify(templates));
      templatesWritten = true;
    } catch { /* ignore */ }
  }

  // Playback queue / progress — write-through as opaque value
  let queueWritten = false;
  let progressWritten = false;
  if (payload.data.playbackQueue !== undefined) {
    try {
      localStorage.setItem(PLAYBACK_QUEUE_KEY, JSON.stringify(payload.data.playbackQueue));
      queueWritten = true;
    } catch { /* ignore */ }
  }
  if (payload.data.playbackProgress !== undefined) {
    try {
      localStorage.setItem(PLAYBACK_PROGRESS_KEY, JSON.stringify(payload.data.playbackProgress));
      progressWritten = true;
    } catch { /* ignore */ }
  }

  // Annotation history — optional in v1.0 backup
  // Merge: dedupe by id, prepend incoming, cap at 300
  // Replace: if backup has history, use it; if missing, preserve current
  const incomingHistory = Array.isArray(payload.data.annotationHistory)
    ? (payload.data.annotationHistory as AnnotationHistoryEntry[]).slice(0, MAX_HISTORY_IN_BACKUP)
    : null;
  if (incomingHistory) {
    const existingHistory = mode === 'merge' ? loadAnnotationHistory() : [];
    let mergedHistory: AnnotationHistoryEntry[];
    if (mode === 'merge') {
      const seen = new Set<string>();
      mergedHistory = [];
      // Incoming first (newer), then existing; dedupe by id
      for (const e of [...incomingHistory, ...existingHistory]) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        mergedHistory.push(e);
        if (mergedHistory.length >= MAX_HISTORY_IN_BACKUP) break;
      }
    } else {
      mergedHistory = incomingHistory;
    }
    saveAnnotationHistory(mergedHistory);
  } else if (mode === 'replace') {
    // Old backup without annotationHistory — preserve current history (safety)
    // No-op: do not wipe history when backup doesn't carry it
  }

  return {
    annotationsMerged: Object.keys(incoming).length,
    favoritesWritten,
    templatesWritten,
    queueWritten,
    progressWritten,
  };
}

// ── Filename helpers ──────────────────────────────────────────────────────────

/** Format a Date as YYYYMMDD-HHmm in local time. */
export function formatTimestampForFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

export function makeBackupFilename(d: Date = new Date()): string {
  return `mmx-local-backup-${formatTimestampForFilename(d)}.json`;
}

export function makeCollectionFilename(ext: 'md' | 'json', d: Date = new Date()): string {
  return `mmx-collection-export-${formatTimestampForFilename(d)}.${ext}`;
}

// ── Collection export builders ────────────────────────────────────────────────

/** Strip anything that looks like a server absolute path. */
function sanitizeText(s: string): string {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[已隐藏]')
    .replace(/sk-[A-Za-z0-9]{10,}/gi, '[已隐藏]')
    .replace(/(file:\/\/\/|https?:\/\/)[^\s)]*\.(mp3|wav|m4a|ogg|flac)(\?[^\s)]*)?/gi, '[音频链接已隐藏]');
}

export interface CollectionTrackExport {
  id: string;
  title: string;
  prompt?: string;
  lyrics?: string;
  mode: string;
  source: string;
  durationMs?: number;
  createdAt: string;
  shareUrl?: string;
  tags: string[];
  note: string;
}

export interface CollectionFilters {
  query?: string;
  source?: string;
  smartCollection?: string;
  tag?: string;
}

export function buildCollectionMarkdown(
  collectionLabel: string,
  tracks: CollectionTrackExport[],
  options?: { collectionUrl?: string; filters?: CollectionFilters }
): string {
  const lines: string[] = [];
  lines.push('# MMX Music Studio Collection Export');
  lines.push('');
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push(`Track count: ${tracks.length}`);
  lines.push(`Collection: ${collectionLabel}`);
  if (options?.collectionUrl) {
    lines.push(`Collection URL: ${sanitizeText(options.collectionUrl)}`);
  }
  if (options?.filters) {
    const f = options.filters;
    const filterLines: string[] = [];
    if (f.query) filterLines.push(`- Query: ${sanitizeText(f.query)}`);
    if (f.source) filterLines.push(`- Source: ${sanitizeText(f.source)}`);
    if (f.smartCollection) filterLines.push(`- Smart collection: ${sanitizeText(f.smartCollection)}`);
    if (f.tag) filterLines.push(`- Tag: ${sanitizeText(f.tag)}`);
    if (filterLines.length > 0) {
      lines.push('Filters:');
      lines.push(...filterLines);
    }
  }
  lines.push('');
  tracks.forEach((t, idx) => {
    lines.push('---');
    lines.push('');
    lines.push(`## ${idx + 1}. ${sanitizeText(t.title || '无标题')}`);
    lines.push('');
    lines.push(`- ID: ${t.id}`);
    lines.push(`- Source: ${sanitizeText(t.source || '—')}`);
    lines.push(`- Mode: ${sanitizeText(t.mode || '—')}`);
    lines.push(`- Duration: ${t.durationMs != null ? `${Math.round(t.durationMs / 1000)}s` : '—'}`);
    lines.push(`- Created: ${t.createdAt || '—'}`);
    if (t.shareUrl) lines.push(`- URL: ${sanitizeText(t.shareUrl)}`);
    lines.push('');
    lines.push('### Prompt');
    lines.push('');
    lines.push(t.prompt ? sanitizeText(t.prompt) : '_未记录 prompt_');
    lines.push('');
    if (t.lyrics) {
      lines.push('### Lyrics');
      lines.push('');
      lines.push(sanitizeText(t.lyrics));
      lines.push('');
    }
    lines.push('### Tags');
    lines.push('');
    if (t.tags.length > 0) {
      t.tags.forEach(tag => lines.push(`- ${tag}`));
    } else {
      lines.push('none');
    }
    lines.push('');
    lines.push('### Notes');
    lines.push('');
    lines.push(t.note ? sanitizeText(t.note) : 'none');
    lines.push('');
  });
  return lines.join('\n');
}

export function buildCollectionJson(
  collectionLabel: string,
  tracks: CollectionTrackExport[],
  options?: { collectionUrl?: string; filters?: CollectionFilters }
): string {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'mmx-music-studio',
    collectionLabel,
    collectionUrl: options?.collectionUrl || '',
    filters: options?.filters || {},
    trackCount: tracks.length,
    tracks,
  };
  return JSON.stringify(payload, null, 2);
}

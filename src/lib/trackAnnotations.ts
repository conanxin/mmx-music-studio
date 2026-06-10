/**
 * trackAnnotations.ts — Phase Product Polish-K + M
 *
 * Browser-local tag + note storage for tracks.
 * Backed by localStorage under `mmx-studio:track-annotations:v1`.
 * Plus browser-local annotation history under `mmx-studio:annotation-history:v1`.
 * Never synced to server. No schema migration.
 */

export const ANNOTATIONS_KEY = 'mmx-studio:track-annotations:v1';
export const ANNOTATION_HISTORY_KEY = 'mmx-studio:annotation-history:v1';
const MAX_TAGS = 12;
const MAX_TAG_LEN = 24;
const MAX_NOTE_LEN = 500;
const MAX_HISTORY_LEN = 300;
const MAX_NOTE_PREVIEW_LEN = 80;

export interface TrackAnnotation {
  trackId: string;
  tags: string[];
  note: string;
  updatedAt: string;
}

export type TrackAnnotationsMap = Record<string, TrackAnnotation>;

// ── Phase Product Polish-M: Annotation history ─────────────────────────────────

export type AnnotationHistoryAction =
  | 'tag_added'
  | 'tag_removed'
  | 'batch_tag_added'
  | 'batch_tag_removed'
  | 'note_updated'
  | 'backup_import_merge'
  | 'backup_import_replace';

export interface AnnotationHistoryEntry {
  id: string;
  trackId?: string;
  trackIds?: string[];
  action: AnnotationHistoryAction;
  label: string;
  tags?: string[];
  notePreview?: string;
  createdAt: string;
}

/** Load annotation history from localStorage. Silent on failure. */
export function loadAnnotationHistory(): AnnotationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(ANNOTATION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sanitize: drop entries that don't satisfy the shape contract
    return parsed.filter((e): e is AnnotationHistoryEntry =>
      !!e && typeof e === 'object'
      && typeof (e as AnnotationHistoryEntry).id === 'string'
      && typeof (e as AnnotationHistoryEntry).action === 'string'
      && typeof (e as AnnotationHistoryEntry).label === 'string'
      && typeof (e as AnnotationHistoryEntry).createdAt === 'string'
    );
  } catch {
    return [];
  }
}

/** Persist annotation history. Silent on quota exceeded. */
export function saveAnnotationHistory(entries: AnnotationHistoryEntry[]): void {
  try {
    localStorage.setItem(ANNOTATION_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_LEN)));
  } catch {
    // storage quota exceeded or private mode — ignore
  }
}

/** Generate a short id for a history entry. Time-prefixed for stable sort. */
function makeHistoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Record a new annotation history entry. Auto-trims to MAX_HISTORY_LEN. */
export function recordAnnotationHistory(
  entry: Omit<AnnotationHistoryEntry, 'id' | 'createdAt'> & { createdAt?: string }
): AnnotationHistoryEntry {
  const newEntry: AnnotationHistoryEntry = {
    id: makeHistoryId(),
    createdAt: entry.createdAt || new Date().toISOString(),
    action: entry.action,
    label: entry.label,
    trackId: entry.trackId,
    trackIds: entry.trackIds,
    tags: entry.tags ? entry.tags.slice(0, MAX_TAGS) : undefined,
    notePreview: entry.notePreview ? entry.notePreview.slice(0, MAX_NOTE_PREVIEW_LEN) : undefined,
  };
  const existing = loadAnnotationHistory();
  const next = [newEntry, ...existing].slice(0, MAX_HISTORY_LEN);
  saveAnnotationHistory(next);
  return newEntry;
}

/** Get up to `limit` history entries for a single track (either as primary trackId or in trackIds). */
export function getTrackAnnotationHistory(
  trackId: string,
  limit = 5
): AnnotationHistoryEntry[] {
  const all = loadAnnotationHistory();
  return all
    .filter(e => e.trackId === trackId || (Array.isArray(e.trackIds) && e.trackIds.includes(trackId)))
    .slice(0, limit);
}

/** Clear all history. Not exposed in UI; helper for future use. */
export function clearAnnotationHistory(): void {
  try {
    localStorage.removeItem(ANNOTATION_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/** Exported limits so consumers can reason about caps. */
export const ANNOTATION_HISTORY_LIMITS = {
  MAX_HISTORY_LEN,
  MAX_NOTE_PREVIEW_LEN,
} as const;

/** Load all annotations from localStorage. Silently returns {} on failure. */
export function loadTrackAnnotations(): TrackAnnotationsMap {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TrackAnnotationsMap;
  } catch {
    return {};
  }
}

/** Persist the full map to localStorage. Silently fails on quota exceeded. */
export function saveTrackAnnotations(map: TrackAnnotationsMap): void {
  try {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(map));
  } catch {
    // storage quota exceeded or private mode — ignore
  }
}

/** Get annotation for a single track. Returns empty annotation if none. */
export function getTrackAnnotation(annotations: TrackAnnotationsMap, trackId: string): TrackAnnotation {
  return annotations[trackId] ?? { trackId, tags: [], note: '', updatedAt: '' };
}

/** Set annotation for a track with validation and normalization. */
export function setTrackAnnotation(
  annotations: TrackAnnotationsMap,
  trackId: string,
  tags: string[],
  note: string
): TrackAnnotationsMap {
  const normalizedTags = normalizeTags(tags);
  const trimmedNote = note.slice(0, MAX_NOTE_LEN).trim();
  return { ...annotations, [trackId]: { trackId, tags: normalizedTags, note: trimmedNote, updatedAt: new Date().toISOString() } };
}

/** Normalize tags: trim, dedupe (case-insensitive), enforce limits. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t || t.length > MAX_TAG_LEN) continue;
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(t);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

/** Get all unique tags across all annotations, sorted by frequency. */
export function getAllAnnotationTags(annotations: TrackAnnotationsMap): Array<{ tag: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const ann of Object.values(annotations)) {
    for (const tag of ann.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
/**
 * trackAnnotations.ts — Phase Product Polish-K
 *
 * Browser-local tag + note storage for tracks.
 * Backed by localStorage under `mmx-studio:track-annotations:v1`.
 * Never synced to server. No schema migration.
 */

const ANNOTATIONS_KEY = 'mmx-studio:track-annotations:v1';
const MAX_TAGS = 12;
const MAX_TAG_LEN = 24;
const MAX_NOTE_LEN = 500;

export interface TrackAnnotation {
  trackId: string;
  tags: string[];
  note: string;
  updatedAt: string;
}

export type TrackAnnotationsMap = Record<string, TrackAnnotation>;

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
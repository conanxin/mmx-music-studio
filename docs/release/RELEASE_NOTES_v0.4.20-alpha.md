# mmx-music-studio v0.4.20-alpha

## What is this release?

This release adds **collection sharing links**, **batch tag cleanup**, and **browser-local annotation history**.

The Library can now preserve and share its current view state through URL query parameters, track local annotation changes over time, and include collection filter context in Markdown / JSON exports.

---

## Highlights

### Collection sharing links

- Added Library collection sharing links.
- Added URL query support for filter state:
  - `q`
  - `source`
  - `collection`
  - `tag`
- Added a "copy current collection link" action (uses `useSearchParams` + `{ replace: true }`).
- URLs do not include selected track IDs, notes, prompts, or any server-side secrets.

### Batch tag cleanup

- Added a **batch remove tag** action (case-insensitive match).
- Added four error-prompt cases for the batch tag UI.
- Library playback, download, and queue behaviour are unaffected.

### Browser-local annotation history

- Added annotation history localStorage key: `mmx-studio:annotation-history:v1`.
- History is capped at **300 entries** and remains browser-local.
- Added 7 action types:
  - `tag_added`
  - `tag_removed`
  - `batch_tag_added`
  - `batch_tag_removed`
  - `note_updated`
  - `backup_import_merge`
  - `backup_import_replace`
- Drawer shows the most recent 5 history entries for the active track.
- `notePreview` is truncated to 80 characters.

### Collection Markdown / JSON export enhanced

- Markdown export now includes:
  - collection URL
  - applied filters
- JSON export now includes:
  - collection URL
  - filters object
- No prompts, notes, tokens, raw IP, or source hashes are leaked.

### Local backup extended

- `LibraryLocalBackupV1` now includes `annotationHistory`.
- `meta.historyCount` is added to backup summary.
- Backward compatible with older v1.0 backups (no `annotationHistory` field = no action).

### Smoke test

- Added `scripts/product-polish-m-smoke-test.sh` (82 assertions, all PASS).

---

## Data model

### Annotation history (browser localStorage)

```
Key:    mmx-studio:annotation-history:v1
Cap:    300 entries
Scope:  browser-local only
Fields: action, trackId, actionAt, label, tagsAdded?, tagsRemoved?, notePreview?, source
```

### LibraryLocalBackupV1 (extended)

```ts
{
  version: '1.0',
  exportedAt: string,
  app: 'mmx-music-studio',
  data: {
    annotations: TrackAnnotationsMap,
    annotationHistory?: AnnotationHistoryEntry[],   // NEW (Phase M)
    favorites?: string[],
    promptTemplates?: unknown[],
    playbackQueue?: unknown,
    playbackProgress?: unknown,
  },
  meta: {
    annotationCount: number,
    favoriteCount: number,
    promptTemplateCount: number,
    historyCount: number,                            // NEW (Phase M)
  },
}
```

### CollectionFilters (new)

```ts
{
  q?: string,
  source?: 'all' | 'cli' | 'adapter',
  collection?: 'all' | 'tagged' | 'noted' | 'favorites' | 'recent',
  tag?: string,
  smartCollection?: 'tagged' | 'noted' | 'favorites' | 'recent',
}
```

---

## Safety and privacy

The collection URL does **not** include:

- selected track IDs
- notes
- prompts (full or partial)
- API keys
- tokens
- raw IP addresses
- source hashes
- server runtime paths

The annotation history does **not** include:

- full prompts
- API keys
- tokens
- raw IP addresses
- source hashes

The backup import is backward compatible: older v1.0 backups (no `annotationHistory`) are accepted without losing existing local annotation history.

---

## Current runtime

- Public URL: `https://music.conanxin.com`
- Backend: `cli`
- Library: `https://music.conanxin.com/library`
- Ops panel: `https://music.conanxin.com/ops`
- Launch Guard:
  - `enabled = true`
  - `publicGenerationEnabled = true`
  - `perSourceDailyLimit = 5`
  - `generationCooldownSeconds = 30`

---

## Notes

- **No music was generated for this release.**
- **No `/api/generate` request was made during validation.**
- **No server schema migration.**
- **No server upload of local data** (backup is browser-only).
- Local metadata remains browser-local.
- Library playback and queue behaviour are unaffected.
- This remains a public alpha.

---

## Known limitations

- Annotation history is browser-local only — no account sync.
- Collection links share filter state, not private local metadata.
- No server-side annotation history.
- No server-side annotation migration.

---

## Verification

- `product-polish-m-smoke-test.sh`: 82 / 82 PASS
- `product-polish-l-smoke-test.sh`: 67 / 67 PASS
- `product-polish-k-smoke-test.sh`: 37 / 37 PASS
- `product-polish-j` / `i` / `h` smoke: 31 / 38 / 35 PASS
- `ops-monitor-b` / `a` smoke: 36 / 27 PASS
- `launch-guard-a` smoke: 31 / 31 PASS
- `systemd-service` smoke: 26 / 26 PASS
- `storage-a` smoke: 38 / 38 PASS
- `readme-render` smoke: 14 / 14 PASS
- `api-adapter-async-polling-design` smoke: 25 / 25 PASS
- `npm run typecheck` + `typecheck:server`: clean
- `npm run build`: 67 modules, 343 KB JS
- `npm run weapp:build`: 4.25 s, code 0
- `python3 scripts/ci-secret-scan.py`: CLEAN (293 files)

---

## Upgrade notes

- **No breaking change**: previous v1.0 backup files can still be imported.
- **New localStorage key**: `mmx-studio:annotation-history:v1` is created on first annotation action.
- **Old tags preserved**: `v0.4.18-alpha` and `v0.4.19-alpha` were not moved.

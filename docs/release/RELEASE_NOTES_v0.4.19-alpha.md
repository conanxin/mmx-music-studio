# mmx-music-studio v0.4.19-alpha

## What is this release?

This release adds **collection export**, **batch Library actions**, and **browser-local backup / restore** for Library user data.

The Library can now work more like a real music asset management workspace: users can select multiple tracks, batch-add tags, export filtered or selected collections, and back up browser-local annotations and playback preferences.

## Highlights

- Added **Library batch mode**.
- Added **track checkbox selection**.
- Added **selected track count**.
- Added **select current list**.
- Added **clear selection**.
- Added **batch add tags** (max 12 tags per track, max 24 chars per tag, normalized duplicate detection).
- Added **current collection export**:
  - Markdown
  - JSON
- Added **selected tracks export**:
  - Markdown
  - JSON
- Added **local Library backup export**.
- Added **local Library backup import**.
- Added **merge import mode**.
- Added **replace import mode**.
- Added `LibraryLocalBackupV1` model (`src/lib/libraryBackup.ts`).
- Added **collection Markdown / JSON builders**.
- Added **safe export filename helpers** (`mmx-local-backup-YYYYMMDD-HHmm.json`, `mmx-collection-export-YYYYMMDD-HHmm.{md,json}`).
- Added **Product Polish-L smoke test** (`scripts/product-polish-l-smoke-test.sh`).
- Added **mobile adaptation** for batch toolbar, export buttons, backup panel.

## Local backup data

The local backup contains browser-local data only:

- `mmx-studio:track-annotations:v1`
- `mmx-studio:favorites`
- `mmx-studio:prompt-templates`
- `mmx-studio:playback-queue:v1`
- `mmx-studio:playback-progress:v1`

The backup does **not** include:

- Audio binaries
- Server runtime storage
- API keys
- Tokens
- Raw logs
- Raw IP addresses
- Source hashes
- Absolute runtime paths

## Current runtime

- **Public URL**: `https://music.conanxin.com`
- **Backend**: `cli`
- **Library**: `https://music.conanxin.com/library`
- **Ops panel**: `https://music.conanxin.com/ops`
- **Launch Guard**:
  - `enabled=true`
  - `publicGenerationEnabled=true`
  - `perSourceDailyLimit=5`
  - `generationCooldownSeconds=30`

## Notes

- **No music was generated for this release.**
- **No `/api/generate` request was made during validation.**
- **No server schema migration.**
- Local backup import/export only changes browser localStorage.
- Library playback and queue behavior are unaffected.
- This remains a **public alpha**.

## Known limitations

- Local backups are **manual** (no automatic export).
- Backups are **not synced across devices**.
- **No account-level private metadata.**
- **No server-side annotation backup.**
- **No collection sharing URL yet.**
- Replace import mode does not clear the playback queue (intentional safety choice).

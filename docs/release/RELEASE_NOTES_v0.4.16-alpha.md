# mmx-music-studio v0.4.16-alpha

**Release date:** 2026-06-10
**Public URL:** https://music.conanxin.com
**Backend:** CLI

---

## What is this release?

This release adds storage management and cleanup planning for the public alpha deployment. It introduces read-only storage inventory, retention dry-run, and backup manifest tooling so operators can understand storage growth before making any cleanup decision.

---

## Highlights

### Storage Management

- **Storage inventory helper** (`server/storage-maintenance.ts`):
  - Track count, audio file count, approximate audio bytes
  - Orphan audio detection, missing audio detection
  - Readable output for operator review

- **Retention dry-run helper**:
  - Configurable retention window (default 90 days, operator-overridable via `RETENTION_DAYS`)
  - Candidate list without deletion
  - Reason classification: `metadata missing`, `age exceeds retention`, `orphan audio file`
  - Safe output: no prompts, tokens, or absolute paths exposed

- **Backup manifest helper**:
  - Lightweight JSON snapshot (track count, audio file count, bytes)
  - Safe for external storage: excludes raw audio content, prompts, and tokens

### Scripts

- `scripts/storage-a-inventory-report.sh` — human-readable inventory summary
- `scripts/storage-a-retention-dry-run.sh` — retention dry-run with configurable days
- `scripts/storage-a-backup-manifest.sh` — JSON backup manifest to stdout

### Documentation

- New `docs/STORAGE_POLICY.md` — storage categories, retention proposal, safety rules
- Updated `docs/OPS_MONITORING.md` — storage command reference
- Updated `docs/DEVELOPMENT_HANDOFF.md` — v0.4.16-alpha status
- Updated `docs/PUBLIC_RELEASE_READINESS.md` — storage management section

---

## Safety Model

- **No files are deleted automatically** — all cleanup logic is dry-run only
- **Retention logic is dry-run only** — cleanup requires future operator confirmation
- **Runtime storage is not committed** — no storage/tracks/, storage/quota/, or storage/audit/ in git
- **Public outputs avoid** raw filesystem paths, prompts, API keys, tokens, and raw logs

---

## Current Observed Storage

| Metric | Value |
|--------|-------|
| Track count | 300 |
| Audio file count | 300 |
| Approximate audio size | ~114 MB |
| Orphan audio files | 0 |
| Missing audio files | 0 |
| 30-day retention dry-run candidates | 0 |

---

## Current Runtime

- **Public URL:** https://music.conanxin.com
- **Backend:** CLI
- **Launch Guard:** enabled
- **Public runtime diagnostics:** enabled
- **Storage aggregate:** trackCount 300, audioFileCount 300, approxAudioBytes 119543624

---

## Notes

- No music was generated for this release.
- No `/api/generate` request was made during validation.
- This release does not implement destructive cleanup.
- Storage-B may add operator-confirmed cleanup later.

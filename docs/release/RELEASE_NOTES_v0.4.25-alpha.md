# mmx-music-studio v0.4.25-alpha

> **Release date:** 2026-06-11
> **Theme:** Storage-B0 operator cleanup dry-run and safety design
> **Status:** Pre-release alpha · dry-run only · no files deleted

## What is this release?

This release promotes **Phase Storage-B0** into the release line. Storage-B0 is a
**non-destructive storage hygiene phase**. It adds:

1. A read-only **storage cleanup dry-run script** that inventories storage and
   reports cleanup candidate categories.
2. A **confirmation guard script** that enforces the exact required confirmation
   phrase (`CONFIRM_STORAGE_B_CLEANUP`) for any future operator-confirmed cleanup.
3. A **Storage-B0 design document** that defines cleanup candidate categories,
   the never-delete list, the required report structure, and the human confirmation
   protocol.
4. A **Storage-B0 smoke test** (59/59 PASS) that asserts the dry-run and guard
   scripts are non-destructive, executable, and have no executable references to
   the protected generation endpoint.

**This release does not delete any file.**

## Highlights

- Added **Storage-B0 operator cleanup safety design** (`docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md`).
- Added read-only **storage cleanup dry-run script** (`scripts/storage-b-operator-cleanup-dry-run.sh`).
  - Default mode: scan only, no flag required.
  - Optional `--retention-days N` flag (no destructive effect).
  - Optional `--json <path>` flag (writes a manifest to a path the operator chooses).
- Added **confirmation guard** for future Storage-B1 (`scripts/storage-b-confirmation-guard.sh`).
  - Rejects by default (no `STORAGE_B_CONFIRMATION` set, or wrong phrase).
  - Accepts the exact phrase `CONFIRM_STORAGE_B_CLEANUP` (case-sensitive).
  - Even when accepted, the guard does NOT delete any file (B0 invariant).
- Added **Storage-B0 smoke test** (`scripts/storage-b-smoke-test.sh`, 59/59 PASS).
- Added **storage candidate reporting** for:
  - orphan audio files (audio on disk with no metadata reference)
  - orphan metadata files (metadata with no audio on disk)
  - missing audio references (metadata pointing to absent audio)
  - old track candidates (only when `--retention-days` is provided)
- Added **dry-run JSON manifest** with:
  - `destructive: false`
  - `candidates` (per-category arrays)
  - `estimatedReclaimableBytes`
  - `counts` (per-category totals)
- Added **exact confirmation phrase** for any future cleanup:
  `CONFIRM_STORAGE_B_CLEANUP` (must be passed via `STORAGE_B_CONFIRMATION` env var).
- Restored **Product Polish-N smoke coverage** by fixing a historical handoff doc
  drift (Product Polish-N now appears explicitly in `DEVELOPMENT_HANDOFF.md`).
  Product Polish-N smoke: 55/55 PASS.

## Current storage inventory (Storage-B0 dry-run)

| Item | Value |
|------|-------|
| Audio files on disk | 300 |
| Orphan audio | 0 |
| Orphan metadata | 0 |
| Missing audio references | 0 |
| Old track candidates | 0 (retention window not provided) |
| Estimated reclaimable bytes | 0 |
| Destructive mode | **false** |

## Current runtime

- **Public URL:** https://music.conanxin.com
- **Backend:** `cli` (recommended)
- **Library:** https://music.conanxin.com/library
- **Ops panel:** https://music.conanxin.com/ops
- `/ops` is protected by **Cloudflare Access**.
- `/api/status` is protected by **Cloudflare Access**.
- `/api/health` remains **public**.
- `/api/generate` remains protected by **Launch Guard** (Phase Launch Guard-A).
- `storage/` runtime data is **not committed**.

## Safety and privacy

Storage-B0 is read-only by construction and verified by smoke tests.

The dry-run script:

- **never** deletes files
- **never** modifies audio storage
- **never** truncates files
- **never** calls `/api/generate`
- **never** generates music
- **never** changes server schemas
- **never** commits runtime storage
- **never** exposes tokens or logs

The dry-run script reports candidates only. **Future cleanup requires explicit
operator confirmation AND a reviewed manifest** — both are preconditions for any
hypothetical Storage-B1 phase.

## Notes

- No cleanup was executed in this release.
- No music was generated for this release.
- No server schema migration.
- Historical tags (v0.4.0-alpha through v0.4.24-alpha) were not moved.
- Phase Polish-N smoke is green again.

## Files added in this release

```
docs/release/RELEASE_NOTES_v0.4.25-alpha.md              (this file)
docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md        (design doc)
scripts/storage-b-operator-cleanup-dry-run.sh            (read-only dry-run)
scripts/storage-b-confirmation-guard.sh                  (confirmation guard)
scripts/storage-b-smoke-test.sh                          (smoke test, 59/59)
```

## What's next

- **Phase Storage-B1** — only proceed if real candidates appear AND the operator
  reviews and approves the Storage-B0 manifest. **Not urgent** at the moment:
  current dry-run shows zero candidates.
- **Phase Deploy-CF-D** — optional Turnstile on `/api/generate` or broader
  Cloudflare Access coverage.
- **Phase Product Polish-Q** — optional next round of UI polish.

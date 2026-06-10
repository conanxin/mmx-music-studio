# mmx-music-studio v0.4.22-alpha

## What is this release?

This release improves Library annotation workflows with a richer annotation
timeline, a Library-wide history panel, batch note editing, and UI polish for
browser-local music asset management.

It also includes the Release workflow reliability fix after v0.4.21-alpha,
removing the `--verify-tag` flag that caused GitHub Actions `GITHUB_TOKEN`
release creation to fail.

## Highlights

- **Added per-track annotation timeline** in the Library drawer.
  - Timeline defaults to 5 entries and can expand to the full local history.
  - 查看全部 / 收起 controls.
- **Added action badges** for annotation events:
  - tag added
  - tag removed
  - batch tag added
  - batch tag removed
  - note updated
  - backup import merge
  - backup import replace
- **Added Library-wide annotation history panel** (`标注历史总览`).
  - Library history panel shows the latest 20 browser-local annotation events.
  - Collapsible; explicit "read-only" notice; no "清空" button.
- **Added history filters**:
  - 全部
  - 标签变更
  - 备注变更
  - 导入
- **Added batch note editing**:
  - overwrite mode (覆盖备注)
  - append mode (追加到备注)
  - 500-character note cap
  - Batch note edits record `note_updated` annotation history with all
    selected trackIds.
- **Improved mobile layout** (≤639px) for timeline, batch note controls, and
  history filters (horizontal scroll for filter chips, full-width textarea).
- **Added Product Polish-N smoke test** (`scripts/product-polish-n-smoke-test.sh`,
  55/55 PASS).
- **Updated Product Polish-M smoke compatibility** (accepts both
  `TrackHistoryList`/`最近标注历史` and the new
  `TrackHistoryTimeline`/`标注时间线` naming).
- **Included Release workflow fix**:
  - removed `gh release create --verify-tag` (401 with `${{ github.token }}`)
  - kept automatic GitHub Release workflow operational
  - manual fallback documented in skill `github-actions-release-automation` Pitfall 4

## Data model

Annotation history remains browser-local:

- `mmx-studio:annotation-history:v1`
- History remains capped at 300 entries.
- Notes remain capped at 500 characters.
- Note previews remain capped at 80 characters.
- No server storage, no schema migration.

## Library backup v1.0

- `LibraryLocalBackupV1.annotationHistory` field already in place from v0.4.20-alpha.
- Older v1.0 backups without `annotationHistory` still importable.
- Import via merge (additive, dedupe by id) or replace.
- The import itself records a `backup_import_merge` or `backup_import_replace`
  history entry per imported track.

## Safety and privacy

This release does not change server storage or schemas.

Annotation history does not store:
- API keys
- tokens
- raw IP addresses
- source hashes
- raw logs
- server paths

## Notes

- No music was generated for this release.
- No `/api/generate` request was made during validation.
- No server schema migration.
- All annotation timeline and batch note data remains browser-local.
- Library playback and queue behavior are unaffected.
- This remains a public alpha.

## Current runtime

- **Public URL:** https://music.conanxin.com
- **Backend:** cli
- **Library:** https://music.conanxin.com/library
- **Ops panel:** https://music.conanxin.com/ops
- `/ops` is protected by Cloudflare Access.
- `/api/status` is protected by Cloudflare Access.
- `/api/health` remains public.

### Launch Guard (current)

- `enabled=true`
- `publicGenerationEnabled=true`
- `perSourceDailyLimit=5`
- `generationCooldownSeconds=30`

## Known limitations

- Annotation history remains browser-local only.
- No cross-device annotation sync.
- No server-side annotation history.
- No account-level private metadata.

## Verifying

After upgrade, the public alpha continues to work. Operator workflows require
Cloudflare Access login at the existing `MMX Music Studio Ops` application.

```bash
# Public paths (expect 200)
curl -I https://music.conanxin.com
curl -I https://music.conanxin.com/library
curl -I https://music.conanxin.com/api/health

# Protected paths (expect 302 to Cloudflare Access login)
curl -I https://music.conanxin.com/ops
curl -I https://music.conanxin.com/api/status
```

## Next recommended phases

- **Phase Product Polish-O** — follow-up UX polish.
- **Phase Storage-B operator-confirmed cleanup** — operator-driven cleanup of
  `storage/guard/`, `storage/tracks/`, `storage/quota/`, `storage/audit/`
  (no auto delete; dry-run manifest; human confirmation required).
- **Phase Deploy-CF-D** (optional) — broader Cloudflare Access / Turnstile
  coverage if desired.

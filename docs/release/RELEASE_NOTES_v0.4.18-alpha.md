# mmx-music-studio v0.4.18-alpha

## What is this release?

This release adds browser-local tags, notes, and smart collections to the Library.

The Library now works more like a music asset library: users can annotate generated tracks, search by tags and notes, filter by smart collections, and export richer Markdown track information.

## Highlights

- **Browser-local track annotations** — `mmx-studio:track-annotations:v1` localStorage key
- **Tags for Library tracks** — max 12 tags per track, max 24 chars per tag, normalized duplicate detection
- **Notes for Library tracks** — max 500 characters
- **Annotation editor in the Library detail drawer** — tag input, chip delete, note textarea, save with toast
- **Tag chips and note status on track cards** — up to 3 chips shown per card
- **Enhanced Library search** — now includes tags and notes
- **Smart collections** — 有标签, 有备注, 最近生成, CLI 生成, API 生成
- **Tag filter chips with counts** — up to 12 most-used tags, click to filter
- **Enhanced Markdown export** — includes Tags and Notes sections

## Data model

Track annotations are stored in browser localStorage:

```
mmx-studio:track-annotations:v1
```

Annotations are **not** synced across browsers and are **not** uploaded to the server. No server schema migration.

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: CLI
- Ops panel: https://music.conanxin.com/ops
- Library: https://music.conanxin.com/library
- Launch Guard: `enabled=true`, `publicGenerationEnabled=true`, `perSourceDailyLimit=5`, `generationCooldownSeconds=30`

## Notes

- No music was generated for this release. No `/api/generate` request was made during validation.
- CLI backend remains the recommended default path.
- BYOK API Adapter remains real-call verified but experimental.
- This remains a public alpha.

## Known limitations

- Tags and notes are browser-local only. No cross-device sync.
- No account-level private metadata.
- No server-side annotation schema yet.
- Library playback and queues are unaffected by annotation changes.
# mmx-music-studio v0.4.23-alpha

## What is this release?

This release polishes the Library experience after the annotation timeline and
batch note editing work. The Library now has clearer current-view summaries,
better empty states, grouped batch controls, improved drawer hierarchy,
clearer timeline hints, and stronger mobile layout consistency.

## Highlights

- Added current Library view summary.
- Added clear all filters action.
  - Current view summary includes:
    - source filter
    - smart collection
    - tag filter
    - search query
    - filtered track count
- Added better empty states for:
  - search results
  - smart collections
  - tag filters
  - favorites
  - batch mode selection
  - annotation history
- Grouped batch toolbar into:
  - 选择
  - 批量标注
  - 导出
- Improved Library drawer hierarchy:
  - 标签与备注 section
  - clearer spacing
  - timeline hint copy
- Improved annotation timeline readability.
- Improved collection link / export / local backup clarification copy.
- Improved dark visual consistency and mobile layout.
- Added Product Polish-O smoke test.

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: `cli`
- Library: https://music.conanxin.com/library
- Ops panel: https://music.conanxin.com/ops
- `/ops` is protected by Cloudflare Access.
- `/api/status` is protected by Cloudflare Access.
- `/api/health` remains public.
- Launch Guard:
  - `enabled=true`
  - `publicGenerationEnabled=true`
  - `perSourceDailyLimit=5`
  - `generationCooldownSeconds=30`

## Safety and privacy

This release is a front-end Library polish release. It does **not**:

- change server schemas
- upload local annotations
- modify audio storage
- call `/api/generate`
- generate music

Local Library data remains browser-local.

## Notes

- No music was generated for this release.
- No `/api/generate` request was made during validation.
- No server schema migration.
- Library playback and queue behavior are unaffected.
- This remains a public alpha.

# mmx-music-studio v0.4.24-alpha

## What is this release?

This release improves Library interaction consistency after the previous
Library UX polish releases. The Library now has removable active filter chips,
per-filter clear actions, search match hints, clearer batch operation scope
hints, stronger timeline accessibility, and mobile/visual refinements.

### Highlights

- Added removable active filter chips for:
  - source
  - smart collection
  - tag
  - search
- Added per-filter clear actions:
  - clear search
  - clear source filter
  - clear collection filter
  - clear tag filter
- Added search match hints on track cards.
  - Match hints can indicate:
    - title
    - prompt
    - lyrics
    - mode
    - source
    - tags
    - notes
  - Search match hints show categories only, not full prompt or note text.
- Added batch operation scope hint.
  - When tracks are selected, the hint shows the scope of batch operations.
  - When no track is selected, the hint guides the user to pick tracks first.
- Improved disabled states for batch actions.
- Improved timeline filter accessibility.
  - role / aria-label / title consistency
  - keyboard-friendly focus states
- Added aria-label / title / aria-pressed polish for key Library controls.
- Improved mobile layout for filter chips, batch scope hints, and timeline filters.
- Added Product Polish-P smoke test.

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: cli
- Library: https://music.conanxin.com/library
- Ops panel: https://music.conanxin.com/ops
- /ops is protected by Cloudflare Access.
- /api/status is protected by Cloudflare Access.
- /api/health remains public.

## Launch Guard

- enabled=true
- publicGenerationEnabled=true
- perSourceDailyLimit=5
- generationCooldownSeconds=30

## Safety and privacy

This release is a front-end Library interaction polish release.
It does not:

- change server schemas
- upload local annotations
- modify audio storage
- call /api/generate
- generate music

Search match hints only show match categories. They do not expose full prompt
or note text beyond the existing local UI.

Local Library data remains browser-local.

## Notes

- No music was generated for this release.
- No /api/generate request was made during validation.
- No server schema migration.
- Library playback and queue behavior are unaffected.
- This remains a public alpha.

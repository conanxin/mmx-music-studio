# mmx-music-studio v0.4.13-alpha

## What is this release?

This release adds public launch readiness and trust UX.

The app is now easier for first-time visitors to understand: what it does, which generation path is recommended, where local data is stored, what remains experimental, and how users can report issues.

## Highlights

- Added **Public Alpha** launch readiness section on Home with 4 cards: Real Generation / Library / Local Experience / Experimental Capabilities
- Added **Trust and Data Notes**: browser localStorage data, server-side generated track records, BYOK API key handling, alpha limitations
- Added **Feedback and Version section**: current release badge, GitHub Issues link, GitHub repository link, Release Notes link
- Updated Home status card version to `v0.4.12-alpha`
- Added responsive layout for launch / trust / feedback sections (639px single column, 389px full width)
- Added `docs/PUBLIC_RELEASE_READINESS.md`
- Added `scripts/product-polish-j-smoke-test.sh` (31 assertions)

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: `cli` (recommended default)
- systemd service: active
- Cloudflare Tunnel: active

## Notes

- This is still an **alpha** release.
- CLI backend remains the recommended default path.
- BYOK API Adapter is real-call verified but experimental.
- Async polling readiness is implemented, but real polling is not enabled until the official endpoint is confirmed.
- Favorites, prompt templates, playback queue, and playback progress are stored in browser localStorage.
- **No new generation is performed for this release.**

## Known limitations

- Cloudflare Access is not enabled.
- No account system.
- No cross-device sync.
- BYOK API Adapter remains experimental.
- Generated track records are server-side for Library use.

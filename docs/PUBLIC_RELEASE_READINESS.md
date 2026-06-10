# Public Release Readiness — mmx-music-studio

> 文档版本：v0.4.12-alpha · 2026-06-10

## Current Public URL

**https://music.conanxin.com**

## Current Release

**v0.4.12-alpha** — API Adapter async polling readiness

## What is Ready

- CLI backend generation (MMX CLI — recommended default)
- Studio prompt templates
- Library: search, favorites, details, sharing, Markdown export
- Global mini player
- Persistent playback queue with 4 modes
- Playback progress memory (localStorage)
- BYOK API Adapter `direct_audio` verified once
- Async polling readiness (types + Studio error UX)
- HTTPS via Cloudflare Tunnel

## What Remains Alpha / Experimental

| Item | Status |
|------|--------|
| BYOK API Adapter | Experimental — verified `direct_audio` once |
| Async polling | Design-only — endpoint not confirmed |
| Cloudflare Access | Not enabled |
| Queue / local preferences | Browser-local only, no cross-device sync |
| Account system | None |
| Production SLA | None |

## Data Notes

| Data type | Storage | Notes |
|-----------|---------|-------|
| Favorites | Browser localStorage | `mmx-studio:favorites` |
| Prompt templates | Browser localStorage | `mmx-studio:prompt-templates` |
| Playback queue | Browser localStorage | `mmx-studio:playback-queue:v1` |
| Playback progress | Browser localStorage | `mmx-studio:playback-progress:v1` |
| Generated track metadata | Server-side | For Library display and playback |
| BYOK API keys | Memory only | Not written to disk; 30-min TTL |

## Pre-Launch Checklist

- [x] Public URL returns HTTP 200
- [x] `/api/health` backend is `cli`
- [x] Secret scan is clean
- [x] Typecheck passes
- [x] Build passes
- [x] WeApp build passes
- [x] Product smoke tests pass (A–I)
- [x] API adapter smoke tests pass
- [x] systemd service smoke passes
- [x] Release notes available
- [ ] GitHub Release manually uploaded (zip asset)

## Feedback Channels

- **Issues:** https://github.com/conanxin/mmx-music-studio/issues
- **Source:** https://github.com/conanxin/mmx-music-studio
- **Release Notes:** https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.12-alpha
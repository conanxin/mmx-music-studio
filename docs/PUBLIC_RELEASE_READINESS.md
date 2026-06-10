# Public Release Readiness — mmx-music-studio

> 文档版本：v0.4.14-alpha · 2026-06-10

## Current Public URL

**https://music.conanxin.com**

## Current Release

**v0.4.14-alpha** — Protected public generation release (Phase Launch Guard-A)

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
- Public generation guardrails (Phase Launch Guard-A)
- Public runtime diagnostics (Phase Ops-Monitor-A: `/api/health` + `/api/status`)

## What Remains Alpha / Experimental

| Item | Status |
|------|--------|
| BYOK API Adapter | Experimental — verified `direct_audio` once |
| Async polling | Design-only — endpoint not confirmed |
| Cloudflare Access | Not enabled |
| Queue / local preferences | Browser-local only, no cross-device sync |
| Account system | None |
| Production SLA | None |

## Public Generation Guardrails

The public deployment includes lightweight generation guardrails (Phase Launch Guard-A):

- `PUBLIC_GENERATION_ENABLED=false` can pause public generation without disabling Library or playback
- `PER_SOURCE_DAILY_GENERATION_LIMIT` enforces a per-source daily generation cap (default: 5)
- `GENERATION_COOLDOWN_SECONDS` enforces a minimum interval between generations from the same source (default: 30s)
- Source identification uses SHA256 hashing (`cf-connecting-ip` / `x-forwarded-for` / `remoteAddress`) — raw IP addresses are never stored
- Guard state is stored in `storage/guard/public-generation-guard.json` (gitignored, atomic write with `.tmp` + rename)
- Daily auto-reset at midnight

These guardrails are intended for public alpha protection. They are not a replacement for accounts, billing, or full abuse-prevention infrastructure.

### /api/health Guard Fields

```json
{
  "launchGuardEnabled": true,
  "publicGenerationEnabled": true,
  "perSourceDailyLimit": 5,
  "generationCooldownSeconds": 30
}
```

### Error Codes

- `public_generation_paused` — global generation pause active
- `per_source_daily_limit_exceeded` — source reached daily cap
- `generation_cooldown_active` — source must wait before next generation

## Data Notes

| Data type | Storage | Notes |
|-----------|---------|-------|
| Favorites | Browser localStorage | `mmx-studio:favorites` |
| Prompt templates | Browser localStorage | `mmx-studio:prompt-templates` |
| Playback queue | Browser localStorage | `mmx-studio:playback-queue:v1` |
| Playback progress | Browser localStorage | `mmx-studio:playback-progress:v1` |
| Generated track metadata | Server-side | For Library display and playback |
| BYOK API keys | Memory only | Not written to disk; 30-min TTL |
| Guard state | `storage/guard/public-generation-guard.json` | SHA256 source hash, no raw IPs |

## Pre-Launch Checklist

- [x] Public URL returns HTTP 200
- [x] `/api/health` backend is `cli`
- [x] Secret scan is clean
- [x] Typecheck passes
- [x] Build passes
- [x] WeApp build passes
- [x] Product smoke tests pass (A–J)
- [x] API adapter smoke tests pass
- [x] systemd service smoke passes
- [x] Launch Guard enabled
- [x] `/api/health` exposes guard status
- [x] No runtime guard state committed
- [x] Release notes available
- [ ] GitHub Release manually uploaded (zip asset)

## Feedback Channels

- **Issues:** https://github.com/conanxin/mmx-music-studio/issues
- **Source:** https://github.com/conanxin/mmx-music-studio
- **Release Notes:** https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.13-alpha
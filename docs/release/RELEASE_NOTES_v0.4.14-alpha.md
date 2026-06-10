# mmx-music-studio v0.4.14-alpha

## What is this release?

This release adds **protected public generation guardrails** for the public alpha deployment.

The app can now remain publicly accessible while protecting the real generation entry point with lightweight source-based limits, cooldowns, and a global public generation pause switch.

## Highlights

- Added **public generation guardrails** (Phase Launch Guard-A)
- Added **global public generation pause**: `PUBLIC_GENERATION_ENABLED=false` — pauses public generation without disabling Library or playback
- Added **per-source daily generation limit**: `PER_SOURCE_DAILY_GENERATION_LIMIT=5` — counts by SHA256 source hash
- Added **generation cooldown**: `GENERATION_COOLDOWN_SECONDS=30` — minimum interval between generations from the same source
- Added **Launch Guard config switch**: `PUBLIC_GENERATION_GUARD_ENABLED=true`
- Source identifiers are stored as SHA256 hashes, not raw IP addresses
- Guard state uses atomic writes (`.tmp` + rename) and daily auto-reset at midnight
- Guard only applies to `/api/generate` — Library, playback, sharing, and export remain available
- Studio now shows clearer guardrail error states (`public_generation_paused`, `per_source_daily_limit_exceeded`, `generation_cooldown_active`)
- Home / Trust UX now explains public alpha generation protection
- `/api/health` exposes guard status fields: `launchGuardEnabled`, `publicGenerationEnabled`, `perSourceDailyLimit`, `generationCooldownSeconds`
- systemd service and smoke tests now validate Launch Guard settings

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: `cli` (recommended default)
- systemd service: active
- Cloudflare Tunnel: active
- Launch Guard (from `/api/health`):
  - `launchGuardEnabled: true`
  - `publicGenerationEnabled: true`
  - `perSourceDailyLimit: 5`
  - `generationCooldownSeconds: 30`

## Notes

- **No music was generated for this release.**
- No `/api/generate` request was made during validation.
- This is a **lightweight public alpha guardrail**, not a full account, billing, or abuse-prevention system.
- CLI backend remains the recommended default path.
- BYOK API Adapter remains real-call verified but experimental.

## Known limitations

- No account system.
- No per-user private Library.
- No billing or usage ownership model.
- Cloudflare Access is not enabled.
- Guard is source-based; browser/user identity is not authenticated.
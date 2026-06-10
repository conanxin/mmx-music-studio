# mmx-music-studio v0.4.17-alpha

## What is this release?

This release adds a read-only operations panel for public alpha runtime diagnostics.

The app now includes an `/ops` page that summarizes safe runtime information from `/api/health` and `/api/status`, helping maintainers quickly understand service health without using shell commands.

## Highlights

- **Read-only operations panel** at `/ops`
- **Navigation entry**: "运维" tab in the top navigation bar
- **Home entry**: link to the Ops panel from the Home page
- **Service status card**: public URL, backend mode, generation flags, timestamp
- **Launch Guard card**: enabled/disabled, per-source daily limit, cooldown seconds
- **Job queue card**: pending, running, succeeded, failed counts with status badges
- **Storage card**: track count, audio count, approximate bytes (human-readable)
- **Release card**: current version, GitHub repo and releases links
- **Copyable diagnostics summary**: clipboard copy of the full ops summary
- **Manual refresh** button + **30-second auto-refresh**
- **Loading and error states** for both `/api/health` and `/api/status`
- **Responsive mobile layout** (single-column below 639px, full-width buttons below 390px)
- **Ops-Monitor-B smoke test** covering all panels, safety guarantees, and doc coverage

## Safety model

The Ops panel is **read-only** — it only makes GET requests to `/api/health` and `/api/status`.

It does **not** perform:
- Generation (`/api/generate`)
- Cleanup or deletion
- Reset or restart

It does **not** expose:
- Raw IP addresses
- Source hashes
- Prompts
- API keys or tokens
- Raw logs
- Absolute runtime paths

## Current observed runtime

- **Public URL**: https://music.conanxin.com
- **Ops panel**: https://music.conanxin.com/ops
- **Backend**: `cli`
- **Launch Guard**: `enabled`, `publicGenerationEnabled=true`, `perSourceDailyLimit=5`, `generationCooldownSeconds=30`
- **Job Queue**: `pending=0`, `running=0`, `succeeded=57`, `failed=46`
- **Storage**: `trackCount=300`, `audioFileCount=300`, `approxAudioBytes=119543624` (~114 MB)

## Notes

- No music was generated during this release cycle.
- No `/api/generate` request was made during validation.
- CLI backend remains the recommended default path.
- BYOK API Adapter remains real-call verified but experimental.
- This is a public alpha operations aid — not a production SaaS admin console.
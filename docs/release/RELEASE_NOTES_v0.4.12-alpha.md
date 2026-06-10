# mmx-music-studio v0.4.12-alpha

## What is this release?

This release adds async task / polling readiness for the BYOK API Adapter.

The real BYOK API path has already been verified with a `direct_audio` response. This release prepares the codebase for a future MiniMax response shape that may return an async task id, without guessing or calling any unconfirmed polling endpoint.

## Highlights

- Added async task status type design for MiniMax API Adapter (`server/adapters/minimax-api/polling.ts`)
- Added `normalizeMiniMaxTaskStatus()` — maps all MiniMax async task status variants to a unified enum
- Added `parseAsyncTaskReference()` — defensive parser for task id extraction
- Added `pollingEndpointConfigured: false` — explicit design flag documenting the unconfirmed endpoint
- Added defensive async task mock fixtures: `processing`, `succeeded`, `failed`
- Studio now has a clearer "async polling required" error state with actionable hint
- Added async polling design smoke test (25 assertions)

## Documentation

- `API_ADAPTER_DEBUG_REPORT.md` — async polling section marked ✅ Addressed
- `BYOK_REAL_TEST_PLAN.md` — Phase API-Debug-E entry with design rationale
- `README.md` — Async API polling ✅ Design row added
- `DEVELOPMENT_HANDOFF.md` — Phase API-Debug-E section with polling design details

## Current API Adapter status

| Path | Status |
|------|--------|
| `direct_audio` | real-call verified |
| `hex_audio` | contract-tested |
| `async_task` | defensive parser and UX path ready |
| `real polling` | not implemented until official endpoint is confirmed |

## Current runtime

- Public URL: https://music.conanxin.com
- Backend: `cli` (recommended default)
- systemd service: active
- Cloudflare Tunnel: active

## Notes

- **No new generation is performed for this release.**
- **No real MiniMax API request is made for this release.**
- CLI backend remains the recommended default path.
- BYOK API Adapter remains real-call verified but experimental.

## Known limitations

- MiniMax Music Generation polling endpoint is not confirmed.
- Bounded polling will be implemented later if an official status endpoint is available.
- Cloudflare Access is not enabled.
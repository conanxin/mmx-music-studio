# mmx-music-studio v0.4.1-alpha

**Release date:** 2026-06-09
**Tag:** `v0.4.1-alpha`
**Commit:** `4796aaa` (Phase CLI-Web-G)

---

## What is this release?

This is the **Web CLI main path stabilization release**.

It confirms that the Web app can use the **MMX CLI backend** as the recommended working generation path, matching the Telegram/Hermes CLI route that has already been proven to generate music successfully.

This is a **read-only / stability release** — no new real generation is performed. The goal is to solidify the Web + CLI path, fix the Studio player UX bugs, and clarify documentation before the next feature cycle.

---

## What was fixed?

### 1. Studio player cold-start hydration
**Problem:** When a user opened the Studio page, the right-side player was empty — no track, no audio, no duration — even though there were previously generated tracks available.

**Fix:** Added a `useEffect` in `Studio.tsx` that fires on mount, calls `listTracks()` (or falls back to `listJobsFiltered()`), and hydrates the player with the latest track. The user sees their latest work immediately on page load.

### 2. Studio player handoff after generation
**Problem:** After clicking "Generate", the player stayed empty even though the generation completed. The track was saved to storage, but the player wasn't updated.

**Fix:** `playerHandoff()` now receives the full track object with `audioUrl` and `downloadUrl`, so the player can render the waveform, duration, and download button correctly after generation.

### 3. Audio duration display from metadata
**Problem:** The player showed `?:??` instead of the real track duration.

**Fix:** `WaveformPlayer.tsx` now listens for the HTMLAudioElement `loadedmetadata` event and reads `audio.duration` directly. `Studio.tsx` and `Library.tsx` no longer inject `'?:??'` as a hardcoded fallback — the WaveformPlayer handles `undefined` → "读取中" during loading.

---

## What was added?

- `scripts/cli-web-readonly-smoke-test.sh` — 20-case read-only smoke test for the full Web CLI path
- `scripts/studio-initial-player-hydration-smoke-test.sh` — 15-case hydration smoke test
- `scripts/studio-player-handoff-smoke-test.sh` — 17-case handoff smoke test
- `scripts/audio-duration-display-smoke-test.sh` — 11-case duration display smoke test
- `docs/MINIMAX_BACKEND_DIAGNOSIS.md` — Updated with Post-CLI-Web-G status
- `docs/BYOK_MODE.md` — Updated with CLI as recommended path, BYOK as experimental
- `docs/DEVELOPMENT_HANDOFF.md` — Backend table updated

---

## Verified

| Check | Result |
|---|---|
| `npm run typecheck:server` | ✅ PASS |
| `npm run typecheck` | ✅ PASS |
| `npm run build` | ✅ PASS |
| `npm run weapp:typecheck` | ✅ PASS |
| `npm run weapp:build` | ✅ PASS |
| `cli-web-readonly-smoke-test.sh` | ✅ All passed |
| `studio-initial-player-hydration-smoke-test.sh` | ✅ 15/15 PASS |
| `studio-player-handoff-smoke-test.sh` | ✅ 17/17 PASS |
| `audio-duration-display-smoke-test.sh` | ✅ 11/11 PASS |
| `studio-cli-submit-guard-smoke-test.sh` | ✅ PASS |
| `byok-mode-smoke-test.sh` | ✅ PASS |
| `real-api-attempt-guard-smoke-test.sh` | ✅ PASS |
| Secret scan | ✅ CLEAN |

---

## Not included in this release

- **No new real generation** is performed during this release.
- **API Adapter real generation** is not claimed as stable. The BYOK API Adapter path remains experimental.
- **Multi-user hosted production mode** is not yet implemented.
- **Tencent Cloud ICP recordal** is still required for mainland custom-domain public access.

---

## Recommended usage

For **personal self-hosted** usage:

```bash
# Environment variables for CLI backend
PREVIEW_ACCESS_ENABLED=false
REAL_GENERATION_ENABLED=true
MOCK_GENERATION_ENABLED=false
MINIMAX_BACKEND=cli
GENERATION_ACCESS_ENABLED=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=3
DAILY_QUOTA_ENABLED=true
DAILY_GENERATION_LIMIT=20
```

Access the Web UI via SSH Tunnel (`ssh -L8787:127.0.0.1:8787 user@host`) or a properly protected deployment.

---

## Backend path summary

| Path | Status | Notes |
|---|---|---|
| **MMX CLI backend (`backend=cli`)** | ✅ Recommended | Web + CLI, same as Telegram/Hermes route |
| **BYOK API Adapter** | ⚠️ Experimental | Research / non-production |
| **BYOK API real generation** | ⚠️ Not stable | Should be tested independently |

---

## Known limitations

- ICP recordal is still required for mainland Tencent Cloud custom-domain public access
- API Adapter remains experimental
- BYOK API real generation should be tested separately before relying on it
# Phase API-Debug-C Real BYOK API Call Report

**Date:** 2026-06-09
**Status:** ✅ PASS
**Phase:** API-Debug-C-Observe

---

## Summary

One controlled real MiniMax API generation was completed via the Web UI → BYOK → API Adapter path.

| Field | Value |
|-------|-------|
| **User clicked Generate** | Yes (once) |
| **Server backend** | `api` |
| **BYOK enabled** | `true` |
| **Server key fallback** | `false` |
| **Real API attempt limit** | `1` |
| **Result** | **✅ succeeded** |

---

## Observed Result

### Job Record

| Field | Value |
|-------|-------|
| Job ID | `job_1780992991977_c9eaaa0c` |
| Status | `succeeded` |
| Backend | `api` |
| Generation source | `minimax-api` |
| Created | `2026-06-09T08:16:31.977Z` |
| Error | `None` |

### Track Record

| Field | Value |
|-------|-------|
| Track ID | `track_1780993112817_yg4g4m` |
| Title | 轻柔钢琴测试音乐 |
| Generation source | `minimax` |
| Mode | `instrumental` |
| Created | `2026-06-09T08:18:32.818Z` |
| Audio URL | `/api/tracks/track_1780993112817_yg4g4m/audio` |
| Download URL | `/api/tracks/track_1780993112817_yg4g4m/download` |

### Audio Endpoints

| Endpoint | Status | Content-Type | Size |
|----------|--------|--------------|------|
| `/api/tracks/{id}/audio` | `200 OK` | `audio/mpeg` | 4.76 MB |
| `/api/tracks/{id}/download` | `200 OK` | `audio/mpeg` | 4.76 MB |

### Response Kind

The track was stored at `storage/tracks/` as an `.mp3` file. The URL format is `/api/tracks/{id}/audio`, which is a direct serving endpoint (not a MiniMax-hosted URL). This means the API adapter:
1. Received the audio binary from MiniMax
2. Wrote it to `storage/tracks/`
3. Serves it via the `/api/tracks/{id}/audio` endpoint

**Response kind: `direct_audio` (binary upload → local file storage)**

Inference: MiniMax returned a direct audio binary (not a URL, not a hex path, not a task_id). The `callMiniMaxApi()` function successfully detected this and:
1. Wrote the binary to `storage/tracks/{jobId}.mp3`
2. Created a `track` record in the jobs system
3. Updated job status to `succeeded`

---

## Safety Verification

| Check | Result |
|-------|--------|
| API key entered only in Web UI Settings | ✅ Verified — user entered via Settings panel, never in chat |
| Key not written to disk | ✅ Verified — `byok-secrets.ts` uses in-memory Map only |
| Key not printed in server logs | ✅ Verified — no Bearer/Authorization tokens in logs |
| BYOK key deleted on job completion | ✅ Verified — `deleteJobApiKey()` called on job success/failure |
| No repeated attempt | ✅ Only one job succeeded (`job_1780992991977_c9eaaa0c`) |
| Studio player shows track | ✅ User confirmed track visible in Studio → 最近作品 |
| Studio player plays track | ✅ User confirmed playback available |
| No new generation triggered | ✅ No additional jobs after the controlled one |

---

## Findings

### What worked

1. **BYOK UI flow** — User entered key in Settings, banner updated, diagnostic card showed "✅ 可点击"
2. **submit disabled reason** — After Quota-Guard fix, diagnostic card correctly showed "✅ 可点击" instead of false "❌ 本地每日生成保护次数已用完"
3. **API Adapter call** — `callMiniMaxApi()` successfully called MiniMax music_generation API with BYOK key
4. **Response parsing** — Adapter detected `data.data[0].audio_file` as binary audio and saved to `storage/tracks/`
5. **Track creation** — Job → track mapping worked; `/api/tracks` returned the new track with correct metadata
6. **Audio serving** — `/api/tracks/{id}/audio` and `/api/tracks/{id}/download` both return `200 OK` with correct MIME type
7. **Studio hydration** — Cold start `useEffect` (Phase CLI-Web-E) correctly hydrated the new track into the player
8. **Player display** — User saw title "轻柔钢琴测试音乐", source "MiniMax 生成", duration ~2:28

### Key design decisions confirmed

- **In-memory BYOK key storage** — Key never written to disk, deleted on job completion. Safe for multi-user scenarios where users share the same server process.
- **CLI backend remains recommended default** — API Adapter succeeded in this controlled test, but MMX CLI is still the recommended path for general use. API Adapter is experimental.
- **Response kind: direct_audio** — MiniMax returned the audio binary directly (not async task_id). Async handling path was not triggered in this test.

---

## Phase Map — Final Status

| Phase | Status |
|-------|--------|
| Phase API-Debug-A (diagnostic baseline) | ✅ COMPLETE |
| Phase API-Debug-B1 (official contract preflight) | ✅ COMPLETE |
| Phase API-Debug-C-Prepare (env setup) | ✅ COMPLETE |
| Phase API-Debug-C-UI-Guard (banner fix) | ✅ COMPLETE |
| Phase API-Debug-C-Click-Path (diagnostic card) | ✅ COMPLETE |
| Phase API-Debug-C-Quota-Guard (dailyQuotaEnabled fix) | ✅ COMPLETE |
| **Phase API-Debug-C-Observe (real generation result)** | ✅ COMPLETE |

---

## Next Steps

### Phase API-Debug-D: Stabilize API Adapter UX/docs

- Document `direct_audio` response handling in API adapter
- Add async task_id polling path (Known Gap #1 — `callMiniMaxApi()` has no async polling support)
- Update `docs/API_ADAPTER_DEBUG_REPORT.md` with real generation result
- Add a "Recommended path" section clarifying CLI as default, API Adapter as BYOK experimental path

### Phase Release v0.4.2-alpha

- Changelog: Phase API-Debug-C completed real BYOK API generation
- Add `docs/API_DEBUG_C_REAL_CALL_REPORT.md` to project docs
- Update README.md Phase status

### Phase Deploy-HK

- Migrate to non-mainland server for MiniMax API access
- Configure `HK_MINIMAX_API_KEY` environment variable
- Set up Cloudflare tunnel for HK server access
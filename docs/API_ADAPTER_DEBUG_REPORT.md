# API Adapter Debug Report
**Phase**: API-Debug-A
**Date**: 2026-06-09
**Status**: COMPLETE — Static diagnosis only, no real API calls

---

## Executive Summary

API Adapter (backend=api, BYOK mode) is **experimental and not yet validated** for real music generation. Web CLI backend (`backend=cli`) is the recommended production path. This document establishes a diagnostic baseline for the next phase of real API testing.

---

## Current Request Path

```
Browser (React state, session-only key)
  → POST /api/generate (x-minimax-api-key header)
    → server/index.ts handleGenerate()
      → validateKeyLooksReasonable() — local format check, no network
        → setJobApiKey(job.id, key) — memory only, 30min TTL
          → createJob(..., 'session')
            → enqueueAndRun()
              → executeApiJob()
                → buildMiniMaxMusicPayload() — from packages/core
                  → callMiniMaxApi() — real HTTP POST to MiniMax
                    → parse response (direct URL or hex)
                      → download audio (if URL)
                        → write track to storage/
                          → /api/tracks
```

---

## Endpoint

| Region | Endpoint URL |
|--------|-------------|
| CN | `https://api.minimaxi.com/v1/music_generation` |
| Global | `https://api.minimax.io/v1/music_generation` |

Configured in `packages/core/src/constants.ts` → `MINI_MAX_ENDPOINTS`. Used by `server/call-minimax.ts` via `buildMiniMaxMusicPayload().endpoint`.

---

## Headers

```
Authorization: Bearer <apiKey>   ← from BYOK key or server key
Content-Type: application/json
```

No `x-minimax-api-key` in the outbound API call. The BYOK key from `x-minimax-api-key` HTTP header is stored in memory Map and retrieved per-job for the actual API call.

---

## Payload (buildMiniMaxMusicPayload)

Fields always sent:
```json
{
  "model": "music-2.6",
  "output_format": "url",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 128000,
    "format": "mp3"
  }
}
```

Mode-specific fields:
| Mode | Additional fields |
|------|------------------|
| `instrumental` | `prompt`, `is_instrumental: true` |
| `auto` | `prompt`, `lyrics_optimizer: true` |
| `lyrics` | `prompt` (optional), `lyrics` |
| `cover-url` | `prompt`, `audio_url`, `lyrics` (optional) |
| `cover-file` | `prompt`, `audio_base64`, `lyrics` (optional) |

**Note**: `output_format: 'url'` is forced in `call-minimax.ts` line 32 (overrides any input). The MiniMax API also accepts `output_format: 'hex'` for direct audio data, but this path is not currently exercised.

---

## Response Parser

**Location**: `server/call-minimax.ts` `callMiniMaxApi()` (lines 75–109)

**Supported response shapes**:
1. `{ data: { audio: "<http URL>" } }` → `audioKind = 'url'`
2. `{ data: { audio_url: "<http URL>" } }` → `audioKind = 'url'`
3. `{ data: { url: "<http URL>" } }` → `audioKind = 'url'`
4. `{ data: { audio: "<hex string>" } }` → `audioKind = 'hex'` (if >32 chars, only hex chars/spaces)
5. `{ base_resp: { status_code: 0 } }` → success
6. `{ base_resp: { status_code: N, status_msg: "..." } }` → error thrown

**Missing capability**: No async polling / task_id support. The current implementation expects MiniMax to respond synchronously (or within 180s timeout). If MiniMax returns a `task_id` for async processing, the current code will fail silently.

**Gap identified**: MiniMax API documentation may describe an async endpoint that returns `{ task_id: "...", status: "processing" }`. The current code has no polling loop — it treats any non-URL/non-hex response as an error.

---

## BYOK Key Safety Model

| Layer | Storage | Persistence |
|-------|---------|-------------|
| Browser | React state (in-memory) | Cleared on page refresh |
| Server | `byok-secrets.ts` Map (job.id → key) | Memory only, 30min TTL |
| Outbound | `Authorization: Bearer <key>` header | Only to MiniMax API endpoint |
| Job record | `GenerateJob` interface — **NO apiKey field** | Never persisted |
| Manifest | Jobs manifest — **NO key** | `storage/jobs/jobs.json` |
| Audit log | Only `keyLengthBucket` (string bucket) | `storage/audit/*.jsonl` |
| Server logs | `redactSecrets()` / `redactForLog()` | Keys replaced with `[REDACTED]` |

**Cleanup paths**: `deleteJobApiKey()` called on:
- Job success (line 809 in `executeApiJob`)
- Job failure (lines 649, 679, 699, 719, 732, 747, 763)
- Job cancel (line 355 in `cancelJob`)
- TTL expiry (`getJobApiKey()` auto-deletes on expiry check)

---

## Guard Model (Two Distinct Layers)

| Guard | File | Purpose | File |
|-------|------|---------|------|
| `realApiAttempt` | Counts BEFORE network call | Prevents failed retries from consuming quota | `server/rate-limit.ts` |
| `dailyGeneration` | Counts on job success | General generation quota | `server/rate-limit.ts` |

**`realApiAttempt` behavior**:
- `reserveRealApiAttempt()` called before every `callMiniMaxApi()`
- If `remaining = 0` → job fails with `real_api_attempt_limit_exceeded` before any network call
- Stored in `storage/quota/real-api-attempts.json` (daily reset)
- Default limit: `REAL_API_DAILY_ATTEMPT_LIMIT=1`

**`dailyGeneration` behavior**:
- `incrementDailyQuota()` called only when job succeeds
- Stored in `storage/quota/daily.json`
- Default limit: `DAILY_GENERATION_LIMIT=10`

**Critical distinction**: `realApiAttempt` is a **pre-call guard** (protects against retry storms); `dailyGeneration` is a **post-success counter** (general quota tracking). Neither is related to MiniMax official Token Plan quota.

---

## Track Mapping

Both `executeCliJob` and `executeApiJob` use `createTrackRecord()` from `storage.ts`. Fields written:

| Field | CLI | API |
|-------|-----|-----|
| `id` | ✅ | ✅ |
| `title` | ✅ | ✅ |
| `mode` | ✅ | ✅ |
| `model` | ✅ | ✅ |
| `prompt` | ✅ | ✅ |
| `lyrics` | ✅ | ✅ |
| `audioFileName` | ✅ | ✅ |
| `audioMimeType` | from CLI result | `'audio/mpeg'` hardcoded |
| `audioFormat` | from CLI result | `'mp3'` hardcoded |
| `durationMs` | ❌ undefined | ✅ from `apiResult.durationMs` |
| `durationText` | ❌ undefined | ✅ from `apiResult.durationMs` |
| `sampleRate` | ❌ undefined | ✅ from `apiResult.sampleRate` |
| `bitrate` | ❌ undefined | ✅ from `apiResult.bitrate` |
| `sizeBytes` | ✅ from CLI result | ✅ from `apiResult.sizeBytes` |
| `traceId` | ❌ undefined | ✅ from `apiResult.traceId` |
| `generationSource` | `'mmx-cli'` | `'minimax-api'` |

**Gap**: CLI path does not extract audio metadata (duration, sampleRate, bitrate) from the generated file. API path gets these from MiniMax response `extra_info`. This is a known asymmetry — the CLI path relies on the file being playable to derive duration.

---

## Known Gaps

### Gap 1: No Async Polling Support ⚠️ CRITICAL

`callMiniMaxApi()` expects MiniMax to respond with audio data in the same request. If MiniMax returns `{ task_id: "...", status: "pending" }` for async processing, the current code will:
1. Try to parse `data.audio` → undefined
2. Fall through to `audioKind = 'unknown'`
3. Fail with error: `'MiniMax 返回的音频格式无法处理'`

**Fix needed**: Check MiniMax API docs for async endpoint. If async is required, need to:
- Poll `GET /v1/music_generation?task_id=...` or similar
- Add `pollIntervalMs` / `maxPollAttempts` / `pollingTimeoutMs` config
- Handle `status: pending → processing → completed` transitions

### Gap 2: Response Parser Only Handles Direct Audio

Parser only recognizes `data.audio`, `data.audio_url`, `data.url` (direct URL) or hex. Any other MiniMax response shape (task_id, status, metadata-only response) will be treated as error.

**Fix needed**: Extend parser to recognize `task_id` field and trigger async polling flow.

### Gap 3: Error Messages May Not Be Sufficiently Diagnostic

Error messages from `callMiniMaxApi()` include:
- `网络请求失败: <err.message>` (NETWORK_ERROR)
- `HTTP <status>` (HTTP_ERROR)
- `MiniMax API 错误: <status_msg>` (MINIMAX_ERROR)
- `响应解析失败` (PARSE_ERROR)

These are reasonably diagnostic. However, if MiniMax returns a structured error with a `trace_id`, only `MINIMAX_ERROR` captures it. `HTTP_ERROR` and `NETWORK_ERROR` do not include `trace_id` in the error object.

### Gap 4: CLI Path Missing Audio Metadata

`executeCliJob()` does not read `durationMs` / `sampleRate` / `bitrate` from the generated MP3 file. This means `/api/tracks` for CLI tracks will have `durationMs: undefined`. Studio player relies on HTMLAudioElement to resolve duration at playback time, so this is not a blocker — but it means CLI tracks won't show duration in the track list.

---

## Next Phase: API-Debug-B (One Real API Attempt)

### Pre-conditions (must all be true before proceeding)

1. User explicitly confirms they want to attempt real generation
2. `REAL_API_DAILY_ATTEMPT_LIMIT=1` (only one attempt allowed)
3. User provides a valid MiniMax Token Plan API key via BYOK UI
4. BYOK key is tested for format validity locally first (no network call)
5. Only ONE job will be created; if it fails, no automatic retry
6. Audio output written to `storage/tracks/` for Studio playback verification

### Phase API-Debug-B Plan

1. Set `REAL_API_DAILY_ATTEMPT_LIMIT=1` in environment
2. User opens Studio → Settings → enters BYOK key
3. User submits generation request (instrumental mode, simple prompt)
4. `reserveRealApiAttempt()` decrements daily limit to 0
5. `callMiniMaxApi()` makes real HTTP call
6. If success → track written to `storage/tracks/` → appears in Studio player
7. If failure → error displayed, no retry, `realApiAttemptsUsed` incremented to 1
8. User verifies in Studio: does player show the new track?

### What to Watch For

- Does MiniMax API respond synchronously or with `task_id`?
- Does `data.audio` contain a URL or hex?
- Does `data.extra_info.music_duration` exist?
- Does the track appear in `/api/tracks` after completion?

---

## Files Involved

| File | Role |
|------|------|
| `server/call-minimax.ts` | Raw API caller — HTTP POST, response parsing |
| `server/jobs.ts` | `executeApiJob()` — orchestrates API job lifecycle |
| `server/byok-secrets.ts` | In-memory BYOK key store with TTL |
| `server/rate-limit.ts` | Two guard layers: realApiAttempt + dailyGeneration |
| `server/security.ts` | `redactSecrets()` for safe logging |
| `server/core-wrapper.ts` | Re-exports from `packages/core` |
| `packages/core/src/request-builder.ts` | `buildMiniMaxMusicPayload()` |
| `packages/core/src/constants.ts` | `MINI_MAX_ENDPOINTS` |
| `storage.ts` | `createTrackRecord()` — track manifest |
| `docs/BYOK_MODE.md` | BYOK security model documentation |
| `docs/MINIMAX_BACKEND_DIAGNOSIS.md` | Backend comparison + CLI recommendation |

---

**Phase**: API-Debug-B0
**Date**: 2026-06-09
**Status**: COMPLETE — Async task response structure, no real API calls

---

## Phase API-Debug-B0: Async Task Response Handling

### Problem
The original `call-minimax.ts` response parser treated async task responses as unknown audio format, throwing the unhelpful error "MiniMax 返回的音频格式无法处理". This prevented any real MiniMax API call from succeeding if MiniMax ever returns an async task structure.

### Solution: Structured Response Parser

New file: `server/adapters/minimax-api/response.ts`

Provides `parseMiniMaxMusicResponse()` with 5 response kinds:

| Kind | Meaning | Action |
|------|---------|--------|
| `direct_audio` | Audio URL in response | Continue to download |
| `hex_audio` | Audio as hex string | Convert and continue |
| `async_task` | task_id returned, polling needed | Throw `MINIMAX_API_ASYNC_POLLING_REQUIRED` |
| `failure` | API error with status_code | Throw with sanitized message |
| `unknown` | Unexpected structure | Throw `PARSE_ERROR` with knownKeys |

Async task detection (any of these triggers `async_task`):
- `task_id` or `taskId` at top level or inside `data.*`
- `data.task_id` or `data.taskId`
- `status` = `processing` | `pending` | `queued` | `running` with any task ID field

Error code for async polling gap: `MINIMAX_API_ASYNC_POLLING_REQUIRED`
Error message: `"MiniMax API returned an async task response, but task polling is not configured yet."`

`jobs.ts` catch block handles this error — user sees: `"MiniMax API 错误：MiniMax API returned an async task response, but task polling is not configured yet."`

### Key Properties
- Never logs full raw response
- Never logs API key / Authorization header
- No hardcoded polling endpoint guessing
- `parsedToResult()` converts `direct_audio` / `hex_audio` to `MiniMaxResult` for backward compatibility with existing `executeApiJob`
- `response.ts` is ~280 lines, fully self-contained

### Next Step: Phase API-Debug-B1
Before a real API call can succeed, we need to confirm the official MiniMax task status polling endpoint (or user provides API docs). No real calls until polling endpoint is confirmed.

### Validation
```
api-adapter-async-contract-smoke-test.sh: 20/20 PASS
api-adapter-contract-smoke-test.sh: 21/21 PASS
```

---

## Phase API-Debug-B1: Official Music Generation Contract Alignment

**Date**: 2026-06-09
**Status**: COMPLETE — No real API calls; official contract fixtures + static alignment

### Official Contract Summary

| Field | Value |
|-------|-------|
| Endpoint (CN) | `POST https://api.minimaxi.com/v1/music_generation` |
| Endpoint (Global) | `POST https://api.minimax.io/v1/music_generation` |
| Auth | `Authorization: Bearer <token>` |
| Content-Type | `application/json` |
| Default `output_format` | `url` (preferred for BYOK; hex available) |

### Request Payload Fields

| Field | Type | Notes |
|-------|------|-------|
| `model` | string | e.g. `music-2.6` |
| `prompt` | string | lyrics / description |
| `lyrics` | string | structured lyrics (optional) |
| `stream` | boolean | `false` (synchronous) |
| `output_format` | string | `url` (recommended) or `hex` |
| `audio_setting` | object | pitch_shift, etc. |
| `is_instrumental` | boolean | `true` for pure music |
| `lyrics_optimizer` | boolean | lyrics optimization |

### Response Shape (Official Contract)

```json
{
  "data": {
    "audio": "<hex_string_or_url>",
    "status": 2
  },
  "trace_id": "string",
  "extra_info": {
    "music_duration": 25364,       // milliseconds
    "music_sample_rate": 44100,    // Hz
    "music_channel": 2,            // stereo
    "bitrate": 256000,             // bps
    "music_size": 813651           // bytes
  },
  "base_resp": {
    "status_code": 0,              // 0 = success, non-zero = error
    "status_msg": "success"
  }
}
```

### Parser Alignment

Current `server/adapters/minimax-api/response.ts` is fully aligned with official contract:

| Official Field | Parser Field | Status |
|---------------|-------------|--------|
| `data.audio` (URL) | `direct_audio` | ✅ Supported |
| `data.audio` (hex) | `hex_audio` | ✅ Supported |
| `data.task_id` | `async_task` | ✅ Supported (defensive) |
| `base_resp.status_code` | `failure.kind` | ✅ Supported |
| `base_resp.status_msg` | `failure.message` | ✅ Supported |
| `extra_info.music_duration` | `durationMs` | ✅ Supported |
| `extra_info.music_sample_rate` | `sampleRate` | ✅ Supported |
| `extra_info.bitrate` | `bitrate` | ✅ Supported |
| `extra_info.music_size` | `sizeBytes` | ✅ Supported |
| `trace_id` | `traceId` | ✅ Supported |

### Official Fixtures Created

- `test-fixtures/minimax-api/music-generation-hex-success.json` — hex audio + full extra_info
- `test-fixtures/minimax-api/music-generation-url-success.json` — URL audio + full extra_info
- `test-fixtures/minimax-api/music-generation-error.json` — error response
- `test-fixtures/minimax-api/music-generation-async-defensive.json` — async task (defensive compatibility)

### Polling Endpoint Status

**Official polling endpoint is NOT confirmed in current MiniMax documentation.** The async task handling (`async_task` kind) is retained as **defensive compatibility** — if MiniMax ever returns `task_id`, the parser throws `MINIMAX_API_ASYNC_POLLING_REQUIRED` with a clear user-facing message. We do NOT guess the polling endpoint.

### Recommended Real-Call Parameters

```typescript
{
  output_format: 'url',   // URL preferred over hex (easier to debug)
  stream: false,          // Synchronous completion
  model: 'music-2.6',    // Current Token Plan model
  is_instrumental: true, // For pure music (no lyrics)
}
```

### Next Step: Phase API-Debug-C

**Phase API-Debug-C** requires ALL of the following before a real API call:
1. ✅ This contract alignment (Phase API-Debug-B1) — COMPLETE
2. User explicitly confirms before real call
3. `REAL_API_DAILY_ATTEMPT_LIMIT=1`
4. User provides BYOK key via Web UI (not pasted in chat)
5. If response contains `task_id` → stop and report `MINIMAX_API_ASYNC_POLLING_REQUIRED`
6. Success: write track to storage + show in Studio
7. Failure: log sanitized response summary only

### Validation
```
api-adapter-official-contract-smoke-test.sh: 29/29 PASS
```

---

## Validation Status

| Check | Result |
|-------|--------|
| BYOK key never written to disk | ✅ PASS |
| BYOK key cleanup on all paths | ✅ PASS |
| GenerateJob interface excludes apiKey | ✅ PASS |
| No apiKey in server logs | ✅ PASS |
| Payload builder has all mode fields | ✅ PASS |
| Response parser handles URL + hex | ✅ PASS |
| Async polling NOT present | ⚠️ EXPECTED — may need to add |
| BYOK key TTL + expiry | ✅ PASS |
| Track mapping uses createTrackRecord | ✅ PASS |
| Two distinct guard layers | ✅ PASS |
| Error messages use redactSecrets | ✅ PASS |
| Health endpoint reports backend | ✅ PASS |
| Secret scan | ✅ CLEAN (221 files) |
| typecheck:server | ✅ PASS |
| typecheck | ✅ PASS |
| build | ✅ PASS |
| weapp:build | ✅ PASS |
| api-adapter-contract-smoke-test.sh | ✅ 21/21 PASS |
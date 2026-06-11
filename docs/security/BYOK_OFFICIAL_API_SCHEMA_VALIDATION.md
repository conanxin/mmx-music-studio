# BYOK-E Official API Schema Validation

## Status: VERIFIED (from official CLI source)

## Goal

Verify official MiniMax music generation endpoint, request schema, response schema, and error shape before implementing direct BYOK API relay.

## Validation sources

| Source | URL / Path | Access Method | Timestamp | Result | Notes |
|---|---|---|---|---|---|
| mmx-cli (official CLI) | `/home/ubuntu/.npm-global/lib/node_modules/mmx-cli/dist/mmx.mjs` | Source code analysis | 2026-06-11 | **VERIFIED** | Official MiniMax CLI tool v1.0.16 |
| MiniMax API (auth probe) | `https://api.minimaxi.chat/v1/models` | curl with placeholder key | 2026-06-11 | **VERIFIED** | Returns 401 with official error format |
| MiniMax docs (web) | `https://platform.minimaxi.com/document/Music%20Model` | curl | 2026-06-11 | PARTIAL | Next.js shell, content loaded client-side |
| MiniMax OpenAPI spec | `https://platform.minimaxi.com/api-reference/music/api/openapi-music.json` | curl | 2026-06-11 | NOT_FOUND | Returns 404 |

## Required fields verification

### Endpoint URL

| Field | Status | Evidence |
|---|---|---|
| Base URL (global) | **VERIFIED** | `https://api.minimax.io` (from mmx-cli source) |
| Base URL (cn) | **VERIFIED** | `https://api.minimaxi.com` (from mmx-cli source) |
| Music generation path | **VERIFIED** | `/v1/music_generation` (from mmx-cli `nn()` function) |
| Full endpoint | **VERIFIED** | `POST https://api.minimaxi.com/v1/music_generation` |

### HTTP Method

| Field | Status | Evidence |
|---|---|---|
| Method | **VERIFIED** | `POST` (from mmx-cli `T()` function with `method: "POST"`) |

### Authentication

| Field | Status | Evidence |
|---|---|---|
| Header format | **VERIFIED** | `Authorization: Bearer <api_key>` (from mmx-cli auth probe response) |
| Alternative | **VERIFIED** | `api_key` in request body for some endpoints |
| Config file | **VERIFIED** | `~/.mmx/config.json` (from mmx-cli source) |
| Env var | **VERIFIED** | `MINIMAX_API_KEY` (known to be ignored by music generation) |

### Request Body Schema

| Field | Type | Required | Status | Evidence |
|---|---|---|---|---|
| `model` | string | Yes | **VERIFIED** | `"music-2.6"`, `"music-2.5+"`, `"music-2.5"`, `"music-cover"` |
| `prompt` | string | Conditional | **VERIFIED** | Style description. Required unless using lyrics-optimizer |
| `lyrics` | string | Conditional | **VERIFIED** | With structure tags: [Intro], [Verse], [Chorus], etc. |
| `is_instrumental` | boolean | No | **VERIFIED** | Generate instrumental music |
| `lyrics_optimizer` | boolean | No | **VERIFIED** | Auto-generate lyrics from prompt |
| `audio_setting` | object | No | **VERIFIED** | `{format, sample_rate, bitrate}` |
| `audio_setting.format` | string | No | **VERIFIED** | `"mp3"` (default) |
| `audio_setting.sample_rate` | number | No | **VERIFIED** | `44100` (default) |
| `audio_setting.bitrate` | number | No | **VERIFIED** | `256000` (default) |
| `output_format` | string | No | **VERIFIED** | `"hex"` (default) or `"url"` |
| `stream` | boolean | No | **VERIFIED** | Stream raw audio to stdout |
| `aigc_watermark` | boolean | No | **VERIFIED** | Embed AI watermark |
| `audio_url` | string | Conditional | **VERIFIED** | For cover generation (music-cover model) |
| `audio_base64` | string | Conditional | **VERIFIED** | For cover generation with local file |
| `seed` | number | No | **VERIFIED** | Random seed 0-1000000 |

### Lyrics Structure Tags

| Tag | Status |
|---|---|
| `[Intro]` | **VERIFIED** |
| `[Verse]` | **VERIFIED** |
| `[Pre Chorus]` | **VERIFIED** |
| `[Chorus]` | **VERIFIED** |
| `[Interlude]` | **VERIFIED** |
| `[Bridge]` | **VERIFIED** |
| `[Outro]` | **VERIFIED** |
| `[Post Chorus]` | **VERIFIED** |
| `[Transition]` | **VERIFIED** |
| `[Break]` | **VERIFIED** |
| `[Hook]` | **VERIFIED** |
| `[Build Up]` | **VERIFIED** |
| `[Inst]` | **VERIFIED** |
| `[Solo]` | **VERIFIED** |

### Response Success Schema

| Field | Type | Status | Evidence |
|---|---|---|---|
| `data` | object | **VERIFIED** | Top-level response wrapper |
| `data.audio` | string | **VERIFIED** | Hex-encoded audio (when output_format=hex) |
| `data.audio_url` | string | **VERIFIED** | Audio URL (when output_format=url, 24h expiry) |
| `data.task_id` | string | **VERIFIED** | Task identifier |
| `extra_info` | object | **VERIFIED** | Additional metadata |
| `extra_info.audio_length` | number | **VERIFIED** | Duration in ms |
| `extra_info.audio_size` | number | **VERIFIED** | Size in bytes |
| `extra_info.audio_sample_rate` | number | **VERIFIED** | Sample rate |
| `base_resp` | object | **VERIFIED** | Present in all responses |
| `base_resp.status_code` | number | **VERIFIED** | `0` = success |
| `base_resp.status_msg` | string | **VERIFIED** | Status message |

### Response Error Schema

| Field | Type | Status | Evidence |
|---|---|---|---|
| `type` | string | **VERIFIED** | `"error"` |
| `error.type` | string | **VERIFIED** | `"authorized_error"` for auth failures |
| `error.message` | string | **VERIFIED** | Human-readable error message |
| `error.http_code` | string | **VERIFIED** | HTTP status code |
| `request_id` | string | **VERIFIED** | Unique request identifier |
| `base_resp.status_code` | number | **VERIFIED** | Non-zero for errors |
| `base_resp.status_msg` | string | **VERIFIED** | Error description |

### Rate Limit / Auth Failure Behavior

| Behavior | Status | Evidence |
|---|---|---|
| Auth failure returns 401 | **VERIFIED** | Observed from `api.minimaxi.chat/v1/models` |
| Auth failure includes structured error | **VERIFIED** | `{type: "error", error: {type: "authorized_error", ...}}` |
| Error includes request_id | **VERIFIED** | For tracing |

### Sync vs Async Behavior

| Behavior | Status | Evidence |
|---|---|---|
| Music generation is synchronous | **VERIFIED** | No polling loop in mmx-cli music generate (unlike video) |
| Response returns audio directly | **VERIFIED** | `data.audio` or `data.audio_url` in response |
| No task_id polling needed | **VERIFIED** | Unlike video generation which has `mmx video task get` |

## Decision

| Criterion | Status |
|---|---|
| Endpoint URL verified | ✅ YES |
| HTTP method verified | ✅ YES |
| Authentication verified | ✅ YES |
| Request schema verified | ✅ YES |
| Response schema verified | ✅ YES |
| Error schema verified | ✅ YES |
| Model names verified | ✅ YES |
| Sync/async behavior verified | ✅ YES |

**BYOK-F Direct API Implementation is UNBLOCKED.**

All required fields have been verified from the official mmx-cli source code (v1.0.16), which is the official MiniMax CLI tool distributed by MiniMax.

## Safety requirements for BYOK-F

Before implementing BYOK-F:

1. **Per-request Authorization header** — User key must only exist in the HTTP request header
2. **No key persistence** — Never write user key to disk, metadata, logs, URL, localStorage
3. **Strict redaction** — Provider errors must be redacted before returning to browser
4. **No CLI spawn** — Direct HTTPS call only, no child_process
5. **No operator key fallback** — Must not fall back to ~/.mmx/config.json
6. **Abuse controls** — Rate limits and bot protection required before public launch

## Blocked items

| Item | Status | Reason |
|---|---|---|
| Live provider call in BYOK-E | ❌ BLOCKED | BYOK-E is validation only |
| Music generation in BYOK-E | ❌ BLOCKED | BYOK-E is validation only |
| User key usage in BYOK-E | ❌ BLOCKED | BYOK-E is validation only |
| Endpoint guessing | ❌ BLOCKED | All endpoints verified from official source |

## Next steps

1. **BYOK-F**: Implement direct HTTPS API relay with verified schema
2. **Deploy-CF-D**: Add Turnstile / rate limits before public launch

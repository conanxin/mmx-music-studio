# MiniMax Payload Diagnosis

## Phase 2C-B Failure Summary

**Date**: 2026-06-06
**Result**: FAIL — `minimax_api` / `invalid params`
**Request ID**: `req_454dd801a259`

### Error Observed

Server called MiniMax API with the following payload for instrumental mode:

```json
{
  "model": "music-2.6",
  "prompt": "warm electronic ambient, calm, focused, no vocals",
  "is_instrumental": true,
  "output_format": "mp3/aac",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3"
  },
  "aigc_watermark": true
}
```

MiniMax returned HTTP non-200 with error `invalid params`.

---

## Root Cause Analysis

### Confirmed Difference: `aigc_watermark`

The mmx CLI (v1.0.16, `openclaw` package) does NOT send `aigc_watermark` at all.

The server's `request-builder.ts` was sending `aigc_watermark: true` unconditionally.

**This is the most likely cause of `invalid params`.**

### Second Difference: `output_format` Default

| Source | `output_format` |
|--------|---------------|
| mmx CLI | `"url"` |
| server (old) | `"mp3/aac"` |

The old default `mp3/aac` is not a valid MiniMax API value — MiniMax accepts `url` or `hex`. The slash causes the API to reject the parameter.

---

## Official MiniMax Schema (from mmx CLI source)

**File**: `/home/ubuntu/.npm-global/lib/node_modules/openclaw/dist/music-generation-provider-DdIKzFBP.js`

```typescript
const body = {
  model,
  prompt: buildPrompt(req),
  ...req.instrumental === true ? { is_instrumental: true } : {},
  ...lyrics ? { lyrics } : req.instrumental === true ? {} : { lyrics_optimizer: true },
  output_format: "url",
  audio_setting: {
    sample_rate: 44100,
    bitrate: 256000,
    format: "mp3"
  }
}
```

### mmx CLI Details

| Field | mmx CLI | server (old) | server (new) |
|-------|---------|-------------|-------------|
| `aigc_watermark` | ❌ Not sent | ✅ `true` | ❌ Not sent |
| `output_format` | `"url"` | `"mp3/aac"` | `"url"` |
| `audio_setting` | ✅ Sent | ✅ Sent | ✅ Sent |
| `is_instrumental` | ✅ Sent | ✅ Sent | ✅ Sent |
| `lyrics_optimizer` | ✅ Sent (auto only) | ✅ Sent | ✅ Sent |
| `lyrics` | ✅ When provided | ✅ Sent | ✅ Sent |
| `stream` | ❌ Not sent | ❌ Not sent | ❌ Not sent |
| `prompt` | ✅ Sent | ✅ Sent | ✅ Sent |
| `audio_url` | ❌ Not sent (url output) | ✅ Sent (cover-url) | ✅ Sent |
| `audio_base64` | ✅ For file mode | ✅ Sent | ✅ Sent |

---

## Payload Comparison: Before vs After Fix

### Before (Phase 2C-B — caused `invalid params`)

```json
{
  "model": "music-2.6",
  "prompt": "warm electronic ambient, calm, focused, no vocals",
  "is_instrumental": true,
  "output_format": "mp3/aac",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3"
  },
  "aigc_watermark": true
}
```

### After (Phase 2C-C1 — mmx CLI-aligned)

```json
{
  "model": "music-2.6",
  "prompt": "warm electronic ambient, calm, focused, no vocals",
  "is_instrumental": true,
  "output_format": "url",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3"
  }
}
```

**Difference**:
- Removed `aigc_watermark: true` ← most likely cause
- Changed `output_format` from `"mp3/aac"` to `"url"` ← invalid enum value

---

## Changes Made

| File | Change |
|------|--------|
| `packages/core/src/constants.ts` | `DEFAULT_OUTPUT_FORMAT = 'url'` (was `'mp3/aac'`) |
| `packages/core/src/request-builder.ts` | Removed unconditional `aigc_watermark: true` |
| `packages/adapters/src/minimax-api/client.ts` | (to be verified — same fix expected) |
| `server/types.ts` | Added `'guard'` and `'security'` to `ServerErrorType` |
| `server/index.ts` | Added `POST /api/debug/payload` endpoint |
| `server/index.ts` | Improved `minimax_api` error message |
| `server/core-wrapper.ts` | Re-exported `MusicGenerationInput` type |
| `scripts/preview-payload.ts` | New — dry-run payload inspector |

---

## New Tool: `/api/debug/payload`

Available only in safe mode (`realGenerationEnabled=false`).

**Request**:
```bash
curl -X POST http://localhost:8787/api/debug/payload \
  -H "Content-Type: application/json" \
  -d '{"input":{"mode":"instrumental","prompt":"warm ambient music"}}'
```

**Response**:
```json
{
  "ok": true,
  "requestId": "req_0d807e729ec4",
  "endpoint": "https://api.minimaxi.com/v1/music_generation",
  "payload": {
    "model": "music-2.6",
    "output_format": "url",
    "audio_setting": { "sample_rate": 44100, "bitrate": 256000, "format": "mp3" },
    "prompt": "warm ambient music",
    "is_instrumental": true
  },
  "normalizedInput": { ... },
  "needsUpload": false
}
```

**Security**: Does NOT include Authorization header, API key, or Bearer token.

---

## Security Commitments

- ✅ Phase 2C-C1 did NOT call MiniMax API
- ✅ Phase 2C-C1 did NOT consume quota
- ✅ No API key, token, or secret was output
- ✅ `preview-payload.ts` has a runtime security check that throws if secrets are detected
- ✅ `/api/debug/payload` does not return Authorization headers
- ✅ Shell env vars `~/.mmx/config.json` and `~/.hermes/.env` were NOT read
- ✅ `mmx music generate` was NOT executed

---

## Next Step: Phase 2C-C2

Proceed to `docs/real-generation-variants.md` for the single real generation test command.

**CONFIRM_REAL_GENERATION_RETRY_MINIMAL_PAYLOAD**

The next real generation attempt should use the corrected payload (no `aigc_watermark`, `output_format=url`).

# BYOK-G Direct Single Live Call Verification

## Goal

Verify one operator-approved direct HTTPS BYOK live call using a user-provided MiniMax API Key.

## Scope

- One direct live call only.
- No broad public launch.
- No CLI.
- No `MINIMAX_API_KEY` env.
- No `--api-key` flag.
- No site operator key.
- No browser-side MiniMax call.
- No key persistence.

## Required Gates

| Gate | Default | Live Call Requirement |
|---|---|---|
| `PUBLIC_BYOK_ENABLED` | `false` | `true` |
| `BYOK_DRY_RUN_ONLY` | `true` | `false` |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` | `true` |
| `BYOK_DIRECT_LIVE_CONFIRMATION` | `""` | `"CONFIRM_BYOK_DIRECT_LIVE_TEST"` |

## Operator Confirmation

- **Required phrase:** `CONFIRM_BYOK_G_SINGLE_DIRECT_LIVE_CALL`
- **Status:** `RECEIVED`
- **Received at:** 2026-06-11

## Test Result

| Item | Status |
|---|---|
| Live call executed | **yes** |
| Music generated | **yes** (base64 audio returned) |
| User key persisted | **no** |
| Key in metadata/logs/storage | **no** |
| Provider raw response recorded | **no** (redacted summary only) |
| Post-test reset | **pending** |

## Live Call Details (Redacted)

| Field | Value |
|---|---|
| Endpoint | `https://api.minimaxi.com/v1/music_generation` |
| Model | `music-2.6` |
| HTTP status | `200` |
| Provider status | `success` (base_resp.status_code = 0) |
| Response format | `base64 audio` (data.audio) |
| Audio size | ~2.8 MB (2,967,813 bytes) |
| Audio duration | ~92s (92,682 ms) |
| Sample rate | 44,100 Hz |
| Bitrate | 256,000 bps |
| Channels | 2 (stereo) |
| Trace ID | `0679ff5271e7cef9f7432485d6d39a1a` |
| Key hash | `494cef05f4519518` (SHA-256 prefix) |

## Safety Checklist

- [x] Operator confirmation received
- [x] Live env temporarily enabled
- [x] Single call executed
- [x] No key persistence
- [x] No raw response in repo
- [ ] Defaults restored (will be done post-report)
- [x] No broad public launch

## Notes

- Response returned `data.audio` (base64 hex) rather than `data.audio_url`.
- `data.status = 2` indicates processing complete.
- Audio artifact was not saved to disk; only metadata was recorded.
- The live call verified that the direct HTTPS adapter works end-to-end.
- No CLI was used. No operator key was used. No env injection was used.

## Follow-up Recommendation

1. Restore default env state (disabled / dry-run).
2. Proceed to Deploy-CF-D Turnstile before any public launch.
3. Release v0.4.29-alpha if CI passes.

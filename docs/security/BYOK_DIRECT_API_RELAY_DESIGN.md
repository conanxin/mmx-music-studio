# BYOK-D Direct HTTPS API Relay Design

## Status: PARTIAL_DESIGN_ONLY

This document describes the intended architecture for replacing the unsafe CLI-based BYOK live path with a direct server-side HTTPS provider call. **No live provider call is implemented in this phase.** The official MiniMax music generation API endpoint and request/response schema have not yet been verified from official documentation (the docs platform uses client-side rendering not accessible via curl).

---

## Goal

Replace the unsafe CLI live path with a direct server-side HTTPS provider call using a per-request user API key.

## Why CLI is not acceptable

1. **MINIMAX_API_KEY env injection was ignored by `mmx music generate`**
   - The CLI's credential priority does not use the child-process environment variable for music generation.
   - The CLI may fall back to `~/.mmx/config.json`, which can accidentally use the site operator key.

2. **`--api-key` flag is not a safe production fix**
   - While `--api-key` can override the config file, the key material is exposed in process argv.
   - Process argv may be visible via `ps`, `/proc/*/cmdline`, or system monitoring tools.
   - This violates the principle of never exposing user key material in process-visible state.

3. **Therefore CLI must not be used for BYOK live relay.**

## Desired model (future implementation)

```
Browser ──HTTPS──▶ Server ──HTTPS──▶ MiniMax API
         user key        Authorization: Bearer <user-key>
                        (per-request, never stored)
```

### Security requirements

| Requirement | Status |
|---|---|
| Browser sends user key to server only for one request | Design |
| Server uses key only in `Authorization` header for direct HTTPS call | Design |
| Server never stores the key | Design |
| Server never logs the key | Design |
| Server never returns the key | Design |
| Provider raw response is normalized before returning to browser | Design |
| Provider raw error is redacted | Design |
| Metadata/storage never includes key material | Design |

## Modes

| Mode | Code | Status |
|---|---|---|
| disabled | `byok_generation_disabled` | ✅ Available |
| dry-run | `byok_dry_run_only` | ✅ Available (default) |
| fake relay | `byok_fake_relay_ok` | ✅ Available |
| direct-api design only | `byok_direct_api_not_verified` | ✅ Available |
| future live direct-api | (future) | ❌ Not available |

## Abuse controls required before public launch

- **Launch Guard** remains required.
- **Turnstile** or equivalent bot protection should be considered before broad public BYOK.
- **Rate limits** should remain per source even when user brings own key.
- **Key validation** (format check, not live call) before accepting.

## What is blocked until verification

| Item | Blocker |
|---|---|
| Live HTTPS call implementation | Official endpoint URL not verified |
| Request body schema | Official schema not verified |
| Response schema | Official schema not verified |
| Error shape | Official schema not verified |
| Rate limit behavior | Official docs not verified |
| Auth failure behavior | Official docs not verified |

## Next steps

1. **Phase BYOK-E: Official API Schema Validation**
   - Access MiniMax music generation API docs via browser or authenticated API.
   - Record verified endpoint URL, method, request schema, response schema.
   - Document error shapes and rate limits.

2. **Phase BYOK-F: Direct API Implementation**
   - Implement `generateByokDirectMusic()` with verified endpoint.
   - Add per-request `Authorization` header.
   - Add response normalization and error redaction.
   - Add comprehensive smoke tests with mock provider.

3. **Phase Deploy-CF-D: Turnstile**
   - Deploy Cloudflare Turnstile before any public BYOK live launch.

## Safety and privacy

This design document does not:
- Execute a live MiniMax call
- Generate music
- Use a real user key
- Use the site operator key
- Store user keys
- Submit runtime storage
- Move old tags

## Final wording

> BYOK-D documents and scaffolds the direct HTTPS API relay path, but it does not execute live provider calls. BYOK live remains disabled until official endpoint/schema validation and abuse controls are complete.

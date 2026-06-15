# BYOK Music 2.6 Lyrics Or Instrumental Param Fix

Date: 2026-06-15

Phase: BYOK-MUSIC26-LYRICS-OR-INSTRUMENTAL-PARAM-FIX

## Pilot Evidence

- Production BYOK live pilot reached the MiniMax provider path.
- requestId: `byok_e27bc638afc5`
- Turnstile validation passed.
- The controlled live attempt was consumed as expected.
- Audio was not generated.
- Health stage: `byokLastSubmitStage=direct_live_provider_error`
- Provider status code: `200`
- Provider error code: `2013`
- Provider error message summary: `"invalid params, lyrics is required"`
- Response content type: `application/json; charset=utf-8`
- Response body shape: `object`

## Finding

The MiniMax `music-2.6` / `music-2.6-free` direct-live request was reaching
the provider without a complete generation intent. A pure background-music
request must be sent as instrumental, while a vocal request must include
lyrics.

## Fix Target

- Default Studio BYOK intent to `instrumental`.
- Send `is_instrumental=true` for instrumental direct-live provider requests.
- Use `with_lyrics` only when the caller explicitly chooses a vocal request.
- Require non-empty `lyrics` for `with_lyrics`.
- Reject missing lyrics before provider-ready and before live attempt consume.
- Preserve provider-error observability without logging full provider bodies or
  any API key, Authorization header, token, secret, or confirmation value.

## Verification

- `bash scripts/byok-music26-lyrics-or-instrumental-param-smoke-test.sh`
- `bash scripts/byok-live-provider-error-observability-smoke-test.sh`
- `bash scripts/byok-live-attempt-consume-guard-smoke-test.sh`
- `bash scripts/prod-byok-live-readiness-smoke-test.sh`
- `npm run release:check`
- `npm run typecheck`
- `npm run typecheck:server`
- `npm run build`
- `git diff --check`

## Follow-Up Gate

Production should remain rolled back to safe-default. Before any new live
pilot, rerun the full preflight and explicitly confirm safe-default health,
Turnstile readiness, live attempt/audio caps, and direct-live confirmation.

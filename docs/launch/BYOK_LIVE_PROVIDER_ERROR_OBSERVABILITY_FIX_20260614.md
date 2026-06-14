# BYOK-LIVE-PROVIDER-ERROR-OBSERVABILITY-FIX

Date: 2026-06-14
Scope: local code, smoke test, and documentation only.

## Production Pilot Finding

Second one-shot pilot requestId: `byok_768a82d88e88`.

Observed:

- Production was rolled back to safe-default after the pilot.
- Safe-default health after rollback showed BYOK public/live disabled, live confirmation not configured, attempts/audio counters reset, and no pending consumed attempts.
- The pilot log showed `turnstilePresent=true`.
- The pilot log showed `apiKeyPresent=true`.
- The live attempt slot was consumed: used `1/1`.
- Health showed `byokLastSubmitStage=direct_live_provider_error`.
- Health showed audio used `0` and audio remaining `1`.
- No audio was generated.
- The page surfaced `network_error` and `JSON.parse: unexpected character at line 1 column 1 of the JSON data`.

Conclusion: the live provider path was reached and the attempt was correctly consumed, but the provider-error path lacked safe diagnostic detail, and the frontend treated a non-JSON/parse failure as a generic network error.

## Fix Goal

Provider-error observability must include only safe fields:

- requestId
- stage
- provider status code when available
- provider error code when available
- truncated provider error message summary when available
- response content-type when available
- response body shape and top-level keys when available

The server must keep returning stable JSON to the frontend, and the frontend must distinguish a non-JSON server response from a true network failure.

## Verification

Local verification added:

- `scripts/byok-live-provider-error-observability-smoke-test.sh`

The smoke is static and read-only. It checks safe provider-error logging, stable JSON error response fields, frontend non-JSON response handling, and redaction boundaries. It does not start live mode, submit generation, call MiniMax, generate audio, read env secrets, or print secret values.

The smoke is also wired into `npm run release:check`.

## Safe-Default Requirement

Production remains at safe-default after this finding. Before any future live pilot, operators must rerun preflight from scratch and confirm Turnstile, live confirmation, direct-live confirmation, attempt remaining, audio remaining, and zero pending/silent consume counters.

No API key, Turnstile token, Authorization header, secret, or confirmation value is recorded in this document.

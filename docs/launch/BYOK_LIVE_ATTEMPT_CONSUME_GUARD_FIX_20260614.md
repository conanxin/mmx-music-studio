# BYOK-LIVE-ATTEMPT-CONSUME-GUARD-FIX

Date: 2026-06-14
Scope: local code, smoke test, and documentation only.

## Production Pilot Finding

One-shot pilot requestId: `byok_e098eec12c83`.

Observed:

- Production was rolled back to safe-default after the pilot.
- Safe-default health after rollback showed BYOK public/live disabled, live confirmation not configured, attempts/audio counters reset, and no pending consumed attempts.
- The pilot log showed `turnstilePresent=false`.
- The same request showed `apiKeyPresent=true` after request parsing.
- The live attempt slot was consumed: used `1/1`.
- No audio was generated.

Conclusion: a BYOK live attempt was consumed even though the Turnstile token was missing.

## Fix Goal

The live attempt slot must not be consumed when any upstream gate fails:

- Turnstile token missing.
- Turnstile verification failed.
- API key missing or invalid.
- Prompt/input validation failed.
- BYOK live confirmation mismatch.
- BYOK direct-live confirmation mismatch.
- Provider path not yet ready.

The live attempt slot may be consumed only at the final safe point immediately before the local server invokes the live provider path.

## Verification

Local verification added:

- `scripts/byok-live-attempt-consume-guard-smoke-test.sh`

The smoke is static and read-only. It checks handler ordering and call sites only. It does not start live mode, submit generation, call MiniMax, generate audio, read env secrets, or print secret values.

The smoke is also wired into `npm run release:check`.

## Safe-Default Requirement

Production remains at safe-default after this finding. Before any future live pilot, operators must rerun preflight from scratch and confirm Turnstile, live confirmation, direct-live confirmation, attempt remaining, audio remaining, and zero pending/silent consume counters.

No API key, Turnstile token, secret, or confirmation value is recorded in this document.

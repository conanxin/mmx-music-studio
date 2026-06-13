# BYOK-H3B R10 Blocker Closeout (2026-06-13)

> Phase: **BYOK-H3B-R10-BLOCKER-CLOSEOUT**
> Scope: local code / docs / tests only.
> Live status: **closed**.

## Decision

Retry-10 remains closed as **RETRY10_BLOCKED_OR_ABORTED** because the
operator-only secret step was not confirmed.

The blocker is:

**OPERATOR_SECRET_STEP_NOT_CONFIRMED**

At the Retry-10 pause point, the public health surface still reported:

- `byokLiveConfirmationConfigured=false`
- `byokLiveEnabled=false`

Until the operator completes the local secret step out-of-band and only
shares the boolean result, Codex must treat the live gate as closed.

## Safe Default Contract

The default state remains:

- `PUBLIC_BYOK_ENABLED` defaults to false.
- `BYOK_DRY_RUN_ONLY` defaults to true.
- `BYOK_LIVE_ENABLED` defaults to false.
- `BYOK_DIRECT_LIVE_ENABLED` defaults to false.
- `/api/health` may expose booleans, but must not expose secret values.
- No future phase may infer live readiness from docs alone.

This closeout does not modify production systemd configuration, does not
set any live window, does not submit `/api/generate/byok`, does not call
MiniMax, and does not generate audio.

## Codex No-Live Rules

Before a future operator explicitly reports `OPERATOR_SECRET_CONFIG_APPLIED`
with no values:

1. Do not set `BYOK_LIVE_CONFIRMATION` from Codex.
2. Do not set `BYOK_LIVE_WINDOW_ID` from Codex.
3. Do not enable `BYOK_DIRECT_LIVE_ENABLED` from Codex.
4. Do not enable `BYOK_LIVE_ENABLED` from Codex.
5. Do not submit `POST /api/generate/byok`.
6. Do not ask for or record a MiniMax key.
7. Do not ask for or record a Turnstile secret.
8. Do not print Authorization headers, tokens, API keys, or env values.

Allowed local work is limited to source reads, docs, static smoke tests,
standard build/typecheck commands, and read-only health checks that inspect
public booleans only.

## Local Operator Handoff

For any future retry, the operator owns the secret step completely outside
the repository and outside the Codex transcript.

Operator checklist before asking Codex to continue:

1. Confirm a new explicit phase name and window are intended.
2. Apply live-gate settings locally and out-of-band.
3. Reload or restart the service locally.
4. Check the public health booleans locally.
5. Tell Codex only: `OPERATOR_SECRET_CONFIG_APPLIED`.
6. Do not paste secret values, API keys, tokens, or raw env output.

Codex checklist after receiving `OPERATOR_SECRET_CONFIG_APPLIED`:

1. Fetch and record git status.
2. Read only public health booleans.
3. Require `byokLiveConfirmationConfigured=true`.
4. Require `byokLiveEnabled=true` only in the explicitly authorized future
   live phase.
5. Require live attempt and live audio counters to be at the expected
   baseline before any submit.
6. If any required boolean is false, stop with
   `OPERATOR_SECRET_STEP_NOT_CONFIRMED`.
7. Never repair the blocker by setting env vars itself.

## Test Contract

The static smoke test for this closeout is:

`scripts/byok-h3b-r10-blocker-closeout-smoke-test.sh`

It verifies:

- Retry-10 evidence still names `OPERATOR_SECRET_STEP_NOT_CONFIRMED`.
- This closeout states the no-live rules.
- Development handoff points to this closeout.
- Source defaults keep BYOK live disabled unless explicitly configured.
- The new closeout doc does not contain secret-looking values.
- The new smoke script itself does not perform a generate submit.

## Current Next Step

Stay in safe default. Do not auto-enter Retry-11, T2-T5, broad public BYOK,
or any live generation phase.


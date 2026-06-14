# Operator Secret Step Prep (2026-06-14)

> Phase: OPERATOR-SECRET-STEP-PREP
> Scope: operator checklist and read-only preflight only.
> Live status: CLOSED.

This document prepares the next controlled BYOK live pilot step. It does
not open live, does not change production systemd configuration, does
not submit BYOK generation, does not call MiniMax, and does not generate
audio.

## 1. Current Readiness Conclusion

Current classification:

`NOT_READY_OPERATOR_SECRET_STEP_MISSING`

The public production health surface has already shown the important
operator-gated state:

| Health field | Current state |
| --- | --- |
| `publicByokEnabled` | `false` |
| `byokEnabled` | `false` |
| `byokLiveEnabled` | `false` |
| `byokLiveConfirmationConfigured` | `false` |
| `byokLastSubmitStage` | `killswitch_off` |
| `turnstileByokRequired` | `true` |
| `turnstileSecretKeyConfigured` | `true` |
| `turnstileSiteKeyPresent` | `true` |
| `realGenerationEnabled` | `true` |
| `mockGenerationEnabled` | `false` |
| `backend` | `cli` |

This means the regular production backend can be real/CLI-backed, but
the public BYOK live path is still intentionally closed.

## 2. Why Production Is Still Dry-Run for BYOK

The BYOK generation route remains blocked before any provider call:

1. `PUBLIC_BYOK_ENABLED` is not open, so `/api/generate/byok` is blocked
   at the public kill switch.
2. `BYOK_LIVE_ENABLED` is not open, so the live relay gate is closed.
3. `BYOK_LIVE_CONFIRMATION` is not configured, so the operator secret
   confirmation step is missing.
4. The live window id cannot be confirmed from public health alone.
5. The direct live provider path remains unavailable unless the operator
   also opens the direct-live gate for a specific controlled window.

The expected user-visible result is still "safe default / no-live":
the UI may explain the form and mock/demo flow, but the server must not
call MiniMax through the BYOK path.

## 3. Manual Confirmations Before BYOK Live

The operator must confirm all items below outside the repository and
outside the Codex transcript:

| Check | Required operator confirmation |
| --- | --- |
| Deployment sync | Production is running the intended commit or release artifact. |
| Window | A short controlled window is approved, named, and attended. |
| Tester scope | One tester at a time; no broad public launch. |
| MiniMax key ownership | Tester brings their own MiniMax key; no shared operator key. |
| Turnstile | BYOK Turnstile enforcement remains required and configured. |
| Live attempt cap | At most one live attempt per window unless a new window is explicitly approved. |
| Live audio cap | At most one generated audio artifact per window unless a new window is explicitly approved. |
| Monitoring | Operator can watch health, logs, counters, storage growth, and failures during the window. |
| Rollback | Safe-default restore path is ready before any live toggle. |
| Secret boundary | No raw key, token, Authorization header, Turnstile secret, or env value is pasted into Codex. |

## 4. Production Env Names Owned By Operator

The following names may be involved in a future operator-managed live
window. This section lists names only. It intentionally does not include
real values.

| Env name | Purpose |
| --- | --- |
| `PUBLIC_BYOK_ENABLED` | Opens or closes the public BYOK route. |
| `BYOK_DRY_RUN_ONLY` | Keeps BYOK in dry-run unless explicitly disabled. |
| `BYOK_LIVE_ENABLED` | Opens or closes the live BYOK relay gate. |
| `BYOK_LIVE_CONFIRMATION` | Operator live confirmation gate. |
| `BYOK_LIVE_WINDOW_ID` | Names the controlled window and scopes in-memory counters. |
| `BYOK_LIVE_ATTEMPT_LIMIT_ENABLED` | Enables the live attempt cap. |
| `BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW` | Caps live attempts per window. |
| `BYOK_LIVE_MAX_AUDIO_PER_WINDOW` | Caps generated audio per window. |
| `BYOK_DIRECT_LIVE_ENABLED` | Opens the direct HTTPS live provider path. |
| `BYOK_DIRECT_LIVE_CONFIRMATION` | Operator direct-live confirmation gate. |
| `TURNSTILE_BYOK_REQUIRED` | Keeps BYOK protected by Turnstile. |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key; never a secret. |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile secret; never paste into docs or chat. |

Codex must not set these production values, must not ask for their raw
values, and must not repair a failed preflight by changing production
env configuration.

## 5. Health Before Opening

Immediately before any future pilot preflight, public health should show
the safe-default BYOK posture:

| Health field | Expected before live |
| --- | --- |
| `publicByokEnabled` | `false` |
| `byokLiveEnabled` | `false` |
| `byokLiveConfirmationConfigured` | `false` |
| `byokLiveAttemptsUsed` | `0` |
| `byokLiveAttemptsRemaining` | at least `1` |
| `byokLiveAudioUsed` | `0` |
| `byokLiveAudioRemaining` | at least `1` |
| `byokSilentConsumeCount` | `0` |
| `byokPendingConsumedAttempts` | `0` |
| `turnstileByokRequired` | `true` |
| `turnstileSecretKeyConfigured` | `true` |
| `turnstileSiteKeyConfigured` or `turnstileSiteKeyPresent` | `true` |

If any live counter is already consumed, rotate the planned window and
re-check before proceeding.

## 6. Health After Operator Opens A Controlled Window

After the operator intentionally applies the live window configuration
and restarts/reloads production, public health should show only
non-sensitive booleans and counters. The expected readiness shape is:

| Health field | Expected for controlled pilot preflight |
| --- | --- |
| `publicByokEnabled` | `true` |
| `byokLiveEnabled` | `true` |
| `byokLiveConfirmationConfigured` | `true` |
| `byokLiveAttemptsUsed` | `0` |
| `byokLiveAttemptsRemaining` | at least `1` |
| `byokLiveAudioUsed` | `0` |
| `byokLiveAudioRemaining` | at least `1` |
| `byokSilentConsumeCount` | `0` |
| `byokPendingConsumedAttempts` | `0` |
| `turnstileByokRequired` | `true` |
| `turnstileSecretKeyConfigured` | `true` |
| `turnstileSiteKeyConfigured` or `turnstileSiteKeyPresent` | `true` |

Public health does not prove every direct-live env value, and it must
not expose any secret value. The next phase must still treat direct-live
as unverified until the operator confirms the private step by reporting
only a boolean result such as `OPERATOR_SECRET_CONFIG_APPLIED`.

## 7. Minimal Controlled Live Pilot Window

Recommended pilot shape:

- Window length: 10 to 30 minutes.
- Tester count: one tester only for the first resumed live attempt.
- Attempt cap: one live attempt per window.
- Audio cap: one generated audio artifact per window.
- Prompt scope: one short, non-sensitive prompt.
- Turnstile: required.
- BYOK key: tester-provided per request only.
- Monitoring: health before submit, immediately after submit, and after
  rollback.
- Rollback: execute safe-default restore even after success.

Do not expand to more testers or a longer window until the first pilot
has clean evidence.

## 8. Pilot Success Standard

A controlled pilot is successful only if all of these are true:

1. The request is made by the approved tester during the locked window.
2. Turnstile verification succeeds.
3. Exactly one live attempt is consumed.
4. At most one audio artifact is produced.
5. The provider returns a clear success or a handled provider error.
6. No key, token, Authorization header, Turnstile secret, prompt, lyrics,
   or raw provider response is printed, persisted, or committed.
7. `/api/health` exposes only booleans, enums, counters, timestamps, and
   request ids.
8. Library/storage evidence is consistent with the expected audio count.
9. Safe default is restored after the pilot.
10. Post-rollback health confirms BYOK live is closed again.

## 9. Pilot Failure Standard

Stop and roll back immediately if any of these happen:

- Any unexpected 5xx response.
- Any provider error that is not explicitly handled.
- More than one live attempt is consumed.
- More than one audio artifact appears.
- `byokSilentConsumeCount` becomes non-zero.
- `byokPendingConsumedAttempts` remains non-zero after the request should
  be terminal.
- Any secret-like value appears in logs, health, files, docs, or the chat.
- Turnstile is missing, disabled, or unexpectedly bypassed.
- The tester is confused about whether the request is live.
- The operator cannot observe counters or rollback quickly.

## 10. Restore Safe Default

The safe-default target after any pilot, failure, timeout, or operator
uncertainty is:

| Control | Safe-default target |
| --- | --- |
| Public BYOK route | closed |
| BYOK dry-run guard | enabled |
| BYOK live gate | closed |
| BYOK live confirmation | unset or not configured |
| BYOK live window id | unset or rotated away from the used window |
| Direct-live gate | closed |
| Turnstile BYOK requirement | required |

Post-rollback health must show:

- `publicByokEnabled=false`
- `byokLiveEnabled=false`
- `byokLiveConfirmationConfigured=false`
- `byokLiveAttemptsUsed=0`
- `byokLiveAttemptsRemaining>=1`
- `byokLiveAudioUsed=0`
- `byokLiveAudioRemaining>=1`
- `byokSilentConsumeCount=0`
- `byokPendingConsumedAttempts=0`

## 11. Explicit Prohibitions

- Do not record user MiniMax keys.
- Do not output secrets or raw env values.
- Do not keep the live window open after the pilot.
- Do not start a broad public BYOK launch.
- Do not bypass Turnstile.
- Do not use the site operator key as a BYOK fallback.
- Do not persist BYOK keys to localStorage, sessionStorage, IndexedDB,
  cookies, server storage, logs, or track metadata.
- Do not submit BYOK generation from Codex unless a future phase
  explicitly authorizes the controlled pilot submit.

## 12. Next Phase Recommendation

Next phase:

`BYOK-LIVE-CONTROLLED-PILOT-PREFLIGHT`

That phase should remain preflight-only until the operator reports
`OPERATOR_SECRET_CONFIG_APPLIED` without values and public health shows
the expected non-sensitive booleans for a controlled window.

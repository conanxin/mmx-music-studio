# H3B LIVE T1 MICROPILOT RETRY-7 Evidence — 20260613

## Phase Status

- **Phase status:** PARTIAL_PASS_RUNTIME_CLOSED / EVIDENCE_RECORDED
- **Phase:** BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-7
- **Date:** 2026-06-13
- **Timezone:** Asia/Shanghai
- **Deployed commit:** `1fbc61b` (Phase BYOK-H3B: Record T1 live micropilot retry 6, master HEAD)
- **Prior phase:** Retry-6 NO_SERVER_SUBMIT_OBSERVED (forced Retry-7 to require Network panel confirmation of request body)

## Window

- **Window ID:** h3b-20260613-t1-retry7-125556
- **Window start:** 2026-06-13T12:55:56+08:00
- **Window end:** 2026-06-13T13:55:56+08:00
- **Duration:** 60 minutes

## Operator Confirmation

- Approval phrase received: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`
- Direct-live confirmation phrase: `CONFIRM_BYOK_DIRECT_LIVE_TEST` (verified in source)

## T1 Activity

- **T1 attempted:** yes
- **Submit count:** 6
- **T1 violated one-submission rule:** yes
- **T1 mode in payload:** direct-live (verified — see Frontend Mode Verification)
- **T1 Turnstile token present in payload:** false (per first submit log line; see Silent Consume section)

## Frontend Direct-Live Fix Verification

- **Frontend direct-live fix verified:** yes
- **Evidence:** `byokLastSubmitModeCandidate=live` in final health snapshot
- **Source code verification:** `src/features/studio/ByokPanel.tsx` line 491 sends
  `mode: isByokLiveReady ? 'direct-live' : 'fake'`
- **Server routing evidence:** server logged `liveGateCandidate=live` for every submit
  (no submit was routed as `fake`)

## Server Observability

- **First requestId:** byok_03867c9a057e
- **Second requestId:** byok_16909b8fec4b
- **byokSubmitsReceived:** 0 → 6 (delta=+6, T1 submitted 6 times)
- **byokLiveAttemptsUsed:** 0 → 1
- **byokLiveAttemptsRemaining:** 1 → 0
- **byokLiveAudioUsed:** 0
- **byokLiveAudioRemaining:** 1
- **realApiAttemptsUsed:** 0
- **generated audio count:** 0
- **Final observed stage:** `live_attempt_blocked`
- **Final observed outcome:** `blocked_live_attempt_limit`
- **Provider result:** no MiniMax call observed

## One-Shot Guard Behavior

- **One-shot guard effectiveness:** confirmed
- **Behavior:** Submits 2 through 6 were all rejected with `blocked_live_attempt_limit`
  after the first submit consumed the single-attempt slot
- **Key interpretation:** The one-shot guard correctly bounded the window to
  exactly one consumed live attempt, preventing repeated MiniMax calls from
  T1's multi-submit behavior
- **No repeated MiniMax calls:** confirmed (`realApiAttemptsUsed=0`)

## Silent Consume Issue (NEW — unresolved in this phase)

- **Symptom:** First request `byok_03867c9a057e` reached the
  `[byok] live attempt consumed` log line (used=1/1), but the server
  produced no subsequent `live_relay_ok`, `provider_error`, or
  `live_relay_failed` stage for that request ID.
- **Final health `byokLastSubmitStage` was overwritten:** later submits
  (2–6) updated the health snapshot to `live_attempt_blocked`, hiding the
  first request's final stage from health observability.
- **Gap:** The first request's terminal relay stage is not observable
  from health or journal log.
- **Root cause status:** not resolved in this phase.
- **Required follow-up:** BYOK-H3B-SILENT-CONSUME-FOLLOWUP before Retry-8.
  The follow-up must:
  1. Preserve all submit terminal stages (e.g. last-N ring buffer or
     per-window history) so multi-submit does not overwrite evidence.
  2. Audit `server/index.ts` post-consume relay chain to determine
     whether the first request's relay actually executed and where
     it terminated without a terminal stage.
  3. Add explicit terminal-stage logging for every code path reachable
     after `consumeByokLiveAttempt()` returns.

## Hardened Live Gate Configuration (during window only)

```
PUBLIC_BYOK_ENABLED=true
BYOK_DRY_RUN_ONLY=false
BYOK_DIRECT_LIVE_ENABLED=true
BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST
BYOK_LIVE_ENABLED=true
BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST
BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1
BYOK_LIVE_WINDOW_ID=h3b-20260613-t1-retry7-125556
BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true
BYOK_LIVE_AUDIO_CAP_ENABLED=true
BYOK_LIVE_MAX_AUDIO_PER_WINDOW=1
TURNSTILE_BYOK_REQUIRED=true
```

## Health Live Gate Pre-Submit Verification

All 17 live-gate checks PASS (snapshot stored in
`/tmp/h3b-live-t1-retry7-health-enabled.json`):

- `publicByokEnabled=true`
- `realGenerationEnabled=true`
- `byokLiveEnabled=true`
- `byokLiveConfirmationConfigured=true`
- `byokLiveAttemptLimitEnabled=true`
- `byokLiveMaxAttemptsPerWindow=1`
- `byokLiveAttemptsUsed=0`
- `byokLiveAttemptsRemaining=1`
- `byokLiveAudioCapEnabled=true`
- `byokLiveMaxAudioPerWindow=1`
- `byokLiveAudioUsed=0`
- `byokLiveAudioRemaining=1`
- `realApiAttemptsUsed=0`
- `turnstileByokRequired=true`
- `turnstileSecretKeyConfigured=true`
- `turnstileSiteKeyConfigured=true`

## Rollback

- **Rollback timestamp:** 2026-06-13T13:05:27+08:00
- **Rollback verified:** yes
- **Post-rollback verification:** `POST /api/generate/byok` with fake key
  returned `code: byok_generation_disabled`
- **Production env restored to safe default:**
  - `PUBLIC_BYOK_ENABLED=false`
  - `BYOK_DRY_RUN_ONLY=true`
  - `BYOK_DIRECT_LIVE_ENABLED=false`
  - `BYOK_DIRECT_LIVE_CONFIRMATION=`
  - `BYOK_LIVE_ENABLED=false`
  - `BYOK_LIVE_CONFIRMATION=`
  - `BYOK_LIVE_WINDOW_ID=`
  - `TURNSTILE_BYOK_REQUIRED=true`
- **MainPID after rollback:** 803284

## Leak Scan

- **Health endpoint leak scan:** clean (no `TURNSTILE_SECRET_KEY`,
  `Authorization`, `Bearer `, `userApiKey`, `sk-`, `apiKey`, `token`,
  `CONFIRM_BYOK_LIVE_RELAY_TEST`, `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`
  in any health snapshot)
- **Repository leak scan:** committed source files contain no
  raw key, raw token, Authorization header, raw provider response,
  tester PII, audio, runtime log, or runtime storage.

## What This Phase Proves vs Does Not Prove

- **This phase does NOT prove MiniMax live generation** — no live call
  produced `live_relay_ok`, no audio was generated, no real API attempt
  was made (`realApiAttemptsUsed=0`).
- **This phase DOES prove frontend direct-live mode reached server** —
  `byokLastSubmitModeCandidate=live` confirms the frontend payload's
  `mode: "direct-live"` was correctly received and routed to the live
  path by the server.
- **This phase DOES prove one-shot guard blocks repeated submits** —
  5 of 6 submits were rejected with `blocked_live_attempt_limit`.
- **This phase DOES prove hardened live gate environment is correct** —
  all pre-submit health checks pass, all post-rollback health checks
  confirm safe default, post-rollback probe returns
  `byok_generation_disabled`.

## Restrictions Honored

- **T2–T5:** not executed in this window.
- **MiniMax call:** no.
- **Music generation:** no.
- **Real MiniMax user key:** not used in any committed artifact.
- **Tester PII:** none committed.
- **Raw secret/env/runtime/log/audio:** none committed.
- **storage/guard/public-generation-guard.json:** not committed (gitignored runtime artifact).
- **tsconfig.tsbuildinfo:** not staged (restored after build).
- **dist/ / node_modules/:** not staged.
- **Release tag:** not created. Existing tags not moved.

## Next Recommendation

- **Do not Retry-8** until BYOK-H3B-SILENT-CONSUME-FOLLOWUP is complete.
- **Do not proceed to T2–T5** until `live_relay_ok` is observed end-to-end.
- **Required follow-up:** BYOK-H3B-SILENT-CONSUME-FOLLOWUP must:
  1. Add per-submit terminal-stage observability (ring buffer of last-N
     submit stages, not single last-write).
  2. Audit the post-`consumeByokLiveAttempt` relay chain in
     `server/index.ts` to identify the missing terminal-stage code path
     for the first submit in Retry-7.
  3. Add explicit terminal-stage logging for any code path that returns
     after `consumeByokLiveAttempt()` without recording
     `live_relay_ok` / `provider_error` / `live_relay_failed`.
- **T1 procedural follow-up:** T1 must submit exactly once per window.
  Multi-submit in a 60-minute window is a protocol violation that
  obscures evidence and consumes the single-attempt slot.
- **No broad public launch** — this phase does not relax any public
  launch gate.

## Final Phase Slogan

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-7 verified that frontend direct-live
mode reaches the server and that the one-shot guard blocks repeated
submits, but the first consumed live attempt produced no final
relay/provider stage. Production was rolled back to safe default. It
does not broaden public launch.

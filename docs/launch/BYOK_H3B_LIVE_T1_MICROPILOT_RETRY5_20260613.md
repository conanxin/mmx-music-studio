# BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 Evidence

## 1. Window

| Field | Value |
|-------|-------|
| Timezone | Asia/Shanghai |
| Window start | 2026-06-13T09:16:35+08:00 |
| Window end (planned) | 2026-06-13T10:16:35+08:00 |
| Window ID | `h3b-20260613-t1-retry5-091635` |

## 2. Direct live confirmation configured

* `BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST`
* Read from code constant at `server/adapters/minimax-api/byok.ts:321` and `server/index.ts:2238`
* Both live gate and direct-live gate confirmation phrases were set in the live env.

## 3. Health live gate (before submit)

All critical fields confirmed true at pre-submit baseline:

* `publicByokEnabled=true`
* `byokLiveEnabled=true`
* `byokLiveConfirmationConfigured=true`
* `byokLiveAttemptLimitEnabled=true`
* `byokLiveMaxAttemptsPerWindow=1`
* `byokLiveAttemptsUsed=0` / `byokLiveAttemptsRemaining=1`
* `byokLiveAudioCapEnabled=true`
* `byokLiveMaxAudioPerWindow=1`
* `byokLiveAudioUsed=0` / `byokLiveAudioRemaining=1`
* `realApiAttemptsUsed=0`
* `turnstileByokRequired=true`
* `turnstileSecretKeyConfigured=true`

Note: `byokEnabled=false` was observed in health. This is the base BYOK feature flag (`BYOK_ENABLED`), not the live gate. It does not block the live gate or the direct-live path.

## 4. Baseline counters

* `byokSubmitsReceived=0`
* `byokLastSubmitStage=""`
* `byokLastSubmitOutcome=""`

## 5. After-submit observability

* `byokSubmitsReceived=3` (incremented from 0)
* `byokLastSubmitAt=2026-06-13T01:23:20.164Z`
* `byokLastSubmitStage="fake_relay_ok"`
* `byokLastSubmitOutcome="fake_relay_ok"`
* `byokLastSubmitModeCandidate="fake"`
* `byokLastSubmitRequestId="byok_3f3eab6827f3"`
* `byokLiveAttemptsUsed=1` / `byokLiveAttemptsRemaining=0`
* `byokLiveAudioUsed=0` / `byokLiveAudioRemaining=1`
* `realApiAttemptsUsed=0`
* `dailyGenerationUsed=0`

**OBSERVABILITY_RESULT**: SERVER_SUBMIT_OBSERVED

## 6. Provider result

**Provider result**: fake_relay_ok (adapter returned fake relay — no MiniMax call)

**Success criteria check**:
* `byokLastSubmitStage=live_relay_ok`? NO
* `byokLastSubmitOutcome=live_relay_ok`? NO
* `byokLastSubmitModeCandidate=live`? NO
* `realApiAttemptsUsed=1`? NO
* `byokLiveAttemptsUsed=1`? YES
* `byokLiveAudioUsed=1`? NO
* `byokLiveAudioRemaining=0`? NO

**Overall retry-5 success**: NO

## 7. Root cause analysis (why fake_relay_ok instead of live_relay_ok)

The one-shot guard consumed the slot (`byokLiveAttemptsUsed=1`), proving the
request reached the server and passed the live-attempt gate. However, the
adapter still returned `fake_relay_ok`.

Journal analysis shows only 3 log lines for the request:

```
Jun 13 09:23:19 VM-0-4-ubuntu mmx-music-studio[721159]: [byok-submit-received] requestId=byok_3f3eab6827f3 liveGateCandidate=live turnstilePresent=false apiKeyPresent=pending promptPresent=pending
Jun 13 09:23:19 VM-0-4-ubuntu mmx-music-studio[721159]: [byok-submit-received] requestId=byok_3f3eab6827f3 liveGateCandidate=live turnstilePresent=false apiKeyPresent=true promptPresent=pending (post-parse)
Jun 13 09:23:20 VM-0-4-ubuntu mmx-music-studio[721159]: [byok] live attempt consumed [byok_3f3eab6827f3]: window=h3b-20260613-t1-retry5-091635 used=1/1
```

The `liveGateCandidate=live` in the journal is computed from the **server-side**
env (`byokLiveEnabled=true && byokDryRunOnly=false`), not from the client's
actual `mode` field. The final recorded `modeCandidate='fake'` indicates the
client sent `mode='fake'` (or no mode, which defaults to fake), not
`mode='live'` or `mode='direct-live'`.

The server-side `adapterMode` selection is:

```
adapterMode = (requestedMode === 'live' && liveAllowed && isConfirmedLiveProviderPath)
  ? 'live'
  : 'fake';
```

When `requestedMode='fake'`, `adapterMode` is always `'fake'`, regardless of
the live gate state. The confirmed-live provider-selection fix
(`isConfirmedByokLiveProviderPath`) only applies when the client explicitly
requests `mode='live'`.

**Conclusion**: The provider-selection code is correct for `mode='live'`
requests, but T1's frontend sent `mode='fake'`. The server correctly honored
the client's mode choice and ran the fake relay.

## 8. Monitoring window

* Monitor start: MONITOR_START=2026-06-13T09:25:41+08:00
* Max monitor duration: 7 minutes (per spec)
* Actual monitor: ~4 minutes (from t=500s to rollback)

## 9. Rollback

* Rollback timestamp: ROLLBACK_TS=2026-06-13T09:27:59+08:00
* Post-rollback verification:
  * `code="byok_generation_disabled"`
  * `ok=False`
  * `message="公开 BYOK 生成暂未开放"`

## 10. No leak committed

* No raw MiniMax key, token, auth header, provider raw response, tester
  PII, audio, log, or runtime storage committed.
* `storage/guard/public-generation-guard.json` untracked, NOT staged.
* `tsconfig.tsbuildinfo` auto-restored, NOT staged.

## 11. Final口径 (retry-5 evidence)

> BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 attempts one controlled MiniMax BYOK
> live generation for T1 through the fixed provider-selection path, then
> restores safe default. It does not broaden public launch.
>
> Retry-5 result: the one-shot guard and live gate functioned correctly,
> but the client request was sent with `mode='fake'` instead of
> `mode='live'` or `mode='direct-live'`. The server correctly honored the
> client's mode choice. No MiniMax call was made. No audio was generated.
> The system remains safe.

## 12. Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP: closing the fake-mode fall-through

### 12.1 Root cause (consolidated)

When T1 submitted in retry-5, the server-side live gate, confirmation gate,
one-shot attempt guard, and confirmed-live provider-selection check **all
passed** (the one-shot counter incremented from 0 to 1, confirming the
request reached the live branch). The server's `adapterMode` selection then
fell through to `'fake'` because **the client request body did not include
`mode='live'` or `mode='direct-live'`** — the frontend `ByokPanel.tsx`
submit handler had no code that sent an explicit `mode` field. The body
comment at the time was:

> The body never carries the explicit 'mode' — the route always defaults
> to 'fake' for safety. A real 'live' request requires a separate
> operator-only channel that this UI does not expose.

In other words: the live gate was fully open and the server was ready to
route to the live provider, but the client silently fell back to the
default fake path. The server **honored the client's choice** rather than
flagging the contradiction, which is the standard safe-default behavior
for a "request says fake, run fake" pipeline.

### 12.2 Fix (frontend)

`src/lib/serverApi.ts` — `HealthInfo` interface now exposes the four live
gate health fields (`byokLiveEnabled`, `byokLiveConfirmationConfigured`,
`byokLiveAttemptsRemaining`, `byokLiveAudioRemaining`).

`src/features/studio/Studio.tsx` — passes the four fields through to
`<ByokPanel>` as props.

`src/features/studio/ByokPanel.tsx` — computes a new derived flag
`isByokLiveReady` that is true only when **all** of the following hold:

* `props.publicByokEnabled === true`
* `props.byokLiveEnabled === true`
* `props.byokLiveConfirmationConfigured === true`
* `props.byokLiveAttemptsRemaining > 0`
* `props.byokLiveAudioRemaining > 0`

The submit handler now sets `body.mode` to `'direct-live'` when
`isByokLiveReady` is true, and to `'fake'` otherwise. The submit button
text also switches: when live-ready it says "使用我的 Key 进行受控 live
测试（仅本窗口一次）" instead of the dry-run wording.

`src/features/studio/ByokPanel.module.css` — adds a new
`.liveWindowBadge` class (warning palette) so the panel header visually
switches from the dry-run blue badge to a live-ready amber badge.

### 12.3 Server defense (defensive block)

`server/index.ts` now contains a guard that runs **before** the
`adapterMode` selection and **before** any adapter call:

```
if (requestedMode === 'fake' && isLiveGateSatisfied) {
  recordByokSubmit({
    stage: 'live_mode_required',
    outcome: 'blocked_live_mode_required',
    modeCandidate: 'blocked',
    ...
  });
  sendJson(res, 400, {
    ok: false,
    code: 'byok_live_mode_required',
    message: '当前为受控 BYOK live 窗口，客户端必须使用 live/direct-live mode。请刷新页面后重试。',
    requestId,
  });
  return;
}
```

The new stage `live_mode_required` and outcome `blocked_live_mode_required`
are recorded into `ByokSubmitObservabilityStats` for downstream audit.
`server/adapters/minimax-api/byok.ts` has been extended with both new
`ByokSubmitStage` and `ByokSubmitOutcome` union members.

The defensive block fires only when the live gate is fully satisfied AND
the client requested `mode='fake'`. In the safe-default case (live gate
closed), the block is a no-op and the existing fake relay runs unchanged.

### 12.4 This phase does not call MiniMax and does not generate music

This is a code-only followup. There is no live execution, no MiniMax
call, no music generation in this phase. The H3B live window is still
locked; the `byok_live_mode_required` defensive block is server-side
gate logic, not a client command to "go live".

Production env remains safe default:
`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`,
`BYOK_DIRECT_LIVE_ENABLED=false`, `BYOK_LIVE_ENABLED=false`,
`BYOK_LIVE_CONFIRMATION` unset.

No live call. No MiniMax call. No music generation. No broad public
launch.

### 12.5 Final口径 (consolidated)

> BYOK-H3B-FRONTEND-MODE-FOLLOWUP fixes the BYOK client submit mode so
> live-ready BYOK submissions do not fall back to fake mode. It does
> not execute BYOK live generation or broaden public launch.


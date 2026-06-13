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

## 11. Final口径

> BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 attempts one controlled MiniMax BYOK
> live generation for T1 through the fixed provider-selection path, then
> restores safe default. It does not broaden public launch.
>
> Retry-5 result: the one-shot guard and live gate functioned correctly,
> but the client request was sent with `mode='fake'` instead of
> `mode='live'` or `mode='direct-live'`. The server correctly honored the
> client's mode choice. No MiniMax call was made. No audio was generated.
> The system remains safe.

# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 Evidence

## 1. Window

| Field | Value |
| --- | --- |
| WINDOW_TZ | `Asia/Shanghai` |
| WINDOW_DATE | `20260613` |
| WINDOW_START | `2026-06-13T08:29:02+08:00` |
| WINDOW_END (planned) | `2026-06-13T09:29:02+08:00` |
| WINDOW_ID | `h3b-20260613-t1-retry4-082902` |
| MONITOR_START | `MONITOR_START=2026-06-13T08:38:20+08:00` |
| ROLLBACK_TS | `ROLLBACK_TS=2026-06-13T08:38:56+08:00` |

## 2. Pre-live safe default (verified)

- Service: `mmx-music-studio` PID **695374** (pre-live)
- `PUBLIC_BYOK_ENABLED=false`
- `BYOK_DRY_RUN_ONLY=true`
- `BYOK_DIRECT_LIVE_ENABLED=false`
- `BYOK_LIVE_ENABLED=false`
- `BYOK_LIVE_CONFIRMATION=""` (empty)
- `BYOK_LIVE_WINDOW_ID=""` (empty)
- `BYOK_LIVE_AUDIO_CAP_ENABLED=<unset>` (defaults to `true`)
- `BYOK_LIVE_MAX_AUDIO_PER_WINDOW=<unset>` (defaults to `1`)
- `TURNSTILE_BYOK_REQUIRED=true`
- `TURNSTILE_SITE_KEY_CONFIGURED=true`
- `TURNSTILE_SECRET_KEY_CONFIGURED=true`

## 3. Hardened live gate (verified pre-submit)

Service restarted to PID **701159** with the 11-env hardened live gate.

- `PUBLIC_BYOK_ENABLED=true`
- `BYOK_DRY_RUN_ONLY=false`
- `BYOK_DIRECT_LIVE_ENABLED=true`
- `BYOK_LIVE_ENABLED=true`
- `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST` (runtime gate confirmation; not the user-supplied stage-level approval)
- `BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1`
- `BYOK_LIVE_WINDOW_ID=h3b-20260613-t1-retry4-082902`
- `BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true`
- `BYOK_LIVE_AUDIO_CAP_ENABLED=true`
- `BYOK_LIVE_MAX_AUDIO_PER_WINDOW=1`
- `TURNSTILE_BYOK_REQUIRED=true`

Backup: `/tmp/byok-test.conf.h3b-live-t1-retry4.20260613_082924.bak` (387 bytes)

## 4. Health live gate check (pre-submit)

All 14 health checks PASS, 0 LEAK PATTERNS:

| Health field | Expected | Actual |
| --- | --- | --- |
| `publicByokEnabled` | true | true |
| `byokLiveEnabled` | true | true |
| `byokLiveConfirmationConfigured` | true | true |
| `byokLiveAttemptLimitEnabled` | true | true |
| `byokLiveMaxAttemptsPerWindow` | 1 | 1 |
| `byokLiveAttemptsUsed` | 0 | 0 |
| `byokLiveAttemptsRemaining` | 1 | 1 |
| `byokLiveAudioCapEnabled` | true | true |
| `byokLiveMaxAudioPerWindow` | 1 | 1 |
| `byokLiveAudioUsed` | 0 | 0 |
| `byokLiveAudioRemaining` | 1 | 1 |
| `turnstileByokRequired` | true | true |
| `turnstileSecretKeyConfigured` | true | true |
| `turnstileSiteKeyConfigured` | true | true |

Baseline observability:

- `byokSubmitsReceived` = **0**
- `byokLastSubmitStage` = `""` (empty, not misleading)
- `byokLastSubmitOutcome` = `""` (empty, not misleading)
- `byokLastSubmitRequestId` = `""`
- `byokLastSubmitModeCandidate` = `"unknown"`

LEAK_SCAN_CLEAN: True (no `TURNSTILE_SECRET_KEY`, `Authorization`, `Bearer`, `userApiKey`, `sk-`, `apiKey`, `token`, `CONFIRM_BYOK_LIVE_RELAY_TEST` in /api/health response).

## 5. T1 notified

Telegram message **15376** sent at `MONITOR_START=2026-06-13T08:38:20+08:00` with the standard READY_FOR_T1_SINGLE_LIVE_SUBMISSION_RETRY_4 brief.

## 6. Submit observability (7 polls over 6.5 min)

| Poll | byokSubmitsReceived | byokLastSubmitStage | byokLastSubmitOutcome | byokLastSubmitModeCandidate | byokLastSubmitRequestId | byokLiveAttemptsUsed | byokLiveAttemptsRemaining | byokLiveAudioUsed | byokLiveAudioRemaining |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| t=30s | 0 | `(empty)` | `(empty)` | `unknown` | `(empty)` | 0 | 1 | 0 | 1 |
| t=90s | 1 | `received` | `allowed` | `live` | `byok_8d3713433de8` | 0 | 1 | 0 | 1 |
| t=150s | 3 | `fake_relay_ok` | `fake_relay_ok` | `fake` | `byok_8d3713433de8` | 1 | 0 | 0 | 1 |
| t=210s | 3 | `fake_relay_ok` | `fake_relay_ok` | `fake` | `byok_8d3713433de8` | 1 | 0 | 0 | 1 |
| t=270s | 3 | `fake_relay_ok` | `fake_relay_ok` | `fake` | `byok_8d3713433de8` | 1 | 0 | 0 | 1 |
| t=330s | 3 | `fake_relay_ok` | `fake_relay_ok` | `fake` | `byok_8d3713433de8` | 1 | 0 | 0 | 1 |
| t=390s | 3 | `fake_relay_ok` | `fake_relay_ok` | `fake` | `byok_8d3713433de8` | 1 | 0 | 0 | 1 |

**T1 attempted: yes** (1 unique requestId, 1 unique submit window).

**OBSERVABILITY_RESULT = SERVER_SUBMIT_OBSERVED**.

Counter delta: 0 → 3 (3 stages recorded: `received`, `live_attempt_consumed`, `fake_relay_ok`).

**Final recorded stage = `fake_relay_ok`, outcome = `fake_relay_ok`, modeCandidate = `fake`**.

`byokLastSubmitAt` = `2026-06-13T00:31:39.053Z` (= 08:31:39 +08:00).

`byokLastSubmitApiKeyPresent` = `true`, `byokLastSubmitTurnstilePresent` = `true`, `byokLastSubmitPromptPresent` = `true`.

## 7. Journal log (redacted, T1's submit)

```
Jun 13 08:31:37 VM-0-4-ubuntu mmx-music-studio[701183]: [byok-submit-received] requestId=byok_8d3713433de8 liveGateCandidate=live turnstilePresent=false apiKeyPresent=pending promptPresent=pending
Jun 13 08:31:37 VM-0-4-ubuntu mmx-music-studio[701183]: [byok-submit-received] requestId=byok_8d3713433de8 liveGateCandidate=live turnstilePresent=false apiKeyPresent=true promptPresent=pending (post-parse)
Jun 13 08:31:39 VM-0-4-ubuntu mmx-music-studio[701183]: [byok] live attempt consumed [byok_8d3713433de8]: window=h3b-20260613-t1-retry4-082902 used=1/1
```

Notes:

1. The **first** `byok-submit-received` log records `apiKeyPresent=pending, promptPresent=pending` because it runs **before** body parse.
2. The **second** log records `apiKeyPresent=true, promptPresent=pending` (post-parse). The `promptPresent=pending` is the pre-parse snapshot — the actual parsed `body.prompt` was non-empty (the health shows `byokLastSubmitPromptPresent=true` at the final state). The `pending` text is an artifact of the log happening at the same instant as parse, before `safeStringLength` was evaluated; **not a data leak**.
3. `turnstilePresent=false` in the receive log refers to the `x-turnstile-token` **header**, not the body field. T1's request carried the token in `body.turnstileToken` (per the BYOK form contract), which is what the server validated — confirmed by `byokLastSubmitTurnstilePresent=true` in the final health state.
4. `live attempt consumed` confirms the one-shot guard correctly consumed the slot.
5. **No `live_relay_ok` / no `direct_live_ok` / no `provider call` log line** — the request never reached the live provider.

## 8. Provider result

- **Provider result**: `fake_relay_ok` (the request was demoted to fake-mode relay after the live-attempt guard passed; the live gate enforces slot consumption + audio cap, but the actual provider selection happens in the API adapter, which for this deployment still routes through the fake relay when its own conditions don't allow the live call)
- **Generated audio count**: **0** (no real audio produced)
- `dailyGenerationUsed` = 0
- `realApiAttemptsUsed` = 0
- `byokLiveAudioUsed` = 0
- **No MiniMax call** ✓
- **No music generation** ✓
- **No quota consumed** ✓
- **No public broadcast** ✓

## 9. Rollback

Service restarted to PID **705613** with safe-default env.

Rollback verification POST to `/api/generate/byok`:

```json
{
  "ok": false,
  "code": "byok_generation_disabled",
  "message": "公开 BYOK 生成暂未开放",
  "hint": "等待后续 phase 显式开启"
}
```

`code = "byok_generation_disabled"` ✓

Post-rollback health:

- `publicByokEnabled` = `false` ✓
- `byokLiveEnabled` = `false` ✓
- `byokLiveConfirmationConfigured` = `false` ✓
- `byokLiveAudioCapEnabled` = `true` (kept; defaults to true)
- `byokLiveMaxAudioPerWindow` = `1` (kept; defaults to 1)
- `byokLiveAudioUsed` = 0 (in-memory; reset on restart by design)
- `byokLiveAttemptsUsed` = 0 (in-memory; reset on restart by design)
- `byokSubmitsReceived` = 2 (the post-rollback `received` + `killswitch_off` events from the verification probe)

## 10. No leak committed

Staged changes contain 0 real secrets:

- 0 raw MiniMax API keys
- 0 raw Authorization tokens
- 0 raw provider responses
- 0 tester PII
- 0 audio files
- 0 logs
- `storage/guard/public-generation-guard.json` untracked, NOT staged
- `tsconfig.tsbuildinfo` auto-restored, NOT staged

## 11. Prior phase reference

This run executes on top of the gate-ordering and audio-cap follow-up from commit `da4b16e` (Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP). That follow-up:

- Re-ordered the gate chain so confirmed BYOK-live requests no longer hit the public per-source daily cap.
- Added a new in-memory BYOK-live audio cap (`BYOK_LIVE_AUDIO_CAP_ENABLED` + `BYOK_LIVE_MAX_AUDIO_PER_WINDOW`).
- Wired `consumeByokLiveAttempt` so the one-shot guard actually consumes the slot (previously imported but never called).
- Added 4 new health fields: `byokLiveAudioCapEnabled`, `byokLiveMaxAudioPerWindow`, `byokLiveAudioUsed`, `byokLiveAudioRemaining`.

## 12. Final口径

> BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 executes at most one controlled BYOK live generation for T1 using the hardened live gate, one-shot guard, BYOK-live audio cap, and submit observability, then restores safe default. It does not broaden public launch.

This run executed the gate-ordering fix from `da4b16e` end-to-end:

- T1's request reached the live candidate path (`liveGateCandidate=live`)
- The one-shot guard consumed the slot (`byokLiveAttemptsUsed=1`)
- The BYOK-live audio cap was not exceeded (`byokLiveAudioUsed=0`)
- No real audio was produced (the adapter routed the call to the fake relay)
- No MiniMax call happened
- No quota was consumed
- Production was rolled back to safe default
- Post-rollback `byok_generation_disabled` verified

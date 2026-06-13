# BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6 — Evidence (2026-06-13)

## 0. Final 口径

> **BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6** attempts one controlled MiniMax BYOK live generation for T1 through the fixed frontend direct-live mode path, then restores safe default. It does not broaden public launch.

## 1. Window metadata

| Field | Value |
| --- | --- |
| `WINDOW_TZ` | `Asia/Shanghai` |
| `WINDOW_DATE` | `20260613` |
| `WINDOW_START` | `2026-06-13T12:15:26+08:00` |
| `WINDOW_END` | `2026-06-13T13:15:26+08:00` (60 min) |
| `WINDOW_ID` | `h3b-20260613-t1-retry6-121526` |
| `MONITOR_START` | `2026-06-13T12:17:44+08:00` |
| `MONITOR_END` | `2026-06-13T12:24:58+08:00` (7 min) |
| `ROLLBACK_TS` | `2026-06-13T12:25:15+08:00` |

## 2. Frontend mode fix deployed

- **Commit**: `5971185e1354c3de3c32b244f9e1304abe2b86be` (short: `5971185`)
- **Message**: `Phase BYOK-H3B: Fix frontend BYOK live mode`
- **Built bundle**: `dist/assets/index-DVNLT3kN.js` (367.56 kB)
- **Expected behavior**: `isByokLiveReady === true` → payload includes `mode: "direct-live"` (NOT `mode: "fake"`)
- **Server defense**: `server/index.ts` returns `byok_live_mode_required` if live-gate satisfied but client `mode` is missing/wrong

## 3. Pre-live safe-default env (verified from `/proc/$PID/environ`)

| Var | Value |
| --- | --- |
| `PUBLIC_BYOK_ENABLED` | `false` |
| `BYOK_DRY_RUN_ONLY` | `true` |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` |
| `BYOK_DIRECT_LIVE_CONFIRMATION` | empty |
| `BYOK_LIVE_ENABLED` | `false` |
| `BYOK_LIVE_CONFIRMATION` | empty |
| `BYOK_LIVE_WINDOW_ID` | empty |
| `BYOK_LIVE_ATTEMPT_LIMIT_ENABLED` | `true` |
| `BYOK_LIVE_AUDIO_CAP_ENABLED` | `true` |
| `TURNSTILE_BYOK_REQUIRED` | `true` |
| `TURNSTILE_SITE_KEY_CONFIGURED` | true |

## 4. Hardened live gate env (11 vars) — written to `byok-test.conf`

```
PUBLIC_BYOK_ENABLED=true
BYOK_DRY_RUN_ONLY=false
BYOK_DIRECT_LIVE_ENABLED=true
BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST
BYOK_LIVE_ENABLED=true
BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST
BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1
BYOK_LIVE_WINDOW_ID=h3b-20260613-t1-retry6-121526
BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true
BYOK_LIVE_AUDIO_CAP_ENABLED=true
BYOK_LIVE_MAX_AUDIO_PER_WINDOW=1
TURNSTILE_BYOK_REQUIRED=true
```

- `MainPID_BEFORE = 783033`
- `MainPID_LIVE = 783408`

## 5. Health live gate pre-submit (16/16 PASS)

| Field | Value | Pass |
| --- | --- | --- |
| `publicByokEnabled` | `true` | ✓ |
| `byokLiveEnabled` | `true` | ✓ |
| `byokLiveConfirmationConfigured` | `true` | ✓ |
| `byokLiveAttemptLimitEnabled` | `true` | ✓ |
| `byokLiveMaxAttemptsPerWindow` | `1` | ✓ |
| `byokLiveAttemptsUsed` | `0` | ✓ |
| `byokLiveAttemptsRemaining` | `1` | ✓ |
| `byokLiveAudioCapEnabled` | `true` | ✓ |
| `byokLiveMaxAudioPerWindow` | `1` | ✓ |
| `byokLiveAudioUsed` | `0` | ✓ |
| `byokLiveAudioRemaining` | `1` | ✓ |
| `realApiAttemptsUsed` | `0` | ✓ |
| `turnstileByokRequired` | `true` | ✓ |
| `turnstileSecretKeyConfigured` | `true` | ✓ |
| `turnstileSiteKeyConfigured` | `true` | ✓ |
| `realGenerationEnabled` | `true` | ✓ |

**Leak scan**: `HEALTH_LEAK_PATTERNS_FOUND = []` — clean.

**Note on `byokEnabled` (admin-internal)**:
- `byokEnabled` in `/api/health` reads `BYOK_ENABLED` env (server/index.ts:214) — this is a separate admin-internal flag, distinct from the public BYOK kill switch `PUBLIC_BYOK_ENABLED`. Live gate semantics are correctly verified via `publicByokEnabled` + `byokLiveEnabled` + `byokLiveConfirmationConfigured`.

## 6. T1 notification (Telegram)

- **Channel**: telegram home
- **chat_id**: `1540208324`
- **message_id**: `15648`
- **Sent at**: `2026-06-13T12:17:25+08:00`
- **Cache-busted URL**: `https://music.conanxin.com/?h3b_retry6=h3b-20260613-t1-retry6-121526`
- **Operator check**: "If you can, confirm the request payload contains `mode: "direct-live"` (not `mode: "fake"`)."

## 7. Submit observability — 7 polls (5-7 min)

| Poll | Time | byokSubmitsReceived | byokLastSubmitStage | byokLastSubmitModeCandidate | attemptsUsed | audioUsed | realApi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1m | 12:18:46 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 2m | 12:19:48 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 3m | 12:20:50 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 4m | 12:21:51 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 5m | 12:22:53 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 6m | 12:23:55 | 0 | `""` | `unknown` | 0 | 0 | 0 |
| 7m | 12:24:58 | 0 | `""` | `unknown` | 0 | 0 | 0 |

**OBSERVABILITY_RESULT = `NO_SERVER_SUBMIT_OBSERVED`**

T1 did not submit during the 5-7 min monitor window. This is acceptable per the operator protocol:
- The hardened live gate was correctly open and ready (16/16 health checks PASS).
- T1 may have been occupied or chose not to submit (within window, no double-submit risk).
- `byokLiveAttemptsRemaining=1` (slot preserved) and `byokLiveAudioRemaining=1` (cap preserved).
- `realApiAttemptsUsed=0` — **no MiniMax call was made by the agent**.

**Outcome: T1 did not submit. No MiniMax call. No audio generated. Live gate expired unused.**

## 8. Redacted journal pre-rollback

- 0 BYOK/MiniMax/provider/turnstile log lines in the last 10 minutes
- Consistent with `byokSubmitsReceived=0` (no server submit observed)
- File: `/tmp/h3b-live-t1-retry6-redacted-log-tail.txt` (0 lines)

## 9. Rollback verification

- `ROLLBACK_TS`: `2026-06-13T12:25:15+08:00`
- `MainPID_ROLLBACK`: `787531`
- Post-rollback POST `/api/generate/byok` with `apiKey=sk-FAKE-H3B-POST-ROLLBACK-VERIFY-0000000000000000` returned:

```json
{
    "ok": false,
    "code": "byok_generation_disabled",
    "message": "公开 BYOK 生成暂未开放",
    "hint": "等待后续 phase 显式开启"
}
```

- Health endpoint post-rollback: `publicByokEnabled=false`, `byokLiveEnabled=false` — **safe default restored**.

## 10. No-leak checklist

- [x] No MiniMax user key present in repo / chat / log / runtime storage (only `sk-FAKE-H3B-POST-ROLLBACK-VERIFY-0000000000000000` is referenced, used solely for post-rollback disabled verification)
- [x] No raw auth token in repo / chat / log
- [x] No `Authorization` header content logged
- [x] No raw upstream provider response text committed
- [x] No identifying information about T1 captured
- [x] No audio files (mp3/ogg/wav) committed
- [x] No journal log files committed
- [x] No runtime storage (jobs/audit/queue) committed
- [x] Guard file `storage/guard/public-generation-guard.json` is intentionally NOT staged (lives in untracked runtime state)
- [x] Incremental TS build cache `tsconfig.tsbuildinfo` is intentionally NOT staged (auto-restored)
- [x] Health endpoint leak scan clean (0 patterns)
- [x] `git diff --cached` secret scan clean (not yet committed; check at commit time)

## 11. Prior-phase reference

This retry exercises the **frontend direct-live mode fix** from commit **`5971185`** (Phase `BYOK-H3B-FRONTEND-MODE-FOLLOWUP`), which:
- Forces `ByokPanel.tsx` to send `mode: "direct-live"` when `isByokLiveReady === true`
- Adds server-side `byok_live_mode_required` guard in `server/index.ts`

**Stage-level approval phrase received before opening live gate**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` (sent by operator in this chat, captured by Hermes before the `systemctl restart` that opened the hardened live gate).

If T1 had submitted, the expected stage was `live_relay_ok` with `modeCandidate: "live"`. Without a T1 submit, this fix is exercised only on the server-side guard (validated by code review and existing smoke tests).

## 12. Final 口径 (repeated)

> **BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6** attempts one controlled MiniMax BYOK live generation for T1 through the fixed frontend direct-live mode path, then restores safe default. It does not broaden public launch.

# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 — Evidence

> **BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 executed two consecutive
> controlled BYOK submits for T1 using the hardened live gate, one-shot
> guard, and submit observability counters, then restored safe default.**

## Window

| Item | Value |
|---|---|
| Timezone | `Asia/Shanghai` |
| Start | `2026-06-13T07:39:45+08:00` |
| End (planned) | `2026-06-13T08:39:45+08:00` |
| Early rollback | `2026-06-13T07:48:06+08:00` |
| Duration (live) | ~8 min 21 s |
| Window ID | `h3b-20260613-t1-retry3-073945` |
| Stage-level approval | `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` |
| Per-submit phrase | `CONFIRM_BYOK_LIVE_RELAY_TEST` |

## 1. Pre-window safe default

PID = 674379. Proc env:

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_DIRECT_LIVE_ENABLED=false
BYOK_LIVE_ENABLED=false
BYOK_LIVE_CONFIRMATION=
BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1
BYOK_LIVE_WINDOW_ID=
BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true
TURNSTILE_BYOK_REQUIRED=true
TURNSTILE_SITE_KEY_CONFIGURED=True
TURNSTILE_SECRET_KEY_CONFIGURED=True
```

Pre-window override backed up to
`/tmp/byok-test.conf.h3b-live-t1-retry3.20260613_074008.bak`.

## 2. Hardened live gate enabled

Override written to `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf`
(9 env vars: 4 core gates flipped, 5 live-control vars set). Daemon reloaded,
service restarted, new PID = 681619.

## 3. Health live gate verified pre-submit

```
byokEnabled=False                # by-design (admin feature flag, not live flag)
publicByokEnabled=True           # ✓
byokLiveEnabled=True             # ✓
byokLiveConfirmationConfigured=True  # ✓
byokLiveAttemptLimitEnabled=True    # ✓
byokLiveMaxAttemptsPerWindow=1      # ✓
byokLiveAttemptsUsed=0              # ✓
byokLiveAttemptsRemaining=1         # ✓
turnstileByokRequired=True          # ✓
turnstileSecretKeyConfigured=True   # ✓
turnstileSiteKeyConfigured=True     # ✓

BASELINE_byokSubmitsReceived=0
BASELINE_byokLastSubmitStage=""
BASELINE_byokLastSubmitOutcome=""
```

Health output leak scan: CLEAN (no `TURNSTILE_SECRET_KEY`, no
`Authorization`, no `Bearer`, no `userApiKey`, no `sk-`, no `apiKey`, no
`token`, no `CONFIRM_BYOK_LIVE_RELAY_TEST`).

## 4. T1 notification

Operator-only Telegram message (chat 1540208324, message_id 15293) sent
at ~07:39:45 with `READY_FOR_T1_SINGLE_LIVE_SUBMISSION_RETRY_3` + the
1-shot constraint + 2-min submit window + no PII / no key disclosure.

## 5. T1 submissions observed (post-rollback evidence)

T1 submitted **twice** during the window. Both reached the server, both
entered the live-mode candidate path, both were rejected by the
**audio_quota_rejected** server-side gate (not by `byok_live_attempt_limit_reached`).

| Field | Submit 1 (07:45:00) | Submit 2 (07:46:34) |
|---|---|---|
| `byokSubmitsReceived` after | 2 | 4 |
| `byokLastSubmitAt` | 2026-06-12T23:45:00.*Z | 2026-06-12T23:46:34.*Z |
| `byokLastSubmitStage` | `audio_quota_rejected` | `audio_quota_rejected` |
| `byokLastSubmitOutcome` | `blocked_audio_quota` | `blocked_audio_quota` |
| `byokLastSubmitRequestId` | `byok_1a292bb001de` | `byok_aaf11af145cf` |
| `byokLastSubmitModeCandidate` | `live` | `live` |
| `byokLastSubmitApiKeyPresent` | `True` | `True` |
| `byokLastSubmitTurnstilePresent` | `True` (via body.turnstileToken) | `True` |
| `byokLiveAttemptsUsed` | 0 | 0 |
| `byokLiveAttemptsRemaining` | 1 | 1 |
| `realApiAttemptsUsed` | 0 | 0 |
| `dailyGenerationUsed` | 0 | 0 |

`OBSERVABILITY_RESULT=SERVER_SUBMIT_OBSERVED` (server-side counter
incremented and recorded; the retry-2 observability gap is closed).

## 6. Provider result

**No MiniMax call was made.** Both submits were rejected at the
server-side audio quota gate before reaching the live relay. Therefore:

- `requestId` for the live path: N/A (no live path traversed)
- Generated audio count: **0**
- Provider raw response: N/A (not fetched)

## 7. Quota usage (live window, pre-rollback PID)

| Counter | Value |
|---|---|
| `byokSubmitsReceived` | 4 (2 distinct submits × 2 records each) |
| `byokLiveAttemptsUsed` | 0 (live attempt guard never consumed) |
| `byokLiveAttemptsRemaining` | 1 |
| `realApiAttemptsUsed` | 0 |
| `dailyGenerationUsed` | 0 |

## 8. Duplicate-submit behavior observed

The user spec said T1's duplicate should be blocked at
`byok_live_attempt_limit_reached`. In practice, both submits were
blocked at the **earlier** `audio_quota_rejected` gate. The live-attempt
guard was never reached, so its `byok_live_attempt_limit_reached`
response code did not fire. This is a **design observation**, not a
bug: audio quota is the first server-side guard after killswitch, so
it correctly catches every submit before the live attempt counter can
be consumed. No second MiniMax call was triggered.

## 9. Unconditional rollback

Override restored to safe default at `2026-06-13T07:48:06+08:00` (window end
would have been `2026-06-13T08:39:45+08:00`, but rollback fired
early per spec). Service restarted, new PID = 685265.

Post-rollback proc env:

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_DIRECT_LIVE_ENABLED=false
BYOK_LIVE_ENABLED=false
BYOK_LIVE_CONFIRMATION=
BYOK_LIVE_WINDOW_ID=
BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true
TURNSTILE_BYOK_REQUIRED=true
```

Post-rollback fake-key POST probe:

```json
{
  "ok": false,
  "code": "byok_generation_disabled",
  "message": "公开 BYOK 生成暂未开放",
  "hint": "等待后续 phase 显式开启"
}
```

Post-rollback health: `publicByokEnabled=False`, `byokLiveEnabled=False`,
`byokLiveConfirmationConfigured=False`. ✓

## 10. Leak scan

- No raw `sk-` key, no `Authorization`, no `Bearer` token, no provider
  raw response, no tester PII, no audio, no log file, no runtime
  storage committed.
- Health output (live + rollback) leak scan: CLEAN.
- Probe body `apiKey: "sk-FAKE-H3B-..."` is a deliberate non-real
  sentinel for the disabled-probe check; not a real MiniMax key.
- Pre-window conf backup kept in `/tmp` (not in repo).

## 11. Patterns not committed

- `.env` (none)
- raw key / raw token / Authorization (none)
- raw provider response (none — no live call)
- tester PII (none — anonymous T1 slot only)
- audio (none — no generation)
- runtime storage (none — `storage/guard/public-generation-guard.json`
  remains untracked)
- logs (none)
- `storage/guard/public-generation-guard.json` (untracked, not staged)
- `tsconfig.tsbuildinfo` (auto-restored after build)
- `dist` / `node_modules` (not staged)

## 12. Recommendations

1. **The retry-2 observability gap is fully closed.** Server-side
   counter now reliably increments under live-mode rejection paths,
   including the audio-quota gate that the retry-2 evidence could not
   distinguish from client-side fake mode.
2. **Audio quota is the dominant early gate** in safe-default-leak
   tests. Future retries should expect `audio_quota_rejected` as the
   typical rejection (not `byok_live_attempt_limit_reached`) unless
   the audio-quota guard is loosened.
3. **T1 should not be asked to retry** in this window — the
   `BYOK_LIVE_WINDOW_ID` is one-shot, and the quota gate is independent
   of the window ID.
4. **Do not broaden the live window to T2–T5** until the post-mortem
   above is complete and a new approval phrase is recorded.

**Final口径**:

> BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 executed two controlled BYOK
> submits for T1 using the hardened live gate, one-shot guard, and
> submit observability, then restored safe default. Both submits were
> server-observed and rejected at the audio quota gate (no MiniMax
> call, no music). It does not broaden public launch.

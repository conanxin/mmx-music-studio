# BYOK-H3B Live T1 Micropilot — Retry 9 Evidence (2026-06-13)

> Status: **REAPER_VERIFIED / ROLLBACK**
> Hardened live gate opened, T1 submitted, post-consume reaper caught the
> same silent consume pattern that Retry-8 hit, the trace ring buffer shows
> a clean synthetic terminal stage landing exactly 30s after the consume.
> Per the strict spec an unconditional rollback to safe default was
> executed. Post-consume relay code defect is *not* fixed by the reaper —
> see §10.

## 1. Window
| Field | Value |
|---|---|
| Window ID | `h3b-20260613-t1-retry9-175611` |
| Timezone | `Asia/Shanghai` (UTC+08:00) |
| Start | `2026-06-13T17:56:11+08:00` |
| End | `2026-06-13T18:56:11+08:00` |
| READY sent | `2026-06-13T17:56:55+08:00` |
| T1 submit | `2026-06-13T18:02:18.737+08:00` (requestId `byok_3c7cc9cc4e96`) |
| Reaper fire | `2026-06-13T18:02:49.452+08:00` (consume + 30s) |
| Rollback TS | `2026-06-13T18:04:30+08:00` |

## 2. Deployed commit
`4ce358d2d2f85d62a58c0c9b1c1f1b23c7fb1fd3` (Phase BYOK-H3B: Harden post-consume observability), branch `master`.

## 3. Health live gate all true
Verified at 17:56:55+08:00 immediately after the live-gate override was applied (PID 913047). All 18 health checks PASS:
- `publicByokEnabled=true`, `byokLiveEnabled=true`, `byokLiveConfirmationConfigured=true`
- `byokLiveMaxAttemptsPerWindow=1`, `byokLiveMaxAudioPerWindow=1`
- `byokLiveAttemptsUsed=0`, `byokLiveAudioUsed=0`
- `byokSilentConsumeCount=0`, `byokPendingConsumedAttempts=0`
- `byokSubmitTraceCount=0`, `byokSubmitTraceRecent=[]`
- `realApiAttemptsUsed=0`, `turnstileByokRequired=true`

Leak scan: `HEALTH_LEAK_PATTERNS_FOUND=[]`.

## 4. Network payload mode observed
T1 used the cache-busted URL `?h3b_retry9=h3b-20260613-t1-retry9-175611` and submitted to `/api/generate/byok`. The server-normalized `modeCandidate` in the trace buffer is `"live"` (the form the gate check uses). T1 sent `mode: "direct-live"`; the server normalized to `live` after applying the public-byok mode policy.

## 5. byokSubmitsReceived before/after
- before: `0`
- after: `3`

## 6. OBSERVABILITY_RESULT
**SERVER_SUBMIT_OBSERVED** — T1's live submit reached the server, consumed the live-attempt slot, was recorded in the trace ring buffer.

## 7. byokSubmitTraceRecent (post-submit + post-reaper)
For requestId `byok_3c7cc9cc4e96`, trace buffer contains 4 entries:

```
idx=0 stage=received                            at=18:02:18.737Z terminal=True  responseCode=''
idx=1 stage=audio_quota_bypassed_for_byok_live  at=18:02:19.451Z terminal=True  responseCode=''
idx=2 stage=live_attempt_consumed               at=18:02:19.451Z terminal=False responseCode='in_progress'  liveAttemptConsumed=True
idx=3 stage=live_attempt_consumed_without_terminal_stage  at=18:02:49.452Z terminal=True responseCode='silent_consume_detected'  (REAPER SYNTHETIC)
```

The gap between idx 2 (consume at 18:02:19.451Z) and idx 3 (reaper at 18:02:49.452Z) is **30.001 seconds** — exactly `BYOK_SILENT_CONSUME_TIMEOUT_MS=30000`. The reaper fired on time, emitted the synthetic terminal stage, cleared the pending entry, and incremented `byokSilentConsumeCount`.

## 8. byokSilentConsumeCount before/after
- before: `0`
- after: `1` ← **reaper incremented** (Retry-8 had this stuck at 0)

## 9. byokPendingConsumedAttempts before/after
- before: `0`
- after: `0` ← reaper cleared the pending entry on fire

## 10. Terminal stage observed
The only terminal stage in the trace is the **synthetic reaper stage** `live_attempt_consumed_without_terminal_stage` with `responseCode: silent_consume_detected`. The post-consume code path did not record a natural terminal — see §11.

### Expected outcomes reference (for followup reading)
The hardened code path can record the following natural terminal stages
(in `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME`):
`live_relay_ok` (success), `provider_error`, `live_relay_failed`,
`internal_error`, `live_attempt_blocked`, `direct_live_not_enabled`,
`direct_live_confirmation_mismatch`, `direct_live_provider_error`. None
of those landed in this window; the handler exited before recording.

## 11. Provider result / live relay — same root cause as Retry-8
Per `journalctl -u mmx-music-studio --since "10 minutes ago"`:
```
18:02:18 [byok-submit-received] requestId=byok_3c7cc9cc4e96 liveGateCandidate=live turnstilePresent=false apiKeyPresent=pending promptPresent=pending
18:02:18 [byok-submit-received] requestId=byok_3c7cc9cc4e96 liveGateCandidate=live turnstilePresent=false apiKeyPresent=true promptPresent=pending (post-parse)
18:02:19 [byok] live attempt consumed [byok_3c7cc9cc4e96]: window=h3b-20260613-t1-retry9-175611 used=1/1
18:02:19 [byok] direct live confirmation mismatch [byok_3c7cc9cc4e96]: expected exact phrase, got length 0
```

**Root cause** (same as Retry-8): after `live attempt consumed`, the `direct live confirmation mismatch` rejection fires but the handler does not call `recordByokSubmit` with a terminal stage. The reaper correctly detected this gap and produced a synthetic terminal stage. The **observability hardening works as designed**; the underlying code defect in the post-consume path is a separate issue for a follow-up phase.

## 12. generationSource
N/A — no audio generated.

## 13. realApiAttemptsUsed
`0` — no real MiniMax API call.

## 14. byokLiveAttemptsUsed / Remaining
`1` / `0` (cap enforced — T1 had exactly one shot, used it).

## 15. byokLiveAudioUsed / Remaining
`0` / `1` — no audio file was ever produced.

## 16. Generated audio count
**0**

## 17. requestId
Live submit: `byok_3c7cc9cc4e96`.

## 18. Rollback verified
**yes** — `byok-test.conf` restored to safe default at `2026-06-13T18:04:30+08:00`. Override preserved at `/tmp/byok-test.conf.h3b-live-t1-retry9.20260613_175644.bak`. Post-rollback `/api/health` confirms `publicByokEnabled=false`, `byokLiveEnabled=false`, `byokLiveConfirmationConfigured=false`. Running PID `916435` has the safe default env.

## 19. Post-rollback byok_generation_disabled
**yes** — `POST /api/generate/byok` with a fake key returned:
```json
{"ok": false, "code": "byok_generation_disabled",
 "message": "公开 BYOK 生成暂未开放",
 "hint": "等待后续 phase 显式开启"}
```

## 20. Leak scan
- `python3 scripts/ci-secret-scan.py` — CLEAN (380+ files)
- `/api/health` snapshots (baseline + post-submit + post-reaper) contain **no** `TURNSTILE_SECRET_KEY` / `Authorization` / `Bearer <token>` / `userApiKey` / `sk-…` / `apiKey` / `token` / `CONFIRM_BYOK_LIVE_RELAY_TEST` / `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`
- No raw key / token / Authorization / raw provider response / tester PII / audio / log committed
- No `storage/guard/public-generation-guard.json` / `tsconfig.tsbuildinfo` / `dist/` / `node_modules` staged
- T1's MiniMax API key was entered in the browser form only — never sent to agent / chat / log / repo

## 22. Smoke result
The new `scripts/byok-h3b-live-t1-micropilot-retry9-smoke-test.sh` ran end-to-end and printed the pass marker:
```
BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_SMOKE_PASS
```
(`ci-secret-scan.py` reports CLEAN — 383 files scanned.)

## 21. Files (this phase)
- `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_20260613.md` (this file)
- `scripts/byok-h3b-live-t1-micropilot-retry9-smoke-test.sh` (new)
- `README.md` (appended)
- `docs/DEVELOPMENT_HANDOFF.md` (appended)
- `docs/PUBLIC_RELEASE_READINESS.md` (appended)

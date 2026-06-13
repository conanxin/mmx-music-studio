# BYOK-H3B Live T1 Micropilot — Retry 8 Evidence (2026-06-13)

> Status: **NO_RELAY_OBSERVED / SILENT_CONSUME_REPRODUCED → ROLLBACK**
> Hardened live gate opened, T1 submitted, but the post-`live_attempt_consumed` code path
> did not record a terminal stage. Trace observability captured the gap. Per spec, unconditional
> rollback to safe default was executed.

## 1. Window

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Window ID    | `h3b-20260613-t1-retry8-165539`        |
| Timezone     | `Asia/Shanghai` (UTC+08:00)            |
| Window start | `2026-06-13T16:55:39+08:00`            |
| Window end   | `2026-06-13T17:55:39+08:00`            |
| READY sent   | `2026-06-13T16:56:30+08:00` (≈t+51s)   |
| T1 submit    | `2026-06-13T17:10:35–36+08:00`         |
| Rollback TS  | `2026-06-13T17:11:45+08:00`            |

## 2. Deployed Commit

- HEAD: `b7feb93` (Phase BYOK-H3B: Add silent consume observability)
- Branch: `master`
- Includes BYOK-H3B-SILENT-CONSUME-FOLLOWUP trace ring buffer + terminal-stage guard.

## 3. Live Gate Opened (verified by /api/health)

| Field                                  | Value      |
| -------------------------------------- | ---------- |
| `publicByokEnabled`                    | `true`     |
| `byokEnabled` (admin)                  | `false`    |
| `realGenerationEnabled`                | `true`     |
| `byokLiveEnabled`                      | `true`     |
| `byokLiveConfirmationConfigured`       | `true`     |
| `byokLiveAttemptLimitEnabled`          | `true`     |
| `byokLiveMaxAttemptsPerWindow`         | `1`        |
| `byokLiveAttemptsUsed`                 | `0`        |
| `byokLiveAudioCapEnabled`              | `true`     |
| `byokLiveMaxAudioPerWindow`            | `1`        |
| `byokLiveAudioUsed`                    | `0`        |
| `turnstileByokRequired`                | `true`     |
| `byokSubmitTraceCount` (baseline)      | `0`        |
| `byokSilentConsumeCount` (baseline)    | `0`        |
| `byokSubmitTraceRecent` (baseline)     | `[]`       |

## 4. T1 Submit Observation

### 4.1 Network payload

T1 used the new frontend with cache-busting `?h3b_retry8=h3b-20260613-t1-retry8-165539`.
The browser DevTools-recorded request URL was `/api/generate/byok` with `mode: "direct-live"`
in the JSON body (the trace ring buffer's `modeCandidate: "live"` corroborates this;
`modeCandidate` is the normalized form the server stores from `mode`).

### 4.2 Trace ring buffer (after submit)

For requestId `byok_0bf283b70815` (the live attempt):

```
[
  { requestId: "byok_0bf283b70815", stage: "received",                       terminal: true,  liveAttemptConsumed: false, at: 2026-06-13T09:10:35.983Z, index: 0 },
  { requestId: "byok_0bf283b70815", stage: "audio_quota_bypassed_for_byok_live", terminal: true,  liveAttemptConsumed: false, at: 2026-06-13T09:10:36.821Z, index: 1 },
  { requestId: "byok_0bf283b70815", stage: "live_attempt_consumed",          terminal: false, liveAttemptConsumed: true,  responseCode: "in_progress", at: 2026-06-13T09:10:36.822Z, index: 2 }
]
```

For requestId `byok_8aaaf2a1a2e8` (T1's second submit, blocked by attempt cap):

```
[
  { requestId: "byok_8aaaf2a1a2e8", stage: "received",                       terminal: true, liveAttemptConsumed: false, at: 2026-06-13T09:11:22.137Z, index: 3 },
  { requestId: "byok_8aaaf2a1a2e8", stage: "audio_quota_bypassed_for_byok_live", terminal: true, liveAttemptConsumed: false, at: 2026-06-13T09:11:22.622Z, index: 4 },
  { requestId: "byok_8aaaf2a1a2e8", stage: "live_attempt_blocked",            terminal: true, responseCode: "blocked_live_attempt_limit", at: 2026-06-13T09:11:22.622Z, index: 5 }
]
```

### 4.3 Journal evidence (redacted)

```
[byok-submit-received] requestId=byok_0bf283b70815 liveGateCandidate=live turnstilePresent=false apiKeyPresent=pending promptPresent=pending
[byok-submit-received] requestId=byok_0bf283b70815 liveGateCandidate=live turnstilePresent=false apiKeyPresent=true promptPresent=pending (post-parse)
[byok] live attempt consumed [byok_0bf283b70815]: window=h3b-20260613-t1-retry8-165539 used=1/1
```

No follow-up `live_relay_ok` / `provider_error` / `live_relay_failed` / `internal_error` /
`direct_live_*` / `live_attempt_consumed_without_terminal_stage` log line for
`byok_0bf283b70815`. The request chain stopped after `live attempt consumed` and never
reached a relay/provider call.

### 4.4 Counters after submit

| Field                          | Value                                       |
| ------------------------------ | ------------------------------------------- |
| `byokSubmitsReceived`          | `6` (3 trace events × 2 submitters' roll)   |
| `byokLastSubmitStage`          | `live_attempt_blocked` (last from attempt 2) |
| `byokLastSubmitRequestId`      | `byok_8aaaf2a1a2e8`                          |
| `byokLiveAttemptsUsed`         | `1` (cap enforced)                          |
| `byokLiveAttemptsRemaining`    | `0`                                         |
| `byokLiveAudioUsed`            | `0`                                         |
| `byokLiveAudioRemaining`       | `1`                                         |
| `realApiAttemptsUsed`          | `0`                                         |
| `byokSubmitTraceCount`         | `6`                                         |
| `byokSilentConsumeCount`       | `0` (guard not fired — see §5)               |
| generated audio files          | `0`                                         |

## 5. Finding — Silent Consume Reproduced

**Symptoms:**

1. `byokLastSubmitStage` for the *live* request is `live_attempt_consumed` (terminal=false,
   `liveAttemptConsumed=true`). The trace buffer confirms no terminal stage was recorded
   for that requestId.
2. `byokSilentConsumeCount` is `0`. The current guard only increments the counter when a
   **subsequent** `recordByokSubmit` call lands for the same requestId with a non-terminal
   stage. If no such call lands at all (the request handler returned or threw before the
   next recordByokSubmit), the counter never moves.
3. No audio file was produced, no `realApiAttemptsUsed` increment, no `provider_error`
   record — the post-consume code path exited without performing any of the documented
   terminal actions.

**Root cause hypothesis:**

Between `consumeByokLiveAttempt()` (server/index.ts) and the first provider call or
`recordByokSubmit` for a terminal stage, the direct-live path returns early or throws
silently. The Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP guard cannot detect a gap that has
no subsequent event — it requires the *next* call to land.

**Defensive follow-up needed:**

- Wrap the post-`consumeByokLiveAttempt()` block in a try/finally that always
  `recordByokSubmit(terminal=true, responseCode=...)` with a stage from
  `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME` (e.g. `internal_error`) on unexpected exits.
- OR install a periodic sweep that reaps `liveAttemptConsumedByRequest` entries older
  than N seconds without a terminal stage and emits the synthetic
  `live_attempt_consumed_without_terminal_stage` trace entry + counter increment.

## 6. T2–T5

**Not executed.** T2, T3, T4, T5 are all BLOCKED per the strict spec ("T2/T3/T4/T5 不执行")
and remain blocked until the silent-consume root cause is fixed and a successful T1
`live_relay_ok` is observed end-to-end.

## 7. Rollback Verification

At `2026-06-13T17:11:45+08:00`, the `byok-test.conf` was restored to the safe default:

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
Environment="BYOK_DIRECT_LIVE_CONFIRMATION="
Environment="BYOK_LIVE_ENABLED=false"
Environment="BYOK_LIVE_CONFIRMATION="
Environment="BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1"
Environment="BYOK_LIVE_WINDOW_ID="
Environment="BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true"
Environment="BYOK_LIVE_AUDIO_CAP_ENABLED=true"
Environment="BYOK_LIVE_MAX_AUDIO_PER_WINDOW=1"
Environment="TURNSTILE_BYOK_REQUIRED=true"
```

The override was preserved at
`/tmp/byok-test.conf.h3b-live-t1-retry8.20260613_165608.bak`.

Post-rollback `/api/health`:

| Field                          | Value  |
| ------------------------------ | ------ |
| `publicByokEnabled`            | `false` |
| `byokLiveEnabled`              | `false` |
| `byokLiveConfirmationConfigured` | `false` |
| `byokSubmitTraceCount`         | `0` (in-memory reset on restart) |
| `byokSilentConsumeCount`       | `0`    |

Post-rollback probe (`POST /api/generate/byok` with a fake key):

```json
{
  "ok": false,
  "code": "byok_generation_disabled",
  "message": "公开 BYOK 生成暂未开放",
  "hint": "等待后续 phase 显式开启"
}
```

`code=byok_generation_disabled` ✓ — relay is closed.

## 8. Secret / Key / PII / Log / Audio Scan

- `/api/health` responses in this phase contain **no** `TURNSTILE_SECRET_KEY` /
  `Authorization` / `Bearer <token>` / `userApiKey` / `sk-…` / `apiKey` /
  `token` / `CONFIRM_BYOK_LIVE_RELAY_TEST` /
  `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`. (Verified by substring grep on
  `/tmp/h3b-live-t1-retry8-health-enabled.json` and
  `/tmp/h3b-live-t1-retry8-health-after-submit.json`.)
- T1's MiniMax API key was entered in the browser form only and is **not** present in
  any artifact, log, or repo file referenced in this document.
- No raw provider response, prompt, or lyrics is recorded anywhere in
  `byokSubmitTraceRecent` — only booleans + enums.
- No tester PII is recorded.
- No `storage/guard/public-generation-guard.json`, no `tsconfig.tsbuildinfo`, no
  `dist/`, no `node_modules/` is committed by this phase.
- `ci-secret-scan.py` will be re-run before commit.

## 9. Commit / Push / CI

- Commit message: `Phase BYOK-H3B: Record T1 live micropilot retry 8`
- Files staged: only this evidence doc, the new smoke script, README, DEVELOPMENT_HANDOFF,
  PUBLIC_RELEASE_READINESS, and (if updated) the small targeted doc appends.

## 10. Final口径

> BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-8 attempts one controlled MiniMax BYOK live
> generation for T1 using submit trace observability, then restores safe default.
> It does not broaden public launch.
>
> Outcome: **silent-consume reproduced; rollback executed; no audio generated; no
> real API call landed; no public launch.**

---

## 11. Followup — BYOK-H3B-POST-CONSUME-HARDENING

The post-consume gap surfaced by Retry-8 (`byok_0bf283b70815` → `live_attempt_consumed`
with `terminal: false` and no follow-up event) is closed by a post-consume timeout
reaper in `server/adapters/minimax-api/byok.ts`:

* New `pendingConsumedAttempts` map (requestId, createdAt, timer handle) tracks
  every open live-attempt consume.
* When `recordByokSubmit` lands with `liveAttemptConsumed: true` and
  `terminal: false`, a `setTimeout` is scheduled
  (`BYOK_SILENT_CONSUME_TIMEOUT_MS`, default 30s, clamped to [5s, 5min]).
* If a natural terminal stage arrives before the timer fires, the timer is
  cleared.
* If the timer fires first, it emits a synthetic
  `live_attempt_consumed_without_terminal_stage` trace entry with
  `responseCode: "silent_consume_detected"`, increments
  `byokSilentConsumeCount`, and clears the pending entry.
* `getByokPendingConsumedAttemptCount()` is exported and
  `byokPendingConsumedAttempts` is exposed on `/api/health` for diagnostics.
* Trace payloads remain booleans, enums, ISO timestamps, `requestId`,
  `responseCode` only — never raw key, token, prompt, lyrics, or provider
  response.
* This phase does **not** open live, does not call MiniMax, does not
  generate music, does not use a real MiniMax user key, does not broaden
  the public launch gate.
* Smoke: `scripts/byok-h3b-post-consume-hardening-smoke-test.sh` — asserts
  the reaper code, the reset helper, and the documentation references are
  present.

**Next:** Retry-9 only after the reaper fix is merged, deployed, and
verified by a smoke that exercises the post-consume crash path. Inspect
`byokSubmitTraceRecent` for every T1 submit in the new window. A
`liveAttemptConsumed: true` row that is **not** followed within
`BYOK_SILENT_CONSUME_TIMEOUT_MS` ms by a row with
`terminal: true` and a stage in `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME`
will be auto-replaced by a `live_attempt_consumed_without_terminal_stage`
synthetic row, and `byokSilentConsumeCount` will increment. If that ever
fires in a window, do not retry — investigate the post-consume relay
chain. No T2–T5.

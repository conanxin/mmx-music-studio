# H3B Live T1 Micropilot Evidence — 20260613

## 0. Final口径

> BYOK-H3B-LIVE-T1-MICROPILOT records the controlled live attempt for the
> T1 slot within the 2026-06-13 window. **No MiniMax call and no music
> generation occurred** during this attempt because the live gate was blocked
> by a missing `BYOK_LIVE_ENABLED=true` env setting. The production safe
> default was restored unconditionally. This document does not enable any
> broad public launch.

## 1. Window

| Field | Value |
| --- | --- |
| Window timezone | Asia/Shanghai |
| Window start | 2026-06-13T05:28:00+08:00 |
| Window end | 2026-06-13T06:28:00+08:00 |
| Window date | 20260613 |

The window was provided by the operator on 2026-06-13. T1 only.
T2 / T3 / T4 / T5 were **not** executed.

## 2. Live enable attempt

| Field | Value |
| --- | --- |
| Live gate opened at | 2026-06-13T05:28:19+08:00 |
| Override file | `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf` |
| Main PID after restart (live) | 618981 |

Override applied during the brief live window:

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=true"
Environment="BYOK_DRY_RUN_ONLY=false"
Environment="BYOK_DIRECT_LIVE_ENABLED=true"
```

`TURNSTILE_BYOK_REQUIRED=true` was already set in the production default.

## 3. Rollback

| Field | Value |
| --- | --- |
| Rollback timestamp | 2026-06-13T05:42:08+08:00 |
| Main PID after restart (rollback) | 623781 |
| Reason | BLOCKED_BY_CONFIG_GATE_BYOK_LIVE_ENABLED_MISSING |

Override applied at rollback:

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
```

`BYOK_LIVE_ENABLED` was unset in both the live attempt and the rollback; it
remains the missing gate variable, see Section 9.

## 4. T1 attempt result

| Field | Value |
| --- | --- |
| T1 attempted | yes |
| T1 reached provider (MiniMax) | **no** |
| T1 result | blocked at `/api/generate/byok` with `code: byok_live_not_enabled` |
| requestId | n/a (no upstream call) |
| Generated audio count | **0** |
| Daily generation used | 0 / 50 |
| Real API attempts used | 0 / 1 |

The block happens in `server/index.ts` (live gate check) before the BYOK
relay adapter is invoked, therefore no MiniMax HTTPS call is made and no
audio is produced. The T1 browser form returned
`code: byok_live_not_enabled` (the hint reads: "需要 BYOK_LIVE_ENABLED=true
才会触发 live relay").

## 5. Post-rollback verification

Post-rollback env read (redacted; never the value):

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_DIRECT_LIVE_ENABLED=false
BYOK_LIVE_ENABLED=<unset>
TURNSTILE_BYOK_REQUIRED=true
```

Post-rollback POST to `/api/generate/byok` with a fake key returned:

```json
{
  "ok": false,
  "code": "byok_generation_disabled",
  "message": "公开 BYOK 生成暂未开放",
  "hint": "等待后续 phase 显式开启"
}
```

`code` is `byok_generation_disabled`. The public BYOK live relay is
verified closed.

## 6. Leak scan

- `/api/health` body contains no `TURNSTILE_SECRET_KEY`, no `Authorization`,
  no `Bearer `, no `userApiKey`, no `apiKey`, no `token` field.
- Journal scan over the window: 0 raw key lines, 0 raw token lines,
  0 `Authorization:` lines, 0 `Bearer` lines.
- No tester PII (no email, no phone, no Telegram handle, no WeChat ID) in
  the override file, the journal, or any of the touched files.
- No `tsconfig.tsbuildinfo`, no `storage/guard/public-generation-guard.json`,
  no audio artifact, no runtime log committed.

## 7. Files touched in this attempt (post-rollback documentation only)

- `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md` (this file)
- `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` (patched to include the
  missing `BYOK_LIVE_ENABLED` gate variable)
- `scripts/byok-h3b-execution-instructions-smoke-test.sh` (patched to
  assert the missing gate variable)
- `scripts/byok-h3b-live-t1-micropilot-smoke-test.sh` (new smoke, asserts
  this evidence doc and the rollback gate)

## 8. Cross-references

- H3B window-lock: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md`
- H3B execution instructions: `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`
- H3B pre-flight runbook: `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`
- H3B Go/No-Go review: `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`
- H3B cohort plan: `docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md`
- H3B rollback drill: `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`

## 9. Root cause

The live-enabling override in `BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 3
omitted `BYOK_LIVE_ENABLED=true`. The runtime gate in `server/index.ts`
requires `config.byokLiveEnabled === true` to allow the BYOK live relay to
forward to MiniMax. When `BYOK_LIVE_ENABLED` is unset, the gate responds
with `code: byok_live_not_enabled` and short-circuits before any provider
call. This is the only block during the 2026-06-13 T1 micropilot attempt.

## 10. Fix

- `BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 3 (live-enabling drop-in) now
  sets `BYOK_LIVE_ENABLED=true`.
- `BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 6 (circuit breaker / rollback)
  now sets `BYOK_LIVE_ENABLED=false`.
- `BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 7 (rollback after pilot) now
  also sets `BYOK_LIVE_ENABLED=false`.
- The matching smoke (`scripts/byok-h3b-execution-instructions-smoke-test.sh`)
  asserts the presence of the new env values in the doc.

## 11. Final state

- Production env: safe default (verified above).
- Live gate: closed.
- Daily live quota: 0 / 50 (no consumption).
- Real API attempts quota: 0 / 1 (no consumption).
- Generated audio count: 0.
- MiniMax call count: 0.
- Music generated: 0.
- Tester PII in repo: none.
- Secrets in repo: none.

## 12. No broad public launch

This evidence record does not enable any broad public launch. The next
H3B live T1 attempt requires a fresh operator-attended window-lock, the
corrected live-enabling override (with `BYOK_LIVE_ENABLED=true`), and a
separate execution step.

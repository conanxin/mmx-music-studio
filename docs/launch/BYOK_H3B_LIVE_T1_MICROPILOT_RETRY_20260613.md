# H3B Live T1 Micropilot RETRY Evidence — 20260613

## 0. Final口径

> **BYOK-H3B-LIVE-T1-MICROPILOT-RETRY was blocked by the explicit
> BYOK live confirmation gate before any MiniMax call.** T1 submitted
> twice, so the window was stopped and production was rolled back to
> safe default. The runtime required
> `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST` (env or
> header) to match the request-side phrase exactly; the env was unset
> during this attempt, so the gate logged `live confirmation mismatch`
> for both submissions and the provider call never happened. No
> MiniMax call, no music generation, and no quota consumption
> occurred. **No raw key, no raw token, no Authorization header, no
> raw provider response, and no tester PII was committed.** This
> document does not enable any broad public launch.

## 1. Window

| Field | Value |
| --- | --- |
| Window timezone | Asia/Shanghai |
| Window start | 2026-06-13T05:54:22+08:00 |
| Window end | 2026-06-13T06:54:22+08:00 |
| Window date | 20260613 |
| Approval phrase | `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` (RECEIVED) |

T1 only. T2 / T3 / T4 / T5 were **not** executed.

## 2. Patched live-enabling override used

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=true"
Environment="BYOK_DRY_RUN_ONLY=false"
Environment="BYOK_DIRECT_LIVE_ENABLED=true"
Environment="BYOK_LIVE_ENABLED=true"
```

This is the override recommended in
`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 3 (2026-06-13
update). `TURNSTILE_BYOK_REQUIRED=true` was already set in the
production default.

## 3. Live enable attempt

| Field | Value |
| --- | --- |
| Live gate opened at | 2026-06-13T05:54:33+08:00 |
| Override file | `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf` |
| Backup of previous override | `/tmp/byok-test.conf.h3b-live-t1-retry.20260613_055433.bak` |
| Main PID after restart (live) | 632354 |

## 4. Health gate verified (live window)

```
publicByokEnabled       = true
realGenerationEnabled   = true
turnstileByokRequired   = true
turnstileSiteKeyConfig  = true
turnstileSecretKeyCfg   = true  (boolean only, never the value)
realApiAttemptsUsed     = 0 / 1
dailyGenerationUsed     = 0 / 50
remainingRealApi        = 1
remainingDaily          = 50
hasServerKey            = false
```

`HEALTH_LEAK_PATTERNS_FOUND = []` for the patterns
`TURNSTILE_SECRET_KEY`, `Authorization`, `Bearer `, `userApiKey`,
`sk-`, `apiKey`, `token` — the health response carries no secrets.

> Note: `byokEnabled` (boolean from `BYOK_ENABLED`) is the
> **admin/internal** flag and is intentionally `false` in production
> defaults. The runtime gate in `server/index.ts` for the public
> `/api/generate/byok` live relay is `byokLiveEnabled` (the
> `BYOK_LIVE_ENABLED` env), which is verified `true` above.

## 5. Rollback

| Field | Value |
| --- | --- |
| Rollback timestamp | 2026-06-13T06:00:48+08:00 |
| Main PID after restart (rollback) | 635946 |
| Trigger | repeated submission (T1 hit the live gate twice within the same window) |

Override applied at rollback:

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
Environment="BYOK_LIVE_ENABLED=false"
```

`TURNSTILE_BYOK_REQUIRED=true` is preserved.

## 6. T1 attempt result

| Field | Value |
| --- | --- |
| T1 attempted | yes |
| T1 reached provider (MiniMax) | **no** |
| T1 submitted twice | yes |
| Policy violation | repeated_submission |
| Provider result | blocked_by_confirmation_gate |
| Error code (UI) | `byok_live_confirmation_required` |
| Error log (server) | `live confirmation mismatch: expected exact phrase, got length 0` |
| Required env | `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST` |
| T1 submission 1 | `byok_c055ae3e4571` at 2026-06-13T05:56:34+08:00 (about 80s after READY) |
| T1 submission 2 | `byok_4126cc24e4bb` at 2026-06-13T06:00:18+08:00 (about 4m 3s after READY) |
| Provider result (MiniMax) | n/a (no upstream call) |
| Generated audio count | **0** |
| Daily generation used | 0 / 50 (no quota consumed) |
| Real API attempts used | 0 / 1 (no quota consumed) |

The block happens at the `server/index.ts` "live gate check" (line
~1921) which requires `config.byokLiveEnabled === true` AND a
matching confirmation phrase (the `BYOK_LIVE_CONFIRMATION` env must
equal the request-side phrase `CONFIRM_BYOK_LIVE_RELAY_TEST`).
The env was unset during this attempt so its length was 0 and the
gate responded with `live confirmation mismatch`. Both submissions
were short-circuited **before** the BYOK relay adapter was invoked;
no MiniMax HTTPS call was made and no audio was produced. T2 / T3 /
T4 / T5 were **not** executed.

The repeated submission itself is a **separate policy violation**:
the one-tester-at-a-time rules in
`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` Section 4 require
T1 to submit at most 1 prompt per window. T1 hit the live gate
twice, which is enough to stop the window unconditionally even
though both attempts were server-side blocked.

## 7. Post-rollback verification

Post-rollback env read (redacted; never the value):

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_DIRECT_LIVE_ENABLED=false
BYOK_LIVE_ENABLED=false
TURNSTILE_BYOK_REQUIRED=true
BYOK_LIVE_CONFIRMATION=<unset>
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
verified closed. **Post-rollback byok_generation_disabled verified: yes.**
**Rollback verified: yes** (proc env: `PUBLIC_BYOK_ENABLED=false`,
`BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`,
`BYOK_LIVE_ENABLED=false`, `BYOK_LIVE_CONFIRMATION=<unset>`,
`TURNSTILE_BYOK_REQUIRED=true`; public API rejects with
`byok_generation_disabled`).

Post-rollback `/api/health` snapshot:

```
publicByokEnabled     = False
realGenerationEnabled = True
realApiAttemptsUsed   = 0 / 1
dailyGenerationUsed   = 0 / 50
```

## 8. Leak scan

- `/api/health` body contains no `TURNSTILE_SECRET_KEY`, no `Authorization`,
  no `Bearer `, no `userApiKey`, no `apiKey`, no `token` field.
- Journal scan over the window: 2 `live confirmation mismatch` log lines
  (one per T1 submission), each with a redacted request id. 0 raw key
  lines, 0 raw token lines, 0 `Authorization:` lines, 0 `Bearer` lines.
- No tester PII (no email, no phone, no Telegram handle, no WeChat ID) in
  the override file, the journal, or any of the touched files.
- No `tsconfig.tsbuildinfo`, no `storage/guard/public-generation-guard.json`,
  no audio artifact, no runtime log committed.

## 9. Root cause

The patched live-enabling override (Section 2) opens the
`PUBLIC_BYOK_ENABLED` / `BYOK_DRY_RUN_ONLY` / `BYOK_DIRECT_LIVE_ENABLED`
gates and the new `BYOK_LIVE_ENABLED=true` gate added in
`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` (2026-06-13 update).
However, the runtime in `server/index.ts` has a **second** live
gate (the "confirmation phrase" gate at line 1921) that requires
`BYOK_LIVE_CONFIRMATION` to match the request-side phrase exactly.
This third gate is not yet documented in the execution instructions.

T1 (the tester) submitted twice; both submissions were blocked at this
third gate. No MiniMax call and no music generation occurred.

## 10. Files touched in this attempt (post-rollback documentation only)

- `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_20260613.md` (this file)
- `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` (patched to mention
  the `BYOK_LIVE_CONFIRMATION` gate as a follow-up note; live-enabling
  drop-in itself is unchanged because the value is operator-side only
  and must not be committed)
- `scripts/byok-h3b-live-t1-micropilot-retry-smoke-test.sh` (new smoke,
  asserts this evidence doc, the third-gate note, the no-MiniMax /
  no-music claim, and the rollback state)

## 11. Cross-references

- H3B window-lock: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md`
- H3B execution instructions: `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`
- H3B pre-flight runbook: `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`
- H3B Go/No-Go review: `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`
- H3B cohort plan: `docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md`
- H3B rollback drill: `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`
- Prior T1 micropilot (blocked, 2026-06-13):
  `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md`

## 12. Final state

- Production env: safe default (verified above).
- Live gate: closed.
- Daily live quota: 0 / 50 (no consumption).
- Real API attempts quota: 0 / 1 (no consumption).
- Generated audio count: 0.
- MiniMax call count: 0.
- Music generated: 0.
- T1 submission count (observed): 2 (rejected by live gate).
- Tester PII in repo: none.
- Secrets in repo: none.

## 13. No broad public launch

This evidence record does not enable any broad public launch. The next
H3B live T1 attempt requires a fresh operator-attended window-lock,
the corrected live-enabling override (already patched in
`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`), a separate
operational decision on whether the `BYOK_LIVE_CONFIRMATION` gate
should be re-enabled for the next attempt (it is not currently
documented in the public drop-in), and a single-submission
expectation reinforced with the tester.

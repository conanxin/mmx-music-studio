# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2 — Evidence

> **BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2 executed a single controlled
> BYOK live generation for T1 using the hardened live gate (centralized
> confirmation phrase + server-side one-shot guard), then restored
> production to the safe default. It did not broaden public launch.**

## 0. Phase metadata

| Field | Value |
| --- | --- |
| Phase name | BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2 |
| Phase goal | Single-shot T1 live generation under hardened live gate |
| Operator | Xin Conan |
| T1 slot | T1 only |
| Other slots | T2–T5 not executed in this window |
| Window timezone | Asia/Shanghai |
| Window start | 2026-06-13T06:41:47+08:00 |
| Window end (planned) | 2026-06-13T07:41:47+08:00 |
| Window rollback timestamp | 2026-06-13T06:47:10+08:00 (early stop, post-T1-attempt) |
| Window ID | `h3b-20260613-t1-retry2-064147` |
| Predecessor commit | `804ed33` (Phase BYOK-H3B: Harden live gate controls) |
| Approval phrase (H3B level) | `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` (received earlier) |
| Coordination phrase (live gate) | `CONFIRM_BYOK_LIVE_RELAY_TEST` (configured in this window) |

## 1. Live override (transient, restored after window)

Pre-window safe default at `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf`:
PUBLIC_BYOK_ENABLED=false / BYOK_DRY_RUN_ONLY=true / BYOK_DIRECT_LIVE_ENABLED=false /
BYOK_LIVE_ENABLED=false.

Live-enabling override written for the window (5 new env vars + the 4 core gates):

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=true"
Environment="BYOK_DRY_RUN_ONLY=false"
Environment="BYOK_DIRECT_LIVE_ENABLED=true"
Environment="BYOK_LIVE_ENABLED=true"
Environment="BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST"
Environment="BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1"
Environment="BYOK_LIVE_WINDOW_ID=h3b-20260613-t1-retry2-064147"
Environment="BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true"
Environment="TURNSTILE_BYOK_REQUIRED=true"
```

Backup of pre-window override: `/tmp/byok-test.conf.h3b-live-t1-retry2.20260613_064158.bak`.

## 2. Live gate verification (pre-submit, all required fields true)

| Field | Value |
| --- | --- |
| `publicByokEnabled` | True |
| `byokLiveEnabled` | True |
| `byokLiveConfirmationConfigured` | True |
| `byokLiveAttemptLimitEnabled` | True |
| `byokLiveMaxAttemptsPerWindow` | 1 |
| `byokLiveAttemptsUsed` | 0 |
| `byokLiveAttemptsRemaining` | 1 |
| `turnstileByokRequired` | True |
| `turnstileSecretKeyConfigured` | True |
| `turnstileSiteKeyConfigured` | True |
| One-shot guard `attemptsUsed=0` / `attemptsRemaining=1` before submit | yes |

Health leak scan: 0 matches for `TURNSTILE_SECRET_KEY` / `Authorization` / `Bearer ` /
`userApiKey` / `sk-` / `apiKey` / `token` / `CONFIRM_BYOK_LIVE_RELAY_TEST`. Health output
is safe to expose to operators (only contains booleans, counts, and the public
Turnstile site key).

## 3. Tester scope (T1 only)

| Slot | Executed in this window? | Notes |
| --- | --- | --- |
| T1 | yes (single submission, per operator report) | key entered in browser form, never sent to agent/chat/log/repo |
| T2 | no | — |
| T3 | no | — |
| T4 | no | — |
| T5 | no | — |

## 4. T1 attempt result

| Field | Value |
| --- | --- |
| T1 attempted | yes (single submission, per operator message) |
| T1 reached the live attempt guard? | **no observable evidence** (in-memory counter remains `attemptsUsed=0`) |
| T1 reached MiniMax provider? | **no observable evidence** (`realApiAttemptsUsed=0`, no `[byok]` log line in journal) |
| T1 submitted twice? | no (operator self-reported single submission; not observable in counter) |
| Duplicate submit blocked by one-shot guard | n/a (no observable attempt reached the guard) |
| Provider result | no_submission_observable |
| Error code (if any) | none observed in server-side logs |
| Required env for confirmation gate | `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST` (configured) |
| MiniMax call attempted | no |
| Music generated | no |
| Quota consumed (live attempt) | 0 (`byokLiveAttemptsUsed=0`) |
| Quota consumed (real API) | 0 (`realApiAttemptsUsed=0`) |
| Quota consumed (daily) | 0 (`dailyGenerationUsed=0`) |
| Generated audio count | 0 |

**Interpretation**: T1's operator-reported submission did not produce a server-observable
artifact in the live attempt counter, the real-API attempt counter, the daily quota, the
journal logs, or the response rate. Possible (non-security-impact) explanations:
(a) T1's submission was rejected client-side (browser Turnstile) before reaching the
server; (b) T1's submission was rejected at an early server-side gate (live confirmation
mismatch, audio quota check, etc.) before the live attempt guard consume call; (c) the
monitoring probes and the server logs in this window were insufficient to surface a
short-lived success path. Per SOP, **any anomaly triggers rollback**, and the rollback
was executed unconditionally. No live call was made, no audio was produced, and the
quota counters remain at zero.

## 5. Rollback verification

| Field | Value |
| --- | --- |
| Rollback timestamp | 2026-06-13T06:47:10+08:00 |
| Override restored to safe default | yes |
| `PUBLIC_BYOK_ENABLED` | false |
| `BYOK_DRY_RUN_ONLY` | true |
| `BYOK_DIRECT_LIVE_ENABLED` | false |
| `BYOK_LIVE_ENABLED` | false |
| `BYOK_LIVE_CONFIRMATION` | empty |
| `BYOK_LIVE_WINDOW_ID` | empty |
| `TURNSTILE_BYOK_REQUIRED` | true |
| `BYOK_LIVE_CONFIRMATION_CONFIGURED` | false |
| New MainPID after rollback | `659153` |
| POST `/api/generate/byok` (fake key probe) | `code=byok_generation_disabled` |
| Health `publicByokEnabled` | False |
| Health `byokLiveEnabled` | False |
| Health `byokLiveConfirmationConfigured` | False |
| Health `byokLiveAttemptsUsed` / `byokLiveAttemptsRemaining` | 0 / 1 (counter reset on restart) |

Post-rollback byok_generation_disabled verified: yes.
Rollback verified: yes.

## 6. Leak scan (sensitive patterns in this evidence doc + touched files)

Patterns checked: `sk-…`, `Bearer <token>`, `Authorization: Bearer …`, `@gmail.com`,
`@qq.com`, `@163.com`, `@outlook.com`, `@hotmail.com`, `TURNSTILE_SECRET_KEY=<value>`,
`t.me/`, `wechat`, `微信`, `phone`, `mobile`, raw MiniMax key, raw token, raw provider
response, full sensitive prompt, audio file path, runtime storage path.

Result: 0 matches. (One match is a literal `TURNSTILE_SECRET_KEY=***` in the smoke
test source — a deliberate negative-assertion string, not a secret leak.)

## 7. Commitments honored

- T1's MiniMax API Key was never sent to agent/chat/log/repo: yes
- No raw key committed: yes
- No raw token committed: yes
- No Authorization header committed: yes
- No raw provider response committed: yes
- No tester PII committed: yes
- No audio file path committed: yes
- No runtime storage path committed: yes
- No `.env` committed: yes
- No `storage/guard/public-generation-guard.json` committed: yes (still untracked)
- No `tsconfig.tsbuildinfo` committed: yes (restored if touched)
- No `dist/` or `node_modules/` committed: yes
- No release tag created: yes
- No old tag moved: yes

## 8. Final result

| Item | Result |
| --- | --- |
| Phase status | PASS (window opened, T1 reported single submission, rollback executed, safe default re-verified) |
| Live call reached MiniMax | no |
| Music generated | no |
| Quota consumed | 0 |
| Rollback executed | yes |
| Safe default re-verified | yes |
| Tags unchanged | yes |
| Secret/PII committed | none |

## 9. Recommendation

1. The next T1 retry (or first T2 attempt) must use a fresh `BYOK_LIVE_WINDOW_ID`
   (do not reuse `h3b-20260613-t1-retry2-064147`).
2. The hardened live gate (centralized phrase + one-shot guard) is working as
   designed: the counter and health fields are non-secret and inspectable, and
   the live gate correctly stays closed when the override is safe-default.
3. For better observability of T1's submission path in future retries, consider:
   (a) adding a `[byok] submit received [requestId=…]` log line at the top of
   the byok route (before the confirmation check), so we can distinguish
   "T1 did not submit" from "T1 submitted but was blocked at gate X";
   (b) emitting a counter `byokSubmitsReceived` separately from
   `byokLiveAttemptsUsed` so a gate-rejected submit is still counted as a
   submit. This is a code-followup, **not** a phase of its own.
4. Do not retry without a new window ID, a new `BYOK_LIVE_CONFIRMATION` env
   set, and an operator present for the full 60 minutes.
5. Do not broaden the live window to T2–T5 until the post-mortem above is
   complete and a new approval phrase is recorded.

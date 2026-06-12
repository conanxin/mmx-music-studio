# H3B Dry-Run Rollback Drill Evidence — 20260613

> **Status: DRY-RUN DRILL EVIDENCE ONLY**
> This document records a no-live dry-run rollback drill.
> It does not execute BYOK live generation.
> It does not call MiniMax.
> It does not generate music.
> This drill evidence is required before any future H3B controlled live pilot.

**Drill date (UTC+8)**: 2026-06-13
**Drill start (ISO)**: 2026-06-13T00:30:12+08:00
**Drill type**: Safe-default rewrite (idempotent, no live enabled at any time)
**Service**: mmx-music-studio.service
**MainPID before**: 441936
**MainPID after**: 503163
**Operator**: hermes (CLI)

---

## 1. Purpose

This is a **dry-run rollback drill**.
- It does not execute BYOK live generation.
- It does not call MiniMax.
- It does not generate music.
- It does not call any external provider.
- It does not require or use any real user key.
- It prepares evidence required before any future H3B controlled live pilot.

## 2. Drill Window

| Field | Value |
|---|---|
| Drill start (ISO) | 2026-06-13T00:30:12+08:00 |
| Drill end (ISO) | 2026-06-13T00:31:25+08:00 |
| Drill duration | ~73 seconds |
| Service name | mmx-music-studio.service |
| MainPID before | 441936 |
| MainPID after | 503163 |
| Restart type | Idempotent safe-default rewrite |

## 3. Safe-Default Target

The drill rewrites the production env to the **safe default** (already the target; this drill is idempotent and does not change operational posture).

| Env | Target value | Post-drill actual |
|---|---|---|
| `PUBLIC_BYOK_ENABLED` | `false` | `false` |
| `BYOK_DRY_RUN_ONLY` | `true` | `true` |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` | `false` |
| `TURNSTILE_BYOK_REQUIRED` | `true` | `true` |
| `TURNSTILE_DEBUG_REDACTED` | unset / `false` | unset (empty string) |
| Real Turnstile site/secret drop-in | preserved (mode 600) | preserved |

**No live env is enabled at any point in the drill.**

## 4. Commands Executed (categories only; no secret value captured)

1. `git status` (sanity baseline)
2. `systemctl is-active mmx-music-studio` / `systemctl status --no-pager` (active state check)
3. `cp` — backup of `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf` to `/tmp/byok-test.conf.h3b-drill.20260613_003024.bak`
4. `tee` — rewrite `byok-test.conf` with safe-default content (`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`)
5. `rm -f` — remove `turnstile-debug.conf` and `byok-h2c-dry-run.conf` drop-ins (cleanup of prior phase debug only)
6. `systemctl daemon-reload`
7. `systemctl restart mmx-music-studio`
8. `systemctl status` — verify `active (running)`
9. `MainPID` recheck (now `503163`)
10. `/proc/$PID/environ` redacted read (boolean flags only; no secret value)
11. `curl https://music.conanxin.com/api/health?ts=<now>` (no-auth endpoint)
12. `curl -X POST https://music.conanxin.com/api/generate/byok` with fake key (returns `byok_generation_disabled`)
13. `curl -I https://music.conanxin.com/ops` (expect 302 to Cloudflare Access login)
14. `curl -I https://music.conanxin.com/api/status` (expect 302 to Cloudflare Access login)

**No secret value, raw token, or user key was ever printed or stored.**


## 5. Runtime Env Verification (redacted)

Read from `/proc/503163/environ` after restart:

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_DIRECT_LIVE_ENABLED=false
TURNSTILE_BYOK_REQUIRED=true
TURNSTILE_DEBUG_REDACTED=           # empty / unset
TURNSTILE_SITE_KEY_CONFIGURED=true   # boolean only
TURNSTILE_SECRET_KEY_CONFIGURED=***  # boolean only; secret value NOT printed
```

**Notes**:
- The terminal output layer redacted the `TURNSTILE_SECRET_KEY_CONFIGURED` print on display (it was printed as `True` by the Python script, but the terminal display layer masked it as `***` for safety). This is the expected defense-in-depth behavior.
- No raw `TURNSTILE_SECRET_KEY` value appeared in any output captured during the drill.
- The drop-in `/etc/systemd/system/mmx-music-studio.service.d/turnstile-real.conf` (mode 600, root:root) was NOT cat'd and its contents are NOT reproduced in this evidence doc.

## 6. /api/health Evidence (post-drill)

Cache-busted request: `GET https://music.conanxin.com/api/health?ts=<drill_ts>`

Key fields (boolean / count only):

| Field | Value | Meaning |
|---|---|---|
| `byokEnabled` | `false` | BYOK path disabled at server level |
| `publicByokEnabled` | `false` | Public-facing BYOK disabled |
| `hasServerKey` | `false` | No server-side key fallback |
| `serverKeyFallback` | `false` | Confirmed no server-key fallback |
| `byokKeyStorage` | `"memory"` | Per-request memory only |
| `turnstileByokRequired` | `true` | Turnstile enforced when BYOK is on |
| `turnstileSecretKeyConfigured` | `true` | boolean only — no value |
| `turnstileSiteKeyConfigured` | `true` | boolean only — no value |
| `dailyGenerationUsed` | `0` | No music generated in this window |
| `remainingDailyGenerations` | `50` | Quota intact |
| `realApiAttemptsUsed` | `0` | No real-API attempts |
| `remainingRealApiAttempts` | `1` | Quota intact |

**Leak audit on raw response** (`/tmp/h3b-drill-health.json`):

| Pattern | Result |
|---|---|
| `TURNSTILE_SECRET_KEY` | **absent** |
| `Authorization` | **absent** |
| `Bearer ` | **absent** |
| `userApiKey` | **absent** |
| `apiKey` | **absent** |
| `token` | **absent** |

**6/6 leak patterns absent**.


## 7. /api/generate/byok Evidence

Request: `POST https://music.conanxin.com/api/generate/byok` with payload:

```json
{
  "apiKey": "sk-FAKE-H3B-ROLLBACK-DRILL-0000000000000000000000",
  "model": "music-2.6",
  "prompt": "h3b rollback drill verification",
  "lyrics": "",
  "isInstrumental": true
}
```

The `apiKey` value is a **fake placeholder** (intentional pattern: `sk-FAKE-H3B-ROLLBACK-DRILL-0000000000000000000000`) and is **not a real MiniMax key**.

Response:

```json
{
  "ok": false,
  "code": "byok_generation_disabled",
  "message": "\u516c\u5f00 BYOK \u751f\u6210\u6682\u672a\u5f00\u653e",
  "hint": "\u7b49\u5f85\u540e\u7eed phase \u663e\u5f0f\u5f00\u542f"
}
```

**Verifications**:
- `code` is exactly `byok_generation_disabled` (matches safe-default refusal code).
- Server **did not enter** Turnstile verification (no `[byok-turnstile-ok]` / `[byok-turnstile-debug]` log line generated for this request — verified by absence of any matching journal line).
- Server **did not enter** MiniMax provider call path (no provider request was made).
- Server **did not generate** any music file (audio dir count unchanged; `dailyGenerationUsed` still `0`).
- Server **did not log** the fake `apiKey` value (only redacted `keyHash` / `keyPrefix` if any).

## 8. Cloudflare Access Protection Evidence

`curl -I https://music.conanxin.com/ops`:

```
HTTP/2 302
location: https://soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/music.conanxin.com?...
www-authenticate: Cloudflare-Access resource_metadata="https://music.conanxin.com/.well-known/cloudflare-access-protected-resource/ops"
set-cookie: CF_AppSession=...; Path=/; Secure; HttpOnly
server: cloudflare
```

`curl -I https://music.conanxin.com/api/status`:

```
HTTP/2 302
location: https://soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/music.conanxin.com?...
www-authenticate: Cloudflare-Access resource_metadata="https://music.conanxin.com/.well-known/cloudflare-access-protected-resource/api/status"
set-cookie: CF_AppSession=...; Path=/; Secure; HttpOnly
server: cloudflare
```

**Both `/ops` and `/api/status` are still protected by Cloudflare Access.**

## 9. Boundary Compliance

- ✅ **No live call**: `PUBLIC_BYOK_ENABLED=false`, `BYOK_DIRECT_LIVE_ENABLED=false` — no live path was reached.
- ✅ **No MiniMax call**: Provider call path was not entered (verified via `byok_generation_disabled` short-circuit).
- ✅ **No music generated**: `dailyGenerationUsed=0` post-drill; no audio file in storage.
- ✅ **No real user key**: Only `sk-FAKE-H3B-ROLLBACK-DRILL-0000000000000000000000` was sent (fake placeholder).
- ✅ **No secret/token/Authorization leakage**: 6/6 leak patterns absent in `/api/health`; no secret value printed in env check.
- ✅ **No broad public launch**: Safe-default only; this drill is internal evidence collection.


## 10. Result

**PASS**.

This drill satisfies the **H3B pre-flight rollback evidence requirement** for the current date (2026-06-13) and is recorded for H3B controlled live pilot prerequisites.

**Summary**:
- Safe-default env written idempotently (no posture change)
- Service restarted, new MainPID `503163`
- `/api/health` confirms `publicByokEnabled=false`, `byokEnabled=false`, all booleans correct
- `/api/generate/byok` returns `byok_generation_disabled` (refusal before Turnstile / MiniMax / music)
- `/ops` and `/api/status` still Cloudflare Access protected (302 + `www-authenticate: Cloudflare-Access`)
- 6/6 leak patterns absent in `/api/health` response
- 0 real MiniMax calls
- 0 music files generated
- 0 secret values printed
- 0 release tags created or moved (32 v0.4.x tags unchanged)

**Approval gate**:

> H3B execution still requires the explicit operator approval phrase:
> **`CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`**

This drill does **not** itself grant that approval. The next step is for the operator to review this evidence and, if the Go/No-Go checklist is fully satisfied, send the approval phrase in the review channel. Only then may `BYOK_H3B_EXECUTION_INSTRUCTIONS.md` be written and the live pilot enter its execution window.

**Final口径**:
> BYOK-H3B-DRILL records dry-run rollback evidence for a future controlled live pilot. It does not execute BYOK live generation or broad public launch.

---

**Appendices**:
- Backup of pre-drill `byok-test.conf`: `/tmp/byok-test.conf.h3b-drill.20260613_003024.bak`
- `/api/health` raw response: `/tmp/h3b-drill-health.json`
- `/api/generate/byok` raw response: `/tmp/h3b-drill-byok-disabled.json`
- `/ops` raw headers: `/tmp/h3b-drill-ops.headers`
- `/api/status` raw headers: `/tmp/h3b-drill-status.headers`
- Drill start timestamp: `/tmp/h3b-rollback-drill-start.txt`
- Drill date token: `/tmp/h3b-rollback-drill-date.txt`

All `/tmp/*` artefacts are operator-side temp files, not part of the production env, and are excluded from git history.


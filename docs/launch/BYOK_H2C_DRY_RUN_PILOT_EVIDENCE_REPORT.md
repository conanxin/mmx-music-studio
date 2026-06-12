# BYOK-H2C Dry-Run Pilot Evidence Report

> **Status:** `H2C_DRY_RUN_PILOT_PASS_ROLLED_BACK`
> **Phase:** BYOK-H2C (Real dry-run pilot execution)
> **Report date:** 2026-06-12
> **Audience:** operator + future maintainer

---

## 1. Executive Summary

H2C real dry-run pilot completed. Final status: **`H2C_DRY_RUN_PILOT_PASS_ROLLED_BACK`**.

| Result | Value |
|---|---|
| Testers | 4 / 4 PASS |
| Success-path `[byok-turnstile-ok]` lines | 4 |
| Failure-path `[byok-turnstile-debug]` during pilot | 0 |
| 8-pattern leak audit | ALL CLEAR |
| BYOK live calls | 0 |
| Real MiniMax calls | 0 |
| Music generated | 0 |
| Real MiniMax keys used | 0 |
| Production rollback | Completed |
| Production safe default | Restored |
| Broad public launch | NO |

**Final wording (canonical):**

> BYOK-H2C completed a controlled dry-run pilot and rolled production back to safe default. It did not enable BYOK live generation or broad public launch.

---

## 2. Pilot Window

| Field | Value |
|---|---|
| Pilot start (ISO 8601) | `2026-06-12T22:05:05+08:00` |
| First success timestamp | `2026-06-12T22:05:48+08:00` |
| Last success timestamp | `2026-06-12T22:08:32+08:00` |
| Pilot window duration | ~3 min 27 s |
| Hostname (all 4) | `music.conanxin.com` |
| Environment | Production (`music.conanxin.com`) |
| Entry URL | `https://music.conanxin.com/?h2c=1` |

Pilot start was recorded to `/tmp/h2c-pilot-start.txt` before tester submissions were accepted. Success timestamps were extracted from `journalctl -u mmx-music-studio --since "<PILOT_START>"`.

---

## 3. Success-Path Evidence

Each row corresponds to a unique real tester submission (4 unique `requestId` values × 4 unique `tokenSha256_8` hashes = 4 distinct real browser sessions).

| # | requestId | tokenLength | tokenSha256_8 | cloudflare | action | outcome |
|---|---|---|---|---|---|---|
| 1 | `byok_8d4ffa2fbe94` | 752 | `3281197b` | `success=true errorCodes=[]` | `byok-generate` | `turnstile_ok` |
| 2 | `byok_717b3025da5a` | 773 | `9a0cf82b` | `success=true errorCodes=[]` | `byok-generate` | `turnstile_ok` |
| 3 | `byok_d7b73105d73c` | 752 | `e43473eb` | `success=true errorCodes=[]` | `byok-generate` | `turnstile_ok` |
| 4 | `byok_1a526bf40112` | 773 | `e94bc7e0` | `success=true errorCodes=[]` | `byok-generate` | `turnstile_ok` |

All 4 entries:

- `hostname=music.conanxin.com` (correct production domain)
- `cloudflareSuccess=true` and `cloudflareErrorCodes=[]` (real Turnstile Siteverify pass)
- `action=byok-generate` (H1 hotfix `0114269` action metadata)
- `outcome=turnstile_ok` (H2B success-path logging `baaafd7`)

### How this maps to the canonical success marker

Server code path (`server/index.ts` lines 1848, 1912) after a `[byok-turnstile-ok]` log:

1. Validates `apiKey` shape (regex check, no real call)
2. Validates `prompt` non-empty (string check, no real call)
3. Returns HTTP 200 with body:
   ```json
   { "ok": true, "code": "byok_dry_run_only", "message": "BYOK 接通验证成功。当前为 dry-run，未触发真实 provider 调用。" }
   ```

`code: 'byok_dry_run_only'` is the canonical success marker for valid-token dry-run E2E. All 4 testers received this 200 response per operator confirmation ("测试正常").

---

## 4. Failure-Path Evidence

**Pilot window `[byok-turnstile-debug]` count: 0**

All 8 historical `[byok-turnstile-debug]` journal entries are from pre-pilot probes (H1 closeout, H1-Hotfix C/D/E, H2A, H2B sandbox testing) — timestamps 15:47, 17:03, 17:08, 18:47, 19:08, 21:25, 21:26, 21:27 — all **before** the pilot start at 22:05:05.

This means:

- 0 testers encountered a Turnstile validation issue (no `invalid-input-response`, no `timeout-or-duplicate`, no other error)
- 0 testers were blocked by Cloudflare Siteverify
- 0 testers were rejected by the gate

---

## 5. Leak Audit

8-pattern strict leak audit applied to all 12 captured journal lines (4 success + 8 pre-pilot debug):

| Pattern | Result |
|---|---|
| Raw token (=value20+ chars) | no leak |
| User apiKey (any format) | no leak |
| `Authorization: Bearer ...` | no leak |
| `TURNSTILE_SECRET_KEY` (35-char, `1x`-prefix) | no leak |
| `sk-`-prefixed real key | no leak |
| Full prompt value | no leak |
| Full lyrics value | no leak |
| Generic secret/password | no leak |

All 12 log lines only contain redacted diagnostic fields:
`requestId`, `tokenLength`, `tokenSha256_8`, `cloudflareSuccess`, `cloudflareErrorCodes`, `hostname`, `action`, `cdata`, `outcome`.

**Audit result: ALL CLEAR.**

---

## 6. Live-Call Boundary

| Boundary | Value |
|---|---|
| `BYOK_DRY_RUN_ONLY` | `true` (env, active during pilot) |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` (env, active during pilot) |
| `BYOK live calls` | **0** |
| Real MiniMax calls | **0** |
| Music generated | **0** |
| Real MiniMax keys | **0** (testers used `sk-FAKE-...`) |
| Server key (production) | `false` (`/api/health` `hasServerKey=false`) |

Code path: when `BYOK_DRY_RUN_ONLY=true`, after Turnstile passes the server validates `apiKey` shape and `prompt` only, then returns `byok_dry_run_only` 200. **No provider call is constructed or sent**, regardless of input key content.

---

## 7. Rollback Evidence

After pilot completion, `byok-test.conf` was restored to the H1 closeout default (3 lines):

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
```

Drop-in list (3 files):
- `00-turnstile.conf` — test Turnstile creds + `TURNSTILE_BYOK_REQUIRED=true`
- `byok-test.conf` — H1 closeout default
- `turnstile-real.conf` — real Turnstile site/secret, mode `600 root:root` (kept, value redacted)

### Post-rollback verification

| Verification | Result |
|---|---|
| `publicByokEnabled` | `false` |
| `BYOK_DRY_RUN_ONLY` | `true` |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` |
| `TURNSTILE_DEBUG_REDACTED` | `<unset>` (env fully cleared) |
| `POST /api/generate/byok` (any payload) | `{"ok":false,"code":"byok_generation_disabled","message":"公开 BYOK 生成暂未开放","hint":"等待后续 phase 显式开启"}` |
| `/api/health` | `publicByokEnabled=false / byokEnabled=false / hasServerKey=false` (6-pattern audit clean) |
| `/ops` and `/api/status` | 302 to `soft-wood-f891.cloudflareaccess.com` (kid=`a3346d...`), `www-authenticate: Cloudflare-Access` |
| `MainPID` (post-rollback) | `441936` (was `437656` in pilot mode) |

Backups:
- H1 closeout default (pre-H2C): `/tmp/byok-test.conf.pre-h2c.20260612_220409.bak`
- H2C pilot mode (4 lines): `/tmp/byok-test.conf.h2c-pilot.20260612_221511.bak`

---

## 8. What H2C Proves

1. **Real-browser Turnstile flow works** — 4 testers completed the widget in production (sandbox curl cannot replicate).
2. **Success-path `[byok-turnstile-ok]` works** — every successful Turnstile verify emitted the log line.
3. **Action metadata `byok-generate` works** — H1 hotfix `0114269` action metadata is correctly attached and read by the server.
4. **Dry-run BYOK form flow works** — UI shows the form, accepts input, validates locally, and reaches the response stage.
5. **Log redaction works** — 8-pattern audit on real production logs found zero leaks.
6. **Rollback works** — production was reverted to safe default cleanly with no service interruption and no side-effects.
7. **Pilot can be run without live generation** — `BYOK_DRY_RUN_ONLY=true` provides a hard code-level boundary; no path exists from form input to provider call without an explicit env flag.

---

## 9. What H2C Does NOT Prove

1. **Live generation readiness** — no real provider call was made.
2. **Provider cost behavior** — no API costs were incurred.
3. **Real user MiniMax key success** — testers used `sk-FAKE-...` keys; no real provider auth was attempted.
4. **Broad public launch safety** — cohort was limited to 4 testers recruited by operator.
5. **H3 readiness** — H3 (controlled live pilot) still requires:
   - Explicit operator approval
   - Cost ceiling
   - Circuit breaker design
   - Rollback drill
   - Provider warning UI
   - Real key isolation
   - 12 Go/No-Go gates (see `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` for the spec)

---

## 10. Lessons Learned

### 10.1 systemd drop-in lex order gotcha

**Problem:** Adding `99-byok-h2c-dry-run.conf` does NOT guarantee override of an existing `byok-test.conf`. systemd reads drop-ins in lexicographic order, and **the later-loaded file wins**. Since `'b' > '9'` in ASCII, `byok-test.conf` (letter prefix) is loaded **after** any `99-...conf` (digit prefix), so `byok-test.conf` overrides.

**Solution:** Edit the existing lex-last drop-in directly, with a backup to `/tmp/`:

```bash
sudo cp /etc/systemd/system/mmx-music-studio.service.d/byok-test.conf \
        /tmp/byok-test.conf.pre-h2c.$(date +%Y%m%d_%H%M%S).bak
sudo tee /etc/systemd/system/mmx-music-studio.service.d/byok-test.conf >/dev/null <<'EOF'
[Service]
Environment="PUBLIC_BYOK_ENABLED=true"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
Environment="TURNSTILE_DEBUG_REDACTED=true"
EOF
```

Always verify via `/proc/<PID>/environ` (not just `/api/health`) that the runtime env reflects the intended values.

### 10.2 Sandbox cannot drive real Turnstile success path

**Problem:** `curl` with a dummy token (e.g. `XXXX.DUMMY.TOKEN.XXXX`) can only trigger the **failure path** in production. The success path requires a real browser rendering the Turnstile widget, which calls Cloudflare's challenge API, which returns a real token, which is verified by the server.

**Solution:** Any pilot that needs to validate the **success path** must be human-driven via real browsers. H2C was the first phase to actually exercise the success path. Use H2B's `baaafd7` redacted logging to observe real submissions in production without leaking token data.

### 10.3 Hermes `process output_preview` is unreliable for piped pipelines

**Problem:** When a background watcher runs `journalctl -f | grep ... | python3 ...`, the `output_preview` of the `process` tool sometimes shows 0 lines even when the pipeline is actually receiving data. The capture layer may truncate, or the pipe buffer may not flush to the session log.

**Solution:** Use a side-effect file pattern to verify pipeline output:

```bash
journalctl -u mmx-music-studio -f --no-pager -o short 2>/dev/null \
  | grep --line-buffered -E "byok-turnstile-(ok|debug)" \
  | tee -a /tmp/h2c-seen.log \
  | python3 -u /tmp/h2c-redact.py
```

Then verify with `cat /tmp/h2c-seen.log` (file) instead of `process output_preview` (session log).

### 10.4 Honest failure acknowledgment

H2C's first execution (before this current rollout) was marked `PARTIAL_PASS_WITH_KNOWN_UNCERTAINTY` because:

- The runtime was activated but no real tester cohort was executed
- Success-path logs were not observed
- Pilot was effectively a sandbox run, not a real pilot

The current H2C closeout (`PASS_ROLLED_BACK`) only succeeded because operator (a) confirmed tester availability, (b) ran 4 real browser submissions, (c) confirmed all 4 received the `byok_dry_run_only` response, (d) approved rollback. The lesson: **never declare a pilot "PASS" without a real human-executed test cohort.**

---

## 11. Next Steps

### 11.1 Operator-driven

1. **Summarize tester UX feedback** — collect from the 4 testers what worked, what was confusing, what copy needs improvement. (Operator owns this — I do not have access to tester chat or screenshots.)
2. **Copy / flow fixes** — if feedback surfaces concrete issues, address them in a follow-up phase.

### 11.2 Phase gating

3. **H3 controlled live pilot planning** — only after **explicit operator approval**, and only with:
   - 12 Go/No-Go gates (see `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md`)
   - Cost ceiling
   - Circuit breaker
   - Rollback drill
   - Provider warning UI
   - Real key isolation

4. **No tag, no release** — this phase does not create a release tag. Tags are released only when an operator-initiated, Go-approved phase lands a binary-affecting change.

### 11.3 Documentation

5. **Skill update** — `mmx-music-studio-public-byok-relay` will be patched in the next session to include the H2C real-pilot section, the 3 lessons learned above, and the `byok-h2c-final-evidence-smoke-test.sh` assertion pattern.

---

## Appendix A — Raw redacted journal lines (12 entries)

```
# Pre-pilot failure-path entries (H1/H2A/H2B probes, all before 22:05:05):
[byok-turnstile-debug] requestId=byok_0021a2c943a8 tokenLength=0 tokenSha256_8=<empty> cloudflareSuccess=false cloudflareErrorCodes=[missing-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_0021a2c943a9 tokenLength=0 tokenSha256_8=<empty> cloudflareSuccess=false cloudflareErrorCodes=[missing-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_0021a2c943aa tokenLength=0 tokenSha256_8=<empty> cloudflareSuccess=false cloudflareErrorCodes=[missing-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_0021a2c943ab tokenLength=0 tokenSha256_8=<empty> cloudflareSuccess=false cloudflareErrorCodes=[missing-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_0021a2c943ac tokenLength=20 tokenSha256_8=7a86a0d7 cloudflareSuccess=false cloudflareErrorCodes=[invalid-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_fc9ef121e221 tokenLength=20 tokenSha256_8=7a86a0d7 cloudflareSuccess=false cloudflareErrorCodes=[invalid-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_42c06184690b tokenLength=20 tokenSha256_8=7a86a0d7 cloudflareSuccess=false cloudflareErrorCodes=[invalid-input-response] hostname= action= cdata= outcome=turnstile_invalid
[byok-turnstile-debug] requestId=byok_0021a2c943ad tokenLength=20 tokenSha256_8=7a86a0d7 cloudflareSuccess=false cloudflareErrorCodes=[invalid-input-response] hostname= action= cdata= outcome=turnstile_invalid

# Pilot success-path entries (4 unique testers, 22:05:48–22:08:32):
[byok-turnstile-ok]   requestId=byok_8d4ffa2fbe94 tokenLength=752 tokenSha256_8=3281197b cloudflareSuccess=true cloudflareErrorCodes=[] hostname=music.conanxin.com action=byok-generate cdata= outcome=turnstile_ok
[byok-turnstile-ok]   requestId=byok_717b3025da5a tokenLength=773 tokenSha256_8=9a0cf82b cloudflareSuccess=true cloudflareErrorCodes=[] hostname=music.conanxin.com action=byok-generate cdata= outcome=turnstile_ok
[byok-turnstile-ok]   requestId=byok_d7b73105d73c tokenLength=752 tokenSha256_8=e43473eb cloudflareSuccess=true cloudflareErrorCodes=[] hostname=music.conanxin.com action=byok-generate cdata= outcome=turnstile_ok
[byok-turnstile-ok]   requestId=byok_1a526bf40112 tokenLength=773 tokenSha256_8=e94bc7e0 cloudflareSuccess=true cloudflareErrorCodes=[] hostname=music.conanxin.com action=byok-generate cdata= outcome=turnstile_ok
```

---

## Appendix B — File index

| File | Purpose |
|---|---|
| This document (`docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md`) | H2C final evidence report (you are here) |
| `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` | H2A pilot plan; H2C section appended at section 17 |
| `docs/DEVELOPMENT_HANDOFF.md` | H2C status recorded in In-flight phase section |
| `docs/PUBLIC_RELEASE_READINESS.md` | H2C status recorded in Phase H2C section |
| `README.md` | "Current release" pointer updated to reference this document |
| `scripts/byok-h2c-final-evidence-smoke-test.sh` | Smoke test asserting all 20+ evidence markers are present in this doc + linked docs |
| `/tmp/h2c-pilot-start.txt` | Pilot start timestamp (`2026-06-12T22:05:05+08:00`) |
| `/tmp/h2c-turnstile.log` | Filtered journal log (12 entries, redacted) |
| `/tmp/byok-test.conf.pre-h2c.20260612_220409.bak` | H1 closeout default backup (pre-pilot) |
| `/tmp/byok-test.conf.h2c-pilot.20260612_221511.bak` | H2C pilot mode backup (4 lines) |

---

**End of report.**

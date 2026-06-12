# Phase BYOK-H2A: Dry-Run Pilot Plan

> **Status: PLANNING ONLY**
> This document is a planning artifact. It does not enable BYOK live generation.
> It does not open BYOK to a broad public audience.
> It does not modify production env.

---

## 1. Purpose

Phase BYOK-H2A produces the **dry-run pilot plan** for BYOK (Bring Your Own Key).

This phase is **planning only**. It is **not**:

- The pilot execution itself.
- BYOK live generation.
- Broad public launch.

Phase BYOK-H2 exists to verify, in a small, controlled cohort, that the BYOK **user flow** and **security boundary** behave correctly when real humans complete the form end-to-end. Phase H2 does **not** verify music generation (the dry-run early-return fires before any provider call).

What H2 does verify:

- BYOK UI is reachable and usable.
- Cloudflare Turnstile widget completes in a real browser.
- Server-side Turnstile gate accepts a real token.
- User-supplied fake / test keys are accepted in the form (and silently treated as dry-run-only).
- Dry-run / disabled / validation responses render in the UI with clear, user-friendly Chinese text.
- The user understands "cost is on your own MiniMax account" before submitting.
- Logs are redacted — no token, no secret, no user apiKey.
- Rollback to safe default is one shell script.

What H2 does **not** verify:

- Real MiniMax music generation (dry-run returns before any provider call).
- Real user apiKey relay (live is gated behind 3+1 env flag and `CONFIRM_BYOK_LIVE_RELAY_TEST`).
- Provider error mapping (no provider call happens).

---

## 2. Current readiness state

| Component | State | Reference |
|---|---|---|
| BYOK direct relay endpoint (`POST /api/generate/byok`) | Implemented | `server/index.ts`, `server/adapters/minimax-api/byok.ts` |
| BYOK-G single operator-approved live call | Completed (one-time, audit-only) | `docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md` |
| Turnstile server-side gate (`server/security/turnstile.ts`) | Implemented | `verifyTurnstileToken` + `expectedAction: 'byok-generate'` |
| Frontend Turnstile widget runtime | Implemented | `src/features/studio/ByokPanel.tsx` (widget render with `action: 'byok-generate'`) |
| Redacted Turnstile Siteverify diagnostics | Implemented (env-gated) | `TURNSTILE_DEBUG_REDACTED=true` toggle in `turnstile-debug.conf` |
| H1 valid-token browser E2E | **PASS** | requestId `byok_421450bf6804`, `code: byok_dry_run_only` |
| H1 closeout | **PASS** | `PUBLIC_BYOK_ENABLED=false` restored; `turnstile-debug.conf` removed; `turnstile-real.conf` preserved (mode 600) |
| Production env | Safe default | `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`, real Turnstile site key + secret configured |
| `/ops` and `/api/status` | Protected by Cloudflare Access | `scripts/deploy-cf-c-access-smoke-test.sh` |
| `/api/health` redacted | CLEAN — no secret / token / Authorization / user apiKey | 44 fields, no forbidden substrings |

---

## 3. H2 dry-run scope

### 3.1 In scope (H2 ALLOWED)

- Opening the BYOK UI for testers in the cohort.
- Completing the Cloudflare Turnstile widget.
- Filling in a fake / test-format apiKey (e.g. `sk-FAKE-H2-...`).
- Receiving `byok_dry_run_only` (success dry-run) or `byok_generation_disabled` (kill switch) or `byok_invalid_input` (validation) responses.
- Inspecting server logs for redaction discipline.
- Reading the UI copy and error messages for clarity.
- Reading the "费用由你自己的 MiniMax 账户承担" notice and confirming the user understands it.
- Submitting the tester feedback template (Section 7).

### 3.2 Out of scope (H2 FORBIDDEN)

- Calling the real MiniMax API.
- Generating real music.
- Using the production live path (3+1 gate stays closed).
- Broad public launch.
- Uncontrolled public sharing of the BYOK URL.
- Any input that the tester wants to keep private (testers are told to use only fake / non-sensitive prompts).

---

## 4. H2 environment matrix

The matrix below is the single source of truth for what env state each phase puts the service in. **It is descriptive, not prescriptive for H2A.** H2A only produces this plan; H2B (success-path logging hotfix) and H2C (pilot execution) will reference this matrix.

| Stage | `PUBLIC_BYOK_ENABLED` | `BYOK_DRY_RUN_ONLY` | `BYOK_DIRECT_LIVE_ENABLED` | `TURNSTILE_BYOK_REQUIRED` | Purpose |
|---|---|---|---|---|---|
| **Current safe default** (post-H1 closeout) | `false` | `true` | `false` | `true` | Production; BYOK kill switch off; dry-run default; live gate closed; Turnstile on |
| **H2A — planning only (this phase)** | `false` (UNCHANGED) | `true` (UNCHANGED) | `false` (UNCHANGED) | `true` (UNCHANGED) | This phase does NOT modify env. Plan + smoke + doc only. |
| **H2B — success-path log hotfix** | `false` (UNCHANGED) | `true` (UNCHANGED) | `false` (UNCHANGED) | `true` (UNCHANGED) | Code change to emit `[byok-turnstile-ok]` on dry-run success. Env unchanged. |
| **H2C — dry-run pilot execution** | **`true`** (pilot-only) | `true` | `false` (live stays closed) | `true` | Temporarily open the kill switch for the cohort. **Live stays off.** |
| **H2D — pilot rollback** | `false` | `true` | `false` | `true` | Restore safe default. |
| **H3 controlled live pilot** | `true` | `false` | **`true`** | `true` | **Requires explicit operator approval.** Independent risk review. Circuit breaker. Real key isolation. NOT in H2 scope. |

Notes:

- `BYOK_DIRECT_LIVE_ENABLED` must remain `false` through ALL H2 stages.
- `BYOK_DRY_RUN_ONLY` must remain `true` through ALL H2 stages.
- H3 is a placeholder row for future planning; it is not in scope for H2A and is gated behind explicit operator approval.
- The `TURNSTILE_BYOK_REQUIRED=true` is the production-safe default; H2C keeps it on (no relaxation).

---

## 5. Pilot cohort

### 5.1 Size and selection

- **3–5 trusted testers** total.
- Selected by the operator (no public recruitment).
- All testers are aware this is a **dry-run**, not a real generation.
- All testers agree to the tester's instructions in Section 6.
- All testers submit feedback using the template in Section 7.

### 5.2 Tester non-goals

- Testers are NOT expected to use a real MiniMax apiKey. Fake / test-format keys are fine.
- Testers are NOT expected to provide a sensitive prompt. Use any non-private string.
- Testers are NOT expected to report provider-side behavior. There is no provider call in H2.
- Testers ARE expected to report UI clarity, copy quality, flow friction, and any error messages they see.

### 5.3 Tester communication

The operator invites each tester individually (DM / private channel). The invitation links to this plan and includes Section 6 verbatim.

---

## 6. User-facing dry-run instructions (Chinese)

> **这是一次小范围 dry-run 测试，请仔细阅读以下说明：**
>
> 1. **本次测试不会调用 MiniMax，也不会生成任何音乐。** 你提交后服务端会立刻返回 `BYOK 安全链路已就绪，但当前仍为 dry-run`。
> 2. 你可以在 API Key 输入框中填写 **fake key** 或 **测试 key 格式**（例如 `sk-FAKE-H2-...`），不要填写真实的 MiniMax 账户 key。
> 3. 未来的正式 BYOK 会使用 **你自己的 MiniMax Key**，**费用由你自己的 MiniMax 账户承担**。本站不会保存你的 API Key，关闭页面后即丢失。
> 4. 请**不要输入敏感内容**（密码、个人信息、版权材料等）。任何提交内容都仅用于测试流程。
> 5. 当前测试目标：**验证 UI 流程、Cloudflare Turnstile 人机验证、错误提示和说明文案**。
> 6. 反馈请使用 **第 7 节** 的反馈模板。
> 7. 关闭页面即视为退出测试。无需卸载或清理任何东西。
>
> 感谢你帮助验证 BYOK 流程。

---

## 7. Tester feedback template

| Field | Notes |
|---|---|
| **Device / browser** | e.g. macOS / Safari 17, Windows / Chrome 124, iOS / Safari Mobile |
| **Did you see the Turnstile widget?** | yes / no (if no, describe what you saw instead) |
| **Could you complete the verification?** | yes / no (if no, screenshot + what blocked) |
| **Are the button labels clear?** | yes / no / suggestions |
| **Did you understand "费用由你自己的 MiniMax 账户承担"?** | yes / no / rephrasing suggestion |
| **Did you understand "当前不生成音乐"?** | yes / no / rephrasing suggestion |
| **What `code` / `message` did the server return?** | (paste from UI; NEVER paste the apiKey you submitted) |
| **Where did you get stuck, if anywhere?** | describe |
| **Screenshots** | attach (redact any key/token if accidentally shown) |
| **Suggestions** | free-form |

> **CRITICAL:** Testers must NEVER include the fake / test apiKey in the feedback. The feedback template is structured to avoid that field. If a tester accidentally pastes a key, the operator redacts it before forwarding to the engineering log.

---

## 8. Pre-pilot checklist

Run **before** the H2C pilot execution. All items must be ✓.

- [ ] H1 valid-token browser E2E is **PASS** (requestId recorded in closeout report).
- [ ] Production safe default is in effect (`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`).
- [ ] `/api/health` returns `turnstileSecretKeyConfigured=true`, `turnstileSiteKeyConfigured=true`, `publicByokEnabled=false`, no `secret` / `token` / `Authorization` / `userKey` / `userApiKey` substring in any field name.
- [ ] Real Turnstile site key + secret are configured (in `turnstile-real.conf`, mode 600).
- [ ] Test Turnstile site key + secret are preserved in `00-turnstile.conf` (H2 will use the real key; the test key is the H1 fallback).
- [ ] `/ops` and `/api/status` are still protected by Cloudflare Access.
- [ ] Server-side no-token gate returns `turnstile_required` (smoke + curl).
- [ ] Server-side invalid-token gate returns `turnstile_invalid` (smoke + curl, with redacted log line `cloudflareErrorCodes=[invalid-input-response]`).
- [ ] Dry-run path returns `byok_dry_run_only` (smoke + curl with a known fake token — but only via the curl-driven gate test, not via real browser).
- [ ] Rollback command is ready (Section 11) and dry-run-tested in staging.
- [ ] Monitoring window is open: `journalctl -u mmx-music-studio -f` is being followed by the operator.
- [ ] Tester list is finalized: 3–5 names, each has received Section 6.
- [ ] The H2B success-path log hotfix is in effect (or explicitly deferred with operator sign-off — see Section 13).

---

## 9. Pilot execution checklist (H2C)

Run **during** the H2C pilot. Order matters.

1. [ ] Set `PUBLIC_BYOK_ENABLED=true` in `byok-test.conf` (temporary).
2. [ ] Keep `BYOK_DRY_RUN_ONLY=true` (UNCHANGED).
3. [ ] Keep `BYOK_DIRECT_LIVE_ENABLED=false` (UNCHANGED — do NOT flip).
4. [ ] Keep `TURNSTILE_BYOK_REQUIRED=true` (UNCHANGED).
5. [ ] `sudo systemctl daemon-reload && sudo systemctl restart mmx-music-studio`.
6. [ ] Verify `/api/health` shows `publicByokEnabled=true`.
7. [ ] Verify `POST /api/generate/byok` without token returns `turnstile_required` (gate still on).
8. [ ] Verify `POST /api/generate/byok` with a fake test apiKey + a server-side test turnstileToken returns `byok_dry_run_only` (this is the same gate the browser goes through, but driven by curl for a sanity check).
9. [ ] Invite tester 1 (DM with the Section 6 instructions + Section 7 feedback template).
10. [ ] Wait for tester 1's "done" message. Read the latest `journalctl` for `[byok-turnstile-debug]` and `[byok-turnstile-ok]` (if H2B is in).
11. [ ] If H2B is NOT in: confirm UI success path is acceptable based on tester 1's report (no silent gaps).
12. [ ] Invite testers 2–5 sequentially, one at a time. Wait for each "done" before inviting the next.
13. [ ] Collect all 3–5 feedback submissions.
14. [ ] **Do not invite anyone outside the cohort.**
15. [ ] **Do not open the live gate.** (`BYOK_DIRECT_LIVE_ENABLED` stays `false`.)

---

## 10. Monitoring checklist

Monitor during H2C. Each item is a query the operator runs in a separate `tmux` / `screen` window.

| Metric | Command | Expected |
|---|---|---|
| `/api/generate/byok` request count | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -c "byok-turnstile-ok\|byok-turnstile-debug\|code.*byok_dry_run_only"` | grows with tester activity |
| `turnstile_required` count | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -c "code.*turnstile_required"` | 0 (testers should always complete widget) |
| `turnstile_invalid` count | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -c "code.*turnstile_invalid"` | 0 — any non-zero is a fail signal |
| `byok_dry_run_only` count | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -c "code.*byok_dry_run_only"` | equals the number of tester submissions |
| 4xx / 5xx rate | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -E " 4[0-9][0-9] \| 5[0-9][0-9] " \| wc -l` | 0 unexpected (only intentional `turnstile_required` / `turnstile_invalid` from gate tests) |
| Suspicious IP pattern | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -oE "from [0-9.]+" \| sort \| uniq -c \| sort -rn \| head` | only the cohort's IPs appear; no spike from non-cohort sources |
| Raw key / token / secret leak | `journalctl -u mmx-music-studio --since "1 hour ago" \| grep -E "sk-[A-Za-z0-9]{20,}\|Bearer [A-Za-z0-9_=-]{20,}\|eyJ[A-Za-z0-9_=-]{20,}\|TURNSTILE_SECRET_KEY=[^$]"` | 0 hits |
| Storage growth | `du -sh storage/ runtime/ 2>/dev/null` | flat vs pre-pilot snapshot (the H2 dry-run should NOT grow storage) |
| Generated audio count | `find runtime/ -name "*.mp3" -newer /tmp/h2_pilot_start_marker 2>/dev/null \| wc -l` | **0 — non-negotiable** |
| Cloudflare Access on `/ops` and `/api/status` | `curl -sI https://music.conanxin.com/ops \| head -1` + `curl -sI https://music.conanxin.com/api/status \| head -1` | 401 / 403 (Access policy still active) |

The "Generated audio count = 0" line is the most important. If even one mp3 appears in `runtime/`, the pilot has crossed a line — immediate rollback (Section 11) and stop the pilot.

---

## 11. Rollback plan

If any of the monitoring signals in Section 10 goes red, or if any tester reports a critical UX defect (e.g. the form is broken, the user accidentally submits a real key, the page exposes another user's data), execute rollback in this exact order:

```bash
# 1. Disable BYOK public kill switch (immediate, no redeploy)
sudo tee /etc/systemd/system/mmx-music-studio.service.d/byok-test.conf >/dev/null <<'EOF'
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
EOF

# 2. Restart
sudo systemctl daemon-reload
sudo systemctl restart mmx-music-studio

# 3. Wait for ready
sleep 5
systemctl is-active mmx-music-studio
```

Then verify rollback:

```bash
# 4. /api/health must show publicByokEnabled=false
curl -s "https://music.conanxin.com/api/health?ts=$(date +%s)" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'publicByokEnabled={d.get(\"publicByokEnabled\")} byokEnabled={d.get(\"byokEnabled\")}')"
# Expect: publicByokEnabled=False byokEnabled=False

# 5. /api/generate/byok must return byok_generation_disabled
curl -s -X POST https://music.conanxin.com/api/generate/byok \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk-FAKE","input":{"prompt":"post h2 rollback","mode":"instrumental"},"region":"cn"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('code'))"
# Expect: byok_generation_disabled

# 6. /api/health must not leak any secret / token / Authorization / user key
curl -s "https://music.conanxin.com/api/health?ts=$(date +%s)" | python3 -c "
import json, sys
d = json.load(sys.stdin)
forbidden = [k for k in d if any(p in k for p in ['TURNSTILE_SECRET_KEY','secret','token','authorization','userKey','userApiKey','apiKey'])]
if forbidden:
    print('FAIL: forbidden fields:', forbidden)
    sys.exit(1)
print('PASS: no forbidden fields in /api/health')
"

# 7. Confirm zero new audio
find runtime/ -name "*.mp3" -newer /tmp/h2_pilot_start_marker 2>/dev/null | wc -l
# Expect: 0
```

Finally, notify testers (DM each one): "Pilot paused. Service is back to safe default. Thanks for the help."

Rollback must complete within **5 minutes** of the trigger event. If rollback takes longer, the pilot is aborted and a postmortem is written before any retry.

---

## 12. Go / No-Go gates for H3 (controlled live pilot)

H3 is **NOT** in scope for H2A. H3 is a placeholder, gated behind all of the following. ALL must be true before H3 planning begins:

- [ ] H2 dry-run pilot is **PASS** (Section 8 + 9 + 10 all green).
- [ ] All 3–5 tester feedback submissions are reviewed and any P0 / P1 issues are resolved.
- [ ] No secret / token / user key appears in any log line, audit file, screenshot, or commit.
- [ ] No unexpected storage growth (storage diff vs pre-pilot snapshot is zero or noise-level).
- [ ] No unexpected 5xx in the monitoring window.
- [ ] Rollback (Section 11) was executed at least once (either proactively as a drill, or in response to a real signal) and verified.
- [ ] **Explicit operator approval** is recorded in writing (chat message, audit log entry, or signed design doc).
- [ ] A separate H3 risk-review document exists: cost ceiling, billing alert, kill switch, secret rotation, per-request apiKey isolation, child process env audit, redacted error path.
- [ ] Circuit breaker is documented and tested: at most N live attempts per H3 window, hard stop on consecutive failures, no retry storm.
- [ ] The provider cost warning is visible in the UI BEFORE the user submits a real key (not after).
- [ ] Real apiKey isolation is confirmed by code review: `server/adapters/minimax-api/byok.ts` only writes `MINIMAX_API_KEY` to `childEnv`; the parent process's `MINIMAX_API_KEY` (site operator key) is never copied into `childEnv`.

If ANY of the above is missing, H3 is **NO-GO**.

---

## 13. Recommended H2 improvement before execution (H2B)

### Problem

The H1-Hotfix-C redacted Siteverify diagnostics log line is emitted **only on Turnstile failure** (inside `if (!turnstileResult.ok)` in `server/index.ts`). On a successful dry-run, the path is silent — no `[byok-turnstile-ok]` log is written. This made H1 closeout rely on the UI screenshot + server response (`code: byok_dry_run_only`) as the success signal, because no log line was available to confirm the server-side success.

This is **acceptable for H1 closeout** (the response is on the wire and the code path is unambiguous). But for H2, where multiple testers will submit, having **no log line at all** for successful dry-run submissions makes it hard to:

- Distinguish "tester successfully submitted" from "tester loaded the page but never clicked submit".
- Audit per-tester flow (only the requestId in the response is recoverable).
- Spot-check that the action metadata was echoed correctly in the success path (the failure path's log line includes action, but the success path doesn't).

### Recommended fix (H2B — small, isolated hotfix)

Add a symmetric success-path log line in `server/index.ts` in `handleByokGenerate`, **inside** the `if (turnstileResult.ok) { ... }` branch and **before** the dry-run early return:

```typescript
if (turnstileResult.ok) {
  // H2B: symmetric success-path redacted log line
  // Does NOT log token, secret, or user apiKey.
  // Mirrors the H1-Hotfix-C failure-path log shape for consistency.
  if (process.env.TURNSTILE_DEBUG_REDACTED === 'true') {
    console.warn(
      `[byok-turnstile-ok] requestId=${requestId} action=byok-generate outcome=dry_run`
    );
  }
}
```

The line is **only emitted when `TURNSTILE_DEBUG_REDACTED=true`** (same env gate as H1-Hotfix-C, so it stays off in production by default). It uses the same redacted shape as the failure log line for grep consistency.

### What H2B explicitly does NOT do

- It does NOT log the token.
- It does NOT log the secret.
- It does NOT log the user apiKey (or any hash / fingerprint / length of it).
- It does NOT change the user-facing behavior.
- It does NOT open the live gate.
- It does NOT touch any other code path outside the `if (turnstileResult.ok)` branch of `handleByokGenerate`.

### H2B smoke test (will land with the hotfix)

A new smoke test, `scripts/byok-h2b-success-path-log-smoke-test.sh`, will assert:

- The literal `[byok-turnstile-ok]` appears in `server/index.ts` (and only inside the `if (turnstileResult.ok)` branch).
- The line is gated by `TURNSTILE_DEBUG_REDACTED === 'true'`.
- The line does not reference `token`, `secret`, `apiKey`, `Authorization`, or `Bearer`.
- The line is in `handleByokGenerate` (not in some other handler).

### When to land H2B

- Land **before** H2C pilot execution (so the operator can see the success-path log line in the monitoring window).
- Or land **after** H2C pilot execution (if the existing UI-evidence + response-evidence is deemed sufficient and the success-path gap is documented as a known limitation). Operator decision.

---

## 14. Boundaries (recap)

- **No production env change in H2A.** H2A is a planning artifact only.
- **No live call.** H2 dry-run returns before any provider call.
- **No real music generation.** `byok_dry_run_only` is the canonical response.
- **No real MiniMax user key.** Testers use fake / test-format keys.
- **No public launch.** 3–5 trusted testers only.
- **No release tag.** This is a code-only hotfix on master, not a new release line.
- **No tag movement.** v0.4.31-alpha stays at `ee6a8a1`. v0.4.30-alpha stays at `4748c41`. v0.4.29-alpha stays at `7d45e12`. (All pre-H1 tags unchanged.)

---

## 15. Final wording (canonical for any H2A user-facing communication)

> "BYOK-H2A prepares the dry-run pilot plan for BYOK. It does not enable BYOK live generation or broad public launch."

This wording is required for any v0.4.31-alpha or later H2A closeout communication. It explicitly:

1. Names the change (planning only, no execution).
2. States what was verified (a plan, not a pilot).
3. States the truth (does NOT enable BYOK live; does NOT broad public launch).
4. Forbids drift into "BYOK is now live" or "BYOK is now public" claims.

---

## 16. Update log: H2B shipped (success-path redacted log)

**Status (2026-06-12):** H2B has been shipped as a follow-up hotfix to H2A.

What changed in H2B:

- `server/index.ts` now emits `[byok-turnstile-ok]` on the success path, mirroring the H1-Hotfix-C failure-path `[byok-turnstile-debug]`.
- Both logs are gated by the same `TURNSTILE_DEBUG_REDACTED=true` runtime flag (the `redacted` field of `verifyTurnstileToken` is only populated when this flag is on).
- The success log includes the same redacted fields as the failure log: `requestId`, `tokenLength`, `tokenSha256_8`, `cloudflareSuccess`, `cloudflareErrorCodes`, `hostname`, `action`, `cdata`, `outcome=turnstile_ok`.
- A new smoke test `scripts/byok-h2b-success-log-smoke-test.sh` (18/18 PASS) validates the change and asserts the redaction policy is preserved.

Operational impact on H2C pilot execution:

- The operator no longer needs to rely solely on UI screenshots + server responses to confirm a tester actually submitted. The journal can now be grepped for `[byok-turnstile-ok]` to confirm a per-request success signal.
- Recommended grep: `journalctl -u mmx-music-studio --since "1 hour ago" | grep -E "byok-turnstile-(ok|debug)"`.
- The H2B log is per-request and only emitted when `TURNSTILE_DEBUG_REDACTED=true`. The operator opens the flag for H2C pilot, closes it after.

What H2B did NOT do:

- No production env change.
- No new release tag. v0.4.31-alpha tag stays at `ee6a8a1`. All pre-H1 tags unchanged.
- No change to the live path / dry-run early return / MiniMax call logic. H2B is **observability only**.

Final wording for H2B:

> "BYOK-H2B adds success-path redacted Turnstile logging for dry-run pilot observability. It does not enable BYOK live generation or broad public launch."

---

## 17. Update log: H2C runtime-ready, then rolled back (pilot not actually executed)

**Status (2026-06-12):** H2C runtime was activated, sandbox-side verifications passed, but the pilot was **not actually executed** with a real tester cohort. Production was rolled back to safe default.

What happened in H2C:

- H2B commit (`baaafd7`) was already deployed to production before H2C started.
- A temporary H2C drop-in was prepared: `byok-test.conf` was rewritten to set `PUBLIC_BYOK_ENABLED=true`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_DEBUG_REDACTED=true`. Backup of the H2C version saved at `/tmp/byok-test.conf.h2c.bak`.
- Service was restarted. MainPID cycled 422764 → 428445. Process env confirmed: `PUBLIC_BYOK_ENABLED=true, TURNSTILE_DEBUG_REDACTED=true`.
- **Sandbox-side verifications PASS** (server-side curl, no real browser):
  - `/api/health` → `publicByokEnabled=true, byokEnabled=false, hasServerKey=false` ✅
  - `/api/generate/byok` no-token → `code=turnstile_required` ✅
  - H2B `[byok-turnstile-debug]` failure-path log fired in production (3 requestIds: `byok_0021a2c943ac`, `byok_fc9ef121e221`, `byok_42c06184690b`) with `cloudflareErrorCodes=[invalid-input-response]` — redactor end-to-end verified, no leak ✅
- **Pilot execution did NOT actually happen.** No real tester in a real browser submitted a fresh Turnstile token. H2B `[byok-turnstile-ok]` success-path log was **not** observed in production.
- **Rollback executed**:
  - `byok-test.conf` reverted to 3-line safe default (`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`).
  - `TURNSTILE_DEBUG_REDACTED` is now `<unset>` in process env (env fully cleared).
  - `sudo systemctl daemon-reload && restart` → MainPID 428445, active/running.
  - Residual journal watch (PID 424825) cleaned via `sudo pkill -9 -f "journalctl -u mmx-music-studio.*-f"`.
- **Post-rollback verifications PASS**:
  - `/api/health` → `publicByokEnabled=false, byokEnabled=false, hasServerKey=false` ✅
  - `/api/generate/byok` (fake key, no token) → `code=byok_generation_disabled` ✅ (gate closed pre-Turnstile)
  - `/api/health` exposes only public `turnstileSiteKey` (24 chars) + boolean configs; **no `TURNSTILE_SECRET_KEY`, no raw token, no user key, no Authorization, no full prompt** ✅
  - `/ops` and `/api/status` → 302 to `soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/...` (Access protection intact) ✅

Lessons learned (to be patched into `mmx-music-studio-public-byok-relay` skill on next session):

1. **systemd drop-in lex order gotcha (recurring)**: Adding a new drop-in named `99-byok-h2c-dry-run.conf` did NOT override `byok-test.conf`. The merge order is determined by lexicographic sort of filenames within `/etc/systemd/system/<unit>.service.d/`, with later files winning — but `byok-test.conf` (which existed before) was sorted later, so it kept winning. **Fix: directly edit the existing drop-in file, and back up the previous version to `/tmp/`.**
2. **Sandbox cannot fake real tester pilot**: H2C success-path verification requires a real browser Turnstile widget, which sandbox curl cannot simulate. The Cloudflare test secret (`1x00000000000000000000AA`) is sandbox-only; the production secret (`0x4AAA...`, 35 chars) returns different results. **H2C pilot must be human-driven, not sandbox-driven.**
3. **Background process `output_preview` is unreliable**: The Hermes `process` tool's `output_preview` did not capture piped output from `journalctl | grep | python3` — the watch was alive but the tool showed empty preview. Workaround: use `tee /tmp/h2c-seen.log` side-effect for verification.

Final wording for H2C:

> "BYOK-H2C was runtime-ready but pilot execution has not actually occurred. Production has been rolled back to safe default. BYOK live generation remains disabled."

Next-step recommendations (operator decides):

- Schedule a real H2C dry-run pilot window with 3–5 trusted testers, each on a real browser. Operator opens `PUBLIC_BYOK_ENABLED=true` and `TURNSTILE_DEBUG_REDACTED=true` for the window, then rolls back.
- H3 controlled live pilot still requires explicit operator approval, cost ceiling, circuit breaker documentation, and H2C real execution PASS.
- No code commit was made for H2C. This is a **runtime-only closeout**.

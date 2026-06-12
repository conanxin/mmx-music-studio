# BYOK-H3 Controlled Live Pilot Plan

> **Status: PLANNING ONLY**
> This document defines the controlled live pilot plan for BYOK.
> It is **not** a live execution authorization.
> It does **not** open BYOK to a broad public audience.
> It does **not** modify production environment.
> H3 live execution requires a **separate explicit operator approval** as described in Section 4.

> **Key statement:** BYOK-H3A prepares the controlled live pilot plan for BYOK. It does not enable BYOK live generation or broad public launch.

> **Last updated:** 2026-06-12 (after H2D UX/copy polish closure).

---

## 1. Purpose

This document (BYOK-H3A) is **planning only**. It does not execute a live pilot, it does not open BYOK to a broad public audience, and it does not modify the production environment.

Goals of this document:

- Define the controlled live pilot plan for BYOK (`BYOK-H3 controlled live pilot`).
- Define a **separate explicit operator approval gate** before H3 live execution.
- Define the **environment toggle matrix** (safe default / H2 dry-run / H3 live candidate / emergency rollback).
- Define **cost ceiling**, **circuit breaker**, and **rollback drill** requirements.
- Define **real API key isolation** rules.
- Define **provider call boundary** rules (no operator-key fallback, no CLI path, no site operator key).
- Define **monitoring checklist**, **tester instructions**, and **incident response**.
- Define a **Go / No-Go checklist** that must be 100% YES before H3 live execution.

H3 live execution **only** proceeds after:

1. This plan is merged.
2. A **separate explicit operator approval** is received (Section 4).
3. The Go / No-Go checklist (Section 14) is fully satisfied.

Until then, BYOK remains in the current safe default (H1 closeout): `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`.


---

## 2. Readiness Evidence From H1 / H2

H3 inherits readiness from the following previously-passed phases:

| Phase | Status | Evidence |
|---|---|---|
| H1 valid-token E2E | PASS | Turnstile widget render + redacted siteverify + `outcome=turnstile_ok` |
| H2A dry-run pilot plan | PASS | `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` |
| H2B success-path Turnstile log | PASS | `[byok-turnstile-ok]` redacted logging landed (`baaafd7`) |
| H2C real dry-run pilot | **PASS_ROLLED_BACK** | 4/4 testers, 4 success-path logs, 0 failure, 8-pattern leak audit CLEAN, production rolled back |
| H2C evidence doc | DOCUMENTED | `docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md` |
| H2D UX/copy polish | PASS | `8e2871c` + `scripts/byok-h2d-ux-copy-smoke-test.sh` (48/48) |

References (must be read before H3B execution):

- `docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md` — pilot-window timestamps, requestIds, redacted fields, leak audit, rollback evidence.
- `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` — pilot plan structure used as the basis for H3 (with cost ceiling + circuit breaker overlays).

H3C: H3A does not override H2C. H2C remains the most recent **executed** phase. H3 has not yet been executed.


---

## 3. H3 Scope

### Allowed (after explicit operator approval)

- 3–5 trusted testers only.
- Each tester uses **their own** MiniMax API Key.
- Each tester explicitly understands that the cost is borne by their own MiniMax account.
- Each live generation is recorded as a controlled pilot attempt.
- Short window only (default proposal: 30–60 minutes).
- Small number of generations (default proposal: ≤ 10 total, ≤ 2 per tester).
- Operator must explicitly approve the start.

### Forbidden (never allowed in H3)

- Broad public launch.
- Unbounded tester cohort.
- No cost ceiling.
- No circuit breaker.
- No rollback drill.
- Using the site operator's MiniMax key as a substitute for the user key.
- Saving or persisting the user's API Key.
- Recording raw user key, raw Turnstile token, or raw Authorization header.
- Persisting the user's prompt or lyrics into logs without redaction.

### Cost ceiling preconditions (must be defined before H3B)

- Pilot total generation cap.
- Per-tester generation cap.
- Hourly request cap.
- Daily request cap.
- Per-request failure retry cap.
- Behavior on provider error (default: stop, not retry).

If the cost ceiling is **not** observable, H3 must not enter the live phase.


---

## 4. Explicit Operator Approval Gate

H3 live execution requires a **separate** explicit operator approval. This approval is **independent** of the merge of this plan.

Required confirmation phrase (must be sent by the operator in the operator's normal review channel):

```
CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT
```

Without this confirmation, no person (operator, sub-agent, automation) may:

- Set `BYOK_DIRECT_LIVE_ENABLED=true`.
- Set `BYOK_DRY_RUN_ONLY=false`.
- Open the BYOK live gate for any user.
- Run a live generation against a real MiniMax endpoint.

**What this confirmation means:**

- The operator has read this plan end-to-end.
- The operator has independently checked the Go / No-Go checklist (Section 14).
- The operator has independently checked the cost ceiling (Section 6).
- The operator has independently checked the circuit breaker (Section 7).
- The operator has independently checked the rollback drill (Section 8).
- The operator accepts that any live generation is on a tester-supplied key and on a tester-paid MiniMax account.

**What this confirmation does NOT mean:**

- It does not open BYOK to a broad public audience.
- It does not pre-approve H4 or any later phase.
- It does not waive the H1 / H2 / H3 evidence requirements.


---

## 5. Environment Toggle Matrix

| Stage | `PUBLIC_BYOK_ENABLED` | `BYOK_DRY_RUN_ONLY` | `BYOK_DIRECT_LIVE_ENABLED` | `TURNSTILE_BYOK_REQUIRED` | Purpose |
|---|---|---|---|---|---|
| Current safe default (H1 closeout) | `false` | `true` | `false` | `true` | Production today |
| H2 dry-run pilot (closed) | `true` | `true` | `false` | `true` | H2C was active here, then rolled back |
| **H3 controlled live pilot candidate** | `true` | `false` | **`true`** | `true` | **Requires explicit operator approval (`CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`)** |
| Emergency rollback | `false` | `true` | `false` | `true` | Circuit-breaker end-state |

Notes:

- This document **does not** suggest the live candidate row as a default.
- The live candidate row is **only** reachable after the operator sends the explicit approval phrase.
- The H3 execution instructions (H3B) are intentionally **not** included in this plan; they will be a separate document created only after the approval phrase is received.


---

## 6. Cost Ceiling

Conservative defaults (subject to operator override at the time of approval):

| Cap | Default | Why |
|---|---|---|
| Total live generations in pilot | ≤ 10 | Hard ceiling; cost is on tester, but it bounds operational risk. |
| Generations per tester | ≤ 2 | Prevents one tester from monopolizing pilot quota. |
| Hourly request cap | ≤ 6 | Spreads generations across the window. |
| Daily request cap | ≤ 10 | Same as total ceiling. |
| Per-request failure retry cap | 0 | No silent retry on live path; tester re-submits. |
| Behavior on provider error | **stop**, do not retry | Default fail-closed. |

Cost observability precondition:

- A per-request redacted log line must record: requestId, redacted key hash prefix, redacted token hash prefix, model, outcome, latencyMs, providerErrorCode (if any).
- An hourly aggregate must be computable from these redacted lines.
- If the aggregate is **not** computable, H3 does not enter live phase.

If cost becomes unobservable, or if the cap is exceeded, the circuit breaker (Section 7) is triggered.


---

## 7. Circuit Breaker

A one-shot kill switch is required. It must be runnable in under 60 seconds by the operator.

### Trigger conditions (any one is enough)

- Anomalous generation count.
- Provider error spike.
- Token / key leak detected.
- Storage growth abnormal.
- Access protection lost.
- Unexpected live call outside the window.
- Unexpected audio generation outside the window.
- Tester confusion about cost.
- Any P0 / P1 incident.

### Trigger commands (conceptual; H3B will encode the exact `tee` content)

```bash
# Step 1: Set the safe-default env file.
sudo tee /etc/systemd/system/mmx-music-studio.service.d/byok-test.conf >/dev/null <<'EOF'
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
EOF

# Step 2: Reload + restart.
sudo systemctl daemon-reload
sudo systemctl restart mmx-music-studio
```

### Verification (must pass after the trigger)

```bash
curl -s "https://music.conanxin.com/api/health?ts=$(date +%s)" | python3 -m json.tool
# Expect: publicByokEnabled=false, byokEnabled=false, hasServerKey=false

curl -s -X POST https://music.conanxin.com/api/generate/byok \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk-FAKE-CIRCUIT-BREAKER-0000000000000000","model":"music-2.6","prompt":"circuit breaker test","lyrics":"","isInstrumental":true}' \
  | python3 -m json.tool
# Expect: code=byok_generation_disabled
```

### Authorisation

- The operator is the only person authorised to trigger the circuit breaker.
- The trigger may be initiated by a delegated sub-agent **only** with an explicit operator instruction in the current session. No automated / scheduled trigger is allowed in H3.


---

## 8. Rollback Drill

A **dry-run** rollback drill is required before H3 live execution. It does not perform a real generation.

### Drill steps (planned)

1. From the current safe default, switch the env file to the H2 dry-run pilot row of the matrix (Section 5).
2. `daemon-reload` + `restart` the service.
3. Verify `/api/health` reflects the new state (`publicByokEnabled=true`, `byokEnabled=false`, `hasServerKey=false`).
4. POST a fake request to `/api/generate/byok` (with `byok_test_no_token=1`).
   - Expect `turnstile_required` (not `byok_generation_disabled`).
5. Roll back to the safe default env file.
6. `daemon-reload` + `restart`.
7. Verify `/api/health` is back to safe default.
8. Verify `/api/generate/byok` returns `byok_generation_disabled`.
9. Verify `/ops` and `/api/status` are still protected by Cloudflare Access (302 to Access login or `WWW-Authenticate: Cloudflare-Access`).
10. Verify the leak audit on the new journal lines is CLEAN (no real key, no real token, no Authorization).

### Drill artifacts

- A `byok-h3a-rollback-drill-smoke-test.sh` script (H3A scope, planned) that automates steps 3–10 above.
- A `byok-h3a-rollback-drill-EVIDENCE.md` (H3A scope, planned) that records the timestamps, requestIds, and audit results.

### Acceptance

- Drill completes in under 5 minutes.
- All 8 verifications pass.
- No production data is mutated (no audio, no storage write of any user-controlled value).


---

## 9. Real API Key Isolation

The user's API Key is the most sensitive piece of data in the H3 pilot. The isolation rules are:

- The user Key is used **only for the current request** (per-request scope).
- The user Key is **never** written to:
  - `localStorage`
  - `sessionStorage`
  - `IndexedDB`
  - any URL (query string, path, hash)
  - any server-side persistent storage
  - any log line (raw or partial)
  - any metadata of the generated track
- Only a redacted bucket (e.g. a 4-byte prefix of the SHA-256 of the key, or a `keyHash8` field) is recorded in the redacted log. The minimum needed to detect repeated-key patterns. **No** raw key, **no** raw token, **no** Authorization header is recorded.
- The browser-side panel already enforces this (see H2D `ByokPanel.tsx`).
- The server-side `byok-dry-run-pilot-planning` smoke test asserts no `localStorage.setItem('apiKey'...)` or similar patterns in the bundle.
- The H3B execution smoke will repeat this assertion under the live config.

### Why this matters

- If the user Key leaks, the tester (and any reader of the leak) inherits the cost of subsequent abuse on that key.
- The H1 / H2 path has already been audited for this (8-pattern leak audit CLEAN). H3 must not regress it.


---

## 10. Provider Call Boundary

The H3 live path is strictly bounded:

- **Direct HTTPS adapter only.** The request must go from the server to the MiniMax API over HTTPS using the live per-request user key.
- **No CLI path.** The H3 path must not shell out to the MMX CLI; the CLI path is reserved for the site operator and has no per-request user key flow.
- **No site operator key fallback.** If the user key is missing or invalid, the request must return `byok_generation_disabled` or `byok_key_invalid`, **never** silently fall back to the site operator's `MINIMAX_API_KEY`.
- **No read from `~/.mmx/config.json`.** The H3 path does not read operator-side config.
- **No `MINIMAX_API_KEY` operator-key fallback.** This includes both the process env of the server and any file-based operator config.
- **Per-request user key only.** The MiniMax client is constructed per-request, holding the user key for the duration of that single request.

If any of the above boundaries is at risk of being violated (e.g. an unexpected code path was found that could fall through to the site operator key), the operator must trigger the circuit breaker (Section 7) and H3 is suspended until the boundary is verified.


---

## 11. Monitoring Checklist

During the H3 live window, the operator must monitor:

- Request count (per minute, per hour).
- Turnstile success / failure ratio.
- Provider success / failure ratio.
- Live generation count (per tester, total).
- Generated audio count (must equal live generation count; any divergence is a red flag).
- Storage growth (per minute, per hour).
- 4xx / 5xx rate.
- Provider latency (p50, p95, p99).
- Repeated key hash pattern (e.g. the same `keyHash8` appearing across requests from different IPs is suspicious).
- Suspicious IP pattern (e.g. burst from a single IP across many testers).
- Redaction audit (grep journal for banned patterns every N minutes; the same 8-pattern audit used in H2C).
- Access protection for `/ops` and `/api/status` (must remain 302 to Cloudflare Access login or `WWW-Authenticate: Cloudflare-Access`).
- Authorization header leak (must be 0 across all H3 lines).


---

## 12. Tester Instructions (Chinese, for distribution after operator approval)

> 这是小范围受控 live pilot。
> 会真实调用 MiniMax。
> 会使用测试者**自己的** MiniMax API Key。
> 费用由测试者**自己的** MiniMax 账户承担。
> 本站不保存 API Key。
> 不要输入敏感内容（私人 prompt、私人歌词）。
> 每人最多生成 1–2 次。
> 如果出现异常，pilot 会立即停止。

### 操作流程 (H3B 才会启用)

1. 收到 operator 分发的 pilot 入口链接。
2. 完整阅读面板说明。
3. 在「API Key」框内填入**你自己**的 MiniMax API Key。
4. 完成 Turnstile 人机验证。
5. 勾选 dry-run / cost 知情 checkbox。
6. 提交。提交后 server 会调用 MiniMax, 由 MiniMax 直接在你的账户上扣费。
7. 等待结果。结果会显示在结果卡里, 但**不**下载到本地存储（只给你一个临时播放链接）。
8. 如果遇到任何异常, 立即停止并通知 operator, 不再尝试。

### 注意事项

- 不要在 prompt / lyrics 里填入个人信息、医疗信息、金融信息、密码、token、private key、信用卡号、API secret。
- 不要把你自己的 API Key 发给任何人, 包括 operator。
- pilot 结束后, 立即在 MiniMax 控制台 revoke 你的 API Key 并换一个新的。
- pilot 期间, operator 不会读你的 key, 不会读你的 prompt, 不会读你的 lyrics。


---

## 13. Incident Response

Each class of incident has a predefined response:

| Incident class | Detection | Response |
|---|---|---|
| Generation count anomaly (above cap) | Monitoring | Stop pilot, circuit breaker, preserve redacted evidence, notify testers, document incident. |
| Provider error spike | Monitoring | Stop pilot, circuit breaker, preserve redacted evidence, document incident. |
| Token / key leak | Redaction audit | Stop pilot, circuit breaker, preserve evidence, **immediately** rotate any leaked key (tester-side), document incident. |
| Storage growth abnormal | Monitoring | Stop pilot, circuit breaker, investigate, document incident. |
| Access protection lost (`/ops` returns 200) | Probe | Stop pilot, circuit breaker, restore Access policy, document incident. |
| Unexpected live call outside window | Journal audit | Stop pilot, circuit breaker, investigate the trigger, document incident. |
| Unexpected audio generation | Storage audit | Stop pilot, circuit breaker, audit storage, document incident. |
| Tester confusion about cost | Operator intake | Stop that tester's run, clarify cost model, document incident. |
| Any P0 / P1 | Operator / monitoring | Stop pilot, circuit breaker, root-cause, document incident. |

Common response phases (apply to all):

1. **Stop pilot** — trigger circuit breaker (Section 7).
2. **Rollback** — confirm safe default env is restored.
3. **Preserve redacted evidence** — keep the journal lines and the redacted audit artifacts; do **not** delete them.
4. **Notify testers** — message the cohort with a short, factual note.
5. **Document incident** — add an entry to `docs/launch/BYOK_H3_INCIDENT_LOG.md` (created on first incident).
6. **No further live until reviewed** — the next H3 window requires a new explicit operator approval **and** a documented review of the previous incident.


---

## 14. Go / No-Go Checklist

Before H3 live execution can begin, **every** item below must be YES, dated, and signed by the operator.

- [ ] H2C evidence PASS (4/4 testers, 0 failure, leak audit CLEAN, rolled back).
- [ ] H2D UX/copy PASS (smoke test 48/48).
- [ ] Cost ceiling defined (Section 6) and accepted by the operator.
- [ ] Circuit breaker tested in dry-run (Section 7) and accepted.
- [ ] Rollback drill completed (Section 8) and accepted.
- [ ] Real key isolation verified (Section 9) — no localStorage / sessionStorage / IndexedDB / URL / server-storage / log / metadata writes of raw key.
- [ ] Provider warning visible in the panel (Section 12).
- [ ] Turnstile required (default already true; verified again in the live config).
- [ ] Access protection verified (302 / `WWW-Authenticate: Cloudflare-Access` for `/ops` and `/api/status`).
- [ ] Monitoring active and reachable by the operator.
- [ ] **Explicit operator approval received** — phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` sent in the operator's review channel.
- [ ] Tester cohort confirmed (3–5 testers, each aware of cost, each with their own key).
- [ ] No unresolved P0 / P1 issue from previous phases.

If **any** item is NO, H3 is **not** authorised. The next attempt requires resolving the NO item and obtaining a new explicit approval.


---

## 15. H3 Execution Placeholder

> **H3B execution instructions will be written only after operator approval.**
> **This document does not enable live generation.**
> **H3B will be a separate document, gated by `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`.**

The H3B document, if and when it is written, will include:

- The exact `tee` content for the live env file.
- The exact restart / verify commands.
- The exact journal-grep commands the operator uses during the window.
- The exact 8-pattern leak audit (re-run of the H2C audit, applied to the H3 window).
- The exact rollback commands (a copy of Section 7 with the literal `tee` body filled in).

H3B is **not** included in this plan and **must not** be inferred from this plan. The operator must approve it explicitly when it is presented.

---

## Appendix A: Change log

- 2026-06-12: Initial H3A plan (planning only) created. Status: `BYOK_H3A_CONTROLLED_LIVE_PILOT_PLANNING_SMOKE_PASS` (when the matching smoke test passes). No live execution. Production remains in the H1 closeout safe default.


---

## 16. Companion: H3B Pre-Flight Runbook

The companion runbook for H3B live execution is now available at:

> [`docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`](BYOK_H3B_PREFLIGHT_RUNBOOK.md) (15 sections + appendix, 26/26 smoke PASS, `BYOK_H3B_PREFLIGHT_RUNBOOK_SMOKE_PASS`).

The runbook:

- Defines the pre-flight checks, switches, monitoring, circuit breaker, and rollback drill that must be performed **before** H3B execution is considered.
- Records the current safe default (no env change made by the runbook itself).
- Carries the same approval phrase (`CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`) and final no-live statement.
- Does **not** itself authorise a live pilot. The H3B execution instruction document (`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`) does not exist yet; it will be written only after explicit operator approval.

The H3A plan + H3B runbook together form the planning-and-pre-flight layer. They are necessary but not sufficient for H3B live execution. The execution layer requires its own approval, its own Go/No-Go verification, and its own drill evidence.

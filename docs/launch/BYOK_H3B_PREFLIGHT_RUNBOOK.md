# BYOK-H3B Pre-Flight Runbook

> **Status: PRE-FLIGHT RUNBOOK ONLY**
> This document is a runbook, not a live execution authorization.
> It does NOT enable BYOK live generation.
> It does NOT open BYOK to a broad public audience.
> It does NOT modify production environment.
> H3B live execution still requires explicit operator approval.

**Audience**: operator + future H3B live executors.
**Report date**: 2026-06-12.
**Companion doc**: [`BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md`](BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md) (H3A planning).
**Final口径**: BYOK-H3B-PREFLIGHT prepares the controlled live pilot runbook. It does not execute BYOK live generation or broad public launch.

---

## 1. Purpose

This document (BYOK-H3B-PREFLIGHT) is a runbook, not a live execution authorization. It defines the pre-flight checks, switches, monitoring, circuit breaker, and rollback steps that must be satisfied before H3B live execution is even considered. It does NOT enable BYOK live generation. It does NOT call MiniMax. It does NOT generate music. H3B live execution still requires explicit operator approval.

---

## 2. Required Approval

H3B live execution requires a **separate, explicit operator approval phrase** in the review channel. The phrase is:

> `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`

Rules:

- Without this phrase, no one may set `BYOK_DIRECT_LIVE_ENABLED=true` or `BYOK_DRY_RUN_ONLY=false`.
- The phrase must be sent in the review channel by an operator who has read this runbook and the H3A plan.
- The approval is per-window: a new approval is required for each new live window.
- This pre-flight runbook itself does NOT constitute approval. It is necessary, not sufficient.
- Approval is automatically revoked if any prerequisite in Section 3 fails at execution time.

---

## 3. Pre-Flight Prerequisites

The following must all be true before H3B live execution may begin:

- [x] H1 valid-token real Turnstile E2E passed.
- [x] H2C dry-run pilot passed (4/4 testers PASS, 4 success-path logs, 0 failure-path logs).
- [x] H2D UX/copy polish completed and CI success.
- [x] H3A controlled live pilot planning completed (this runbook companion).
- [x] H2C evidence report exists at `docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md`.
- [x] Production currently at safe default: `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`.
- [x] Cloudflare Access protects `/ops` and `/api/status`.
- [x] Turnstile widget required and configured (site key + secret key).
- [x] No open P0/P1 issues in the active issue tracker.
- [x] Rollback drill completed in the prior 7 days.
- [x] Operator availability confirmed for the entire live window.

---

## 4. Environment Baseline

The pre-flight phase records the current production safe default. None of these values are changed by this runbook.

| Env | Required | Current value (pre-flight) |
|---|---|---|
| `PUBLIC_BYOK_ENABLED` | `false` | `false` (confirmed) |
| `BYOK_DRY_RUN_ONLY` | `true` | `true` (confirmed) |
| `BYOK_DIRECT_LIVE_ENABLED` | `false` | `false` (confirmed) |
| `TURNSTILE_BYOK_REQUIRED` | `true` | `true` (confirmed) |
| `TURNSTILE_SITE_KEY` | configured | configured |
| `TURNSTILE_SECRET_KEY` | configured | configured |
| `MINIMAX_API_KEY` (operator) | NOT used in H3B | n/a (per-request user key only) |

Notes:

- Pre-flight does NOT change any of these values.
- Live execution will use a separate H3B-execution instruction document, written only after explicit operator approval.
- The baseline snapshot is taken with the same procedure used for H2C (see evidence report).

---

## 5. Go / No-Go Checklist

All of the following must be YES before H3B live execution may begin. A single NO forces a No-Go and stops the live window.

| # | Check | Required |
|---|---|---|
| 1 | Explicit operator approval phrase present in review channel | YES |
| 2 | Tester cohort confirmed (3-5 trusted testers, all informed) | YES |
| 3 | Cost ceiling accepted by testers and operator | YES |
| 4 | Circuit breaker commands tested in pre-flight drill | YES |
| 5 | Rollback drill completed in the prior 7 days | YES |
| 6 | Real key isolation confirmed (no persistence) | YES |
| 7 | Provider "not stored, no operator key" warning visible in UI | YES |
| 8 | Turnstile widget verified working in production | YES |
| 9 | Monitoring active and operator has read access | YES |
| 10 | Log redaction checked (no raw token / key / Authorization) | YES |
| 11 | Access protection for `/ops` and `/api/status` verified | YES |
| 12 | Storage baseline recorded (jobs, tracks, log size) | YES |
| 13 | No unresolved P0/P1 issues | YES |
| 14 | Operator online and available for the entire live window | YES |

If any row is NO, the operator must STOP and roll back to safe default immediately. No partial execution.

---

## 6. Cost Ceiling

Conservative defaults. Operator may lower these further at execution time, but may NOT raise them without re-approval.

| Limit | Value |
|---|---|
| Total pilot max live generations | **10** |
| Per tester max live generations | **2** |
| Hourly request cap | **6** |
| Provider error retry | **0** (stop on first provider error) |
| Stop conditions | cost not observable, audio count exceeds plan, any leak indication |

If cost cannot be observed in real time (no redacted provider call counter, no redacted cost counter), the pilot MUST NOT begin. The H3A cost ceiling applies.

---

## 7. Circuit Breaker Commands

> **WARNING**: The commands below are for the approved H3B execution window only. They are listed here so the operator knows the kill-switch in advance. They MUST NOT be executed during the pre-flight phase.

### 7.1. One-shot kill switch (operator-initiated stop)

The operator runs the following sequence to immediately halt H3B live execution and return to safe default:

1. Set the safe-default env in `/etc/systemd/system/mmx-music-studio.service.d/`:

   ```
   PUBLIC_BYOK_ENABLED=false
   BYOK_DRY_RUN_ONLY=true
   BYOK_DIRECT_LIVE_ENABLED=false
   ```

2. Reload systemd and restart the service:

   ```
   sudo systemctl daemon-reload
   sudo systemctl restart mmx-music-studio
   ```

3. Verify the kill switch worked (do not skip this step):

   ```
   curl -fsS https://music.conanxin.com/api/health
   curl -fsS -X POST https://music.conanxin.com/api/generate/byok      -H "Content-Type: application/json"      -d '{"dummy":"kill-switch-verify"}'
   ```

   Both calls must succeed. The second must NOT generate audio. The endpoint should return `byok_generation_disabled`.

### 7.2. Who can trigger

Only the operator who holds the current live-window approval may trigger the circuit breaker. The trigger must be logged with a redacted reason (no user key, no token, no Authorization).

### 7.3. Trigger conditions

Any one of the following triggers the circuit breaker:

- Provider error rate exceeds 1 in 3 requests.
- Audio count exceeds planned number.
- Any leak indication (raw key in log, token in URL, Authorization in trace).
- Cloudflare Access protection lost.
- Tester reports unexpected cost.
- Operator observes any anomalous behavior.

---

## 8. Rollback Drill

A **dry-run** rollback drill is required before H3B live execution. The drill must be performed in the prior 7 days.

### 8.1. Drill scope (no real generation)

The drill exercises the kill-switch path WITHOUT any real MiniMax call:

- Set safe-default env temporarily.
- Reload + restart service.
- Verify `/api/health` returns 200.
- Verify `/api/generate/byok` returns `byok_generation_disabled`.
- Verify `/ops` and `/api/status` are still Cloudflare-Access-protected.
- Run a banned-pattern scan on the active journal slice (no token / key / Authorization leak).
- Restore the original env and restart.

### 8.2. Drill evidence

The drill must produce a redacted drill log saved under:

```
docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_<DATE>.md
```

The drill log must record the timestamp, the env diff (without values), the restart result, the endpoint verification, and a banned-pattern scan result.

### 8.3. Drill pass criteria

- `/api/health` returns 200 with `publicByokEnabled=false`.
- `/api/generate/byok` returns `byok_generation_disabled` (or `byok_dry_run_only`).
- Access protection verified for `/ops` and `/api/status`.
- Banned-pattern scan: 0 matches.
- Drill completes within 5 minutes.

If any of the above fails, the drill is a FAIL and H3B live execution is not authorised until the failure is root-caused and fixed.

---

## 9. Live Window Operating Rules

During the H3B live execution window:

- **Short window only.** The window must be defined in advance (e.g. 30 minutes).
- **Operator online throughout.** The operator must remain in the review channel and able to trigger the circuit breaker.
- **One tester at a time.** No concurrent testers.
- **One request at a time.** No parallel live calls.
- **No batch generations.** Each generation is a separate, observable event.
- **Stop on first provider error.** No retries.
- **Stop on unexpected audio count.** If audio count > planned, halt.
- **Stop on any leak indication.** Any raw key / token / Authorization in log = immediate halt.
- **No auto-promotion.** Even if all goes well, H3B does NOT auto-promote to broader audiences. Promotion is a separate decision.

---

## 10. Tester Instructions (Chinese, for distribution only after operator approval)

> 这是受控 live pilot。
> 会真实调用 MiniMax。
> 使用您自己的 MiniMax API Key。
> 费用由您自己的 MiniMax 账户承担。
> 本站不保存您的 API Key。
> 请不要输入敏感内容。
> 每人最多 1-2 次生成。
> 如果出现任何异常，pilot 会立即停止。
> 您必须独立确认理解以上 8 条，并在审查频道中用回复 `CONFIRM_TESTER_<handle>` 表示同意。
> 收到 tester 确认后，operator 才会进入下一轮执行。

(The English version, for the operator's own reference, lives in the H3A plan Section 12. The Chinese version above is what gets sent to testers.)

---

## 11. Monitoring Commands

The operator uses the following **redacted** monitoring commands during the live window. None of them output raw keys, raw tokens, raw Authorization, or raw provider responses.

### 11.1. Allowed monitoring commands (redacted)

- `journalctl -u mmx-music-studio --since "<window-start>" --no-pager | grep -c "\[byok-turnstile-ok\]"` — request count.
- `journalctl -u mmx-music-studio --since "<window-start>" --no-pager | grep "\[byok-turnstile-debug\]"` — redacted Siteverify diagnostics.
- `journalctl -u mmx-music-studio --since "<window-start>" --no-pager | grep -c "byok_dry_run_only\|byok_generation_disabled\|byok_live_pilot_blocked"` — result-code counts.
- `journalctl -u mmx-music-studio --since "<window-start>" --no-pager | grep -c "minimax_provider_error\|provider_4xx\|provider_5xx"` — provider error count.
- `ls -la /var/lib/mmx-music-studio/audio/ 2>/dev/null | wc -l` — generated audio count.
- `du -sh /var/lib/mmx-music-studio/ 2>/dev/null` — storage growth.
- `curl -fsS https://music.conanxin.com/api/health` — endpoint health.
- `python3 scripts/ci-secret-scan.py` — banned-pattern scan (no real key / token / Authorization).

### 11.2. Forbidden monitoring outputs

The following are NEVER allowed in any monitoring output, log, alert, or report:

- Raw user API key.
- Raw Turnstile token.
- Authorization header.
- Provider raw response body containing user-supplied content.
- Full Turnstile secret.
- Server env values.
- Anything tagged with `[REDACT-FAIL]`.

If any of the above appears, the circuit breaker is triggered immediately.

---

## 12. Provider Call Boundary

The H3B live path is strictly bounded. The boundary is enforced in code and verified during the live window:

- **Direct HTTPS adapter only.** No CLI path. No `mmx` shell-out. No `node_modules/.bin` indirection.
- **No `~/.mmx/config.json`.** The live path must NOT read the operator's local CLI config.
- **No site operator key fallback.** If the per-request user key is missing, the request must fail with `byok_user_key_required`. It must NOT fall back to an operator key.
- **No `MINIMAX_API_KEY` env fallback.** If the env operator key is set, the live path must NOT use it.
- **Per-request user key only.** The user key is used for exactly one HTTPS request and discarded. It is NOT cached, NOT memoized, NOT stored.
- **Block immediately if fallback risk appears.** Any code path that might use a non-user key triggers an immediate block and redacted log entry.
- **Direct HTTPS to MiniMax API endpoint only.** No proxy, no relay, no intermediate cache.

The H3A plan Section 10 expands on this boundary. This runbook does NOT relax or override it.

---

## 13. Incident Response

Each incident class has a predefined response. The operator must NOT improvise. If the class is not on this list, default to: stop, rollback, preserve redacted evidence, notify testers, document incident, and DO NOT continue live until reviewed.

| Incident | Response |
|---|---|
| Token / key leak (anywhere: log, URL, header, body) | **Immediate circuit breaker.** Roll back to safe default. Preserve redacted evidence. Notify all testers. NO further live until reviewed. |
| Provider error spike (>1 in 3) | Stop. Roll back. Preserve redacted evidence. Investigate provider. |
| Unexpected live call (outside window, or by non-tester) | Stop. Roll back. Preserve redacted evidence. Treat as a security incident. |
| Unexpected audio generation (count > planned) | Stop. Roll back. Preserve redacted evidence. Confirm cost ceiling was not exceeded. |
| Cost anomaly (cost not observable, or unaccounted spend) | Stop. Roll back. Preserve redacted evidence. Verify tester accounts. |
| Storage growth anomaly (audio / log / job table growth unexpected) | Stop. Roll back. Preserve redacted evidence. Investigate write paths. |
| Access protection loss (Access policy removed, /ops open) | Stop. Roll back. Restore Access policy. NO further live until verified. |
| Tester confusion about cost (tester reports unexpected spend) | Stop. Roll back. Provide tester with their account's redacted usage evidence. |

Common response pattern for all incidents:

1. **Stop the pilot** (circuit breaker).
2. **Roll back to safe default** (env + restart).
3. **Preserve redacted evidence** (drill log + journal slice with secrets redacted).
4. **Notify testers** in the review channel.
5. **Document the incident** in a new `docs/launch/H3B_INCIDENT_<DATE>.md` file.
6. **NO further live** until operator has reviewed and re-approval is given.

---

## 14. H3B Execution Handoff Placeholder

> The actual H3B execution commands are **not** included in this runbook.
> They will be written only after explicit operator approval (`CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`).
> This runbook cannot be used alone to execute a live pilot.
> When the H3B execution instruction document is written, it will reference this runbook and the H3A plan, and will require its own approval.

A future H3B execution instruction document will live at:

```
docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md
```

It is currently NOT created. Its absence is the default state.

---

## 15. Final No-Live Statement

**This pre-flight runbook does not enable BYOK live generation or broad public launch.**

This is a planning and pre-flight document. It defines the gates, the kill switch, the rollback drill, the monitoring commands, the incident response, and the tester instructions. It does NOT contain live execution commands, does NOT call MiniMax, does NOT generate music, and does NOT relax any existing safety boundary.

The current production safe default remains:

- `PUBLIC_BYOK_ENABLED=false`
- `BYOK_DRY_RUN_ONLY=true`
- `BYOK_DIRECT_LIVE_ENABLED=false`
- `TURNSTILE_BYOK_REQUIRED=true`

H3B live execution is authorised only when ALL of the following are true:

1. The operator has sent `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` in the review channel.
2. The Go / No-Go checklist (Section 5) is all YES.
3. The H3B execution instruction document (`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`) has been written, reviewed, and approved.
4. The dry-run rollback drill (Section 8) has been performed in the prior 7 days.

Until all four are true, H3B live execution must NOT begin.

---

## Appendix A: Document Cross-References

- **H3A planning**: `docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md` (companion).
- **H2C evidence**: `docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md` (readiness proof).
- **H2A plan**: `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` (parent planning doc).
- **Public release readiness**: `docs/PUBLIC_RELEASE_READINESS.md` (operator-facing summary).
- **Handoff**: `docs/DEVELOPMENT_HANDOFF.md` (phase log).
- **Smoke test**: `scripts/byok-h3b-preflight-runbook-smoke-test.sh` (this runbook's structural assertions).

---

**Final口径**: BYOK-H3B-PREFLIGHT prepares the controlled live pilot runbook. It does not execute BYOK live generation or broad public launch.

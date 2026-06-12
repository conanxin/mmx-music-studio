# H3B Controlled Live Pilot — Execution Instructions

> This document is the **execution instructions** for a future H3B controlled live pilot.
> **It does not itself execute BYOK live generation.** It only records the pre-flight, live-enabling plan, tester sequence, monitoring, circuit breaker, rollback, and stop conditions.
> Live execution requires a separate operator action after reviewing this document and re-confirming the locked window is still valid.

## 0. Final口径

> BYOK-H3B-EXEC-INSTRUCTIONS writes the controlled live pilot execution instructions. It does not itself execute BYOK live generation or broad public launch.

## 1. Required gating artifacts

This phase is conditioned on the following predecessor artifacts all being present and in their expected state:

| Artifact | Path | Required state |
| --- | --- | --- |
| H3B pre-flight runbook | `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md` | 18 sections present, smoke 26/26 PASS |
| H3B rollback drill evidence | `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md` | 10 sections, drill PASS within 7 days |
| H3B Go/No-Go review | `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md` | 22-gate checklist recorded |
| H3B cohort plan | `docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md` | T1–T5 anonymous slots, no PII |
| H3B window-lock | `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md` | approval RECEIVED, T1–T5 confirmed, window 2026-06-13T04:45:04+08:00 → 2026-06-13T05:15:04+08:00 (Asia/Shanghai) |
| Approval phrase | `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` | RECEIVED |

## 2. Final pre-flight checks (operator must run before any live action)

These checks must all pass **immediately before** the live-enabling plan below is executed. If any one fails, stop and re-evaluate.

1. **Window still valid**: Current time (Asia/Shanghai) is within `[2026-06-13T04:45:04+08:00, 2026-06-13T05:15:04+08:00]`. If now > end, the window is **EXPIRED**; do not proceed, re-run H3B-WINDOW-LOCK with a new operator-attended window.
2. **Production safe default before enabling**: `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`. Redacted env read only.
3. **Turnstile configured**: `TURNSTILE_SITE_KEY_CONFIGURED=true` and `TURNSTILE_SECRET_KEY_CONFIGURED=true` (boolean read; never the value).
4. **Access protection checked**: `/ops` and `/api/status` 302 → `cloudflareaccess.com` with `www-authenticate: Cloudflare-Access`.
5. **Rollback drill evidence exists**: `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md` recorded within the prior 7 days, drill PASS.
6. **Window-lock evidence exists**: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md` confirms T1–T5 confirmed and approval phrase RECEIVED.
7. **T1–T5 confirmed**: All five anonymous tester slots are CONFIRMED with consent, cost acknowledged, own MiniMax key, and PII policy acknowledged.
8. **Operator online**: The operator is online and reachable in the review channel for the full 30-minute window.
9. **Drill-evidence boundary compliance**: no live call has been made, no MiniMax call, no music generated, no PII, no secret/token/Authorization header committed.
10. **Pre-stage banned-pattern audit**: 0 matches for the standard banned-pattern set (raw env-key assignments, real MiniMax user keys, Authorization bearer headers, runtime guard files, buildinfo, build outputs, audio artifacts). See the smoke test patterns in `scripts/byok-h3b-execution-instructions-smoke-test.sh` for the canonical banned-pattern regex set.

## 3. Live-enabling plan (DO NOT EXECUTE FROM THIS DOCUMENT ALONE)

The plan below records the **exact env changes** required to enable BYOK live generation for the 30-minute pilot window. **It must not be executed** from this document alone; the operator must perform each change as a separate, intentional action after re-confirming the pre-flight checks.

The idempotent live-enabling drop-in (in `/etc/systemd/system/mmx-music-studio.service.d/byok-test.conf`):

```ini
[Service]
Environment="PUBLIC_BYOK_ENABLED=true"
Environment="BYOK_DRY_RUN_ONLY=false"
Environment="BYOK_DIRECT_LIVE_ENABLED=true"
Environment="TURNSTILE_BYOK_REQUIRED=true"
```

Reload + restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart mmx-music-studio
```

After restart, verify state by re-running the Final pre-flight checks #2, #3, and #4.

## 4. One-tester-at-a-time sequence

For each tester, the operator runs the following loop in order. **Only one tester is in-flight at a time.** No parallel testers. No parallel live calls.

| Step | Tester | Action | Verification after action |
| --- | --- | --- | --- |
| 1 | T1 | Tester brings own MiniMax key, pastes into the per-session BYOK input field; submits 1 prompt; awaits response. | Provider success/failure logged; `code` is `ok` or specific error; generated audio count incremented by exactly 1 on success. |
| 2 | T2 | Same as T1. | Same verification. |
| 3 | T3 | Same as T1. | Same verification. |
| 4 | T4 (optional) | Same as T1. | Same verification. |
| 5 | T5 (optional) | Same as T1. | Same verification. |

Per-tester rules:

- own MiniMax key only (no shared key, no service key);
- key is **never** persisted to localStorage, sessionStorage, server, or any storage (the `mmx-studio:byok-session:v1` key must not be written);
- max 1–2 generations per tester;
- stop after first provider error;
- tester does not share key with anyone, including the operator.

## 5. Monitoring checklist (operator runs every ~5 min during the window)

- [ ] request count vs planned;
- [ ] live generation count (must be 0 before T1, +1 per T1, etc.);
- [ ] generated audio count (must equal live generation count);
- [ ] provider success/failure rate (any failure → stop);
- [ ] 4xx / 5xx HTTP rate (any 5xx → stop);
- [ ] storage growth (audio file count delta);
- [ ] leak scan on `/api/health` response (no `TURNSTILE_SECRET_KEY`, no `Authorization`, no `Bearer `, no `userApiKey`, no `apiKey`, no `token`);
- [ ] Access protection (302 to `cloudflareaccess.com` for `/ops` and `/api/status`);
- [ ] `mmx-studio:byok-session:v1` localStorage key (must remain absent).

## 6. Circuit breaker (kill switch)

If any of the trigger conditions below is met, the operator MUST immediately execute the circuit breaker sequence. This is the kill switch.

**Trigger conditions**:

1. Provider error (any non-2xx from MiniMax with `code != ok`).
2. Leak indication (any of the 6 leak patterns in `/api/health` response).
3. Generated audio count > planned count.

**Circuit breaker sequence** (idempotent safe-default rewrite):

```bash
sudo tee /etc/systemd/system/mmx-music-studio.service.d/byok-test.conf >/dev/null <<'EOF'
[Service]
Environment="PUBLIC_BYOK_ENABLED=false"
Environment="BYOK_DRY_RUN_ONLY=true"
Environment="BYOK_DIRECT_LIVE_ENABLED=false"
EOF
sudo systemctl daemon-reload
sudo systemctl restart mmx-music-studio
```

**Verify**:

```bash
curl -s http://127.0.0.1:8787/api/generate/byok   -H 'content-type: application/json'   -d '{"test":1}' | jq -e '.code == "byok_generation_disabled"'
```

## 7. Rollback after pilot (always restore safe default)

After the 30-minute window ends, or after all testers have completed, the operator MUST restore the production safe default. This is the same idempotent safe-default rewrite as the circuit breaker.

After restart, verify:

- `PUBLIC_BYOK_ENABLED=false`
- `BYOK_DRY_RUN_ONLY=true`
- `BYOK_DIRECT_LIVE_ENABLED=false`
- `TURNSTILE_BYOK_REQUIRED=true`
- `/api/generate/byok` returns `code: byok_generation_disabled`
- `/api/health` has no leak pattern
- `/ops` and `/api/status` are still Cloudflare-Access protected (302 → `cloudflareaccess.com`)

## 8. Stop conditions

Live execution MUST stop immediately if **any** of the following is true:

- window expired (now > `2026-06-13T05:15:04+08:00` or any re-locked end);
- provider error (any non-2xx from MiniMax with `code != ok`);
- unexpected audio count (generated audio ≠ expected count);
- leak indication (any of the 6 leak patterns in `/api/health` response);
- tester confusion (tester reports UI or auth confusion);
- Access protection loss (`/ops` or `/api/status` not 302 → `cloudflareaccess.com`);
- cost not observable (per-tester or total cap cannot be observed in real time).

After any stop condition, the circuit breaker MUST be executed, the safe default MUST be restored, and a fresh window-lock is required for any further live attempt.

## 9. Cross-references

- H3B pre-flight runbook: `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`
- H3B rollback drill evidence: `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`
- H3B Go/No-Go review: `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`
- H3B cohort plan: `docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md`
- H3B window-lock: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md`
- H3A controlled live pilot plan: `docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md`

## 10. Final no-execution statement

This document does not itself execute BYOK live generation. Live execution requires a separate operator action after reviewing this document and re-confirming the locked window is still valid.

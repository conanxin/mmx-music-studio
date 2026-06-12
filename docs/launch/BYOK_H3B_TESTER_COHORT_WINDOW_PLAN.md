# BYOK-H3B Tester Cohort + Pilot Window Plan — 20260613

> **Status: PLANNING ONLY**  
> This document is a ...[truncated]


---

## 1. Purpose

This document (BYOK-H3B-COHORT) plans the **tester cohort** and **pilot window** for a future H3B controlled live pilot. It does NOT execute the live pilot. It does NOT enable BYOK live generation. It does NOT call MiniMax. It does NOT generate music. It does NOT write H3B execution instructions.

**Current decision remains NO-GO** for H3B live execution, as recorded in:

- docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md


## 2. Current Production State

Production runtime env (verified at drill date 20260613):

| Field | Value |
| --- | --- |
| PUBLIC_BYOK_ENABLED | false |
| BYOK_DRY_RUN_ONLY | true |
| BYOK_DIRECT_LIVE_ENABLED | false |
| TURNSTILE_BYOK_REQUIRED | true |
| TURNSTILE_SITE_KEY_CONFIGURED | true |
| TURNSTILE_SECRET_KEY_CONFIGURED | true |

Production safe default remains unchanged. No live toggle has been flipped.

---

## 3. Tester Cohort Rules

The H3B pilot is a **3-5 trusted tester** cohort, one operator-attended window, with these hard rules:

1. **3-5 trusted testers, no more.** Tester slots are T1, T2, T3, T4, T5 (max 5). T6 and beyond are NOT authorised.
2. **Per-tester budget: ≤2 live generations.** Total cohort ceiling: ≤10 generations.
3. **Per-tester self-pay.** Each tester uses their own MiniMax API key; mmx-music-studio does NOT store, log, or transmit tester keys except for the one-shot BYOK request.
4. **Anonymous slot table only.** Real names, emails, phone numbers, Telegram handles, WeChat IDs, and any other PII MUST NOT be committed to this repository.
5. **No operator-provided key fallback.** No `MINIMAX_API_KEY` env fallback, no `~/.mmx/config.json` read, no site operator key fallback.
6. **Operator-attended.** Operator MUST be online and reachable during the entire pilot window.
7. **Per-window re-approval.** Each pilot window requires a fresh `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` phrase; the phrase does NOT carry over between windows.
8. **Tester consent mandatory.** Each tester must opt in via the tester-facing message draft (see §9) and confirm:
   - Brings own API key.
   - Pays for own usage.
   - Accepts cost ceiling (≤2 generations).
   - No key retention on server.
   - No PII collected or stored.
   - Can stop at any time via circuit breaker.

## 4. Anonymous Tester Slot Table (T1-T5)

| Slot | Status | Real name (NOT recorded) | API key source | Slot budget | Window slot | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **T1** | `pending_consent` | (PII, not recorded in repo) | tester-owned | ≤2 generations | not scheduled | awaiting operator appointment |
| **T2** | `pending_consent` | (PII, not recorded in repo) | tester-owned | ≤2 generations | not scheduled | awaiting operator appointment |
| **T3** | `pending_consent` | (PII, not recorded in repo) | tester-owned | ≤2 generations | not scheduled | awaiting operator appointment |
| **T4** | `pending_consent` | (PII, not recorded in repo) | tester-owned | ≤2 generations | not scheduled | optional — cohort may be 3-5 |
| **T5** | `pending_consent` | (PII, not recorded in repo) | tester-owned | ≤2 generations | not scheduled | optional — cohort may be 3-5 |

**Total cohort ceiling**: 5 slots, of which 3 are required (T1/T2/T3) and 2 are optional (T4/T5). All 5 currently `pending_consent`.

> **Note**: tokens like `MINIMAX_API_KEY`, `~/.mmx/config.json`, `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`, and slot status `pending_consent` are preserved as literal text in this doc.

## 4.1 No PII in Repo

The following are **explicitly prohibited** from this repository:
- Real names of testers
- Email addresses
- Phone numbers
- Telegram handles (e.g. @xxxxx)
- WeChat IDs
- WeCom IDs
- Slack handles
- Discord IDs
- GitHub usernames
- Any other identifying information

Anonymous slot IDs (T1-T5) are the **only** identifier allowed in this repo.
---

## 5. Pilot Window (NOT SCHEDULED)

- **Status**: `not scheduled`
- **Window start**: not defined
- **Window end**: not defined
- **Timezone**: not defined
- **Operator availability**: not confirmed
- **Tester overlap**: not defined
- **Backup window**: not defined

A future, separately authored H3B execution instruction document will record the actual window AFTER the approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` is received.
---

## 6. Tester Consent Checklist

For each tester slot (T1-T5) the following MUST be confirmed BEFORE the pilot window opens:

- [ ] Tester brings their own MiniMax API key.
- [ ] Tester pays for their own usage.
- [ ] Tester accepts cost ceiling (≤2 generations per tester, ≤10 total).
- [ ] Tester accepts that the server does NOT retain the key after the request.
- [ ] Tester accepts that no PII is collected, stored, or transmitted by mmx-music-studio.
- [ ] Tester accepts that the circuit breaker can stop the pilot at any time.
- [ ] Tester consents to be online in the operator-approved review channel during the window.
- [ ] Tester acknowledges that this is a controlled live pilot, not a public launch.
- [ ] Tester agrees to a redacted summary of results (no key, no PII, no audio body).
- [ ] Tester acknowledges that real name / email / phone / social IDs are NOT recorded in this repo.

A tester may withdraw consent at any time before the window opens; that slot returns to `pending_consent`.
---

## 7. Cost and Safety Controls (carried from H3B-PREFLIGHT)

| Control | Limit |
| --- | --- |
| Total live generations across all testers | ≤10 |
| Per-tester live generations | ≤2 |
| Hourly request cap | ≤6 |
| Provider error retry | 0 (stop on first error) |
| Stop conditions | cost not observable, audio count > planned, any leak indication, any provider error |

These limits are NOT changed by this plan. They are inherited from the H3B pre-flight runbook (`docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md` §6).
---

## 8. Approval Phrase Status

**Required approval phrase**:

| ```
| CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT
| ``` |

- **Status**: `NOT RECEIVED`
- This plan does NOT count as approval.
- Without this phrase, H3B execution instructions MUST NOT be written.
- Without this phrase, no production live toggle may be changed.
- Per-window re-approval required; the phrase does NOT carry over between windows.

The phrase is required as a separate, independent message in the operator-approved review channel.
---

## 9. Tester-Facing Message Draft (Chinese)

> 感谢愿意参与 mmx-music-studio 的受控 live pilot。本次 pilot 不是公开上线，仅在 operator 旁观的短时间窗内、由 3-5 位受信任的 tester 各自携带自己的 MiniMax key 真实调用一次，最多 2 次。
>
> 在开始前请确认以下事项（如果有任何一项不同意，请回复"暂不参与"即可）：
>
> 1. 你自备 MiniMax API key，并自行承担调用费用。mmx-music-studio 不会存储、记录或传输你的 key；key 仅在单次 BYOK 请求中使用一次后丢弃。
> 2. 你的真实姓名、邮箱、手机号、Telegram、微信等任何 PII 都不会被记录到代码仓库。本仓库仅使用匿名 slot ID（T1-T2-T3-T4-T5）标识测试者。
> 3. 你接受 cost ceiling：单 tester ≤2 次，总 cohort ≤10 次。
> 4. 你接受 operator 可以在任意时刻通过 circuit breaker 立即停止 pilot，无需事先通知。
> 5. 你接受 pilot 窗口是短时窗、operator 全程在线、所有结果以 redacted summary 形式记录（无 key / 无 PII / 无 audio body）。
> 6. 你同意这是受控 live pilot，不是公开上线，也不会向 public 用户开放 BYOK 生成。
>
> 上述 6 项均确认后，请回复"同意参与 Tn"（Tn 是你的 slot ID）。operator 会在 review channel 单独发送审批短语后才会真正开启窗口。
---

## 10. Decision

**Decision: NO-GO for H3B live execution.**

Reasoning:
1. **Tester cohort not finalized.** All 5 slots are `pending_consent`. No tester has confirmed consent via the §9 message draft.
2. **Pilot window not scheduled.** No window start, end, timezone, or operator availability is defined.
3. **Approval phrase not received.** `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` has NOT been sent.
4. **Production env remains safe default.** `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`.
5. **No broad public launch.** No live toggle, no MiniMax call, no music.

**Result**: H3B execution MUST NOT proceed in the current state. The next operator step is:
1. Collect tester consent for T1/T2/T3 (and optionally T4/T5) via the §9 message draft.
2. Schedule a pilot window and confirm operator availability.
3. Send the approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`.
4. Only then authorise a separate H3B execution instruction document.

This plan does NOT authorise H3B execution. It only records the planning inputs.
---

## 11. Allowed Next Steps

**Allowed**:
- Collect tester consent for each slot via the §9 message draft.
- Schedule a pilot window (operator defines start/end, timezone, overlap rules).
- Confirm operator availability for the full window.
- Send the approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`.
- Then (and only then) authorise a separate H3B execution instruction document.

**Forbidden**:
- Opening live directly from this plan.
- Changing any production env (`PUBLIC_BYOK_ENABLED`, `BYOK_DRY_RUN_ONLY`, `BYOK_DIRECT_LIVE_ENABLED`, `TURNSTILE_DEBUG_REDACTED`).
- Calling MiniMax from server-side context.
- Generating music.
- Committing real tester PII (names, emails, phones, social IDs).
- Using `MINIMAX_API_KEY` env fallback or `~/.mmx/config.json` read.
- Recording or transmitting the tester-owned key beyond the one-shot BYOK request.
- Broad public launch.
---

## 12. Final No-Live Statement

This document (BYOK-H3B-COHORT) is **planning only**. It does NOT enable BYOK live generation. It does NOT call MiniMax. It does NOT generate music. It does NOT write H3B execution instructions. It does NOT change any production env. It does NOT grant any approval.

H3B live execution remains **NOT authorised** until:
1. Tester cohort is finalised (T1-T5 with explicit `pending_consent` → `consented` for at least 3 testers).
2. Pilot window is scheduled (start, end, timezone, operator availability all defined).
3. Approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` is received as a separate message in the operator-approved review channel.
4. A separate H3B execution instruction document is authored and approved.
5. The Go/No-Go decision is re-evaluated and explicitly changes to GO.

Until all 5 conditions are met, this plan records **NO-GO for H3B live execution**.

---

## Appendix A: Cross-References

This plan is companion to:
- `docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md` — H3A planning
- `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md` — H3B pre-flight runbook
- `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md` — H3B rollback drill evidence
- `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md` — H3B Go/No-Go review (NO-GO)
- `docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md` — H2C dry-run evidence
- `docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md` — H2 planning

## Appendix B: Glossary

| Term | Meaning |
| --- | --- |
| Slot | An anonymous tester ID T1-T5 |
| Cohort | The 3-5 trusted testers assigned to slots T1-T5 |
| Window | The operator-attended time window when live is enabled |
| Approval phrase | `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` |
| Circuit breaker | The one-shot kill switch that flips all live flags back to safe default |
| Redacted summary | Summary containing only counts / durations / status flags, no key / PII / audio body |
| PII | Personally identifiable information (name / email / phone / social ID) |

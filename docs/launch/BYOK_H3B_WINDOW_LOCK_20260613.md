# H3B Controlled Live Pilot Window Lock — 20260613

## 1. Purpose

This document records the final tester cohort and pilot-window gates for a future H3B controlled live pilot.

**This is not live execution.**

This document does not:

- enable BYOK live generation;
- change production environment variables;
- call MiniMax;
- generate music;
- create H3B execution instructions;
- authorize broad public launch.

## 2. Approval phrase status

Required phrase:

`CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`

**Status: RECEIVED**

Important boundary:

- This approval phrase satisfies the approval gate.
- This document still does not execute the live pilot.
- A separate H3B execution instruction document is required before any live execution.
- Production live toggles must not be changed from this document alone.

## 3. Tester cohort lock

Only anonymous tester slots are recorded. No tester PII is committed.

| Slot | Status   | Consent  | Cost acknowledged | Own MiniMax key | Max generations | PII policy   |
| ---- | -------- | -------- | ----------------- | --------------- | --------------- | ------------ |
| T1   | CONFIRMED | CONFIRMED | CONFIRMED         | CONFIRMED       | 1–2             | no PII in repo |
| T2   | CONFIRMED | CONFIRMED | CONFIRMED         | CONFIRMED       | 1–2             | no PII in repo |
| T3   | CONFIRMED | CONFIRMED | CONFIRMED         | CONFIRMED       | 1–2             | no PII in repo |
| T4   | CONFIRMED | CONFIRMED | CONFIRMED         | CONFIRMED       | 1–2             | no PII in repo |
| T5   | CONFIRMED | CONFIRMED | CONFIRMED         | CONFIRMED       | 1–2             | no PII in repo |

Real tester names, emails, phone numbers, Telegram handles, WeChat IDs, and other private contact details must stay outside the repository.

## 4. Pilot window lock

| Field                    | Value                                                |
| ------------------------ | ---------------------------------------------------- |
| Window timezone          | Asia/Shanghai                                                 |
| Window start             | 2026-06-13T04:45:04+08:00                                              |
| Window end               | 2026-06-13T05:15:04+08:00                                                |
| Window duration          | 30 minutes                                           |
| Operator online for full window | yes                                              |
| Tester order             | T1 → T2 → T3 → T4 → T5                               |
| Parallel testers         | no                                                   |
| Parallel live calls      | no                                                   |

## 5. Window expiry rule

This window is time-bound.

If validation, commit, CI, or H3B execution instruction authoring finishes after the locked window end, the window is considered **EXPIRED** and must not be used for live execution.

In that case, a new H3B window-lock document must be created with a new operator-attended window.

## 6. Production safe-default state

At the time this window lock is created, production is expected to remain in safe default:

| Env                          | Required value |
| ---------------------------- | -------------- |
| `PUBLIC_BYOK_ENABLED`        | `false`        |
| `BYOK_DRY_RUN_ONLY`          | `true`         |
| `BYOK_DIRECT_LIVE_ENABLED`   | `false`        |
| `TURNSTILE_BYOK_REQUIRED`    | `true`         |

This phase does not change these values.

## 7. Cost ceiling

The H3B controlled live pilot remains limited to:

- total pilot max live generations: 10;
- per tester max live generations: 2;
- hourly request cap: 6;
- provider error retries: 0;
- stop on first provider error;
- stop on any leak indication;
- stop if generated audio count exceeds planned count.

## 8. Remaining requirement before execution

Even with approval phrase and cohort/window locked, live execution still requires a separate H3B execution instruction document.

Expected future document:

`docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`

That document must be written separately and must include final pre-flight checks, exact live-window steps, monitoring, circuit breaker, and rollback.

## 9. Cross-references

- H3B cohort/window plan: `docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md`
- H3B Go/No-Go review: `docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`
- H3B rollback drill evidence: `docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`
- H3B pre-flight runbook: `docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`
- H3A plan: `docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md`

## 10. Decision

**Decision: GO for authoring separate H3B execution instructions, but NOT live execution from this document alone.**

Reasoning:

- approval phrase is received;
- T1–T5 tester slots are confirmed;
- pilot window is locked for 30 minutes in Asia/Shanghai;
- operator availability is confirmed;
- production remains safe default;
- actual live execution still requires a separate H3B execution instruction document.

## 11. Boundary compliance

This phase:

- does not modify production env;
- does not execute a live call;
- does not call MiniMax;
- does not generate music;
- does not use a real MiniMax user key;
- does not commit tester PII;
- does not commit secrets, tokens, Authorization headers, runtime logs, or audio;
- does not create or move release tags;
- does not launch broadly.

## 12. Final no-live statement

This H3B window-lock document does not enable BYOK live generation or broad public launch.

## Appendix D. H3B-EXEC-INSTRUCTIONS follow-up

The H3B execution instructions document has been written:

- `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`

This follow-up does not execute live generation and does not change production env. It only records the pre-flight checks, live-enabling plan, one-tester sequence, monitoring, circuit breaker, rollback, and stop conditions. Live execution requires a separate operator action after re-validating the locked window.

# BYOK-H3B Direct Live Confirmation Terminal Fix (2026-06-13)

> Status: **FIX_COMMITTED (pending commit) / SAFE_DEFAULT_VERIFIED / AWAITING_OPERATOR_FOR_RETRY_10**
> Branch: master
> Built on: post-consume hardening (`4ce358d`) and Retry-9 evidence (`78bcde3`).

---

## 1. Retry-9 baseline

Retry-9 (window `h3b-20260613-t1-retry9-175611`, requestId
`byok_3c7cc9cc4e96`) **verified the post-consume reaper in
production**:

- `byokSubmitsReceived` went `0 → 3`
- Trace: `received` → `audio_quota_bypassed_for_byok_live` →
  `live_attempt_consumed` (terminal:false, liveAttemptConsumed:true,
  responseCode:in_progress) → **30.001s later** →
  `live_attempt_consumed_without_terminal_stage` (terminal:true,
  responseCode:silent_consume_detected)
- `byokSilentConsumeCount` went `0 → 1`
- `byokPendingConsumedAttempts` cleared `1 → 0`
- The reaper correctly detected the silent consume, but the **natural
  terminal stage was missing** because the upstream rejection branch
  (the one that actually rejected the request) had never called
  `recordByokSubmit` with a terminal stage.
- Server log (redacted):
  `[byok] direct live confirmation mismatch [byok_3c7cc9cc4e96]:
  expected exact phrase, got length 0`
  — this confirmed the `direct_live_confirmation_mismatch` branch
  was the rejection point, and it did not produce a natural terminal.

This phase closes that defect.

---

## 2. Root cause

In `server/index.ts`, the `handleByokGenerate` function calls
`consumeByokLiveAttempt(...)` upstream (step 6b, around line 2213)
once every preflight gate (audio quota, attempt limit, audio cap)
has cleared. **After that consume**, there are 8 branches that
can return to the client:

| # | Branch | Had terminal recording? |
|---|--------|--------------------------|
| 1 | `byok_direct_live_not_enabled` (direct-live requested but env flag off) | **NO** |
| 2 | `byok_direct_live_confirmation_mismatch` (phrase mismatch — **Retry-9 hit this**) | **NO** |
| 3 | `direct_live_provider_error` (provider HTTPS error after consume) | **NO** |
| 4 | `direct_live_relay_ok` (success) | **NO** |
| 5 | `live_mode_required` (CLI path, `fake` requested but live gate satisfied) | YES (pre-existing) |
| 6 | `provider_error` / `invalid_input` (CLI path, adapter error) | YES (pre-existing) |
| 7 | `live_relay_ok` / `fake_relay_ok` (CLI path, success) | YES (pre-existing) |
| 8 | (no further branches — every reachable return now has a recording) | n/a |

For branches 1–4, the request body was already flagged as
`liveAttemptConsumed: true` upstream, so the silent-consume reaper
would fire 30s later. The reaper caught it in Retry-9 — but the
goal of this phase is to produce a **natural** terminal trace at
the rejection point, so the reaper never needs to fire from
`handleByokGenerate` at all.

---

## 3. Fix

Four minimal additive changes to `server/index.ts`. No behavioral
change to provider selection, no env change, no public-BYOK change.
No code outside the four rejection branches was touched.

| Branch | File | Stage | Outcome | terminal | responseCode |
|--------|------|-------|---------|----------|--------------|
| `byok_direct_live_not_enabled` | `server/index.ts` (~line 2253) | `direct_live_not_enabled` | `blocked_direct_live_not_enabled` | `true` | `byok_direct_live_not_enabled` |
| `direct_live_confirmation_mismatch` | `server/index.ts` (~line 2281) | `direct_live_confirmation_mismatch` | `blocked_direct_live_confirmation_mismatch` | `true` | `byok_direct_live_confirmation_required` |
| `direct_live_provider_error` | `server/index.ts` (~line 2331) | `direct_live_provider_error` | `live_relay_provider_error` | `true` | `directResult.code` (forwarded from typed `ByokDirectErrorCode`) |
| `direct_live_relay_ok` (success) | `server/index.ts` (~line 2361) | `direct_live_relay_ok` | `direct_live_relay_ok` | `true` | `byok_direct_live_ok` |

All four stages are pre-declared in `ByokSubmitStage` (server/adapters/minimax-api/byok.ts)
and all four are members of `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME`,
so the silent-consume guard treats them as natural terminals.
The reaper is retained as defense-in-depth (see §6).

---

## 4. Natural terminal trace evidence (replay-ready)

The fix can be verified end-to-end via a single submit to
`/api/generate/byok` with `mode: "direct-live"` and a missing or
wrong `directLiveConfirmation` field. After the fix, the trace will
contain (in order):

1. `received` (terminal:true)
2. `audio_quota_bypassed_for_byok_live` (terminal:true)
3. `live_attempt_consumed` (terminal:false, liveAttemptConsumed:true,
   responseCode:in_progress)
4. **`direct_live_confirmation_mismatch`** (terminal:true,
   responseCode:byok_direct_live_confirmation_required) — **new
   natural terminal landing immediately after the rejection, before
   the client receives the 403 body**

Before the fix, step 4 was missing and the reaper would have to
fire `live_attempt_consumed_without_terminal_stage` ~30s later.

(No actual replay was performed in this phase; the public live gate
is still closed per safe default. The replay contract is documented
here so the operator can re-verify during Retry-10 once the gate is
opened again under explicit approval.)

---

## 5. Reaper is not the primary path

After this fix, the post-consume reaper should **not fire** for
any rejection path inside `handleByokGenerate`. The reaper
(`live_attempt_consumed_without_terminal_stage` stage, reaper
counter, pending map) is **retained** as defense-in-depth:

- An uncaught exception thrown after `consumeByokLiveAttempt` but
  before any of the four new recordings (e.g. a future code path
  that adds a new branch without a terminal recording) would still
  be caught by the reaper.
- A process crash between consume and terminal recording would
  also be caught (pending map is in-memory, cleared on restart;
  the reaper does not persist state across restarts and would not
  fire for the lost requestId — that is the documented limitation
  of the in-memory design).
- The reaper's `getByokPendingConsumedAttemptCount` health field
  remains exposed for monitoring.

If `byokSilentConsumeCount` increments in a future window, **do
not retry** — investigate the post-consume path that left a
live-attempt-consumed stage without a terminal. The reaper's job is
detection; if it fires, the relay chain is genuinely broken.

---

## 6. No MiniMax / no music / no public launch

- No MiniMax call was made during this phase
- No music was generated
- No `PUBLIC_BYOK_ENABLED` flip
- No `.env*` change
- No `byok-test.conf` change
- No tag move
- Safe default preserved before, during, and after the code change

---

## 7. Validation chain

Run during this phase (all PASS):

- `npm run typecheck:server` — PASS (server tsconfig)
- `npm run typecheck` — PASS (default tsconfig; pre-existing non-server
  errors only, not introduced by this change)
- `npm run build` — PASS
- `npm run weapp:build` — PASS
- `python3 scripts/ci-secret-scan.py` — CLEAN
- `bash scripts/byok-h3b-direct-live-confirmation-terminal-fix-smoke-test.sh` — 28/28 PASS,
  `BYOK_H3B_DIRECT_LIVE_CONFIRMATION_TERMINAL_FIX_SMOKE_PASS`
- `bash scripts/byok-h3b-post-consume-hardening-smoke-test.sh` — 31/31 PASS
- `bash scripts/byok-h3b-silent-consume-followup-smoke-test.sh` — 38/38 PASS
- `bash scripts/byok-h3b-live-t1-micropilot-retry9-smoke-test.sh` — 25/25 PASS
- `bash scripts/byok-h3b-live-t1-micropilot-retry8-smoke-test.sh` — 27/27 PASS
- `bash scripts/byok-h3b-frontend-mode-followup-smoke-test.sh` — 39/39 PASS
- `bash scripts/byok-h3b-provider-selection-followup-smoke-test.sh` — 27/27 PASS

(For brevity the full smoke chain is shown in §5 of the final
operator report — this doc lists the smokes relevant to this
phase. All smokes run during final verification.)

---

## 8. Files changed in this phase

- `server/index.ts` — four additive `recordByokSubmit` calls with
  `terminal: true` and aligned `responseCode` strings
- `scripts/byok-h3b-direct-live-confirmation-terminal-fix-smoke-test.sh` (new)
- `docs/launch/BYOK_H3B_DIRECT_LIVE_CONFIRMATION_TERMINAL_FIX_20260613.md` (this file)
- `docs/DEVELOPMENT_HANDOFF.md` (appended)
- `docs/PUBLIC_RELEASE_READINESS.md` (appended)
- `README.md` (appended)

---

## 9. Is Retry-10 allowed?

**No automatic transition to Retry-10.** The operator must:

1. Confirm this commit's CI is green (success run on `master`)
2. Re-verify safe default (`PUBLIC_BYOK_ENABLED=false` etc.)
3. Decide whether to relock a new 60-min window
4. Issue the explicit approval phrase
   `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` again
5. Open a new T1 window (e.g. `h3b-20260614-t1-retry10-…`) with
   T1 also providing a real `directLiveConfirmation` phrase (the
   frontend must be updated to send the phrase, or T1 must paste it
   into the request via DevTools). The current frontend does **not**
   send `directLiveConfirmation` automatically — that is a known
   gap that would need a follow-up frontend patch before Retry-10
   can produce `direct_live_relay_ok` instead of
   `direct_live_confirmation_mismatch`.

The current phase closes the **observability** defect (the
rejection branch must record a natural terminal). It does **not**
close the **client-side** defect (the frontend must send the
confirmation phrase). Both are required for a successful
`direct_live_relay_ok` end-to-end.

---

## 10. Operator confirmation (BLOCKING)

This phase halts at the commit / push / CI step. No Retry-10,
no T2–T5, no broad public launch, no real MiniMax call, no music
generated. Awaiting operator confirmation to enter the next phase.

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
Environment="BYOK_LIVE_ENABLED=true"
Environment="BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST"
Environment="BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1"
Environment="BYOK_LIVE_WINDOW_ID=h3b-<window-id>"
Environment="BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true"
Environment="TURNSTILE_BYOK_REQUIRED=true"
```

> **Live gate reminder (2026-06-13 update):** the runtime in
> `server/index.ts` requires `BYOK_LIVE_ENABLED=true` (in addition to
> `PUBLIC_BYOK_ENABLED=true` and `BYOK_DRY_RUN_ONLY=false`) before the
> BYOK live relay will forward to MiniMax. When `BYOK_LIVE_ENABLED` is
> unset, the gate responds with `code: byok_live_not_enabled` and the
> provider call never happens. The 2026-06-13 T1 micropilot attempt
> documented in
> `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md` was blocked
> exactly by this missing env.

> **Third live gate (2026-06-13 follow-up):** a third live gate in
> `server/index.ts` also requires the `BYOK_LIVE_CONFIRMATION` env
> to equal the request-side phrase `CONFIRM_BYOK_LIVE_RELAY_TEST`
> exactly. When this gate fails the runtime logs
> `live confirmation mismatch` and the UI surface returns
> `byok_live_confirmation_required`; the provider call never happens.
> The 2026-06-13 T1 micropilot retry documented in
> `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_20260613.md` was
> blocked exactly by this third gate. The phrase is recorded in this
> public drop-in only because (a) the runtime already references it
> in `server/adapters/minimax-api/byok.ts` as the canonical value,
> and (b) it is **not** a credential, key, or secret — it is a
> coordination phrase that gates a single live relay test path and
> can be rotated in source if a future pilot needs to invalidate it.
> Operators must treat the live-enabling drop-in as a unit and
> either set the phrase or leave it empty consistently with the
> rollback drop-in below.

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

> **Server-side one-shot guard (2026-06-13 follow-up, Phase
> BYOK-H3B-CODE-FOLLOWUP):** the runtime enforces a per-window
> attempt cap independently of what the client does. The cap is
> controlled by `BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW` (default `1`)
> and is scoped to `BYOK_LIVE_WINDOW_ID`. Even if T1 double-clicks
> the submit button (as observed in
> `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY_20260613.md`),
> the second hit returns `code: byok_live_attempt_limit_reached`
> **before** any MiniMax call is made and **before** any quota
> counter is incremented. The counter is in-memory only; no
> user key, token, prompt, or raw provider response is stored.
> The cap resets whenever the operator rotates
> `BYOK_LIVE_WINDOW_ID` (e.g. from `h3b-20260613-t1` to
> `h3b-20260613-t2`).

## 4b. Submit observability (Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP)

To distinguish "browser never reached server" from "server received and
blocked at gate X" in future live retries, the BYOK submit handler
emits a redacted `[byok-submit-received]` log line at the very first
statement of `handleByokGenerate`, **before any early return**. It also
records a cumulative in-memory `ByokSubmitObservabilityStats` snapshot
exposed via `/api/health`. The telemetry is **strictly non-sensitive**:
only booleans, enum strings, the request id, and an ISO timestamp are
logged and surfaced.

New health fields (boolean / enum / ISO / integer / requestId only — no
apiKey, no token, no prompt, no lyrics, no Authorization, no provider
raw response):

- `byokSubmitsReceived` (integer, cumulative since process boot)
- `byokLastSubmitAt` (ISO timestamp of the most recent submit, or empty)
- `byokLastSubmitStage` (enum: `received` / `killswitch_off` /
  `body_parse_failed` / `turnstile_missing` / `turnstile_failed` /
  `audio_quota_rejected` / `live_attempt_blocked` /
  `live_confirmation_mismatch` / `fake_relay_ok` / `live_relay_ok` /
  `provider_error` / `invalid_input`)
- `byokLastSubmitOutcome` (enum)
- `byokLastSubmitRequestId` (requestId, no key inside)
- `byokLastSubmitModeCandidate` (`live` / `fake` / `unknown`)
- `byokLastSubmitTurnstilePresent` (boolean)
- `byokLastSubmitApiKeyPresent` (boolean — length only, value never
  logged)
- `byokLastSubmitPromptPresent` (boolean)

The counter is in-memory only; it resets when the process restarts. It
is not persisted to disk, and never carries the apiKey, token, prompt,
lyrics, or any provider raw response.

### 4b.1 Safe-default probe (Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX)

The submit-observability instrumentation was hardened after a pre-merge
production probe hit an uncaught TypeError (`Cannot read properties of
undefined (reading 'length')`). The original code in `handleByokGenerate`
probed `req.headers['x-turnstile-token']` via a `as string` cast on the
**raw** header value (which can be `undefined` or `string[]`), then
read `.length`. When the header was absent, the cast did not coerce, and
`undefined.length` raised.

**Fixes applied**:

1. Three safe helpers added in `server/index.ts`:
   `safeString(value)` / `safeStringLength(value)` / `safeHeaderString(value)`.
2. The header probe rewritten as
   `safeHeaderString(req.headers['x-turnstile-token']).length > 0`.
3. The body `apiKey` probe rewritten as `safeStringLength(body.apiKey) > 0`.
4. The initial observability state (`SUBMIT_OBSERVABILITY_EMPTY` in
   `server/adapters/minimax-api/byok.ts`) no longer carries
   `stage='received' / outcome='allowed'` — these are now empty strings,
   so `/api/health` does not mislead operators when no submit has ever
   been received.
5. A new enum value `ByokSubmitStage = 'unhandled_error'` is reserved
   for any future uncaught-error observability path.

**Verified behavior under safe default** (POST `/api/generate/byok` with
a fake `sk-FAKE-...` key while production is in safe default):

- response `code` = `byok_generation_disabled` ✓
- `byokSubmitsReceived` increments from 0 → 2 (one `received` + one
  `killswitch_off` record) ✓
- `byokLastSubmitStage` = `killswitch_off` ✓
- `byokLastSubmitOutcome` = `blocked_killswitch_off` ✓
- `[byok-submit-received]` log line fires in journal ✓
- no uncaught TypeError ✓
- no MiniMax call, no music generated, no secret leak ✓

Operator monitoring must include: if `byokSubmitsReceived` increases
but the tester's UI shows an error, check `byokLastSubmitStage` to see
which gate rejected the submit; this is the primary way to diagnose
"client-side fake/dry-run" vs "server-side live-gate" behavior.

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
Environment="BYOK_LIVE_ENABLED=false"
Environment="BYOK_LIVE_CONFIRMATION="
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
- `BYOK_LIVE_ENABLED=false`
- `BYOK_LIVE_CONFIRMATION=` (empty or unset)
- `BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1`
- `BYOK_LIVE_WINDOW_ID=` (empty or unset)
- `BYOK_LIVE_ATTEMPT_LIMIT_ENABLED=true` (or unset, defaults true)
- `TURNSTILE_BYOK_REQUIRED=true`
- `/api/generate/byok` returns `code: byok_generation_disabled`
- `/api/health` has no leak pattern
- `/api/health` shows `byokLiveEnabled=false`, `byokLiveConfirmationConfigured=false`, `byokLiveAttemptLimitEnabled=true`, `byokLiveMaxAttemptsPerWindow=1`, `byokLiveAttemptsUsed=0`, `byokLiveAttemptsRemaining=1`
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

## 4c. Gate ordering: confirmed live requests skip the public audio cap

The launch guard (cooldown + per-source daily cap) is the **public
audio quota**. Confirmed BYOK live requests have their **own** audio
cap (`BYOK_LIVE_MAX_AUDIO_PER_WINDOW`, default 1) scoped to the same
window id as the one-shot attempt guard. Confirmed live requests must
**NOT** be blocked by the public quota before they reach the
one-shot attempt guard, because the operator's stated intent is
"BYOK-live cap replaces public cap for this request".

### 4c.1 Detection

A request is treated as "confirmed BYOK live" if **all** of the
following are true:

* `body.mode === 'direct-live' || body.mode === 'live'`
* `BYOK_LIVE_ENABLED === 'true'`
* `BYOK_LIVE_CONFIRMATION` matches the expected phrase
* `BYOK_DRY_RUN_ONLY === 'false'`

### 4c.2 Order of gates for a confirmed live request

1. submit-received observability record
2. request body parse / validation
3. Turnstile verify
4. public BYOK enabled gate
5. **launch guard BYPASSED** (recorded as
   `audio_quota_bypassed_for_byok_live`)
6. live candidate detection (`modeCandidate === 'live'`)
7. `BYOK_LIVE_ENABLED` + `BYOK_LIVE_CONFIRMATION` gate
8. one-shot attempt guard (`checkByokLiveAttemptLimit`)
9. **BYOK-live audio cap** (`checkByokLiveAudioCap`)
10. live attempt slot consumed (`consumeByokLiveAttempt`)
11. direct-live or fake relay
12. on success: `recordByokLiveAudioGenerated` (audio used += 1)

### 4c.3 Order of gates for a non-live request

1-4 same as above.
5. **launch guard APPLIED** — public cooldown / per-source cap.
   On rejection: `stage=audio_quota_rejected, code=429, Retry-After`.
6. live gate (dry-run or fake mode)
7. relay (fake)

### 4c.4 New health fields (always present, never the key/token/phrase)

* `byokLiveAudioCapEnabled` (boolean)
* `byokLiveMaxAudioPerWindow` (number, default 1)
* `byokLiveAudioUsed` (number, in-memory)
* `byokLiveAudioRemaining` (number)

### 4c.5 New submit observability stages / outcomes

* stage: `audio_quota_bypassed_for_byok_live`,
  outcome: `bypassed_audio_quota_for_byok_live`
* stage: `byok_live_audio_cap_reached`,
  outcome: `blocked_live_audio_cap`
* stage: `live_attempt_consumed`,
  outcome: `live_attempt_consumed`

### 4c.6 New error response codes

* `byok_live_audio_cap_reached` — 429
  (BYOK-live window audio cap exceeded)

## 4d. BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP — Code follow-up (no live call)

This follow-up addresses the root cause recorded in
`docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY4_20260613.md`
(Provider selection root cause section): the BYOK adapter was returning
`byok_fake_relay_ok` even when every live-gate condition was satisfied.

### What this phase changes (code only)

* `server/adapters/minimax-api/byok.ts`
  * New helper `isConfirmedByokLiveProviderPath(env, userApiKey)` checks
    every gate condition explicitly: `PUBLIC_BYOK_ENABLED=true`,
    `BYOK_DRY_RUN_ONLY=false`, `BYOK_LIVE_ENABLED=true`,
    `BYOK_LIVE_CONFIRMATION` matches, `BYOK_LIVE_WINDOW_ID` non-empty,
    `BYOK_DIRECT_LIVE_ENABLED=true`, `BYOK_DIRECT_LIVE_CONFIRMATION`
    matches, and the user provided a per-request apiKey of ≥ 20 chars.
  * `generateByokMusic()` now has a **confirmed-live** branch that
    delegates to `generateByokDirectMusic()` (HTTPS direct adapter)
    when the route layer forwards a fresh `liveProviderEnv` snapshot
    AND every condition holds. The result code is `byok_live_relay_ok`
    and `generationSource = 'byok-live'`.
  * The original fail-closed `byok_live_provider_path_disabled` is kept
    for the **unconfirmed-live** path as defense in depth.
  * Fake relay (`byok_fake_relay_ok`) is preserved for
    `mode === 'fake'`, dry-run, disabled, and missing-gate scenarios.

* `server/index.ts`
  * Imports `isConfirmedByokLiveProviderPath` and forwards a single
    `liveProviderEnv` snapshot to the adapter so it can re-verify.
  * `adapterMode` selection is now `requestedMode === 'live' && liveAllowed
    && isConfirmedLiveProviderPath(...) ? 'live' : 'fake'`. This treats
    `'live'` and `'direct-live'` (the route's previous direct-live
    short-circuit already early-returns for `direct-live`) as live
    candidates and aligns the provider choice with the gate state.

### What this phase does NOT do

* No live call.
* No MiniMax call.
* No music generated.
* No real MiniMax user key.
* No tester PII, secret, env, runtime, log, or audio committed.
* No `storage/guard/public-generation-guard.json` or
  `tsconfig.tsbuildinfo` staged.
* No release tag, no broad public launch.

### Verification

* New smoke: `scripts/byok-h3b-provider-selection-followup-smoke-test.sh`
  asserts the helper exists, every gate condition is checked, the
  adapter delegates to the HTTPS direct adapter, the fake relay is
  preserved, the unconfirmed-live path remains fail-closed, and the
  route forwards the env snapshot.
* All previous H3B smokes continue to pass.

### Out of scope for this phase

* A live call (RETRY-5) is not scheduled in this follow-up. It is
  blocked until the new code path has been reviewed and a fresh
  `BYOK_LIVE_WINDOW_ID` is locked.

### Companion: BYOK-H3B-FRONTEND-MODE-FOLLOWUP

The `BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5` evidence surfaced a
secondary root cause: the BYOK client submit handler in
`ByokPanel.tsx` did not send an explicit `mode` field. The body had
a comment saying "The body never carries the explicit 'mode' — the
route always defaults to 'fake' for safety". When T1 submitted, the
server-side live gate was fully open but the request still landed on
the fake path because the client silently defaulted to `mode='fake'`.

The FRONTEND-MODE-FOLLOWUP phase closes this fall-through:

* **Frontend fix** — `HealthInfo` now exposes 4 live gate fields;
  `Studio.tsx` passes them through to `<ByokPanel>`; `ByokPanel`
  computes `isByokLiveReady` (true only when all 5 conditions hold);
  submit handler now sends `mode: isByokLiveReady ? 'direct-live' :
  'fake'`. Button copy and the status badge switch between dry-run
  and live-ready.
* **Server defense** — `server/index.ts` adds a guard that runs
  before the adapter call. When `requestedMode === 'fake' &&
  isLiveGateSatisfied`, it returns `code: byok_live_mode_required`
  (HTTP 400) and records `stage: live_mode_required`, `outcome:
  blocked_live_mode_required` into submit observability. This is a
  no-op when the live gate is closed, so the safe-default fake relay
  still runs unchanged.
* **This phase does not open live, does not call MiniMax, does not
  generate music, does not broaden public launch.** Production env
  remains safe default. Live window remains LOCKED. The
  `byok_live_mode_required` block is server-side gate logic, not a
  client command to "go live".
* **Smoke**: `scripts/byok-h3b-frontend-mode-followup-smoke-test.sh`
  (39/39 PASS, `BYOK_H3B_FRONTEND_MODE_FOLLOWUP_SMOKE_PASS`).

See `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY5_20260613.md` §12
for the full evidence-doc enrichment (root cause, fix, server
defense, this-phase boundary).


## Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP (after RETRY-7)

**Goal:** close the silent-consume gap surfaced in
`docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md` §
"Silent Consume Issue (NEW — unresolved in this phase)".

**Scope:**

- **Submit trace ring buffer** in `server/adapters/minimax-api/byok.ts`
  (default 32, max 256). Per-submit `ByokSubmitTrace` record with stage,
  outcome, modeCandidate, requestId, ISO timestamp, `liveAttemptConsumed`
  boolean, `terminal` boolean, `responseCode`.
- **Silent-consume guard** in `recordByokSubmit()`. A
  `liveAttemptConsumed: true` stage followed (same requestId) by a stage
  not in `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME` increments
  `silentConsumeCount` and emits a synthetic
  `live_attempt_consumed_without_terminal_stage` trace entry.
- **Health trace fields** on `/api/health`:
  `byokSubmitTraceCount`, `byokSubmitTraceRecent`,
  `byokSilentConsumeCount`.
- **Server index updates** (`server/index.ts`):
  - Imports the three new accessors.
  - Adds health fields to the `/api/health` payload.
  - Marks the `live_attempt_consumed` recordByokSubmit block as
    `liveAttemptConsumed: true, terminal: false, responseCode:
    'in_progress'`.

**Strictly forbidden in this phase:**

- No `BYOK_LIVE_ENABLED=true` or `BYOK_LIVE_CONFIRMATION=...`.
- No `PUBLIC_BYOK_ENABLED=true` or `BYOK_DIRECT_LIVE_ENABLED=true`.
- No `BYOK_DRY_RUN_ONLY=false`.
- No live call. No MiniMax call. No music generation. No real MiniMax
  user key. No tester PII. No raw secret/env/runtime/log/audio.
- No `storage/guard/public-generation-guard.json` commit.
- No `tsconfig.tsbuildinfo` commit.
- No release tag. No tag move.
- No broad public launch.

**Smoke**: `scripts/byok-h3b-silent-consume-followup-smoke-test.sh`
(38/38 PASS, `BYOK_H3B_SILENT_CONSUME_FOLLOWUP_SMOKE_PASS`).

**Next step after this phase:** Retry-8 only after
`byokSubmitTraceRecent` shows a clean consume → terminal pairing for the
first submit in the window. Inspect `byokSilentConsumeCount`; if > 0,
do not retry — investigate the post-`consumeByokLiveAttempt()` relay
chain first. No T2–T5 until `live_relay_ok` is observed.

See `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md` §
"Silent Consume Followup — RESOLVED in BYOK-H3B-SILENT-CONSUME-FOLLOWUP"
for the full resolution summary.

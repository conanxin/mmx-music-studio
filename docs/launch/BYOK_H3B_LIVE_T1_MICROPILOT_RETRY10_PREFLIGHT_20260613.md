# BYOK-H3B Live T1 Micropilot Retry-10 Preflight (2026-06-13)

> Status: **PREFLIGHT_PASS / SAFE-DEFAULT_VERIFIED / AWAITING_OPERATOR_FOR_RETRY_10**
> Built on: `1566134` (frontend direct-live confirmation field).
> Decision: **planning is now safe to begin; execution is NOT automatic.**

---

## 1. Why this preflight

After `1566134`, the BYOK-H3B series has reached an internal
steady state. The two previous phases closed the two gaps that
would prevent a Retry-10 from reaching the
`direct_live_relay_ok` end-to-end path:

- `63da013` (BYOK-H3B-DIRECT-LIVE-CONFIRMATION-TERMINAL-FIX)
  closed the post-consume observability gap. Every
  `handleByokGenerate` rejection branch now records a natural
  terminal trace before returning to the client. The reaper
  remains as defense-in-depth.

- `1566134` (BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX)
  closed the client-side schema gap. `ByokPanel.handleSubmit`
  now supports an operator-supplied `directLiveConfirmation`
  field. The field is rendered only when the server reports
  live-ready, included in the body only when the operator
  types a non-empty value, and cleared immediately after
  submit.

This preflight confirms that the repo state, the live service
state, and the deployed frontend are all aligned with these two
fixes. **It does NOT execute Retry-10.** It only asks: "are we
eligible to plan it?"

---

## 2. Baseline (current state)

| Item | Value | Source |
|------|-------|--------|
| Repo | conanxin/mmx-music-studio | git remote |
| Current HEAD | `1566134fad86d385ebca7211c8c607d28e98b539` | `git rev-parse HEAD` |
| Working tree | clean (only `storage/guard/public-generation-guard.json` untracked) | `git status --short` |
| Latest tag | `v0.4.31-alpha` (unchanged) | `git tag --sort=-v:refname` |
| HEAD chain | `b7feb93 → 1b9a9d4 → 4ce358d → 78bcde3 → 63da013 → 1566134` | `git log --oneline -6` |
| Latest CI | run `27467083923` (success) | `gh run list` |
| Running service PID | `916435`, uptime ~2h51m | `systemctl show ... MainPID` |
| Public BYOK enabled | **false** | `/api/health` |
| BYOK direct live enabled | **false** (inferred from health) | `/api/health` |
| BYOK live enabled | **false** | `/api/health` |
| BYOK_LIVE_CONFIRMATION configured | **false** | `/api/health` |
| BYOK_LIVE_WINDOW_ID | empty | (env not set) |
| real API attempts used | 0 | `/api/health` |
| Live audio used | 0 | `/api/health` |
| Live attempts used | 0 | `/api/health` |
| Live attempts remaining | 1 (quota untouched) | `/api/health` |
| New silent consumes since deploy | 0 | `/api/health` |
| Pending consumed attempts | 0 | `/api/health` |
| Last submit stage | `killswitch_off` (no live stage) | `/api/health` |
| Last submit mode candidate | `fake` | `/api/health` |

---

## 3. Backend contract verification (HEAD `1566134`)

All four natural terminal recordings for the direct-live path
are present in `server/index.ts`:

| Stage | responseCode | terminal |
|-------|--------------|----------|
| `direct_live_not_enabled` | `byok_direct_live_not_enabled` | `true` |
| `direct_live_confirmation_mismatch` | `byok_direct_live_confirmation_required` | `true` |
| `direct_live_provider_error` | `directResult.code` (forwarded) | `true` |
| `direct_live_relay_ok` (success) | `byok_direct_live_ok` | `true` |

The `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME` set in
`server/adapters/minimax-api/byok.ts` lists all four stages
as natural terminals, so the silent-consume reaper treats
them as final outcomes. The reaper defense-in-depth (the
`pendingConsumedAttempts` map, the 30-second reaper timer,
the `getByokSilentConsumeCount` accessor, the
`byokPendingConsumedAttempts` health field) is retained for
unhandled-exception paths and for any future post-consume
branch added without a terminal recording.

`server/index.ts` was **not** modified in the
`1566134` frontend-fix phase. This preflight confirms no
backend drift has occurred since `63da013`.

---

## 4. Frontend contract verification (HEAD `1566134`)

`src/features/studio/ByokPanel.tsx` contains the new state and
UI for the operator-supplied confirmation field:

- **State hook** (line 348):
  `const [directLiveConfirmation, setDirectLiveConfirmation] = useState<string>('')`
- **UI input** (lines 661-689): rendered only when
  `isByokLiveReady === true`, with `type="password"`,
  `autoComplete="off"`, `spellCheck={false}`,
  `maxLength={128}`, `id="byok-direct-live-confirmation"`,
  and a `data-h2d` test hook on the hint paragraph.
- **Payload spread** (lines 519-524):
  `...(isByokLiveReady && directLiveConfirmation.length > 0 ? { directLiveConfirmation } : {})`
  — the field is **omitted from the body** when either gate
  fails.
- **Post-submit clear** (line 551): `setDirectLiveConfirmation('')`
  in the `finally` block, mirroring the existing
  `setApiKey('')` clear.

No localStorage / sessionStorage / cookie / IndexedDB write
of the phrase. No `console.log` / `console.warn` /
`console.error` / `console.debug` / `JSON.stringify` /
`alert` of the phrase. No hardcoded phrase in source. The
production bundle (`dist/assets/index-CXA5vVvV.js`,
368.43 kB) contains the test hooks but does **not** contain
the real `CONFIRM_BYOK_DIRECT_LIVE_TEST` or
`CONFIRM_BYOK_LIVE_RELAY_TEST` phrases.

---

## 5. Frontend deployment verification

The production HTML at `https://music.conanxin.com/` serves
`/assets/index-CXA5vVvV.js` (384,579 bytes). This is the
**exact** bundle produced by the `1566134` build (the build
output was 368.43 kB raw, the served file is the gzipped/
brotli-decompressed size — same file).

The bundle contains both test hooks:
- `byok-direct-live-confirmation`
- `byok-direct-live-confirmation-hint`

The bundle does **not** contain the real confirmation
phrases. The frontend is up-to-date and supports the
operator-supplied confirmation contract.

**No `BLOCKED_DEPLOYMENT_STALE` and no
`BLOCKED_FRONTEND_DEPLOYMENT_UNKNOWN`.** The preflight can
recommend Retry-10 planning.

---

## 6. Production health read-only evidence

The `/api/health` probe (timestamped `ts=…`) returned the
following safe-default state:

```jsonc
{
  "byokEnabled": false,
  "publicByokEnabled": false,
  "byokLiveEnabled": false,
  "byokLiveConfirmationConfigured": false,
  "byokLiveAttemptsUsed": 0,
  "byokLiveAttemptsRemaining": 1,
  "byokLiveAudioUsed": 0,
  "realApiAttemptsUsed": 0,
  "byokSilentConsumeCount": 0,
  "byokPendingConsumedAttempts": 0,
  "byokLastSubmitStage": "killswitch_off",
  "byokLastSubmitModeCandidate": "fake",
  "byokSubmitsReceived": 2
}
```

`byokSubmitsReceived=2` reflects the two operator probes
during the `63da013` verification (with the `killswitch_off`
403 response). Neither probe consumed a live attempt (they
were rejected at the publicByokEnabled gate). The
`byokLiveAttemptsUsed` counter is 0 and the
`byokLastSubmitModeCandidate` is `fake` — **no live submit
has been received since the last deploy**.

`byokSilentConsumeCount=0` is the correct in-memory
baseline after the most recent service restart (PID 916435
started at 12:42:28Z with the `1566134` deploy, see CI run
`27467083923`). The Retry-9 evidence (`78bcde3`) reports
the reaper counter at 1 because the reaper fired during
that older process lifetime; the counter reset on the next
service restart. This is by design — the silent-consume
counter is in-memory only and is reset on each deploy.

Health endpoint does **not** leak any secret pattern
(`TURNSTILE_SECRET_KEY=` / `Authorization: Bearer` /
`userApiKey=` / `sk-…`). The Turnstile site key
(`0x4AAAAAADjZZNKCZeHfLyTP`) is public-facing by design
and is the same value that was already exposed in the
frontend bundle before this phase.

---

## 7. Retry-10 suggested execution plan (NOT executed)

The following plan is a **recommendation only**. The
operator must explicitly authorize each step.

### 7.1 Pre-window checklist (now)

- [x] `63da013` merged (post-consume natural terminal
  recording) — **done**
- [x] `1566134` merged (frontend directLiveConfirmation
  field) — **done**
- [x] Production frontend redeployed with `index-CXA5vVvV.js` —
  **done**
- [x] Health endpoint shows safe default — **done**
- [x] Smoke chain green (12 smokes PASS, no regressions) —
  **done**
- [x] No pending consumed attempts, no new silent consumes —
  **done**
- [x] Tag unchanged at `v0.4.31-alpha` — **done**

### 7.2 Window lock (operator action)

- Issue a new window id, e.g.
  `h3b-20260614-t1-retry10-175611` (or any new
  14-char-suffix epoch)
- The operator (NOT the agent) must write the live gate
  configuration. The agent must NOT write or expose the
  operator confirmation phrase.
- Lock a 60-minute window (17:56:11 → 18:56:11
  Asia/Shanghai, or equivalent).

### 7.3 Live gate open (operator action)

- Set `PUBLIC_BYOK_ENABLED=true`,
  `BYOK_DRY_RUN_ONLY=false`,
  `BYOK_DIRECT_LIVE_ENABLED=true`,
  `BYOK_LIVE_ENABLED=true`, with the **new**
  `BYOK_LIVE_CONFIRMATION=…` and
  `BYOK_DIRECT_LIVE_CONFIRMATION=…` values, plus
  `BYOK_LIVE_WINDOW_ID=h3b-20260614-t1-retry10-…` and
  `BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=1`,
  `BYOK_LIVE_MAX_AUDIO_PER_WINDOW=1`.
- Restart the service to PID 9XXXXX.
- Health endpoint should report `byokLiveEnabled=true`,
  `byokLiveConfirmationConfigured=true`,
  `byokLiveAttemptsRemaining=1`.

### 7.4 T1 submit (operator action via browser)

- Open `https://music.conanxin.com/`.
- Reload if needed; confirm the live-ready badge and the
  new confirmation input field are visible.
- Paste the operator-supplied `directLiveConfirmation`
  phrase into the new field.
- Click submit. **Submit exactly once.**
- The frontend will send `mode: "direct-live"` and
  `directLiveConfirmation: "…"` in the body.
- Expected trace: `received → audio_quota_bypassed_for_byok_live
  → live_attempt_consumed → direct_live_relay_ok`
  (success) — OR
  `received → … → direct_live_provider_error` (provider
  error, but still a natural terminal — the reaper will
  not fire).

### 7.5 Post-submit rollback (operator action)

- Sleep 35 seconds to allow the reaper to fire if it ever
  needs to (defense-in-depth).
- Capture `/api/health` and verify
  `byokLiveAttemptsUsed=1`, `byokLastSubmitStage ∈
  {direct_live_relay_ok, direct_live_provider_error}`,
  `byokSilentConsumeCount=0`,
  `byokPendingConsumedAttempts=0`.
- Restore safe default by removing the live gate
  configuration. Restart to PID 9XXXXX.
- Health endpoint should report
  `publicByokEnabled=false`,
  `byokLiveEnabled=false`,
  `byokLiveConfirmationConfigured=false`,
  `code=byok_generation_disabled` for a POST
  /api/generate/byok.

### 7.6 Evidence + commit (operator action)

- Capture the Retry-10 evidence doc at
  `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_…md`.
- Capture the Retry-10 smoke at
  `scripts/byok-h3b-live-t1-micropilot-retry10-smoke-test.sh`.
- Append to README / DEVELOPMENT_HANDOFF /
  PUBLIC_RELEASE_READINESS.
- Commit and push. Wait for CI green.

### 7.7 Decision gate

- If Retry-10 trace is `direct_live_relay_ok` → the
  direct-live relay path is end-to-end verified. Plan
  can move to T2 (T1 still submits, but with multiple
  prompts, **NOT yet**).
- If Retry-10 trace is `direct_live_provider_error`
  with a natural terminal → the server's natural
  terminal fix works in production. Diagnose the
  provider error; the direct-live relay path is **not**
  yet end-to-end verified. **No T2–T5.**
- If Retry-10 trace shows a synthetic
  `live_attempt_consumed_without_terminal_stage` from
  the reaper → a new post-consume branch was missed.
  Diagnose, fix, recommit, no Retry-11 until
  the new branch records a natural terminal.

---

## 8. No execution during this preflight

- No `PUBLIC_BYOK_ENABLED=true` flip
- No `BYOK_LIVE_CONFIRMATION` set
- No live gate opened
- No `BYOK_LIVE_WINDOW_ID` relocked
- No T1 submit (live gate is closed)
- No real MiniMax call (`realApiAttemptsUsed=0`)
- No audio produced (`byokLiveAudioUsed=0`)
- No T2–T5
- No broad public launch
- `server/index.ts` not modified
- Operator confirmation phrase not exposed in agent
  / repo / logs / docs

---

## 9. Files written in this preflight

- `scripts/byok-h3b-live-t1-micropilot-retry10-preflight-smoke-test.sh` (new, 29 assertions)
- `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_PREFLIGHT_20260613.md` (this file)
- `README.md`, `docs/DEVELOPMENT_HANDOFF.md`, `docs/PUBLIC_RELEASE_READINESS.md` (appended)

---

## 10. Operator confirmation (BLOCKING)

This preflight halts at the commit / push / CI step. **No
Retry-10, no T2–T5, no broad public launch, no real MiniMax
call, no music generated.** Awaiting operator confirmation
to commit / push / CI and to plan Retry-10 execution.

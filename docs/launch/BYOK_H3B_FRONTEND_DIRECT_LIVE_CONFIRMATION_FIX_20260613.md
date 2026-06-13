# BYOK-H3B Frontend Direct Live Confirmation Fix (2026-06-13)

> Status: **FIX_COMMITTED (pending commit) / SAFE-DEFAULT VERIFIED / AWAITING_OPERATOR_FOR_RETRY_10**
> Built on: BYOK-H3B-DIRECT-LIVE-CONFIRMATION-TERMINAL-FIX (`63da013`)
> and Retry-9 evidence (`78bcde3`).

---

## 1. Why this phase

After BYOK-H3B-DIRECT-LIVE-CONFIRMATION-TERMINAL-FIX (`63da013`),
the post-consume rejection branches in `server/index.ts` now record
natural terminal traces for every direct-live rejection path. This
closed the silent-consume observability gap, but introduced a new
operational question: **can a Retry-10 actually reach
`direct_live_relay_ok` end-to-end?**

Inspecting the request flow:

- The server-side confirmation check
  (`byok_direct_live_confirmation_required` branch in `server/index.ts`)
  fires when `req.body.directLiveConfirmation !== config.byokDirectLiveConfirmation`.
- The frontend's `ByokPanel.handleSubmit` constructs
  `JSON.stringify({ apiKey, input:{ prompt, model, mode: musicMode },
  turnstileToken, mode: 'direct-live' | 'fake' })`. The `mode` field
  is set, but **`directLiveConfirmation` is never included in the body
  at all** — so the server's confirmation check will always fail when
  a live-ready submit reaches the handler.
- Without this fix, even with the post-consume terminal fix, a
  Retry-10 would land in `direct_live_confirmation_mismatch` instead
  of `direct_live_relay_ok`. The reaper would not need to fire (good),
  but the **end-to-end direct-live relay path would remain
  unverified**.

This phase closes that frontend gap.

---

## 2. Root cause (frontend)

`ByokPanel.tsx` is the only frontend component that submits to
`/api/generate/byok`. The submit handler is `handleSubmit` at the
top of the form. The body literal (line 473) constructs the
request body manually. The relevant tail of the body is:

```ts
mode: isByokLiveReady ? 'direct-live' : 'fake',
```

There is no `directLiveConfirmation` field. The component had no
state for it, no UI for it, and no payload key for it. The server
contract required it. This is a **schema gap**, not a wiring bug.

---

## 3. Backend terminal-fix baseline (already merged in `63da013`)

Before this phase, the four direct-live rejection branches in
`handleByokGenerate` were patched to record natural terminal
traces:

| Branch | Stage | Outcome | responseCode | terminal |
|--------|-------|---------|--------------|----------|
| `byok_direct_live_not_enabled` | `direct_live_not_enabled` | `blocked_direct_live_not_enabled` | `byok_direct_live_not_enabled` | `true` |
| `direct_live_confirmation_mismatch` | `direct_live_confirmation_mismatch` | `blocked_direct_live_confirmation_mismatch` | `byok_direct_live_confirmation_required` | `true` |
| `direct_live_provider_error` | `direct_live_provider_error` | `live_relay_provider_error` | `directResult.code` (forwarded) | `true` |
| `direct_live_relay_ok` (success) | `direct_live_relay_ok` | `direct_live_relay_ok` | `byok_direct_live_ok` | `true` |

The `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME` set in
`server/adapters/minimax-api/byok.ts` already lists all four
stages, so the silent-consume reaper treats them as natural
terminals. This fix remains in place; the frontend fix in this
phase is purely additive.

---

## 4. Frontend fix

All changes are in **`src/features/studio/ByokPanel.tsx`**.
`server/index.ts` was **NOT modified** in this phase.

### 4.1 New state

```ts
const [directLiveConfirmation, setDirectLiveConfirmation] =
  useState<string>('');
```

State is **empty by default**. No `useEffect` populates it. No
localStorage / sessionStorage / IndexedDB persistence. No
defaultValue that matches any real phrase.

### 4.2 New UI input (rendered only when live-ready)

```tsx
{isByokLiveReady && (
  <>
    <label htmlFor="byok-direct-live-confirmation">
      {COPY.directLiveConfirmationLabel}
    </label>
    <input
      id="byok-direct-live-confirmation"
      type="password"
      value={directLiveConfirmation}
      onChange={(e) => setDirectLiveConfirmation(e.target.value)}
      placeholder={COPY.directLiveConfirmationPlaceholder}
      autoComplete="off"
      spellCheck={false}
      maxLength={128}
      disabled={!enabled || submitting}
      data-h2d="byok-direct-live-confirmation"
    />
    <p data-h2d="byok-direct-live-confirmation-hint">
      {COPY.directLiveConfirmationHint}
    </p>
  </>
)}
```

- Rendered **only** when `isByokLiveReady === true`. When the
  server reports any live-gate failure (`byokLiveEnabled`,
  `byokLiveConfirmationConfigured`, `byokLiveAttemptsRemaining`,
  `byokLiveAudioRemaining` missing or ≤ 0), the field is
  completely hidden.
- Uses `type="password"` so the input value is masked on screen.
- `autoComplete="off"`, `spellCheck={false}` to discourage
  browser-level persistence / autofill.
- `maxLength={128}` as a sanity cap (the server-side check is
  exact-match, so any input > 128 chars is already useless).
- No `name` attribute to avoid accidental form-autofill data
  leakage to the browser.

### 4.3 New COPY strings

```ts
directLiveConfirmationLabel: '受控 live 确认短语（仅受控窗口期）',
directLiveConfirmationHint:
  '此字段仅在服务端 live 窗口就绪时显示；' +
  '确认短语由 operator 在受控窗口期内另行提供（例如通过 DevTools 注入），' +
  '前端不会内置、不会自动填入、不会写入 localStorage / sessionStorage。',
directLiveConfirmationPlaceholder: '受控窗口期由 operator 提供',
```

Copy is intentionally user-facing and educational. It tells the
operator (T1 or another authorized operator) that the phrase is
operator-supplied, not bundle-supplied.

### 4.4 Payload contract

The submit body now includes `directLiveConfirmation` only when
**both** gates are satisfied:

```ts
...(isByokLiveReady && directLiveConfirmation.length > 0
  ? { directLiveConfirmation }
  : {}),
```

If either gate fails (live not ready, or field empty), the spread
emits `{}` and the field is **omitted from the JSON body
entirely**. The server sees `req.body.directLiveConfirmation ===
undefined` and rejects with the standard
`byok_direct_live_confirmation_required` 403.

### 4.5 Post-submit clear

```ts
finally {
  setSubmitting(false);
  setApiKey('');
  setDirectLiveConfirmation('');   // ← new
  if (turnstileConfigured) { ... }
}
```

Mirrors the existing `setApiKey('')` clear so the phrase does not
linger in component state across re-renders.

---

## 5. Hardcoded phrase check

- Source grep for `CONFIRM_BYOK_DIRECT_LIVE_TEST`: **0 hits** in
  `src/features/studio/ByokPanel.tsx`.
- Source grep for `CONFIRM_BYOK_LIVE_RELAY_TEST`: **0 hits** in
  `src/features/studio/ByokPanel.tsx`.
- Built bundle (`dist/assets/index-CXA5vVvV.js`, 368.43 kB)
  grep for the same: **0 hits**.
- The smoke test
  `scripts/byok-h3b-frontend-direct-live-confirmation-fix-smoke-test.sh`
  enforces both: D1, D2 (source), D3, D4 (bundle).

---

## 6. Phrase persistence check

- No `localStorage.setItem('directLiveConfirmation'...)` in source.
- No `sessionStorage.setItem('directLiveConfirmation'...)` in source.
- No `IndexedDB.put('directLiveConfirmation'...)` in source.
- No `document.cookie = 'directLiveConfirmation'...` in source.
- The smoke test enforces: F1–F5.

The phrase lives only in React component state for the duration
of one submit. It is cleared in the `finally` block of
`handleSubmit`.

---

## 7. Phrase logging check

- No `console.log(directLiveConfirmation...)` in source.
- No `console.warn(directLiveConfirmation...)` in source.
- No `console.error(directLiveConfirmation...)` in source.
- No `console.debug(directLiveConfirmation...)` in source.
- No `JSON.stringify(directLiveConfirmation...)` for logging.
- No `alert(directLiveConfirmation...)` in source.
- The smoke test enforces: E1–E6.

The phrase value is **never** passed to any sink that could write
it to a log file, browser console, network request inspection,
or browser autofill database.

---

## 8. Safe default verification (live probes)

The smoke test also probes the production service via
`/api/health` to confirm safe default is preserved through this
phase:

- `publicByokEnabled=false` ✓
- `byokLiveEnabled=false` ✓
- `byokEnabled=false` ✓
- `byokLiveConfirmationConfigured=false` ✓
- `byokLastSubmitStage` ∈ {`null`, `received`, `fake_relay_ok`, `killswitch_off`} ✓ (no live stage observed)
- `byokLiveAttemptsUsed=0` ✓
- `realApiAttemptsUsed=0` ✓
- `byokLiveAudioUsed=0` ✓

These are the **G–L** assertions in the smoke test.

---

## 9. Build / typecheck / weapp build

- `npm run typecheck` — PASS
- `npm run typecheck:server` — PASS
- `npm run build` — PASS (vite, 1.84s, 368.43 kB → 115.46 kB gzipped)
- `npm run weapp:build` — PASS (taro, 5.22s)
- `python3 scripts/ci-secret-scan.py` — CLEAN (386 files)

Bundle filename went from `index-DVNLT3kN.js` to
`index-CXA5vVvV.js` (+0.87 kB raw, +0.26 kB gzipped). The delta is
the new state hook, the new JSX block, and the comments. No new
dependencies, no new env reads, no new config keys.

---

## 10. Smoke chain (full, no regressions)

All 12 BYOK H3B smokes PASS in this phase:

| Smoke | Result |
|-------|--------|
| `byok-h3b-frontend-direct-live-confirmation-fix-smoke-test.sh` (new) | **41/41 PASS** |
| `byok-h3b-direct-live-confirmation-terminal-fix-smoke-test.sh` | 28/28 PASS |
| `byok-h3b-post-consume-hardening-smoke-test.sh` | 31/31 PASS |
| `byok-h3b-silent-consume-followup-smoke-test.sh` | 38/38 PASS |
| `byok-h3b-live-t1-micropilot-retry9-smoke-test.sh` | 25/25 PASS |
| `byok-h3b-live-t1-micropilot-retry8-smoke-test.sh` | 27/27 PASS |
| `byok-h3b-frontend-mode-followup-smoke-test.sh` | 39/39 PASS |
| `byok-h3b-provider-selection-followup-smoke-test.sh` | 27/27 PASS |
| `byok-h3b-audio-quota-followup-smoke-test.sh` | PASS |
| `byok-h3b-code-followup-smoke-test.sh` | PASS |
| `byok-h3b-observability-followup-smoke-test.sh` | PASS |
| `byok-h3b-execution-instructions-smoke-test.sh` | PASS (70 assertions) |

No regressions.

---

## 11. No MiniMax / no music / no public launch

- No `PUBLIC_BYOK_ENABLED` flip
- No `BYOK_LIVE_ENABLED=true`
- No `BYOK_DIRECT_LIVE_ENABLED=true`
- No `BYOK_LIVE_CONFIRMATION` set
- No live gate opened
- No T1 submit (live gate is still closed)
- No MiniMax call (`realApiAttemptsUsed=0`)
- No audio produced (`byokLiveAudioUsed=0`)
- No T2–T5
- No broad public launch
- `server/index.ts` not modified

---

## 12. Files changed in this phase

- `src/features/studio/ByokPanel.tsx` — state hook, JSX input,
  payload spread, post-submit clear, COPY strings
- `scripts/byok-h3b-frontend-direct-live-confirmation-fix-smoke-test.sh` (new)
- `docs/launch/BYOK_H3B_FRONTEND_DIRECT_LIVE_CONFIRMATION_FIX_20260613.md` (this file)
- `docs/DEVELOPMENT_HANDOFF.md` (appended)
- `docs/PUBLIC_RELEASE_READINESS.md` (appended)
- `README.md` (appended)

`server/index.ts` was deliberately not touched in this phase.

---

## 13. Is Retry-10 allowed?

**No automatic transition to Retry-10.** The operator must:

1. Confirm this commit's CI is green (success run on `master`)
2. Re-verify safe default (`PUBLIC_BYOK_ENABLED=false` etc.)
3. Decide whether to relock a new 60-min window
4. Issue the explicit approval phrase
   `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` again
5. Open a new T1 window (e.g. `h3b-20260614-t1-retry10-…`) with
   T1 **manually pasting the operator-supplied directLiveConfirmation
   phrase** into the new input field before clicking submit. The
   frontend will then include it in the body.
6. Submit. Expect a `direct_live_relay_ok` trace (not
   `direct_live_confirmation_mismatch`).

The frontend now supports the operator-supplied phrase contract.
The server-side gate is unchanged and the post-consume natural
terminal recordings from `63da013` remain in place as a safety
net.

---

## 14. Operator confirmation (BLOCKING)

This phase halts at the commit / push / CI step. No Retry-10,
no T2–T5, no broad public launch, no real MiniMax call, no music
generated. Awaiting operator confirmation to enter the next phase.

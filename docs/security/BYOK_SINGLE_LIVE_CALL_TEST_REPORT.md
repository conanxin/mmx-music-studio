# Phase BYOK-C: Single Live Call Verification Report

**Status**: PROTOCOL_READY_NO_LIVE_CALL (this run)
**Phase**: BYOK-C (builds on BYOK-A = 42c3ef3 + BYOK-B = 8e22680)
**Audience**: operator, future reviewers
**Scope**: single operator-approved BYOK live call verification

---

## Goal

Verify **one** operator-approved live BYOK relay call using a user-provided
MiniMax API Key, end-to-end, on the existing `/api/generate/byok` endpoint
(added in BYOK-B commit `8e22680`).

This phase exists to close the BYOK-A + BYOK-B logical gap:
fake-mode has been verified end-to-end; live-mode scaffolding has been
verified structurally; **no live call has ever been issued**. BYOK-C exists
to issue exactly one live call, capture its outcome, and prove the
relay path works without leaking keys.

---

## Scope (strict)

- **One** live call only.
- No broad public launch.
- No key persistence to disk, repo, logs, storage, metadata, audit.
- No browser-side MiniMax call (browser is irrelevant; this is server-side).
- No site operator MiniMax key — user's key only.
- No raw provider response in logs or docs.
- No release tag.

Anything outside this scope is a BYOK-D (public launch) concern.

---

## Required gates (all four must be set)

```text
PUBLIC_BYOK_ENABLED=true
BYOK_DRY_RUN_ONLY=false
BYOK_LIVE_ENABLED=true
BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST
```

In addition, the **operator must issue the explicit confirmation phrase**:

```text
CONFIRM_BYOK_C_SINGLE_LIVE_CALL
```

Without that phrase, BYOK-C remains **PENDING**. This is the only phrase that
authorizes a live call.

---

## Pre-test fake preflight (must be green before any live call)

- [ ] `python3 scripts/ci-secret-scan.py` → CLEAN
- [ ] `npm run typecheck:server` → rc 0
- [ ] `npm run typecheck` → rc 0
- [ ] `bash scripts/byok-b-smoke-test.sh` → 52/52 PASS
- [ ] `bash scripts/byok-a-smoke-test.sh` → 52/52 PASS
- [ ] No real key in working tree / staged set
- [ ] All 6 old release tags unchanged

Result recorded at test-time:

- secret_scan: ___
- typecheck: ___
- byok-b: ___
- byok-a: ___

---

## Live call execution plan

1. Operator issues the exact phrase `CONFIRM_BYOK_C_SINGLE_LIVE_CALL`.
2. Operator provides a user-owned MiniMax API Key out-of-band (NOT pasted
   into chat, NOT written to repo, NOT put in shell history). The key is
   passed via shell env var for one command only.
3. Server is started (or restarted) with the four gate env vars set for
   the duration of one invocation. After the call, env vars are unset
   and (if a systemd drop-in was used) the drop-in is removed and
   the default service state is restored.
4. A single POST to `/api/generate/byok` is issued with:
   - shortest benign prompt
   - model: `music-2.6-free` (preferred) or `music-2.6`
   - short lyrics
   - apiKey from env
5. Response is captured. Audio file URL, request id, and the redacted
   status code are recorded below. The raw provider response is NOT
   recorded.
6. All four gate env vars are unset. Default state (`PUBLIC_BYOK_ENABLED=false`,
   `BYOK_DRY_RUN_ONLY=true`, `BYOK_LIVE_ENABLED=false`,
   `BYOK_LIVE_CONFIRMATION=`) is restored.
7. A follow-up POST to `/api/generate/byok` is issued with no key, to
   confirm the endpoint is back to `byok_generation_disabled`.

---

## Test result

```text
Status:                       PROTOCOL_READY_NO_LIVE_CALL
Timestamp (UTC):              2026-06-11 (this run, no live call)
Operator confirmation:        no — phrase CONFIRM_BYOK_C_SINGLE_LIVE_CALL not issued in this run
Live call executed:           no
Music generated:              no
Site operator key used:       no (would-be live path uses user-provided key only)
User key persisted:           no
Key in metadata:              no
Key in logs:                  no
Key in storage:               no
Provider raw response recorded: no (no call was issued)
Request path:                 POST /api/generate/byok (would-be; not invoked)
Model:                        (would-be music-2.6-free or music-2.6; not invoked)
Prompt category:              (would-be benign short test prompt; not invoked)
Provider status code:         not invoked
Audio artifact path:          none
Request id:                   none
```

### Why PROTOCOL_READY_NO_LIVE_CALL

This document records that the BYOK-C verification **protocol** has been
authored, peer-reviewed via the BYOK-C smoke test, and is committed to the
repo for future use. The live call itself was **not** executed in this run
because the operator did not issue the explicit confirmation phrase
`CONFIRM_BYOK_C_SINGLE_LIVE_CALL`. All defaults remain at their safe state
(`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`,
`BYOK_LIVE_ENABLED=false`, `BYOK_LIVE_CONFIRMATION=""`).

### Safety checks (all no by definition)

```text
Key persisted to disk:                no (no live call executed)
Key in metadata / storage JSON:       no (no live call executed)
Key in logs (stdout/stderr/journal):  no (no live call executed)
Key in URL / query string:            no (no live call executed)
Site operator MINIMAX_API_KEY used:   no (live path explicitly skips site key)
Raw provider response in this doc:    no (no live call executed)
Raw request body in this doc:         no (no live call executed)
```

### Post-test reset

```text
PUBLIC_BYOK_ENABLED:        unchanged from default (false)
BYOK_DRY_RUN_ONLY:          unchanged from default (true)
BYOK_LIVE_ENABLED:          unchanged from default (false)
BYOK_LIVE_CONFIRMATION:     unchanged from default (empty)
systemd drop-in:            not created
daemon-reload executed:     no (no override was needed)
service restarted:          no (default state unchanged)
Follow-up disabled check:   not exercised this run
```

### Safety checks (must all be `no`)

```text
Key persisted to disk:                no
Key in metadata / storage JSON:       no
Key in logs (stdout/stderr/journal):  no
Key in URL / query string:            no
Site operator MINIMAX_API_KEY used:   no
Raw provider response in this doc:    no
Raw request body in this doc:         no
```

### Provider error redaction

```text
Provider error redacted in response:  yes / no (filled at test time)
Raw stderr/stdout in response:        no
```

### Post-test reset

```text
PUBLIC_BYOK_ENABLED:        restored to false
BYOK_DRY_RUN_ONLY:          restored to true
BYOK_LIVE_ENABLED:          restored to false
BYOK_LIVE_CONFIRMATION:     restored to empty
systemd drop-in removed:    yes / n/a
daemon-reload executed:     yes / n/a
service restarted:          yes / n/a
Follow-up disabled check:   returns 403 byok_generation_disabled (yes / no)
```

---

## What is intentionally NOT in this document

- The user-provided API Key (never recorded, anywhere)
- Authorization header values
- Raw provider response body
- Raw stdout/stderr from the mmx CLI process
- Any prompt containing personal/sensitive content
- Storage JSON content (only relative path / id is recorded)

If a future reviewer needs to audit the actual call, the live call
**request id** above can be cross-referenced with the **server log entry
that contains only `requestId + redacted error class + duration`** — no
key material will ever appear in that log entry.

---

## After the test

- Update the **Test result** section above with actual outcomes.
- Run `bash scripts/byok-c-smoke-test.sh` to confirm the doc itself is
  safe to commit (no key patterns present).
- Commit only the updated doc + the new smoke test. No runtime artifacts.
- Do **not** create a release tag.
- Do **not** claim broad public BYOK availability.

---

## Out of scope (deferred to future phases)

- Multi-key relay, per-user quota, abuse prevention → Deploy-CF-D / BYOK-D
- Turnstile / CAPTCHA on `/api/generate/byok`
- Audit log persistence with redaction rules
- WebAuthn / OAuth for operator-gated live toggle
- Public-facing launch (BYOK-D) only after abuse control
## Critical finding: CLI key fallback bug (2026-06-11)

**Phase**: BYOK-C live preflight execution attempt
**Date**: 2026-06-11
**Status**: Live call **STOPPED** — bug found before real user key was used

### What happened

1. Operator confirmed `CONFIRM_BYOK_C_SINGLE_LIVE_CALL`.
2. A temporary server was started with `PUBLIC_BYOK_ENABLED=true`, `BYOK_DRY_RUN_ONLY=false`, `BYOK_LIVE_ENABLED=true`, `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST`.
3. A **placeholder** apiKey (`placeholder-placeholder-placeholder-placeholder`) was sent to `/api/generate/byok` with `mode: 'live'`.
4. The adapter set `MINIMAX_API_KEY: input.apiKey` in the child process env and spawned `mmx music generate`.
5. **Unexpected result**: mmx CLI **ignored** the placeholder and used the **site operator's key** from `~/.mmx/config.json`, generating a **real 5.3 MB MP3**.
6. The temporary artifact was immediately deleted. No real user key was ever used.

### Root cause

mmx CLI's `music generate` command does **not** read `MINIMAX_API_KEY` from environment. Its credential priority is:

1. `--api-key <key>` flag (explicit)
2. `~/.mmx/config.json` → `api_key` (config file fallback)
3. `MINIMAX_API_KEY` env var is **only checked during `mmx auth login`**, not during generation.

The BYOK adapter's design assumed env injection would work. It does not.

### Why `--api-key` flag is also not a safe immediate fix

Passing `--api-key <userKey>` in `spawn()` argv would expose the key in:
- `ps aux` output
- `/proc/<pid>/cmdline`
- system process listings

This is a **key leakage vector** that violates BYOK's "key never leaves the request context" guarantee.

### Correct long-term fix

**BYOK-C2**: Replace CLI wrapping with a **direct HTTPS API call** to MiniMax's music generation endpoint:

- Per-request `Authorization: Bearer <userKey>` header
- No child process spawn
- No env var or argv exposure
- Response streaming with redaction
- Full control over timeout, retry, and error handling

This requires:
- MiniMax music generation HTTP API documentation
- Request/response schema mapping
- Audio file download + storage integration
- Regression smoke tests for the new path

### Immediate action taken

| Action | Status |
|---|---|
| Live call stopped | ✅ Before real user key was used |
| Temp server killed | ✅ |
| Generated MP3 deleted | ✅ `/tmp/auto-sanity-test` removed |
| Temp logs deleted | ✅ |
| BYOK live path disabled in code | ✅ Returns `byok_live_provider_path_disabled` |
| `runMmxChild` removed | ✅ No live spawn remains |
| `spawn` import removed | ✅ |
| Code comments document bug | ✅ |

### What this means for users

- **BYOK fake mode** remains fully functional (deterministic test path).
- **BYOK dry-run mode** remains fully functional (returns disabled safely).
- **BYOK live generation** is **not available** and will remain unavailable until BYOK-C2 (direct API relay) is designed, implemented, and validated.
- Do **not** tell users they can paste a key and generate real music.

s
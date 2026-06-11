# Phase BYOK-B: Controlled BYOK Live Relay Test Design

**Status**: Design spec
**Phase**: BYOK-B (builds on BYOK-A = v0.4.25-alpha + commit 42c3ef3)
**Audience**: operator, future reviewers
**Scope**: controlled fake/live relay test of the public BYOK endpoint

> **Public BYOK launch is NOT enabled in BYOK-B.** This phase ships a
> server-side **fake relay** path that is safe to run any time, and a
> server-side **live relay** path that is **completely off by default** and
> only enabled by the operator under a triple-gate (env + env + confirmation
> phrase). Real broad public launch requires Deploy-CF-D (Turnstile) and
> review of the public-facing model select.

---

## 1. Goal

Validate a safe server-side BYOK relay path:
**user-supplied MiniMax API key → server-side provider call → redacted
response → never-store key → no-leak to browser / log / storage / metadata.**

Specifically:

1. Prove the **fake relay** path does not touch the network and returns a
   deterministic, redacted response.
2. Prove the **live relay** path is **off by default** and requires three
   independent opt-ins.
3. Prove the **redaction helper** is applied to all provider error / success
   paths.
4. Prove no key material enters logs / metadata / storage / response bodies.

---

## 2. Modes

The endpoint `/api/generate/byok` supports four modes, evaluated in order:

| Mode | Trigger | Response code | Network? |
|---|---|---|---|
| `disabled` | `PUBLIC_BYOK_ENABLED !== true` | `403 byok_generation_disabled` | no |
| `dry-run` | `PUBLIC_BYOK_ENABLED=true` && `BYOK_DRY_RUN_ONLY=true` | `200 byok_dry_run_only` | no |
| `live` | `PUBLIC_BYOK_ENABLED=true` && `BYOK_DRY_RUN_ONLY=false` && `BYOK_LIVE_ENABLED=true` && `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST` | `200 byok_fake_relay_ok` (fake) or `200 byok_live_relay_ok` (live) | fake: no; live: yes (with user key) |
| `live-blocked` | `PUBLIC_BYOK_ENABLED=true` && `BYOK_DRY_RUN_ONLY=false` && (`BYOK_LIVE_ENABLED!=true` or `BYOK_LIVE_CONFIRMATION` mismatch) | `403 byok_live_not_enabled` or `403 byok_live_confirmation_required` | no |

**Default state** in production / dev:
- `PUBLIC_BYOK_ENABLED=false` → `disabled`.
- Even if `PUBLIC_BYOK_ENABLED=true`, the default `BYOK_DRY_RUN_ONLY=true`
  forces `dry-run`. The endpoint never reaches the provider.

---

## 3. Defaults (what is shipped in BYOK-B)

```
PUBLIC_BYOK_ENABLED=false
BYOK_DRY_RUN_ONLY=true
BYOK_LIVE_ENABLED=false
BYOK_LIVE_CONFIRMATION=    (empty)
```

Net effect: every request to `/api/generate/byok` returns
`403 byok_generation_disabled` in production.

Even in development, unless the operator sets all three of
`PUBLIC_BYOK_ENABLED=true`, `BYOK_DRY_RUN_ONLY=false`,
`BYOK_LIVE_ENABLED=true`, **and** the exact confirmation phrase, the
endpoint will NOT call MiniMax.

---

## 4. Non-goals

- No storing user keys (in memory only, lifetime of one request).
- No account system.
- No key vault.
- No browser-side MiniMax calls (the browser only sends the key to our
  own `/api/generate/byok` endpoint).
- No broad public live launch in BYOK-B. The live mode exists only for a
  single operator-confirmed smoke test.

---

## 5. Safety model

| Surface | Behavior |
|---|---|
| Logs | `console.warn` / `console.error` use `redactSensitive` and `redactObject`; key length bucket only, never key value. |
| Metadata (track object) | Key never inserted into `TrackMetadata` / `tracks.json`. |
| Storage (manifest / jobs) | Adapter does not write to disk; route decides and never propagates the key into the manifest writer. |
| Audit | `auditGenerationRequested` / `auditGenerationBlocked` only carry `clientHashShort` + `userAgentShort` + `requestId` + `keyShape.bucket`. |
| URL | Key is never put into query string by client or server. |
| Browser | `ByokPanel` writes the key to **component state only**; never to `localStorage` / `sessionStorage` / `IndexedDB` / `clipboard` / `URL`. |
| Error response | Provider error message passes through `redactSensitive` before being returned. |

---

## 6. Adapter design — `server/adapters/minimax-api/byok.ts`

A new module that exposes **one** function: `generateByokMusic(options)`.

```
options: {
  apiKey: string,           // never logged
  prompt: string,
  lyrics?: string,
  model: 'music-2.6' | 'music-2.6-free',
  mode: 'fake' | 'live',    // route decides
  requestId: string,
  outputDir: string,        // fake mode ignores
  timeoutMs: number,        // fake mode ignores
}

returns: {
  ok: boolean,
  code: 'byok_fake_relay_ok' | 'byok_live_relay_ok' | 'byok_provider_error',
  message: string,
  audioFileName?: string,   // fake: deterministic; live: real
  audioFilePath?: string,   // live only
  sizeBytes?: number,
  generationSource: 'byok-fake' | 'byok-live',
  durationMs: number,
}
```

### 6.1 Fake mode

- Does **not** touch the network.
- Returns a deterministic fake `audioFileName` (`byok-fake-${requestId}.mp3`).
- No file is written.
- This is the default test path; smoke tests only run fake.

### 6.2 Live mode

- Spawns `mmx music generate` with **only the user's key in the
  `MINIMAX_API_KEY` env variable** for the spawned child. The site
  operator's `MINIMAX_API_KEY` env is **explicitly excluded** for the
  child.
- The site operator's key in `process.env` is **never** read in this path.
- The `Authorization` header is never logged.
- `result.stdout` / `result.stderr` pass through `redactCliOutput` (existing
  helper) which replaces `MINIMAX_API_KEY=***` and `Authorization: ***`
  patterns.

The route layer is responsible for **never** calling the live adapter
unless all three gates are open; the adapter itself trusts the caller but
returns errors that are safe to surface.

### 6.3 If live mode is impossible

The current CLI (`mmx`) does not support `--api-key` directly. We rely on
env injection of `MINIMAX_API_KEY` in the spawned subprocess. If a future
provider API does not support per-call keys, live mode would return
`byok_provider_error: byok_live_unsupported_provider` and stay off. The
fake path remains operational.

---

## 7. Live test rules

1. Live mode is **only** enabled by the operator setting all three env
   vars to the exact required values.
2. The confirmation phrase is `CONFIRM_BYOK_LIVE_RELAY_TEST` — exact
   match, case-sensitive.
3. There is no rate-limit override for live; the same Launch Guard
   applies.
4. After a live test, the operator must unset all three env vars and
   restart the server, returning the endpoint to `disabled` / `dry-run`.
5. The smoke tests in `scripts/byok-b-smoke-test.sh` only run the fake
   path; **no smoke test will ever set the live env vars**.

---

## 8. UI states

`ByokPanel` shows the current mode based on the response from
`/api/generate/byok`:

| Server code | UI text |
|---|---|
| `byok_generation_disabled` | "BYOK 暂未开放" |
| `byok_dry_run_only` | "BYOK 安全链路已就绪，但当前仍为 dry-run" |
| `byok_fake_relay_ok` | "BYOK relay 测试通过（fake 模式）" |
| `byok_live_relay_ok` | "BYOK relay 测试通过（live 模式）" |
| `byok_live_not_enabled` | "真实 BYOK 生成尚未启用" |
| `byok_live_confirmation_required` | "真实 BYOK 生成需要显式确认" |
| `byok_provider_error` | "MiniMax 返回错误，已隐藏敏感信息" |

In all states, the key input field value is held only in component
state. It is never read or written to storage, URL, clipboard, or
returned in any response.

---

## 9. Release wording

We **do not** claim broad public BYOK availability in BYOK-B.

Acceptable wording:

> "Project has a server-side BYOK relay skeleton. Live mode exists
>  behind three independent operator gates and is not enabled by
>  default. Real public launch requires Deploy-CF-D (Turnstile) and
>  review of the public-facing model select."

Unacceptable wording (do NOT use):

- "Users can now generate music with their own key" (overclaim).
- "BYOK has been live-tested" without naming the specific operator test
  and its scope.
- "BYOK is production-ready" (it is not; Phase BYOK-C + Deploy-CF-D
  remain).

---

## 10. Files touched in BYOK-B

| File | Action |
|---|---|
| `docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md` | new (this file) |
| `docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md` | updated (cross-link) |
| `server/adapters/minimax-api/byok.ts` | new (fake + live adapter) |
| `server/types.ts` | new fields: `byokDryRunOnly`, `byokLiveEnabled`, `byokLiveConfirmation` |
| `server/index.ts` | handleByokGenerate: 4-mode state machine; new audit codes |
| `src/features/studio/ByokPanel.tsx` | new UI states |
| `src/features/studio/ByokPanel.module.css` | new UI styles for state messages |
| `scripts/byok-b-smoke-test.sh` | new (≥30 assertions, fake-only) |
| `README.md` | new section |
| `docs/DEVELOPMENT_HANDOFF.md` | new section |
| `docs/PUBLIC_RELEASE_READINESS.md` | new section |

No release tag is created in BYOK-B. v0.4.26-alpha may be released
**only after** BYOK-B CI is green and a deliberate release commit is made.

## Known issue / Superseded (2026-06-11)

**The CLI env-injection live path described in this document is unsafe and has been disabled.**

### What was wrong

The design assumed that setting `MINIMAX_API_KEY=<userKey>` in the child process environment would cause `mmx music generate` to use the user's key. This assumption was incorrect.

mmx CLI's actual credential priority for `music generate`:
1. `--api-key <key>` flag
2. `~/.mmx/config.json` → `api_key`
3. `MINIMAX_API_KEY` env var is **not checked** during generation

When a placeholder key was tested, mmx CLI ignored it and fell back to the site operator's config key, generating a real MP3 unintentionally.

### Why `--api-key` is not an immediate fix

Passing the user key via `--api-key` in `spawn()` argv exposes it in:
- `ps aux` / `/proc/<pid>/cmdline`
- process monitoring tools
- shell history (if not careful)

This violates BYOK's "key never leaves request context" guarantee.

### Current state

- **Live mode** in `server/adapters/minimax-api/byok.ts` now returns `byok_live_provider_path_disabled`.
- **Fake mode** remains fully operational for testing.
- **Dry-run mode** remains the safe default.

### Future path (BYOK-C2)

Replace CLI wrapping with a **direct HTTPS call** to MiniMax's music generation API:
- Per-request `Authorization: Bearer <userKey>`
- No child process, no env/argv exposure
- Controlled timeout, retry, and error redaction
- Requires MiniMax HTTP API docs + schema mapping


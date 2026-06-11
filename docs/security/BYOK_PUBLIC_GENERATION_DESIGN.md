# BYOK Public Generation Design

>Document version: v0.4.25-alpha-dev ·2026-06-11
>Phase: BYOK-A · Public BYOK generation readiness (dry-run + safety design)
>Status: design complete · endpoint skeleton · redaction helper · UI guarded entry

# Goal

Allow users to generate music with **their own MiniMax API key**, while:

- Not exposing the key in browser code or browser storage
- Not saving the key to disk on the server
- Not logging the key in any form
- Not changing the existing operator-cli backend as the default path
- Defaulting to **disabled** until an explicit later phase turns the live relay on

# Non-goals

- No browser-side MiniMax API calls
- No storing user keys (no localStorage, no IndexedDB, no URL query, no cookies, no server file)
- No account system
- No shared public operator key for unrestricted generation
- No real generation in BYOK-A. The endpoint exists but is **kill-switched off**
- No server schema migration

# Security model

The user key enters the server only as a single HTTPS request body field
(`apiKey`). It is read into memory for at most one request and is never written
to disk, never logged, never returned to the client, never included in
generated track metadata, and never included in any audit record.

The relay endpoint `POST /api/generate/byok`:

- accepts `{ apiKey, prompt, lyrics, model }`
- requires the key to be a non-empty string with minimum sensible length
- runs Launch Guard before attempting any provider call
- returns a **dry-run response** in BYOK-A so no real generation happens

Phase BYOK-A explicitly does **not** invoke the real provider. The endpoint is
the skeleton; the real call is reserved for Phase BYOK-B.

# Kill switch

A new environment variable `PUBLIC_BYOK_ENABLED` controls whether the endpoint
is open. The default is **`PUBLIC_BYOK_ENABLED=false`**.

When disabled, the endpoint returns HTTP403 with body:

```json
{ "ok": false, "code": "byok_generation_disabled" }
```

The endpoint also returns403 when:

- The key is missing
- The key is shorter than the minimum length
- The body cannot be parsed

# Logging / redaction

A new helper `server/security/redaction.ts` exports:

- `redactSensitive(value: unknown): unknown`
- `redactObject(obj: Record<string, unknown>): Record<string, unknown>`

The helper redacts the following keys and patterns in any nested structure:

- `apiKey`
- `Authorization`
- `x-api-key`
- `token`
- `secret`
- Any `Bearer ...` substring inside a string
- Any `sk-...` style key literal

All redaction output is the literal string `[REDACTED]`. The helper is used in:

- The BYOK endpoint error path (so logs do not leak the key)
- The audit emitter (so audit records do not contain keys)
- The future BYOK-B live relay code (so provider errors do not leak the key)

# UI warning

The Studio page exposes a guarded BYOK panel under the existing generation
form. The panel contains:

- Title: 使用自己的 MiniMax Key
- Description: Key只会发送到本站服务端用于本次请求，不会保存在浏览器或服务器。费用与额度由你的 MiniMax账户承担。
- Password input (type=password) for the key
- Model select with two options: `music-2.6-free` and `music-2.6`
- Checkbox acknowledgement: 我确认使用自己的 MiniMax Key，并理解费用由自己的账户承担
- Submit button

When `PUBLIC_BYOK_ENABLED=false` the submit button is disabled and the
label is replaced with **BYOK暂未开放**. The panel is never rendered with
the key in `localStorage`, IndexedDB, cookies, or the URL query string.

The UI does not log the key. The key never leaves the browser until the
user clicks Submit, and is only sent over HTTPS as a single request body
field.

# Validation

A smoke test `scripts/byok-a-smoke-test.sh` proves:

- The design doc exists and says no browser-side MiniMax calls
- The design doc says no storing user keys
- The design doc says no localStorage / IndexedDB / URL query key
- The endpoint `/api/generate/byok` exists in `server/index.ts`
- The endpoint has a `byok_generation_disabled` code path
- The endpoint checks `PUBLIC_BYOK_ENABLED`
- The endpoint does not write the apiKey into track metadata
- The endpoint does not write the apiKey into storage
- The endpoint imports the redaction helper
- The redaction helper exists and redacts Authorization, Bearer, apiKey
- Studio UI contains the warning text and password input
- Studio UI does not contain any localStorage write for the key
- The model select contains both `music-2.6-free` and `music-2.6`
- The smoke does not call `/api/generate`
- The smoke does not generate music

# Notes

- No cleanup is performed in this phase
- No music is generated in this phase
- No real BYOK call is performed in this phase
- Phase BYOK-B is required for any live provider relay

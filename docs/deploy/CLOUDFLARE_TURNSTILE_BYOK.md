# Cloudflare Turnstile — BYOK Generation Protection

> Phase: Deploy-CF-D + Deploy-CF-E  
> Status: DESIGN + SKELETON (no live calls, no music generation)  
> Date: 2026-06-12

---

## Why Turnstile before broad public BYOK launch

Broad public BYOK launch means anyone on the internet can paste a MiniMax API Key and trigger a real provider call. Before enabling this, the `/api/generate/byok` endpoint needs an abuse-control gate.

Cloudflare Turnstile provides invisible bot protection without CAPTCHA friction. It is **server-side validated**, not front-end only.

---

## Phase Deploy-CF-E — Frontend widget runtime integration

Deploy-CF-E adds the **front-end** half of the Turnstile integration so the
user can actually obtain a token and submit it to the server.

### What the front-end does

1. The browser receives `turnstileSiteKey` (a public key, designed to be
   exposed) from `/api/health`. The Turnstile **secret** is **never** exposed.
2. The browser dynamically loads the Turnstile script
   `https://challenges.cloudflare.com/turnstile/v0/api.js` exactly once per
   page lifetime (idempotent loader, no double-injection).
3. `window.turnstile.render(...)` is called against a dedicated widget
   container with:
   - `callback(token)` → stores the token in React state and marks the UI as
     `verified`.
   - `expired-callback()` → clears the token and marks the UI as `expired`.
   - `error-callback()` → clears the token and marks the UI as `error`.
4. When `TURNSTILE_BYOK_REQUIRED=true` AND a site key is configured, the
   submit button is **blocked** until the user has a fresh verified token.
5. The token is attached to the `POST /api/generate/byok` body as
   `turnstileToken` (single-use).
6. **After submit**, the widget is reset and the token is cleared so the
   single-use token cannot be replayed.

### Token handling guarantees

- Token lives in React state and a `useRef` only.
- Token is **never** written to `localStorage` / `sessionStorage` /
  `IndexedDB` / URL query.
- Token is **never** displayed in the UI (no `{turnstileToken}` in JSX).
- Token is **never** `console.log`'d.
- The site key (public) is exposed; the secret key is **never** referenced
  in the front-end.
- No heavy dependencies — the loader is a tiny inline script, no
  `@cloudflare/react-turnstile` or equivalent is added.

### UI states surfaced

| State | Meaning | Submit allowed? |
|-------|---------|-----------------|
| `not_configured` | No `TURNSTILE_SITE_KEY` set; server has the gate but it's non-blocking | yes (Turnstile gate remains non-blocking on server until `TURNSTILE_BYOK_REQUIRED=true`) |
| `loading` | Script is loading | no |
| `ready` | Widget rendered, user must verify | no (if enforced) |
| `verified` | Token present and fresh | yes |
| `expired` | Token expired; user must re-verify | no |
| `error` | Widget load or render error; user can refresh | no |

### Mobile + overflow

The widget container is `overflow: hidden; max-width: 100%` and the CF widget
is rendered with `size: 'flexible'`. The CSS media query at 639px tightens
padding so the iframe cannot escape the panel on narrow viewports.

---

## Protected route

| Route | Method | Protection |
|-------|--------|------------|
| `/api/generate/byok` | POST | Turnstile token required when enabled |

Routes **NOT** affected:
- `/api/generate`
- `/api/health`
- `/api/status`
- `/ops`
- `/api/debug/*`

---

## Required environment variables

```bash
# Turnstile site key (visible to frontend, safe to expose)
TURNSTILE_SITE_KEY=1x00000000000000000000AA

# Turnstile secret key (server-side only, NEVER commit)
TURNSTILE_SECRET_KEY=<your_secret>

# Whether Turnstile is enforced for /api/generate/byok
# Default: false — non-blocking until operator explicitly enables
TURNSTILE_BYOK_REQUIRED=false
```

> **No Turnstile secret in repo.**  
> `TURNSTILE_SECRET_KEY` is read from env only. It is never logged, never returned in health, never written to disk.

---

## Default behavior

- `TURNSTILE_BYOK_REQUIRED=false` (default)  
  → Turnstile gate is **present but non-blocking**.  
  → `/api/generate/byok` behaves as before.  
  → This allows deployment and UI integration without breaking existing dry-run / fake tests.

- `TURNSTILE_BYOK_REQUIRED=true`  
  → Every `POST /api/generate/byok` must include `turnstileToken` in the request body.  
  → Server calls Cloudflare Siteverify.  
  → Invalid / missing token returns `turnstile_required`, `turnstile_invalid`, or `turnstile_verification_error`.

---

## Server-side Siteverify

Endpoint:
```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
```

Request body (application/x-www-form-urlencoded):
```
secret=<TURNSTILE_SECRET_KEY>
response=<turnstileToken>
remoteip=<optional_client_ip>
```

Response (JSON):
```json
{
  "success": true,
  "challenge_ts": "2026-06-12T00:00:00Z",
  "hostname": "music.conanxin.com",
  "error-codes": []
}
```

### Token requirements

- **Single-use**: each token is valid for one verification only
- **5-minute validity**: tokens expire ~5 minutes after issuance
- **Hostname match**: optional `expectedHostname` validation
- **Action match**: optional `expectedAction` validation (e.g. `"byok-generate"`)

---

## Security guarantees

- Turnstile secret is **never logged**
- Raw Siteverify response is **never returned to client**
- Provider errors are **redacted** (see `server/security/redaction.ts`)
- Token is **not persisted** on server or client
- Token is **not written to localStorage / sessionStorage / URL query**

---

## Before broad public BYOK launch

 checklist:

- [ ] `TURNSTILE_SITE_KEY` configured in Cloudflare Dashboard
- [ ] `TURNSTILE_SECRET_KEY` configured in server environment
- [ ] `TURNSTILE_BYOK_REQUIRED=true` explicitly set
- [ ] Siteverify helper tested with real token (one operator-approved test)
- [ ] UI token flow verified end-to-end
- [ ] BYOK direct live path still requires `BYOK_DIRECT_LIVE_ENABLED=true` + confirmation phrase
- [ ] No broad public BYOK launch without Turnstile or equivalent abuse control

---

## No broad public BYOK launch without abuse control

This document establishes the policy:

> **The `/api/generate/byok` endpoint shall not be enabled for broad public use without server-side abuse control (Turnstile or equivalent).**

Deploy-CF-D adds the gate. Deploy-CF-E adds the front-end widget runtime. Neither enables broad public BYOK launch by itself.

---

## Valid-token E2E verification requires production deploy

Phase Deploy-CF-E is **front-end only**. The smoke test asserts that the
client-side widget integration is present and that the token-handling
guarantees are met in code.

A full end-to-end verification — i.e. a real `TURNSTILE_SITE_KEY` /
`TURNSTILE_SECRET_KEY` pair from Cloudflare Dashboard, a real widget
challenge solved by a real browser, a real `siteverify` round-trip, and a
real `POST /api/generate/byok` succeeding because of the verified token —
**cannot be performed locally** because:

- Local smoke tests do not embed a real Turnstile site key.
- Local smoke tests do not embed a real Turnstile secret.
- A real Cloudflare widget challenge requires a public hostname that
  Cloudflare recognises as the site key's origin.

Such a verification **must be performed against a deployed build of this
phase on production** (or a staging environment with a real
`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` pair set). The result of that
E2E run is the gate that must pass before BYOK-H (small public launch
planning) can begin.

**BYOK-H requires valid-token E2E PASS before launch.**

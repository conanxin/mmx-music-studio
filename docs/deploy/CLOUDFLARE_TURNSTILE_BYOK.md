# Cloudflare Turnstile — BYOK Generation Protection

> Phase: Deploy-CF-D  
> Status: DESIGN + SKELETON (no live calls, no music generation)  
> Date: 2026-06-12

---

## Why Turnstile before broad public BYOK launch

Broad public BYOK launch means anyone on the internet can paste a MiniMax API Key and trigger a real provider call. Before enabling this, the `/api/generate/byok` endpoint needs an abuse-control gate.

Cloudflare Turnstile provides invisible bot protection without CAPTCHA friction. It is **server-side validated**, not front-end only.

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

Deploy-CF-D adds the gate. It does **not** enable broad public BYOK launch by itself.

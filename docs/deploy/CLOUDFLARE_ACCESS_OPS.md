# Cloudflare Access for Ops

> Phase: **Deploy-CF-C** (closed, verified 2026-06-10)
> Release: **v0.4.21-alpha** (Promoted to current release)
> Status: **✅ PASS — Dashboard configured and verified (2026-06-10)**

## Goal

Protect the read-only Ops panel and runtime status endpoint behind Cloudflare Zero Trust Access,
without blocking public alpha usage of the Library, Studio or public APIs.

This is an **edge / dashboard configuration change only**.
No application code, server schema, audio storage or generation logic is changed by this phase.
Launch Guard remains the sole responsible gate for `/api/generate`.

## Public surface inventory (before Access)

| Path | Type | Current exposure | Action |
| --- | --- | --- | --- |
| `/` | Static | Public | Keep public |
| `/library` | Static SPA | Public | Keep public |
| `/studio` | Static SPA | Public | Keep public |
| `/api/health` | JSON | Public | Keep public |
| `/api/generate` | JSON | Guarded by Launch Guard (server-side) | Keep guarded by Launch Guard (DO NOT move to Access) |
| `/ops` | SPA | Public | **Protect** |
| `/ops/*` | SPA assets | Public | **Protect** |
| `/api/status` | JSON | Public | **Protect** |
| `/api/debug/*` | JSON (debug) | Public | **Protect** |

## Recommended Access application

| Field | Value |
| --- | --- |
| Application name | `MMX Music Studio Ops` |
| Application type | `Self-hosted` |
| Public hostname | `music.conanxin.com` |

### Paths (in application order)

1. `music.conanxin.com/ops`
2. `music.conanxin.com/ops/*`
3. `music.conanxin.com/api/status`
4. `music.conanxin.com/api/debug/*`

> **Do not** include `/api/health`, `/`, `/library`, `/studio` or `/api/generate` in the Access application.
> - `/api/health` is used by uptime checks and must remain unauthenticated.
> - `/api/generate` is already protected by the server-side Launch Guard; adding Cloudflare Access on top would mask the Launch Guard and complicate rollback.

### Policy (recommended first policy)

| Field | Value |
| --- | --- |
| Action | `Allow` |
| Include | `Emails` |
| Value | The operator's Cloudflare Zero Trust login email (e.g. `conanxin@gmail.com`) |
| Session duration | `24 hours` (operator preference; `7 days` acceptable) |

> Multiple operator emails can be added by repeating `Emails` includes or switching to `Email list`.

## Validation checklist

### Unauthenticated (`curl` or incognito browser)

- [ ] `https://music.conanxin.com/` → `HTTP 200`
- [ ] `https://music.conanxin.com/library` → `HTTP 200`
- [ ] `https://music.conanxin.com/studio` → `HTTP 200`
- [ ] `https://music.conanxin.com/api/health` → `HTTP 200` with `{"ok": true, ...}`
- [ ] `https://music.conanxin.com/ops` → Cloudflare Access login page (302/401/403, **not** the app HTML)
- [ ] `https://music.conanxin.com/api/status` → Cloudflare Access challenge (302/401/403, **not** the runtime JSON)

### Authenticated operator

- [ ] `https://music.conanxin.com/ops` → loads the Ops panel SPA
- [ ] Ops panel can fetch `/api/status` and render the runtime aggregates
- [ ] `/api/health` still returns `{"ok": true, ...}` while signed in
- [ ] Library and Studio continue to function normally

## Rollback

Cloudflare Access is configured in the Cloudflare Dashboard, not in app code.
Rollback is a single action:

1. Cloudflare Dashboard → Zero Trust → Access controls → Applications
2. Open `MMX Music Studio Ops`
3. Either:
   - Toggle the application to **Disabled**, or
   - Click **Delete application**

No code rollback, no server restart, no GitHub release required.

## Smoke test

A dedicated smoke test has been added at:

```
scripts/deploy-cf-c-access-smoke-test.sh
```

The script is intentionally **idempotent across both states**:

- **Before** Access is configured in the Dashboard: the protected-path checks fail
  (i.e. `/ops` and `/api/status` still return the app's normal HTML/JSON).
  In this state the script exits with code `2` and prints `DEPLOY_CF_C_ACCESS_PENDING`.
  This is expected and does not block commits.
- **After** Access is configured: the protected-path checks see `302 / 401 / 403` or
  Cloudflare Access login HTML. The script exits with code `0` and prints
  `DEPLOY_CF_C_ACCESS_SMOKE_PASS`.

## What this phase does NOT change

- ❌ No code changes to server routes
- ❌ No changes to `/api/generate` (still owned by Launch Guard)
- ❌ No changes to audio storage, quota, or audit log
- ❌ No new tags, no tag movement
- ❌ No Cloudflare token is committed or output by this phase
- ❌ No call to `/api/generate` during this phase
- ❌ No music generated during this phase

## Verification (2026-06-10)

The Cloudflare Dashboard application `MMX Music Studio Ops` was configured by the operator
against the recommendations above. The smoke test then went from `PENDING` → `PASS`:

| Check | Method | Expected | Observed |
| --- | --- | --- | --- |
| `GET /` (public) | `curl -I` | `HTTP/2 200` | `HTTP/2 200` ✅ |
| `GET /library` (public) | `curl -I` | `HTTP/2 200` | `HTTP/2 200` ✅ |
| `GET /api/health` (public) | `curl -I` | `HTTP/2 200` + JSON `ok:true` | `HTTP/2 200` + `application/json` ✅ |
| `GET /ops` (protected) | `curl -I` | `302` to Cloudflare Access login | `HTTP/2 302`, `Location: https://soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/music.conanxin.com?...&redirect_url=%2Fops`, `www-authenticate: Cloudflare-Access` ✅ |
| `GET /api/status` (protected) | `curl -I` | `302` to Cloudflare Access login | `HTTP/2 302`, `Location: https://soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/music.conanxin.com?...&redirect_url=%2Fapi%2Fstatus`, `www-authenticate: Cloudflare-Access` ✅ |

`bash scripts/deploy-cf-c-access-smoke-test.sh` → `DEPLOY_CF_C_ACCESS_SMOKE_PASS` (12/12 PASS, exit 0).

Both protected responses carry the Cloudflare Access signatures:

- `set-cookie: CF_AppSession=...` (Cloudflare session cookie issued for the protected resource)
- `www-authenticate: Cloudflare-Access resource_metadata="https://music.conanxin.com/.well-known/cloudflare-access-protected-resource/..."` (RFC 8617 resource metadata hint)
- `cache-control: private, max-age=0, no-store, no-cache, must-revalidate` (no caching of the Access challenge)

Public paths remained completely untouched by Access; their response headers do **not** include
any of the above Access signatures.

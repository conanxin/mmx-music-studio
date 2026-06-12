# mmx-music-studio v0.4.31-alpha

## What is this release?

This release promotes the Deploy-CF-E frontend Turnstile widget runtime work into the public alpha release line.

Deploy-CF-E adds frontend Cloudflare Turnstile widget runtime integration for BYOK. The browser can now obtain a verification token and submit it with `POST /api/generate/byok`. The server-side Turnstile gate from Deploy-CF-D (v0.4.30-alpha) is kept intact as the source of truth.

**This is not a broad public BYOK launch.**

## Highlights

- Added frontend Cloudflare Turnstile widget runtime integration in `ByokPanel.tsx`:
  - Dynamically loads `https://challenges.cloudflare.com/turnstile/v0/api.js` (idempotent loader, no double-injection under React strict mode / re-mount).
  - Renders a per-instance widget via `window.turnstile.render(...)` into a dedicated container.
  - Handles `callback` (success), `'expired-callback'`, and `'error-callback'` lifecycles.
  - Sends `turnstileToken` with `/api/generate/byok` only when the panel is enabled and a fresh token is present.
  - Resets the widget and clears the token after submit to avoid token reuse (single-use enforcement).
  - Submit-time guard: when `turnstileByokRequired === true` and no fresh token is present, the submit button is blocked with a "complete Turnstile first" message.
- `Studio.tsx` now passes the Turnstile fields from `healthInfo` (fetched from `/api/health`) into `<ByokPanel />`:
  - `turnstileSiteKey`
  - `turnstileByokRequired`
  - `turnstileSecretKeyConfigured`
- `/api/health` exposes the public `turnstileSiteKey` (in addition to the booleans added in v0.4.30-alpha). The `TURNSTILE_SECRET_KEY` is **never** returned.
- Server-side `Siteverify` gate from Deploy-CF-D is unchanged and remains the source of truth.
- `TURNSTILE_BYOK_REQUIRED=false` by default — non-blocking.
- New smoke test: `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — **23/23 PASS** (script URL, callback names, state machine, single-use reset, no token in `localStorage` / `sessionStorage` / IndexedDB / URL query, no raw token displayed, no `TURNSTILE_SECRET_KEY` reference in front-end, type exposure, prop wiring, health exposure, no broad public BYOK launch, no MiniMax live call, no music generation).

## Safety and Privacy

Token handling guarantees:

- Token is **never** written to `localStorage` / `sessionStorage` / IndexedDB / URL query.
- Token is **never** rendered in the DOM and is **never** `console.log`'d.
- Front-end does not import or reference `TURNSTILE_SECRET_KEY`.
- Token lives only in React `useState<string>` + `useRef` and is reset after every submit.

This release does not include:

- Turnstile secret in repo
- user API keys
- Authorization headers
- raw provider responses
- audio files
- runtime storage
- logs
- tsconfig.tsbuildinfo
- `/api/generate` calls
- real MiniMax live calls
- music generation

No new live call was executed.
No music was generated.

## Important Status

| Item | Status |
|---|---|
| BYOK direct live path | verified once (v0.4.29-alpha) |
| Server-side Turnstile gate (Deploy-CF-D) | implemented, default non-blocking |
| Frontend Turnstile widget runtime (Deploy-CF-E) | implemented, default non-blocking |
| Broad public BYOK launch | **not enabled** |
| Default mode | disabled / dry-run |
| Real Turnstile site/secret keys configured | **no** |
| valid-token E2E verification | **deferred** — requires v0.4.31-alpha deployed to production with real keys |
| Recommended next phase | Deploy v0.4.31-alpha to production → valid-token E2E verification → BYOK-H public launch planning only after E2E PASS |

## Environment Variables

```bash
# Turnstile site key (visible to frontend, safe to expose)
TURNSTILE_SITE_KEY=1x00000000000000000000AA

# Turnstile secret key (server-side only, NEVER commit)
TURNSTILE_SECRET_KEY=***

# Whether Turnstile is enforced for /api/generate/byok
# Default: false — non-blocking until operator explicitly enables
TURNSTILE_BYOK_REQUIRED=false
```

## Files Added / Modified

- `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` — Deploy-CF-E section + "Valid-token E2E requires production deploy" note
- `server/index.ts` — `/api/health` now also returns the public `turnstileSiteKey` (booleans from v0.4.30-alpha remain)
- `src/lib/serverApi.ts` — `HealthInfo` type extended with `turnstileSiteKey?: string` + boolean flags
- `src/features/studio/Studio.tsx` — passes Turnstile fields into `<ByokPanel />` + extends local `healthInfo` type literal
- `src/features/studio/ByokPanel.tsx` — full rewrite with idempotent dynamic script loader, `window.turnstile.render(...)`, single-use token reset, and submit-time guard
- `src/features/studio/ByokPanel.module.css` — widget container, state badge (loading/ready/verified/expired/error), mobile overflow protection (≤639px)
- `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — **23/23 PASS**
- `README.md` — Deploy-CF-E row added to current release table
- `docs/DEVELOPMENT_HANDOFF.md` — Deploy-CF-E entry added (file list, key principles, E2E gate, next steps)
- `docs/PUBLIC_RELEASE_READINESS.md` — bumped to v0.4.31-alpha with Deploy-CF-E status block + v0.4.31-alpha release notes row

## Verification

| Check | Result |
|---|---|
| Deploy-CF-E smoke | 23/23 PASS |
| Deploy-CF-D smoke | 21/21 PASS (no regression) |
| BYOK A-G smoke | all PASS |
| Storage A/B smoke | all PASS |
| Product Polish H-P smoke | all PASS |
| Deploy-CF-C / Ops / Launch / systemd / README / API smoke | all PASS |
| typecheck:server | PASS |
| typecheck | PASS |
| build | PASS |
| weapp:build | PASS |
| Secret scan | CLEAN |

## Remaining Work

- Valid-token E2E verification is **deferred** until this release is deployed to production with real Turnstile site/secret keys configured outside the repository.
- BYOK-H small public launch planning is **blocked** until valid-token E2E verification passes on production.

## Final Wording

> Deploy-CF-E adds frontend Turnstile widget runtime integration for BYOK. It does not enable broad public BYOK launch by itself. No new live call was executed. No music was generated. No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed.

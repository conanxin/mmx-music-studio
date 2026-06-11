# mmx-music-studio v0.4.30-alpha

## What is this release?

This release promotes the Deploy-CF-D Turnstile gate work into the public alpha release line.

Deploy-CF-D adds a server-side Turnstile gate for BYOK generation.

**This is not a broad public BYOK launch.**

## Highlights

- Server-side Turnstile verification for `/api/generate/byok`.
- `server/security/turnstile.ts` implements `verifyTurnstileToken()` with:
  - POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  - Timeout handling
  - Redacted error details (no secret, no raw response)
  - Graceful degradation when secret is not configured
- `/api/generate/byok` gate:
  - Requires `turnstileToken` in request body when `TURNSTILE_BYOK_REQUIRED=true`
  - Returns `turnstile_required` / `turnstile_invalid` / `turnstile_verification_error` on failure
  - Gate sits before any live/direct path
- `/api/health` exposes Turnstile configuration status (boolean only, never the secret):
  - `turnstileByokRequired`
  - `turnstileSecretKeyConfigured`
  - `turnstileSiteKeyConfigured`
- ByokPanel UI:
  - Turnstile placeholder skeleton added
  - Token state is not persisted to localStorage / sessionStorage / URL
- `TURNSTILE_BYOK_REQUIRED=false` by default — gate is present but non-blocking.

## Safety and Privacy

This release does not include:

- Turnstile secret in repo
- user API keys
- Authorization headers
- raw provider responses
- audio files
- runtime storage
- logs
- tsconfig.tsbuildinfo

No new live call was executed.
No music was generated.

## Important Status

| Item | Status |
|---|---|
| BYOK direct live path | verified once (v0.4.29-alpha) |
| Turnstile gate | implemented, default non-blocking |
| Broad public BYOK launch | **not enabled** |
| Default mode | disabled / dry-run |
| Real Turnstile keys configured | **no** |
| Recommended next phase | Configure real Turnstile site/secret keys outside repo → BYOK-H public launch |

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

- `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` — design doc
- `server/security/turnstile.ts` — Siteverify helper (new)
- `server/types.ts` — Turnstile config fields
- `server/index.ts` — Turnstile gate in `/api/generate/byok` + health exposure
- `src/features/studio/ByokPanel.tsx` — Turnstile UI skeleton
- `src/features/studio/ByokPanel.module.css` — Turnstile placeholder styles
- `scripts/deploy-cf-d-turnstile-smoke-test.sh` — 21/21 PASS

## Verification

| Check | Result |
|---|---|
| Deploy-CF-D smoke | 21/21 PASS |
| BYOK A-G smoke | all PASS |
| Storage A/B smoke | all PASS |
| Product Polish H-P smoke | all PASS |
| Deploy-CF-C/Ops/Launch/systemd/README/API smoke | all PASS |
| typecheck:server | PASS |
| typecheck | PASS |
| build | PASS |
| weapp:build | PASS |
| Secret scan | CLEAN |

## Final Wording

> Deploy-CF-D adds a server-side Turnstile gate for BYOK generation. It does not enable broad public BYOK launch by itself. No new live call was executed. No music was generated. No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed.

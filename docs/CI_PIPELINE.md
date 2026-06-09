# CI Pipeline

## Purpose

GitHub Actions CI protects the stable Web CLI main path and BYOK safety work from regressions. Every push to `master`/`main` and every pull request automatically runs the full verification suite before changes can be merged.

CI is **safe by default** — it never calls real MiniMax APIs, never generates music, and needs no secrets to run.

---

## What CI runs

### Static checks job (`static`)

| Step | Command | What it checks |
|---|---|---|
| Typecheck server | `npm run typecheck:server` | Server TypeScript compiles |
| Typecheck web | `npm run typecheck` | Frontend TypeScript compiles |
| Typecheck weapp | `npm run weapp:typecheck` | WeChat Mini Program TypeScript compiles |
| Build web | `npm run build` | Vite production build succeeds |
| Build weapp | `npm run weapp:build` | WeApp production build succeeds |
| Manifest audit | `npm run manifest:audit` | All tracks have consistent metadata |
| Release check | `npm run release:check` | Release readiness checks |
| Studio CLI submit guard | `bash scripts/studio-cli-submit-guard-smoke-test.sh` | Studio submit guard logic is correct |
| Audio duration display | `bash scripts/audio-duration-display-smoke-test.sh` | No `?:??` hardcoding, metadata reads work |
| WeApp BYOK strategy | `bash scripts/weapp-byok-strategy-smoke-test.sh` | WeApp BYOK adapter is memory-only |
| Secret scan | `grep …` | No real API keys / tokens / PINs committed |

### Server-dependent smoke tests job (`smoke-server`)

| Step | Command | What it checks |
|---|---|---|
| Studio hydration smoke | `bash scripts/studio-initial-player-hydration-smoke-test.sh` | Studio hydrates player from latest track on mount |
| Studio handoff smoke | `bash scripts/studio-player-handoff-smoke-test.sh` | Studio passes track audio/download URL after generation |
| BYOK mode smoke | `bash scripts/byok-mode-smoke-test.sh` | BYOK mode, session key, fallback logic |
| Real API attempt guard smoke | `bash scripts/real-api-attempt-guard-smoke-test.sh` | Guard blocks API calls when limit=0 |

---

## What CI does NOT run

- ❌ No `mmx music generate`
- ❌ No `mmx music cover`
- ❌ No real MiniMax API call
- ❌ No BYOK real API generation
- ❌ No production server dependency (each smoke test starts its own server)
- ❌ No generated audio fixture requirement
- ❌ No secrets required — CI runs with `MOCK_GENERATION_ENABLED=true` or `REAL_API_DAILY_ATTEMPT_LIMIT=0`

---

## Safety model

CI smoke tests are designed to be safe:

- **`studio-initial-player-hydration-smoke-test.sh`** — Starts its own mock server. The static code checks (grep `listTracks`, `useEffect`, `setCurrentTrack`) always run. The `/api/tracks` API checks run against the local mock server.
- **`studio-player-handoff-smoke-test.sh`** — Uses pre-existing track IDs from `storage/tracks/` that are already committed (read-only fixture).
- **`byok-mode-smoke-test.sh`** — Starts its own BYOK-mode servers on dynamically chosen ports. Uses `MOCK_GENERATION_ENABLED=true`. No real generation.
- **`real-api-attempt-guard-smoke-test.sh`** — Uses `REAL_API_DAILY_ATTEMPT_LIMIT=0` so the guard blocks before any network call. The test verifies the guard logic, not the API.

---

## How to view CI results

Open: https://github.com/conanxin/mmx-music-studio/actions

Or with `gh` CLI (if logged in):
```bash
gh run list --workflow=CI --limit=3
```

When CI fails, check the failed step's log output first. The most common failures:

1. **TypeScript error** → check `npm run typecheck` output
2. **Build error** → check `npm run build` output
3. **Smoke test failure** → read the step's shell output for `[FAIL]` markers
4. **Secret scan failure** → the filtered matches are printed — confirm they are all documentation examples

---

## Future improvements

- [ ] Add matrix for multiple Node.js versions (18, 20, 22)
- [ ] Add artifact upload (build.zip)
- [ ] Add Docker build check
- [ ] Add optional manual real-generation workflow, gated by an explicit confirmation input
- [ ] Add `studio-cli-submit-guard-smoke-test.sh` and `weapp-byok-strategy-smoke-test.sh` to the `smoke-server` job if they gain server-dependent checks in the future
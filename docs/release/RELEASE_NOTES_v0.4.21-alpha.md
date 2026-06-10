# mmx-music-studio v0.4.21-alpha

## What is this release?

This release closes out the public alpha operations layer by adding **verified Cloudflare Access protection for Ops routes** and a **validated automatic GitHub Release workflow**.

The app is now easier to operate publicly: `/ops` and `/api/status` are protected by Cloudflare Access at the edge, while public user-facing pages remain available. Future releases can also be published automatically by pushing a version tag — no manual GitHub UI work required.

---

## Highlights

### Verified Cloudflare Access protection for Ops routes

- Added an Access application `MMX Music Studio Ops` (self-hosted) in the Cloudflare Zero Trust Dashboard.
- Protected paths (operator email only):
  - `/ops`
  - `/ops/*`
  - `/api/status`
  - `/api/debug/*`
- Public paths remain available (no Access challenge):
  - `/`
  - `/library`
  - `/studio`
  - `/api/health` (uptime check depends on this)
- `/api/generate` remains public-alpha accessible but is protected by the **server-side Launch Guard** (per-source daily limit, generation cooldown, global pause). It is intentionally **not** moved into Access to keep the generation latency profile unchanged.
- Live evidence: `curl -I https://music.conanxin.com/ops` returns `HTTP 302` with `Location: https://soft-wood-f891.cloudflareaccess.com/cdn-cgi/access/login/...`, `www-authenticate: Cloudflare-Access`, and `set-cookie: CF_AppSession=...`.

### Cloudflare Access smoke test

- Added `scripts/deploy-cf-c-access-smoke-test.sh` (12 static + live checks):
  - Documentation exists
  - README / handoff / readiness all reflect the new policy
  - Public paths return HTTP 200
  - Protected paths return Cloudflare Access challenge (302 / 401 / 403 / login HTML)
- Returns `DEPLOY_CF_C_ACCESS_PENDING` (exit 2) when the Access application is disabled.
- Returns `DEPLOY_CF_C_ACCESS_SMOKE_PASS` (exit 0) when the application is enabled and enforced.
- Current state: **12/12 PASS, exit 0**.

### Automatic GitHub Release workflow

- Added `.github/workflows/release.yml`:
  - **Tag push trigger** — pushing `v*` automatically creates the release.
  - **workflow_dispatch trigger** — manually backfill a previous tag with a release.
  - Checks out the tag, validates release notes, builds a `git archive` source zip, runs a safety check, and uploads the asset.
- Uses the built-in `${{ github.token }}` (no PAT secret required).
- Permissions are explicitly scoped to `contents: write`.
- Backfilled recent GitHub Releases:
  - `v0.4.18-alpha`
  - `v0.4.19-alpha`
  - `v0.4.20-alpha`

### Updated documentation

- New: `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` — operator policy, recommended application, rollback, verification table.
- Updated: `docs/OPS_MONITORING.md` — Cloudflare Access protection section.
- Updated: `docs/PUBLIC_RELEASE_READINESS.md` — Cloudflare Access row flipped from pending to enabled.
- Updated: `docs/DEVELOPMENT_HANDOFF.md` — Deploy-CF-C row flipped to ✅; release-line bumped.
- Updated: `README.md` — Phase badge updated, Product Polish entry for Deploy-CF-C now reads "verified".

---

## Current runtime

| Component | Value |
| --- | --- |
| Public URL | https://music.conanxin.com |
| Backend | `cli` (MiniMax CLI; future-byo[k] extensible) |
| Library | https://music.conanxin.com/library |
| Studio | https://music.conanxin.com/studio |
| Ops panel | https://music.conanxin.com/ops (Cloudflare Access) |
| Status endpoint | https://music.conanxin.com/api/status (Cloudflare Access) |
| Health endpoint | https://music.conanxin.com/api/health (public) |

### Launch Guard status (verified 2026-06-10)

| Field | Value |
| --- | --- |
| `enabled` | `true` |
| `publicGenerationEnabled` | `true` |
| `perSourceDailyLimit` | `5` |
| `generationCooldownSeconds` | `30` |
| Global pause | `false` |

---

## Release automation

| Capability | Status |
| --- | --- |
| `.github/workflows/release.yml` exists | ✅ |
| Tag push trigger | ✅ (`v*`) |
| `workflow_dispatch` trigger | ✅ (manual backfill) |
| `permissions: contents: write` | ✅ |
| Built-in `${{ github.token }}` | ✅ (no PAT) |
| Release notes validation | ✅ |
| `git archive` source zip | ✅ |
| Zip safety check | ✅ (skips dir entries; allows `.gitkeep`; bans runtime/audio/env) |
| `gh release upload --clobber` for re-runs | ✅ |
| `gh release create --verify-tag` for first run | ✅ |

### Verified runs

| Run | Tag | Result |
| --- | --- | --- |
| 27276654557 | v0.4.20-alpha | success (after fix) |
| 27276562908 | v0.4.20-alpha | failure (dir entries bug) → fixed in commit `72d2e49` |
| 27276921039 | v0.4.19-alpha | success |
| 27276962771 | v0.4.18-alpha | success |

3 / 3 backfill runs PASS after one fix iteration.

---

## Safety model

The Cloudflare Access application does not appear in code. It is configured in the Cloudflare Zero Trust Dashboard and can be deleted or disabled without any code change.

The release workflow does not include:

- `.env`
- Runtime storage
- Real audio files (`*.mp3`, `*.wav`, `*.flac`, `*.m4a`)
- Launch Guard runtime state (`storage/guard/public-generation-guard.json`)
- API keys or tokens
- Logs

`.gitkeep` placeholders inside `storage/*/` are allowed and intentional.

---

## Notes

- **No music was generated for this release.**
- **No `/api/generate` request was made during validation.**
- No Cloudflare token is stored in the repository.
- No server schema migration.
- This remains a public alpha.

---

## Known limitations

- Cloudflare Access configuration is managed in the Cloudflare Dashboard, not in code. A future `Phase Deploy-CF-D` could move the policy into Terraform / API-driven config.
- `/api/generate` is still publicly reachable and protected by Launch Guard rather than Access. This avoids double-layer auth at the edge and preserves the current latency profile for public users.
- No account system.
- No per-user private Library.
- The CLI backend is the recommended alpha path; the API backend remains experimental.

---

## Upgrade notes

No code migration is required. Existing deployments should:

1. Pull the new tag `v0.4.21-alpha` (or `master`).
2. Re-run the smoke tests:
   - `bash scripts/deploy-cf-c-access-smoke-test.sh` → `DEPLOY_CF_C_ACCESS_SMOKE_PASS`
   - `bash scripts/readme-render-smoke-test.sh` → `README_RENDER_SMOKE_PASS`
3. If you operate the production deployment, confirm that the Cloudflare Access application `MMX Music Studio Ops` is still enabled and the policy still lists your operator email.
4. No restart is required for the application server.

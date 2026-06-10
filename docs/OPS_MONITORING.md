# Ops Monitoring — mmx-music-studio

> 文档版本：v0.4.21-alpha · 2026-06-10

## Cloudflare Access protection (Phase Deploy-CF-C)

> Operator-only paths are protected by **Cloudflare Access** at the edge.
> Cloudflare Access is configured in the Cloudflare Dashboard (Zero Trust → Access),
> not in application code. Rollback is a single Dashboard toggle; no code change is required.

| Path | Exposure | Owner |
| --- | --- | --- |
| `/ops`, `/ops/*` | **Cloudflare Access** — operator email only | Dashboard (Phase Deploy-CF-C) |
| `/api/status` | **Cloudflare Access** — operator email only | Dashboard (Phase Deploy-CF-C) |
| `/api/debug/*` | **Cloudflare Access** — operator email only | Dashboard (Phase Deploy-CF-C) |
| `/api/health` | Public (uptime checks must remain unauthenticated) | — |
| `/` | Public | — |
| `/library` | Public | — |
| `/studio` | Public | — |
| `/api/generate` | Server-side **Launch Guard** (NOT moved to Access) | Phase Launch Guard-A |

Full configuration reference: [`docs/deploy/CLOUDFLARE_ACCESS_OPS.md`](deploy/CLOUDFLARE_ACCESS_OPS.md).

> The Access smoke test (`scripts/deploy-cf-c-access-smoke-test.sh`) returns
> `DEPLOY_CF_C_ACCESS_PENDING` until the Dashboard application is enabled,
> and `DEPLOY_CF_C_ACCESS_SMOKE_PASS` afterwards. This is by design.
>
> **Current state (2026-06-10):** `DEPLOY_CF_C_ACCESS_SMOKE_PASS` — Dashboard
> application `MMX Music Studio Ops` enabled, `/ops` and `/api/status` return
> `302` to the Cloudflare Access login interstitial, public paths unaffected.
> See [`docs/deploy/CLOUDFLARE_ACCESS_OPS.md`](deploy/CLOUDFLARE_ACCESS_OPS.md)
> for the verification table.

## Public endpoints

### GET /api/health

Public-safe service health check. Returns current service state, backend mode, launch guard settings, job queue status, and auth guard stats.

**What is exposed:**
- `ok`, `service`, `phase`
- `backend` (current mode: `mock`, `api`, or `cli`)
- `realGenerationEnabled`, `mockGenerationEnabled`
- Launch Guard fields: `launchGuardEnabled`, `publicGenerationEnabled`, `perSourceDailyLimit`, `generationCooldownSeconds`
- Job queue: `jobQueueEnabled`, `queuedJobs`, `workerBusy`
- Auth guard: `authGuardEnabled`, `authGuard.trackedClients`, `authGuard.lockedClients`
- Daily quota: `dailyQuotaEnabled`, `remainingDailyGenerations`
- Real API attempt guard: `realApiAttemptLimitEnabled`, `remainingRealApiAttempts`

**What is NOT exposed:**
- Raw IP addresses
- Source hashes
- API keys or tokens
- Authorization headers
- Prompts or generation input
- Full filesystem paths
- Raw audit logs

### GET /api/status

Public-safe runtime status summary. Returns job queue aggregate and storage aggregate alongside backend and launch guard summary.

**What is exposed:**
- `ok`, `service`, `timestamp`
- `runtimeStatus.backend` (current, realGenerationEnabled, mockGenerationEnabled)
- `runtimeStatus.launchGuard` (enabled, publicGenerationEnabled, perSourceDailyLimit, generationCooldownSeconds)
- `runtimeStatus.jobQueue` (enabled, pending, running, succeeded, failed)
- `runtimeStatus.storage` (trackCount, audioFileCount, approxAudioBytes, readable)

**What is NOT exposed:**
- Raw IP addresses
- Source hashes
- API keys or tokens
- Authorization headers
- Prompts or generation input
- Full filesystem paths
- Raw audit logs

---

## Useful commands

### Service status

```bash
sudo systemctl status mmx-music-studio --no-pager
```

### Recent logs

```bash
journalctl -u mmx-music-studio -n 120 --no-pager
```

### Health check (local)

```bash
curl -s http://127.0.0.1:8787/api/health | python3 -m json.tool
```

### Health check (public)

```bash
curl -s https://music.conanxin.com/api/health | python3 -m json.tool
```

### Runtime status (public)

```bash
curl -s https://music.conanxin.com/api/status | python3 -m json.tool
```

### systemd smoke test

```bash
bash scripts/systemd-service-smoke-test.sh
```

### Ops monitoring smoke test

```bash
bash scripts/ops-monitor-a-smoke-test.sh
```

### Storage management (Phase Storage-A)

```bash
# Current inventory: track count, audio count, orphan/missing counts
bash scripts/storage-a-inventory-report.sh

# Retention dry-run: candidate count + reclaimable bytes (no files deleted)
RETENTION_DAYS=90 bash scripts/storage-a-retention-dry-run.sh

# Backup manifest snapshot (stdout, safe to store externally)
bash scripts/storage-a-backup-manifest.sh
```

### Storage operator-confirmed cleanup (Phase Storage-B0)

**B0 is dry-run + safety design only.** No file is ever deleted by B0. A future
phase (Storage-B1) will require a human operator to confirm a B0 manifest
before any deletion path becomes available.

```bash
# Read-only dry-run: emits a JSON manifest with sha256 + paths
# plus a "destructive: false" footer. The script never modifies anything.
bash scripts/storage-b-operator-cleanup-dry-run.sh

# Optional flags (both default-safe)
bash scripts/storage-b-operator-cleanup-dry-run.sh --retention-days 30
bash scripts/storage-b-operator-cleanup-dry-run.sh --json /tmp/storage-b-dry-run.json

# Confirmation guard: rejects unless STORAGE_B_CONFIRMATION is set
# to the exact required phrase. The guard itself does NOT delete.
STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP bash scripts/storage-b-confirmation-guard.sh
# exits 0 → confirmation accepted (still no deletion in B0)
# exits non-zero → confirmation missing or rejected

# B0 smoke test (55/55 PASS expectations)
bash scripts/storage-b-smoke-test.sh
```

Required confirmation phrase for any future B1 action:
`CONFIRM_STORAGE_B_CLEANUP` (must be passed via `STORAGE_B_CONFIRMATION`
environment variable; not a CLI argument).

The B0 manifest reports: `orphanAudio`, `orphanMetadata`, `missingAudioRefs`,
`oldTrackCandidates` (only if `--retention-days` is provided), and
`estimatedReclaimableBytes`. **B0 reports but does not act.**

### Ops panel (Phase Ops-Monitor-B)

The public alpha includes a read-only operations panel at `/ops`.

It summarizes:
- Service status: public URL, backend mode, generation flags
- Launch Guard state: enabled/disabled, per-source limits, cooldown
- Job queue aggregates: pending, running, succeeded, failed
- Storage aggregates: track count, audio count, approximate bytes
- Release information: current version, GitHub links

The panel does NOT expose:
- Raw IP addresses, source hashes, prompts, API keys, tokens, raw logs, or absolute runtime paths

The panel does NOT perform:
- Generation, cleanup, deletion, reset, or restart

Access: navigate to `https://music.conanxin.com/ops` or click "运维" in the navigation bar.

---

## Public alpha checklist

Use these to quickly assess the public deployment:

- [ ] Service is `active (running)`
- [ ] `backend` is `cli` (recommended)
- [ ] Launch Guard fields visible in `/api/health`
- [ ] `launchGuardEnabled: true`
- [ ] `publicGenerationEnabled: true` (or intentionally paused)
- [ ] `jobQueueEnabled: true`
- [ ] `storage.readable: true`
- [ ] Secret scan is clean (`python3 scripts/ci-secret-scan.py`)
- [ ] No runtime guard state committed to git
- [ ] `/api/status` returns `runtimeStatus` with job queue and storage aggregates
- [ ] No storage cleanup scripts are run automatically (operator-driven only)

---

## Architecture notes

- Job queue: in-memory with JSON persistence to `storage/jobs/jobs.json`
- Track metadata: `storage/tracks/manifest.json`
- Guard state: `storage/guard/public-generation-guard.json` (SHA256 source hashes, not raw IPs)
- Audit logs: `storage/audit/YYYY-MM-DD.jsonl`
- All runtime state paths are relative to the project root — never exposed in API responses

## Known limitations

- No real-time alerting (ops monitoring is read-only diagnostics)
- No per-user breakdown (ops data is aggregate only)
- Storage stats are point-in-time snapshots (no streaming updates)
- Cloudflare Access is not enabled — this is a public alpha deployment
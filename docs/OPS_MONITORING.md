# Ops Monitoring — mmx-music-studio

> 文档版本：v0.4.14-alpha · 2026-06-10

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
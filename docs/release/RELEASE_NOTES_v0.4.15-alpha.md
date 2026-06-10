# mmx-music-studio v0.4.15-alpha

**Public runtime diagnostics release** · 2026-06-10

---

## What is this release?

This release adds public-safe runtime diagnostics for the public alpha deployment.

The app now exposes a read-only runtime status endpoint (`GET /api/status`) that helps maintainers understand whether the service is healthy without exposing sensitive runtime data. No generation is performed.

---

## Highlights

### Added `server/runtime-status.ts`

New module that aggregates runtime telemetry from existing subsystems:

- `getStorageAggregate()` — walks `storage/tracks/`, reads metadata per track, returns counts and approximate byte totals
- `getJobQueueAggregate()` — wraps `getJobStats()` (pending/running/succeeded/failed)
- `buildRuntimeStatusSummary()` — assembles backend + launchGuard + jobQueue + storage into a single public-safe response

### Added `GET /api/status`

New public endpoint. Returns `runtimeStatus` with four sub-sections:

```
runtimeStatus:
  backend:        { current, realGenerationEnabled, mockGenerationEnabled }
  launchGuard:   { enabled, publicGenerationEnabled, perSourceDailyLimit, generationCooldownSeconds }
  jobQueue:      { enabled, pending, running, succeeded, failed }
  storage:       { trackCount, audioFileCount, approxAudioBytes, readable }
```

Designed to avoid exposing: raw IP addresses, source hashes, API keys, user prompts, raw logs, absolute filesystem paths, raw runtime storage files.

### Added `docs/OPS_MONITORING.md`

Ops monitoring guide covering:

- `/api/health` vs `/api/status` — what each exposes
- Public-safe exposure matrix
- `curl` commands for manual checks
- Public ops checklist

### Added `scripts/ops-monitor-a-smoke-test.sh`

27 assertions covering: module existence, route registration, function exports, `/api/status` response shape, field safety, docs existence, smoke test coverage.

### Updated Home Trust copy

Home.tsx "生成保护" Trust card now includes:

> 运行状态可通过健康检查与公开状态摘要观察。

---

## Current Runtime

| Item | Value |
|------|-------|
| Public URL | https://music.conanxin.com |
| Backend | `cli` (MMX CLI — recommended default) |
| systemd service | `active` |
| Cloudflare Tunnel | active |
| Launch Guard | enabled — global pause + per-source daily limit + cooldown |

---

## Public Safety Model

`GET /api/status` is designed not to expose:

- Raw IP addresses
- Source hashes
- API keys or tokens
- User prompts
- Raw logs
- Absolute filesystem paths
- Raw runtime storage files

---

## Notes

- No music was generated for this release
- No `/api/generate` request was made during validation
- This release adds observability, not a full admin dashboard or alerting system
- CLI backend remains the recommended default path

---

## Known Limitations

- No authenticated admin dashboard yet
- No alerting yet
- No retention/cleanup policy for storage tracks
- No Cloudflare Access yet

---

## Next Recommended Phases

- **Phase Storage-A** — storage management and cleanup
- **Phase Deploy-CF-C** (optional) — Cloudflare Access
- **Phase Ops-Monitor-B** (optional) — admin diagnostics (authenticated)
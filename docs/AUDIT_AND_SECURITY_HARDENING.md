# Audit Logging and Security Hardening

> Phase 4F Documentation · mmx-music-studio  
> Last updated: Phase 4F

---

## Why Audit Logging?

When exposing mmx-music-studio to the internet for real generation, MiniMax API credits are consumed on every request. Audit logging provides visibility into:

- Who is attempting to unlock generation access
- When and why generation requests are blocked
- Job lifecycle events (created, deleted, retried)
- Track access patterns

This is essential for operating a shared or public deployment responsibly.

---

## Audit Events

The following events are recorded to `storage/audit/audit.jsonl`:

| Event Type | Trigger | Severity |
|------------|---------|----------|
| `unlock_success` | Correct PIN entered for preview/generation access | INFO |
| `unlock_failed` | Wrong PIN entered | WARN |
| `unlock_locked` | Request blocked by auth guard (brute-force protection) | WARN |
| `generation_requested` | New generation job created | INFO |
| `generation_blocked_by_access` | Generation request without valid access cookie | WARN |
| `generation_blocked_by_rate_limit` | Generation request rate-limited | WARN |
| `generation_blocked_by_daily_quota` | Daily generation quota exhausted | WARN |
| `job_cancelled` | Job cancelled by user | INFO |
| `job_deleted` | Job deleted by user | INFO |
| `job_retried` | Job retried by user | INFO |
| `track_audio_accessed` | Audio stream accessed | INFO |
| `track_downloaded` | Track file downloaded | INFO |

---

## What Is Stored

Each audit event records:

```json
{
  "id": "evt_01J...",
  "type": "generation_blocked_by_access",
  "createdAt": "2026-06-09T12:00:00.000Z",
  "requestId": "req_01J...",
  "route": "/api/generation-access/unlock",
  "status": 403,
  "message": "生成访问保护未开启",
  "metadata": {
    "generationAccessEnabled": false,
    "hasAccessCookie": false
  }
}
```

**`clientHash`**: A SHA256 hash of the client IP combined with a server-side salt. The original IP is never stored.

**`userAgentHash`**: Truncated first 200 characters of the User-Agent string (not a hash — for debugging only).

---

## What Is Never Stored

The following are explicitly **excluded** from audit logs:

- PIN (plaintext or hashed)
- API key (`MINIMAX_API_KEY`)
- Authorization header values
- Raw cookie values
- Signed URLs containing tokens
- Raw client IP addresses
- Full prompts (prompt length is stored as `metadata.promptLength`)
- Bearer tokens

---

## PIN Brute-Force Protection

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_GUARD_ENABLED` | `true` | Enable/disable auth guard |
| `AUTH_GUARD_WINDOW_MS` | `300000` | Time window (5 minutes) |
| `AUTH_GUARD_MAX_FAILURES` | `5` | Max failed attempts in window before lockout |
| `AUTH_GUARD_LOCK_MS` | `900000` | Lockout duration (15 minutes) |

### Behavior

1. Each failed unlock attempt is recorded per client IP hash
2. After `AUTH_GUARD_MAX_FAILURES` failures in `AUTH_GUARD_WINDOW_MS`, the client is locked for `AUTH_GUARD_LOCK_MS`
3. Locked clients receive HTTP 429 with `Retry-After` header
4. Successful unlock clears the failure counter for that client
5. Auth guard operates **in-memory only** — failure counts reset on server restart

### Response When Locked

```json
{
  "ok": false,
  "message": "尝试次数过多，请 15 分钟后再试"
}
```

### Limitations

- No persistent storage — counts reset on restart
- No per-endpoint granularity (all unlock endpoints share the same counter)
- Single-server only — distributed deployments need Redis

### Future: Redis Integration

For production multi-instance deployments, replace the in-memory map with Redis:

```ts
// Future: Redis-backed auth guard
const redis = await createRedisClient();
await redis.incr(`authguard:failures:${clientHash}`);
const failures = await redis.get(`authguard:failures:${clientHash}`);
```

---

## API Endpoints

### `GET /api/audit/stats`

Returns aggregated audit event counts and auth guard status.

**Requires**: Preview access (if `PREVIEW_ACCESS_ENABLED=true`)

**Response**:
```json
{
  "ok": true,
  "stats": {
    "total": 47,
    "unlockFailed": 3,
    "unlockSuccess": 12,
    "unlockLocked": 1,
    "generationBlocked": 5,
    "generationRequested": 8,
    "jobDeleted": 2,
    "jobRetried": 1,
    "jobCreated": 8
  },
  "authGuard": {
    "enabled": true,
    "windowMs": 300000,
    "maxFailures": 5,
    "lockMs": 900000,
    "trackedClients": 3,
    "lockedClients": 0
  }
}
```

### `GET /api/audit/events`

Returns paginated audit events.

**Query parameters**:
- `type` — Filter by event type (e.g., `unlockFailed`, `generation_blocked_by_access`)
- `limit` — Max events to return (default: 50, max: 200)
- `offset` — Skip first N events (default: 0)

**Response**:
```json
{
  "ok": true,
  "events": [
    {
      "id": "evt_01J...",
      "type": "unlock_failed",
      "createdAt": "2026-06-09T12:00:00.000Z",
      "route": "/api/generation-access/unlock",
      "status": 401,
      "message": "PIN 错误"
    }
  ],
  "total": 47
}
```

**Note**: Events are returned newest-first. No raw PIN, key, or IP data is included in responses.

---

## Runtime Files

```
storage/
  audit/
    .gitkeep          ← commit this (empty marker)
    audit.jsonl       ← generated at runtime, NOT committed to git
```

The `.gitignore` entry `storage/audit/*.jsonl` ensures `audit.jsonl` is never committed.

---

## Current Limitations

| Limitation | Impact |
|------------|--------|
| In-memory auth guard | Counts reset on restart; no distributed locking |
| JSONL file storage | No query engine; sequential scan for large files |
| No log rotation | `audit.jsonl` grows indefinitely — implement logrotate in production |
| No real admin account | Settings page shows stats; no full audit log viewer UI yet |
| Single-server only | Multi-instance deployments need shared Redis |

---

## Recommended Production Checklist

Before exposing a real-generation deployment to the internet:

- [ ] `GENERATION_ACCESS_ENABLED=true` + strong PIN
- [ ] `AUTH_GUARD_ENABLED=true` (default)
- [ ] `RATE_LIMIT_ENABLED=true` (default)
- [ ] `DAILY_QUOTA_ENABLED=true` (default, adjust limit)
- [ ] `AUDIT_LOG_ENABLED=true` (default)
- [ ] Set `REAL_GENERATION_ENABLED=true` only after all above are confirmed
- [ ] Monitor `storage/audit/audit.jsonl` regularly
- [ ] Implement log rotation for `audit.jsonl`
- [ ] Consider Redis for auth guard in multi-instance deployments
- [ ] Set up alerting on `unlock_locked` events (indicates active attack)

---

## Environment Variables Summary

```bash
# Auth Guard (Phase 4F)
AUTH_GUARD_ENABLED=true
AUTH_GUARD_WINDOW_MS=300000      # 5 minutes
AUTH_GUARD_MAX_FAILURES=5
AUTH_GUARD_LOCK_MS=900000        # 15 minutes

# Audit Logging (Phase 4F)
AUDIT_LOG_ENABLED=true
AUDIT_LOG_DIR=./storage/audit
```

---

## Implementation

- `server/audit.ts` — Core audit logging system
- `server/auth-guard.ts` — PIN brute-force protection
- `server/index.ts` — Audit event emission in all relevant handlers
- `GET /api/audit/stats` — Stats endpoint
- `GET /api/audit/events` — Events listing endpoint
- `src/features/settings/Settings.tsx` — Audit stats UI in Settings page

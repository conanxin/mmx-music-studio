# Access Control and Quota Protection

**Phase:** 4C
**Status:** Implemented

---

## Why

Public deployments of mmx-music-studio can trigger real music generation via MiniMax API, which **consumes real Token Plan credits**. Without protection:

- Anyone who discovers the deployment URL can trigger generations
- Malicious actors can exhaust your quota
- Rate bursts from multiple users can trigger abuse

Phase 4C adds three layers of defense: **Generation Access Gate**, **Rate Limiting**, and **Daily Quota**.

---

## Architecture Overview

```
Client Request → Preview Access Gate → Generation Access Gate → Rate Limit → Daily Quota → Create Job
                      (Phase 2I)           (Phase 4C)           (Phase 4C)    (Phase 4C)
```

Each layer short-circuits with a specific HTTP status and error type, enabling precise frontend error messages.

---

## Preview Access Gate (Phase 2I)

| Env Var | Default | Purpose |
|---------|---------|---------|
| `PREVIEW_ACCESS_ENABLED` | `false` | Enable PIN gate for page access |
| `PREVIEW_ACCESS_PIN` | — | Shared PIN (set by operator) |

- Protects all HTML page access
- Uses HMAC-signed HttpOnly cookie (`mmx_preview_access`)
- Cookie value is NOT the PIN — it's a signed token (unforgeable without secret)
- PIN itself is never stored or returned to client
- See `server/auth.ts` for implementation

**Not a real account system** — all visitors share one PIN.

---

## Generation Access Gate (Phase 4C)

| Env Var | Default | Purpose |
|---------|---------|---------|
| `GENERATION_ACCESS_ENABLED` | `false` | Enable PIN gate for `/api/generate` |
| `GENERATION_ACCESS_PIN` | — | Shared PIN (set by operator) |
| `COOKIE_SECRET` | derived | Optional explicit cookie signing secret |

- Second gate, separate from Preview Access
- Protects `POST /api/generate`, `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/:id/cancel`
- Uses HMAC-signed HttpOnly cookie (`mmx_gen_access`)
- Same crypto mechanism as Preview Access (SHA256 HMAC)
- **PIN is never logged, stored, or returned to client**

### Unlocked State in Health API

`GET /api/health` returns `generationAccessEnabled` and `generationAccessUnlocked`. The `unlocked` field only reveals whether the current session's cookie is valid — it does **not** reveal what the PIN is.

### Frontend UX

Settings page shows:
- Status cards: generation access on/off, rate limit on/off, daily quota on/off, today's used / limit
- If locked: PIN input + "解锁真实生成" button
- If unlocked: checkmark + "退出解锁" button
- Warning if `REAL_GENERATION_ENABLED=true` but `GENERATION_ACCESS_ENABLED=false`

---

## Rate Limiting (Phase 4C)

| Env Var | Default | Purpose |
|---------|---------|---------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Time window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | `3` | Max requests per window |

- Lightweight in-memory store (Map keyed by hashed IP)
- Applied to `POST /api/generate`
- IP is SHA256-hashed before storage — real IP never logged
- In-memory; resets on server restart
- Does not count toward quota

### Error Response

```json
{
  "ok": false,
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Too many requests, please try again later.",
    "hint": "Wait 60 seconds before retrying."
  }
}
```
**HTTP 429**

---

## Daily Generation Quota (Phase 4C)

| Env Var | Default | Purpose |
|---------|---------|---------|
| `DAILY_QUOTA_ENABLED` | `true` | Enable daily quota tracking |
| `DAILY_GENERATION_LIMIT` | `10` | Max generations per calendar day |

- Quota incremented when job status → `succeeded`
- Counts all sources: mock + CLI + API (configurable per source in future)
- Data stored in `storage/quota/daily.json` (gitignored)
- Resets automatically at midnight server local time
- If `DAILY_QUOTA_ENABLED=false`, no limit enforced

### Storage Format

```json
{
  "date": "2026-06-07",
  "total": 5,
  "bySource": {
    "mock": 2,
    "mmx-cli": 2,
    "minimax-api": 1
  },
  "updatedAt": "2026-06-07T10:30:00.000Z"
}
```

### Error Response

```json
{
  "ok": false,
  "error": {
    "type": "daily_quota_exceeded",
    "message": "Daily generation quota exceeded.",
    "hint": "Quota resets at midnight server time."
  }
}
```
**HTTP 429**

---

## Protected API Routes

| Route | Method | Protection |
|-------|--------|------------|
| `/api/generate` | POST | Preview Access → Generation Access → Rate Limit → Daily Quota |
| `/api/jobs` | GET | Preview Access → Generation Access |
| `/api/jobs/:id` | GET | Preview Access → Generation Access |
| `/api/jobs/:id/cancel` | POST | Preview Access → Generation Access |
| `/api/health` | GET | None (designed to be public) |

---

## Guard Ordering and Error Types

Each guard returns a specific error type:

| Guard | HTTP Status | Error Type |
|-------|-------------|------------|
| Preview Access required | 401 | `guard` |
| Generation Access required | 401 | `generation_access_required` |
| Rate limit exceeded | 429 | `rate_limit_exceeded` |
| Daily quota exceeded | 429 | `daily_quota_exceeded` |

Frontend maps these to Chinese messages:
- `generation_access_required` → "需要生成访问授权，请先在设置中完成解锁"
- `rate_limit_exceeded` → "生成请求过于频繁，请稍后再试"
- `daily_quota_exceeded` → "今日生成额度已用完，请明天再试"

---

## Security Rules

1. **PINs are never logged** — `server/auth.ts` explicitly filters Authorization-related headers
2. **PINs are never stored** — cookie contains only a signed token, not the PIN
3. **API keys are never logged** — server-side request functions filter `x-minimax-api-key`
4. **Authorization headers are never logged** — request logger redacts them
5. **No `.env` committed to git** — `.gitignore` excludes all `.env` except `.env.example`
6. **Quota data is not committed** — `storage/quota/*.json` is gitignored
7. **No real secrets in documentation** — all examples use `<placeholder>` format

---

## Limitations

- **Single shared PIN** — not a multi-user account system
- **No per-user quota isolation** — all visitors share the same daily limit
- **In-memory rate limit** — resets on restart; cannot distinguish between different users behind same NAT
- **No persistent rate limit state** — rate limit window resets on restart
- **No audit trail** — no per-user generation history beyond job records
- **Server-side only** — these are not blockchain-level guarantees

### Future Improvements (Phase 4D / 4E)

- Redis for persistent rate limiting across restarts
- Per-user quota with user accounts
- IP allowlist / blocklist
- Audit log for all generation events
- Admin dashboard for quota management
- Integration with MiniMax dashboard for live credit tracking

---

## Recommended Configuration

### Personal Deployment (localhost / private server)
```bash
# Default settings are fine — all protection OFF by default
REAL_GENERATION_ENABLED=false  # or true if you want real generation
GENERATION_ACCESS_ENABLED=false
DAILY_QUOTA_ENABLED=false      # not needed for single user
```

### Shared Private Deployment
```bash
REAL_GENERATION_ENABLED=true
GENERATION_ACCESS_ENABLED=true
GENERATION_ACCESS_PIN=<your_shared_pin>
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=5
DAILY_QUOTA_ENABLED=true
DAILY_GENERATION_LIMIT=20
```

### Public Deployment
```bash
REAL_GENERATION_ENABLED=true    # only after enabling all gates
GENERATION_ACCESS_ENABLED=true
GENERATION_ACCESS_PIN=<strong_random_pin>
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=3
DAILY_QUOTA_ENABLED=true
DAILY_GENERATION_LIMIT=10
PREVIEW_ACCESS_ENABLED=true    # also gate page access
PREVIEW_ACCESS_PIN=<same_or_different_pin>
```

---

## Files

| File | Purpose |
|------|---------|
| `server/auth.ts` | HMAC cookie creation + verification for both access gates |
| `server/rate-limit.ts` | Rate limiting + daily quota tracking |
| `server/index.ts` | Guard chain in `handleGenerate` + generation-access routes |
| `server/jobs.ts` | Quota increment on job success |
| `server/types.ts` | Config types + error type additions |
| `src/lib/serverApi.ts` | Frontend API functions for access gate unlock/logout |
| `src/features/settings/Settings.tsx` | Settings UI for generation access + quota status |
| `storage/quota/daily.json` | Runtime quota data (gitignored) |

---

## 与 BYOK 模式的兼容性

Generation Access Gate（Phase 4C）和 BYOK（Phase 5A）是两个独立的安全层，可以同时启用：

| 场景 | Generation Access | BYOK Key | 结果 |
|------|------------------|----------|------|
| 公开部署 | 需要 PIN | 不需要 | mock 生成（安全）|
| 公开部署 + BYOK | 需要 PIN | 需要 | 需要 PIN + session key |
| 个人自托管 | 不需要 | 不需要 | 直接生成 |
| 个人自托管 + BYOK | 不需要 | 需要 | 直接生成 + session key |

- Generation Access Gate 控制"是否可以触发生成"
- BYOK 控制"生成时使用谁的 API key"
- 两者是正交的，可以独立配置
- `REAL_GENERATION_ENABLED=false` 时两者都被 bypass，走 mock

详见 [docs/BYOK_MODE.md](BYOK_MODE.md)。

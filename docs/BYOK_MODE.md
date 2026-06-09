# BYOK Mode

> Phase 5A: Bring Your Own Key — No-Login, Self-Hosted MiniMax Generation

## Current Status (Post CLI-Web-G)

> **⚠️ NOTE**: As of Phase CLI-Web-G (2026-06-09), the recommended main path for
> personal self-hosted generation is **`backend=cli`** (MMX CLI), not BYOK/API mode.
> BYOK remains the open-source research direction, but the CLI path is proven stable.
>
> | Path | Status |
> |------|--------|
> | `backend=cli` (MMX CLI) | ✅ Recommended — matches Telegram path |
> | `backend=api` (BYOK) | ⚠️ Experimental — research only |

## What is BYOK

BYOK (Bring Your Own Key) lets users provide their own MiniMax Token Plan API key
in the browser session for API Adapter generation. No account registration required.
Users own their keys; the server never stores them persistently.

## Flow

```
Browser (React state, session-only)
  → x-minimax-api-key HTTP header
    → server /api/generate
      → server validates key format locally (no network call)
        → server stores key in memory Map (job.id → key, 30min TTL)
          → worker reads key only for that specific job
            → key is deleted on success / failure / cancel / TTL expiry
```

## Storage

| Layer | Storage | Persistence |
|-------|---------|-------------|
| Browser | React state (in-memory) | Cleared on page refresh |
| Server | `byok-secrets` Map (job.id → key) | Memory only, TTL 30min |
| Disk | Never | — |
| Manifest | Never | — |
| Audit logs | Only `keyLengthBucket` (string length bucket) | — |
| Server logs | Redacted (shows `sk_***redacted`) | — |

## Environment Variables

```bash
# Enable BYOK mode (default: false)
BYOK_ENABLED=false

# Allow server to fall back to MINIMAX_API_KEY when user provides no key (default: false)
# SECURITY NOTE: setting this to true silently spends server quota — use with caution.
SERVER_KEY_FALLBACK=false

# Key storage backend (currently only "memory" is supported)
BYOK_KEY_STORAGE=memory
```

## Runtime Behavior

| Backend | `realGeneration` | `BYOK_ENABLED` | Key required? |
|---------|-----------------|---------------|---------------|
| mock | any | any | No |
| cli | any | any | No (CLI uses server auth) |
| api | false | any | No (safe mock path) |
| api | true | false | Yes (`MINIMAX_API_KEY` env, server pays) |
| api | true | true | Yes (`x-minimax-api-key` header, **user pays**) |

### Decision Logic (in `handleGenerate`)

```
backend=api + byokEnabled=true:
  ├─ Has x-minimax-api-key header:
  │   ├─ validateKeyLooksReasonable() — local format check only (no MiniMax API call)
  │   │   └─ fail → 400 "Key 长度过短…"
  │   └─ setJobApiKey(job.id, key) → createJob(..., 'session') → enqueue
  │
  ├─ No header key + serverKeyFallback=true + MINIMAX_API_KEY set:
  │   └─ createJob(..., 'server') → server pays (NOT recommended for shared deployments)
  │
  └─ No header key + serverKeyFallback=false:
      └─ 400 "请先在设置页填写你的 MiniMax Token Plan Key"
         (no job created, no network call, no quota spent)

backend=mock → always mock path, no key required
backend=cli → MMX CLI adapter uses server auth, page key ignored
```

## Security Model

- **Client cannot force server key mode** — `keyMode` is server-controlled, client body is ignored
- **x-minimax-api-key never in URL or JSON body** — sent via request header only
- **Server key fallback disabled by default** — `SERVER_KEY_FALLBACK=false` prevents accidental server quota spend
- **Logs are redacted** — key values replaced with `sk_***redacted`
- **Audit only records metadata** — `byok: boolean` + `keyLengthBucket`, never the key itself
- **Key removed on all job cleanup paths** — success / failure / cancel / TTL expiry
- **No localStorage / sessionStorage** — key exists only in React component state

## Audit Log Fields

When `AUDIT_LOG_ENABLED=true`, `auditGenerationRequested` records:

```json
{
  "event": "generation_requested",
  "byok": true,
  "keyLengthBucket": "40-49",
  "generationSource": "minimax-api",
  "keyMode": "session"
}
```

`keyLengthBucket` is one of: `"<12"`, `"12-19"`, `"20-29"`, `"30-39"`, `"40-49"`, `">=50"`.

## Limitations

- API Adapter remains **experimental** — real generation requires `REAL_GENERATION_ENABLED=true`
- Real BYOK generation test is **deferred to Phase 5B** (requires user confirmation)
- No multi-user account system yet — key ownership is per-session
- MiniMax Token Plan key format may vary; validation is conservative to avoid false negatives

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `BYOK_ENABLED` | `false` | Enable BYOK mode |
| `SERVER_KEY_FALLBACK` | `false` | Allow server to use `MINIMAX_API_KEY` as fallback |
| `BYOK_KEY_STORAGE` | `memory` | Storage backend (memory only for now) |
| `MINIMAX_API_KEY` | — | Server's own MiniMax key (used when `keyMode=server`) |

## Related Documents

- [RUNTIME_MODES.md](./RUNTIME_MODES.md) — All runtime modes explained
- [SECURITY.md](./SECURITY.md) — Security model and best practices
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment configurations
- [BYOK_NO_LOGIN_TOOL_MODE_ARCHITECTURE.md](./BYOK_NO_LOGIN_TOOL_MODE_ARCHITECTURE.md) — Architecture decision record

---

## v0.4.0-alpha 版本边界

本文档描述的功能已冻结于 v0.4.0-alpha（Phase 5A-5E）。

**本版本不包含：** 成功的真实 MiniMax API 音频生成。下次真实测试建议 `REAL_API_DAILY_ATTEMPT_LIMIT=1` + 前端防抖 + 人工确认窗口。

**Phase API-Debug-B0 (2026-06-09)**: Async task response 结构化识别完成。新增 `server/adapters/minimax-api/response.ts` — 提供 5 种 response kind（direct_audio/hex_audio/async_task/failure/unknown）。async task 不再报"音频格式无法处理"，改为 `MINIMAX_API_ASYNC_POLLING_REQUIRED`。不猜 polling endpoint。`api-adapter-async-contract-smoke-test.sh` 20/20 PASS，`api-adapter-contract-smoke-test.sh` 21/21 PASS。下一阶段需要确认官方 polling endpoint 才可进行真实 API 调用。

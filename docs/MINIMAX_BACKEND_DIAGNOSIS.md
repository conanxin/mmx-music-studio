# MiniMax Backend Diagnosis

**Phase**: 5B-D-Diagnosis
**Date**: 2026-06-08
**Status**: COMPLETE

---

## User-Observed Issue

> User reports: Telegram can generate music successfully through Hermes, while Web BYOK/API mode shows "quota exhausted" (真实测试剩余 0 次 / 今日真实 API 测试次数已用完).

The user correctly suspects the Web "quota" message is misleading.

---

## Root Cause Summary

**Telegram and Web are using different backends:**

| Path | Backend | Key Source | Local Guard | Status |
|------|---------|------------|-------------|--------|
| Telegram | MMX CLI (`minimax_music.sh`) | `~/.mmx/config.json` via `mmx auth` | None | ✅ Working |
| Web `backend=cli` | MMX CLI (server-side) | `~/.mmx/config.json` via `mmx auth` | None | ⚠️ Untested |
| Web `backend=api` | API Adapter (MiniMax REST API) | User-provided `x-minimax-api-key` | `realApiAttemptLimitEnabled=true`, `dailyLimit=0` | 🔒 Blocked |

**The Web "quota exhausted" message refers to the local project protection counter, NOT MiniMax official Token Plan quota.**

---

## Backend Comparison

### Telegram → MMX CLI

```
User Telegram → Hermes skill → minimax_music.sh → mmx music generate → MiniMax API
```

- Uses `~/.mmx/config.json` (authenticated via `mmx auth login`)
- No local guard counters
- Directly calls `mmx music generate --instrumental --prompt "..."`
- **Proven working**: Successfully generated music
- `mmx quota` shows: official `general` model remaining percent: 91%, weekly remaining percent: 94%

### Web `backend=api` (current) → API Adapter

```
User Web → /api/generate → executeApiJob() → callMiniMaxApi() → MiniMax REST API
```

- Uses user-provided BYOK key or server-side key
- Protected by `REAL_API_ATTEMPT_LIMIT_ENABLED=true` + `REAL_API_DAILY_ATTEMPT_LIMIT=0`
- **Current state**: `dailyLimit=0` means the guard blocks ALL attempts, resulting in "quota exhausted" message
- This is a local project test protection, NOT MiniMax official quota

### Web `backend=cli` (recommended for immediate fix)

```
User Web → /api/generate → executeCliJob() → generateWithMmxCli() → mmx music generate → MiniMax API
```

- Uses `~/.mmx/config.json` (same as Telegram)
- No local guard counters apply
- Matches Telegram's proven-working path
- **Recommended for immediate deployment**

---

## Important Distinction

| Counter | Location | What It Tracks | Exhausted Because |
|---------|----------|----------------|-------------------|
| `realApiAttemptsUsed` | `storage/quota/real-api-attempts.json` | Local project test guard: how many times `backend=api` path was attempted | `REAL_API_DAILY_ATTEMPT_LIMIT=0` (misconfigured) |
| `dailyGenerationUsed` | `storage/quota/daily.json` | Local project generation quota | User hit `DAILY_GENERATION_LIMIT=10` |
| MiniMax official quota | `mmx quota` / MiniMax platform | Real MiniMax Token Plan credits | **NOT exhausted** —91% remaining |

**The local `realApiAttemptsUsed` counter (currently 10) has no relation to MiniMax official quota.**

---

## Current Configuration

From `/api/health`:

```json
{
  "backend": "api",
  "realGenerationEnabled": true,
  "byokEnabled": true,
  "realApiAttemptLimitEnabled": true,
  "realApiDailyAttemptLimit": 0,
  "realApiAttemptsUsed": 10,
  "remainingRealApiAttempts": 0,
  "dailyQuotaEnabled": false,
  "dailyGenerationLimit": 10,
  "dailyGenerationUsed": 5,
  "remainingDailyGenerations": 5,
  "cliAvailable": null,
  "cliAuthenticated": null,
  "cliRegion": null
}
```

### Key Issues

1. **`realApiDailyAttemptLimit: 0`** — This is the critical misconfiguration. A limit of 0 means the guard blocks every attempt. This is likely a leftover from Phase 5B-C smoke test debugging (debug reset script set it to 0 to prevent quota accumulation during testing).

2. **`cliAvailable: null`** — The server did not detect MMX CLI availability. This needs investigation.

3. **`backend: api`** — Web is configured to use the API Adapter, which is the experimental path, not the proven CLI path.

---

## MiniMax Official Quota Status

From `mmx quota` (executed without proxy interference):

```json
{
  "model_remains": [{
    "model_name": "general",
    "current_interval_remaining_percent": 91,
    "current_weekly_remaining_percent": 94,
    "current_interval_status": 1,
    "current_weekly_status": 1
  }]
}
```

**MiniMax official Token Plan quota is healthy (91% remaining in current interval).**

---

## Recommendation

### Immediate Fix (Phase CLI-Web)

For immediate working Web generation:

1. Set `MINIMAX_BACKEND=cli` in environment
2. The CLI path (`executeCliJob` → `generateWithMmxCli`) uses the same `mmx` authentication as Telegram
3. No local guard counters apply to CLI path
4. This matches the Telegram proven-working path

### Investigate API Adapter Separately (Phase API-Debug)

The API Adapter (`executeApiJob` → `callMiniMaxApi`) is experimental:
- Needs separate debugging
- `realApiDailyAttemptLimit=0` needs to be set to a reasonable value (e.g.,3-5) if testing is desired
- The `cliAvailable: null` issue needs to be fixed regardless

### UI Copy Fix

Replace ambiguous messages that confuse local guard with MiniMax official quota:

| Before (misleading) | After (accurate) |
|--------------------|--------------------|
| 真实测试剩余 0 次 | 本地真实 API 测试剩余 0 次（项目保护限制） |
| 今日真实 API 测试次数已用完 | 本地真实 API 测试次数已用完（项目保护限制，不代表 MiniMax 官方额度） |
| 今日生成额度已用完 | 本地每日生成保护次数已用完 |

Add backend indicator:
- `backend=cli`: "当前使用 MMX CLI，与 Telegram 生成链路一致"
- `backend=api`: "当前为 API Adapter 实验链路；Telegram 生成成功使用的是 MMX CLI 链路"

---

## Files Involved

- `server/index.ts` — backend routing, health endpoint
- `server/jobs.ts` — job execution (mock/cli/api paths)
- `server/rate-limit.ts` — realApiAttempt guard implementation
- `server/adapters/minimax-cli/client.ts` — MMX CLI adapter
- `src/features/studio/Studio.tsx` — UI quota display
- `src/features/settings/Settings.tsx` — settings display
- `docs/MINIMAX_BACKEND_DIAGNOSIS.md` — this document
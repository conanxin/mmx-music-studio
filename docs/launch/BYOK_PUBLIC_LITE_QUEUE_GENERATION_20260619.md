# BYOK Public Lite Queue Generation - 2026-06-19

## Goal

Move mmx-music-studio to a small public-lite BYOK mode for up to 5 active users.
The site remains publicly reachable, but expensive actions are protected by the
Public Lite active-user capacity gate.

This is not a broad public launch. There is no public sign-up, no account
system, no admin console, and no multi-tenant management workflow. If usage
grows beyond 5 active users, the project must upgrade to a real account,
workspace, quota, audit, deletion, and admin model.

## Runtime Model

- `PUBLIC_LITE_MODE_ENABLED=true` keeps the 5-active-user capacity gate active.
- `PUBLIC_LITE_MAX_ACTIVE_USERS=5` is the intended production cap.
- `PUBLIC_BYOK_ENABLED=true` exposes the BYOK panel.
- `PUBLIC_BYOK_QUEUE_ENABLED=true` switches `/api/generate/byok` into queued
  generation mode.
- `BYOK_ENABLED=true`, `REAL_GENERATION_ENABLED=true`, and `MINIMAX_BACKEND=api`
  are required for queued BYOK jobs.
- The server must not configure a shared `MINIMAX_API_KEY`.
- `SERVER_KEY_FALLBACK=false` must remain the production posture.

## Key Handling

Users provide their own MiniMax API Key for each generation request.

The API Key:

- is accepted only for the single `/api/generate/byok` request;
- is validated for shape before queueing;
- is stored only in the in-memory job secret store;
- is deleted on job success, failure, or cancellation;
- is never written to cookies, `localStorage`, `sessionStorage`, manifests,
  `storage/access`, job JSON, logs, Git, or Library metadata.

The job record stores prompt/model/mode and status only. It never stores the
MiniMax API Key, Authorization header, provider token, confirmation phrase, or
raw provider response.

## Capacity Gate

Public Lite capacity is checked before any high-cost action:

- `POST /api/generate`
- `POST /api/generate/byok`
- `POST /api/byok/direct-live/save-to-library`

When capacity is full, the server returns:

```json
{
  "ok": false,
  "code": "public_capacity_full",
  "stage": "public_capacity_full",
  "message": "The service is temporarily at capacity. Please try again later."
}
```

Capacity-full responses must not call MiniMax, must not download provider URLs,
must not write a manifest, must not write `storage/tracks`, and must not consume
BYOK live attempt/audio counters.

Read-only pages remain available:

- homepage
- Studio page
- Library page
- `/api/health`
- `/api/public-capacity`
- `/api/tracks`
- `/api/tracks/:id/audio`
- `/api/tracks/:id/download`

## Queue Behavior

Queued BYOK mode uses the existing job queue. The worker remains single-process
and single-concurrency:

- one job runs at a time;
- additional generation requests are queued;
- users see `byok_job_queued`, the job id, and the queue state;
- the frontend polls `/api/jobs/:id` for queued/running/succeeded/failed status;
- successful jobs save a local Library-backed track.

This intentionally does not attempt 5-way parallel MiniMax generation.

## Studio Copy

Studio must communicate the real operating mode:

- "使用自己的 MiniMax API Key 生成"
- "生成任务将排队执行"
- "本站不保存 API Key"
- "最多 5 个活跃用户"
- "BYOK live 默认关闭"

The old direct-live relay and Save to Library flow stays available in code for
controlled tests, but it is not the public-lite production generation path.

## Production Enablement

Minimal production config for public-lite queued BYOK:

```ini
PUBLIC_LITE_MODE_ENABLED=true
PUBLIC_LITE_MAX_ACTIVE_USERS=5
PUBLIC_BYOK_ENABLED=true
PUBLIC_BYOK_QUEUE_ENABLED=true
BYOK_ENABLED=true
REAL_GENERATION_ENABLED=true
MINIMAX_BACKEND=api
SERVER_KEY_FALLBACK=false
BYOK_DRY_RUN_ONLY=true
BYOK_LIVE_ENABLED=false
BYOK_DIRECT_LIVE_ENABLED=false
```

`BYOK_DRY_RUN_ONLY=true` and `BYOK_LIVE_ENABLED=false` can remain true/false
respectively because queued BYOK mode does not use the old live-window path.

## Non-Goals

This stage does not implement:

- public sign-up;
- password/login accounts;
- 5-way concurrent generation;
- a shared server-side MiniMax key;
- complex quota management;
- an admin dashboard;
- broad public launch readiness.

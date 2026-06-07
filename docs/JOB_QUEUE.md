# Job Queue

> Phase 4B — Async generation job queue for mmx-music-studio

## Why

Music generation is a long-running operation (30–120 seconds). Synchronous HTTP requests timeout, provide poor UX, and block server resources. The job queue solves this:

- Immediate response with `job.id` — UI never hangs
- Progress polling every 2 seconds — user sees real-time status
- Job cancellation — user can abort before completion
- Single worker with ordered queue — safe concurrent handling
- No API key stored in job data — security by design

## API

### POST /api/generate

Creates a generation job. Returns immediately with `job.id`.

**Request:**
```json
{
  "input": { "mode": "pure-music", "prompt": "深夜编程", ... },
  "keyMode": "server"
}
```

**Response (async — Phase 4B):**
```json
{
  "ok": true,
  "job": {
    "id": "job_1780819853320_db2357c9",
    "status": "queued",
    "progressMessage": "任务已排队",
    "createdAt": "2026-06-07T08:10:53.320Z"
  }
}
```

### GET /api/jobs

List all jobs (most recent first).

```json
{ "ok": true, "jobs": [...] }
```

### GET /api/jobs/:id

Poll job status. Call every 2 seconds.

**queued:**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "queued",
    "progressMessage": "任务已排队",
    "createdAt": "..."
  }
}
```

**running:**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "running",
    "progressMessage": "正在生成音乐…",
    "progressPercent": 45,
    "startedAt": "..."
  }
}
```

**succeeded:**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "succeeded",
    "progressMessage": "生成完成",
    "progressPercent": 100,
    "trackId": "track_...",
    "generationSource": "mock",
    "finishedAt": "..."
  }
}
```

**failed:**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "failed",
    "progressMessage": "生成失败",
    "error": { "type": "unknown", "message": "网络超时" }
  }
}
```

**cancelled:**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "cancelled",
    "progressMessage": "任务已取消"
  }
}
```

### POST /api/jobs/:id/cancel

Cancel a queued or running job.

```json
{ "ok": true, "jobId": "...", "cancelled": true }
```

## Status Lifecycle

```
queued → running → succeeded
                → failed
queued/running → cancelled
```

## Web Flow

1. User fills generation form and clicks "生成音乐"
2. Frontend calls `POST /api/generate`
3. Server returns `{ ok: true, job: { id, status: "queued" } }` immediately
4. Frontend shows job card with status badge ("排队中")
5. Frontend polls `GET /api/jobs/:id` every 2 seconds
6. Status transitions: `queued` → `running` → `succeeded/failed/cancelled`
7. Frontend shows progress bar and `progressMessage` during `running`
8. On `succeeded`: show audio player + download button + refresh recent tracks
9. On `failed`: show error message
10. On `cancelled`: show cancellation notice
11. User can click "取消生成" at any time during `queued` or `running`

## WeChat Mini-Program Flow

The mini-program uses the same job API via `apps/weapp/src/adapters/request.ts`:

- `generateTrack()` calls `POST /api/generate`
- If response has `job.id`, switch to polling mode
- Poll `GET /api/jobs/:id` every 2 seconds
- Display job status card with cancel button
- On `succeeded`, retrieve track from `job.trackId`

Phase 4B is compatible. Phase 4C/D will add WeApp-specific UI components for job display.

## Architecture

```
┌─────────────┐     POST /api/generate      ┌──────────────────┐
│   Studio    │ ─────────────────────────▶  │  handleGenerate  │
│   (Web)     │                             │                  │
└─────────────┘                             │  createJob()     │
      ▲                                     │       │          │
      │ GET /api/jobs/:id                   │       ▼          │
      │ (every 2s)                          │  jobStore (Map)  │
      │                                     │       │          │
      │                                     │  startWorker()  │
      │                                     │       │          │
      │                                     │  enqueueAndRun() │
      │                                     │       │          │
      │                                     │  callMiniMaxApi()│
      │                                     │   (mock/API/CLI) │
      │                                     └──────────────────┘
      │
┌─────────────┐     GET /api/tracks         ┌──────────────────┐
│  Library    │ ◀────────────────────────  │  storage/tracks/ │
│             │                             │  jobs.json       │
└─────────────┘                             └──────────────────┘
```

**Modules:**
- `server/jobs.ts` — job store, queue, worker, CRUD operations
- `server/call-minimax.ts` — MiniMax API/CLI/mock caller
- `server/index.ts` — HTTP routes, handles `/api/jobs/*`
- `src/lib/serverApi.ts` — frontend job API functions
- `src/features/studio/Studio.tsx` — job polling UI

## Safety

- **No API key in job data.** Keys are read from `config` at request time, not stored in jobs.
- **No Authorization header in job data.** Header is set per-request, not persisted.
- **No key in manifest.** `src/lib/apiManifest.ts` stores only feature flags, not credentials.
- **Real generation gated.** `REAL_GENERATION_ENABLED=false` blocks all real API/CLI calls.
- **Smoke tests use mock mode.** `job-queue-smoke-test.sh` enforces `MOCK_GENERATION_ENABLED=true`.
- **No credentials in logs.** Authorization headers are never logged.

## Limitations

- **Single worker.** Only 1 generation runs at a time. Queue is FIFO.
- **No multi-user isolation.** All jobs share the same queue. Phase 4C will add user auth.
- **No rate limiting.** Phase 4C will add per-user quota enforcement.
- **No persistent retry.** Failed jobs are marked failed, not retried. Phase 4C may add retry logic.
- **Cancel is cooperative.** Running jobs check `isCancelled()` between mock "work" intervals, but forcefully terminated calls may still complete.

## Phase 4C — Completed

- ✅ User authentication (session cookies, Generation Access PIN)
- ✅ Per-user rate limiting and quota tracking
- ✅ Retry logic for failed/cancelled jobs
- ✅ WebSocket push for job progress — not yet implemented (polling remains)
- ⬜ Job TTL and automatic cleanup — pending
- ✅ Admin dashboard for job monitoring — see Phase 4D

## Phase 4D — Completed

### Job History Admin (`/jobs` page)

Web 端支持任务历史管理面板，用于排查失败任务和查看生成状态。

**新增 API 端点：**
- `GET /api/jobs/stats` — 返回任务统计（total/queued/running/succeeded/failed/cancelled/workerBusy/queueLength）
- `DELETE /api/jobs/:id` — 删除已完成/失败/已取消的任务记录（running 状态拒绝删除）
- `POST /api/jobs/:id/retry` — 重新提交 failed/cancelled 任务为新任务

**前端页面：**
- 统计概览（6 张状态卡片）
- 状态标签筛选（全部/排队中/运行中/已完成/失败）
- 关键词搜索
- 任务详情面板（底部抽屉）
- 取消/重试/删除操作
- 移动端响应式布局

**安全说明：**
- Job record 不保存 API key / Authorization header / PIN
- Retry 真实生成仍受 Generation Access PIN + Rate Limit + Daily Quota 保护
- 删除 job record 默认不删除对应的音频文件（storage/tracks/）

## Limitations

- **Single worker.** Only 1 generation runs at a time. Queue is FIFO.
- **No multi-user isolation.** All jobs share the same queue. Phase 5 may add multi-user support.
- **Cancel is cooperative.** Running jobs check `isCancelled()` between mock "work" intervals, but forcefully terminated calls may still complete.

## Future: Phase 4E

- HTTPS 域名正式实装
- 外部可访问的生产部署
- 微信小程序正式上线

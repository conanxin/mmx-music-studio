# 任务历史管理 (Job History Admin)

## 概述

任务历史管理（Phase 4D）提供完整的生成任务生命周期可视化和控制能力。

**Phase 4D 完成日期：** 2026-06-07

## 功能范围

### 查看
- 任务列表：全部 / 排队中 / 运行中 / 已完成 / 失败 / 已取消
- 任务统计：每种状态的实时数量
- 任务详情：job id、状态、进度、消息、错误、track 信息、时间线

### 控制
- **取消**：可取消排队中 / 运行中的任务
- **重试**：可重试失败 / 已取消的任务
- **删除**：可删除已完成 / 失败 / 已取消的任务记录（不删除音频文件）

### 限制
- 运行中的任务不能直接删除，必须先取消
- 删除仅删除 job record，不删除 storage/tracks 中的音频文件
- 重试会重新提交生成，在真实模式下会消耗额度

## API

### GET /api/jobs

列出所有任务，支持筛选和分页。

**Query 参数：**
- `status` — `queued` | `running` | `succeeded` | `failed` | `cancelled`
- `search` — 搜索 prompt / title
- `limit` — 每页数量
- `offset` — 偏移量
- `sort` — `newest`（默认）| `oldest`

**响应：**
```json
{
  "ok": true,
  "jobs": [/* GenerateJob[] */],
  "total": 42
}
```

### GET /api/jobs/stats

获取任务队列统计。

**响应：**
```json
{
  "ok": true,
  "stats": {
    "total": 42,
    "queued": 1,
    "running": 0,
    "succeeded": 35,
    "failed": 4,
    "cancelled": 2,
    "workerBusy": false,
    "queueLength": 1
  }
}
```

### GET /api/jobs/:id

获取单个任务详情。

**响应：**
```json
{
  "ok": true,
  "job": {
    "id": "...",
    "status": "succeeded",
    "progress": 1.0,
    "progressMessage": "生成完成",
    "track": { "id": "...", "title": "...", "audioUrl": "..." },
    "createdAt": "...",
    "startedAt": "...",
    "completedAt": "...",
    "generationSource": "mock"
  }
}
```

### POST /api/jobs/:id/cancel

取消排队中 / 运行中的任务。

**响应：**
```json
{ "ok": true, "jobId": "...", "cancelled": true }
```

### DELETE /api/jobs/:id

删除任务记录（不删除音频）。

**限制：** 运行中的任务不能删除（返回 400）。

**响应：**
```json
{ "ok": true, "deleted": true, "jobId": "..." }
```

### POST /api/jobs/:id/retry

重试失败 / 已取消的任务。

**限制：** 只能重试 `failed` 或 `cancelled` 状态的任务。

**响应：**
```json
{
  "ok": true,
  "job": { "id": "...", "status": "queued", ... },
  "message": "任务已重新提交"
}
```

## Web UI

访问 `/jobs` 路由查看任务历史管理页面。

**页面结构：**
1. **统计卡** — 6 种状态的实时数量，点击可筛选
2. **状态标签** — 横向滚动标签栏，快速筛选
3. **任务列表** — 卡片式列表，显示状态、模式、prompt 摘要、时间、操作按钮
4. **详情面板** — 底部抽屉（移动端）/ 居中弹窗（桌面端），显示完整任务信息、音频播放、下载链接

**UI 安全原则：**
- job 对象不暴露 API key / Authorization header
- 详情面板不显示任何凭证信息
- 所有操作有确认提示（取消、删除）
- 删除有明确提示：音频文件不会被删除

## 安全模型

- **无凭证存储：** job record 不存储 API key 或 Authorization
- **Phase 4C 保护：** 真实生成受 Generation Access / Rate Limit / Daily Quota 三层保护
- **幂等删除：** 删除 job 不影响 track 文件，可独立管理
- **后端验证：** 所有操作有服务端权限校验（cancel 不能用于 succeeded job）

## 局限性

1. **单机内存存储：** 重启服务后 job history 丢失（适用于个人自托管场景）
2. **无多用户隔离：** 所有用户共享同一 job store（单人自托管预期场景）
3. **删除不删除音频：** 需要手动清理 storage/tracks
4. **重试仅 mock 验证：** 真实重试会消耗额度，建议在 mock 模式验证流程
5. **后续可扩展：**
   - 管理后台权限（admin PIN）
   - 持久化存储（SQLite / PostgreSQL）
   - 多用户隔离（per-user job filter）
   - 批量操作（批量取消、批量删除）

## 技术实现

- `server/jobs.ts` — `listJobs(filters)`、`getJobStats()`、`deleteJob()`、`retryJob()`
- `server/index.ts` — 路由注册和 handler
- `src/lib/serverApi.ts` — 客户端 API 函数
- `src/features/jobs/Jobs.tsx` — React 任务历史页面
- `apps/weapp/src/adapters/request.ts` — 小程序端 adapter
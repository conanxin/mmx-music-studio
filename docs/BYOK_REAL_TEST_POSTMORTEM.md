# BYOK 真实 API 测试事故复盘
# Phase 5B-C Postmortem — 2026-06-08

## 执行摘要

2026-06-07 Phase 5B-B BYOK 真实 API 测试期间，观察到 `storage/quota/daily.json` 显示 `total=14`。初步怀疑是 14 次真实 MiniMax API 调用消耗了额度。经事后复盘调查，**实际消耗为 0 次真实 API 调用**，但发现了真实的保护缺口。

---

## 一、发生了什么

### 1.1 观察到的现象

```
storage/quota/daily.json:
{
  "date": "2026-06-08",
  "total": 14,
  "bySource": { "mock": 14, "minimax-api": 0, "mmx-cli": 0 },
  "updatedAt": "2026-06-08T02:12:54.401Z"
}

storage/jobs/jobs.json (总计 102 个 job):
- backend=api:  1 个 (job_1780875965479_e94de829, status=failed, keyMode=session)
- backend=mock: 101 个

API job 错误信息: "MiniMax API 错误: login fail: Please carry the API secret key..."
```

### 1.2 实际发生了什么

**14 次 quota 消耗全部是 mock jobs，不是真实 MiniMax API 调用。**

可能的根本原因链：

1. **Phase 5B-B server 配置了 `backend=api` + `realGenerationEnabled=true`**：
   - 预期：所有 jobs 使用 `executeApiJob` → 调用 `callMiniMaxApi` → 真实 API
   - 实际：由于某种原因（端口冲突、配置错误、进程管理问题），server 可能没有按预期启动

2. **server/index.ts 的防御逻辑**：
   ```typescript
   const effectiveBackend: BackendMode =
     !config.realGenerationEnabled ? 'mock' : backend;
   ```
   如果 `realGenerationEnabled=false`（配置错误或被覆盖），则所有 jobs 回退到 mock

3. **daily quota 计数逻辑**：
   - `incrementDailyQuota('mock')` 在 `executeMockJob` 成功时调用
   - `incrementDailyQuota('minimax-api')` 在 `executeApiJob` 成功时调用
   - **failed jobs 不计数**（只有 succeeded 才调用 increment）

4. **Phase 5B-B 只产生了 1 个真实 API job**（backend=api），但因 `x-minimax-api-key` header 缺失而 failed → **未消耗额度**

### 1.3 真实消耗分析

| 来源 | 次数 | 说明 |
|------|------|------|
| `minimax-api` (bySource) | 0 | 无成功的真实 API 调用 |
| `mmx-cli` (bySource) | 0 | 无 CLI 调用 |
| `mock` (bySource) | 14 | 模拟生成，但计入了 daily quota |

**结论：实际真实 API 调用次数为 0，未消耗真实额度。**

但 Phase 5B-B 暴露了一个关键问题：

> **即使产生了 1 个真实 API job，如果 `x-minimax-api-key` header 配置错误或缺失，job 会以 `minimax_api` 错误 failed。但 failed job 不计入 quota，server 不会阻止重试。如果用户反复重试，可能在 key 修复后短时间内大量消耗额度。**

---

## 二、为什么配额保护失效

### 2.1 现有保护层

| 保护层 | 触发时机 | 作用 |
|--------|----------|------|
| `DAILY_GENERATION_LIMIT` | job succeeded 后 | 限制成功次数 |
| `RATE_LIMIT_MAX_REQUESTS` | 请求到达时 | 限制请求频率 |
| `PREVIEW_ACCESS` | 请求到达时 | 访问控制 |
| `GENERATION_ACCESS` | 生成请求时 | 生成访问控制 |
| `BYOK key validation` | job 创建时 | 检查 key 格式 |

### 2.2 保护缺口

**缺口 #1：Real API Attempt 没有独立计数**

当前 `daily quota` 在 job **成功后**计数。如果用户：
1. 触发 100 次 job 创建
2. 其中 99 次因网络错误 failed
3. 1 次成功

→ 99 次真实 API 调用已发生，但 quota 只显示 1。

**缺口 #2：Attempt 在 network call 之前计数**

`incrementDailyQuota` 在 `executeApiJob` 的 try/catch 之外调用：
```typescript
// jobs.ts executeApiJob
try {
  apiResult = await callMiniMaxApi({...}); // 真实 API 调用发生在这里
} catch (err) {
  // quota 未增加
  return; // failed job 不计入 quota
}
// succeeded: incrementDailyQuota('minimax-api')
```
如果 job 成功，API 调用已发生，quota 在之后才增加。

**缺口 #3：没有 attempt 级别的硬限制**

当前 quota 是"成功后计数"，没有"尝试前检查"。如果用户快速重试 100 次，可能真的调用了 100 次 MiniMax API，然后只有 1 次成功计入 quota。

**缺口 #4：前端无硬保护**

前端按钮虽有 `isGenerating` 状态，但：
- 如果用户在 job 创建后刷新页面，重新点击可能创建新 job
- 后端没有幂等性保护（无 clientRequestId 去重）

---

## 三、修复方案：Real API Attempt Guard

### 3.1 核心原则

**"一旦准备调用真实 MiniMax API，就计为一次 attempt。"**

- attempt 在 network call **之前**计数
- 不等成功或失败
- 超限后直接返回 429，不发出任何网络请求
- 不保存 API key/token/secret

### 3.2 新增环境变量

```bash
REAL_API_ATTEMPT_LIMIT_ENABLED=true   # 启用 attempt guard
REAL_API_DAILY_ATTEMPT_LIMIT=1         # 每日最多 1 次真实 API attempt
```

### 3.3 存储文件

```
storage/quota/real-api-attempts.json
{
  "date": "YYYY-MM-DD",
  "attempts": 0,          // 已发生的真实 API attempt 次数
  "updatedAt": "..."
}
```

### 3.4 集成点

`executeApiJob` 在调用 `callMiniMaxApi` **之前**必须：
1. 检查 `REAL_API_ATTEMPT_LIMIT_ENABLED`
2. 调用 `checkRealApiAttemptLimit()` — 如果 remaining=0，job 直接 failed，不调用 MiniMax
3. 如果 allowed，调用 `reserveRealApiAttempt()` — **先计数，再调用**

### 3.5 幂等性保护（Phase 5B-D）

通过 `clientRequestId` 防止重复创建 job：
- 前端每次点击生成生成一个 UUID
- 后端内存 Map 缓存 `clientRequestId → jobId`，TTL 10 分钟
- 重复提交返回已有 job，不创建新 job

---

## 四、后续真实测试前的硬门槛

在进入下一个 BYOK 真实测试阶段之前，必须满足以下所有条件：

### 必须满足

- [ ] `REAL_API_ATTEMPT_LIMIT_ENABLED=true`
- [ ] `REAL_API_DAILY_ATTEMPT_LIMIT=1`
- [ ] `remainingRealApiAttempts` 从 `/api/health` 返回且值为 1
- [ ] 前端显示"真实 API 测试模式，剩余 N 次"
- [ ] 执行 `real-api-attempt-guard-smoke-test.sh` 全量通过
- [ ] 执行 `byok-mode-smoke-test.sh` 全量通过

### 禁止条件

- [ ] `remainingRealApiAttempts = 0` 时禁止触发真实生成
- [ ] `REAL_API_DAILY_ATTEMPT_LIMIT` 不允许手动临时调高（除非明确知道会消耗）
- [ ] 不要在 port 冲突或配置不确定的情况下启动 realGeneration server

### 真实测试流程

1. **启动前确认**：`curl http://127.0.0.1:8787/api/health | jq '.remainingRealApiAttempts'` → 应为 `1`
2. **执行一次真实生成**
3. **立即再次检查**：`remainingRealApiAttempts` → 应为 `0`
4. **尝试第二次**：应返回 429 或 job failed（guard 拦截）
5. **测试后**：切换回 mock 或等待次日 quota 重置

---

## 五、关键文件

| 文件 | 说明 |
|------|------|
| `server/rate-limit.ts` | 增加 `RealApiAttemptGuard` 相关函数 |
| `server/jobs.ts` | `executeApiJob` 接入 attempt guard |
| `server/index.ts` | `/api/health` 增加 `realApiAttemptLimit` 字段 |
| `src/features/studio/Studio.tsx` | 前端增加真实测试防重复警告 |
| `docs/BYOK_REAL_TEST_PLAN.md` | 更新真实测试流程要求 |
| `scripts/real-api-attempt-guard-smoke-test.sh` | Attempt guard 全量测试 |

---

## 六、脱敏数据摘要

### storage/quota/daily.json (2026-06-08)

```json
{
  "date": "2026-06-08",
  "total": 14,
  "bySource": { "mock": 14, "minimax-api": 0, "mmx-cli": 0 },
  "updatedAt": "2026-06-08T02:12:54.401Z"
}
```

### storage/jobs/jobs.json (总计 102 jobs)

| backend | 数量 | 备注 |
|---------|------|------|
| mock | 101 | 全部为 mock 生成 |
| api | 1 | failed, keyMode=session, 错误: "login fail..." |

### API Job 详情（脱敏）

```
id: job_1780875965479_e94de829
backend: api
keyMode: session
status: failed
error.type: minimax_api
error.message: "login fail: Please carry the API secret key in the 'Authorization' field..."
createdAt: 2026-06-07T23:46:05
```

该 job 因缺少 `x-minimax-api-key` header 而失败，未消耗真实额度。

---

*本文档脱敏处理：不包含任何 API key、token、Authorization header、cookie、签名 URL 或 prompt 全文。*
*生成时间：2026-06-08T10:54 CST*